using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Pcd.Kernel
{
    public sealed class MatchupReport
    {
        public string DeckId { get; set; } = "";
        public string DeckName { get; set; } = "";
        public string MonsterId { get; set; } = "";
        public string MonsterName { get; set; } = "";
        public int Games { get; set; }
        public int PlayerWins { get; set; }
        public int MonsterWins { get; set; }
        public int Draws { get; set; }
        public int Unfinished { get; set; }
        public int FinishedRounds { get; set; }
        public int EffectiveTriggers { get; set; }
        public int CoreHits { get; set; }
        public int CoreSlots { get; set; }
        public int SnatchSettlements { get; set; }

        public int Finished
        {
            get { return PlayerWins + MonsterWins + Draws; }
        }
    }

    public static class MatchMetrics
    {
        public static int CountEffective(IReadOnlyList<GameEvent> events)
        {
            int count = 0;
            for (int i = 0; i < events.Count; i++)
            {
                GameEvent evt = events[i];
                if (evt.Type == "status-changed" || evt.Type == "resource-changed")
                {
                    count++;
                    continue;
                }

                if (evt.Type == EventTypes.PointsChanged && evt.Source != "cover" && evt.Source != "polluted-cell")
                {
                    count++;
                    continue;
                }

                if (evt.Type == EventTypes.CardEntered && evt.Reason != "play" && evt.Reason != "setup")
                {
                    count++;
                }
            }

            return count;
        }

        public static bool IsSnatch(string reason)
        {
            return reason == "full-board" || reason == "special";
        }

        public static void CoreProgress(string[] deck, IReadOnlyList<GameEvent> events, out int hits, out int slots)
        {
            var counts = new Dictionary<string, int>();
            for (int i = 0; i < deck.Length; i++)
            {
                string id = deck[i];
                if (counts.ContainsKey(id))
                {
                    counts[id]++;
                }
                else
                {
                    counts[id] = 1;
                }
            }

            var core = new List<string>();
            foreach (KeyValuePair<string, int> pair in counts)
            {
                if (pair.Value >= 3)
                {
                    core.Add(pair.Key);
                }
            }

            if (core.Count == 0)
            {
                foreach (KeyValuePair<string, int> pair in counts)
                {
                    core.Add(pair.Key);
                }
            }

            core.Sort(StringComparer.Ordinal);
            slots = core.Count;
            hits = 0;
            for (int i = 0; i < core.Count; i++)
            {
                if (WasDrawn(events, core[i]))
                {
                    hits++;
                }
            }
        }

        public static string Ratio(int part, int whole)
        {
            if (whole <= 0)
            {
                return "0.00";
            }

            int hundredths = (part * 100 + whole / 2) / whole;
            return (hundredths / 100).ToString(CultureInfo.InvariantCulture)
                + "."
                + (hundredths % 100).ToString("00", CultureInfo.InvariantCulture);
        }

        public static void Observe(MatchupReport row, string[] deck, PlayoutResult result)
        {
            if (result.Session == null)
            {
                throw new InvalidOperationException("对局没有会话。");
            }

            row.Games++;
            row.EffectiveTriggers += CountEffective(result.Session.Events);
            CoreProgress(deck, result.Session.Events, out int hits, out int slots);
            row.CoreHits += hits;
            row.CoreSlots += slots;
            if (result.Winner == "player")
            {
                row.PlayerWins++;
                row.FinishedRounds += result.Rounds;
            }
            else if (result.Winner == "monster")
            {
                row.MonsterWins++;
                row.FinishedRounds += result.Rounds;
            }
            else if (result.Winner == "draw")
            {
                row.Draws++;
                row.FinishedRounds += result.Rounds;
            }
            else
            {
                row.Unfinished++;
            }

            if (IsSnatch(result.Reason))
            {
                row.SnatchSettlements++;
            }
        }

        public static string Markdown(MatchupReport[] rows)
        {
            var writer = new StringBuilder();
            writer.Append("# 批量模拟\n\n");
            writer.Append("| 牌组 | 怪物 | 对局 | 玩家胜 | 怪物胜 | 平局 | 未结束 | 玩家胜率 | 平均回合 | 有效触发 | 核心上手率 | 抢结算 |\n");
            writer.Append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n");
            var total = new MatchupReport { DeckName = "合计", MonsterName = "全部" };
            for (int i = 0; i < rows.Length; i++)
            {
                AppendRow(writer, rows[i]);
                Fold(total, rows[i]);
            }

            if (rows.Length > 1)
            {
                AppendRow(writer, total);
            }

            writer.Append('\n');
            return writer.ToString();
        }

        public static string Json(MatchupReport[] rows, ulong seed)
        {
            var total = new MatchupReport();
            for (int i = 0; i < rows.Length; i++)
            {
                Fold(total, rows[i]);
            }

            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("games");
            writer.Value(total.Games);
            writer.Name("seed");
            writer.Value(seed);
            writer.Name("playerWins");
            writer.Value(total.PlayerWins);
            writer.Name("monsterWins");
            writer.Value(total.MonsterWins);
            writer.Name("draws");
            writer.Value(total.Draws);
            writer.Name("unfinished");
            writer.Value(total.Unfinished);
            writer.Name("finished");
            writer.Value(total.Finished);
            writer.Name("totalRounds");
            writer.Value(total.FinishedRounds);
            writer.Name("winRate");
            writer.Value(Ratio(total.PlayerWins, total.Finished));
            writer.Name("averageRounds");
            writer.Value(Ratio(total.FinishedRounds, total.Finished));
            writer.Name("effectiveTriggers");
            writer.Value(Ratio(total.EffectiveTriggers, total.Games));
            writer.Name("coreDrawRate");
            writer.Value(Ratio(total.CoreHits, total.CoreSlots));
            writer.Name("snatchSettlements");
            writer.Value(total.SnatchSettlements);
            writer.Name("matchups");
            writer.BeginArray();
            for (int i = 0; i < rows.Length; i++)
            {
                WriteRow(writer, rows[i]);
            }

            writer.EndArray();
            writer.EndObject();
            return writer.ToString();
        }

        private static void AppendRow(StringBuilder writer, MatchupReport row)
        {
            writer.Append("| ");
            writer.Append(row.DeckName);
            writer.Append(" | ");
            writer.Append(row.MonsterName);
            writer.Append(" | ");
            writer.Append(row.Games.ToString(CultureInfo.InvariantCulture));
            writer.Append(" | ");
            writer.Append(row.PlayerWins.ToString(CultureInfo.InvariantCulture));
            writer.Append(" | ");
            writer.Append(row.MonsterWins.ToString(CultureInfo.InvariantCulture));
            writer.Append(" | ");
            writer.Append(row.Draws.ToString(CultureInfo.InvariantCulture));
            writer.Append(" | ");
            writer.Append(row.Unfinished.ToString(CultureInfo.InvariantCulture));
            writer.Append(" | ");
            writer.Append(Ratio(row.PlayerWins, row.Finished));
            writer.Append(" | ");
            writer.Append(Ratio(row.FinishedRounds, row.Finished));
            writer.Append(" | ");
            writer.Append(Ratio(row.EffectiveTriggers, row.Games));
            writer.Append(" | ");
            writer.Append(Ratio(row.CoreHits, row.CoreSlots));
            writer.Append(" | ");
            writer.Append(row.SnatchSettlements.ToString(CultureInfo.InvariantCulture));
            writer.Append(" |\n");
        }

        private static void WriteRow(JsonWriter writer, MatchupReport row)
        {
            writer.BeginObject();
            writer.Name("deck");
            writer.Value(row.DeckId);
            writer.Name("deckName");
            writer.Value(row.DeckName);
            writer.Name("monster");
            writer.Value(row.MonsterId);
            writer.Name("monsterName");
            writer.Value(row.MonsterName);
            writer.Name("games");
            writer.Value(row.Games);
            writer.Name("playerWins");
            writer.Value(row.PlayerWins);
            writer.Name("winRate");
            writer.Value(Ratio(row.PlayerWins, row.Finished));
            writer.Name("averageRounds");
            writer.Value(Ratio(row.FinishedRounds, row.Finished));
            writer.Name("effectiveTriggers");
            writer.Value(Ratio(row.EffectiveTriggers, row.Games));
            writer.Name("coreDrawRate");
            writer.Value(Ratio(row.CoreHits, row.CoreSlots));
            writer.Name("snatchSettlements");
            writer.Value(row.SnatchSettlements);
            writer.EndObject();
        }

        private static void Fold(MatchupReport total, MatchupReport row)
        {
            total.Games += row.Games;
            total.PlayerWins += row.PlayerWins;
            total.MonsterWins += row.MonsterWins;
            total.Draws += row.Draws;
            total.Unfinished += row.Unfinished;
            total.FinishedRounds += row.FinishedRounds;
            total.EffectiveTriggers += row.EffectiveTriggers;
            total.CoreHits += row.CoreHits;
            total.CoreSlots += row.CoreSlots;
            total.SnatchSettlements += row.SnatchSettlements;
        }

        private static bool WasDrawn(IReadOnlyList<GameEvent> events, string cardId)
        {
            for (int i = 0; i < events.Count; i++)
            {
                if (events[i].Type == EventTypes.CardDrawn && events[i].Card == cardId)
                {
                    return true;
                }
            }

            return false;
        }
    }
}
