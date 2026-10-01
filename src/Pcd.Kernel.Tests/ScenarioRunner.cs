using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using NUnit.Framework;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public static class ScenarioRunner
    {
        public static void Run(string path)
        {
            string text = File.ReadAllText(path);
            YamlNode doc = YamlNode.Parse(text);
            ContentCatalog catalog;
            string? catalogPath = doc.Str("catalog");
            if (catalogPath != null)
            {
                catalog = ContentCatalog.Parse(File.ReadAllText(Path.Combine(RepoRoot(), catalogPath)));
            }
            else
            {
                catalog = ContentCatalog.Parse(text);
            }
            string monsterId = RequireMonsterId(doc);
            MatchSession session;
            if (doc.Has("position"))
            {
                YamlNode? position = doc.Get("position");
                if (position == null)
                {
                    throw new FormatException(path + " 的 position 是空的。");
                }

                session = MatchSession.FromPosition(catalog, BuildPosition(position, monsterId));
            }
            else
            {
                session = MatchSession.Start(catalog, BuildSetup(doc, monsterId));
            }

            AdvanceResult opening = session.Advance();
            Check(path, "opening", opening, session, doc.Get("opening"));
            YamlNode? steps = doc.Get("steps");
            if (steps == null)
            {
                return;
            }

            if (!steps.IsSequence)
            {
                Assert.Fail(path + " 的 steps 必须是列表。");
            }

            for (int i = 0; i < steps.Items.Count; i++)
            {
                YamlNode step = steps.Items[i];
                AdvanceResult result;
                if (step.Has("answer"))
                {
                    string? answer = step.Str("answer");
                    if (answer == null)
                    {
                        Assert.Fail(path + " 第 " + (i + 1) + " 步没有答案。");
                    }

                    result = session.SubmitAndAdvance(answer!);
                }
                else if (step.Str("special") == "true")
                {
                    result = session.SpecialSettlement();
                }
                else
                {
                    Assert.Fail(path + " 第 " + (i + 1) + " 步缺少 answer 或 special。");
                    return;
                }

                Check(path, "step " + (i + 1), result, session, step);
            }
        }

        private static string RequireMonsterId(YamlNode doc)
        {
            YamlNode? monster = doc.Get("monster");
            if (monster == null)
            {
                Assert.Fail("场景缺少 monster。");
            }

            if (monster!.IsScalar)
            {
                if (monster.Scalar == null)
                {
                    Assert.Fail("场景怪物缺少 id。");
                }

                return monster.Scalar!;
            }

            string? id = monster.Str("id");
            if (id == null)
            {
                Assert.Fail("场景怪物缺少 id。");
            }

            return id!;
        }

        private static string RepoRoot()
        {
            DirectoryInfo? dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "global.json")))
                {
                    return dir.FullName;
                }

                dir = dir.Parent;
            }

            throw new DirectoryNotFoundException("找不到仓库根目录。");
        }

        private static MatchSetup BuildSetup(YamlNode doc, string monsterId)
        {
            return new MatchSetup
            {
                Seed = ReadULong(doc, "seed", 1),
                MonsterId = monsterId,
                BuildDeck = ReadIdList(doc.Get("deck")),
                OpportunitiesPerTurn = doc.Has("opportunitiesPerTurn") ? doc.Int("opportunitiesPerTurn") : 1,
                Injections = ReadInjections(doc.Get("injections"))
            };
        }

        private static MatchPosition BuildPosition(YamlNode position, string monsterId)
        {
            var built = new MatchPosition
            {
                MonsterId = monsterId,
                Seed = ReadULong(position, "seed", 1),
                Phase = position.Str("phase") ?? "player-action",
                Round = position.Has("round") ? position.Int("round") : 0,
                IntentIndex = position.Has("intentIndex") ? position.Int("intentIndex") : 0,
                OpportunitiesPerTurn = position.Has("opportunitiesPerTurn") ? position.Int("opportunitiesPerTurn") : 1,
                Opportunities = position.Has("opportunities") ? position.Int("opportunities") : 1,
                PollutedCells = ReadInts(position.Get("polluted")),
                Board = ReadCards(position.Get("board")),
                Injections = ReadInjections(position.Get("injections"))
            };
            YamlNode? player = position.Get("player");
            if (player != null)
            {
                built.PlayerMatchDeck = ReadCards(player.Get("deck"));
                built.PlayerHand = ReadCards(player.Get("hand"));
                built.PlayerDiscard = ReadCards(player.Get("discard"));
                built.PlayerVoid = ReadCards(player.Get("void"));
                built.PlayerResources = ReadResources(player);
            }

            YamlNode? monster = position.Get("monster");
            if (monster != null)
            {
                built.MonsterDiscard = ReadCards(monster.Get("discard"));
                built.MonsterVoid = ReadCards(monster.Get("void"));
                built.MonsterResources = ReadResources(monster);
            }

            return built;
        }

        private static void Check(string path, string label, AdvanceResult result, MatchSession session, YamlNode? expect)
        {
            if (expect == null)
            {
                return;
            }

            if (expect.Has("events"))
            {
                CheckEvents(path, label, result.Events, expect.Get("events"));
            }

            if (expect.Has("pending"))
            {
                CheckPending(path, label, result.Pending, expect.Get("pending"));
            }

            if (expect.Has("result"))
            {
                CheckResult(path, label, result, expect.Get("result"));
            }

            MatchView view = session.View("omniscient");
            if (expect.Has("board"))
            {
                CheckBoard(path, label, view, expect.Get("board"), expect.Str("boardExact") == "true");
            }

            if (expect.Has("handCount"))
            {
                AssertEqual(path, label, "handCount", expect.Int("handCount"), view.HandCount);
            }

            if (expect.Has("deckCount"))
            {
                AssertEqual(path, label, "deckCount", expect.Int("deckCount"), view.MatchDeckCount);
            }

            if (expect.Has("opportunities"))
            {
                AssertEqual(path, label, "opportunities", expect.Int("opportunities"), view.RemainingOpportunities);
            }

            if (expect.Has("intent"))
            {
                AssertEqual(path, label, "intent", expect.Str("intent"), view.RevealedIntent);
            }

            if (expect.Has("hand"))
            {
                CheckZone(path, label, "hand", view.Hand, expect.Get("hand"));
            }

            if (expect.Has("playerDiscard"))
            {
                CheckZone(path, label, "playerDiscard", view.PlayerDiscard, expect.Get("playerDiscard"));
            }

            if (expect.Has("playerVoid"))
            {
                CheckZone(path, label, "playerVoid", view.PlayerVoid, expect.Get("playerVoid"));
            }

            if (expect.Has("deck"))
            {
                CheckZone(path, label, "deck", view.MatchDeck, expect.Get("deck"));
            }

            if (expect.Has("playerFaith"))
            {
                AssertEqual(path, label, "playerFaith", expect.Int("playerFaith"), Pool(view, "player", "resource.faith"));
            }

            if (expect.Has("monsterFaith"))
            {
                AssertEqual(path, label, "monsterFaith", expect.Int("monsterFaith"), Pool(view, "monster", "resource.faith"));
            }

            if (expect.Has("monsterDiscard"))
            {
                CheckZone(path, label, "monsterDiscard", view.MonsterDiscard, expect.Get("monsterDiscard"));
            }

            if (expect.Has("totals"))
            {
                YamlNode? totals = expect.Get("totals");
                if (totals == null)
                {
                    Assert.Fail(path + " " + label + " 的 totals 是空的。");
                }

                if (totals!.Has("player"))
                {
                    AssertEqual(path, label, "player total", totals.Int("player"), view.PlayerPoints);
                }

                if (totals.Has("monster"))
                {
                    AssertEqual(path, label, "monster total", totals.Int("monster"), view.MonsterPoints);
                }
            }
        }

        private static void CheckEvents(string path, string label, GameEvent[] actual, YamlNode? expected)
        {
            if (expected == null || !expected.IsSequence)
            {
                Assert.Fail(path + " " + label + " 的 events 必须是列表。");
            }

            if (actual.Length != expected!.Items.Count)
            {
                Assert.Fail(path + " " + label + " 事件数量是 " + actual.Length + "，期望 " + expected.Items.Count + "。\n" + Dump(actual));
            }

            for (int i = 0; i < actual.Length; i++)
            {
                YamlNode item = expected.Items[i];
                GameEvent evt = actual[i];
                string where = path + " " + label + " 事件 " + (i + 1);
                AssertEqual(where, "type", item.Str("type"), evt.Type);
                if (item.Has("card"))
                {
                    AssertEqual(where, "card", item.Str("card"), evt.Card);
                }

                if (item.Has("instance"))
                {
                    AssertEqual(where, "instance", item.Int("instance"), evt.Instance);
                }

                if (item.Has("owner"))
                {
                    AssertEqual(where, "owner", item.Str("owner"), evt.Owner);
                }

                if (item.Has("cell"))
                {
                    AssertEqual(where, "cell", item.Int("cell"), evt.Cell ?? 0);
                }

                if (item.Has("zone"))
                {
                    AssertEqual(where, "zone", item.Str("zone"), evt.Zone);
                }

                if (item.Has("reason"))
                {
                    AssertEqual(where, "reason", item.Str("reason"), evt.Reason);
                }

                if (item.Has("source"))
                {
                    AssertEqual(where, "source", item.Str("source"), evt.Source);
                }

                if (item.Has("before"))
                {
                    AssertEqual(where, "before", item.Int("before"), evt.Before);
                }

                if (item.Has("after"))
                {
                    AssertEqual(where, "after", item.Int("after"), evt.After);
                }

                if (item.Has("winner"))
                {
                    AssertEqual(where, "winner", item.Str("winner"), evt.Winner);
                }

                if (item.Has("index"))
                {
                    AssertEqual(where, "index", item.Int("index"), evt.Index);
                }

                if (item.Has("round"))
                {
                    AssertEqual(where, "round", item.Int("round"), evt.Round);
                }

                if (item.Has("cause"))
                {
                    YamlNode? cause = item.Get("cause");
                    if (cause == null || !cause.IsSequence)
                    {
                        Assert.Fail(where + " 的 cause 必须是列表。");
                    }

                    if (evt.Cause.Length != cause!.Items.Count)
                    {
                        Assert.Fail(where + " 起因长度不符：" + string.Join(",", evt.Cause));
                    }

                    for (int c = 0; c < evt.Cause.Length; c++)
                    {
                        string? expectedCause = cause.Items[c].Scalar;
                        if (evt.Cause[c] != expectedCause)
                        {
                            Assert.Fail(where + " 起因[" + c + "] 是 " + evt.Cause[c] + "，期望 " + expectedCause);
                        }
                    }
                }
            }
        }

        private static void CheckPending(string path, string label, Decision? pending, YamlNode? expected)
        {
            if (expected == null)
            {
                Assert.Fail(path + " " + label + " 的 pending 是空的。");
            }

            if (pending == null)
            {
                Assert.Fail(path + " " + label + " 没有待决策。");
            }

            if (expected!.Has("actor"))
            {
                AssertEqual(path, label, "actor", expected.Str("actor"), pending!.Actor);
            }

            if (expected.Has("type"))
            {
                AssertEqual(path, label, "type", expected.Str("type"), pending!.Type);
            }

            if (expected.Has("ability"))
            {
                AssertEqual(path, label, "ability", expected.Str("ability"), pending!.Ability);
            }

            if (expected.Has("options"))
            {
                YamlNode? options = expected.Get("options");
                if (options == null || !options.IsSequence)
                {
                    Assert.Fail(path + " " + label + " 的 options 必须是列表。");
                }

                if (pending!.Options.Length != options!.Items.Count)
                {
                    Assert.Fail(path + " " + label + " 选项数量不符。实际：" + OptionIds(pending));
                }

                for (int i = 0; i < pending.Options.Length; i++)
                {
                    if (pending.Options[i].Id != options.Items[i].Scalar)
                    {
                        Assert.Fail(path + " " + label + " 选项[" + i + "] 是 " + pending.Options[i].Id + "，期望 " + options.Items[i].Scalar + "。实际：" + OptionIds(pending));
                    }
                }
            }
        }

        private static void CheckResult(string path, string label, AdvanceResult result, YamlNode? expected)
        {
            if (expected == null)
            {
                Assert.Fail(path + " " + label + " 的 result 是空的。");
            }

            if (expected!.IsScalar && expected.Scalar == "ongoing")
            {
                if (result.Result != null)
                {
                    Assert.Fail(path + " " + label + " 对局已结束：" + result.Result.Winner + " " + result.Result.Reason);
                }

                return;
            }

            if (!expected.IsMap || result.Result == null)
            {
                Assert.Fail(path + " " + label + " 的胜负结果对不上。");
            }

            if (expected.Has("winner"))
            {
                AssertEqual(path, label, "winner", expected.Str("winner"), result.Result!.Winner);
            }

            if (expected.Has("reason"))
            {
                AssertEqual(path, label, "reason", expected.Str("reason"), result.Result!.Reason);
            }
        }

        private static void CheckBoard(string path, string label, MatchView view, YamlNode? expected, bool exact)
        {
            if (expected == null || !expected.IsSequence)
            {
                Assert.Fail(path + " " + label + " 的 board 必须是列表。");
            }

            var seen = new bool[9];
            for (int i = 0; i < expected!.Items.Count; i++)
            {
                YamlNode item = expected.Items[i];
                int cell = item.Int("cell");
                seen[cell - 1] = true;
                ViewCard? card = view.Cells[cell - 1].Card;
                if (item.Str("empty") == "true")
                {
                    if (card != null)
                    {
                        Assert.Fail(path + " " + label + " 格 " + cell + " 不是空的。");
                    }

                    continue;
                }

                if (card == null)
                {
                    Assert.Fail(path + " " + label + " 格 " + cell + " 是空的。");
                }

                if (item.Has("card"))
                {
                    AssertEqual(path, label, "cell " + cell + " card", item.Str("card"), card!.CardId);
                }

                if (item.Has("owner"))
                {
                    AssertEqual(path, label, "cell " + cell + " owner", item.Str("owner"), card!.Owner);
                }

                if (item.Has("points"))
                {
                    AssertEqual(path, label, "cell " + cell + " points", item.Int("points"), card!.CurrentPoints);
                }

                if (item.Has("modifiers"))
                {
                    AssertEqual(path, label, "cell " + cell + " modifiers", item.Int("modifiers"), card!.ModifierCount);
                }

                if (item.Has("back"))
                {
                    AssertEqual(path, label, "cell " + cell + " back", item.Str("back"), card!.CardBackId);
                }

                if (item.Has("timer"))
                {
                    AssertEqual(path, label, "cell " + cell + " timer", item.Int("timer"), card!.Timer);
                }

                if (item.Has("statuses"))
                {
                    CheckStatuses(path, label, "cell " + cell, card!.Statuses, item.Get("statuses"));
                }
            }

            if (!exact)
            {
                return;
            }

            for (int cell = 1; cell <= 9; cell++)
            {
                if (!seen[cell - 1] && view.Cells[cell - 1].Card != null)
                {
                    Assert.Fail(path + " " + label + " 格 " + cell + " 不应该有牌。");
                }
            }
        }

        private static void CheckZone(string path, string label, string zone, ViewCard[] actual, YamlNode? expected)
        {
            if (expected == null || !expected.IsSequence)
            {
                Assert.Fail(path + " " + label + " 的 " + zone + " 必须是列表。");
            }

            if (actual.Length != expected!.Items.Count)
            {
                Assert.Fail(path + " " + label + " " + zone + " 数量是 " + actual.Length + "，期望 " + expected.Items.Count + "。");
            }

            for (int i = 0; i < actual.Length; i++)
            {
                YamlNode item = expected.Items[i];
                string where = zone + "[" + i + "]";
                if (item.IsScalar)
                {
                    AssertEqual(path, label, where, item.Scalar, actual[i].CardId);
                    continue;
                }

                if (item.Has("card"))
                {
                    AssertEqual(path, label, where + " card", item.Str("card"), actual[i].CardId);
                }

                if (item.Has("points"))
                {
                    AssertEqual(path, label, where + " points", item.Int("points"), actual[i].CurrentPoints);
                }

                if (item.Has("modifiers"))
                {
                    AssertEqual(path, label, where + " modifiers", item.Int("modifiers"), actual[i].ModifierCount);
                }

                if (item.Has("back"))
                {
                    AssertEqual(path, label, where + " back", item.Str("back"), actual[i].CardBackId);
                }
            }
        }

        private static PositionCard[] ReadCards(YamlNode? node)
        {
            if (node == null)
            {
                return Array.Empty<PositionCard>();
            }

            if (!node.IsSequence)
            {
                throw new FormatException("卡牌列表格式不对。");
            }

            var cards = new PositionCard[node.Items.Count];
            for (int i = 0; i < node.Items.Count; i++)
            {
                YamlNode item = node.Items[i];
                if (item.IsScalar)
                {
                    cards[i] = new PositionCard { CardId = item.Scalar ?? "" };
                    continue;
                }

                var card = new PositionCard
                {
                    CardId = item.Str("card") ?? "",
                    Owner = item.Str("owner"),
                    CardBackId = item.Str("back")
                };
                if (item.Has("cell"))
                {
                    card.Cell = item.Int("cell");
                }

                if (item.Has("points"))
                {
                    card.CurrentPoints = item.Int("points");
                }

                if (item.Has("base"))
                {
                    card.BasePoints = item.Int("base");
                }

                if (item.Has("timer"))
                {
                    card.Timer = item.Int("timer");
                }

                if (item.Has("timerMax"))
                {
                    card.TimerMax = item.Int("timerMax");
                }

                YamlNode? statuses = item.Get("statuses");
                if (statuses != null)
                {
                    if (!statuses.IsSequence)
                    {
                        throw new FormatException("statuses 必须是列表。");
                    }

                    card.Statuses = new string[statuses.Items.Count];
                    card.StatusRounds = new int[statuses.Items.Count];
                    for (int s = 0; s < statuses.Items.Count; s++)
                    {
                        YamlNode status = statuses.Items[s];
                        if (status.IsScalar)
                        {
                            card.Statuses[s] = status.Scalar ?? "";
                            card.StatusRounds[s] = 0;
                        }
                        else
                        {
                            card.Statuses[s] = status.Str("id") ?? "";
                            card.StatusRounds[s] = status.Has("round") ? status.Int("round") : 0;
                        }
                    }
                }

                YamlNode? modifiers = item.Get("modifiers");
                if (modifiers != null)
                {
                    if (!modifiers.IsSequence)
                    {
                        throw new FormatException("modifiers 必须是列表。");
                    }

                    card.Modifiers = new PointChange[modifiers.Items.Count];
                    for (int m = 0; m < modifiers.Items.Count; m++)
                    {
                        YamlNode modifier = modifiers.Items[m];
                        card.Modifiers[m] = new PointChange
                        {
                            Source = modifier.Str("source") ?? "",
                            Amount = modifier.Int("amount")
                        };
                    }
                }

                cards[i] = card;
            }

            return cards;
        }

        private static void CheckStatuses(string path, string label, string where, string[] actual, YamlNode? expected)
        {
            if (expected == null || !expected.IsSequence)
            {
                Assert.Fail(path + " " + label + " 的 " + where + " 状态必须是列表。");
            }

            if (actual.Length != expected!.Items.Count)
            {
                Assert.Fail(path + " " + label + " " + where + " 状态数量不符。");
            }

            for (int i = 0; i < actual.Length; i++)
            {
                string? id = expected.Items[i].IsScalar ? expected.Items[i].Scalar : expected.Items[i].Str("id");
                AssertEqual(path, label, where + " status", id, actual[i]);
            }
        }

        private static int Pool(MatchView view, string owner, string id)
        {
            for (int i = 0; i < view.Pools.Length; i++)
            {
                if (view.Pools[i].Owner == owner && view.Pools[i].Id == id)
                {
                    return view.Pools[i].Amount;
                }
            }

            return 0;
        }

        private static SetupResource[] ReadResources(YamlNode node)
        {
            var list = new List<SetupResource>();
            if (node.Has("faith"))
            {
                list.Add(new SetupResource { Id = "resource.faith", Amount = node.Int("faith") });
            }

            YamlNode? resources = node.Get("resources");
            if (resources != null && resources.IsSequence)
            {
                for (int i = 0; i < resources.Items.Count; i++)
                {
                    list.Add(new SetupResource
                    {
                        Id = resources.Items[i].Str("id") ?? "",
                        Amount = resources.Items[i].Int("amount")
                    });
                }
            }

            return list.ToArray();
        }

        private static AbilityInjection[] ReadInjections(YamlNode? node)
        {
            if (node == null)
            {
                return Array.Empty<AbilityInjection>();
            }

            if (!node.IsSequence)
            {
                throw new FormatException("injections 必须是列表。");
            }

            var injections = new AbilityInjection[node.Items.Count];
            for (int i = 0; i < node.Items.Count; i++)
            {
                injections[i] = new AbilityInjection
                {
                    Host = node.Items[i].Str("host") ?? "",
                    AbilityId = node.Items[i].Str("ability") ?? ""
                };
            }

            return injections;
        }

        private static string[] ReadIdList(YamlNode? node)
        {
            if (node == null)
            {
                return Array.Empty<string>();
            }

            if (!node.IsSequence)
            {
                throw new FormatException("标识列表格式不对。");
            }

            var ids = new string[node.Items.Count];
            for (int i = 0; i < node.Items.Count; i++)
            {
                ids[i] = node.Items[i].Scalar ?? "";
            }

            return ids;
        }

        private static int[] ReadInts(YamlNode? node)
        {
            if (node == null)
            {
                return Array.Empty<int>();
            }

            if (!node.IsSequence)
            {
                throw new FormatException("整数列表格式不对。");
            }

            var values = new int[node.Items.Count];
            for (int i = 0; i < node.Items.Count; i++)
            {
                if (!int.TryParse(node.Items[i].Scalar, NumberStyles.Integer, CultureInfo.InvariantCulture, out values[i]))
                {
                    throw new FormatException("整数列表里有非整数。");
                }
            }

            return values;
        }

        private static ulong ReadULong(YamlNode node, string key, ulong fallback)
        {
            string? text = node.Str(key);
            if (text == null)
            {
                return fallback;
            }

            return ulong.Parse(text, CultureInfo.InvariantCulture);
        }

        private static string Dump(GameEvent[] events)
        {
            var builder = new StringBuilder();
            for (int i = 0; i < events.Length; i++)
            {
                GameEvent evt = events[i];
                builder.Append(evt.Seq);
                builder.Append(' ');
                builder.Append(evt.Type);
                builder.Append(" card=");
                builder.Append(evt.Card);
                builder.Append(" instance=");
                builder.Append(evt.Instance);
                builder.Append(" cell=");
                builder.Append(evt.Cell);
                builder.Append(" owner=");
                builder.Append(evt.Owner);
                builder.Append(" source=");
                builder.Append(evt.Source);
                builder.Append(" before=");
                builder.Append(evt.Before);
                builder.Append(" after=");
                builder.Append(evt.After);
                builder.Append(" reason=");
                builder.Append(evt.Reason);
                builder.Append(" winner=");
                builder.Append(evt.Winner);
                builder.Append(" cause=");
                builder.Append(string.Join("/", evt.Cause));
                builder.Append('\n');
            }

            return builder.ToString();
        }

        private static string OptionIds(Decision decision)
        {
            var ids = new List<string>();
            for (int i = 0; i < decision.Options.Length; i++)
            {
                ids.Add(decision.Options[i].Id);
            }

            return string.Join(", ", ids);
        }

        private static void AssertEqual(string path, string label, string field, object? expected, object? actual)
        {
            if (!Equals(expected, actual))
            {
                Assert.Fail(path + " " + label + " 的 " + field + " 是 " + actual + "，期望 " + expected + "。");
            }
        }

        private static void AssertEqual(string where, string field, object? expected, object? actual)
        {
            if (!Equals(expected, actual))
            {
                Assert.Fail(where + " 的 " + field + " 是 " + actual + "，期望 " + expected + "。");
            }
        }
    }
}
