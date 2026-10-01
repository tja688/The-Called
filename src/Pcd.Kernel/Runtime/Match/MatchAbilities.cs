using System;
using System.Collections.Generic;
using System.Globalization;

namespace Pcd.Kernel
{
    internal sealed partial class MatchRules
    {
        private sealed class PendingAbility
        {
            public int Rank;
            public int Cell;
            public int Instance;
            public int AbilityIndex;
            public string AbilityId = "";
            public bool Granted;
            public int GrantIndex;
            public int ContextInstance;
            public int ContextCell;
            public int CapturedPoints;
            public int Spent;
            public bool Leave;
            public bool LinkRemove;
            public string Host = "";
        }

        private sealed class NeedDecision : Exception
        {
            public NeedDecision(string actor, string type, string ability, Option[] options)
                : base("需要决策")
            {
                Actor = actor;
                Type = type;
                Ability = ability;
                Options = options;
            }

            public string Actor { get; }
            public string Type { get; }
            public string Ability { get; }
            public Option[] Options { get; }
        }

        private bool _rebuild;

        private void Execute(string kind, string option, Action body)
        {
            if (!_catalog.MayAsk && !_state.Resolving)
            {
                body();
                return;
            }

            bool start = !_state.Resolving;
            if (start)
            {
                _state.Resolving = true;
                _state.ResolutionKind = kind;
                _state.ResolutionOption = option;
                _state.ResolutionCursor = _state.Answers.Count;
            }

            MatchState checkpoint = _state.Clone();
            int kept = _state.Events.Count;
            try
            {
                body();
                _state.Resolving = false;
                _state.ResolutionKind = "";
                _state.ResolutionOption = "";
                _state.CauseDecision = 0;
                _rebuild = false;
            }
            catch (NeedDecision need)
            {
                _queue.Clear();
                _held.Clear();
                _holding = false;
                _draining = false;
                _state.CopyFrom(checkpoint);
                _rng = new DeterministicRng(_state.RngState);
                OnAbort?.Invoke(kept);
                Present(need, _rebuild);
                _rebuild = false;
            }
        }

        private void Replay(string kind, string option)
        {
            switch (kind)
            {
                case "play":
                    ResolvePlayer(option);
                    break;
                case "monster":
                    ResolveMonster(option);
                    break;
                case "level":
                    LevelStartCore();
                    break;
                case "player-turn":
                    PlayerTurnStartCore();
                    break;
                case "player-end":
                    PlayerTurnEndCore();
                    break;
                case "monster-turn":
                    MonsterTurnStartCore();
                    break;
                case "monster-end":
                    MonsterTurnEndCore();
                    break;
                default:
                    throw new InvalidOperationException("无法重放结算 " + kind + "。");
            }
        }

        private void Present(NeedDecision need, bool reuse)
        {
            int id = reuse ? _state.PendingDecisionId : _state.NextDecisionId++;
            _state.PendingDecisionId = id;
            _state.Waiting = true;
            _state.Pending = new Decision
            {
                Id = id,
                Actor = need.Actor,
                Type = need.Type,
                Ability = need.Ability,
                Options = need.Options
            };
        }

        private void FinishPlay(CardInstance card, int cell)
        {
            _held.Clear();
            _holding = true;
            ResolveImmediate(card, "enter");
            if (card.Zone == Zone.Board)
            {
                ApplyPollution(card, cell);
            }

            _holding = false;
            var watchers = new List<PendingAbility>();
            CollectPlayWatchers(card, cell, watchers);
            CollectAllyPlay(card, watchers);
            SortPending(watchers);
            AppendAll(_queue, watchers);
            AppendAll(_queue, _held);
            _held.Clear();
            DrainQueue();
            RefreshContinuous();
        }

        private void NoticeEnter(CardInstance card, bool immediate)
        {
            if (immediate)
            {
                ResolveImmediate(card, "enter");
                return;
            }

            var batch = new List<PendingAbility>();
            AddCardTrigger(batch, card, "enter", card.InstanceId, card.Cell, false, Points.Vital(card));
            CollectOtherEnter(batch, card);
            SortPending(batch);
            for (int i = 0; i < batch.Count; i++)
            {
                Enqueue(batch[i]);
            }
        }

        private void ResolveImmediate(CardInstance card, string trigger)
        {
            if (card.Suppressed)
            {
                return;
            }

            AbilityDefinition[] abilities = Effects(card);
            for (int i = 0; i < abilities.Length; i++)
            {
                if (abilities[i].Trigger != trigger)
                {
                    continue;
                }

                var item = new PendingAbility
                {
                    Instance = card.InstanceId,
                    AbilityIndex = i,
                    ContextInstance = card.InstanceId,
                    ContextCell = card.Cell,
                    CapturedPoints = Points.Vital(card)
                };
                ResolveAbility(card, abilities[i], item);
            }
        }

        private void EnqueueTrigger(string trigger, Side? turn, int contextInstance, int contextCell)
        {
            var batch = new List<PendingAbility>();
            Collect(batch, trigger, turn, contextInstance, contextCell, false, 0);
            SortPending(batch);
            for (int i = 0; i < batch.Count; i++)
            {
                Enqueue(batch[i]);
            }
        }

        private void EnqueueTurn(string trigger, Side side)
        {
            EnqueueTrigger(trigger, side, 0, 0);
        }

        private void ResolveTurnLayers(Side side)
        {
            EnqueueTurn("turn-start", side);
            DrainQueue();
            if (_state.Phase == MatchPhase.Finished)
            {
                return;
            }

            ClearSeals(side);
            TickCountdowns(side);
            DrainQueue();
            RefreshContinuous();
        }

        private void DrainQueue()
        {
            if (_draining)
            {
                return;
            }

            _draining = true;
            try
            {
                int guard = 0;
                while (_queue.Count > 0 && _state.Phase != MatchPhase.Finished)
                {
                    if (++guard > 1000)
                    {
                        throw new InvalidOperationException("结算队列没有结束。");
                    }

                    PendingAbility item = _queue[0];
                    _queue.RemoveAt(0);
                    ResolveQueued(item);
                }
            }
            finally
            {
                _draining = false;
            }
        }

        private void Enqueue(PendingAbility item)
        {
            if (_holding)
            {
                _held.Add(item);
            }
            else
            {
                _queue.Add(item);
            }
        }

        private void ResolveQueued(PendingAbility item)
        {
            if (item.LinkRemove)
            {
                CardInstance? linked = FindCard(item.ContextInstance);
                if (linked != null && linked.Zone == Zone.Board)
                {
                    RemoveFromBoard(linked, "link");
                }

                return;
            }

            if (item.Instance == 0)
            {
                if (item.AbilityId.Length == 0)
                {
                    return;
                }

                AbilityDefinition global = _catalog.RequireAbility(item.AbilityId);
                CardInstance? anchor = item.ContextInstance == 0 ? null : FindCard(item.ContextInstance);
                ResolveAbility(anchor, global, item);
                RefreshContinuous();
                return;
            }

            CardInstance? source = FindCard(item.Instance);
            if (source == null)
            {
                return;
            }

            if (item.Granted && (item.GrantIndex < 0 || item.GrantIndex >= source.Granted.Count))
            {
                return;
            }

            AbilityDefinition ability;
            if (item.Granted)
            {
                ability = _catalog.RequireAbility(source.Granted[item.GrantIndex].AbilityId);
            }
            else if (item.AbilityId.Length > 0)
            {
                ability = _catalog.RequireAbility(item.AbilityId);
            }
            else
            {
                AbilityDefinition[] effects = Effects(source);
                if (item.AbilityIndex < 0 || item.AbilityIndex >= effects.Length)
                {
                    return;
                }

                ability = effects[item.AbilityIndex];
            }
            if (ability.WhileOnBoard && source.Zone != Zone.Board && !item.Leave)
            {
                return;
            }

            if (source.Suppressed && !item.Leave)
            {
                return;
            }

            ResolveAbility(source, ability, item);
            RefreshContinuous();
        }

        private void ResolveAbility(CardInstance? source, AbilityDefinition ability, PendingAbility item)
        {
            if (ability.Script.Length > 0 && source != null)
            {
                if (!Prepare(source, ability, item, out CardInstance? single))
                {
                    return;
                }

                RunScript(ability.Script, source, single, item);
                return;
            }

            if (!Prepare(source, ability, item, out CardInstance? chosen))
            {
                return;
            }

            RunActions(source, ability.Actions, chosen, item);
        }

        private bool Prepare(CardInstance? source, AbilityDefinition ability, PendingAbility item, out CardInstance? chosen)
        {
            chosen = null;
            if (ability.Target == null)
            {
                if (!MirrorReady(source, ability) || !CanPay(source, ability.Cost))
                {
                    return false;
                }

                Pay(source, ability.Cost, item);
                return true;
            }

            List<CardInstance> candidates = Candidates(source, ability.Target);
            if (candidates.Count == 0 || !MirrorReady(source, ability))
            {
                return false;
            }

            if (!CanPay(source, ability.Cost))
            {
                return false;
            }

            if (ability.Target.Pick == "one")
            {
                string actor = Actor(source, item);
                Option[] options = CardOptions(candidates);
                string answer = Ask(actor, "choose-card", ability.Id, options);
                chosen = FindCard(ParseCardOption(answer));
                if (chosen == null)
                {
                    return false;
                }
            }
            else if (ability.Target.Pick == "random")
            {
                chosen = candidates[NextInt(candidates.Count)];
            }

            Pay(source, ability.Cost, item);
            if (ability.Target.Pick == "all")
            {
                for (int i = 0; i < candidates.Count; i++)
                {
                    RunActions(source, ability.Actions, candidates[i], item);
                }

                chosen = null;
                return false;
            }

            return true;
        }

        private void RunActions(CardInstance? source, ActionDefinition[] actions, CardInstance? chosen, PendingAbility item)
        {
            for (int i = 0; i < actions.Length; i++)
            {
                if (_state.Phase == MatchPhase.Finished)
                {
                    return;
                }

                RunAction(source, actions[i], chosen, item);
            }
        }

        private void RunAction(CardInstance? source, ActionDefinition action, CardInstance? chosen, PendingAbility item)
        {
            CardInstance? target = ActionTarget(source, action, chosen, item);
            switch (action.Kind)
            {
                case "add-status":
                    AddStatus(source, action, target, item);
                    break;
                case "clear-status":
                    if (target != null)
                    {
                        ClearStatus(target, action.Status, false);
                    }

                    break;
                case "change-points":
                    ChangePoints(source, action, target, item);
                    break;
                case "gain-resource":
                    int gained = action.From == "captured-points" ? item.CapturedPoints : action.Amount;
                    GainResource(OwnerOf(source, item), action.Resource, gained, action.Resource);
                    break;
                case "draw":
                    DrawSide(OwnerOf(source, item), action.Count == 0 ? 1 : action.Count);
                    break;
                case "copy":
                    CopyCard(source, action, chosen, item);
                    break;
                case "transform":
                    Transform(source, action, chosen);
                    break;
                case "grant":
                    if (target != null)
                    {
                        Grant(target, action.Ability);
                    }

                    break;
                case "shuffle-discard":
                    ShuffleDiscard(OwnerOf(source, item), action.Count == 0 ? 1 : action.Count);
                    break;
                case "pollute":
                    PolluteDistinct(action.Count == 0 ? 1 : action.Count);
                    break;
                case "seal-random":
                    SealRandom(source, item, action.Side);
                    break;
                case "tick-countdowns":
                    TickSide(OwnerOf(source, item), action.Amount == 0 ? 1 : action.Amount);
                    break;
                case "remove":
                    if (target != null && target.Zone == Zone.Board)
                    {
                        RemoveFromBoard(target, "effect");
                    }

                    break;
                case "branch-status":
                    if (target != null && Points.HasStatus(target, action.Status))
                    {
                        RunActions(source, action.Present, target, item);
                    }
                    else if (target != null)
                    {
                        RunActions(source, action.Absent, target, item);
                    }

                    break;
                case "look-top":
                    LookTop(OwnerOf(source, item), action.Count == 0 ? 3 : action.Count, item, action);
                    break;
                case "play-extra":
                    PlayExtra(OwnerOf(source, item), item);
                    break;
                case "special-settle":
                    ResolveSpecial();
                    break;
                case "script":
                    if (source != null)
                    {
                        RunScript(action.Script, source, chosen, item);
                    }

                    break;
                case "continuous-points":
                    break;
                case "take-hand":
                    TakeToHand(target);
                    break;
                case "reset-points":
                    if (target != null)
                    {
                        ResetToBase(target);
                    }

                    break;
                case "double-points":
                    if (target != null && target.Zone == Zone.Board)
                    {
                        int current = Points.Current(target);
                        if (current != 0)
                        {
                            AddModifier(target, "effect", current);
                        }
                    }

                    break;
                case "shuffle-self":
                    ShuffleSelf(source);
                    break;
                case "branch-deck":
                    BranchDeck(source, action, chosen, item);
                    break;
                case "branch-resource":
                    BranchResource(source, action, chosen, item);
                    break;
                case "branch-adjacent":
                    BranchAdjacent(source, action, chosen, item);
                    break;
                default:
                    throw new InvalidOperationException("未知动作 " + action.Kind + "。");
            }
        }

        private void RunScript(string name, CardInstance source, CardInstance? chosen, PendingAbility item)
        {
            if (name == "draw-one")
            {
                DrawSide(source.Owner, 1);
                return;
            }

            throw new InvalidOperationException("没有脚本能力 " + name + "。");
        }

        private CardInstance? ActionTarget(CardInstance? source, ActionDefinition action, CardInstance? chosen, PendingAbility item)
        {
            if (action.Target == "context")
            {
                return FindCard(item.ContextInstance);
            }

            if (action.Target == "adjacent-opponents")
            {
                return null;
            }

            if (action.Target == "self" || action.Target.Length == 0 && chosen == null)
            {
                return source;
            }

            if (action.Target.Length == 0)
            {
                return chosen;
            }

            return chosen ?? source;
        }

        private void AddStatus(CardInstance? source, ActionDefinition action, CardInstance? target, PendingAbility item)
        {
            if (action.Target == "adjacent-opponents" && source != null)
            {
                for (int cell = 1; cell <= 9; cell++)
                {
                    CardInstance? other = _state.Board[cell - 1];
                    if (other != null && other.Owner != source.Owner && Adjacent(source.Cell, cell))
                    {
                        GiveStatus(other, action.Status, source.Owner);
                    }
                }

                return;
            }

            if (target == null)
            {
                return;
            }

            if (target.Zone == Zone.Discard || target.Zone == Zone.Void || target.Zone == Zone.None)
            {
                return;
            }

            if (action.Kind == "add-status" && (action.Target == "self" || action.Target.Length == 0) && target.Zone != Zone.Board && !item.Leave)
            {
                return;
            }

            Side applier = source == null ? OwnerOf(source, item) : source.Owner;
            GiveStatus(target, action.Status, applier);
        }

        private void GiveStatus(CardInstance card, string status, Side applier)
        {
            StatusDefinition? definition = _catalog.FindStatus(status);
            bool stack = definition != null && definition.Stack;
            if (!stack && Points.HasStatus(card, status))
            {
                return;
            }

            card.Statuses.Add(new StatusMark
            {
                Id = status,
                Applier = applier,
                AppliedRound = _state.Round
            });
            Emit(new GameEvent
            {
                Type = "status-changed",
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(card.Owner),
                Source = status,
                Reason = "applied",
                Cell = card.Cell == 0 ? (int?)null : card.Cell
            });
            if (status == "status.seal" || (definition != null && definition.Suppresses))
            {
                int before = Points.Current(card);
                card.Suppressed = true;
                Emit(new GameEvent
                {
                    Type = EventTypes.PointsChanged,
                    Card = card.CardId,
                    Instance = card.InstanceId,
                    Owner = Names.SideName(card.Owner),
                    Source = status,
                    Before = before,
                    After = 0,
                    Points = 0
                });
            }

            RefreshContinuous();
        }

        private void ClearStatus(CardInstance card, string status, bool matchApplier)
        {
            for (int i = card.Statuses.Count - 1; i >= 0; i--)
            {
                if (card.Statuses[i].Id != status)
                {
                    continue;
                }

                card.Statuses.RemoveAt(i);
                Emit(new GameEvent
                {
                    Type = "status-changed",
                    Card = card.CardId,
                    Instance = card.InstanceId,
                    Owner = Names.SideName(card.Owner),
                    Source = status,
                    Reason = "cleared",
                    Cell = card.Cell == 0 ? (int?)null : card.Cell
                });
            }

            if (status == "status.seal" || (_catalog.FindStatus(status)?.Suppresses ?? false))
            {
                if (!HasSuppress(card))
                {
                    card.Suppressed = false;
                    card.Continuous = ComputeBonus(card);
                    int after = Points.Current(card);
                    Emit(new GameEvent
                    {
                        Type = EventTypes.PointsChanged,
                        Card = card.CardId,
                        Instance = card.InstanceId,
                        Owner = Names.SideName(card.Owner),
                        Source = status,
                        Before = 0,
                        After = after,
                        Points = after
                    });
                }
            }

            RefreshContinuous();
        }

        private static bool HasSuppress(CardInstance card)
        {
            for (int i = 0; i < card.Statuses.Count; i++)
            {
                if (card.Statuses[i].Id == "status.seal")
                {
                    return true;
                }
            }

            return false;
        }

        private void ChangePoints(CardInstance? source, ActionDefinition action, CardInstance? target, PendingAbility item)
        {
            if (target == null)
            {
                return;
            }

            if (target.Zone != Zone.Board && action.Target != "context")
            {
                return;
            }

            int amount = action.Amount;
            if (action.From == "discard-count" && source != null)
            {
                amount = DiscardCount(source.Owner, false) * (action.Amount == 0 ? 1 : action.Amount);
            }
            else if (action.From == "discard-units" && source != null)
            {
                amount = DiscardCount(source.Owner, true) * (action.Amount == 0 ? 1 : action.Amount);
            }
            else if (action.From == "spent")
            {
                amount = item.Spent * (action.Amount == 0 ? 1 : action.Amount);
            }
            else if (action.From == "captured-points")
            {
                amount = item.CapturedPoints;
            }

            if (amount == 0)
            {
                return;
            }

            AddModifier(target, action.Resource.Length > 0 ? action.Resource : "effect", amount);
        }

        private void GainResource(Side side, string resource, int amount, string source)
        {
            if (amount == 0 || resource.Length == 0)
            {
                return;
            }

            List<ResourceSlot> pool = _state.SideOf(side).Resources;
            ResourceSlot? slot = null;
            for (int i = 0; i < pool.Count; i++)
            {
                if (pool[i].Id == resource)
                {
                    slot = pool[i];
                    break;
                }
            }

            int before = slot == null ? 0 : slot.Amount;
            if (slot == null)
            {
                slot = new ResourceSlot { Id = resource, Amount = 0 };
                pool.Add(slot);
            }

            slot.Amount += amount;
            if (slot.Amount < 0)
            {
                slot.Amount = 0;
            }

            Emit(new GameEvent
            {
                Type = "resource-changed",
                Owner = Names.SideName(side),
                Source = source,
                Before = before,
                After = slot.Amount,
                Points = slot.Amount
            });
        }

        private bool CanPay(CardInstance? source, CostDefinition? cost)
        {
            if (cost == null)
            {
                return true;
            }

            Side side = source == null ? Side.Player : source.Owner;
            if (cost.Sacrifice > 0 && _state.SideOf(side).MatchDeck.Count < cost.Sacrifice)
            {
                return false;
            }

            if (cost.Resource.Length > 0 && cost.All && ResourceAmount(side, cost.Resource) <= 0)
            {
                return false;
            }

            if (cost.Resource.Length > 0 && !cost.All && ResourceAmount(side, cost.Resource) < cost.Amount)
            {
                return false;
            }

            return true;
        }

        private void Pay(CardInstance? source, CostDefinition? cost, PendingAbility item)
        {
            if (cost == null || source == null && cost.Sacrifice > 0)
            {
                if (cost == null)
                {
                    return;
                }
            }

            Side side = source == null ? Side.Player : source.Owner;
            if (cost.Sacrifice > 0)
            {
                Sacrifice(side, cost.Sacrifice);
            }

            if (cost.Resource.Length > 0 && cost.All)
            {
                int spent = ResourceAmount(side, cost.Resource);
                item.Spent = spent;
                if (spent > 0)
                {
                    GainResource(side, cost.Resource, -spent, cost.Resource);
                }

                return;
            }

            if (cost.Resource.Length > 0 && cost.Amount > 0)
            {
                GainResource(side, cost.Resource, -cost.Amount, cost.Resource);
            }
        }

        private void Sacrifice(Side side, int count)
        {
            List<CardInstance> deck = _state.SideOf(side).MatchDeck;
            var pool = new List<CardInstance>(deck);
            for (int n = 0; n < count && pool.Count > 0; n++)
            {
                int index = NextInt(pool.Count);
                CardInstance card = pool[index];
                pool.RemoveAt(index);
                RemoveFromZone(deck, card, "sacrifice");
            }
        }

        private void RemoveFromZone(List<CardInstance> zone, CardInstance card, string reason)
        {
            if (Points.HasStatus(card, "status.protect"))
            {
                ClearStatus(card, "status.protect", false);
                return;
            }

            zone.Remove(card);
            if (Points.HasStatus(card, "status.return"))
            {
                ClearStatus(card, "status.return", false);
                GiveHand(card, reason);
                return;
            }

            if (Exhausts(card))
            {
                SendToVoid(card, reason, null, Points.Current(card));
                return;
            }

            SendToDiscard(card, reason, null, Points.Current(card), EventTypes.CardRemoved);
        }

        private void Depart(CardInstance card, string reason, int cell, int points, bool cover)
        {
            if (!cover && Points.HasStatus(card, "status.protect"))
            {
                ClearStatus(card, "status.protect", false);
                card.Zone = Zone.Board;
                card.Cell = cell;
                _state.Board[cell - 1] = card;
                if (Points.Vital(card) == 0)
                {
                    RemoveFromBoard(card, "points-zero");
                }

                return;
            }

            int counterpart = card.Link;
            card.Link = 0;
            if (counterpart != 0)
            {
                CardInstance? other = FindCard(counterpart);
                if (other != null)
                {
                    other.Link = 0;
                }

                Enqueue(new PendingAbility
                {
                    LinkRemove = true,
                    ContextInstance = counterpart,
                    Rank = 1,
                    Cell = other == null ? 0 : other.Cell
                });
            }

            bool suppressed = card.Suppressed;
            if (Points.HasStatus(card, "status.return"))
            {
                ClearStatus(card, "status.return", false);
                GiveHand(card, reason);
            }
            else if (Exhausts(card))
            {
                SendToVoid(card, reason, cell, points);
            }
            else
            {
                SendToDiscard(card, reason, cell, points, EventTypes.CardRemoved);
            }

            if (!suppressed)
            {
                EnqueueCardLeaves(card, cell, points);
            }
        }

        private void GiveHand(CardInstance card, string reason)
        {
            SideState side = _state.SideOf(card.Owner);
            if (side.Hand.Count >= HandLimit)
            {
                SendToDiscard(card, reason, null, Points.Current(card), EventTypes.CardRemoved);
                return;
            }

            card.Zone = Zone.Hand;
            card.Cell = 0;
            side.Hand.Add(card);
            bool drawn = reason == "choose";
            Emit(new GameEvent
            {
                Type = drawn ? EventTypes.CardDrawn : EventTypes.CardRemoved,
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(card.Owner),
                Zone = Names.ZoneName(Zone.Hand),
                Reason = drawn ? null : reason,
                Points = Points.Current(card)
            });
        }

        private void SendToVoid(CardInstance card, string reason, int? cell, int points)
        {
            Reset(card);
            card.Zone = Zone.Void;
            card.Cell = 0;
            _state.SideOf(card.Owner).Void.Add(card);
            Emit(new GameEvent
            {
                Type = EventTypes.CardRemoved,
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(card.Owner),
                Cell = cell,
                Zone = Names.ZoneName(Zone.Void),
                Reason = reason,
                Points = points
            });
        }

        private void EnqueueCardLeaves(CardInstance card, int cell, int points)
        {
            var batch = new List<PendingAbility>();
            AddCardTrigger(batch, card, "leave", card.InstanceId, cell, true, points);
            if (!card.IsSpell)
            {
                for (int i = 1; i <= 9; i++)
                {
                    CardInstance? watcher = _state.Board[i - 1];
                    if (watcher == null || watcher.InstanceId == card.InstanceId)
                    {
                        continue;
                    }

                    AddCardTrigger(batch, watcher, "unit-leave", card.InstanceId, cell, false, points);
                }
            }

            SortPending(batch);
            for (int i = 0; i < batch.Count; i++)
            {
                Enqueue(batch[i]);
            }
        }

        private bool Exhausts(CardInstance card)
        {
            if (Points.HasStatus(card, "status.exhaust"))
            {
                return true;
            }

            AbilityDefinition[] abilities = Effects(card);
            for (int i = 0; i < abilities.Length; i++)
            {
                if (abilities[i].Exhaust)
                {
                    return true;
                }
            }

            return false;
        }

        private void CopyCard(CardInstance? source, ActionDefinition action, CardInstance? chosen, PendingAbility item)
        {
            CardInstance? origin = action.Of == "chosen" ? chosen : source;
            if (origin == null)
            {
                return;
            }

            if (action.To == "mirror")
            {
                if (origin.Zone != Zone.Board)
                {
                    return;
                }

                int mirror = Mirror(origin.Cell);
                if (mirror == origin.Cell || _state.Board[mirror - 1] != null)
                {
                    return;
                }

                CardInstance copy = Duplicate(origin);
                Enter(copy, mirror, "copy");
                if (action.Link && copy.Zone == Zone.Board)
                {
                    origin.Link = copy.InstanceId;
                    copy.Link = origin.InstanceId;
                }

                NoticeEnter(copy, false);
                return;
            }

            if (action.To == "deck")
            {
                CardInstance copy = Duplicate(origin);
                PlaceInDeck(copy, origin.Owner);
                return;
            }

            if (action.To == "empty")
            {
                var open = new List<int>();
                for (int cell = 1; cell <= 9; cell++)
                {
                    if (_state.Board[cell - 1] == null)
                    {
                        open.Add(cell);
                    }
                }

                if (open.Count == 0)
                {
                    return;
                }

                var options = new Option[open.Count];
                for (int i = 0; i < open.Count; i++)
                {
                    options[i] = new Option
                    {
                        Id = "cell:" + open[i].ToString(CultureInfo.InvariantCulture),
                        Kind = "cell",
                        Cell = open[i]
                    };
                }

                string answer = Ask(Actor(source, item), "choose-cell", action.Ability, options);
                int chosenCell = ParseInt(answer.Substring(5));
                if (chosenCell < 1 || chosenCell > 9 || _state.Board[chosenCell - 1] != null)
                {
                    return;
                }

                CardInstance created = Duplicate(origin);
                Enter(created, chosenCell, "copy");
                NoticeEnter(created, false);
            }
        }

        private CardInstance Duplicate(CardInstance origin)
        {
            CardInstance copy = origin.Clone();
            copy.InstanceId = _state.NextInstanceId++;
            copy.Zone = Zone.None;
            copy.Cell = 0;
            copy.Link = 0;
            copy.Activated = false;
            return copy;
        }

        private void PlaceInDeck(CardInstance card, Side owner)
        {
            List<CardInstance> deck = _state.SideOf(owner).MatchDeck;
            int index = deck.Count == 0 ? 0 : NextInt(deck.Count + 1);
            card.Zone = Zone.MatchDeck;
            card.Owner = owner;
            card.Cell = 0;
            deck.Insert(index, card);
            Emit(new GameEvent
            {
                Type = "card-moved",
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(owner),
                Zone = "deck",
                Reason = "shuffle",
                Index = index,
                Points = Points.Current(card)
            });
        }

        private void Transform(CardInstance? source, ActionDefinition action, CardInstance? chosen)
        {
            if (source == null || chosen == null || chosen.Zone != Zone.Board || action.Card.Length == 0)
            {
                return;
            }

            int cell = chosen.Cell;
            RemoveFromBoard(chosen, "transform");
            if (_state.Board[cell - 1] != null)
            {
                return;
            }

            CardInstance created = Create(action.Card, source.Owner);
            Enter(created, cell, "transform");
            NoticeEnter(created, false);
        }

        private void Grant(CardInstance target, string abilityId)
        {
            AbilityDefinition ability = _catalog.RequireAbility(abilityId);
            target.Granted.Add(new GrantedAbility
            {
                AbilityId = abilityId,
                TimerMax = ability.Countdown,
                Timer = ability.Countdown
            });
        }

        private void ShuffleDiscard(Side side, int count)
        {
            List<CardInstance> discard = _state.SideOf(side).Discard;
            int take = count < discard.Count ? count : discard.Count;
            for (int n = 0; n < take; n++)
            {
                int index = NextInt(discard.Count);
                CardInstance card = discard[index];
                discard.RemoveAt(index);
                card.Zone = Zone.None;
                PlaceInDeck(card, side);
            }
        }

        private void PolluteDistinct(int count)
        {
            var open = new List<int>();
            for (int cell = 1; cell <= 9; cell++)
            {
                open.Add(cell);
            }

            for (int n = 0; n < count && open.Count > 0; n++)
            {
                int index = NextInt(open.Count);
                int cell = open[index];
                open.RemoveAt(index);
                if (_state.Polluted[cell - 1])
                {
                    continue;
                }

                _state.Polluted[cell - 1] = true;
                Emit(new GameEvent
                {
                    Type = "cell-polluted",
                    Cell = cell,
                    Reason = "pollute"
                });
            }
        }

        private void SealRandom(CardInstance? source, PendingAbility item, string sideText)
        {
            Side victim = sideText == "ally"
                ? OwnerOf(source, item)
                : Opponent(OwnerOf(source, item));
            var cards = new List<CardInstance>();
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card != null && card.Owner == victim)
                {
                    cards.Add(card);
                }
            }

            if (cards.Count == 0)
            {
                return;
            }

            GiveStatus(cards[NextInt(cards.Count)], "status.seal", OwnerOf(source, item));
        }

        private void TickSide(Side side, int amount)
        {
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card != null && card.Owner == side)
                {
                    TickCard(card, amount);
                }
            }
        }

        private void TickCountdowns(Side side)
        {
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card != null && card.Owner == side)
                {
                    TickCard(card, 1);
                }
            }
        }

        private void TickCard(CardInstance card, int amount)
        {
            if (card.Suppressed || card.Zone != Zone.Board)
            {
                return;
            }

            if (card.TimerMax > 0)
            {
                card.Timer -= amount;
                if (card.Timer <= 0)
                {
                    card.Timer = card.TimerMax;
                    EnqueueCountdown(card, false, 0);
                }
            }

            for (int i = 0; i < card.Granted.Count; i++)
            {
                GrantedAbility granted = card.Granted[i];
                if (granted.TimerMax <= 0)
                {
                    continue;
                }

                granted.Timer -= amount;
                if (granted.Timer <= 0)
                {
                    granted.Timer = granted.TimerMax;
                    EnqueueCountdown(card, true, i);
                }
            }
        }

        private void EnqueueCountdown(CardInstance card, bool granted, int grantIndex)
        {
            AbilityDefinition[] abilities = Effects(card);
            if (!granted)
            {
                for (int i = 0; i < abilities.Length; i++)
                {
                    if (abilities[i].Trigger != "countdown")
                    {
                        continue;
                    }

                    Enqueue(new PendingAbility
                    {
                        Rank = 1,
                        Cell = card.Cell,
                        Instance = card.InstanceId,
                        AbilityIndex = i,
                        ContextInstance = card.InstanceId,
                        ContextCell = card.Cell
                    });
                }

                return;
            }

            Enqueue(new PendingAbility
            {
                Rank = 1,
                Cell = card.Cell,
                Instance = card.InstanceId,
                Granted = true,
                GrantIndex = grantIndex,
                AbilityId = card.Granted[grantIndex].AbilityId,
                ContextInstance = card.InstanceId,
                ContextCell = card.Cell
            });
        }

        private void LookTop(Side side, int count, PendingAbility item, ActionDefinition action)
        {
            List<CardInstance> deck = _state.SideOf(side).MatchDeck;
            int take = count < deck.Count ? count : deck.Count;
            if (take == 0)
            {
                return;
            }

            var shown = new List<CardInstance>();
            for (int i = 0; i < take; i++)
            {
                shown.Add(deck[i]);
            }

            string answer = Ask(Names.SideName(side), "choose-card", action.Ability, CardOptions(shown));
            int chosenId = ParseCardOption(answer);
            var rest = new List<CardInstance>();
            CardInstance? chosen = null;
            for (int i = 0; i < shown.Count; i++)
            {
                if (shown[i].InstanceId == chosenId)
                {
                    chosen = shown[i];
                }
                else
                {
                    rest.Add(shown[i]);
                }
            }

            if (chosen != null)
            {
                deck.Remove(chosen);
                GiveHand(chosen, "choose");
            }

            for (int i = 0; i < rest.Count; i++)
            {
                deck.Remove(rest[i]);
                SendToDiscard(rest[i], "choose", null, Points.Current(rest[i]), EventTypes.CardRemoved);
            }
        }

        private void PlayExtra(Side side, PendingAbility item)
        {
            if (side != Side.Player)
            {
                return;
            }

            Option[] options = PlayOptions(false);
            if (options.Length == 0)
            {
                return;
            }

            string answer = Ask("player", "play-card", "", options);
            if (answer.StartsWith("cast:", StringComparison.Ordinal))
            {
                ResolveSpell(TakeHand(ParseInt(answer.Substring(5))));
            }
            else
            {
                ParsePlay(answer, out int instance, out int cell);
                ResolveUnit(TakeHand(instance), cell);
            }
        }

        private Option[] PlayOptions(bool includeEnd)
        {
            var options = new List<Option>();
            var hand = new List<CardInstance>(_state.Player.Hand);
            hand.Sort(CompareInstance);
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

            if (includeEnd)
            {
                options.Add(new Option { Id = "end-turn", Kind = "end-turn" });
            }

            return options.ToArray();
        }

        private void DrawSide(Side side, int count)
        {
            for (int n = 0; n < count; n++)
            {
                List<CardInstance> deck = _state.SideOf(side).MatchDeck;
                if (deck.Count == 0)
                {
                    return;
                }

                CardInstance card = deck[0];
                deck.RemoveAt(0);
                if (_state.SideOf(side).Hand.Count >= HandLimit)
                {
                    SendToDiscard(card, "hand-full", null, Points.Current(card), EventTypes.CardDiscarded);
                    continue;
                }

                card.Zone = Zone.Hand;
                card.Cell = 0;
                _state.SideOf(side).Hand.Add(card);
                Emit(new GameEvent
                {
                    Type = EventTypes.CardDrawn,
                    Card = card.CardId,
                    Instance = card.InstanceId,
                    Owner = Names.SideName(side),
                    Zone = Names.ZoneName(Zone.Hand),
                    Points = Points.Current(card)
                });
            }
        }

        private void ClearSeals(Side side)
        {
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card == null)
                {
                    continue;
                }

                for (int i = card.Statuses.Count - 1; i >= 0; i--)
                {
                    StatusMark mark = card.Statuses[i];
                    if (mark.Id == "status.seal" && mark.Applier == side && mark.AppliedRound < _state.Round)
                    {
                        ClearStatus(card, "status.seal", false);
                        break;
                    }
                }
            }
        }

        private void Collect(List<PendingAbility> into, string trigger, Side? turn, int contextInstance, int contextCell, bool leave, int captured)
        {
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card != null)
                {
                    AddMatching(into, card, trigger, turn, contextInstance, contextCell, leave, captured);
                }
            }

            AddZone(into, _state.Player.Hand, trigger, turn, contextInstance, contextCell, leave, captured);
            AddZone(into, _state.Player.MatchDeck, trigger, turn, contextInstance, contextCell, leave, captured);
            AddZone(into, _state.Monster.Hand, trigger, turn, contextInstance, contextCell, leave, captured);
            AddZone(into, _state.Monster.MatchDeck, trigger, turn, contextInstance, contextCell, leave, captured);
            AddGlobals(into, trigger, turn, contextInstance, contextCell);
            AddCellInjections(into, trigger, turn, contextInstance, contextCell);
        }

        private void AddZone(List<PendingAbility> into, List<CardInstance> zone, string trigger, Side? turn, int contextInstance, int contextCell, bool leave, int captured)
        {
            for (int i = 0; i < zone.Count; i++)
            {
                AddMatching(into, zone[i], trigger, turn, contextInstance, contextCell, leave, captured);
            }
        }

        private void AddMatching(List<PendingAbility> into, CardInstance card, string trigger, Side? turn, int contextInstance, int contextCell, bool leave, int captured)
        {
            if (card.Suppressed && trigger != "leave")
            {
                return;
            }

            AbilityDefinition[] abilities = Effects(card);
            for (int i = 0; i < abilities.Length; i++)
            {
                AbilityDefinition ability = abilities[i];
                if (ability.Trigger != trigger || ability.Trigger == "countdown")
                {
                    continue;
                }

                if (turn.HasValue && ability.OwnerTurn && ability.Side.Length == 0 && card.Owner != turn.Value)
                {
                    continue;
                }

                if (ability.Side.Length > 0 && turn.HasValue && ability.Side != Names.SideName(turn.Value))
                {
                    continue;
                }

                AddCardTrigger(into, card, trigger, contextInstance, contextCell, leave, captured, i);
            }

            AddCardInjections(into, card, trigger, turn, contextInstance, contextCell, leave, captured);
            for (int i = 0; i < card.Granted.Count; i++)
            {
                AbilityDefinition ability = _catalog.RequireAbility(card.Granted[i].AbilityId);
                if (ability.Trigger != trigger || ability.Trigger == "countdown")
                {
                    continue;
                }

                into.Add(new PendingAbility
                {
                    Rank = RankOf(card),
                    Cell = card.Cell,
                    Instance = card.InstanceId,
                    Granted = true,
                    GrantIndex = i,
                    AbilityId = card.Granted[i].AbilityId,
                    ContextInstance = contextInstance,
                    ContextCell = contextCell,
                    CapturedPoints = captured,
                    Leave = leave
                });
            }
        }

        private void AddCardTrigger(List<PendingAbility> into, CardInstance card, string trigger, int contextInstance, int contextCell, bool leave, int captured)
        {
            if (card.Suppressed && trigger != "leave")
            {
                return;
            }

            AbilityDefinition[] abilities = Effects(card);
            for (int i = 0; i < abilities.Length; i++)
            {
                if (abilities[i].Trigger == trigger)
                {
                    AddCardTrigger(into, card, trigger, contextInstance, contextCell, leave, captured, i);
                }
            }
        }

        private void AddCardTrigger(List<PendingAbility> into, CardInstance card, string trigger, int contextInstance, int contextCell, bool leave, int captured, int index)
        {
            into.Add(new PendingAbility
            {
                Rank = RankOf(card),
                Cell = card.Zone == Zone.Board ? card.Cell : 0,
                Instance = card.InstanceId,
                AbilityIndex = index,
                ContextInstance = contextInstance == 0 ? card.InstanceId : contextInstance,
                ContextCell = contextCell == 0 ? card.Cell : contextCell,
                CapturedPoints = captured,
                Leave = leave
            });
        }

        private void AddGlobals(List<PendingAbility> into, string trigger, Side? turn, int contextInstance, int contextCell)
        {
            MonsterDefinition monster = _catalog.RequireMonster(_state.MonsterId);
            for (int i = 0; i < monster.Skills.Length; i++)
            {
                AbilityDefinition ability = _catalog.RequireAbility(monster.Skills[i]);
                if (!GlobalMatches(ability, trigger, turn))
                {
                    continue;
                }

                into.Add(new PendingAbility
                {
                    Rank = 0,
                    AbilityIndex = i,
                    AbilityId = ability.Id,
                    ContextInstance = contextInstance,
                    ContextCell = contextCell,
                    Host = ability.Side.Length > 0 ? ability.Side : "monster"
                });
            }

            for (int i = 0; i < _state.Injections.Count; i++)
            {
                AbilityInjection injection = _state.Injections[i];
                AbilityDefinition ability = _catalog.RequireAbility(injection.AbilityId);
                if (!GlobalMatches(ability, trigger, turn))
                {
                    continue;
                }

                if (injection.Host.StartsWith("card:", StringComparison.Ordinal) || injection.Host.StartsWith("cell:", StringComparison.Ordinal))
                {
                    continue;
                }

                into.Add(new PendingAbility
                {
                    Rank = 0,
                    AbilityId = ability.Id,
                    ContextInstance = contextInstance,
                    ContextCell = contextCell,
                    Host = injection.Host
                });
            }
        }

        private static bool GlobalMatches(AbilityDefinition ability, string trigger, Side? turn)
        {
            if (ability.Trigger != trigger)
            {
                return false;
            }

            if (ability.Side.Length > 0 && turn.HasValue && ability.Side != Names.SideName(turn.Value))
            {
                return false;
            }

            return true;
        }

        private void AddCardInjections(List<PendingAbility> into, CardInstance card, string trigger, Side? turn, int contextInstance, int contextCell, bool leave, int captured)
        {
            string host = "card:" + card.CardId;
            for (int i = 0; i < _state.Injections.Count; i++)
            {
                AbilityInjection injection = _state.Injections[i];
                if (injection.Host != host)
                {
                    continue;
                }

                AbilityDefinition ability = _catalog.RequireAbility(injection.AbilityId);
                if (!GlobalMatches(ability, trigger, turn))
                {
                    continue;
                }

                if (turn.HasValue && ability.OwnerTurn && ability.Side.Length == 0 && card.Owner != turn.Value)
                {
                    continue;
                }

                into.Add(new PendingAbility
                {
                    Rank = RankOf(card),
                    Cell = card.Zone == Zone.Board ? card.Cell : 0,
                    Instance = card.InstanceId,
                    AbilityId = ability.Id,
                    ContextInstance = contextInstance == 0 ? card.InstanceId : contextInstance,
                    ContextCell = contextCell,
                    CapturedPoints = captured,
                    Leave = leave
                });
            }
        }

        private void AddCellInjections(List<PendingAbility> into, string trigger, Side? turn, int contextInstance, int contextCell)
        {
            for (int i = 0; i < _state.Injections.Count; i++)
            {
                AbilityInjection injection = _state.Injections[i];
                if (!injection.Host.StartsWith("cell:", StringComparison.Ordinal))
                {
                    continue;
                }

                AbilityDefinition ability = _catalog.RequireAbility(injection.AbilityId);
                if (!GlobalMatches(ability, trigger, turn))
                {
                    continue;
                }

                int cell = ParseInt(injection.Host.Substring(5));
                into.Add(new PendingAbility
                {
                    Rank = 1,
                    Cell = cell,
                    AbilityId = ability.Id,
                    ContextInstance = contextInstance,
                    ContextCell = contextCell == 0 ? cell : contextCell,
                    Host = injection.Host
                });
            }
        }

        private void CollectPlayWatchers(CardInstance card, int cell, List<PendingAbility> into)
        {
            CollectOtherEnter(into, card);
            for (int i = 1; i <= 9; i++)
            {
                CardInstance? watcher = _state.Board[i - 1];
                if (watcher == null || watcher.InstanceId == card.InstanceId || watcher.Suppressed)
                {
                    continue;
                }

                if (watcher.Owner != card.Owner && Adjacent(watcher.Cell, cell))
                {
                    AddCardTrigger(into, watcher, "enemy-adjacent-play", card.InstanceId, cell, false, 0);
                }

                if (_state.Polluted[cell - 1])
                {
                    AddCardTrigger(into, watcher, "polluted-play", card.InstanceId, cell, false, 0);
                }
            }
        }

        private void CollectOtherEnter(List<PendingAbility> into, CardInstance card)
        {
            for (int i = 1; i <= 9; i++)
            {
                CardInstance? watcher = _state.Board[i - 1];
                if (watcher == null || watcher.InstanceId == card.InstanceId || watcher.Suppressed)
                {
                    continue;
                }

                AddCardTrigger(into, watcher, "other-enter", card.InstanceId, card.Cell, false, 0);
            }
        }

        private void EnqueueSpellWatchers(CardInstance card)
        {
            var batch = new List<PendingAbility>();
            for (int i = 1; i <= 9; i++)
            {
                CardInstance? watcher = _state.Board[i - 1];
                if (watcher == null || watcher.Suppressed || watcher.Owner == card.Owner)
                {
                    continue;
                }

                AddCardTrigger(batch, watcher, "enemy-spell", card.InstanceId, 0, false, 0);
            }

            CollectAllyPlay(card, batch);

            SortPending(batch);
            for (int i = 0; i < batch.Count; i++)
            {
                Enqueue(batch[i]);
            }
        }

        private static int RankOf(CardInstance card)
        {
            if (card.Zone == Zone.Board)
            {
                return 1;
            }

            return 2;
        }

        private static void SortPending(List<PendingAbility> items)
        {
            items.Sort(ComparePending);
        }

        private static int ComparePending(PendingAbility left, PendingAbility right)
        {
            int rank = left.Rank.CompareTo(right.Rank);
            if (rank != 0)
            {
                return rank;
            }

            int cell = left.Cell.CompareTo(right.Cell);
            if (cell != 0)
            {
                return cell;
            }

            int instance = left.Instance.CompareTo(right.Instance);
            if (instance != 0)
            {
                return instance;
            }

            return left.AbilityIndex.CompareTo(right.AbilityIndex);
        }

        private static void AppendAll(List<PendingAbility> target, List<PendingAbility> source)
        {
            for (int i = 0; i < source.Count; i++)
            {
                target.Add(source[i]);
            }
        }

        private List<CardInstance> Candidates(CardInstance? source, TargetDefinition target)
        {
            if (target.Zone == "discard")
            {
                var discarded = new List<CardInstance>();
                if (source != null && (target.Side == "ally" || target.Side == "any"))
                {
                    AddDiscardCandidates(discarded, _state.SideOf(source.Owner).Discard, source, target);
                }

                if (source != null && (target.Side == "opponent" || target.Side == "any"))
                {
                    Side other = source.Owner == Side.Player ? Side.Monster : Side.Player;
                    AddDiscardCandidates(discarded, _state.SideOf(other).Discard, source, target);
                }

                return discarded;
            }

            var list = new List<CardInstance>();
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card != null && Matches(source, card, target))
                {
                    list.Add(card);
                }
            }

            return list;
        }

        private bool Matches(CardInstance? source, CardInstance card, TargetDefinition target)
        {
            if (source != null && target.Side == "opponent" && card.Owner == source.Owner)
            {
                return false;
            }

            if (source != null && target.Side == "ally" && card.Owner != source.Owner)
            {
                return false;
            }

            if (target.Status.Length > 0 && !Points.HasStatus(card, target.Status))
            {
                return false;
            }

            if (target.Adjacent && target.Zone != "discard")
            {
                if (source == null || source.Zone != Zone.Board || !Adjacent(source.Cell, card.Cell))
                {
                    return false;
                }
            }

            if (!target.AllowSelf && source != null && card.InstanceId == source.InstanceId)
            {
                return false;
            }

            if (target.Kind == "unit" && card.IsSpell)
            {
                return false;
            }

            if (target.Kind == "spell" && !card.IsSpell)
            {
                return false;
            }

            return true;
        }

        private bool MirrorReady(CardInstance? source, AbilityDefinition ability)
        {
            for (int i = 0; i < ability.Actions.Length; i++)
            {
                ActionDefinition action = ability.Actions[i];
                if (action.Kind != "copy" || action.To != "mirror")
                {
                    continue;
                }

                if (source == null || source.Zone != Zone.Board)
                {
                    return false;
                }

                int mirror = Mirror(source.Cell);
                if (mirror == source.Cell || _state.Board[mirror - 1] != null)
                {
                    return false;
                }
            }

            return true;
        }

        private static bool Adjacent(int left, int right)
        {
            if (left < 1 || right < 1)
            {
                return false;
            }

            int leftRow = (left - 1) / 3;
            int leftCol = (left - 1) % 3;
            int rightRow = (right - 1) / 3;
            int rightCol = (right - 1) % 3;
            int row = leftRow - rightRow;
            int col = leftCol - rightCol;
            if (row < 0)
            {
                row = -row;
            }

            if (col < 0)
            {
                col = -col;
            }

            return row + col == 1;
        }

        private static int Mirror(int cell)
        {
            return 10 - cell;
        }

        private string Ask(string actor, string type, string ability, Option[] options)
        {
            if (_state.ResolutionCursor < _state.Answers.Count)
            {
                string answer = _state.Answers[_state.ResolutionCursor];
                _state.ResolutionCursor++;
                if (!OptionExists(options, answer))
                {
                    throw new ArgumentException("不是合法选项：" + answer);
                }

                return answer;
            }

            throw new NeedDecision(actor, type, ability, options);
        }

        private static bool OptionExists(Option[] options, string id)
        {
            for (int i = 0; i < options.Length; i++)
            {
                if (options[i].Id == id)
                {
                    return true;
                }
            }

            return false;
        }

        private static Option[] CardOptions(List<CardInstance> cards)
        {
            var options = new Option[cards.Count];
            for (int i = 0; i < cards.Count; i++)
            {
                options[i] = new Option
                {
                    Id = "card:" + cards[i].InstanceId.ToString(CultureInfo.InvariantCulture),
                    Kind = "card",
                    Instance = cards[i].InstanceId,
                    Cell = cards[i].Cell,
                    CardId = cards[i].CardId
                };
            }

            return options;
        }

        private static int ParseCardOption(string option)
        {
            if (!option.StartsWith("card:", StringComparison.Ordinal))
            {
                throw new ArgumentException("不是选牌选项：" + option);
            }

            return ParseInt(option.Substring(5));
        }

        private string Actor(CardInstance? source, PendingAbility item)
        {
            if (item.Host == "player" || item.Host == "monster")
            {
                return item.Host;
            }

            if (source == null)
            {
                return "player";
            }

            return Names.SideName(source.Owner);
        }

        private Side OwnerOf(CardInstance? source, PendingAbility item)
        {
            if (item.Host == "monster")
            {
                return Side.Monster;
            }

            if (item.Host == "player")
            {
                return Side.Player;
            }

            return source == null ? Side.Player : source.Owner;
        }

        private static Side Opponent(Side side)
        {
            return side == Side.Player ? Side.Monster : Side.Player;
        }

        private ViewPool[] PoolsOf()
        {
            var list = new List<ViewPool>();
            AppendPools(list, Side.Player);
            AppendPools(list, Side.Monster);
            return list.ToArray();
        }

        private void AppendPools(List<ViewPool> list, Side side)
        {
            List<ResourceSlot> pool = _state.SideOf(side).Resources;
            var ordered = new List<ResourceSlot>(pool);
            ordered.Sort(CompareResourceSlot);
            for (int i = 0; i < ordered.Count; i++)
            {
                list.Add(new ViewPool
                {
                    Owner = Names.SideName(side),
                    Id = ordered[i].Id,
                    Amount = ordered[i].Amount
                });
            }
        }

        private static int CompareResourceSlot(ResourceSlot left, ResourceSlot right)
        {
            return string.CompareOrdinal(left.Id, right.Id);
        }

        private int ResourceAmount(Side side, string id)
        {
            List<ResourceSlot> pool = _state.SideOf(side).Resources;
            for (int i = 0; i < pool.Count; i++)
            {
                if (pool[i].Id == id)
                {
                    return pool[i].Amount;
                }
            }

            return 0;
        }

        private CardInstance? FindCard(int instance)
        {
            if (instance == 0)
            {
                return null;
            }

            for (int i = 0; i < 9; i++)
            {
                if (_state.Board[i] != null && _state.Board[i]!.InstanceId == instance)
                {
                    return _state.Board[i];
                }
            }

            CardInstance? found = FindIn(_state.Player, instance);
            if (found != null)
            {
                return found;
            }

            return FindIn(_state.Monster, instance);
        }

        private static CardInstance? FindIn(SideState side, int instance)
        {
            CardInstance? found = FindInList(side.MatchDeck, instance);
            if (found != null)
            {
                return found;
            }

            found = FindInList(side.Hand, instance);
            if (found != null)
            {
                return found;
            }

            found = FindInList(side.Discard, instance);
            if (found != null)
            {
                return found;
            }

            return FindInList(side.Void, instance);
        }

        private static CardInstance? FindInList(List<CardInstance> cards, int instance)
        {
            for (int i = 0; i < cards.Count; i++)
            {
                if (cards[i].InstanceId == instance)
                {
                    return cards[i];
                }
            }

            return null;
        }

        private AbilityDefinition[] Effects(CardInstance card)
        {
            AbilityDefinition[] own = _catalog.RequireCard(card.CardId).Abilities;
            if (card.CardBackId == null || card.CardBackId.Length == 0)
            {
                return own;
            }

            BackDefinition? back = _catalog.FindBack(card.CardBackId);
            if (back == null || back.Abilities.Length == 0)
            {
                return own;
            }

            var all = new AbilityDefinition[own.Length + back.Abilities.Length];
            for (int i = 0; i < own.Length; i++)
            {
                all[i] = own[i];
            }

            for (int i = 0; i < back.Abilities.Length; i++)
            {
                all[own.Length + i] = back.Abilities[i];
            }

            return all;
        }

        private void AddDiscardCandidates(List<CardInstance> into, List<CardInstance> zone, CardInstance source, TargetDefinition target)
        {
            for (int i = 0; i < zone.Count; i++)
            {
                if (Matches(source, zone[i], target))
                {
                    into.Add(zone[i]);
                }
            }
        }

        private int DiscardCount(Side side, bool unitsOnly)
        {
            List<CardInstance> discard = _state.SideOf(side).Discard;
            if (!unitsOnly)
            {
                return discard.Count;
            }

            int count = 0;
            for (int i = 0; i < discard.Count; i++)
            {
                if (!discard[i].IsSpell)
                {
                    count++;
                }
            }

            return count;
        }

        private void TakeToHand(CardInstance? card)
        {
            if (card == null || card.Zone != Zone.Discard)
            {
                return;
            }

            _state.SideOf(card.Owner).Discard.Remove(card);
            GiveHand(card, "recover");
        }

        private void ResetToBase(CardInstance card)
        {
            if (card.Zone != Zone.Board || card.Modifiers.Count == 0)
            {
                return;
            }

            int before = Points.Current(card);
            card.Modifiers.Clear();
            int after = Points.Current(card);
            if (before == after)
            {
                return;
            }

            Emit(new GameEvent
            {
                Type = EventTypes.PointsChanged,
                Card = card.CardId,
                Instance = card.InstanceId,
                Owner = Names.SideName(card.Owner),
                Source = "effect",
                Before = before,
                After = after,
                Points = after
            });
            if (Points.Vital(card) == 0)
            {
                RemoveFromBoard(card, "points-zero");
            }
        }

        private void ShuffleSelf(CardInstance? card)
        {
            if (card == null || card.Zone != Zone.Discard)
            {
                return;
            }

            if (!_state.SideOf(card.Owner).Discard.Remove(card))
            {
                return;
            }

            card.Zone = Zone.None;
            PlaceInDeck(card, card.Owner);
        }

        private void BranchDeck(CardInstance? source, ActionDefinition action, CardInstance? chosen, PendingAbility item)
        {
            if (source == null)
            {
                return;
            }

            int count = _state.SideOf(source.Owner).MatchDeck.Count;
            RunActions(source, count <= action.Count ? action.Present : action.Absent, chosen, item);
        }

        private void BranchResource(CardInstance? source, ActionDefinition action, CardInstance? chosen, PendingAbility item)
        {
            Side side = source == null ? Side.Player : source.Owner;
            int have = ResourceAmount(side, action.Resource);
            RunActions(source, have >= action.Count ? action.Present : action.Absent, chosen, item);
        }

        private void BranchAdjacent(CardInstance? source, ActionDefinition action, CardInstance? chosen, PendingAbility item)
        {
            bool found = false;
            if (source != null && source.Zone == Zone.Board)
            {
                for (int cell = 1; cell <= 9; cell++)
                {
                    CardInstance? other = _state.Board[cell - 1];
                    if (other != null && other.Owner != source.Owner && Adjacent(source.Cell, cell))
                    {
                        found = true;
                        break;
                    }
                }
            }

            RunActions(source, found ? action.Present : action.Absent, chosen, item);
        }

        private void CollectAllyPlay(CardInstance played, List<PendingAbility> into)
        {
            for (int i = 1; i <= 9; i++)
            {
                CardInstance? watcher = _state.Board[i - 1];
                if (watcher == null || watcher.InstanceId == played.InstanceId || watcher.Owner != played.Owner)
                {
                    continue;
                }

                AddCardTrigger(into, watcher, "ally-play", played.InstanceId, played.Cell, false, 0);
            }
        }

        private bool Absorbs(CardInstance card)
        {
            AbilityDefinition[] abilities = Effects(card);
            for (int i = 0; i < abilities.Length; i++)
            {
                if (abilities[i].Absorb)
                {
                    return true;
                }
            }

            return false;
        }

        private bool IsSwift(CardInstance card)
        {
            return HasFlag(card, true, false, false);
        }

        private bool IsCoverAlly(CardInstance card)
        {
            return HasFlag(card, false, false, true);
        }

        private bool HasFlag(CardInstance card, bool swift, bool exhaust, bool coverAlly)
        {
            AbilityDefinition[] abilities = Effects(card);
            for (int i = 0; i < abilities.Length; i++)
            {
                if (swift && abilities[i].Swift)
                {
                    return true;
                }

                if (exhaust && abilities[i].Exhaust)
                {
                    return true;
                }

                if (coverAlly && abilities[i].CoverAlly)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool ReadsCoverAlly(CardDefinition def)
        {
            for (int i = 0; i < def.Abilities.Length; i++)
            {
                if (def.Abilities[i].CoverAlly)
                {
                    return true;
                }
            }

            return false;
        }

        private void AppendActivated(List<Option> options)
        {
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card == null || card.Owner != Side.Player || card.Activated || card.Suppressed)
                {
                    continue;
                }

                AbilityDefinition[] abilities = Effects(card);
                for (int i = 0; i < abilities.Length; i++)
                {
                    if (abilities[i].Trigger != "activated")
                    {
                        continue;
                    }

                    options.Add(new Option
                    {
                        Id = "activate:" + card.InstanceId.ToString(CultureInfo.InvariantCulture),
                        Kind = "activate",
                        Instance = card.InstanceId,
                        Cell = cell,
                        CardId = card.CardId
                    });
                    break;
                }
            }
        }

        private void ResolveActivated(int instance)
        {
            CardInstance? card = FindCard(instance);
            if (card == null || card.Zone != Zone.Board || card.Activated)
            {
                throw new ArgumentException("不能主动触发这张卡。");
            }

            card.Activated = true;
            AbilityDefinition[] abilities = Effects(card);
            for (int i = 0; i < abilities.Length; i++)
            {
                if (abilities[i].Trigger != "activated")
                {
                    continue;
                }

                ResolveAbility(card, abilities[i], new PendingAbility
                {
                    Instance = card.InstanceId,
                    AbilityIndex = i,
                    ContextInstance = card.InstanceId,
                    ContextCell = card.Cell
                });
            }

            DrainQueue();
        }

        private static string[] StatusIds(CardInstance card)
        {
            var ids = new string[card.Statuses.Count];
            for (int i = 0; i < card.Statuses.Count; i++)
            {
                ids[i] = card.Statuses[i].Id;
            }

            return ids;
        }

        private void RefreshContinuous()
        {
            for (int pass = 0; pass < 9; pass++)
            {
                if (!ApplyContinuous())
                {
                    return;
                }
            }
        }

        private bool ApplyContinuous()
        {
            bool changed = false;
            var doomed = new List<CardInstance>();
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card == null || card.Suppressed)
                {
                    continue;
                }

                int bonus = ComputeBonus(card);
                if (bonus == card.Continuous)
                {
                    continue;
                }

                int before = Points.Current(card);
                card.Continuous = bonus;
                int after = Points.Current(card);
                changed = true;
                if (before != after)
                {
                    Emit(new GameEvent
                    {
                        Type = EventTypes.PointsChanged,
                        Card = card.CardId,
                        Instance = card.InstanceId,
                        Owner = Names.SideName(card.Owner),
                        Source = "continuous",
                        Before = before,
                        After = after,
                        Points = after
                    });
                }

                if (Points.Vital(card) == 0)
                {
                    doomed.Add(card);
                }
            }

            for (int i = 0; i < doomed.Count; i++)
            {
                if (doomed[i].Zone == Zone.Board)
                {
                    RemoveFromBoard(doomed[i], "points-zero");
                    changed = true;
                }
            }

            return changed && doomed.Count > 0;
        }

        private int ComputeBonus(CardInstance card)
        {
            if (card.Suppressed)
            {
                return 0;
            }

            int bonus = 0;
            AbilityDefinition[] abilities = Effects(card);
            for (int i = 0; i < abilities.Length; i++)
            {
                if (abilities[i].Trigger != "continuous")
                {
                    continue;
                }

                for (int a = 0; a < abilities[i].Actions.Length; a++)
                {
                    ActionDefinition action = abilities[i].Actions[a];
                    if (action.Kind != "continuous-points")
                    {
                        continue;
                    }

                    bonus += action.Amount * CountStatus(action.EachStatus);
                }
            }

            return bonus;
        }

        private int CountStatus(string status)
        {
            int count = 0;
            for (int cell = 1; cell <= 9; cell++)
            {
                CardInstance? card = _state.Board[cell - 1];
                if (card != null && Points.HasStatus(card, status))
                {
                    count++;
                }
            }

            return count;
        }
    }
}
