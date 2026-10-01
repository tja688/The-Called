using System;
using System.Globalization;
using System.IO;
using System.Text;

namespace Pcd.Sim
{
    public static class SimProgram
    {
        public const string Usage =
            "用法：\n" +
            "  pcd-sim version\n" +
            "  pcd-sim play [--seed N] [--auto] [--max N] [--replay-out FILE]\n" +
            "  pcd-sim batch --games N [--seed N] [--max N] [--matrix]\n" +
            "  pcd-sim replay --file FILE [--snapshot-at N --snapshot-out FILE]\n" +
            "  pcd-sim scenario --file FILE [--auto] [--max N]\n" +
            "  pcd-sim explain [card-id]\n" +
            "  pcd-sim explain --file FILE\n" +
            "  pcd-sim quote\n" +
            "  pcd-sim tables\n" +
            "  pcd-sim golden record --dir DIR [--seed N] [--max N]\n" +
            "  pcd-sim golden diff --dir DIR\n";

        public static int Main(string[] args)
        {
            Console.OutputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
            return Run(args, Console.Out, Console.Error, Console.In);
        }

        public static int Run(string[] args, TextWriter stdout, TextWriter stderr)
        {
            return Run(args, stdout, stderr, TextReader.Null);
        }

        public static int Run(string[] args, TextWriter stdout, TextWriter stderr, TextReader stdin)
        {
            if (args == null || args.Length == 0 || (args.Length == 1 && args[0] == "version"))
            {
                stdout.Write(Pcd.Kernel.KernelVersion.Text);
                stdout.Write('\n');
                return 0;
            }

            string command = args[0];
            if (command == "explain")
            {
                return MatchCommands.Explain(args, stdout, stderr);
            }

            if (command == "quote")
            {
                return MatchCommands.Quote(stdout, stderr);
            }

            if (command == "tables")
            {
                return MatchCommands.Tables(stdout, stderr);
            }

            if (command == "golden")
            {
                return MatchCommands.Golden(args, stdout, stderr);
            }

            var options = new SimOptions();
            if (!options.Parse(args, stderr))
            {
                stderr.Write(Usage);
                return 1;
            }

            try
            {
                switch (command)
                {
                    case "play":
                        return MatchCommands.Play(options, stdout, stderr, stdin);
                    case "batch":
                        return MatchCommands.Batch(options, stdout, stderr);
                    case "replay":
                        return MatchCommands.Replay(options, stdout, stderr);
                    case "scenario":
                        return MatchCommands.Scenario(options, stdout, stderr, stdin);
                    default:
                        stderr.Write(Usage);
                        return 1;
                }
            }
            catch (Exception ex)
            {
                stderr.Write(ex.Message);
                stderr.Write('\n');
                return 1;
            }
        }
    }

    internal sealed class SimOptions
    {
        public ulong Seed = 1;
        public int Games;
        public int Max = 400;
        public bool Auto;
        public bool Matrix;
        public string? ReplayOut;
        public string? File;
        public string? Dir;
        public int SnapshotAt = -1;
        public string? SnapshotOut;

        public bool Parse(string[] args, TextWriter stderr)
        {
            for (int i = 1; i < args.Length; i++)
            {
                string arg = args[i];
                switch (arg)
                {
                    case "--auto":
                        Auto = true;
                        break;
                    case "--matrix":
                        Matrix = true;
                        break;
                    case "--seed":
                        if (!TryULong(args, ref i, out Seed))
                        {
                            stderr.Write("缺少 --seed 的数值。\n");
                            return false;
                        }

                        break;
                    case "--games":
                        if (!TryInt(args, ref i, out Games))
                        {
                            stderr.Write("缺少 --games 的数值。\n");
                            return false;
                        }

                        break;
                    case "--max":
                        if (!TryInt(args, ref i, out Max))
                        {
                            stderr.Write("缺少 --max 的数值。\n");
                            return false;
                        }

                        break;
                    case "--replay-out":
                        if (!TryText(args, ref i, out ReplayOut))
                        {
                            stderr.Write("缺少 --replay-out 的路径。\n");
                            return false;
                        }

                        break;
                    case "--file":
                        if (!TryText(args, ref i, out File))
                        {
                            stderr.Write("缺少 --file 的路径。\n");
                            return false;
                        }

                        break;
                    case "--dir":
                        if (!TryText(args, ref i, out Dir))
                        {
                            stderr.Write("缺少 --dir 的路径。\n");
                            return false;
                        }

                        break;
                    case "--snapshot-at":
                        if (!TryInt(args, ref i, out SnapshotAt))
                        {
                            stderr.Write("缺少 --snapshot-at 的数值。\n");
                            return false;
                        }

                        break;
                    case "--snapshot-out":
                        if (!TryText(args, ref i, out SnapshotOut))
                        {
                            stderr.Write("缺少 --snapshot-out 的路径。\n");
                            return false;
                        }

                        break;
                    default:
                        stderr.Write("未知参数：" + arg + "\n");
                        return false;
                }
            }

            return true;
        }

        private static bool TryText(string[] args, ref int index, out string? value)
        {
            if (index + 1 >= args.Length)
            {
                value = null;
                return false;
            }

            index++;
            value = args[index];
            return true;
        }

        private static bool TryInt(string[] args, ref int index, out int value)
        {
            value = 0;
            if (index + 1 >= args.Length)
            {
                return false;
            }

            index++;
            return int.TryParse(args[index], NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        }

        private static bool TryULong(string[] args, ref int index, out ulong value)
        {
            value = 0;
            if (index + 1 >= args.Length)
            {
                return false;
            }

            index++;
            return ulong.TryParse(args[index], NumberStyles.Integer, CultureInfo.InvariantCulture, out value);
        }
    }
}
