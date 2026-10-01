namespace Pcd.Kernel
{
    public sealed class Personality
    {
        public int Points { get; set; } = 6;
        public int Occupancy { get; set; } = 5;
        public int CoverRisk { get; set; } = 4;
        public int FullBoard { get; set; } = 5;
        public int Resource { get; set; } = 3;
        public int Intent { get; set; } = 2;
        public int Depth { get; set; } = 2;
        public int Samples { get; set; } = 1;
        public int NodeBudget { get; set; } = 32;
        public string Information { get; set; } = "public";

        public Personality Copy()
        {
            return new Personality
            {
                Points = Points,
                Occupancy = Occupancy,
                CoverRisk = CoverRisk,
                FullBoard = FullBoard,
                Resource = Resource,
                Intent = Intent,
                Depth = Depth,
                Samples = Samples,
                NodeBudget = NodeBudget,
                Information = Information
            };
        }
    }

    public static class IntentModes
    {
        public const string OnTurn = "on-turn";
        public const string OnReveal = "on-reveal";

        public static string Resolve(string requested, string fallback)
        {
            string mode = requested.Length == 0 ? fallback : requested;
            return Stored(mode);
        }

        public static string Stored(string? mode)
        {
            if (mode == null || mode.Length == 0)
            {
                return OnTurn;
            }

            if (mode != OnTurn && mode != OnReveal)
            {
                throw new System.ArgumentException("意图模式只能是 on-turn 或 on-reveal。");
            }

            return mode;
        }
    }

    public static class InformationLevels
    {
        public static string Normalize(string level)
        {
            if (level == null || level.Length == 0 || level == "public")
            {
                return "public";
            }

            if (level == "hand" || level == "player")
            {
                return "hand";
            }

            if (level == "omniscient")
            {
                return "omniscient";
            }

            throw new System.ArgumentException("未知的信息等级：" + level);
        }
    }
}
