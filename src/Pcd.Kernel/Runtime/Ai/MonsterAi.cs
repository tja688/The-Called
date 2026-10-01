using System;
using System.Globalization;
using System.Text;

namespace Pcd.Kernel
{
    public sealed class AiScore
    {
        public string OptionId { get; internal set; } = "";
        public int Score { get; internal set; }
        public string Reason { get; internal set; } = "";
        public string Label { get; internal set; } = "";
    }

    public sealed class AiReport
    {
        public string Choice { get; internal set; } = "";
        public AiScore[] Scores { get; internal set; } = Array.Empty<AiScore>();

        public string ToMarkdown(ContentCatalog catalog, string? intentId)
        {
            var writer = new StringBuilder();
            writer.Append("# 怪物落点\n\n");
            if (!string.IsNullOrEmpty(intentId))
            {
                writer.Append("意图：");
                writer.Append(catalog.NameOf(intentId));
                writer.Append("\n\n");
            }

            writer.Append("| 落点 | 得分 | 理由 |\n| --- | --- | --- |\n");
            AiScore? chosen = null;
            for (int i = 0; i < Scores.Length; i++)
            {
                AiScore score = Scores[i];
                if (score.OptionId == Choice)
                {
                    chosen = score;
                }

                writer.Append("| ");
                writer.Append(score.Label);
                writer.Append(" | ");
                writer.Append(score.Score.ToString(CultureInfo.InvariantCulture));
                writer.Append(" | ");
                writer.Append(score.Reason);
                writer.Append(" |\n");
            }

            writer.Append("\n选择：");
            if (chosen == null)
            {
                writer.Append(Choice);
            }
            else
            {
                writer.Append(chosen.Label);
                writer.Append("。");
                writer.Append(chosen.Reason);
                writer.Append("这一落点的得分是 ");
                writer.Append(chosen.Score.ToString(CultureInfo.InvariantCulture));
                writer.Append('。');
            }

            writer.Append('\n');
            return writer.ToString();
        }

        public string ToJson()
        {
            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("choice");
            writer.Value(Choice);
            writer.Name("options");
            writer.BeginArray();
            for (int i = 0; i < Scores.Length; i++)
            {
                writer.BeginObject();
                writer.Name("id");
                writer.Value(Scores[i].OptionId);
                writer.Name("label");
                writer.Value(Scores[i].Label);
                writer.Name("score");
                writer.Value(Scores[i].Score);
                writer.Name("reason");
                writer.Value(Scores[i].Reason);
                writer.EndObject();
            }

            writer.EndArray();
            writer.EndObject();
            return writer.ToString();
        }
    }

    public static class DecisionSeed
    {
        public static ulong Mix(ulong seed, int salt, int decisionId)
        {
            unchecked
            {
                ulong mixed = seed ^ 0xD1B54A32D192ED03UL;
                mixed ^= (ulong)(uint)salt * 0x9E3779B97F4A7C15UL;
                mixed ^= (ulong)(uint)decisionId * 0xBF58476D1CE4E5B9UL;
                if (mixed == 0)
                {
                    mixed = 1;
                }

                return mixed;
            }
        }
    }

    public static class MonsterAi
    {
        public static AiReport Choose(MatchSession session, Decision decision, Personality personality, ulong seed)
        {
            if (session == null)
            {
                throw new ArgumentNullException(nameof(session));
            }

            if (decision == null)
            {
                throw new ArgumentNullException(nameof(decision));
            }

            if (personality == null)
            {
                throw new ArgumentNullException(nameof(personality));
            }

            if (decision.Options.Length == 0)
            {
                throw new InvalidOperationException("没有合法选项。");
            }

            string level = InformationLevels.Normalize(personality.Information);
            int depth = personality.Depth;
            if (depth < 2)
            {
                depth = 2;
            }

            if (depth > 3)
            {
                depth = 3;
            }

            int samples = personality.Samples < 1 ? 1 : personality.Samples;
            int budget = personality.NodeBudget < 1 ? 1 : personality.NodeBudget;
            int count = decision.Options.Length;
            var totals = new int[count];
            var breakdowns = new EvalBreakdown[count];
            for (int i = 0; i < count; i++)
            {
                breakdowns[i] = new EvalBreakdown { Factor = "场面接近" };
            }

            for (int sample = 0; sample < samples; sample++)
            {
                ulong sampleSeed = DecisionSeed.Mix(seed, sample + 1, decision.Id);
                ForwardModel world = ForwardModel.Open(session, level, sampleSeed);
                int share = budget / count;
                if (share < 1)
                {
                    share = 1;
                }

                for (int i = 0; i < count; i++)
                {
                    var used = new int[1];
                    ForwardModel next = world.Try(decision.Options[i].Id);
                    if (sample == 0)
                    {
                        breakdowns[i] = PositionEval.BreakDown(next.View, session.Catalog, personality);
                    }

                    totals[i] += Search(next, session.Catalog, personality, depth - 1, share, used);
                }
            }

            string[] factors = Distinguish(breakdowns);

            int best = 0;
            for (int i = 1; i < count; i++)
            {
                if (totals[i] > totals[best]
                    || (totals[i] == totals[best]
                        && string.CompareOrdinal(decision.Options[i].Id, decision.Options[best].Id) < 0))
                {
                    best = i;
                }
            }

            var scores = new AiScore[count];
            for (int i = 0; i < count; i++)
            {
                string label = PositionEval.DescribeOption(decision.Options[i]);
                scores[i] = new AiScore
                {
                    OptionId = decision.Options[i].Id,
                    Label = label,
                    Score = totals[i] / samples,
                    Reason = label + "，主要因为" + factors[i] + "。"
                };
            }

            return new AiReport
            {
                Choice = decision.Options[best].Id,
                Scores = scores
            };
        }

        private static int Search(ForwardModel model, ContentCatalog catalog, Personality personality, int depth, int budget, int[] used)
        {
            used[0]++;
            MatchView view = model.View;
            if (view.Winner != null || depth <= 0 || used[0] >= budget)
            {
                return PositionEval.Score(view, catalog, personality);
            }

            Decision? pending = model.Pending;
            if (pending == null || pending.Options.Length == 0)
            {
                return PositionEval.Score(view, catalog, personality);
            }

            Option[] options = Ordered(pending.Options);
            bool maximize = pending.Actor == "monster";
            int best = maximize ? int.MinValue / 4 : int.MaxValue / 4;
            bool any = false;
            for (int i = 0; i < options.Length; i++)
            {
                if (used[0] >= budget)
                {
                    break;
                }

                any = true;
                int score = Search(model.Try(options[i].Id), catalog, personality, depth - 1, budget, used);
                if (maximize)
                {
                    if (score > best)
                    {
                        best = score;
                    }
                }
                else if (score < best)
                {
                    best = score;
                }
            }

            if (!any)
            {
                return PositionEval.Score(view, catalog, personality);
            }

            return best;
        }

        private static Option[] Ordered(Option[] options)
        {
            var copy = (Option[])options.Clone();
            Array.Sort(copy, CompareOption);
            return copy;
        }

        private static int CompareOption(Option left, Option right)
        {
            int compare = string.CompareOrdinal(left.Kind, right.Kind);
            if (compare != 0)
            {
                return compare;
            }

            compare = string.CompareOrdinal(left.CardId ?? "", right.CardId ?? "");
            if (compare != 0)
            {
                return compare;
            }

            compare = left.Cell.CompareTo(right.Cell);
            if (compare != 0)
            {
                return compare;
            }

            return string.CompareOrdinal(left.Id, right.Id);
        }

        private static string[] Distinguish(EvalBreakdown[] rows)
        {
            int minPoints = rows[0].PointsTerm;
            int minOccupancy = rows[0].OccupancyTerm;
            int minCover = rows[0].CoverTerm;
            int minFull = rows[0].FullTerm;
            int minResource = rows[0].ResourceTerm;
            int minIntent = rows[0].IntentTerm;
            for (int i = 1; i < rows.Length; i++)
            {
                minPoints = Math.Min(minPoints, rows[i].PointsTerm);
                minOccupancy = Math.Min(minOccupancy, rows[i].OccupancyTerm);
                minCover = Math.Min(minCover, rows[i].CoverTerm);
                minFull = Math.Min(minFull, rows[i].FullTerm);
                minResource = Math.Min(minResource, rows[i].ResourceTerm);
                minIntent = Math.Min(minIntent, rows[i].IntentTerm);
            }

            var factors = new string[rows.Length];
            for (int i = 0; i < rows.Length; i++)
            {
                factors[i] = BestAdvantage(rows[i], minPoints, minOccupancy, minCover, minFull, minResource, minIntent);
            }

            return factors;
        }

        private static string BestAdvantage(EvalBreakdown row, int minPoints, int minOccupancy, int minCover, int minFull, int minResource, int minIntent)
        {
            int best = row.PointsTerm - minPoints;
            string name = "点数差";
            Consider(row.OccupancyTerm - minOccupancy, "占格", ref best, ref name);
            Consider(row.CoverTerm - minCover, "被覆盖风险", ref best, ref name);
            Consider(row.FullTerm - minFull, "离满格判定的距离", ref best, ref name);
            Consider(row.ResourceTerm - minResource, "离资源结算的距离", ref best, ref name);
            Consider(row.IntentTerm - minIntent, "后续意图的落点", ref best, ref name);
            if (best <= 0)
            {
                return row.Factor;
            }

            return name;
        }

        private static void Consider(int advantage, string label, ref int best, ref string name)
        {
            if (advantage > best)
            {
                best = advantage;
                name = label;
            }
        }
    }

    public static class GreedyBot
    {
        public static string Choose(MatchSession session, Decision decision, ulong seed)
        {
            if (session == null)
            {
                throw new ArgumentNullException(nameof(session));
            }

            if (decision == null)
            {
                throw new ArgumentNullException(nameof(decision));
            }

            if (decision.Options.Length == 0)
            {
                throw new InvalidOperationException("没有合法选项。");
            }

            var personality = new Personality();
            ForwardModel world = ForwardModel.Open(session, "hand", seed == 0 ? 1UL : seed);
            int best = 0;
            int bestScore = int.MaxValue;
            for (int i = 0; i < decision.Options.Length; i++)
            {
                int score = PositionEval.Score(world.Try(decision.Options[i].Id).View, session.Catalog, personality);
                if (score < bestScore
                    || (score == bestScore && string.CompareOrdinal(decision.Options[i].Id, decision.Options[best].Id) < 0))
                {
                    best = i;
                    bestScore = score;
                }
            }

            return decision.Options[best].Id;
        }
    }
}
