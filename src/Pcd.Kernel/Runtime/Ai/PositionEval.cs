using System.Globalization;

namespace Pcd.Kernel
{
    public sealed class EvalBreakdown
    {
        public int Score { get; internal set; }
        public string Factor { get; internal set; } = "";
        public int PointsTerm { get; internal set; }
        public int OccupancyTerm { get; internal set; }
        public int CoverTerm { get; internal set; }
        public int FullTerm { get; internal set; }
        public int ResourceTerm { get; internal set; }
        public int IntentTerm { get; internal set; }
    }

    public static class PositionEval
    {
        public static EvalBreakdown BreakDown(MatchView view, ContentCatalog catalog, Personality personality)
        {
            if (view.Winner == "monster")
            {
                return new EvalBreakdown
                {
                    Score = 100000 + Finish(view),
                    Factor = "已经获胜"
                };
            }

            if (view.Winner == "player")
            {
                return new EvalBreakdown
                {
                    Score = -100000 + Finish(view),
                    Factor = "已经落败"
                };
            }

            if (view.Winner == "draw")
            {
                return new EvalBreakdown { Score = 0, Factor = "平局" };
            }

            int lead = view.MonsterPoints - view.PlayerPoints;
            int occupancy = view.MonsterOccupancy - view.PlayerOccupancy;
            int risk = Threatened(view);
            int empty = 9 - (view.PlayerOccupancy + view.MonsterOccupancy);
            int full = 0;
            if (empty <= 0)
            {
                full = lead * 3;
            }
            else if (empty == 1)
            {
                full = lead;
            }

            int usable = view.HandCount + view.MatchDeckCount;
            int resource = 0;
            if (usable <= 0)
            {
                resource = lead * 3;
            }
            else if (usable <= 2)
            {
                resource = lead;
            }

            int intent = IntentRoom(view, catalog);
            int pointsTerm = personality.Points * lead;
            int occupancyTerm = personality.Occupancy * occupancy;
            int coverTerm = personality.CoverRisk * -risk;
            int fullTerm = personality.FullBoard * full;
            int resourceTerm = personality.Resource * resource;
            int intentTerm = personality.Intent * intent;
            return new EvalBreakdown
            {
                Score = pointsTerm + occupancyTerm + coverTerm + fullTerm + resourceTerm + intentTerm,
                Factor = MainFactor(pointsTerm, occupancyTerm, coverTerm, fullTerm, resourceTerm, intentTerm),
                PointsTerm = pointsTerm,
                OccupancyTerm = occupancyTerm,
                CoverTerm = coverTerm,
                FullTerm = fullTerm,
                ResourceTerm = resourceTerm,
                IntentTerm = intentTerm
            };
        }

        private static int Finish(MatchView view)
        {
            return (view.MonsterPoints - view.PlayerPoints) * 100 + view.MonsterOccupancy - view.PlayerOccupancy;
        }

        public static int Score(MatchView view, ContentCatalog catalog, Personality personality)
        {
            return BreakDown(view, catalog, personality).Score;
        }

        private static string MainFactor(int points, int occupancy, int cover, int full, int resource, int intent)
        {
            int best = Abs(points);
            string name = "点数差";
            Consider(occupancy, "占格", ref best, ref name);
            Consider(cover, "被覆盖风险", ref best, ref name);
            Consider(full, "离满格判定的距离", ref best, ref name);
            Consider(resource, "离资源结算的距离", ref best, ref name);
            Consider(intent, "后续意图的落点", ref best, ref name);
            if (best == 0)
            {
                return "场面接近";
            }

            return name;
        }

        private static void Consider(int term, string label, ref int best, ref string name)
        {
            int magnitude = Abs(term);
            if (magnitude > best)
            {
                best = magnitude;
                name = label;
            }
        }

        private static int Abs(int value)
        {
            return value < 0 ? -value : value;
        }

        private static int Threatened(MatchView view)
        {
            int risk = 0;
            for (int i = 0; i < view.Cells.Length; i++)
            {
                ViewCard? own = view.Cells[i].Card;
                if (own == null || own.Owner != "monster" || own.IsSpell)
                {
                    continue;
                }

                for (int j = 0; j < view.Cells.Length; j++)
                {
                    ViewCard? enemy = view.Cells[j].Card;
                    if (enemy != null && enemy.Owner == "player" && !enemy.IsSpell && enemy.CurrentPoints >= own.CurrentPoints)
                    {
                        risk++;
                        break;
                    }
                }
            }

            return risk;
        }

        private static int IntentRoom(MatchView view, ContentCatalog catalog)
        {
            if (view.Intents.Length == 0 || catalog == null)
            {
                return 0;
            }

            int next = view.IntentIndex + 1;
            int index = next % view.Intents.Length;
            if (index < 0)
            {
                index += view.Intents.Length;
            }

            CardDefinition card = catalog.RequireCard(view.Intents[index]);
            if (card.IsSpell)
            {
                return 1;
            }

            int room = 0;
            for (int i = 0; i < view.Cells.Length; i++)
            {
                ViewCard? occupier = view.Cells[i].Card;
                if (occupier == null)
                {
                    room++;
                    continue;
                }

                if (occupier.Owner == "player" && !occupier.IsSpell && card.Points >= occupier.CurrentPoints)
                {
                    room++;
                }
            }

            return room;
        }

        public static string DescribeOption(Option option)
        {
            if (option.Kind == "cell")
            {
                return "格" + option.Cell.ToString(CultureInfo.InvariantCulture);
            }

            if (option.Kind == "cast" || option.Id == "cast")
            {
                return "打出法术";
            }

            if (option.Kind == "end-turn")
            {
                return "结束回合";
            }

            if (option.Kind == "play")
            {
                return "打出到格" + option.Cell.ToString(CultureInfo.InvariantCulture);
            }

            return option.Id;
        }
    }
}
