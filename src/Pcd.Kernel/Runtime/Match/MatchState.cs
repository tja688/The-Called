using System;
using System.Collections.Generic;
using System.Globalization;

namespace Pcd.Kernel
{
    internal enum Side
    {
        Player,
        Monster
    }

    internal enum Zone
    {
        None,
        MatchDeck,
        Hand,
        Board,
        Discard,
        Void
    }

    internal enum MatchPhase
    {
        LevelStart,
        PlayerTurnStart,
        RevealIntent,
        PlayerDraw,
        PlayerAction,
        PlayerTurnEnd,
        MonsterTurnStart,
        MonsterAction,
        MonsterTurnEnd,
        Finished
    }

    internal static class Names
    {
        public static string SideName(Side side)
        {
            return side == Side.Player ? "player" : "monster";
        }

        public static Side ParseSide(string name)
        {
            if (name == "player")
            {
                return Side.Player;
            }

            if (name == "monster")
            {
                return Side.Monster;
            }

            throw new ArgumentException("未知阵营：" + name);
        }

        public static string ZoneName(Zone zone)
        {
            switch (zone)
            {
                case Zone.MatchDeck: return "deck";
                case Zone.Hand: return "hand";
                case Zone.Board: return "board";
                case Zone.Discard: return "discard";
                case Zone.Void: return "void";
                default: return "none";
            }
        }

        public static Zone ParseZone(string name)
        {
            switch (name)
            {
                case "deck": return Zone.MatchDeck;
                case "hand": return Zone.Hand;
                case "board": return Zone.Board;
                case "discard": return Zone.Discard;
                case "void": return Zone.Void;
                case "none": return Zone.None;
                default: throw new ArgumentException("未知区域：" + name);
            }
        }

        public static string PhaseName(MatchPhase phase)
        {
            switch (phase)
            {
                case MatchPhase.LevelStart: return "level-start";
                case MatchPhase.PlayerTurnStart: return "player-turn-start";
                case MatchPhase.RevealIntent: return "reveal-intent";
                case MatchPhase.PlayerDraw: return "player-draw";
                case MatchPhase.PlayerAction: return "player-action";
                case MatchPhase.PlayerTurnEnd: return "player-turn-end";
                case MatchPhase.MonsterTurnStart: return "monster-turn-start";
                case MatchPhase.MonsterAction: return "monster-action";
                case MatchPhase.MonsterTurnEnd: return "monster-turn-end";
                case MatchPhase.Finished: return "finished";
                default: throw new ArgumentException("未知阶段。");
            }
        }

        public static MatchPhase ParsePhase(string name)
        {
            switch (name)
            {
                case "level-start": return MatchPhase.LevelStart;
                case "player-turn-start": return MatchPhase.PlayerTurnStart;
                case "reveal-intent": return MatchPhase.RevealIntent;
                case "player-draw": return MatchPhase.PlayerDraw;
                case "player-action": return MatchPhase.PlayerAction;
                case "player-turn-end": return MatchPhase.PlayerTurnEnd;
                case "monster-turn-start": return MatchPhase.MonsterTurnStart;
                case "monster-action": return MatchPhase.MonsterAction;
                case "monster-turn-end": return MatchPhase.MonsterTurnEnd;
                case "finished": return MatchPhase.Finished;
                default: throw new ArgumentException("未知阶段：" + name);
            }
        }
    }

    internal static class Points
    {
        public static int Vital(CardInstance card)
        {
            if (card.IsSpell)
            {
                return 0;
            }

            int sum = card.BasePoints + card.Continuous;
            for (int i = 0; i < card.Modifiers.Count; i++)
            {
                sum += card.Modifiers[i].Amount;
            }

            return sum < 0 ? 0 : sum;
        }

        public static int Current(CardInstance card)
        {
            if (card.Suppressed)
            {
                return 0;
            }

            return Vital(card);
        }

        public static bool HasStatus(CardInstance card, string id)
        {
            for (int i = 0; i < card.Statuses.Count; i++)
            {
                if (card.Statuses[i].Id == id)
                {
                    return true;
                }
            }

            return false;
        }
    }

    internal sealed class PointModifier
    {
        public string Source = "";
        public int Amount;

        public PointModifier Clone()
        {
            return new PointModifier { Source = Source, Amount = Amount };
        }
    }

    internal sealed class StatusMark
    {
        public string Id = "";
        public Side Applier;
        public int AppliedRound;

        public StatusMark Clone()
        {
            return new StatusMark { Id = Id, Applier = Applier, AppliedRound = AppliedRound };
        }
    }

    internal sealed class GrantedAbility
    {
        public string AbilityId = "";
        public int Timer;
        public int TimerMax;
        public bool Spent;

        public GrantedAbility Clone()
        {
            return new GrantedAbility
            {
                AbilityId = AbilityId,
                Timer = Timer,
                TimerMax = TimerMax,
                Spent = Spent
            };
        }
    }

    internal sealed class ResourceSlot
    {
        public string Id = "";
        public int Amount;

        public ResourceSlot Clone()
        {
            return new ResourceSlot { Id = Id, Amount = Amount };
        }
    }

    internal sealed class CardInstance
    {
        public int InstanceId;
        public string CardId = "";
        public Side Owner;
        public Zone Zone;
        public int Cell;
        public bool IsSpell;
        public int BasePoints;
        public string? CardBackId;
        public int Timer;
        public int TimerMax;
        public int Continuous;
        public bool Suppressed;
        public int Link;
        public bool Activated;
        public List<PointModifier> Modifiers = new List<PointModifier>();
        public List<StatusMark> Statuses = new List<StatusMark>();
        public List<GrantedAbility> Granted = new List<GrantedAbility>();

        public CardInstance Clone()
        {
            var copy = new CardInstance
            {
                InstanceId = InstanceId,
                CardId = CardId,
                Owner = Owner,
                Zone = Zone,
                Cell = Cell,
                IsSpell = IsSpell,
                BasePoints = BasePoints,
                CardBackId = CardBackId,
                Timer = Timer,
                TimerMax = TimerMax,
                Continuous = Continuous,
                Suppressed = Suppressed,
                Link = Link,
                Activated = Activated
            };
            for (int i = 0; i < Modifiers.Count; i++)
            {
                copy.Modifiers.Add(Modifiers[i].Clone());
            }

            for (int i = 0; i < Statuses.Count; i++)
            {
                copy.Statuses.Add(Statuses[i].Clone());
            }

            for (int i = 0; i < Granted.Count; i++)
            {
                copy.Granted.Add(Granted[i].Clone());
            }

            return copy;
        }
    }

    internal sealed class SideState
    {
        public List<CardInstance> MatchDeck = new List<CardInstance>();
        public List<CardInstance> Hand = new List<CardInstance>();
        public List<CardInstance> Discard = new List<CardInstance>();
        public List<CardInstance> Void = new List<CardInstance>();
        public List<ResourceSlot> Resources = new List<ResourceSlot>();

        public SideState Clone()
        {
            return new SideState
            {
                MatchDeck = CloneCards(MatchDeck),
                Hand = CloneCards(Hand),
                Discard = CloneCards(Discard),
                Void = CloneCards(Void),
                Resources = CloneResources(Resources)
            };
        }

        private static List<CardInstance> CloneCards(List<CardInstance> cards)
        {
            var copy = new List<CardInstance>(cards.Count);
            for (int i = 0; i < cards.Count; i++)
            {
                copy.Add(cards[i].Clone());
            }

            return copy;
        }

        private static List<ResourceSlot> CloneResources(List<ResourceSlot> resources)
        {
            var copy = new List<ResourceSlot>(resources.Count);
            for (int i = 0; i < resources.Count; i++)
            {
                copy.Add(resources[i].Clone());
            }

            return copy;
        }
    }

    internal sealed class MatchState
    {
        public ulong RngState;
        public MatchPhase Phase;
        public bool Waiting;
        public int Round;
        public int IntentCursor;
        public string? RevealedIntent;
        public string IntentMode = "on-turn";
        public int CommittedCell;
        public int CommittedTarget;
        public int NextInstanceId = 1;
        public int NextEventSeq = 1;
        public int NextDecisionId = 1;
        public int PendingDecisionId;
        public int OpportunitiesPerTurn = 1;
        public int RemainingOpportunities = 1;
        public string? Winner;
        public string? EndReason;
        public bool[] Polluted = new bool[9];
        public CardInstance?[] Board = new CardInstance?[9];
        public SideState Player = new SideState();
        public SideState Monster = new SideState();
        public List<string> Intents = new List<string>();
        public string MonsterId = "";
        public List<GameEvent> Events = new List<GameEvent>();
        public List<string> Answers = new List<string>();
        public bool HasSetup;
        public ulong SetupSeed;
        public string SetupMonsterId = "";
        public List<string> BuildDeck = new List<string>();
        public List<string> BuildBacks = new List<string>();
        public Decision? Pending;
        public bool Resolving;
        public int ResolutionCursor;
        public string ResolutionKind = "";
        public string ResolutionOption = "";
        public int CauseDecision;
        public List<AbilityInjection> Injections = new List<AbilityInjection>();

        public SideState SideOf(Side side)
        {
            return side == Side.Player ? Player : Monster;
        }

        private static bool IntentAlreadyRevealed(MatchPhase phase)
        {
            switch (phase)
            {
                case MatchPhase.PlayerDraw:
                case MatchPhase.PlayerAction:
                case MatchPhase.PlayerTurnEnd:
                case MatchPhase.MonsterTurnStart:
                case MatchPhase.MonsterAction:
                case MatchPhase.MonsterTurnEnd:
                case MatchPhase.Finished:
                    return true;
                default:
                    return false;
            }
        }

        public MatchState Clone()
        {
            var copy = new MatchState
            {
                RngState = RngState,
                Phase = Phase,
                Waiting = Waiting,
                Round = Round,
                IntentCursor = IntentCursor,
                RevealedIntent = RevealedIntent,
                IntentMode = IntentMode,
                CommittedCell = CommittedCell,
                CommittedTarget = CommittedTarget,
                NextInstanceId = NextInstanceId,
                NextEventSeq = NextEventSeq,
                NextDecisionId = NextDecisionId,
                PendingDecisionId = PendingDecisionId,
                OpportunitiesPerTurn = OpportunitiesPerTurn,
                RemainingOpportunities = RemainingOpportunities,
                Winner = Winner,
                EndReason = EndReason,
                Polluted = (bool[])Polluted.Clone(),
                Player = Player.Clone(),
                Monster = Monster.Clone(),
                Intents = new List<string>(Intents),
                MonsterId = MonsterId,
                Answers = new List<string>(Answers),
                HasSetup = HasSetup,
                SetupSeed = SetupSeed,
                SetupMonsterId = SetupMonsterId,
                BuildDeck = new List<string>(BuildDeck),
                BuildBacks = new List<string>(BuildBacks),
                Pending = null,
                Resolving = Resolving,
                ResolutionCursor = ResolutionCursor,
                ResolutionKind = ResolutionKind,
                ResolutionOption = ResolutionOption,
                CauseDecision = CauseDecision,
                Injections = CloneInjections(Injections)
            };
            for (int i = 0; i < 9; i++)
            {
                copy.Board[i] = Board[i] == null ? null : Board[i]!.Clone();
            }

            for (int i = 0; i < Events.Count; i++)
            {
                copy.Events.Add(Events[i].Clone());
            }

            return copy;
        }

        public void CopyFrom(MatchState other)
        {
            RngState = other.RngState;
            Phase = other.Phase;
            Waiting = other.Waiting;
            Round = other.Round;
            IntentCursor = other.IntentCursor;
            RevealedIntent = other.RevealedIntent;
            IntentMode = other.IntentMode;
            CommittedCell = other.CommittedCell;
            CommittedTarget = other.CommittedTarget;
            NextInstanceId = other.NextInstanceId;
            NextEventSeq = other.NextEventSeq;
            NextDecisionId = other.NextDecisionId;
            PendingDecisionId = other.PendingDecisionId;
            OpportunitiesPerTurn = other.OpportunitiesPerTurn;
            RemainingOpportunities = other.RemainingOpportunities;
            Winner = other.Winner;
            EndReason = other.EndReason;
            Polluted = other.Polluted;
            Board = other.Board;
            Player = other.Player;
            Monster = other.Monster;
            Intents = other.Intents;
            MonsterId = other.MonsterId;
            Events = other.Events;
            Answers = other.Answers;
            HasSetup = other.HasSetup;
            SetupSeed = other.SetupSeed;
            SetupMonsterId = other.SetupMonsterId;
            BuildDeck = other.BuildDeck;
            BuildBacks = other.BuildBacks;
            Pending = null;
            Resolving = other.Resolving;
            ResolutionCursor = other.ResolutionCursor;
            ResolutionKind = other.ResolutionKind;
            ResolutionOption = other.ResolutionOption;
            CauseDecision = other.CauseDecision;
            Injections = other.Injections;
        }

        private static List<AbilityInjection> CloneInjections(List<AbilityInjection> injections)
        {
            var copy = new List<AbilityInjection>(injections.Count);
            for (int i = 0; i < injections.Count; i++)
            {
                copy.Add(new AbilityInjection
                {
                    Host = injections[i].Host,
                    AbilityId = injections[i].AbilityId
                });
            }

            return copy;
        }

        public static MatchState CreateFresh(ContentCatalog catalog, MatchSetup setup)
        {
            if (setup.OpportunitiesPerTurn < 1)
            {
                throw new ArgumentException("每回合出牌机会至少为 1。");
            }

            MonsterDefinition monster = catalog.RequireMonster(setup.MonsterId);
            var state = new MatchState
            {
                RngState = setup.Seed,
                Phase = MatchPhase.LevelStart,
                OpportunitiesPerTurn = setup.OpportunitiesPerTurn,
                MonsterId = monster.Id,
                IntentMode = IntentModes.Resolve(setup.IntentMode, monster.IntentMode),
                HasSetup = true,
                SetupSeed = setup.Seed,
                SetupMonsterId = setup.MonsterId
            };
            for (int i = 0; i < monster.Intents.Length; i++)
            {
                state.Intents.Add(monster.Intents[i]);
            }

            string[]? backs = setup.BuildBacks;
            if (backs != null && backs.Length != setup.BuildDeck.Length)
            {
                throw new ArgumentException("卡背数量必须和卡牌数量一致。");
            }

            for (int i = 0; i < setup.BuildDeck.Length; i++)
            {
                string back = backs == null ? "" : backs[i] ?? "";
                state.BuildDeck.Add(setup.BuildDeck[i]);
                state.BuildBacks.Add(back);
                CardInstance card = CreateDefined(catalog, state, setup.BuildDeck[i], Side.Player, back);
                card.Zone = Zone.MatchDeck;
                state.Player.MatchDeck.Add(card);
            }

            CopyInjections(catalog, state, setup.Injections);
            return state;
        }

        public static MatchState CreatePosition(ContentCatalog catalog, MatchPosition position)
        {
            if (position.OpportunitiesPerTurn < 1)
            {
                throw new ArgumentException("每回合出牌机会至少为 1。");
            }

            if (position.Opportunities < 0)
            {
                throw new ArgumentException("剩余出牌机会不能为负。");
            }

            if (position.IntentIndex < 0)
            {
                throw new ArgumentException("意图序号不能为负。");
            }

            MonsterDefinition monster = catalog.RequireMonster(position.MonsterId);
            var state = new MatchState
            {
                RngState = position.Seed,
                Phase = Names.ParsePhase(position.Phase),
                Round = position.Round,
                IntentCursor = position.IntentIndex,
                OpportunitiesPerTurn = position.OpportunitiesPerTurn,
                RemainingOpportunities = position.Opportunities,
                MonsterId = monster.Id,
                IntentMode = IntentModes.Resolve(position.IntentMode, monster.IntentMode)
            };
            for (int i = 0; i < monster.Intents.Length; i++)
            {
                state.Intents.Add(monster.Intents[i]);
            }

            if (IntentAlreadyRevealed(state.Phase))
            {
                state.RevealedIntent = state.Intents[state.IntentCursor % state.Intents.Count];
            }
            for (int i = 0; i < position.PollutedCells.Length; i++)
            {
                int cell = position.PollutedCells[i];
                if (cell < 1 || cell > 9)
                {
                    throw new ArgumentException("污染格必须是 1 到 9。");
                }

                state.Polluted[cell - 1] = true;
            }

            var placed = new PositionCard?[9];
            for (int i = 0; i < position.Board.Length; i++)
            {
                PositionCard spec = position.Board[i];
                if (spec.Cell < 1 || spec.Cell > 9)
                {
                    throw new ArgumentException("格位必须是 1 到 9。");
                }

                if (placed[spec.Cell - 1] != null)
                {
                    throw new ArgumentException("格 " + spec.Cell.ToString(CultureInfo.InvariantCulture) + " 放了两张卡。");
                }

                if (spec.Owner == null)
                {
                    throw new ArgumentException("场上的卡必须写明归属。");
                }

                placed[spec.Cell - 1] = spec;
            }

            for (int cell = 1; cell <= 9; cell++)
            {
                PositionCard? spec = placed[cell - 1];
                if (spec == null)
                {
                    continue;
                }

                CardInstance card = CreateSpec(catalog, state, spec, Names.ParseSide(spec.Owner!));
                if (!card.IsSpell && Points.Vital(card) == 0)
                {
                    throw new ArgumentException("格位上的卡牌点数不能为 0。");
                }

                card.Zone = Zone.Board;
                card.Cell = cell;
                state.Board[cell - 1] = card;
            }

            AddZone(catalog, state, position.PlayerMatchDeck, state.Player.MatchDeck, Zone.MatchDeck, Side.Player);
            AddZone(catalog, state, position.PlayerHand, state.Player.Hand, Zone.Hand, Side.Player);
            AddZone(catalog, state, position.PlayerDiscard, state.Player.Discard, Zone.Discard, Side.Player);
            AddZone(catalog, state, position.PlayerVoid, state.Player.Void, Zone.Void, Side.Player);
            AddZone(catalog, state, position.MonsterDiscard, state.Monster.Discard, Zone.Discard, Side.Monster);
            AddZone(catalog, state, position.MonsterVoid, state.Monster.Void, Zone.Void, Side.Monster);
            AddSetupResources(state.Player, position.PlayerResources);
            AddSetupResources(state.Monster, position.MonsterResources);

            CopyInjections(catalog, state, position.Injections);
            return state;
        }

        private static void AddSetupResources(SideState side, SetupResource[] resources)
        {
            for (int i = 0; i < resources.Length; i++)
            {
                if (resources[i].Amount == 0 || resources[i].Id.Length == 0)
                {
                    continue;
                }

                side.Resources.Add(new ResourceSlot { Id = resources[i].Id, Amount = resources[i].Amount });
            }
        }

        private static void CopyInjections(ContentCatalog catalog, MatchState state, AbilityInjection[] injections)
        {
            for (int i = 0; i < injections.Length; i++)
            {
                catalog.RequireAbility(injections[i].AbilityId);
                state.Injections.Add(new AbilityInjection
                {
                    Host = injections[i].Host,
                    AbilityId = injections[i].AbilityId
                });
            }
        }

        private static void AddZone(
            ContentCatalog catalog,
            MatchState state,
            PositionCard[] specs,
            List<CardInstance> zone,
            Zone zoneName,
            Side owner)
        {
            for (int i = 0; i < specs.Length; i++)
            {
                CardInstance card = CreateSpec(catalog, state, specs[i], owner);
                card.Zone = zoneName;
                card.Cell = 0;
                zone.Add(card);
            }
        }

        private static CardInstance CreateDefined(ContentCatalog catalog, MatchState state, string cardId, Side owner, string? backId)
        {
            CardDefinition def = catalog.RequireCard(cardId);
            string? storedBack = null;
            if (backId != null && backId.Length > 0)
            {
                if (catalog.FindBack(backId) == null)
                {
                    throw new ArgumentException("内容 " + backId + "：牌组引用的卡背不存在。");
                }

                storedBack = backId;
            }

            var card = new CardInstance
            {
                InstanceId = state.NextInstanceId++,
                CardId = def.Id,
                Owner = owner,
                IsSpell = def.IsSpell,
                CardBackId = storedBack,
                BasePoints = def.IsSpell ? 0 : def.Points + BackPoints(catalog, storedBack)
            };
            ArmCountdown(def, card);
            ArmCountdown(BackAbilities(catalog, storedBack), card);
            return card;
        }

        internal static void ArmCountdown(CardDefinition def, CardInstance card)
        {
            ArmCountdown(def.Abilities, card);
        }

        private static void ArmCountdown(AbilityDefinition[] abilities, CardInstance card)
        {
            if (card.TimerMax > 0)
            {
                return;
            }

            for (int i = 0; i < abilities.Length; i++)
            {
                if (abilities[i].Trigger == "countdown" && abilities[i].Countdown > 0)
                {
                    card.TimerMax = abilities[i].Countdown;
                    card.Timer = abilities[i].Countdown;
                    return;
                }
            }
        }

        private static int BackPoints(ContentCatalog catalog, string? backId)
        {
            if (backId == null || backId.Length == 0)
            {
                return 0;
            }

            BackDefinition? back = catalog.FindBack(backId);
            return back == null ? 0 : back.Points;
        }

        private static AbilityDefinition[] BackAbilities(ContentCatalog catalog, string? backId)
        {
            if (backId == null || backId.Length == 0)
            {
                return Array.Empty<AbilityDefinition>();
            }

            BackDefinition? back = catalog.FindBack(backId);
            return back == null ? Array.Empty<AbilityDefinition>() : back.Abilities;
        }

        private static CardInstance CreateSpec(ContentCatalog catalog, MatchState state, PositionCard spec, Side owner)
        {
            CardDefinition def = catalog.RequireCard(spec.CardId);
            var card = new CardInstance
            {
                InstanceId = state.NextInstanceId++,
                CardId = def.Id,
                Owner = owner,
                IsSpell = def.IsSpell,
                CardBackId = spec.CardBackId
            };
            ArmCountdown(def, card);
            ArmCountdown(BackAbilities(catalog, card.CardBackId), card);
            if (spec.Timer.HasValue)
            {
                card.Timer = spec.Timer.Value;
            }

            if (spec.TimerMax.HasValue)
            {
                card.TimerMax = spec.TimerMax.Value;
            }

            for (int i = 0; i < spec.Statuses.Length; i++)
            {
                int round = i < spec.StatusRounds.Length ? spec.StatusRounds[i] : 0;
                card.Statuses.Add(new StatusMark
                {
                    Id = spec.Statuses[i],
                    Applier = owner,
                    AppliedRound = round
                });
                if (spec.Statuses[i] == "status.seal")
                {
                    card.Suppressed = true;
                }
            }

            if (def.IsSpell)
            {
                card.BasePoints = 0;
                return card;
            }

            int printed = def.Points + BackPoints(catalog, card.CardBackId);
            if (spec.Modifiers.Length > 0)
            {
                card.BasePoints = spec.BasePoints ?? printed;
                for (int i = 0; i < spec.Modifiers.Length; i++)
                {
                    card.Modifiers.Add(new PointModifier
                    {
                        Source = spec.Modifiers[i].Source,
                        Amount = spec.Modifiers[i].Amount
                    });
                }
            }
            else if (spec.CurrentPoints.HasValue)
            {
                card.BasePoints = spec.CurrentPoints.Value;
            }
            else if (spec.BasePoints.HasValue)
            {
                card.BasePoints = spec.BasePoints.Value;
            }
            else
            {
                card.BasePoints = printed;
            }

            return card;
        }
    }
}
