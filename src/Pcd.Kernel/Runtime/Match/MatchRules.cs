using System;
using System.Collections.Generic;
using System.Globalization;

namespace Pcd.Kernel
{
    /// <summary>
    /// Blank-card rules. Turn order follows the design doc: player turn start, reveal intent,
    /// draw, player action, player turn end, monster turn start, monster action, monster turn end.
    /// </summary>
    internal sealed partial class MatchRules
    {
        private const int OpeningHandSize = 4;
        private const int HandLimit = 10;

        private readonly ContentCatalog _catalog;
        private readonly MatchState _state;
        private DeterministicRng _rng;
        private int _resolvingDecision;
        private string? _causeOverride;
        private readonly List<PendingAbility> _queue = new List<PendingAbility>();
        private readonly List<PendingAbility> _held = new List<PendingAbility>();
        private bool _holding;
        private bool _draining;

        public MatchRules(ContentCatalog catalog, MatchState state)
        {
            _catalog = catalog;
            _state = state;
            _rng = new DeterministicRng(state.RngState);
        }

        public Action<int>? AfterEvent { get; set; }
        public Action<int>? OnAbort { get; set; }

        public void Run()
        {
            int guard = 0;
            while (!_state.Waiting && _state.Phase != MatchPhase.Finished)
            {
                if (++guard > 64)
                {
                    throw new InvalidOperationException("规则推进没有到达决策或终局。");
                }

                switch (_state.Phase)
                {
                    case MatchPhase.LevelStart:
                        LevelStart();
                        break;
                    case MatchPhase.PlayerTurnStart:
                        PlayerTurnStart();
                        break;
                    case MatchPhase.RevealIntent:
                        RevealIntent();
                        break;
                    case MatchPhase.PlayerDraw:
                        PlayerDraw();
                        break;
                    case MatchPhase.PlayerAction:
                        BeginPlayerAction();
                        break;
                    case MatchPhase.PlayerTurnEnd:
                        PlayerTurnEnd();
                        break;
                    case MatchPhase.MonsterTurnStart:
                        MonsterTurnStart();
                        break;
                    case MatchPhase.MonsterAction:
                        BeginMonsterAction();
                        break;
                    case MatchPhase.MonsterTurnEnd:
                        MonsterTurnEnd();
                        break;
                    default:
                        throw new InvalidOperationException("无法推进阶段 " + Names.PhaseName(_state.Phase) + "。");
                }
            }
        }

        public void Submit(string optionId)
        {
            if (!_state.Waiting || _state.Pending == null)
            {
                throw new InvalidOperationException("当前没有待决策。");
            }

            if (!HasOption(_state.Pending, optionId))
            {
                throw new ArgumentException("不是合法选项：" + optionId);
            }

            bool effect = _state.Resolving;
            string replayKind = _state.ResolutionKind;
            string replayOption = _state.ResolutionOption;
            _state.Answers.Add(optionId);
            _state.Waiting = false;
            _resolvingDecision = _state.PendingDecisionId;
            _state.Pending = null;
            if (effect)
            {
                Execute(replayKind, replayOption, () => Replay(replayKind, replayOption));
            }
            else
            {
                if (_state.Phase == MatchPhase.PlayerAction)
                {
                    _state.CauseDecision = _resolvingDecision;
                    Execute("play", optionId, () => ResolvePlayer(optionId));
                }
                else if (_state.Phase == MatchPhase.MonsterAction)
                {
                    _state.CauseDecision = _resolvingDecision;
                    Execute("monster", optionId, () => ResolveMonster(optionId));
                }
                else
                {
                    throw new InvalidOperationException("这个阶段不能回答决策。");
                }

                if (!_state.Waiting)
                {
                    _state.CauseDecision = 0;
                }
            }

            _resolvingDecision = 0;
        }

        public void SpecialSettlement()
        {
            if (_state.Phase == MatchPhase.Finished)
            {
                throw new InvalidOperationException("对局已结束。");
            }

            _state.Waiting = false;
            _state.Pending = null;
            _causeOverride = "special-settlement";
            ResolveSpecial();
            _causeOverride = null;
        }

        public void RebuildPending()
        {
            if (!_state.Waiting)
            {
                return;
            }

            if (_state.Resolving)
            {
                string kind = _state.ResolutionKind;
                string option = _state.ResolutionOption;
                _state.Waiting = false;
                _state.Pending = null;
                _rebuild = true;
                Execute(kind, option, () => Replay(kind, option));
                return;
            }

            if (_state.Phase == MatchPhase.PlayerAction)
            {
                AssignDecision("player", "play", BuildPlayerOptions(), false);
                return;
            }

            if (_state.Phase == MatchPhase.MonsterAction)
            {
                AssignDecision("monster", "place-intent", BuildMonsterOptions(), false);
                return;
            }

            throw new InvalidOperationException("待决策和阶段对不上。");
        }

        public MatchView BuildView(string audience)
        {
            if (audience != "public" && audience != "player" && audience != "hand" && audience != "omniscient")
            {
                throw new ArgumentException("未知的信息等级：" + audience);
            }

            bool showHand = audience == "omniscient" || audience == "player" || audience == "hand";
            bool showDeck = audience == "omniscient";
            bool census = audience == "omniscient";
            var view = new MatchView
            {
                Audience = audience,
                Phase = Names.PhaseName(_state.Phase),
                Round = _state.Round,
                RemainingOpportunities = _state.RemainingOpportunities,
                RevealedIntent = _state.RevealedIntent,
                IntentIndex = _state.IntentCursor,
                IntentMode = _state.IntentMode,
                CommittedCell = _state.CommittedCell,
                CommittedTarget = _state.CommittedTarget,
                Intents = _state.Intents.ToArray(),
                PlayerPoints = Total(Side.Player),
                MonsterPoints = Total(Side.Monster),
                PlayerOccupancy = Occupancy(Side.Player),
                MonsterOccupancy = Occupancy(Side.Monster),
                HandCount = _state.Player.Hand.Count,
                MatchDeckCount = _state.Player.MatchDeck.Count,
                PlayerDiscardCount = _state.Player.Discard.Count,
                MonsterDiscardCount = _state.Monster.Discard.Count,
                Winner = _state.Winner,
                EndReason = _state.EndReason,
                Pools = PoolsOf(),
                InstanceHighWater = _state.NextInstanceId - 1,
                Cells = new ViewCell[9]
            };
            for (int i = 0; i < 9; i++)
            {
                view.Cells[i] = new ViewCell
                {
                    Cell = i + 1,
                    Polluted = _state.Polluted[i],
                    Card = _state.Board[i] == null ? null : ToView(_state.Board[i]!)
                };
            }

            view.Hand = showHand ? ToViews(_state.Player.Hand) : Array.Empty<ViewCard>();
            view.MatchDeck = showDeck ? ToViews(_state.Player.MatchDeck) : Array.Empty<ViewCard>();
            view.Unseen = UnseenIds(showHand);
            view.PlayerDiscard = ToViews(_state.Player.Discard);
            view.MonsterDiscard = ToViews(_state.Monster.Discard);
            view.PlayerVoid = ToViews(_state.Player.Void);
            view.MonsterVoid = ToViews(_state.Monster.Void);
            if (census)
            {
                var all = new List<ViewCard>();
                for (int i = 0; i < 9; i++)
                {
                    if (view.Cells[i].Card != null)
                    {
                        all.Add(view.Cells[i].Card!);
                    }
                }

                all.AddRange(ToViews(_state.Player.MatchDeck));
                all.AddRange(view.Hand);
                all.AddRange(view.PlayerDiscard);
                all.AddRange(view.PlayerVoid);
                all.AddRange(ToViews(_state.Monster.MatchDeck));
                all.AddRange(ToViews(_state.Monster.Hand));
                all.AddRange(view.MonsterDiscard);
                all.AddRange(view.MonsterVoid);
                view.Cards = all.ToArray();
            }

            return view;
        }

        private string[] UnseenIds(bool handIsVisible)
        {
            var ids = new List<string>();
            if (!handIsVisible)
            {
                for (int i = 0; i < _state.Player.Hand.Count; i++)
                {
                    ids.Add(_state.Player.Hand[i].CardId);
                }
            }

            for (int i = 0; i < _state.Player.MatchDeck.Count; i++)
            {
                ids.Add(_state.Player.MatchDeck[i].CardId);
            }

            ids.Sort(StringComparer.Ordinal);
            return ids.ToArray();
        }

        private void LevelStart()
        {
            Execute("level", "", LevelStartCore);
        }

        private void LevelStartCore()
        {
            Shuffle(_state.Player.MatchDeck);
            MonsterDefinition monster = _catalog.RequireMonster(_state.MonsterId);
            for (int i = 0; i < monster.Starting.Length; i++)
            {
                StartingPlacement place = monster.Starting[i];
                CardInstance card = Create(place.CardId, Side.Monster);
                int cell = place.RandomCell ? PickEmpty() : place.Cell;
                if (_state.Board[cell - 1] != null)
                {
                    throw new InvalidOperationException("初始卡要放的格 " + cell.ToString(CultureInfo.InvariantCulture) + " 已经有牌。");
                }

                Enter(card, cell, "setup");
                NoticeEnter(card, false);
            }

            DrainQueue();
            EnqueueTrigger("level-start", null, 0, 0);
            DrainQueue();
            DrawOpening();
            _state.Phase = MatchPhase.PlayerTurnStart;
        }

        private void PlayerTurnStart()
        {
            Execute("player-turn", "", PlayerTurnStartCore);
        }

        private void PlayerTurnStartCore()
        {
            _state.Round++;
            EmitTurn(EventTypes.TurnStarted, Side.Player, _state.Round);
            ResolveTurnLayers(Side.Player);
            if (_state.Phase == MatchPhase.Finished)
            {
                return;
            }

            if (!PlayerHasUsableCards())
            {
                ResolveResource();
            }
            else if (OccupiedCount() == 9)
            {
                ResolveFullBoard(Side.Player);
            }

            if (_state.Phase != MatchPhase.Finished)
            {
                _state.Phase = MatchPhase.RevealIntent;
            }
        }

        private void RevealIntent()
        {
            string cardId = IntentAt(_state.IntentCursor);
            _state.RevealedIntent = cardId;
            Emit(new GameEvent
            {
                Type = EventTypes.IntentRevealed,
                Card = cardId,
                Index = _state.IntentCursor % _state.Intents.Count,
                Owner = Names.SideName(Side.Monster)
            });
            _state.Phase = MatchPhase.PlayerDraw;
        }

        private void PlayerDraw()
        {
            if (_state.Player.Hand.Count >= HandLimit)
            {
                EmitSkipDraw("hand-full");
            }
            else if (_state.Player.MatchDeck.Count == 0)
            {
                EmitSkipDraw("deck-empty");
            }
            else
            {
                DrawOne();
            }

            _state.RemainingOpportunities = _state.OpportunitiesPerTurn;
            _state.Phase = MatchPhase.PlayerAction;
        }

        private void BeginPlayerAction()
        {
            if (_state.RemainingOpportunities <= 0)
            {
                _state.Phase = MatchPhase.PlayerTurnEnd;
                return;
            }

            AssignDecision("player", "play", BuildPlayerOptions(), true);
        }

        private void PlayerTurnEnd()
        {
            Execute("player-end", "", PlayerTurnEndCore);
        }

        private void PlayerTurnEndCore()
        {
            EmitTurn(EventTypes.TurnEnded, Side.Player, null);
            EnqueueTurn("turn-end", Side.Player);
            DrainQueue();
            if (_state.Phase != MatchPhase.Finished)
            {
                _state.Phase = MatchPhase.MonsterTurnStart;
            }
        }

        private void MonsterTurnStart()
        {
            Execute("monster-turn", "", MonsterTurnStartCore);
        }

        private void MonsterTurnStartCore()
        {
            EmitTurn(EventTypes.TurnStarted, Side.Monster, _state.Round);
            ResolveTurnLayers(Side.Monster);
            if (_state.Phase == MatchPhase.Finished)
            {
                return;
            }

            if (OccupiedCount() == 9)
            {
                ResolveFullBoard(Side.Monster);
            }

            if (_state.Phase != MatchPhase.Finished)
            {
                _state.Phase = MatchPhase.MonsterAction;
            }
        }

        private void BeginMonsterAction()
        {
            if (string.IsNullOrEmpty(_state.RevealedIntent))
            {
                throw new InvalidOperationException("怪物回合没有亮出的意图。");
            }

            CardDefinition def = _catalog.RequireCard(_state.RevealedIntent!);
            if (!def.IsSpell && LegalCells(Side.Monster, def.Points, ReadsCoverAlly(def)).Count == 0)
            {
                Emit(new GameEvent
                {
                    Type = EventTypes.ActionSkipped,
                    Card = def.Id,
                    Owner = Names.SideName(Side.Monster),
                    Reason = "no-legal-cell",
                    Index = _state.IntentCursor % _state.Intents.Count
                });
                _state.IntentCursor++;
                _state.Phase = MatchPhase.MonsterTurnEnd;
                return;
            }

            AssignDecision("monster", "place-intent", BuildMonsterOptions(), true);
        }

        private void MonsterTurnEnd()
        {
            Execute("monster-end", "", MonsterTurnEndCore);
        }

        private void MonsterTurnEndCore()
        {
            EmitTurn(EventTypes.TurnEnded, Side.Monster, null);
            EnqueueTurn("turn-end", Side.Monster);
            DrainQueue();
            if (_state.Phase != MatchPhase.Finished)
            {
                _state.Phase = MatchPhase.PlayerTurnStart;
            }
        }

        private void ResolvePlayer(string optionId)
        {
            if (optionId == "end-turn")
            {
                _state.Phase = MatchPhase.PlayerTurnEnd;
                return;
            }

            if (optionId.StartsWith("activate:", StringComparison.Ordinal))
            {
                ResolveActivated(ParseInt(optionId.Substring(9)));
                _state.Phase = MatchPhase.PlayerAction;
                return;
            }

            bool swift;
            if (optionId.StartsWith("cast:", StringComparison.Ordinal))
            {
                int instance = ParseInt(optionId.Substring(5));
                CardInstance card = TakeHand(instance);
                swift = IsSwift(card);
                ResolveSpell(card);
            }
            else
            {
                ParsePlay(optionId, out int instance, out int cell);
                CardInstance card = TakeHand(instance);
                swift = IsSwift(card);
                ResolveUnit(card, cell);
            }

            if (!swift)
            {
                _state.RemainingOpportunities--;
            }

            _state.Phase = _state.RemainingOpportunities <= 0
                ? MatchPhase.PlayerTurnEnd
                : MatchPhase.PlayerAction;
        }

        private void ResolveMonster(string optionId)
        {
            if (string.IsNullOrEmpty(_state.RevealedIntent))
            {
                throw new InvalidOperationException("怪物回合没有亮出的意图。");
            }

            CardInstance card = Create(_state.RevealedIntent!, Side.Monster);
            if (optionId == "cast")
            {
                ResolveSpell(card);
            }
            else
            {
                ResolveUnit(card, ParseCellOption(optionId));
            }

            _state.IntentCursor++;
            _state.Phase = MatchPhase.MonsterTurnEnd;
        }

        private void ResolveUnit(CardInstance card, int cell)
        {
            if (cell < 1 || cell > 9)
            {
                throw new ArgumentException("格位必须是 1 到 9。");
            }

            int attack = Points.Current(card);
            Emit(new GameEvent
            {
                Type = EventTypes.CardPlayed,
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(card.Owner),
                Cell = cell,
                Points = attack
            });
            CardInstance? occupier = _state.Board[cell - 1];
            if (occupier == null)
            {
                Enter(card, cell, "play");
                FinishPlay(card, cell);
                return;
            }

            bool ally = occupier.Owner == card.Owner;
            if (ally && Absorbs(card))
            {
                int gained = Points.Current(occupier);
                RemoveFromBoard(occupier, "effect");
                if (_state.Board[cell - 1] != null)
                {
                    GiveHand(card, "absorb");
                    return;
                }

                if (gained != 0)
                {
                    AddModifier(card, "absorb", gained);
                }

                Enter(card, cell, "play");
                FinishPlay(card, cell);
                return;
            }

            if (ally && !IsCoverAlly(card))
            {
                throw new InvalidOperationException("不能覆盖己方卡牌。");
            }

            int defense = Points.Current(occupier);
            if (attack > defense)
            {
                RemoveFromBoard(occupier, "cover");
                if (defense != 0)
                {
                    AddModifier(card, "cover", -defense);
                }

                Enter(card, cell, "play");
                FinishPlay(card, cell);
                return;
            }

            if (attack == defense)
            {
                // Tie entry leaves the cell in the same step. Pollution only hits a card that remains there.
                RemoveFromBoard(occupier, "tie-cover");
                Enter(card, cell, "play");
                if (card.Zone == Zone.Board)
                {
                    RemoveFromBoard(card, "tie-cover");
                }

                FinishPlay(card, cell);
                return;
            }

            throw new InvalidOperationException("点数不足以覆盖。");
        }

        private void ResolveSpell(CardInstance card)
        {
            Emit(new GameEvent
            {
                Type = EventTypes.CardPlayed,
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(card.Owner),
                Points = 0
            });
            ResolveImmediate(card, "enter");
            ResolveImmediate(card, "cast");
            SendToDiscard(card, "spell", null, 0, EventTypes.CardDiscarded);
            EnqueueSpellWatchers(card);
            DrainQueue();
        }

        private void ApplyPollution(CardInstance card, int cell)
        {
            if (card.Zone != Zone.Board || !_state.Polluted[cell - 1])
            {
                return;
            }

            AddModifier(card, "polluted-cell", -1);
        }

        private void AddModifier(CardInstance card, string source, int amount)
        {
            int before = Points.Current(card);
            card.Modifiers.Add(new PointModifier { Source = source, Amount = amount });
            int after = Points.Current(card);
            if (before != after)
            {
                Emit(new GameEvent
                {
                    Type = EventTypes.PointsChanged,
                    Card = card.CardId,
                    Instance = card.InstanceId,
                    Owner = Names.SideName(card.Owner),
                    Source = source,
                    Before = before,
                    After = after,
                    Points = after
                });
            }

            if (Points.Vital(card) == 0 && card.Zone == Zone.Board)
            {
                RemoveFromBoard(card, "points-zero");
            }
        }

        private void Enter(CardInstance card, int cell, string reason)
        {
            if (_state.Board[cell - 1] != null)
            {
                throw new InvalidOperationException("格 " + cell.ToString(CultureInfo.InvariantCulture) + " 已有卡牌。");
            }

            _state.Board[cell - 1] = card;
            card.Zone = Zone.Board;
            card.Cell = cell;
            Emit(new GameEvent
            {
                Type = EventTypes.CardEntered,
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(card.Owner),
                Cell = cell,
                Reason = reason,
                Points = Points.Current(card),
                Zone = Names.ZoneName(Zone.Board)
            });
            if (Points.Current(card) == 0)
            {
                RemoveFromBoard(card, "points-zero");
            }
        }

        private void RemoveFromBoard(CardInstance card, string reason)
        {
            int cell = card.Cell;
            int points = Points.Current(card);
            if (cell >= 1 && cell <= 9 && ReferenceEquals(_state.Board[cell - 1], card))
            {
                _state.Board[cell - 1] = null;
            }

            card.Zone = Zone.None;
            card.Cell = 0;
            bool cover = reason == "cover" || reason == "tie-cover";
            Depart(card, reason, cell, points, cover);
        }

        private void SendToDiscard(CardInstance card, string reason, int? cell, int points, string type)
        {
            Reset(card);
            card.Zone = Zone.Discard;
            card.Cell = 0;
            _state.SideOf(card.Owner).Discard.Add(card);
            Emit(new GameEvent
            {
                Type = type,
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(card.Owner),
                Cell = cell,
                Zone = Names.ZoneName(Zone.Discard),
                Reason = reason,
                Points = points
            });
        }

        private static void Reset(CardInstance card)
        {
            card.Modifiers.Clear();
            card.Statuses.Clear();
            card.Granted.Clear();
            card.Continuous = 0;
            card.Suppressed = false;
            card.Link = 0;
            card.Activated = false;
            card.Timer = card.TimerMax;
        }

        private void ResolveResource()
        {
            int player = Total(Side.Player);
            int monster = Total(Side.Monster);
            if (monster > player)
            {
                End("monster", "resource");
                return;
            }

            if (monster < player)
            {
                End("player", "resource");
                return;
            }

            if (MonsterCanPlay(IntentAt(_state.IntentCursor)))
            {
                return;
            }

            int playerCells = Occupancy(Side.Player);
            int monsterCells = Occupancy(Side.Monster);
            if (playerCells > monsterCells)
            {
                End("player", "resource");
            }
            else if (monsterCells > playerCells)
            {
                End("monster", "resource");
            }
            else
            {
                End("draw", "resource");
            }
        }

        private void ResolveFullBoard(Side side)
        {
            int mine = Total(side);
            int theirs = Total(side == Side.Player ? Side.Monster : Side.Player);
            if (mine > theirs)
            {
                End(Names.SideName(side), "full-board");
            }
        }

        private void ResolveSpecial()
        {
            int player = Total(Side.Player);
            int monster = Total(Side.Monster);
            if (player > monster)
            {
                End("player", "special");
                return;
            }

            if (monster > player)
            {
                End("monster", "special");
                return;
            }

            int playerCells = Occupancy(Side.Player);
            int monsterCells = Occupancy(Side.Monster);
            if (playerCells > monsterCells)
            {
                End("player", "special");
            }
            else if (monsterCells > playerCells)
            {
                End("monster", "special");
            }
            else
            {
                End("draw", "special");
            }
        }

        private void End(string winner, string reason)
        {
            Emit(new GameEvent
            {
                Type = EventTypes.MatchEnded,
                Winner = winner,
                Reason = reason,
                PlayerPoints = Total(Side.Player),
                MonsterPoints = Total(Side.Monster),
                PlayerOccupancy = Occupancy(Side.Player),
                MonsterOccupancy = Occupancy(Side.Monster),
                Round = _state.Round
            });
            _state.Winner = winner;
            _state.EndReason = reason;
            _state.Phase = MatchPhase.Finished;
            _state.Waiting = false;
            _state.Pending = null;
        }

        private void DrawOpening()
        {
            for (int i = 0; i < OpeningHandSize; i++)
            {
                if (_state.Player.Hand.Count >= HandLimit)
                {
                    EmitSkipDraw("hand-full");
                    return;
                }

                if (_state.Player.MatchDeck.Count == 0)
                {
                    return;
                }

                DrawOne();
            }
        }

        private void DrawOne()
        {
            CardInstance card = _state.Player.MatchDeck[0];
            _state.Player.MatchDeck.RemoveAt(0);
            card.Zone = Zone.Hand;
            card.Cell = 0;
            _state.Player.Hand.Add(card);
            Emit(new GameEvent
            {
                Type = EventTypes.CardDrawn,
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(Side.Player),
                Zone = Names.ZoneName(Zone.Hand),
                Points = Points.Current(card)
            });
        }

        private void EmitSkipDraw(string reason)
        {
            Emit(new GameEvent
            {
                Type = EventTypes.DrawSkipped,
                Owner = Names.SideName(Side.Player),
                Reason = reason
            });
        }

        private void EmitTurn(string type, Side side, int? round)
        {
            Emit(new GameEvent
            {
                Type = type,
                Owner = Names.SideName(side),
                Round = round
            });
        }

        private Option[] BuildPlayerOptions()
        {
            var hand = new List<CardInstance>(_state.Player.Hand);
            hand.Sort(CompareInstance);
            var options = new List<Option>();
            for (int i = 0; i < hand.Count; i++)
            {
                CardInstance card = hand[i];
                if (card.IsSpell)
                {
                    options.Add(new Option
                    {
                        Id = "cast:" + card.InstanceId.ToString(CultureInfo.InvariantCulture),
                        Kind = "cast",
                        Instance = card.InstanceId,
                        CardId = card.CardId
                    });
                    continue;
                }

                List<int> cells = LegalCells(card.Owner, Points.Current(card), IsCoverAlly(card));
                for (int c = 0; c < cells.Count; c++)
                {
                    options.Add(new Option
                    {
                        Id = "play:" + card.InstanceId.ToString(CultureInfo.InvariantCulture) + ":" + cells[c].ToString(CultureInfo.InvariantCulture),
                        Kind = "play",
                        Instance = card.InstanceId,
                        Cell = cells[c],
                        CardId = card.CardId
                    });
                }
            }

            AppendActivated(options);
            options.Add(new Option { Id = "end-turn", Kind = "end-turn" });
            return options.ToArray();
        }

        private Option[] BuildMonsterOptions()
        {
            CardDefinition def = _catalog.RequireCard(_state.RevealedIntent ?? "");
            if (def.IsSpell)
            {
                return new[]
                {
                    new Option { Id = "cast", Kind = "cast", CardId = def.Id }
                };
            }

            List<int> cells = LegalCells(Side.Monster, def.Points, ReadsCoverAlly(def));
            var options = new Option[cells.Count];
            for (int i = 0; i < cells.Count; i++)
            {
                options[i] = new Option
                {
                    Id = "cell:" + cells[i].ToString(CultureInfo.InvariantCulture),
                    Kind = "cell",
                    Cell = cells[i],
                    CardId = def.Id
                };
            }

            return options;
        }

        private void AssignDecision(string actor, string type, Option[] options, bool allocate)
        {
            int id = allocate ? _state.NextDecisionId++ : _state.PendingDecisionId;
            _state.PendingDecisionId = id;
            _state.Waiting = true;
            _state.Pending = new Decision
            {
                Id = id,
                Actor = actor,
                Type = type,
                Ability = null,
                Options = options
            };
        }

        private List<int> LegalCells(Side attacker, int attackPoints, bool coverAlly)
        {
            var cells = new List<int>();
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? occupier = _state.Board[cell - 1];
                if (occupier == null)
                {
                    cells.Add(cell);
                    continue;
                }

                if (occupier.Owner == attacker && !coverAlly)
                {
                    continue;
                }

                if (attackPoints >= Points.Current(occupier))
                {
                    cells.Add(cell);
                }
            }

            return cells;
        }

        private bool MonsterCanPlay(string cardId)
        {
            CardDefinition def = _catalog.RequireCard(cardId);
            if (def.IsSpell)
            {
                return true;
            }

            return LegalCells(Side.Monster, def.Points, ReadsCoverAlly(def)).Count > 0;
        }

        private bool PlayerHasUsableCards()
        {
            return _state.Player.Hand.Count > 0 || _state.Player.MatchDeck.Count > 0;
        }

        private int Total(Side side)
        {
            int sum = 0;
            for (int i = 0; i < 9; i++)
            {
                CardInstance? card = _state.Board[i];
                if (card != null && card.Owner == side)
                {
                    sum += Points.Current(card);
                }
            }

            return sum;
        }

        private int Occupancy(Side side)
        {
            int count = 0;
            for (int i = 0; i < 9; i++)
            {
                CardInstance? card = _state.Board[i];
                if (card != null && card.Owner == side)
                {
                    count++;
                }
            }

            return count;
        }

        private int OccupiedCount()
        {
            int count = 0;
            for (int i = 0; i < 9; i++)
            {
                if (_state.Board[i] != null)
                {
                    count++;
                }
            }

            return count;
        }

        private string IntentAt(int cursor)
        {
            if (_state.Intents.Count == 0)
            {
                throw new InvalidOperationException("怪物没有意图。");
            }

            int index = cursor % _state.Intents.Count;
            if (index < 0)
            {
                index += _state.Intents.Count;
            }

            return _state.Intents[index];
        }

        private CardInstance Create(string cardId, Side owner)
        {
            CardDefinition def = _catalog.RequireCard(cardId);
            return new CardInstance
            {
                InstanceId = _state.NextInstanceId++,
                CardId = def.Id,
                Owner = owner,
                IsSpell = def.IsSpell,
                BasePoints = def.IsSpell ? 0 : def.Points,
                Zone = Zone.None
            };
        }

        private CardInstance TakeHand(int instanceId)
        {
            List<CardInstance> hand = _state.Player.Hand;
            for (int i = 0; i < hand.Count; i++)
            {
                if (hand[i].InstanceId == instanceId)
                {
                    CardInstance card = hand[i];
                    hand.RemoveAt(i);
                    card.Zone = Zone.None;
                    card.Cell = 0;
                    return card;
                }
            }

            throw new InvalidOperationException("手牌里没有这张卡。");
        }

        private void Shuffle(List<CardInstance> deck)
        {
            for (int i = deck.Count - 1; i > 0; i--)
            {
                int j = NextInt(i + 1);
                CardInstance tmp = deck[i];
                deck[i] = deck[j];
                deck[j] = tmp;
            }
        }

        private int PickEmpty()
        {
            var empty = new List<int>();
            for (int cell = 1; cell <= 9; cell++)
            {
                if (_state.Board[cell - 1] == null)
                {
                    empty.Add(cell);
                }
            }

            if (empty.Count == 0)
            {
                throw new InvalidOperationException("没有空格可摆放初始卡。");
            }

            return empty[NextInt(empty.Count)];
        }

        private int NextInt(int exclusiveMax)
        {
            int value = _rng.NextInt(exclusiveMax);
            _state.RngState = _rng.State;
            return value;
        }

        private void Emit(GameEvent evt)
        {
            evt.Seq = _state.NextEventSeq++;
            evt.Cause = Causes();
            _state.Events.Add(evt);
            AfterEvent?.Invoke(evt.Seq);
        }

        private string[] Causes()
        {
            if (_causeOverride != null)
            {
                return new[] { _causeOverride };
            }

            string phase = Names.PhaseName(_state.Phase);
            int decision = _state.CauseDecision > 0 ? _state.CauseDecision : _resolvingDecision;
            if (decision > 0)
            {
                return new[]
                {
                    phase,
                    "decision:" + decision.ToString(CultureInfo.InvariantCulture)
                };
            }

            return new[] { phase };
        }

        private static bool HasOption(Decision decision, string optionId)
        {
            for (int i = 0; i < decision.Options.Length; i++)
            {
                if (decision.Options[i].Id == optionId)
                {
                    return true;
                }
            }

            return false;
        }

        private static int CompareInstance(CardInstance left, CardInstance right)
        {
            return left.InstanceId.CompareTo(right.InstanceId);
        }

        private static void ParsePlay(string option, out int instance, out int cell)
        {
            string[] parts = option.Split(':');
            if (parts.Length != 3 || parts[0] != "play")
            {
                throw new ArgumentException("不是打出选项：" + option);
            }

            instance = ParseInt(parts[1]);
            cell = ParseInt(parts[2]);
        }

        private static int ParseCellOption(string option)
        {
            string[] parts = option.Split(':');
            if (parts.Length != 2 || parts[0] != "cell")
            {
                throw new ArgumentException("不是落点选项：" + option);
            }

            return ParseInt(parts[1]);
        }

        private static int ParseInt(string text)
        {
            if (!int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out int value))
            {
                throw new ArgumentException("选项编号不对：" + text);
            }

            return value;
        }

        private static ViewCard ToView(CardInstance card)
        {
            return new ViewCard
            {
                Instance = card.InstanceId,
                CardId = card.CardId,
                Owner = Names.SideName(card.Owner),
                Zone = Names.ZoneName(card.Zone),
                Cell = card.Cell,
                BasePoints = card.BasePoints,
                CurrentPoints = Points.Current(card),
                CardBackId = card.CardBackId,
                ModifierCount = card.Modifiers.Count,
                IsSpell = card.IsSpell,
                Timer = card.Timer,
                Statuses = StatusIds(card)
            };
        }

        private static ViewCard[] ToViews(List<CardInstance> cards)
        {
            var views = new ViewCard[cards.Count];
            for (int i = 0; i < cards.Count; i++)
            {
                views[i] = ToView(cards[i]);
            }

            return views;
        }
    }
}
