using System;
using System.Globalization;
using System.IO;
using System.Text;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.Sim
{
    internal static class MatchCommands
    {
        public static int Play(SimOptions options, TextWriter stdout, TextWriter stderr, TextReader stdin)
        {
            if (options.Max < 1)
            {
                stderr.Write("决策上限至少为 1。\n");
                return 1;
            }

            ContentCatalog catalog = RepoCatalog.LoadBlank();
            MatchSetup setup = DefaultSetup(catalog, options.Seed);
            stdout.Write("# 白板对局\n\n");
            stdout.Write("种子 ");
            stdout.Write(options.Seed.ToString(CultureInfo.InvariantCulture));
            stdout.Write('\n');
            if (options.Auto)
            {
                PlayoutResult result = AiPlayout.Play(catalog, setup, options.Max, step =>
                {
                    WriteEvents(stdout, catalog, step.Events);
                    if (step.Pending != null && step.View != null)
                    {
                        WriteBoard(stdout, catalog, step.View);
                        WriteOptions(stdout, catalog, step.View, step.Pending);
                        if (step.Choice != null)
                        {
                            WriteChoice(stdout, catalog, step.View, step.Pending, step.Choice);
                        }
                    }
                });
                WriteEnding(stdout, result);
                if (!string.IsNullOrEmpty(options.ReplayOut))
                {
                    File.WriteAllText(options.ReplayOut, result.ReplayJson);
                }

                return result.Winner == "unfinished" ? 2 : 0;
            }

            return PlayHuman(catalog, setup, options, stdout, stderr, stdin);
        }

        public static int Batch(SimOptions options, TextWriter stdout, TextWriter stderr)
        {
            if (options.Games < 1)
            {
                stderr.Write("批量模拟需要 --games。\n");
                stderr.Write(SimProgram.Usage);
                return 1;
            }

            if (options.Max < 1)
            {
                stderr.Write("决策上限至少为 1。\n");
                return 1;
            }

            if (options.Matrix)
            {
                return BatchMatrix(options, stdout);
            }

            ContentCatalog catalog = RepoCatalog.LoadBlank();
            var row = new MatchupReport
            {
                DeckId = "default",
                DeckName = "白板",
                MonsterId = catalog.DefaultMonster ?? "",
                MonsterName = catalog.DefaultMonster == null ? "" : catalog.NameOf(catalog.DefaultMonster)
            };
            for (int i = 0; i < options.Games; i++)
            {
                MatchSetup setup = DefaultSetup(catalog, options.Seed + (ulong)i);
                PlayoutResult result = RandomPlayout.Play(catalog, setup, options.Max, null);
                MatchMetrics.Observe(row, setup.BuildDeck, result);
            }

            WriteBatch(stdout, new[] { row }, options.Seed);
            return 0;
        }

        public static int Scenario(SimOptions options, TextWriter stdout, TextWriter stderr, TextReader stdin)
        {
            if (string.IsNullOrEmpty(options.File))
            {
                stderr.Write("残局需要 --file。\n");
                stderr.Write(SimProgram.Usage);
                return 1;
            }

            if (options.Max < 1)
            {
                stderr.Write("决策上限至少为 1。\n");
                return 1;
            }

            string text = File.ReadAllText(options.File!);
            ContentCatalog? catalog = EmbeddedCatalog(options.File!, text);
            OpenedScenario opened = ScenarioFile.Open(text, catalog);
            stdout.Write("# 残局\n\n");
            if (options.Auto)
            {
                Personality personality = opened.Catalog.RequireMonster(opened.MonsterId).Personality.Copy();
                PlayoutResult result = AiPlayout.Continue(opened.Session, personality, opened.Seed, options.Max, step =>
                {
                    WriteEvents(stdout, opened.Catalog, step.Events);
                    if (step.Pending != null && step.View != null)
                    {
                        WriteBoard(stdout, opened.Catalog, step.View);
                        WriteOptions(stdout, opened.Catalog, step.View, step.Pending);
                        if (step.Choice != null)
                        {
                            WriteChoice(stdout, opened.Catalog, step.View, step.Pending, step.Choice);
                        }
                    }
                });
                WriteEnding(stdout, result);
                return result.Winner == "unfinished" ? 2 : 0;
            }

            return PlayOpened(opened, options, stdout, stderr, stdin);
        }

        public static int Golden(string[] args, TextWriter stdout, TextWriter stderr)
        {
            if (args.Length < 2 || (args[1] != "record" && args[1] != "diff"))
            {
                stderr.Write("golden 需要 record 或 diff。\n");
                stderr.Write(SimProgram.Usage);
                return 1;
            }

            string? dir = null;
            ulong seed = 1;
            int max = 80;
            for (int i = 2; i < args.Length; i++)
            {
                if (args[i] == "--dir" && i + 1 < args.Length)
                {
                    dir = args[++i];
                    continue;
                }

                if (args[i] == "--seed" && i + 1 < args.Length && ulong.TryParse(args[i + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out ulong parsedSeed))
                {
                    seed = parsedSeed;
                    i++;
                    continue;
                }

                if (args[i] == "--max" && i + 1 < args.Length && int.TryParse(args[i + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int parsedMax))
                {
                    max = parsedMax;
                    i++;
                    continue;
                }

                stderr.Write("未知参数：" + args[i] + "\n");
                return 1;
            }

            if (string.IsNullOrEmpty(dir))
            {
                stderr.Write("golden 需要 --dir。\n");
                return 1;
            }

            if (max < 1)
            {
                stderr.Write("决策上限至少为 1。\n");
                return 1;
            }

            ContentCatalog catalog = RepoCatalog.LoadRules();
            if (args[1] == "record")
            {
                stdout.Write(BehaviorArchive.Record(catalog, dir!, seed, max));
                return 0;
            }

            stdout.Write(BehaviorArchive.Diff(catalog, dir!));
            return 0;
        }

        public static int Replay(SimOptions options, TextWriter stdout, TextWriter stderr)
        {
            if (string.IsNullOrEmpty(options.File))
            {
                stderr.Write("回放需要 --file。\n");
                stderr.Write(SimProgram.Usage);
                return 1;
            }

            bool wantSnapshot = options.SnapshotAt >= 0 || !string.IsNullOrEmpty(options.SnapshotOut);
            if (wantSnapshot && (options.SnapshotAt < 0 || string.IsNullOrEmpty(options.SnapshotOut)))
            {
                stderr.Write("导出快照需要同时给出 --snapshot-at 和 --snapshot-out。\n");
                return 1;
            }

            string json = File.ReadAllText(options.File!);
            ContentCatalog catalog = RepoCatalog.LoadBlank();
            MatchSession session = MatchSession.PlayReplay(json, catalog, wantSnapshot ? options.SnapshotAt : -1);
            stdout.Write("# 录像\n\n");
            WriteEvents(stdout, catalog, session.Events);
            MatchView view = session.View("omniscient");
            if (view.Winner == null)
            {
                stdout.Write("\n结果：未结束\n");
            }
            else
            {
                stdout.Write("\n结果：");
                stdout.Write(WinnerName(view.Winner));
                stdout.Write("（");
                stdout.Write(ReasonName(view.EndReason));
                stdout.Write("） 第");
                stdout.Write(view.Round.ToString(CultureInfo.InvariantCulture));
                stdout.Write("回合\n");
            }

            stdout.Write('\n');
            stdout.Write(session.ToEventLog());
            stdout.Write('\n');
            if (wantSnapshot)
            {
                if (string.IsNullOrEmpty(session.CapturedSnapshot))
                {
                    stderr.Write("录像里没有序号为 " + options.SnapshotAt.ToString(CultureInfo.InvariantCulture) + " 的事件。\n");
                    return 1;
                }

                File.WriteAllText(options.SnapshotOut!, session.CapturedSnapshot);
                stdout.Write("快照：");
                stdout.Write(options.SnapshotOut);
                stdout.Write('\n');
            }

            return 0;
        }

        private static int PlayHuman(ContentCatalog catalog, MatchSetup setup, SimOptions options, TextWriter stdout, TextWriter stderr, TextReader stdin)
        {
            MatchSession session = MatchSession.Start(catalog, setup);
            Personality personality = catalog.RequireMonster(setup.MonsterId).Personality.Copy();
            AdvanceResult step = session.Advance();
            int decisions = 0;
            while (step.Result == null)
            {
                if (step.Pending == null)
                {
                    throw new InvalidOperationException("对局停在没有决策的地方。");
                }

                WriteEvents(stdout, catalog, step.Events);
                MatchView view = session.View("omniscient");
                WriteBoard(stdout, catalog, view);
                WriteOptions(stdout, catalog, view, step.Pending);
                if (decisions >= options.Max)
                {
                    WriteUnfinished(stdout, session);
                    return 2;
                }

                string choice;
                if (step.Pending.Actor == "monster")
                {
                    choice = MonsterAi.Choose(session, step.Pending, personality, DecisionSeed.Mix(setup.Seed, 0, step.Pending.Id)).Choice;
                }
                else
                {
                    string? line = stdin.ReadLine();
                    if (line == null)
                    {
                        stderr.Write("没有输入。\n");
                        return 1;
                    }

                    if (!int.TryParse(line.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int number)
                        || number < 1
                        || number > step.Pending.Options.Length)
                    {
                        stderr.Write("请输入选项编号。\n");
                        return 1;
                    }

                    choice = step.Pending.Options[number - 1].Id;
                }

                WriteChoice(stdout, catalog, view, step.Pending, choice);
                decisions++;
                step = session.SubmitAndAdvance(choice);
            }

            WriteEvents(stdout, catalog, step.Events);
            var finished = new PlayoutResult
            {
                Winner = step.Result!.Winner,
                Reason = step.Result.Reason,
                Rounds = step.Result.Rounds,
                Decisions = decisions,
                Hash = session.EventHash(),
                ReplayJson = session.HasSetup ? session.ToReplay() : "null",
                Session = session
            };
            WriteEnding(stdout, finished);
            if (!string.IsNullOrEmpty(options.ReplayOut))
            {
                File.WriteAllText(options.ReplayOut, finished.ReplayJson);
            }

            return 0;
        }

        private static int BatchMatrix(SimOptions options, TextWriter stdout)
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            var rows = new System.Collections.Generic.List<MatchupReport>();
            int index = 0;
            for (int d = 0; d < catalog.Decks.Length; d++)
            {
                DeckDefinition deck = catalog.Decks[d];
                for (int m = 0; m < catalog.Monsters.Length; m++)
                {
                    MonsterDefinition monster = catalog.Monsters[m];
                    var row = new MatchupReport
                    {
                        DeckId = deck.Id,
                        DeckName = deck.Name,
                        MonsterId = monster.Id,
                        MonsterName = monster.Name
                    };
                    for (int g = 0; g < options.Games; g++)
                    {
                        var setup = new MatchSetup
                        {
                            Seed = options.Seed + (ulong)index,
                            MonsterId = monster.Id,
                            BuildDeck = deck.Cards,
                            OpportunitiesPerTurn = 1
                        };
                        index++;
                        PlayoutResult result = AiPlayout.Play(catalog, setup, options.Max, null);
                        MatchMetrics.Observe(row, deck.Cards, result);
                    }

                    rows.Add(row);
                }
            }

            WriteBatch(stdout, rows.ToArray(), options.Seed);
            return 0;
        }

        private static void WriteBatch(TextWriter stdout, MatchupReport[] rows, ulong seed)
        {
            stdout.Write(MatchMetrics.Markdown(rows));
            stdout.Write('\n');
            stdout.Write(MatchMetrics.Json(rows, seed));
            stdout.Write('\n');
        }

        private static ContentCatalog? EmbeddedCatalog(string path, string text)
        {
            YamlNode doc = YamlNode.Parse(text);
            string? catalogPath = doc.Str("catalog");
            if (catalogPath == null)
            {
                return null;
            }

            string? folder = Path.GetDirectoryName(path);
            string full = folder == null ? catalogPath : Path.Combine(folder, catalogPath);
            return ContentCatalog.Parse(File.ReadAllText(full));
        }

        private static int PlayOpened(OpenedScenario opened, SimOptions options, TextWriter stdout, TextWriter stderr, TextReader stdin)
        {
            Personality personality = opened.Catalog.RequireMonster(opened.MonsterId).Personality.Copy();
            AdvanceResult step = opened.Session.Advance();
            int decisions = 0;
            while (step.Result == null)
            {
                if (step.Pending == null)
                {
                    throw new InvalidOperationException("对局停在没有决策的地方。");
                }

                WriteEvents(stdout, opened.Catalog, step.Events);
                MatchView view = opened.Session.View("omniscient");
                WriteBoard(stdout, opened.Catalog, view);
                WriteOptions(stdout, opened.Catalog, view, step.Pending);
                if (decisions >= options.Max)
                {
                    WriteUnfinished(stdout, opened.Session);
                    return 2;
                }

                string choice;
                if (step.Pending.Actor == "monster")
                {
                    choice = MonsterAi.Choose(opened.Session, step.Pending, personality, DecisionSeed.Mix(opened.Seed, 0, step.Pending.Id)).Choice;
                }
                else
                {
                    string? line = stdin.ReadLine();
                    if (line == null)
                    {
                        stderr.Write("没有输入。\n");
                        return 1;
                    }

                    if (!int.TryParse(line.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int number)
                        || number < 1
                        || number > step.Pending.Options.Length)
                    {
                        stderr.Write("请输入选项编号。\n");
                        return 1;
                    }

                    choice = step.Pending.Options[number - 1].Id;
                }

                WriteChoice(stdout, opened.Catalog, view, step.Pending, choice);
                decisions++;
                step = opened.Session.SubmitAndAdvance(choice);
            }

            WriteEvents(stdout, opened.Catalog, step.Events);
            WriteEnding(stdout, new PlayoutResult
            {
                Winner = step.Result!.Winner,
                Reason = step.Result.Reason,
                Rounds = step.Result.Rounds,
                Decisions = decisions,
                Hash = opened.Session.EventHash(),
                ReplayJson = opened.Session.HasSetup ? opened.Session.ToReplay() : "null",
                Session = opened.Session
            });
            return 0;
        }

        private static int ExplainFile(string path, TextWriter stdout, TextWriter stderr)
        {
            string text = File.ReadAllText(path);
            OpenedScenario opened = ScenarioFile.Open(text, EmbeddedCatalog(path, text));
            AdvanceResult step = opened.Session.Advance();
            if (step.Pending == null || step.Pending.Actor != "monster")
            {
                stderr.Write("这个残局停下来时不是怪物在决定落点。\n");
                return 1;
            }

            Personality personality = opened.Catalog.RequireMonster(opened.MonsterId).Personality.Copy();
            AiReport report = MonsterAi.Choose(
                opened.Session,
                step.Pending,
                personality,
                DecisionSeed.Mix(opened.Seed, 0, step.Pending.Id));
            string? intent = opened.Session.View("public").RevealedIntent;
            stdout.Write(report.ToMarkdown(opened.Catalog, intent));
            stdout.Write('\n');
            stdout.Write(report.ToJson());
            stdout.Write('\n');
            return 0;
        }

        private static MatchSetup DefaultSetup(ContentCatalog catalog, ulong seed)
        {
            if (catalog.DefaultMonster == null)
            {
                throw new InvalidOperationException("白板内容没有默认怪物。");
            }

            return new MatchSetup
            {
                Seed = seed,
                MonsterId = catalog.DefaultMonster,
                BuildDeck = catalog.DefaultDeck,
                OpportunitiesPerTurn = 1
            };
        }

        private static void WriteEnding(TextWriter stdout, PlayoutResult result)
        {
            stdout.Write("\n结果：");
            stdout.Write(WinnerName(result.Winner));
            if (result.Winner != "unfinished")
            {
                stdout.Write("（");
                stdout.Write(ReasonName(result.Reason));
                stdout.Write("） 第");
                stdout.Write(result.Rounds.ToString(CultureInfo.InvariantCulture));
                stdout.Write("回合");
            }

            stdout.Write("\n\n{\"winner\":\"");
            stdout.Write(result.Winner);
            stdout.Write("\",\"reason\":\"");
            stdout.Write(result.Reason);
            stdout.Write("\",\"rounds\":");
            stdout.Write(result.Rounds.ToString(CultureInfo.InvariantCulture));
            stdout.Write(",\"decisions\":");
            stdout.Write(result.Decisions.ToString(CultureInfo.InvariantCulture));
            stdout.Write(",\"hash\":\"");
            stdout.Write(result.Hash);
            stdout.Write("\",\"replay\":");
            stdout.Write(result.ReplayJson);
            stdout.Write("}\n");
        }

        private static void WriteUnfinished(TextWriter stdout, MatchSession session)
        {
            var result = new PlayoutResult
            {
                Winner = "unfinished",
                Reason = "max-decisions",
                Rounds = session.View("omniscient").Round,
                Hash = session.EventHash(),
                ReplayJson = session.HasSetup ? session.ToReplay() : "null",
                Session = session
            };
            WriteEnding(stdout, result);
        }

        private static void WriteEvents(TextWriter stdout, ContentCatalog catalog, System.Collections.Generic.IReadOnlyList<GameEvent> events)
        {
            for (int i = 0; i < events.Count; i++)
            {
                stdout.Write(events[i].Seq.ToString(CultureInfo.InvariantCulture));
                stdout.Write(". ");
                stdout.Write(Describe(catalog, events[i]));
                stdout.Write('\n');
            }
        }

        private static void WriteBoard(TextWriter stdout, ContentCatalog catalog, MatchView view)
        {
            stdout.Write('\n');
            stdout.Write("第");
            stdout.Write(view.Round.ToString(CultureInfo.InvariantCulture));
            stdout.Write("回合  ");
            stdout.Write(PhaseName(view.Phase));
            if (view.Phase == "player-action")
            {
                stdout.Write("  出牌机会 ");
                stdout.Write(view.RemainingOpportunities.ToString(CultureInfo.InvariantCulture));
            }

            stdout.Write("\n意图：");
            stdout.Write(view.RevealedIntent == null ? "无" : catalog.NameOf(view.RevealedIntent));
            stdout.Write("\n\n");
            for (int row = 0; row < 3; row++)
            {
                for (int col = 0; col < 3; col++)
                {
                    if (col > 0)
                    {
                        stdout.Write(" | ");
                    }

                    ViewCell cell = view.Cells[(row * 3) + col];
                    stdout.Write("格");
                    stdout.Write(cell.Cell.ToString(CultureInfo.InvariantCulture));
                    stdout.Write(' ');
                    if (cell.Card == null)
                    {
                        stdout.Write(cell.Polluted ? "污染" : "空");
                    }
                    else
                    {
                        WriteCardFace(stdout, catalog, cell.Card.CardId);
                        stdout.Write(' ');
                        stdout.Write(cell.Card.CurrentPoints.ToString(CultureInfo.InvariantCulture));
                        if (cell.Polluted)
                        {
                            stdout.Write(" 污染");
                        }
                    }
                }

                stdout.Write('\n');
            }

            stdout.Write("\n玩家总点数 ");
            stdout.Write(view.PlayerPoints.ToString(CultureInfo.InvariantCulture));
            stdout.Write(" 占格 ");
            stdout.Write(view.PlayerOccupancy.ToString(CultureInfo.InvariantCulture));
            stdout.Write("    怪物总点数 ");
            stdout.Write(view.MonsterPoints.ToString(CultureInfo.InvariantCulture));
            stdout.Write(" 占格 ");
            stdout.Write(view.MonsterOccupancy.ToString(CultureInfo.InvariantCulture));
            stdout.Write("\n手牌：");
            if (view.Hand.Length == 0)
            {
                stdout.Write("无");
            }
            else
            {
                for (int i = 0; i < view.Hand.Length; i++)
                {
                    if (i > 0)
                    {
                        stdout.Write("、");
                    }

                    WriteCardFace(stdout, catalog, view.Hand[i].CardId);
                    if (!view.Hand[i].IsSpell)
                    {
                        stdout.Write(' ');
                        stdout.Write(view.Hand[i].CurrentPoints.ToString(CultureInfo.InvariantCulture));
                    }
                }
            }

            stdout.Write("\n牌组 ");
            stdout.Write(view.MatchDeckCount.ToString(CultureInfo.InvariantCulture));
            stdout.Write("  玩家弃牌 ");
            stdout.Write(view.PlayerDiscardCount.ToString(CultureInfo.InvariantCulture));
            stdout.Write("  怪物弃牌 ");
            stdout.Write(view.MonsterDiscardCount.ToString(CultureInfo.InvariantCulture));
            stdout.Write("\n");
        }

        public static int Explain(string[] args, TextWriter stdout, TextWriter stderr)
        {
            if (args.Length >= 2 && args[1] == "--file")
            {
                if (args.Length != 3)
                {
                    stderr.Write("explain --file 需要一个残局路径。\n");
                    return 1;
                }

                return ExplainFile(args[2], stdout, stderr);
            }

            ContentCatalog catalog = RepoCatalog.LoadRules();
            if (args.Length > 2)
            {
                stderr.Write("explain 只接受一个卡牌标识。\n");
                return 1;
            }

            if (args.Length == 2)
            {
                try
                {
                    catalog.RequireCard(args[1]);
                }
                catch (ContentException ex)
                {
                    stderr.Write(ex.Message);
                    stderr.Write('\n');
                    return 1;
                }

                WriteExplained(stdout, catalog, args[1]);
                return 0;
            }

            for (int i = 0; i < catalog.Cards.Length; i++)
            {
                WriteExplained(stdout, catalog, catalog.Cards[i].Id);
            }

            return 0;
        }

        public static int Tables(TextWriter stdout, TextWriter stderr)
        {
            try
            {
                ContentCatalog catalog = RepoCatalog.LoadRules();
                stdout.Write("<!-- generated:science -->\n");
                stdout.Write(CardTables.School(catalog, "science"));
                stdout.Write("<!-- /generated:science -->\n");
                stdout.Write("<!-- generated:mystery -->\n");
                stdout.Write(CardTables.School(catalog, "mystery"));
                stdout.Write("<!-- /generated:mystery -->\n");
                stdout.Write("<!-- generated:religion -->\n");
                stdout.Write(CardTables.School(catalog, "religion"));
                stdout.Write("<!-- /generated:religion -->\n");
                stdout.Write("<!-- generated:neutral -->\n");
                stdout.Write(CardTables.School(catalog, "neutral"));
                stdout.Write("<!-- /generated:neutral -->\n");
                stdout.Write("<!-- generated:backs -->\n");
                stdout.Write(CardTables.Backs(catalog));
                stdout.Write("<!-- /generated:backs -->\n");
                return 0;
            }
            catch (ContentException ex)
            {
                stderr.Write(ex.Message);
                stderr.Write('\n');
                return 1;
            }
        }

        public static int Quote(TextWriter stdout, TextWriter stderr)
        {
            try
            {
                stdout.Write(LoadQuote.Report(RepoCatalog.LoadRules()));
                return 0;
            }
            catch (ContentException ex)
            {
                stderr.Write(ex.Message);
                stderr.Write('\n');
                return 1;
            }
        }

        private static void WriteExplained(TextWriter stdout, ContentCatalog catalog, string cardId)
        {
            stdout.Write(catalog.NameOf(cardId));
            stdout.Write('\n');
            string text = catalog.TextOf(cardId);
            stdout.Write(text.Length == 0 ? "无" : text);
            stdout.Write('\n');
        }

        private static void WriteCardFace(TextWriter stdout, ContentCatalog catalog, string cardId)
        {
            stdout.Write(catalog.NameOf(cardId));
            string text = catalog.TextOf(cardId);
            if (text.Length > 0)
            {
                stdout.Write('（');
                stdout.Write(text);
                stdout.Write('）');
            }
        }

        private static void WriteOptions(TextWriter stdout, ContentCatalog catalog, MatchView view, Decision decision)
        {
            stdout.Write("\n选项：\n");
            for (int i = 0; i < decision.Options.Length; i++)
            {
                stdout.Write((i + 1).ToString(CultureInfo.InvariantCulture));
                stdout.Write(". ");
                stdout.Write(OptionLabel(catalog, view, decision.Options[i]));
                stdout.Write('\n');
            }
        }

        private static void WriteChoice(TextWriter stdout, ContentCatalog catalog, MatchView view, Decision decision, string choice)
        {
            int number = 0;
            Option? chosen = null;
            for (int i = 0; i < decision.Options.Length; i++)
            {
                if (decision.Options[i].Id == choice)
                {
                    number = i + 1;
                    chosen = decision.Options[i];
                    break;
                }
            }

            stdout.Write("选择：");
            stdout.Write(number.ToString(CultureInfo.InvariantCulture));
            if (chosen != null)
            {
                stdout.Write(' ');
                stdout.Write(OptionLabel(catalog, view, chosen));
            }

            stdout.Write('\n');
        }

        private static string OptionLabel(ContentCatalog catalog, MatchView view, Option option)
        {
            if (option.Kind == "end-turn")
            {
                return "结束回合";
            }

            string name = option.CardId == null ? "" : catalog.NameOf(option.CardId);
            if (option.Kind == "cast")
            {
                return "打出 " + name;
            }

            if (option.Kind == "cell")
            {
                return CellLabel("落在", name, option.Cell, view);
            }

            return CellLabel("打出 " + name + " →", "", option.Cell, view);
        }

        private static string CellLabel(string prefix, string name, int cell, MatchView view)
        {
            var builder = new StringBuilder();
            builder.Append(prefix);
            if (name.Length > 0)
            {
                builder.Append(' ');
                builder.Append(name);
            }

            builder.Append(" 格");
            builder.Append(cell.ToString(CultureInfo.InvariantCulture));
            if (cell >= 1 && cell <= 9 && view.Cells[cell - 1].Card != null)
            {
                builder.Append("（覆盖）");
            }

            return builder.ToString();
        }

        private static string Describe(ContentCatalog catalog, GameEvent evt)
        {
            string name = evt.Card == null ? "" : catalog.NameOf(evt.Card);
            switch (evt.Type)
            {
                case EventTypes.CardEntered:
                    return "入场 " + name + " 格" + Format(evt.Cell) + " " + SideName(evt.Owner);
                case EventTypes.CardDrawn:
                    return "抽牌 " + name;
                case EventTypes.DrawSkipped:
                    return evt.Reason == "hand-full" ? "手牌已满，不抽牌" : "牌组已空，不抽牌";
                case EventTypes.IntentRevealed:
                    return "亮出意图 " + name;
                case EventTypes.TurnStarted:
                    return SideName(evt.Owner) + "回合开始 第" + Format(evt.Round) + "回合";
                case EventTypes.TurnEnded:
                    return SideName(evt.Owner) + "回合结束";
                case EventTypes.CardPlayed:
                    return evt.Cell.HasValue && evt.Cell.Value > 0
                        ? "打出 " + name + " → 格" + evt.Cell.Value.ToString(CultureInfo.InvariantCulture)
                        : "打出 " + name;
                case EventTypes.CardRemoved:
                    return "移除 " + name + " " + ReasonName(evt.Reason);
                case EventTypes.CardDiscarded:
                    return "法术进入弃牌堆 " + name;
                case EventTypes.PointsChanged:
                    return "点数 " + name + " " + Format(evt.Before) + " → " + Format(evt.After) + " 来源 " + SourceName(evt.Source);
                case EventTypes.ActionSkipped:
                    return "无法行动 " + name;
                case EventTypes.MatchEnded:
                    return "对局结束 " + WinnerName(evt.Winner) + " " + ReasonName(evt.Reason);
                default:
                    return evt.Type;
            }
        }

        private static string Format(int? value)
        {
            return value.HasValue ? value.Value.ToString(CultureInfo.InvariantCulture) : "";
        }

        private static string SideName(string? side)
        {
            if (side == "player")
            {
                return "玩家";
            }

            if (side == "monster")
            {
                return "怪物";
            }

            return "";
        }

        private static string PhaseName(string phase)
        {
            switch (phase)
            {
                case "player-action": return "玩家行动";
                case "monster-action": return "怪物行动";
                case "player-turn-start": return "玩家回合开始";
                case "monster-turn-start": return "怪物回合开始";
                default: return phase;
            }
        }

        private static string WinnerName(string? winner)
        {
            switch (winner)
            {
                case "player": return "玩家胜利";
                case "monster": return "怪物胜利";
                case "draw": return "平局";
                case "unfinished": return "未结束";
                default: return winner ?? "";
            }
        }

        private static string ReasonName(string? reason)
        {
            switch (reason)
            {
                case "full-board": return "满格判定";
                case "resource": return "资源结算";
                case "special": return "特殊结算";
                case "cover": return "覆盖";
                case "tie-cover": return "同归于尽";
                case "points-zero": return "点数归零";
                case "spell": return "法术";
                case "no-legal-cell": return "没有合法落点";
                case "setup": return "初始摆放";
                case "play": return "打出";
                case "max-decisions": return "达到决策上限";
                default: return reason ?? "";
            }
        }

        private static string SourceName(string? source)
        {
            switch (source)
            {
                case "cover": return "覆盖";
                case "polluted-cell": return "污染格";
                default: return source ?? "";
            }
        }
    }
}
