using System;
using System.Linq;
using NUnit.Framework;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class WebAnswerPathTests
    {
        [Test]
        public void Seeded_web_matches_survive_snapshot_answers()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            var failure = "";
            for (int monster = 0; monster < catalog.Monsters.Length; monster++)
            {
                for (int deck = 0; deck < catalog.Decks.Length; deck++)
                {
                    for (int salt = 0; salt < 4; salt++)
                    {
                        ulong seed = salt == 0 ? 861UL : (ulong)(861 + salt * 17 + monster * 3 + deck);
                        string error = Play(catalog, catalog.Monsters[monster].Id, catalog.Decks[deck].Cards, seed);
                        if (error.Length > 0)
                        {
                            failure = catalog.Monsters[monster].Id + " / " + catalog.Decks[deck].Id + " / seed " + seed + "\n" + error;
                            break;
                        }
                    }

                    if (failure.Length > 0)
                    {
                        break;
                    }
                }

                if (failure.Length > 0)
                {
                    break;
                }
            }

            Assert.That(failure, Is.EqualTo(""));
        }

        private static string Play(ContentCatalog catalog, string monsterId, string[] deck, ulong seed)
        {
            Personality personality = catalog.RequireMonster(monsterId).Personality;
            var session = MatchSession.Start(catalog, new MatchSetup
            {
                Seed = seed,
                MonsterId = monsterId,
                BuildDeck = deck
            });
            AdvanceResult step;
            try
            {
                step = session.Advance();
            }
            catch (Exception error)
            {
                return "开局失败：" + error.Message;
            }

            var rng = new DeterministicRng(seed);
            for (int turn = 0; turn < 80 && step.Result == null; turn++)
            {
                if (step.Pending == null || step.Pending.Actor != "player")
                {
                    return "第 " + turn + " 步停在非玩家决策。";
                }

                string snapshot = session.ToSnapshot();
                MatchSession restored;
                try
                {
                    restored = MatchSession.FromSnapshot(snapshot, catalog);
                }
                catch (Exception error)
                {
                    return "快照恢复失败：" + error.GetType().Name + " " + error.Message;
                }

                AdvanceResult restoredStep;
                try
                {
                    restoredStep = restored.Advance();
                }
                catch (Exception error)
                {
                    return "恢复后推进失败：" + error.Message;
                }

                if (restoredStep.Pending == null || restoredStep.Pending.Actor != "player")
                {
                    return "恢复后不再是玩家决策：" + (restoredStep.Pending == null ? "无" : restoredStep.Pending.Actor);
                }

                string[] live = Ids(step.Pending);
                string[] again = Ids(restoredStep.Pending);
                if (!live.SequenceEqual(again))
                {
                    return "核对后合法选项变了。\n原来：" + string.Join(",", live) + "\n恢复：" + string.Join(",", again);
                }

                string option = live[rng.NextInt(live.Length)];
                try
                {
                    step = AnswerLikeHost(catalog, restored, option, personality, seed);
                }
                catch (Exception error)
                {
                    string all = ProbeAll(catalog, snapshot, live, personality, seed);
                    return "选项 " + option + " 失败：" + error.GetType().Name + " " + error.Message + "\n" + all;
                }

                session = restored;
            }

            return "";
        }

        private static string ProbeAll(ContentCatalog catalog, string snapshot, string[] options, Personality personality, ulong seed)
        {
            int failed = 0;
            string sample = "";
            for (int i = 0; i < options.Length; i++)
            {
                try
                {
                    MatchSession copy = MatchSession.FromSnapshot(snapshot, catalog);
                    AnswerLikeHost(catalog, copy, options[i], personality, seed);
                }
                catch (Exception error)
                {
                    failed++;
                    if (sample.Length == 0)
                    {
                        sample = options[i] + " => " + error.Message;
                    }
                }
            }

            return "全部 " + options.Length + " 个选项里失败 " + failed + " 个。例：" + sample;
        }

        private static AdvanceResult AnswerLikeHost(ContentCatalog catalog, MatchSession session, string option, Personality personality, ulong seed)
        {
            AdvanceResult pending = session.Advance();
            if (pending.Pending == null || pending.Pending.Actor != "player")
            {
                throw new InvalidOperationException("现在不是玩家待决策。");
            }

            AdvanceResult advance = session.SubmitAndAdvance(option);
            while (advance.Pending != null && advance.Pending.Actor == "monster")
            {
                AiReport choice = MonsterAi.Choose(session, advance.Pending, personality, DecisionSeed.Mix(seed, session.View("public").Round, advance.Pending.Id));
                advance = session.SubmitAndAdvance(choice.Choice);
            }

            if (advance.Result == null && (advance.Pending == null || advance.Pending.Actor != "player"))
            {
                throw new InvalidOperationException("推进停在没有玩家决策的阶段。");
            }

            string roundtrip = session.ToSnapshot();
            MatchSession check = MatchSession.FromSnapshot(roundtrip, catalog);
            if (check.ToSnapshot() != roundtrip)
            {
                throw new InvalidOperationException("快照再写一遍和原文不一致。");
            }

            return advance;
        }

        private static string[] Ids(Decision decision)
        {
            var ids = new string[decision.Options.Length];
            for (int i = 0; i < decision.Options.Length; i++)
            {
                ids[i] = decision.Options[i].Id;
            }

            return ids;
        }
    }
}
