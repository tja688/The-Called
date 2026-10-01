using System;

namespace Pcd.Kernel
{
    public static class AiPlayout
    {
        public static PlayoutResult Play(ContentCatalog catalog, MatchSetup setup, int maxDecisions, Action<PlayoutStep>? onStep)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            if (setup == null)
            {
                throw new ArgumentNullException(nameof(setup));
            }

            Personality personality = catalog.RequireMonster(setup.MonsterId).Personality.Copy();
            if (setup.Information.Length > 0)
            {
                personality.Information = InformationLevels.Normalize(setup.Information);
            }

            return Continue(MatchSession.Start(catalog, setup), personality, setup.Seed, maxDecisions, onStep);
        }

        public static PlayoutResult Continue(MatchSession session, Personality personality, ulong seed, int maxDecisions, Action<PlayoutStep>? onStep)
        {
            if (session == null)
            {
                throw new ArgumentNullException(nameof(session));
            }

            if (personality == null)
            {
                throw new ArgumentNullException(nameof(personality));
            }

            if (maxDecisions < 1)
            {
                throw new ArgumentOutOfRangeException(nameof(maxDecisions));
            }

            AdvanceResult step = session.Advance();
            int decisions = 0;
            while (step.Result == null)
            {
                if (step.Pending == null)
                {
                    throw new InvalidOperationException("对局停在没有决策的地方。");
                }

                if (decisions >= maxDecisions)
                {
                    if (onStep != null)
                    {
                        onStep(new PlayoutStep
                        {
                            View = session.View("omniscient"),
                            Pending = step.Pending,
                            Events = step.Events
                        });
                    }

                    return Finish(session, "unfinished", "max-decisions", decisions);
                }

                string choice = step.Pending.Actor == "monster"
                    ? MonsterAi.Choose(session, step.Pending, personality, DecisionSeed.Mix(seed, 0, step.Pending.Id)).Choice
                    : GreedyBot.Choose(session, step.Pending, DecisionSeed.Mix(seed, 1, step.Pending.Id));
                if (onStep != null)
                {
                    onStep(new PlayoutStep
                    {
                        View = session.View("omniscient"),
                        Pending = step.Pending,
                        Choice = choice,
                        Events = step.Events
                    });
                }

                decisions++;
                step = session.SubmitAndAdvance(choice);
            }

            if (onStep != null)
            {
                onStep(new PlayoutStep
                {
                    View = session.View("omniscient"),
                    Events = step.Events
                });
            }

            string winner = step.Result == null ? "unfinished" : step.Result.Winner;
            string reason = step.Result == null ? "max-decisions" : step.Result.Reason;
            return Finish(session, winner, reason, decisions);
        }

        private static PlayoutResult Finish(MatchSession session, string winner, string reason, int decisions)
        {
            MatchView view = session.View("omniscient");
            return new PlayoutResult
            {
                Winner = winner,
                Reason = reason,
                Rounds = view.Round,
                Decisions = decisions,
                Hash = session.EventHash(),
                ReplayJson = session.HasSetup ? session.ToReplay() : "null",
                Session = session
            };
        }
    }
}
