using System.Linq;
using System.Text.Json;
using NUnit.Framework;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class SelectionFlowTests
    {
        [Test]
        public void Played_card_is_on_board_before_target_selection_and_events_are_not_repeated()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            MatchSession session = Position(catalog, "card.c001");
            int instance = session.View("player").Hand[0].Instance;
            AdvanceResult choice = session.SubmitAndAdvance("play:" + instance + ":1");

            Assert.That(choice.Pending!.Type, Is.EqualTo("choose-card"));
            Assert.That(session.View("player").Hand, Is.Empty, "已打出的牌还留在手牌里");
            Assert.That(session.View("player").Cells[0].Card!.Instance, Is.EqualTo(instance));
            Assert.That(choice.Events.Count(e => e.Type == "card-played"), Is.EqualTo(1));

            string snapshot = session.ToSnapshot();
            MatchSession restored = MatchSession.FromSnapshot(snapshot, catalog);
            MatchSession copied = session.Copy();
            Assert.That(restored.ToSnapshot(), Is.EqualTo(snapshot));
            Assert.That(JsonSerializer.Serialize(restored.View("player")), Is.EqualTo(JsonSerializer.Serialize(session.View("player"))));
            string answer = choice.Pending.Options[0].Id;
            AdvanceResult done = session.SubmitAndAdvance(answer);
            restored.SubmitAndAdvance(answer);
            copied.SubmitAndAdvance(answer);
            Assert.That(done.Events.Any(e => e.Type == "card-played" || e.Type == "card-entered"), Is.False, "选择目标后重复播放了打牌");
            Assert.That(session.View("player").Cells[4].Card!.Statuses, Does.Contain("status.mark"));
            Assert.That(session.EventHash(), Is.EqualTo(restored.EventHash()));
            Assert.That(session.EventHash(), Is.EqualTo(copied.EventHash()));
        }

        [Test]
        public void No_legal_target_skips_selection_but_keeps_the_play()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            MatchSession session = Position(catalog, "card.c023");
            int instance = session.View("player").Hand[0].Instance;
            AdvanceResult done = session.SubmitAndAdvance("play:" + instance + ":1");
            Assert.That(done.Pending!.Type, Is.EqualTo("play"));
            Assert.That(session.View("player").Cells[0].Card!.Instance, Is.EqualTo(instance));
            Assert.That(session.View("player").RemainingOpportunities, Is.EqualTo(1));
        }

        [Test]
        public void Tie_cover_still_resolves_entry_selection_after_source_leaves()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            MatchSession session = Position(catalog, "card.c001", new[] {
                new PositionCard { CardId = "card.c001", Owner = "monster", Cell = 1 },
                new PositionCard { CardId = "card.c002", Owner = "monster", Cell = 5 }
            });
            int instance = session.View("player").Hand[0].Instance;
            AdvanceResult choice = session.SubmitAndAdvance("play:" + instance + ":1");
            Assert.That(choice.Pending!.Type, Is.EqualTo("choose-card"));
            Assert.That(session.View("player").Cells[0].Card, Is.Null);
            Assert.That(session.View("player").PlayerDiscard.Any(c => c.Instance == instance), Is.True);
            session = MatchSession.FromSnapshot(session.ToSnapshot(), catalog);
            session.SubmitAndAdvance(choice.Pending.Options[0].Id);
            Assert.That(session.View("player").Cells[4].Card!.Statuses, Does.Contain("status.mark"));
        }

        [Test]
        public void Entry_damage_can_kill_source_before_its_adjacent_selection()
        {
            ContentCatalog catalog = ContentCatalog.Parse(ChoiceCatalog);
            MatchSession session = Position(catalog, "card.dying", new[] {
                new PositionCard { CardId = "card.target", Owner = "monster", Cell = 2 }
            });
            int instance = session.View("player").Hand[0].Instance;
            AdvanceResult choice = session.SubmitAndAdvance("play:" + instance + ":1");
            Assert.That(choice.Pending!.Type, Is.EqualTo("choose-card"));
            Assert.That(session.View("player").Cells[0].Card, Is.Null);
            Assert.That(session.View("player").PlayerDiscard.Any(c => c.Instance == instance), Is.True);
            session = MatchSession.FromSnapshot(session.ToSnapshot(), catalog);
            session.SubmitAndAdvance(choice.Pending.Options[0].Id);
            Assert.That(session.View("player").Cells[1].Card!.Statuses, Does.Contain("status.mark"));
        }

        [Test]
        public void Trap_removal_does_not_cancel_the_played_cards_target_effect()
        {
            ContentCatalog catalog = ContentCatalog.Parse(ChoiceCatalog);
            MatchSession session = Position(catalog, "card.double", new[] {
                new PositionCard { CardId = "card.trap", Owner = "monster", Cell = 2 }
            });
            int instance = session.View("player").Hand[0].Instance;
            AdvanceResult first = session.SubmitAndAdvance("play:" + instance + ":1");
            AdvanceResult second = session.SubmitAndAdvance(first.Pending!.Options[0].Id);
            Assert.That(second.Pending!.Type, Is.EqualTo("choose-card"));
            Assert.That(session.View("player").Cells[1].Card!.Statuses, Does.Contain("status.mark"));
            Assert.That(second.Events.Any(e => e.Type == "card-played"), Is.False);
            MatchSession restored = MatchSession.FromSnapshot(session.ToSnapshot(), catalog);
            AdvanceResult done = restored.SubmitAndAdvance(second.Pending.Options[0].Id);
            Assert.That(restored.View("player").PlayerDiscard.Any(c => c.Instance == instance), Is.True);
            Assert.That(restored.View("player").Cells[1].Card!.CurrentPoints, Is.EqualTo(3));
            Assert.That(done.Events.Any(e => e.Type == "card-played"), Is.False);
        }

        [Test]
        public void Spell_leaves_hand_before_selection_and_remains_in_the_census()
        {
            ContentCatalog catalog = ContentCatalog.Parse(ChoiceCatalog);
            MatchSession session = Position(catalog, "card.spell", new[] {
                new PositionCard { CardId = "card.target", Owner = "monster", Cell = 2 }
            });
            int instance = session.View("player").Hand[0].Instance;
            AdvanceResult choice = session.SubmitAndAdvance("cast:" + instance);
            Assert.That(session.View("player").Hand, Is.Empty);
            MatchView census = session.View("omniscient");
            Assert.That(census.Cards.Length, Is.EqualTo(census.InstanceHighWater));
            Assert.That(census.Cards.Single(c => c.Instance == instance).Zone, Is.EqualTo("none"));
            MatchSession restored = MatchSession.FromSnapshot(session.ToSnapshot(), catalog);
            AdvanceResult done = restored.SubmitAndAdvance(choice.Pending!.Options[0].Id);
            Assert.That(restored.View("player").PlayerDiscard.Single().Instance, Is.EqualTo(instance));
            Assert.That(restored.View("player").Cells[1].Card!.Statuses, Does.Contain("status.mark"));
            Assert.That(done.Events.Any(e => e.Type == "card-played"), Is.False);
        }

        [Test]
        public void Played_card_can_choose_itself_as_a_board_target()
        {
            ContentCatalog catalog = ContentCatalog.Parse(ChoiceCatalog);
            MatchSession session = Position(catalog, "card.self", new[] {
                new PositionCard { CardId = "card.target", Owner = "monster", Cell = 2 }
            });
            int instance = session.View("player").Hand[0].Instance;
            AdvanceResult choice = session.SubmitAndAdvance("play:" + instance + ":1");
            Option self = choice.Pending!.Options.Single(o => o.Instance == instance);
            Assert.That(session.View("player").Cells[0].Card!.Instance, Is.EqualTo(self.Instance));
            session.SubmitAndAdvance(self.Id);
            Assert.That(session.View("player").Cells[0].Card!.CurrentPoints, Is.EqualTo(8));
        }

        [Test]
        public void Tie_cover_keeps_the_origin_cell_for_adjacent_entry_actions()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            MatchSession session = Position(catalog, "card.c022", new[] {
                new PositionCard { CardId = "card.c022", Owner = "monster", Cell = 1 },
                new PositionCard { CardId = "card.c002", Owner = "monster", Cell = 2 },
                new PositionCard { CardId = "card.c002", Owner = "monster", Cell = 4 }
            });
            int instance = session.View("player").Hand[0].Instance;
            session.SubmitAndAdvance("play:" + instance + ":1");
            Assert.That(session.View("player").Cells[0].Card, Is.Null);
            Assert.That(session.View("player").Cells[1].Card!.Statuses, Does.Contain("status.mark"));
            Assert.That(session.View("player").Cells[3].Card!.Statuses, Does.Contain("status.mark"));
        }

        [Test]
        public void Forced_settlement_cannot_bypass_an_unanswered_ability()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            MatchSession session = Position(catalog, "card.c001");
            int instance = session.View("player").Hand[0].Instance;
            AdvanceResult choice = session.SubmitAndAdvance("play:" + instance + ":1");
            Assert.Throws<System.InvalidOperationException>(() => session.SpecialSettlement());
            Assert.That(session.Advance().Pending!.Id, Is.EqualTo(choice.Pending!.Id));
            session.SubmitAndAdvance(choice.Pending.Options[0].Id);
            Assert.That(session.SpecialSettlement().Result, Is.Not.Null);
        }

        private const string ChoiceCatalog = @"
statuses:
  - { id: status.mark, name: 标记 }
cards:
  - id: card.dying
    points: 2
    abilities:
      - actions:
          - { kind: change-points, amount: -2, target: self }
      - target: { pick: one, side: opponent, adjacent: true }
        actions:
          - { kind: add-status, status: status.mark }
  - id: card.double
    points: 2
    abilities:
      - target: { pick: one, side: opponent }
        actions:
          - { kind: add-status, status: status.mark }
      - target: { pick: one, side: opponent }
        actions:
          - { kind: change-points, amount: -1 }
  - id: card.spell
    kind: spell
    abilities:
      - target: { pick: one, side: opponent }
        actions:
          - { kind: add-status, status: status.mark }
  - id: card.self
    points: 2
    abilities:
      - target: { pick: one, side: ally, allowSelf: true }
        actions:
          - { kind: change-points, amount: 6 }
  - { id: card.target, points: 4 }
  - id: card.trap
    points: 4
    abilities:
      - trigger: enemy-adjacent-play
        zone: board
        actions:
          - { kind: remove, target: context }
monster:
  id: monster.test
  intents: [card.target]
";

        private static MatchSession Position(ContentCatalog catalog, string card, PositionCard[]? board = null)
        {
            MatchSession session = MatchSession.FromPosition(catalog, new MatchPosition {
                MonsterId = catalog.Monsters[0].Id, Round = 1, Opportunities = 2,
                PlayerHand = new[] { new PositionCard { CardId = card } },
                Board = board ?? new[] { new PositionCard { CardId = "card.c002", Owner = "monster", Cell = 5 } }
            });
            session.Advance();
            return session;
        }
    }
}
