using System;
using System.Collections.Generic;

namespace Pcd.Kernel
{
    public sealed class MatchSession
    {
        private readonly ContentCatalog _catalog;
        private readonly MatchState _state;
        private readonly MatchRules _rules;
        private int _captureSeq = -1;
        private string? _captured;

        private MatchSession(ContentCatalog catalog, MatchState state)
        {
            _catalog = catalog;
            _state = state;
            _rules = new MatchRules(catalog, state);
            _rules.AfterEvent = OnEvent;
            _rules.OnAbort = kept =>
            {
                if (_captureSeq > kept)
                {
                    _captured = null;
                }
            };
        }

        public ContentCatalog Catalog
        {
            get { return _catalog; }
        }

        public string? CapturedSnapshot
        {
            get { return _captured; }
        }

        public static MatchSession Start(ContentCatalog catalog, MatchSetup setup)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            if (setup == null)
            {
                throw new ArgumentNullException(nameof(setup));
            }

            return new MatchSession(catalog, MatchState.CreateFresh(catalog, setup));
        }

        public static MatchSession FromPosition(ContentCatalog catalog, MatchPosition position)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            if (position == null)
            {
                throw new ArgumentNullException(nameof(position));
            }

            return new MatchSession(catalog, MatchState.CreatePosition(catalog, position));
        }

        public static MatchSession FromSnapshot(string json, ContentCatalog catalog)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            MatchState state = SnapshotCodec.Read(json, catalog);
            var session = new MatchSession(catalog, state);
            if (state.Waiting)
            {
                session._rules.RebuildPending();
            }

            return session;
        }

        public static MatchSession PlayReplay(string json, ContentCatalog catalog)
        {
            return PlayReplay(json, catalog, -1);
        }

        public static MatchSession PlayReplay(string json, ContentCatalog catalog, int captureEvent)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            JsonValue root = JsonReader.Parse(json);
            int protocol = root.Require("protocol").Int();
            if (protocol != RuleProtocol.Version)
            {
                throw new InvalidOperationException("协议版本不符：录像是 " + protocol + "，当前是 " + RuleProtocol.Version + "。");
            }

            string kernel = root.Require("kernel").String();
            if (kernel != KernelVersion.Text)
            {
                throw new InvalidOperationException("内核版本不符：录像是 " + kernel + "，当前是 " + KernelVersion.Text + "。");
            }

            string content = root.Require("content").String();
            if (content != catalog.Hash)
            {
                throw new InvalidOperationException("内容哈希不符：录像是 " + content + "，当前是 " + catalog.Hash + "。");
            }

            JsonValue? opportunities = root.Find("opportunities");
            JsonValue? backs = root.Find("buildBacks");
            var setup = new MatchSetup
            {
                Seed = root.Require("seed").ULong(),
                MonsterId = root.Require("monster").String(),
                BuildDeck = ReadBuildDeck(root.Require("buildDeck")),
                BuildBacks = backs == null || backs.IsNull ? null : ReadBuildDeck(backs),
                OpportunitiesPerTurn = opportunities == null || opportunities.IsNull ? 1 : opportunities.Int()
            };
            MatchSession session = Start(catalog, setup);
            if (captureEvent == 0)
            {
                session._captured = session.ToSnapshot();
            }
            else if (captureEvent > 0)
            {
                session.CaptureSnapshotAt(captureEvent);
            }

            session.Advance();
            JsonValue decisions = root.Require("decisions");
            if (!decisions.IsArray || decisions.Array == null)
            {
                throw new FormatException("录像的决策必须是数组。");
            }

            for (int i = 0; i < decisions.Array.Count; i++)
            {
                if (session._state.Phase == MatchPhase.Finished)
                {
                    throw new InvalidOperationException("录像里的决策比对局更长。");
                }

                if (!session._state.Waiting)
                {
                    throw new InvalidOperationException("录像要回答决策时，对局并没有停下来。");
                }

                session.SubmitAndAdvance(decisions.Array[i].String());
            }

            return session;
        }

        public AdvanceResult Advance()
        {
            if (_state.Phase == MatchPhase.Finished)
            {
                return Pack(_state.Events.Count);
            }

            if (_state.Waiting)
            {
                return Pack(_state.Events.Count);
            }

            int start = _state.Events.Count;
            _rules.Run();
            return Pack(start);
        }

        public AdvanceResult SubmitAndAdvance(string optionId)
        {
            int start = _state.Events.Count;
            _rules.Submit(optionId);
            _rules.Run();
            return Pack(start);
        }

        public AdvanceResult SpecialSettlement()
        {
            int start = _state.Events.Count;
            _rules.SpecialSettlement();
            return Pack(start);
        }

        public MatchSession Copy()
        {
            var copy = new MatchSession(_catalog, _state.Clone());
            if (copy._state.Waiting)
            {
                copy._rules.RebuildPending();
            }

            return copy;
        }

        public MatchView View(string audience)
        {
            return _rules.BuildView(audience);
        }

        internal MatchSession Resample(string level, ulong seed)
        {
            MatchState state = _state.Clone();
            HiddenSampler.Apply(state, level, seed);
            var copy = new MatchSession(_catalog, state);
            if (copy._state.Waiting)
            {
                copy._rules.RebuildPending();
            }

            return copy;
        }

        public bool HasSetup
        {
            get { return _state.HasSetup; }
        }

        public string EventHash()
        {
            return Hashing.Sha256Hex(EventCodec.Canonical(_state.Events));
        }

        public string ToSnapshot()
        {
            return SnapshotCodec.Write(_state, _catalog.Hash);
        }

        public void CaptureSnapshotAt(int eventSeq)
        {
            _captureSeq = eventSeq;
            _captured = null;
        }

        public string ToEventLog()
        {
            return EventCodec.Canonical(_state.Events);
        }

        public string ToReplay()
        {
            if (!_state.HasSetup)
            {
                throw new InvalidOperationException("这场对局不是从对局配置开始的，不能导出录像。");
            }

            var writer = new JsonWriter();
            writer.BeginObject();
            writer.Name("protocol");
            writer.Value(RuleProtocol.Version);
            writer.Name("kernel");
            writer.Value(KernelVersion.Text);
            writer.Name("content");
            writer.Value(_catalog.Hash);
            writer.Name("seed");
            writer.Value(_state.SetupSeed);
            writer.Name("monster");
            writer.Value(_state.SetupMonsterId);
            writer.Name("buildDeck");
            writer.BeginArray();
            for (int i = 0; i < _state.BuildDeck.Count; i++)
            {
                writer.Value(_state.BuildDeck[i]);
            }

            writer.EndArray();
            if (_state.BuildBacks.Count == _state.BuildDeck.Count)
            {
                writer.Name("buildBacks");
                writer.BeginArray();
                for (int i = 0; i < _state.BuildBacks.Count; i++)
                {
                    writer.Value(_state.BuildBacks[i]);
                }

                writer.EndArray();
            }

            writer.Name("opportunities");
            writer.Value(_state.OpportunitiesPerTurn);
            writer.Name("decisions");
            writer.BeginArray();
            for (int i = 0; i < _state.Answers.Count; i++)
            {
                writer.Value(_state.Answers[i]);
            }

            writer.EndArray();
            writer.EndObject();
            return writer.ToString();
        }

        public IReadOnlyList<GameEvent> Events
        {
            get { return _state.Events; }
        }

        private AdvanceResult Pack(int start)
        {
            int count = _state.Events.Count - start;
            var events = new GameEvent[count];
            for (int i = 0; i < count; i++)
            {
                events[i] = _state.Events[start + i];
            }

            if (_state.Phase == MatchPhase.Finished)
            {
                MatchView view = View("omniscient");
                return new AdvanceResult
                {
                    Events = events,
                    Result = new MatchResult
                    {
                        Winner = _state.Winner ?? "",
                        Reason = _state.EndReason ?? "",
                        Rounds = _state.Round,
                        PlayerPoints = view.PlayerPoints,
                        MonsterPoints = view.MonsterPoints,
                        PlayerOccupancy = view.PlayerOccupancy,
                        MonsterOccupancy = view.MonsterOccupancy
                    }
                };
            }

            if (_state.Waiting && _state.Pending != null)
            {
                return new AdvanceResult
                {
                    Events = events,
                    Pending = _state.Pending
                };
            }

            throw new InvalidOperationException("推进停在没有决策的阶段。");
        }

        private void OnEvent(int seq)
        {
            if (seq == _captureSeq)
            {
                _captured = ToSnapshot();
            }
        }

        private static string[] ReadBuildDeck(JsonValue node)
        {
            if (!node.IsArray || node.Array == null)
            {
                throw new FormatException("录像的构建牌组必须是数组。");
            }

            var deck = new string[node.Array.Count];
            for (int i = 0; i < node.Array.Count; i++)
            {
                deck[i] = node.Array[i].String();
            }

            return deck;
        }
    }
}
