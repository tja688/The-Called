using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Nodes;
using NUnit.Framework;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class MatchFlowTests
    {
        [Test]
        public void Snapshot_roundtrip_continues_with_the_same_events()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            MatchSession original = Start(catalog, 3);
            AdvanceResult pending = original.Advance();
            string snapshot = original.ToSnapshot();
            MatchSession restored = MatchSession.FromSnapshot(snapshot, catalog);

            Assert.That(restored.ToSnapshot(), Is.EqualTo(snapshot));
            string option = pending.Pending!.Options[0].Id;
            original.SubmitAndAdvance(option);
            restored.SubmitAndAdvance(option);

            Assert.That(restored.EventHash(), Is.EqualTo(original.EventHash()));
        }

        [Test]
        public void Snapshot_rejects_a_different_kernel_version()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            MatchSession session = Start(catalog, 1);
            session.Advance();
            string snapshot = session.ToSnapshot().Replace("\"kernel\":\"" + KernelVersion.Text + "\"", "\"kernel\":\"9.9.9\"", StringComparison.Ordinal);

            var error = Assert.Throws<InvalidOperationException>(() => MatchSession.FromSnapshot(snapshot, catalog));

            Assert.That(error!.Message, Does.Contain("内核版本不符"));
            Assert.That(error.Message, Does.Contain("9.9.9"));
        }

        [Test]
        public void Replay_reproduces_the_event_hash()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            PlayoutResult played = RandomPlayout.Play(catalog, Setup(catalog, 11), 400, null);
            MatchSession replayed = MatchSession.PlayReplay(played.ReplayJson, catalog);

            Assert.That(replayed.EventHash(), Is.EqualTo(played.Hash));
            Assert.That(played.Winner, Is.Not.EqualTo("unfinished"));
        }

        [Test]
        public void Replay_rejects_a_different_content_hash()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            PlayoutResult played = RandomPlayout.Play(catalog, Setup(catalog, 2), 50, null);
            string replay = played.ReplayJson.Replace(catalog.Hash, new string('a', catalog.Hash.Length), StringComparison.Ordinal);

            var error = Assert.Throws<InvalidOperationException>(() => MatchSession.PlayReplay(replay, catalog));

            Assert.That(error!.Message, Does.Contain("内容哈希不符"));
        }

        [Test]
        public void Copy_does_not_share_later_answers()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            MatchSession original = Start(catalog, 5);
            AdvanceResult pending = original.Advance();
            int hand = original.View("player").HandCount;
            MatchSession copy = original.Copy();

            copy.SubmitAndAdvance(pending.Pending!.Options[0].Id);

            Assert.That(original.View("player").HandCount, Is.EqualTo(hand));
            Assert.That(original.Advance().Pending, Is.Not.Null);
            Assert.That(original.EventHash(), Is.Not.EqualTo(copy.EventHash()));
        }

        [Test]
        public void Public_view_hides_the_hand_but_shows_the_board()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            MatchSession session = Start(catalog, 1);
            session.Advance();
            MatchView player = session.View("player");
            MatchView publicly = session.View("public");

            Assert.That(player.Hand.Length, Is.GreaterThan(0));
            Assert.That(publicly.Hand.Length, Is.EqualTo(0));
            Assert.That(publicly.HandCount, Is.EqualTo(player.HandCount));
            Assert.That(publicly.Cells[4].Card, Is.Not.Null);
            Assert.That(player.MatchDeck.Length, Is.EqualTo(0));
            Assert.That(session.View("omniscient").MatchDeck.Length, Is.EqualTo(player.MatchDeckCount));
        }

        [Test]
        public void Void_card_stays_in_the_void()
        {
            ContentCatalog catalog = BlankMonster(out string monsterId, out string unitId, out string intentId);
            var position = new MatchPosition
            {
                MonsterId = monsterId,
                Phase = "player-action",
                Round = 1,
                Opportunities = 1,
                PlayerHand = new[] { new PositionCard { CardId = unitId } },
                PlayerVoid = new[] { new PositionCard { CardId = intentId } }
            };
            MatchSession session = MatchSession.FromPosition(catalog, position);
            AdvanceResult pending = session.Advance();

            Assert.That(session.View("omniscient").PlayerVoid.Length, Is.EqualTo(1));

            session.SubmitAndAdvance("end-turn");

            Assert.That(session.View("omniscient").PlayerVoid[0].CardId, Is.EqualTo(intentId));
            Assert.That(pending.Pending!.Actor, Is.EqualTo("player"));
        }

        [Test]
        public void Same_seed_playout_hash_is_stable()
        {
            // Seed 7 on the blank catalog: monster wins by full board in round 6.
            const string expected = "edad264c50a4f94f6d3050dbc70ac0d81dfb167999b4a6e3bf8d3f9549fd9fcc";
            ContentCatalog catalog = RepoCatalog.LoadBlank();

            Assert.That(MatchProtocol.PlayoutHash(catalog, 7), Is.EqualTo(expected));
            Assert.That(MatchProtocol.PlayoutHash(catalog, 7), Is.EqualTo(expected));
        }

        [Test]
        public void Replay_keeps_opportunities_per_turn()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            var setup = new MatchSetup
            {
                Seed = 9,
                MonsterId = catalog.DefaultMonster!,
                BuildDeck = catalog.DefaultDeck,
                OpportunitiesPerTurn = 2
            };
            MatchSession original = MatchSession.Start(catalog, setup);
            original.Advance();
            MatchSession replayed = MatchSession.PlayReplay(original.ToReplay(), catalog);

            Assert.That(replayed.View("player").RemainingOpportunities, Is.EqualTo(2));
            Assert.That(replayed.EventHash(), Is.EqualTo(original.EventHash()));
        }

        [Test]
        public void Protocol_replays_the_same_recording()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            string recorded = KernelEntry.Invoke(WithBlank("{\"command\":\"record\",\"seed\":7}"));
            using JsonDocument record = JsonDocument.Parse(recorded);
            string replay = record.RootElement.GetProperty("replay").GetString()!;
            string hash = record.RootElement.GetProperty("hash").GetString()!;
            string request = WithBlank(JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["command"] = "replay",
                ["replay"] = replay
            }));
            using JsonDocument replayed = JsonDocument.Parse(KernelEntry.Invoke(request));

            Assert.That(hash, Is.EqualTo(MatchProtocol.PlayoutHash(catalog, 7)));
            Assert.That(replayed.RootElement.GetProperty("hash").GetString(), Is.EqualTo(hash));
            Assert.That(replayed.RootElement.GetProperty("winner").GetString(), Is.Not.EqualTo("unfinished"));
        }

        [Test]
        public void Protocol_answer_uses_the_snapshot()
        {
            using JsonDocument start = JsonDocument.Parse(KernelEntry.Invoke(WithBlank("{\"command\":\"start\",\"seed\":4}")));
            JsonElement pending = start.RootElement.GetProperty("pending");
            string snapshot = start.RootElement.GetProperty("snapshot").GetString()!;
            string option = pending.GetProperty("options")[0].GetProperty("id").GetString()!;
            Assert.That(pending.GetProperty("actor").GetString(), Is.EqualTo("player"));

            string request = WithBlank(JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["command"] = "answer",
                ["snapshot"] = snapshot,
                ["option"] = option
            }));
            using JsonDocument answered = JsonDocument.Parse(KernelEntry.Invoke(request));
            Assert.That(answered.RootElement.GetProperty("events").GetArrayLength(), Is.GreaterThan(0));

            string viewRequest = WithBlank(JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["command"] = "view",
                ["snapshot"] = snapshot,
                ["audience"] = "public"
            }));
            using JsonDocument view = JsonDocument.Parse(KernelEntry.Invoke(viewRequest));
            Assert.That(view.RootElement.GetProperty("hand").GetArrayLength(), Is.EqualTo(0));
            Assert.That(view.RootElement.GetProperty("handCount").GetInt32(), Is.GreaterThan(0));
        }

        [Test]
        public void Probe_command_still_routes_through_the_entry_point()
        {
            const string request = "{\"seed\":42,\"count\":1}";
            const string expected = "{\"version\":\"0.1.0\",\"values\":[13679457532755275413]}";

            Assert.That(KernelEntry.Invoke(request), Is.EqualTo(expected));
        }

        [Test]
        public void Protocol_rejects_a_request_without_catalog_text()
        {
            var error = Assert.Throws<ContentException>(() => KernelEntry.Invoke("{\"command\":\"playout\",\"seed\":7}"));
            Assert.That(error!.Message, Does.Contain("catalog"));
        }

        private static string WithBlank(string json)
        {
            JsonNode node = JsonNode.Parse(json)!;
            node["catalog"] = RepoCatalog.Read("content/blank/catalog.yaml");
            return node.ToJsonString();
        }

        private static MatchSession Start(ContentCatalog catalog, ulong seed)
        {
            return MatchSession.Start(catalog, Setup(catalog, seed));
        }

        private static MatchSetup Setup(ContentCatalog catalog, ulong seed)
        {
            return new MatchSetup
            {
                Seed = seed,
                MonsterId = catalog.DefaultMonster!,
                BuildDeck = catalog.DefaultDeck
            };
        }

        private static ContentCatalog BlankMonster(out string monsterId, out string unitId, out string intentId)
        {
            unitId = "card.tu01";
            intentId = "card.tu02";
            monsterId = "monster.tu01";
            return new ContentCatalog(
                new[]
                {
                    new CardDefinition(unitId, "单位", false, 2, 0, "", Array.Empty<AbilityDefinition>(), "", ""),
                    new CardDefinition(intentId, "意图", false, 2, 0, "", Array.Empty<AbilityDefinition>(), "", "")
                },
                new[]
                {
                    new MonsterDefinition(monsterId, "怪物", Array.Empty<StartingPlacement>(), new[] { intentId }, Array.Empty<string>(), new Personality(), IntentModes.OnTurn, "public")
                },
                Array.Empty<AbilityDefinition>(),
                Array.Empty<StatusDefinition>(),
                Array.Empty<ResourceDefinition>(),
                Array.Empty<KeywordDefinition>(),
                Array.Empty<DeckDefinition>(),
                Array.Empty<BackDefinition>(),
                Array.Empty<string>(),
                monsterId);
        }
    }
}
