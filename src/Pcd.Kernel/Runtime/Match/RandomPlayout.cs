using System;

namespace Pcd.Kernel
{
    public sealed class PlayoutStep
    {
        public MatchView? View { get; internal set; }
        public Decision? Pending { get; internal set; }
        public string? Choice { get; internal set; }
        public GameEvent[] Events { get; internal set; } = Array.Empty<GameEvent>();
    }

    public sealed class PlayoutResult
    {
        public string Winner { get; set; } = "";
        public string Reason { get; set; } = "";
        public int Rounds { get; set; }
        public int Decisions { get; set; }
        public string Hash { get; set; } = "";
        public string ReplayJson { get; set; } = "";
        public MatchSession? Session { get; set; }
    }

    public sealed class RandomDecider
    {
        private readonly DeterministicRng _rng;

        public RandomDecider(DeterministicRng rng)
        {
            if (rng == null)
            {
                throw new ArgumentNullException(nameof(rng));
            }

            _rng = rng;
        }

        public string Choose(Decision decision)
        {
            if (decision == null)
            {
                throw new ArgumentNullException(nameof(decision));
            }

            if (decision.Options.Length == 0)
            {
                throw new InvalidOperationException("没有合法选项。");
            }

            int index = _rng.NextInt(decision.Options.Length);
            return decision.Options[index].Id;
        }
    }

    public static class RandomPlayout
    {
        public static PlayoutResult Play(ContentCatalog catalog, MatchSetup setup, int maxDecisions, Action<PlayoutStep>? onStep)
        {
            if (maxDecisions < 1)
            {
                throw new ArgumentOutOfRangeException(nameof(maxDecisions));
            }

            MatchSession session = MatchSession.Start(catalog, setup);
            var bot = new RandomDecider(new DeterministicRng(setup.Seed));
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

                string choice = bot.Choose(step.Pending);
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
                ReplayJson = session.ToReplay(),
                Session = session
            };
        }
    }
}
