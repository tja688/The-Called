using System;
using System.Collections.Generic;

namespace Pcd.Kernel
{
    internal static class SnapshotCodec
    {
        public static string Write(MatchState state, string contentHash)
        {
            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("snapshot");
            writer.Value(RuleProtocol.SnapshotVersion);
            writer.Name("protocol");
            writer.Value(RuleProtocol.Version);
            writer.Name("kernel");
            writer.Value(KernelVersion.Text);
            writer.Name("content");
            writer.Value(contentHash);
            writer.Name("rng");
            writer.Value(state.RngState);
            writer.Name("phase");
            writer.Value(Names.PhaseName(state.Phase));
            writer.Name("waiting");
            writer.Value(state.Waiting);
            writer.Name("round");
            writer.Value(state.Round);
            writer.Name("intentCursor");
            writer.Value(state.IntentCursor);
            writer.Name("revealedIntent");
            writer.Value(state.RevealedIntent);
            writer.Name("intentMode");
            writer.Value(state.IntentMode);
            writer.Name("committedCell");
            writer.Value(state.CommittedCell);
            writer.Name("committedTarget");
            writer.Value(state.CommittedTarget);
            writer.Name("nextInstance");
            writer.Value(state.NextInstanceId);
            writer.Name("nextEvent");
            writer.Value(state.NextEventSeq);
            writer.Name("nextDecision");
            writer.Value(state.NextDecisionId);
            writer.Name("decisionId");
            writer.Value(state.PendingDecisionId);
            writer.Name("resolving");
            writer.Value(state.Resolving);
            writer.Name("resolutionCursor");
            writer.Value(state.ResolutionCursor);
            writer.Name("resolutionKind");
            writer.Value(state.ResolutionKind);
            writer.Name("resolutionOption");
            writer.Value(state.ResolutionOption);
            writer.Name("causeDecision");
            writer.Value(state.CauseDecision);
            writer.Name("opportunitiesPerTurn");
            writer.Value(state.OpportunitiesPerTurn);
            writer.Name("remainingOpportunities");
            writer.Value(state.RemainingOpportunities);
            writer.Name("winner");
            writer.Value(state.Winner);
            writer.Name("reason");
            writer.Value(state.EndReason);
            writer.Name("monster");
            writer.Value(state.MonsterId);
            writer.Name("intents");
            WriteStrings(writer, state.Intents);
            writer.Name("polluted");
            writer.BeginArray();
            for (int i = 0; i < 9; i++)
            {
                writer.Value(state.Polluted[i]);
            }

            writer.EndArray();
            writer.Name("board");
            writer.BeginArray();
            for (int i = 0; i < 9; i++)
            {
                if (state.Board[i] == null)
                {
                    writer.Null();
                }
                else
                {
                    WriteCard(writer, state.Board[i]!);
                }
            }

            writer.EndArray();
            writer.Name("sides");
            writer.BeginObject();
            writer.Name("player");
            WriteSide(writer, state.Player);
            writer.Name("monster");
            WriteSide(writer, state.Monster);
            writer.EndObject();
            writer.Name("events");
            EventCodec.WriteArray(writer, state.Events);
            writer.Name("answers");
            WriteStrings(writer, state.Answers);
            writer.Name("injections");
            writer.BeginArray();
            for (int i = 0; i < state.Injections.Count; i++)
            {
                writer.BeginObject();
                writer.Name("host");
                writer.Value(state.Injections[i].Host);
                writer.Name("ability");
                writer.Value(state.Injections[i].AbilityId);
                writer.EndObject();
            }

            writer.EndArray();
            writer.Name("setup");
            if (!state.HasSetup)
            {
                writer.Null();
            }
            else
            {
                writer.BeginObject();
                writer.Name("seed");
                writer.Value(state.SetupSeed);
                writer.Name("monster");
                writer.Value(state.SetupMonsterId);
                writer.Name("buildDeck");
                WriteStrings(writer, state.BuildDeck);
                if (state.BuildBacks.Count == state.BuildDeck.Count)
                {
                    writer.Name("buildBacks");
                    WriteStrings(writer, state.BuildBacks);
                }

                writer.EndObject();
            }

            writer.EndObject();
            return writer.ToString();
        }

        public static MatchState Read(string json, ContentCatalog catalog)
        {
            JsonValue root = JsonReader.Parse(json);
            int snapshot = root.Require("snapshot").Int();
            if (snapshot != RuleProtocol.SnapshotVersion)
            {
                throw new InvalidOperationException("快照版本不符：快照是 " + snapshot + "，当前是 " + RuleProtocol.SnapshotVersion + "。未完成的对局作废。");
            }

            int protocol = root.Require("protocol").Int();
            if (protocol != RuleProtocol.Version)
            {
                throw new InvalidOperationException("协议版本不符：快照是 " + protocol + "，当前是 " + RuleProtocol.Version + "。");
            }

            string kernel = root.Require("kernel").String();
            if (kernel != KernelVersion.Text)
            {
                throw new InvalidOperationException("内核版本不符：快照是 " + kernel + "，当前是 " + KernelVersion.Text + "。");
            }

            string content = root.Require("content").String();
            if (content != catalog.Hash)
            {
                throw new InvalidOperationException("内容哈希不符：快照是 " + content + "，当前是 " + catalog.Hash + "。");
            }

            var state = new MatchState
            {
                RngState = root.Require("rng").ULong(),
                Phase = Names.ParsePhase(root.Require("phase").String()),
                Waiting = root.Require("waiting").Boolean(),
                Round = root.Require("round").Int(),
                IntentCursor = root.Require("intentCursor").Int(),
                RevealedIntent = OptionalString(root, "revealedIntent"),
                IntentMode = IntentModes.Stored(OptionalString(root, "intentMode")),
                CommittedCell = root.Require("committedCell").Int(),
                CommittedTarget = root.Require("committedTarget").Int(),
                NextInstanceId = root.Require("nextInstance").Int(),
                NextEventSeq = root.Require("nextEvent").Int(),
                NextDecisionId = root.Require("nextDecision").Int(),
                PendingDecisionId = root.Require("decisionId").Int(),
                Resolving = root.Require("resolving").Boolean(),
                ResolutionCursor = root.Require("resolutionCursor").Int(),
                ResolutionKind = root.Require("resolutionKind").String(),
                ResolutionOption = root.Require("resolutionOption").String(),
                CauseDecision = root.Require("causeDecision").Int(),
                OpportunitiesPerTurn = root.Require("opportunitiesPerTurn").Int(),
                RemainingOpportunities = root.Require("remainingOpportunities").Int(),
                Winner = OptionalString(root, "winner"),
                EndReason = OptionalString(root, "reason"),
                MonsterId = root.Require("monster").String()
            };
            catalog.RequireMonster(state.MonsterId);
            state.Intents = ReadStrings(root.Require("intents"));
            if (state.Intents.Count < 1 || state.Intents.Count > 4)
            {
                throw new FormatException("意图条数必须是 1 到 4。");
            }

            for (int i = 0; i < state.Intents.Count; i++)
            {
                catalog.RequireCard(state.Intents[i]);
            }

            JsonValue polluted = root.Require("polluted");
            if (!polluted.IsArray || polluted.Array == null || polluted.Array.Count != 9)
            {
                throw new FormatException("污染格必须是 9 格。");
            }

            for (int i = 0; i < 9; i++)
            {
                state.Polluted[i] = polluted.Array[i].Boolean();
            }

            JsonValue board = root.Require("board");
            if (!board.IsArray || board.Array == null || board.Array.Count != 9)
            {
                throw new FormatException("棋盘必须是 9 格。");
            }

            for (int i = 0; i < 9; i++)
            {
                if (board.Array[i].IsNull)
                {
                    continue;
                }

                CardInstance card = ReadCard(board.Array[i], catalog);
                if (card.Zone != Zone.Board || card.Cell != i + 1)
                {
                    throw new FormatException("格 " + (i + 1) + " 上的卡牌位置不对。");
                }

                state.Board[i] = card;
            }

            JsonValue sides = root.Require("sides");
            state.Player = ReadSide(sides.Require("player"), catalog, Side.Player);
            state.Monster = ReadSide(sides.Require("monster"), catalog, Side.Monster);
            state.Events = EventCodec.ReadArray(root.Require("events"));
            if (state.Events.Count == 0)
            {
                if (state.NextEventSeq != 1)
                {
                    throw new FormatException("事件序号接不上。");
                }
            }
            else if (state.Events[state.Events.Count - 1].Seq + 1 != state.NextEventSeq)
            {
                throw new FormatException("事件序号接不上。");
            }

            state.Answers = ReadStrings(root.Require("answers"));
            JsonValue injections = root.Require("injections");
            if (!injections.IsArray || injections.Array == null)
            {
                throw new FormatException("注入能力必须是数组。");
            }

            for (int i = 0; i < injections.Array.Count; i++)
            {
                string abilityId = injections.Array[i].Require("ability").String();
                catalog.RequireAbility(abilityId);
                state.Injections.Add(new AbilityInjection
                {
                    Host = injections.Array[i].Require("host").String(),
                    AbilityId = abilityId
                });
            }
            JsonValue? setup = root.Find("setup");
            if (setup != null && !setup.IsNull)
            {
                state.HasSetup = true;
                state.SetupSeed = setup.Require("seed").ULong();
                state.SetupMonsterId = setup.Require("monster").String();
                state.BuildDeck = ReadStrings(setup.Require("buildDeck"));
                JsonValue? backs = setup.Find("buildBacks");
                if (backs != null && !backs.IsNull)
                {
                    state.BuildBacks = ReadStrings(backs);
                    if (state.BuildBacks.Count != state.BuildDeck.Count)
                    {
                        throw new FormatException("卡背数量必须和卡牌数量一致。");
                    }
                }
            }

            if (state.Waiting && state.NextDecisionId != state.PendingDecisionId + 1)
            {
                throw new FormatException("决策序号接不上。");
            }

            return state;
        }

        private static void WriteSide(JsonWriter writer, SideState side)
        {
            writer.BeginObject();
            writer.Name("matchDeck");
            WriteCards(writer, side.MatchDeck);
            writer.Name("hand");
            WriteCards(writer, side.Hand);
            writer.Name("discard");
            WriteCards(writer, side.Discard);
            writer.Name("void");
            WriteCards(writer, side.Void);
            writer.Name("resources");
            WriteResources(writer, side.Resources);
            writer.EndObject();
        }

        private static SideState ReadSide(JsonValue node, ContentCatalog catalog, Side owner)
        {
            var side = new SideState();
            ReadCards(node.Require("matchDeck"), catalog, owner, Zone.MatchDeck, side.MatchDeck);
            ReadCards(node.Require("hand"), catalog, owner, Zone.Hand, side.Hand);
            ReadCards(node.Require("discard"), catalog, owner, Zone.Discard, side.Discard);
            ReadCards(node.Require("void"), catalog, owner, Zone.Void, side.Void);
            JsonValue resources = node.Require("resources");
            if (!resources.IsArray || resources.Array == null)
            {
                throw new FormatException("资源池必须是数组。");
            }

            for (int i = 0; i < resources.Array.Count; i++)
            {
                JsonValue slot = resources.Array[i];
                side.Resources.Add(new ResourceSlot
                {
                    Id = slot.Require("id").String(),
                    Amount = slot.Require("amount").Int()
                });
            }

            return side;
        }

        private static void WriteCards(JsonWriter writer, List<CardInstance> cards)
        {
            writer.BeginArray();
            for (int i = 0; i < cards.Count; i++)
            {
                WriteCard(writer, cards[i]);
            }

            writer.EndArray();
        }

        private static void ReadCards(JsonValue node, ContentCatalog catalog, Side owner, Zone zone, List<CardInstance> target)
        {
            if (!node.IsArray || node.Array == null)
            {
                throw new FormatException("卡牌列表必须是数组。");
            }

            for (int i = 0; i < node.Array.Count; i++)
            {
                CardInstance card = ReadCard(node.Array[i], catalog);
                if (card.Owner != owner || card.Zone != zone)
                {
                    throw new FormatException("卡牌不在它声明的区域里。");
                }

                target.Add(card);
            }
        }

        private static void WriteCard(JsonWriter writer, CardInstance card)
        {
            writer.BeginObject();
            writer.Name("instance");
            writer.Value(card.InstanceId);
            writer.Name("card");
            writer.Value(card.CardId);
            writer.Name("owner");
            writer.Value(Names.SideName(card.Owner));
            writer.Name("zone");
            writer.Value(Names.ZoneName(card.Zone));
            writer.Name("cell");
            if (card.Cell == 0)
            {
                writer.Null();
            }
            else
            {
                writer.Value(card.Cell);
            }

            writer.Name("spell");
            writer.Value(card.IsSpell);
            writer.Name("base");
            writer.Value(card.BasePoints);
            writer.Name("back");
            writer.Value(card.CardBackId);
            writer.Name("timer");
            writer.Value(card.Timer);
            writer.Name("timerMax");
            writer.Value(card.TimerMax);
            writer.Name("continuous");
            writer.Value(card.Continuous);
            writer.Name("suppressed");
            writer.Value(card.Suppressed);
            writer.Name("link");
            writer.Value(card.Link);
            writer.Name("activated");
            writer.Value(card.Activated);
            writer.Name("modifiers");
            writer.BeginArray();
            for (int i = 0; i < card.Modifiers.Count; i++)
            {
                writer.BeginObject();
                writer.Name("source");
                writer.Value(card.Modifiers[i].Source);
                writer.Name("amount");
                writer.Value(card.Modifiers[i].Amount);
                writer.EndObject();
            }

            writer.EndArray();
            writer.Name("statuses");
            writer.BeginArray();
            for (int i = 0; i < card.Statuses.Count; i++)
            {
                writer.BeginObject();
                writer.Name("id");
                writer.Value(card.Statuses[i].Id);
                writer.Name("applier");
                writer.Value(Names.SideName(card.Statuses[i].Applier));
                writer.Name("round");
                writer.Value(card.Statuses[i].AppliedRound);
                writer.EndObject();
            }

            writer.EndArray();
            writer.Name("granted");
            writer.BeginArray();
            for (int i = 0; i < card.Granted.Count; i++)
            {
                writer.BeginObject();
                writer.Name("ability");
                writer.Value(card.Granted[i].AbilityId);
                writer.Name("timer");
                writer.Value(card.Granted[i].Timer);
                writer.Name("timerMax");
                writer.Value(card.Granted[i].TimerMax);
                writer.Name("spent");
                writer.Value(card.Granted[i].Spent);
                writer.EndObject();
            }

            writer.EndArray();
            writer.EndObject();
        }

        private static CardInstance ReadCard(JsonValue node, ContentCatalog catalog)
        {
            string cardId = node.Require("card").String();
            catalog.RequireCard(cardId);
            var card = new CardInstance
            {
                InstanceId = node.Require("instance").Int(),
                CardId = cardId,
                Owner = Names.ParseSide(node.Require("owner").String()),
                Zone = Names.ParseZone(node.Require("zone").String()),
                IsSpell = node.Require("spell").Boolean(),
                BasePoints = node.Require("base").Int(),
                CardBackId = OptionalString(node, "back"),
                Timer = node.Require("timer").Int(),
                TimerMax = node.Require("timerMax").Int(),
                Continuous = node.Require("continuous").Int(),
                Suppressed = node.Require("suppressed").Boolean(),
                Link = node.Require("link").Int(),
                Activated = node.Require("activated").Boolean()
            };
            JsonValue? cell = node.Find("cell");
            card.Cell = cell == null || cell.IsNull ? 0 : cell.Int();
            JsonValue modifiers = node.Require("modifiers");
            if (!modifiers.IsArray || modifiers.Array == null)
            {
                throw new FormatException("点数增减必须是数组。");
            }

            for (int i = 0; i < modifiers.Array.Count; i++)
            {
                card.Modifiers.Add(new PointModifier
                {
                    Source = modifiers.Array[i].Require("source").String(),
                    Amount = modifiers.Array[i].Require("amount").Int()
                });
            }

            JsonValue statuses = node.Require("statuses");
            if (!statuses.IsArray || statuses.Array == null)
            {
                throw new FormatException("状态必须是数组。");
            }

            for (int i = 0; i < statuses.Array.Count; i++)
            {
                card.Statuses.Add(new StatusMark
                {
                    Id = statuses.Array[i].Require("id").String(),
                    Applier = Names.ParseSide(statuses.Array[i].Require("applier").String()),
                    AppliedRound = statuses.Array[i].Require("round").Int()
                });
            }

            JsonValue granted = node.Require("granted");
            if (!granted.IsArray || granted.Array == null)
            {
                throw new FormatException("授予的能力必须是数组。");
            }

            for (int i = 0; i < granted.Array.Count; i++)
            {
                string abilityId = granted.Array[i].Require("ability").String();
                catalog.RequireAbility(abilityId);
                card.Granted.Add(new GrantedAbility
                {
                    AbilityId = abilityId,
                    Timer = granted.Array[i].Require("timer").Int(),
                    TimerMax = granted.Array[i].Require("timerMax").Int(),
                    Spent = granted.Array[i].Require("spent").Boolean()
                });
            }

            return card;
        }

        private static void WriteResources(JsonWriter writer, List<ResourceSlot> resources)
        {
            var ordered = new List<ResourceSlot>(resources);
            ordered.Sort(CompareResource);
            writer.BeginArray();
            for (int i = 0; i < ordered.Count; i++)
            {
                writer.BeginObject();
                writer.Name("id");
                writer.Value(ordered[i].Id);
                writer.Name("amount");
                writer.Value(ordered[i].Amount);
                writer.EndObject();
            }

            writer.EndArray();
        }

        private static int CompareResource(ResourceSlot left, ResourceSlot right)
        {
            return string.CompareOrdinal(left.Id, right.Id);
        }

        private static void WriteStrings(JsonWriter writer, List<string> values)
        {
            writer.BeginArray();
            for (int i = 0; i < values.Count; i++)
            {
                writer.Value(values[i]);
            }

            writer.EndArray();
        }

        private static List<string> ReadStrings(JsonValue node)
        {
            if (!node.IsArray || node.Array == null)
            {
                throw new FormatException("需要字符串数组。");
            }

            var values = new List<string>(node.Array.Count);
            for (int i = 0; i < node.Array.Count; i++)
            {
                values.Add(node.Array[i].String());
            }

            return values;
        }

        private static string? OptionalString(JsonValue node, string name)
        {
            JsonValue? child = node.Find(name);
            if (child == null || child.IsNull)
            {
                return null;
            }

            return child.String();
        }
    }
}
