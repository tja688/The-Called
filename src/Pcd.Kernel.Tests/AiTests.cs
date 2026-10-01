using System;
using System.IO;
using NUnit.Framework;
using Pcd.HostCatalog;
using Pcd.Kernel;
using Pcd.Sim;

namespace Pcd.Kernel.Tests
{
    public sealed class AiTests
    {
        [Test]
        public void Public_view_hides_the_hand_and_lists_unseen_cards()
        {
            OpenedScenario alpha = Open(AlphaYaml);
            OpenedScenario beta = Open(BetaYaml);
            alpha.Session.Advance();
            beta.Session.Advance();

            MatchView left = alpha.Session.View("public");
            MatchView right = beta.Session.View("public");

            Assert.That(left.Hand, Is.Empty);
            Assert.That(left.MatchDeck, Is.Empty);
            Assert.That(left.HandCount, Is.EqualTo(1));
            Assert.That(left.MatchDeckCount, Is.EqualTo(1));
            Assert.That(left.Unseen, Is.EqualTo(new[] { "card.alpha", "card.beta" }));
            Assert.That(right.Unseen, Is.EqualTo(left.Unseen));
            Assert.That(left.Intents, Is.EqualTo(new[] { "card.heavy", "card.next" }));
            Assert.That(alpha.Session.View("omniscient").Hand[0].CardId, Is.EqualTo("card.alpha"));
            Assert.That(alpha.Session.View("hand").Hand[0].CardId, Is.EqualTo("card.alpha"));
            Assert.That(alpha.Session.View("hand").MatchDeck, Is.Empty);
        }

        [Test]
        public void Public_forward_model_ignores_which_hidden_card_is_in_hand()
        {
            OpenedScenario alpha = Open(AlphaYaml);
            OpenedScenario beta = Open(BetaYaml);
            alpha.Session.Advance();
            beta.Session.Advance();

            string[] left = Ids(ForwardModel.Open(alpha.Session, "public", 11).View);
            string[] right = Ids(ForwardModel.Open(beta.Session, "public", 11).View);

            Assert.That(left, Is.EqualTo(right));
            Assert.That(Ids(ForwardModel.Open(alpha.Session, "hand", 11).View)[0], Is.EqualTo("card.alpha"));
            Assert.That(Ids(ForwardModel.Open(beta.Session, "hand", 11).View)[0], Is.EqualTo("card.beta"));
            Assert.That(Ids(ForwardModel.Open(alpha.Session, "omniscient", 11).View)[0], Is.EqualTo("card.alpha"));
            Assert.That(Ids(ForwardModel.Open(beta.Session, "omniscient", 11).View)[0], Is.EqualTo("card.beta"));
        }

        [Test]
        public void Same_position_and_config_produce_the_same_monster_decision()
        {
            OpenedScenario first = Open(AlphaYaml);
            OpenedScenario second = Open(AlphaYaml);
            AdvanceResult left = first.Session.Advance();
            AdvanceResult right = second.Session.Advance();
            Personality personality = first.Catalog.RequireMonster(first.MonsterId).Personality;

            AiReport once = MonsterAi.Choose(first.Session, left.Pending!, personality, 5);
            AiReport twice = MonsterAi.Choose(second.Session, right.Pending!, personality, 5);

            Assert.That(once.Choice, Is.EqualTo("cell:1"));
            Assert.That(twice.Choice, Is.EqualTo(once.Choice));
            Assert.That(twice.Scores.Length, Is.EqualTo(once.Scores.Length));
            for (int i = 0; i < once.Scores.Length; i++)
            {
                Assert.That(twice.Scores[i].OptionId, Is.EqualTo(once.Scores[i].OptionId));
                Assert.That(twice.Scores[i].Score, Is.EqualTo(once.Scores[i].Score));
                Assert.That(once.Scores[i].Reason, Does.Contain("主要因为"));
            }
        }

        [Test]
        public void Public_monster_ai_does_not_change_its_choice_when_only_the_hidden_hand_changes()
        {
            OpenedScenario alpha = Open(AlphaYaml);
            OpenedScenario beta = Open(BetaYaml);
            AdvanceResult left = alpha.Session.Advance();
            AdvanceResult right = beta.Session.Advance();
            var personality = new Personality { Information = "public", Depth = 2, Samples = 2, NodeBudget = 24 };

            AiReport fromAlpha = MonsterAi.Choose(alpha.Session, left.Pending!, personality, 9);
            AiReport fromBeta = MonsterAi.Choose(beta.Session, right.Pending!, personality, 9);

            Assert.That(fromBeta.Choice, Is.EqualTo(fromAlpha.Choice));
            Assert.That(fromBeta.Scores.Length, Is.EqualTo(fromAlpha.Scores.Length));
            for (int i = 0; i < fromAlpha.Scores.Length; i++)
            {
                Assert.That(fromBeta.Scores[i].Score, Is.EqualTo(fromAlpha.Scores[i].Score));
            }
        }

        [Test]
        public void Greedy_bot_covers_a_weaker_monster_card()
        {
            OpenedScenario opened = Open(GreedyYaml);
            AdvanceResult step = opened.Session.Advance();

            string choice = GreedyBot.Choose(opened.Session, step.Pending!, 3);

            Option? chosen = null;
            for (int i = 0; i < step.Pending!.Options.Length; i++)
            {
                if (step.Pending.Options[i].Id == choice)
                {
                    chosen = step.Pending.Options[i];
                }
            }

            Assert.That(chosen, Is.Not.Null);
            Assert.That(chosen!.Cell, Is.EqualTo(2));
        }

        [Test]
        public void Reveal_mode_keeps_the_switch_and_still_asks_for_a_cell_on_the_monster_turn()
        {
            OpenedScenario opened = Open(AlphaYaml.Replace("phase: monster-action", "phase: monster-action\n  intentMode: on-reveal", StringComparison.Ordinal));
            AdvanceResult step = opened.Session.Advance();
            MatchView view = opened.Session.View("public");

            Assert.That(view.IntentMode, Is.EqualTo("on-reveal"));
            Assert.That(view.CommittedCell, Is.EqualTo(0));
            Assert.That(view.CommittedTarget, Is.EqualTo(0));
            Assert.That(step.Pending!.Type, Is.EqualTo("place-intent"));

            MatchSession restored = MatchSession.FromSnapshot(opened.Session.ToSnapshot(), opened.Catalog);
            Assert.That(restored.View("public").IntentMode, Is.EqualTo("on-reveal"));
            Assert.Throws<ArgumentException>(() => ScenarioFile.Open(AlphaYaml.Replace("phase: monster-action", "phase: monster-action\n  intentMode: puzzle", StringComparison.Ordinal), null));
        }

        [Test]
        public void Monster_personality_weights_come_from_content()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            Personality database = catalog.RequireMonster("monster.002").Personality;
            Personality titan = catalog.RequireMonster("monster.003").Personality;

            Assert.That(database.Occupancy, Is.GreaterThan(titan.Occupancy));
            Assert.That(titan.CoverRisk, Is.GreaterThan(database.CoverRisk));
            Assert.That(titan.Points, Is.GreaterThan(database.Points));
            Assert.That(database.Information, Is.EqualTo("public"));
            Assert.That(catalog.RequireMonster("monster.001").IntentMode, Is.EqualTo("on-turn"));
        }

        [Test]
        public void Explain_file_says_why_the_monster_chose_that_cell()
        {
            string path = WriteTemp(AlphaYaml);
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(new[] { "explain", "--file", path }, stdout, stderr);

            string text = stdout.ToString();
            Assert.That(code, Is.EqualTo(0), stderr.ToString());
            Assert.That(text, Does.Contain("格1"));
            Assert.That(text, Does.Contain("主要因为"));
            Assert.That(text, Does.Contain("得分"));
            Assert.That(text, Does.Contain("\"choice\":\"cell:1\""));
        }

        [Test]
        public void Scenario_command_starts_from_a_yaml_position()
        {
            string path = WriteTemp(AlphaYaml);
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(new[] { "scenario", "--file", path, "--auto", "--max", "8" }, stdout, stderr);

            string text = stdout.ToString();
            Assert.That(code, Is.EqualTo(0).Or.EqualTo(2), stderr.ToString() + text);
            Assert.That(text, Does.Contain("残局"));
            Assert.That(text, Does.Contain("重击"));
            Assert.That(text, Does.Contain("结果"));
        }

        [Test]
        public void Matrix_batch_reports_the_planned_metrics()
        {
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(new[] { "batch", "--matrix", "--games", "1", "--seed", "1", "--max", "20" }, stdout, stderr);

            string text = stdout.ToString();
            Assert.That(code, Is.EqualTo(0), stderr.ToString());
            Assert.That(text, Does.Contain("科学"));
            Assert.That(text, Does.Contain("神秘"));
            Assert.That(text, Does.Contain("宗教"));
            Assert.That(text, Does.Contain("失控机械"));
            Assert.That(text, Does.Contain("活数据库"));
            Assert.That(text, Does.Contain("废燃泰坦"));
            Assert.That(text, Does.Contain("玩家胜率"));
            Assert.That(text, Does.Contain("平均回合"));
            Assert.That(text, Does.Contain("有效触发"));
            Assert.That(text, Does.Contain("核心上手率"));
            Assert.That(text, Does.Contain("抢结算"));
            Assert.That(text, Does.Contain("\"coreDrawRate\""));
            Assert.That(text, Does.Contain("\"snatchSettlements\""));
        }

        [Test]
        public void Golden_diff_reports_an_unchanged_recording_and_a_tampered_one()
        {
            string dir = Path.Combine(Path.GetTempPath(), "pcd-golden-" + Guid.NewGuid().ToString("N"));
            var recordOut = new StringWriter();
            var recordErr = new StringWriter();
            int recorded = SimProgram.Run(new[] { "golden", "record", "--dir", dir, "--seed", "3", "--max", "6" }, recordOut, recordErr);
            Assert.That(recorded, Is.EqualTo(0), recordErr.ToString());

            var sameOut = new StringWriter();
            var sameErr = new StringWriter();
            int same = SimProgram.Run(new[] { "golden", "diff", "--dir", dir }, sameOut, sameErr);
            Assert.That(same, Is.EqualTo(0), sameErr.ToString());
            Assert.That(sameOut.ToString(), Does.Contain("打法相同"));
            Assert.That(sameOut.ToString(), Does.Contain("0 局打法不同"));

            string replay = "";
            string[] files = Directory.GetFiles(dir, "*.json");
            for (int i = 0; i < files.Length; i++)
            {
                if (Path.GetFileName(files[i]) != "manifest.json")
                {
                    replay = files[i];
                    break;
                }
            }

            string body = File.ReadAllText(replay);
            Assert.That(body, Does.Contain("\"decisions\""));
            File.WriteAllText(replay, body.Replace("cell:", "skip:", StringComparison.Ordinal).Replace("play:", "skip:", StringComparison.Ordinal));

            var diffOut = new StringWriter();
            var diffErr = new StringWriter();
            int diff = SimProgram.Run(new[] { "golden", "diff", "--dir", dir }, diffOut, diffErr);
            Assert.That(diff, Is.EqualTo(0), diffErr.ToString());
            Assert.That(diffOut.ToString(), Does.Contain("打法不同"));
        }

        private static string[] Ids(MatchView view)
        {
            var ids = new string[view.Hand.Length];
            for (int i = 0; i < view.Hand.Length; i++)
            {
                ids[i] = view.Hand[i].CardId;
            }

            return ids;
        }

        private static OpenedScenario Open(string yaml)
        {
            return ScenarioFile.Open(yaml, null);
        }

        private static string WriteTemp(string yaml)
        {
            string path = Path.Combine(Path.GetTempPath(), "pcd-ai-" + Guid.NewGuid().ToString("N") + ".yaml");
            File.WriteAllText(path, yaml);
            return path;
        }

        private const string AlphaYaml =
            "cards:\n" +
            "  - id: card.foe\n    name: 守方\n    points: 5\n" +
            "  - id: card.heavy\n    name: 重击\n    points: 6\n" +
            "  - id: card.next\n    name: 下一张\n    points: 3\n" +
            "  - id: card.alpha\n    name: 甲\n    points: 4\n" +
            "  - id: card.beta\n    name: 乙\n    points: 1\n" +
            "monster:\n  id: monster.t\n  name: 测试怪\n  intents:\n    - card.heavy\n    - card.next\n" +
            "position:\n  phase: monster-action\n  round: 1\n  intentIndex: 0\n" +
            "  player:\n    hand:\n      - card: card.alpha\n    deck:\n      - card: card.beta\n" +
            "  board:\n    - { cell: 1, card: card.foe, owner: player }\n";

        private const string BetaYaml =
            "cards:\n" +
            "  - id: card.foe\n    name: 守方\n    points: 5\n" +
            "  - id: card.heavy\n    name: 重击\n    points: 6\n" +
            "  - id: card.next\n    name: 下一张\n    points: 3\n" +
            "  - id: card.alpha\n    name: 甲\n    points: 4\n" +
            "  - id: card.beta\n    name: 乙\n    points: 1\n" +
            "monster:\n  id: monster.t\n  name: 测试怪\n  intents:\n    - card.heavy\n    - card.next\n" +
            "position:\n  phase: monster-action\n  round: 1\n  intentIndex: 0\n" +
            "  player:\n    hand:\n      - card: card.beta\n    deck:\n      - card: card.alpha\n" +
            "  board:\n    - { cell: 1, card: card.foe, owner: player }\n";

        private const string GreedyYaml =
            "cards:\n" +
            "  - id: card.foe\n    name: 守方\n    points: 1\n" +
            "  - id: card.strike\n    name: 打击\n    points: 6\n" +
            "  - id: card.next\n    name: 下一张\n" +
            "monster:\n  id: monster.t\n  name: 测试怪\n  intents:\n    - card.next\n" +
            "position:\n  phase: player-action\n  round: 1\n  opportunities: 1\n" +
            "  player:\n    hand:\n      - card: card.strike\n    deck: []\n" +
            "  board:\n    - { cell: 2, card: card.foe, owner: monster }\n";
    }
}
