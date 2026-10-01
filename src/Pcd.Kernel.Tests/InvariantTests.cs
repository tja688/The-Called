using System.Collections.Generic;
using NUnit.Framework;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class InvariantTests
    {
        [Test]
        public void Random_matches_keep_the_blank_card_invariants()
        {
            const int games = 10000;
            const int maxDecisions = 300;
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            int unfinished = 0;
            for (int i = 0; i < games; i++)
            {
                var setup = new MatchSetup
                {
                    Seed = (ulong)(i + 1),
                    MonsterId = catalog.DefaultMonster!,
                    BuildDeck = catalog.DefaultDeck
                };
                MatchSession session = MatchSession.Start(catalog, setup);
                var bot = new RandomDecider(new DeterministicRng(setup.Seed));
                AdvanceResult step = session.Advance();
                Check(step, session.View("omniscient"));
                int decisions = 0;
                while (step.Result == null)
                {
                    if (decisions >= maxDecisions)
                    {
                        unfinished++;
                        break;
                    }

                    step = session.SubmitAndAdvance(bot.Choose(step.Pending!));
                    decisions++;
                    Check(step, session.View("omniscient"));
                }
            }

            Assert.That(unfinished, Is.EqualTo(0));
        }

        [Test]
        public void Random_matches_keep_the_starter_invariants()
        {
            const int games = 1000;
            const int maxDecisions = 300;
            ContentCatalog catalog = RepoCatalog.LoadRules();
            int unfinished = 0;
            for (int i = 0; i < games; i++)
            {
                var setup = new MatchSetup
                {
                    Seed = (ulong)(i + 1),
                    MonsterId = catalog.Monsters[i % catalog.Monsters.Length].Id,
                    BuildDeck = catalog.Decks[i % catalog.Decks.Length].Cards
                };
                MatchSession session = MatchSession.Start(catalog, setup);
                var bot = new RandomDecider(new DeterministicRng(setup.Seed));
                AdvanceResult step = session.Advance();
                Check(step, session.View("omniscient"));
                int decisions = 0;
                while (step.Result == null)
                {
                    if (decisions >= maxDecisions)
                    {
                        unfinished++;
                        break;
                    }

                    step = session.SubmitAndAdvance(bot.Choose(step.Pending!));
                    decisions++;
                    Check(step, session.View("omniscient"));
                }
            }

            Assert.That(unfinished, Is.EqualTo(0));
        }

        private static void Check(AdvanceResult step, MatchView view)
        {
            if (step.Result == null)
            {
                Assert.That(step.Pending, Is.Not.Null);
                Assert.That(step.Pending!.Options.Length, Is.GreaterThan(0));
            }
            else
            {
                Assert.That(step.Pending, Is.Null);
            }

            int boardPlayer = 0;
            int boardMonster = 0;
            int playerCells = 0;
            int monsterCells = 0;
            var cellIds = new HashSet<int>();
            for (int i = 0; i < view.Cells.Length; i++)
            {
                ViewCard? card = view.Cells[i].Card;
                if (card == null)
                {
                    continue;
                }

                Assert.That(card.CurrentPoints, Is.GreaterThanOrEqualTo(0));
                Assert.That(cellIds.Add(card.Instance), Is.True);
                if (card.Owner == "player")
                {
                    boardPlayer += card.CurrentPoints;
                    playerCells++;
                }
                else if (card.Owner == "monster")
                {
                    boardMonster += card.CurrentPoints;
                    monsterCells++;
                }
            }

            Assert.That(view.Cells.Length, Is.EqualTo(9));
            Assert.That(boardPlayer, Is.EqualTo(view.PlayerPoints));
            Assert.That(boardMonster, Is.EqualTo(view.MonsterPoints));
            Assert.That(playerCells, Is.EqualTo(view.PlayerOccupancy));
            Assert.That(monsterCells, Is.EqualTo(view.MonsterOccupancy));

            var ids = new HashSet<int>();
            for (int i = 0; i < view.Cards.Length; i++)
            {
                ViewCard card = view.Cards[i];
                Assert.That(card.CurrentPoints, Is.GreaterThanOrEqualTo(0));
                Assert.That(card.Instance, Is.GreaterThanOrEqualTo(1));
                Assert.That(card.Instance, Is.LessThanOrEqualTo(view.InstanceHighWater));
                Assert.That(ids.Add(card.Instance), Is.True);
            }

            Assert.That(view.Cards.Length, Is.EqualTo(view.InstanceHighWater));
        }
    }
}
