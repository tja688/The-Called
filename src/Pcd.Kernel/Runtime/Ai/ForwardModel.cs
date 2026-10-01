using System;

namespace Pcd.Kernel
{
    public sealed class ForwardModel
    {
        private readonly MatchSession _session;

        private ForwardModel(MatchSession session)
        {
            _session = session;
        }

        public MatchView View
        {
            get { return _session.View("omniscient"); }
        }

        public Decision? Pending
        {
            get { return _session.Advance().Pending; }
        }

        public MatchResult? Result
        {
            get { return _session.Advance().Result; }
        }

        public static ForwardModel Open(MatchSession session, string level, ulong seed)
        {
            if (session == null)
            {
                throw new ArgumentNullException(nameof(session));
            }

            return new ForwardModel(session.Resample(level, seed));
        }

        public ForwardModel Try(string optionId)
        {
            if (optionId == null)
            {
                throw new ArgumentNullException(nameof(optionId));
            }

            MatchSession copy = _session.Copy();
            copy.SubmitAndAdvance(optionId);
            return new ForwardModel(copy);
        }
    }
}
