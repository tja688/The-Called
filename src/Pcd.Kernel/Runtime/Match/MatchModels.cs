using System;

namespace Pcd.Kernel
{
    public static class RuleProtocol
    {
        public const int Version = 1;
        public const int SnapshotVersion = 2;
    }

    public static class EventTypes
    {
        public const string CardEntered = "card-entered";
        public const string CardDrawn = "card-drawn";
        public const string DrawSkipped = "draw-skipped";
        public const string IntentRevealed = "intent-revealed";
        public const string TurnStarted = "turn-started";
        public const string TurnEnded = "turn-ended";
        public const string CardPlayed = "card-played";
        public const string CardRemoved = "card-removed";
        public const string CardDiscarded = "card-discarded";
        public const string PointsChanged = "points-changed";
        public const string ActionSkipped = "action-skipped";
        public const string MatchEnded = "match-ended";
    }

    public sealed class GameEvent
    {
        public int Seq { get; internal set; }
        public string Type { get; internal set; } = "";
        public string[] Cause { get; internal set; } = Array.Empty<string>();
        public string? Card { get; internal set; }
        public int? Instance { get; internal set; }
        public string? Owner { get; internal set; }
        public int? Cell { get; internal set; }
        public string? Zone { get; internal set; }
        public string? Reason { get; internal set; }
        public string? Source { get; internal set; }
        public int? Before { get; internal set; }
        public int? After { get; internal set; }
        public string? Winner { get; internal set; }
        public int? Index { get; internal set; }
        public int? Round { get; internal set; }
        public int? Points { get; internal set; }
        public int? PlayerPoints { get; internal set; }
        public int? MonsterPoints { get; internal set; }
        public int? PlayerOccupancy { get; internal set; }
        public int? MonsterOccupancy { get; internal set; }

        internal GameEvent Clone()
        {
            return new GameEvent
            {
                Seq = Seq,
                Type = Type,
                Cause = (string[])Cause.Clone(),
                Card = Card,
                Instance = Instance,
                Owner = Owner,
                Cell = Cell,
                Zone = Zone,
                Reason = Reason,
                Source = Source,
                Before = Before,
                After = After,
                Winner = Winner,
                Index = Index,
                Round = Round,
                Points = Points,
                PlayerPoints = PlayerPoints,
                MonsterPoints = MonsterPoints,
                PlayerOccupancy = PlayerOccupancy,
                MonsterOccupancy = MonsterOccupancy
            };
        }
    }

    public sealed class Option
    {
        public string Id { get; internal set; } = "";
        public string Kind { get; internal set; } = "";
        public int Instance { get; internal set; }
        public int Cell { get; internal set; }
        public string? CardId { get; internal set; }
    }

    public sealed class Decision
    {
        public int Id { get; internal set; }
        public string Actor { get; internal set; } = "";
        public string Type { get; internal set; } = "";
        public string? Ability { get; internal set; }
        public Option[] Options { get; internal set; } = Array.Empty<Option>();
    }

    public sealed class MatchResult
    {
        public string Winner { get; internal set; } = "";
        public string Reason { get; internal set; } = "";
        public int Rounds { get; internal set; }
        public int PlayerPoints { get; internal set; }
        public int MonsterPoints { get; internal set; }
        public int PlayerOccupancy { get; internal set; }
        public int MonsterOccupancy { get; internal set; }
    }

    public sealed class AdvanceResult
    {
        public GameEvent[] Events { get; internal set; } = Array.Empty<GameEvent>();
        public Decision? Pending { get; internal set; }
        public MatchResult? Result { get; internal set; }
    }

    public sealed class ViewCard
    {
        public int Instance { get; internal set; }
        public string CardId { get; internal set; } = "";
        public string Owner { get; internal set; } = "";
        public string Zone { get; internal set; } = "";
        public int Cell { get; internal set; }
        public int BasePoints { get; internal set; }
        public int CurrentPoints { get; internal set; }
        public string? CardBackId { get; internal set; }
        public int ModifierCount { get; internal set; }
        public bool IsSpell { get; internal set; }
        public int Timer { get; internal set; }
        public string[] Statuses { get; internal set; } = Array.Empty<string>();
    }

    public sealed class ViewCell
    {
        public int Cell { get; internal set; }
        public bool Polluted { get; internal set; }
        public ViewCard? Card { get; internal set; }
    }

    public sealed class ViewPool
    {
        public string Owner { get; internal set; } = "";
        public string Id { get; internal set; } = "";
        public int Amount { get; internal set; }
    }

    public sealed class SetupResource
    {
        public string Id { get; set; } = "";
        public int Amount { get; set; }
    }

    public sealed class MatchView
    {
        public string Audience { get; internal set; } = "";
        public string Phase { get; internal set; } = "";
        public int Round { get; internal set; }
        public int RemainingOpportunities { get; internal set; }
        public string? RevealedIntent { get; internal set; }
        public int IntentIndex { get; internal set; }
        public string IntentMode { get; internal set; } = "on-turn";
        public int CommittedCell { get; internal set; }
        public int CommittedTarget { get; internal set; }
        public string[] Intents { get; internal set; } = Array.Empty<string>();
        public string[] Unseen { get; internal set; } = Array.Empty<string>();
        public int PlayerPoints { get; internal set; }
        public int MonsterPoints { get; internal set; }
        public int PlayerOccupancy { get; internal set; }
        public int MonsterOccupancy { get; internal set; }
        public int HandCount { get; internal set; }
        public int MatchDeckCount { get; internal set; }
        public int PlayerDiscardCount { get; internal set; }
        public int MonsterDiscardCount { get; internal set; }
        public ViewPool[] Pools { get; internal set; } = Array.Empty<ViewPool>();
        public string? Winner { get; internal set; }
        public string? EndReason { get; internal set; }
        public ViewCell[] Cells { get; internal set; } = Array.Empty<ViewCell>();
        public ViewCard[] Hand { get; internal set; } = Array.Empty<ViewCard>();
        public ViewCard[] MatchDeck { get; internal set; } = Array.Empty<ViewCard>();
        public ViewCard[] PlayerDiscard { get; internal set; } = Array.Empty<ViewCard>();
        public ViewCard[] MonsterDiscard { get; internal set; } = Array.Empty<ViewCard>();
        public ViewCard[] PlayerVoid { get; internal set; } = Array.Empty<ViewCard>();
        public ViewCard[] MonsterVoid { get; internal set; } = Array.Empty<ViewCard>();
        public ViewCard[] Cards { get; internal set; } = Array.Empty<ViewCard>();
        public int InstanceHighWater { get; internal set; }
    }

    public sealed class PointChange
    {
        public string Source { get; set; } = "";
        public int Amount { get; set; }
    }

    public sealed class PositionCard
    {
        public string CardId { get; set; } = "";
        public int Cell { get; set; }
        public string? Owner { get; set; }
        public int? BasePoints { get; set; }
        public int? CurrentPoints { get; set; }
        public string? CardBackId { get; set; }
        public PointChange[] Modifiers { get; set; } = Array.Empty<PointChange>();
        public string[] Statuses { get; set; } = Array.Empty<string>();
        public int[] StatusRounds { get; set; } = Array.Empty<int>();
        public int? Timer { get; set; }
        public int? TimerMax { get; set; }
    }

    public sealed class MatchSetup
    {
        public ulong Seed { get; set; } = 1;
        public string MonsterId { get; set; } = "";
        public string[] BuildDeck { get; set; } = Array.Empty<string>();
        /// <summary>与 BuildDeck 等长。缺省或空串是白板。</summary>
        public string[]? BuildBacks { get; set; }
        public int OpportunitiesPerTurn { get; set; } = 1;
        public AbilityInjection[] Injections { get; set; } = Array.Empty<AbilityInjection>();
        public string IntentMode { get; set; } = "";
        public string Information { get; set; } = "";
    }

    public sealed class MatchPosition
    {
        public ulong Seed { get; set; } = 1;
        public string MonsterId { get; set; } = "";
        public string Phase { get; set; } = "player-action";
        public int Round { get; set; }
        public int IntentIndex { get; set; }
        public int OpportunitiesPerTurn { get; set; } = 1;
        public int Opportunities { get; set; } = 1;
        public string IntentMode { get; set; } = "";
        public int[] PollutedCells { get; set; } = Array.Empty<int>();
        public PositionCard[] Board { get; set; } = Array.Empty<PositionCard>();
        public PositionCard[] PlayerMatchDeck { get; set; } = Array.Empty<PositionCard>();
        public PositionCard[] PlayerHand { get; set; } = Array.Empty<PositionCard>();
        public PositionCard[] PlayerDiscard { get; set; } = Array.Empty<PositionCard>();
        public PositionCard[] PlayerVoid { get; set; } = Array.Empty<PositionCard>();
        public PositionCard[] MonsterDiscard { get; set; } = Array.Empty<PositionCard>();
        public PositionCard[] MonsterVoid { get; set; } = Array.Empty<PositionCard>();
        public SetupResource[] PlayerResources { get; set; } = Array.Empty<SetupResource>();
        public SetupResource[] MonsterResources { get; set; } = Array.Empty<SetupResource>();
        public AbilityInjection[] Injections { get; set; } = Array.Empty<AbilityInjection>();
    }
}
