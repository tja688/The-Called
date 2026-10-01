using System;
using NUnit.Framework;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class OpeningBackTests
    {
        [Test]
        public void Opening_back_changes_printed_points_and_survives_snapshot_and_replay()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            string[] deck = Deck(catalog, "deck.science");
            var backs = new string[deck.Length];
            int target = -1;
            for (int i = 0; i < deck.Length; i++)
            {
                backs[i] = "";
                if (target < 0 && !catalog.RequireCard(deck[i]).IsSpell)
                {
                    target = i;
                    backs[i] = "back.002";
                }
            }

            Assert.That(target, Is.GreaterThanOrEqualTo(0));
            Assert.That(DeckRules.Validate(catalog, deck, backs), Is.Empty);
            string cardId = deck[target];
            int printed = catalog.RequireCard(cardId).Points;

            MatchSession session = MatchSession.Start(catalog, new MatchSetup
            {
                Seed = 7,
                MonsterId = "monster.001",
                BuildDeck = deck,
                BuildBacks = backs
            });
            session.Advance();

            Assert.That(HighestBase(session, cardId), Is.EqualTo(printed + 1));
            Assert.That(HasBack(session, "back.002"), Is.True);

            string snapshot = session.ToSnapshot();
            Assert.That(snapshot, Does.Contain("buildBacks"));
            MatchSession restored = MatchSession.FromSnapshot(snapshot, catalog);
            Assert.That(restored.ToSnapshot(), Is.EqualTo(snapshot));
            Assert.That(HighestBase(restored, cardId), Is.EqualTo(printed + 1));

            string replay = session.ToReplay();
            MatchSession replayed = MatchSession.PlayReplay(replay, catalog);
            Assert.That(replayed.EventHash(), Is.EqualTo(session.EventHash()));
            Assert.That(HighestBase(replayed, cardId), Is.EqualTo(printed + 1));

            string stripped = Strip(snapshot);
            MatchSession forgotten = MatchSession.FromSnapshot(stripped, catalog);
            Assert.That(forgotten.ToSnapshot(), Is.EqualTo(stripped));
            Assert.That(HasBack(forgotten, "back.002"), Is.True);

            MatchSession blankReplay = MatchSession.PlayReplay(Strip(replay), catalog);
            Assert.That(HasBack(blankReplay, "back.002"), Is.False);
            Assert.That(HighestBase(blankReplay, cardId), Is.EqualTo(printed));
        }

        [Test]
        public void Missing_backs_stay_blank_and_a_short_list_is_refused()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            string[] deck = Deck(catalog, "deck.science");
            MatchSession plain = MatchSession.Start(catalog, new MatchSetup
            {
                Seed = 3,
                MonsterId = "monster.001",
                BuildDeck = deck
            });
            plain.Advance();
            Assert.That(HasBack(plain, "back.002"), Is.False);

            var error = Assert.Throws<ArgumentException>(() => MatchSession.Start(catalog, new MatchSetup
            {
                Seed = 3,
                MonsterId = "monster.001",
                BuildDeck = deck,
                BuildBacks = new[] { "back.002" }
            }));
            Assert.That(error!.Message, Does.Contain("卡背"));

            string[] crowded = new string[deck.Length];
            for (int i = 0; i < crowded.Length; i++)
            {
                crowded[i] = "back.008";
            }

            Assert.That(string.Join("\n", DeckRules.Validate(catalog, deck, crowded)), Does.Contain("back.008"));
        }

        private static string[] Deck(ContentCatalog catalog, string id)
        {
            for (int i = 0; i < catalog.Decks.Length; i++)
            {
                if (catalog.Decks[i].Id == id)
                {
                    return catalog.Decks[i].Cards;
                }
            }

            throw new InvalidOperationException("没有牌组 " + id);
        }

        private static int HighestBase(MatchSession session, string cardId)
        {
            MatchView view = session.View("omniscient");
            int highest = -1;
            for (int i = 0; i < view.Cards.Length; i++)
            {
                if (view.Cards[i].CardId == cardId && view.Cards[i].BasePoints > highest)
                {
                    highest = view.Cards[i].BasePoints;
                }
            }

            return highest;
        }

        private static bool HasBack(MatchSession session, string backId)
        {
            MatchView view = session.View("omniscient");
            for (int i = 0; i < view.Cards.Length; i++)
            {
                if (view.Cards[i].CardBackId == backId)
                {
                    return true;
                }
            }

            return false;
        }

        private static string Strip(string json)
        {
            const string key = "\"buildBacks\":";
            int at = json.IndexOf(key, StringComparison.Ordinal);
            if (at < 0)
            {
                throw new InvalidOperationException("记录里没有卡背。");
            }

            int start = at > 0 && json[at - 1] == ',' ? at - 1 : at;
            int bracket = json.IndexOf('[', at);
            int end = json.IndexOf(']', bracket);
            if (bracket < 0 || end < 0)
            {
                throw new InvalidOperationException("卡背数组不完整。");
            }

            return json.Substring(0, start) + json.Substring(end + 1);
        }
    }
}
