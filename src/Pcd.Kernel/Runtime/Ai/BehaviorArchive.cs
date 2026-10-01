using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace Pcd.Kernel
{
    public static class BehaviorArchive
    {
        public static string Record(ContentCatalog catalog, string directory, ulong seed, int maxDecisions)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            if (string.IsNullOrEmpty(directory))
            {
                throw new ArgumentException("需要目录。");
            }

            Directory.CreateDirectory(directory);
            List<ArchiveEntry> entries = Plan(catalog, seed);
            for (int i = 0; i < entries.Count; i++)
            {
                ArchiveEntry entry = entries[i];
                PlayoutResult result = AiPlayout.Play(catalog, Setup(entry), maxDecisions, null);
                entry.Winner = result.Winner;
                entry.Reason = result.Reason;
                entry.Rounds = result.Rounds;
                File.WriteAllText(Path.Combine(directory, entry.File), result.ReplayJson);
            }

            File.WriteAllText(Path.Combine(directory, "manifest.json"), WriteManifest(catalog, seed, maxDecisions, entries));
            return Summarize("录制", entries, 0);
        }

        public static string Diff(ContentCatalog catalog, string directory)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            string manifestPath = Path.Combine(directory, "manifest.json");
            if (!File.Exists(manifestPath))
            {
                throw new InvalidOperationException("目录里没有行为录像清单。");
            }

            JsonValue manifest = JsonReader.Parse(File.ReadAllText(manifestPath));
            int max = manifest.Require("max").Int();
            ulong seed = manifest.Require("seed").ULong();
            JsonValue listed = manifest.Require("entries");
            if (!listed.IsArray || listed.Array == null)
            {
                throw new FormatException("行为录像清单缺少条目。");
            }

            var writer = new StringBuilder();
            writer.Append("# 行为变化\n\n");
            writer.Append("这条报告只比较已经录下的对局，不进入提交检查。\n\n");
            int changed = 0;
            for (int i = 0; i < listed.Array.Count; i++)
            {
                JsonValue entry = listed.Array[i];
                string deckId = entry.Require("deck").String();
                string monsterId = entry.Require("monster").String();
                string file = entry.Require("file").String();
                string oldWinner = entry.Require("winner").String();
                string oldReason = entry.Require("reason").String();
                string[] oldDecisions = ReadDecisions(File.ReadAllText(Path.Combine(directory, file)));
                var setup = new MatchSetup
                {
                    Seed = seed,
                    MonsterId = monsterId,
                    BuildDeck = DeckOf(catalog, deckId),
                    OpportunitiesPerTurn = 1
                };
                PlayoutResult again = AiPlayout.Play(catalog, setup, max, null);
                string[] fresh = ReadDecisions(again.ReplayJson);
                int diverge = FirstDifference(oldDecisions, fresh);
                bool same = diverge < 0 && oldWinner == again.Winner && oldReason == again.Reason;
                writer.Append("## ");
                writer.Append(DeckName(catalog, deckId));
                writer.Append(" 对 ");
                writer.Append(catalog.NameOf(monsterId));
                writer.Append("\n\n");
                if (same)
                {
                    writer.Append("打法相同。");
                    writer.Append(WinnerText(again.Winner, again.Reason));
                    writer.Append("\n\n");
                    continue;
                }

                changed++;
                writer.Append("打法不同。原先");
                writer.Append(WinnerText(oldWinner, oldReason));
                writer.Append("，现在");
                writer.Append(WinnerText(again.Winner, again.Reason));
                writer.Append('。');
                if (diverge >= 0)
                {
                    writer.Append("第一处不同的决策是第 ");
                    writer.Append((diverge + 1).ToString(CultureInfo.InvariantCulture));
                    writer.Append(" 个：原先");
                    writer.Append(Describe(At(oldDecisions, diverge)));
                    writer.Append("，现在");
                    writer.Append(Describe(At(fresh, diverge)));
                    writer.Append('。');
                }

                writer.Append("\n\n");
            }

            writer.Append(listed.Array.Count.ToString(CultureInfo.InvariantCulture));
            writer.Append(" 局里有 ");
            writer.Append(changed.ToString(CultureInfo.InvariantCulture));
            writer.Append(" 局打法不同。\n");
            return writer.ToString();
        }

        private static List<ArchiveEntry> Plan(ContentCatalog catalog, ulong seed)
        {
            var entries = new List<ArchiveEntry>();
            if (catalog.Decks.Length == 0)
            {
                if (catalog.DefaultMonster == null)
                {
                    throw new InvalidOperationException("内容没有默认怪物。");
                }

                entries.Add(new ArchiveEntry
                {
                    DeckId = "default",
                    Cards = catalog.DefaultDeck,
                    MonsterId = catalog.DefaultMonster,
                    File = "default__" + catalog.DefaultMonster + ".json",
                    Seed = seed
                });
                return entries;
            }

            for (int d = 0; d < catalog.Decks.Length; d++)
            {
                for (int m = 0; m < catalog.Monsters.Length; m++)
                {
                    DeckDefinition deck = catalog.Decks[d];
                    string monsterId = catalog.Monsters[m].Id;
                    entries.Add(new ArchiveEntry
                    {
                        DeckId = deck.Id,
                        Cards = deck.Cards,
                        MonsterId = monsterId,
                        File = deck.Id + "__" + monsterId + ".json",
                        Seed = seed
                    });
                }
            }

            return entries;
        }

        private static MatchSetup Setup(ArchiveEntry entry)
        {
            return new MatchSetup
            {
                Seed = entry.Seed,
                MonsterId = entry.MonsterId,
                BuildDeck = entry.Cards,
                OpportunitiesPerTurn = 1
            };
        }

        private static string WriteManifest(ContentCatalog catalog, ulong seed, int maxDecisions, List<ArchiveEntry> entries)
        {
            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("kernel");
            writer.Value(KernelVersion.Text);
            writer.Name("content");
            writer.Value(catalog.Hash);
            writer.Name("seed");
            writer.Value(seed);
            writer.Name("max");
            writer.Value(maxDecisions);
            writer.Name("entries");
            writer.BeginArray();
            for (int i = 0; i < entries.Count; i++)
            {
                writer.BeginObject();
                writer.Name("deck");
                writer.Value(entries[i].DeckId);
                writer.Name("monster");
                writer.Value(entries[i].MonsterId);
                writer.Name("file");
                writer.Value(entries[i].File);
                writer.Name("winner");
                writer.Value(entries[i].Winner);
                writer.Name("reason");
                writer.Value(entries[i].Reason);
                writer.Name("rounds");
                writer.Value(entries[i].Rounds);
                writer.EndObject();
            }

            writer.EndArray();
            writer.EndObject();
            return writer.ToString();
        }

        private static string[] DeckOf(ContentCatalog catalog, string deckId)
        {
            if (deckId == "default")
            {
                return catalog.DefaultDeck;
            }

            for (int i = 0; i < catalog.Decks.Length; i++)
            {
                if (catalog.Decks[i].Id == deckId)
                {
                    return catalog.Decks[i].Cards;
                }
            }

            throw new InvalidOperationException("录像里的牌组不在当前内容中：" + deckId);
        }

        private static string DeckName(ContentCatalog catalog, string deckId)
        {
            if (deckId == "default")
            {
                return "默认牌组";
            }

            for (int i = 0; i < catalog.Decks.Length; i++)
            {
                if (catalog.Decks[i].Id == deckId)
                {
                    return catalog.Decks[i].Name;
                }
            }

            return deckId;
        }

        private static string[] ReadDecisions(string replay)
        {
            JsonValue root = JsonReader.Parse(replay);
            JsonValue decisions = root.Require("decisions");
            if (!decisions.IsArray || decisions.Array == null)
            {
                throw new FormatException("录像的决策必须是数组。");
            }

            var values = new string[decisions.Array.Count];
            for (int i = 0; i < decisions.Array.Count; i++)
            {
                values[i] = decisions.Array[i].String();
            }

            return values;
        }

        private static int FirstDifference(string[] left, string[] right)
        {
            int count = left.Length < right.Length ? left.Length : right.Length;
            for (int i = 0; i < count; i++)
            {
                if (left[i] != right[i])
                {
                    return i;
                }
            }

            if (left.Length != right.Length)
            {
                return count;
            }

            return -1;
        }

        private static string At(string[] decisions, int index)
        {
            if (index < 0 || index >= decisions.Length)
            {
                return "（没有这一步）";
            }

            return decisions[index];
        }

        private static string Describe(string option)
        {
            if (option == "（没有这一步）")
            {
                return option;
            }

            if (option == "cast")
            {
                return "打出法术";
            }

            if (option == "end-turn")
            {
                return "结束回合";
            }

            if (option.StartsWith("cell:", StringComparison.Ordinal))
            {
                return "格" + option.Substring(5);
            }

            if (option.StartsWith("play:", StringComparison.Ordinal))
            {
                int cut = option.LastIndexOf(':');
                if (cut >= 0 && cut + 1 < option.Length)
                {
                    return "打出到格" + option.Substring(cut + 1);
                }
            }

            return option;
        }

        private static string WinnerText(string winner, string reason)
        {
            string who = winner == "player" ? "玩家胜" : winner == "monster" ? "怪物胜" : winner == "draw" ? "平局" : "未结束";
            if (winner == "unfinished")
            {
                return who;
            }

            return who + "（" + ReasonText(reason) + "）";
        }

        private static string ReasonText(string reason)
        {
            switch (reason)
            {
                case "full-board": return "满格判定";
                case "resource": return "资源结算";
                case "special": return "特殊结算";
                case "max-decisions": return "决策上限";
                default: return reason;
            }
        }

        private static string Summarize(string title, List<ArchiveEntry> entries, int changed)
        {
            return title + " " + entries.Count.ToString(CultureInfo.InvariantCulture) + " 局，其中 " + changed.ToString(CultureInfo.InvariantCulture) + " 局打法不同。\n";
        }

        private sealed class ArchiveEntry
        {
            public string DeckId = "";
            public string[] Cards = Array.Empty<string>();
            public string MonsterId = "";
            public string File = "";
            public ulong Seed;
            public string Winner = "";
            public string Reason = "";
            public int Rounds;
        }
    }
}
