using System;

namespace Pcd.Kernel
{
    public static class MatchProtocol
    {
        public static string PlayoutHash(ContentCatalog catalog, ulong seed)
        {
            return PlayCatalog(catalog, seed, 400).Hash;
        }

        public static string Invoke(string requestJson)
        {
            if (requestJson == null)
            {
                throw new ArgumentNullException(nameof(requestJson));
            }

            JsonValue root = JsonReader.Parse(requestJson);
            string command = root.Require("command").String();
            switch (command)
            {
                case "playout":
                    return Playout(root);
                case "start":
                    return Start(root);
                case "answer":
                    return Answer(root);
                case "view":
                    return View(root);
                case "record":
                    return Record(root);
                case "replay":
                    return Replay(root);
                default:
                    throw new ArgumentException("未知命令：" + command);
            }
        }

        private static string Playout(JsonValue root)
        {
            ulong seed = root.Require("seed").ULong();
            int max = ReadMax(root, 400);
            PlayoutResult result = PlayRequested(root, seed, max);
            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("version");
            writer.Value(KernelVersion.Text);
            writer.Name("protocol");
            writer.Value(RuleProtocol.Version);
            writer.Name("hash");
            writer.Value(result.Hash);
            writer.Name("winner");
            writer.Value(result.Winner);
            writer.Name("reason");
            writer.Value(result.Reason);
            writer.Name("rounds");
            writer.Value(result.Rounds);
            writer.Name("events");
            if (result.Session == null)
            {
                throw new InvalidOperationException("对局没有会话。");
            }

            writer.Value(result.Session.Events.Count);
            writer.Name("decisions");
            writer.Value(result.Decisions);
            writer.EndObject();
            return writer.ToString();
        }

        private static string Start(JsonValue root)
        {
            ContentCatalog catalog = CatalogOf(root);
            JsonValue? deck = root.Find("buildDeck");
            JsonValue? backs = root.Find("buildBacks");
            var setup = new MatchSetup
            {
                Seed = ReadULong(root, "seed", 1),
                MonsterId = ReadString(root, "monster") ?? catalog.DefaultMonster ?? "",
                BuildDeck = deck == null || deck.IsNull ? catalog.DefaultDeck : ReadIds(deck, "构建牌组"),
                BuildBacks = backs == null || backs.IsNull ? null : ReadIds(backs, "卡背"),
                OpportunitiesPerTurn = ReadInt(root, "opportunities", 1)
            };
            MatchSession session = MatchSession.Start(catalog, setup);
            return WriteAdvance(catalog, session, session.Advance());
        }

        private static string Answer(JsonValue root)
        {
            ContentCatalog catalog = CatalogOf(root);
            MatchSession session = MatchSession.FromSnapshot(root.Require("snapshot").String(), catalog);
            return WriteAdvance(catalog, session, session.SubmitAndAdvance(root.Require("option").String()));
        }

        private static string View(JsonValue root)
        {
            ContentCatalog catalog = CatalogOf(root);
            MatchSession session = MatchSession.FromSnapshot(root.Require("snapshot").String(), catalog);
            string audience = ReadString(root, "audience") ?? "public";
            var writer = new JsonWriter();
            WriteView(writer, session.View(audience));
            return writer.ToString();
        }

        private static string Record(JsonValue root)
        {
            PlayoutResult result = PlayRequested(root, root.Require("seed").ULong(), ReadMax(root, 400));
            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("protocol");
            writer.Value(RuleProtocol.Version);
            writer.Name("hash");
            writer.Value(result.Hash);
            writer.Name("replay");
            writer.Value(result.ReplayJson);
            writer.EndObject();
            return writer.ToString();
        }

        private static string Replay(JsonValue root)
        {
            ContentCatalog catalog = CatalogOf(root);
            MatchSession session = MatchSession.PlayReplay(root.Require("replay").String(), catalog);
            MatchView view = session.View("omniscient");
            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("protocol");
            writer.Value(RuleProtocol.Version);
            writer.Name("hash");
            writer.Value(session.EventHash());
            writer.Name("winner");
            writer.Value(view.Winner);
            writer.Name("reason");
            writer.Value(view.EndReason);
            writer.Name("rounds");
            writer.Value(view.Round);
            writer.Name("events");
            writer.Value(session.Events.Count);
            writer.EndObject();
            return writer.ToString();
        }

        private static string WriteAdvance(ContentCatalog catalog, MatchSession session, AdvanceResult result)
        {
            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("protocol");
            writer.Value(RuleProtocol.Version);
            writer.Name("kernel");
            writer.Value(KernelVersion.Text);
            writer.Name("content");
            writer.Value(catalog.Hash);
            writer.Name("events");
            EventCodec.WriteArray(writer, result.Events);
            writer.Name("pending");
            if (result.Pending == null)
            {
                writer.Null();
            }
            else
            {
                WriteDecision(writer, result.Pending);
            }

            writer.Name("result");
            if (result.Result == null)
            {
                writer.Null();
            }
            else
            {
                WriteResult(writer, result.Result);
            }

            writer.Name("snapshot");
            writer.Value(session.ToSnapshot());
            writer.EndObject();
            return writer.ToString();
        }

        private static void WriteDecision(JsonWriter writer, Decision decision)
        {
            writer.BeginObject();
            writer.Name("id");
            writer.Value(decision.Id);
            writer.Name("actor");
            writer.Value(decision.Actor);
            writer.Name("type");
            writer.Value(decision.Type);
            writer.Name("ability");
            writer.Value(decision.Ability);
            writer.Name("options");
            writer.BeginArray();
            for (int i = 0; i < decision.Options.Length; i++)
            {
                Option option = decision.Options[i];
                writer.BeginObject();
                writer.Name("id");
                writer.Value(option.Id);
                writer.Name("kind");
                writer.Value(option.Kind);
                writer.Name("instance");
                writer.Value(option.Instance);
                writer.Name("cell");
                writer.Value(option.Cell);
                writer.Name("card");
                writer.Value(option.CardId);
                writer.EndObject();
            }

            writer.EndArray();
            writer.EndObject();
        }

        private static void WriteResult(JsonWriter writer, MatchResult result)
        {
            writer.BeginObject();
            writer.Name("winner");
            writer.Value(result.Winner);
            writer.Name("reason");
            writer.Value(result.Reason);
            writer.Name("rounds");
            writer.Value(result.Rounds);
            writer.Name("playerPoints");
            writer.Value(result.PlayerPoints);
            writer.Name("monsterPoints");
            writer.Value(result.MonsterPoints);
            writer.Name("playerOccupancy");
            writer.Value(result.PlayerOccupancy);
            writer.Name("monsterOccupancy");
            writer.Value(result.MonsterOccupancy);
            writer.EndObject();
        }

        private static void WriteView(JsonWriter writer, MatchView view)
        {
            writer.BeginObject();
            writer.Name("audience");
            writer.Value(view.Audience);
            writer.Name("phase");
            writer.Value(view.Phase);
            writer.Name("round");
            writer.Value(view.Round);
            writer.Name("remainingOpportunities");
            writer.Value(view.RemainingOpportunities);
            writer.Name("revealedIntent");
            writer.Value(view.RevealedIntent);
            writer.Name("intentIndex");
            writer.Value(view.IntentIndex);
            writer.Name("intentMode");
            writer.Value(view.IntentMode);
            writer.Name("committedCell");
            writer.Value(view.CommittedCell);
            writer.Name("committedTarget");
            writer.Value(view.CommittedTarget);
            writer.Name("intents");
            writer.BeginArray();
            for (int i = 0; i < view.Intents.Length; i++)
            {
                writer.Value(view.Intents[i]);
            }

            writer.EndArray();
            writer.Name("unseen");
            writer.BeginArray();
            for (int i = 0; i < view.Unseen.Length; i++)
            {
                writer.Value(view.Unseen[i]);
            }

            writer.EndArray();
            writer.Name("playerPoints");
            writer.Value(view.PlayerPoints);
            writer.Name("monsterPoints");
            writer.Value(view.MonsterPoints);
            writer.Name("playerOccupancy");
            writer.Value(view.PlayerOccupancy);
            writer.Name("monsterOccupancy");
            writer.Value(view.MonsterOccupancy);
            writer.Name("handCount");
            writer.Value(view.HandCount);
            writer.Name("matchDeckCount");
            writer.Value(view.MatchDeckCount);
            writer.Name("playerDiscardCount");
            writer.Value(view.PlayerDiscardCount);
            writer.Name("monsterDiscardCount");
            writer.Value(view.MonsterDiscardCount);
            writer.Name("winner");
            writer.Value(view.Winner);
            writer.Name("reason");
            writer.Value(view.EndReason);
            writer.Name("cells");
            writer.BeginArray();
            for (int i = 0; i < view.Cells.Length; i++)
            {
                ViewCell cell = view.Cells[i];
                writer.BeginObject();
                writer.Name("cell");
                writer.Value(cell.Cell);
                writer.Name("polluted");
                writer.Value(cell.Polluted);
                writer.Name("card");
                if (cell.Card == null)
                {
                    writer.Null();
                }
                else
                {
                    WriteViewCard(writer, cell.Card);
                }

                writer.EndObject();
            }

            writer.EndArray();
            WriteViewCards(writer, "hand", view.Hand);
            WriteViewCards(writer, "matchDeck", view.MatchDeck);
            WriteViewCards(writer, "playerDiscard", view.PlayerDiscard);
            WriteViewCards(writer, "monsterDiscard", view.MonsterDiscard);
            WriteViewCards(writer, "playerVoid", view.PlayerVoid);
            WriteViewCards(writer, "monsterVoid", view.MonsterVoid);
            writer.EndObject();
        }

        private static void WriteViewCards(JsonWriter writer, string name, ViewCard[] cards)
        {
            writer.Name(name);
            writer.BeginArray();
            for (int i = 0; i < cards.Length; i++)
            {
                WriteViewCard(writer, cards[i]);
            }

            writer.EndArray();
        }

        private static void WriteViewCard(JsonWriter writer, ViewCard card)
        {
            writer.BeginObject();
            writer.Name("instance");
            writer.Value(card.Instance);
            writer.Name("card");
            writer.Value(card.CardId);
            writer.Name("owner");
            writer.Value(card.Owner);
            writer.Name("zone");
            writer.Value(card.Zone);
            writer.Name("cell");
            writer.Value(card.Cell);
            writer.Name("basePoints");
            writer.Value(card.BasePoints);
            writer.Name("currentPoints");
            writer.Value(card.CurrentPoints);
            writer.Name("back");
            writer.Value(card.CardBackId);
            writer.Name("spell");
            writer.Value(card.IsSpell);
            writer.EndObject();
        }

        private static PlayoutResult PlayRequested(JsonValue root, ulong seed, int maxDecisions)
        {
            return PlayCatalog(CatalogOf(root), seed, maxDecisions);
        }

        private static ContentCatalog CatalogOf(JsonValue root)
        {
            JsonValue? catalog = root.Find("catalog");
            if (catalog == null || catalog.IsNull)
            {
                throw new ContentException("请求缺少 catalog 文本。宿主读入内容目录后传入，内核不读取文件，也不携带嵌入资源。");
            }

            return ContentCatalog.Parse(catalog.String());
        }

        private static PlayoutResult PlayCatalog(ContentCatalog catalog, ulong seed, int maxDecisions)
        {
            if (catalog.DefaultMonster == null)
            {
                throw new InvalidOperationException("内容没有默认怪物。");
            }

            var setup = new MatchSetup
            {
                Seed = seed,
                MonsterId = catalog.DefaultMonster,
                BuildDeck = catalog.DefaultDeck,
                OpportunitiesPerTurn = 1
            };
            return RandomPlayout.Play(catalog, setup, maxDecisions, null);
        }

        private static int ReadMax(JsonValue root, int fallback)
        {
            return ReadInt(root, "max", fallback);
        }

        private static int ReadInt(JsonValue root, string name, int fallback)
        {
            JsonValue? node = root.Find(name);
            if (node == null || node.IsNull)
            {
                return fallback;
            }

            return node.Int();
        }

        private static ulong ReadULong(JsonValue root, string name, ulong fallback)
        {
            JsonValue? node = root.Find(name);
            if (node == null || node.IsNull)
            {
                return fallback;
            }

            return node.ULong();
        }

        private static string? ReadString(JsonValue root, string name)
        {
            JsonValue? node = root.Find(name);
            if (node == null || node.IsNull)
            {
                return null;
            }

            return node.String();
        }

        private static string[] ReadIds(JsonValue node, string label)
        {
            if (!node.IsArray || node.Array == null)
            {
                throw new FormatException(label + "必须是数组。");
            }

            var ids = new string[node.Array.Count];
            for (int i = 0; i < node.Array.Count; i++)
            {
                ids[i] = node.Array[i].String();
            }

            return ids;
        }
    }
}
