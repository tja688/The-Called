using System;
using System.IO;
using NUnit.Framework;
using Pcd.Sim;

namespace Pcd.Kernel.Tests
{
    public sealed class SimCommandTests
    {
        [Test]
        public void Auto_play_prints_a_board_options_and_a_result()
        {
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(new[] { "play", "--seed", "1", "--auto", "--max", "200" }, stdout, stderr);

            string text = stdout.ToString();
            Assert.That(code, Is.EqualTo(0), stderr.ToString() + text);
            Assert.That(text, Does.Contain("选项"));
            Assert.That(text, Does.Contain("亮出意图"));
            Assert.That(text, Does.Contain("格5"));
            Assert.That(text, Does.Contain("\"winner\""));
            Assert.That(stderr.ToString(), Is.Empty);
        }

        [Test]
        public void Scripted_play_accepts_option_numbers()
        {
            var stdout = new StringWriter();
            var stderr = new StringWriter();
            var stdin = new StringReader(string.Join("\n", System.Linq.Enumerable.Repeat("1", 200)) + "\n");

            int code = SimProgram.Run(new[] { "play", "--seed", "1", "--max", "200" }, stdout, stderr, stdin);

            Assert.That(code, Is.EqualTo(0), stderr.ToString());
            Assert.That(stdout.ToString(), Does.Contain("选择："));
        }

        [Test]
        public void Batch_prints_win_counts_and_json()
        {
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(new[] { "batch", "--games", "20", "--seed", "1" }, stdout, stderr);

            string text = stdout.ToString();
            Assert.That(code, Is.EqualTo(0), stderr.ToString());
            Assert.That(text, Does.Contain("玩家胜"));
            Assert.That(text, Does.Contain("平均回合"));
            Assert.That(text, Does.Contain("\"games\":20"));
            Assert.That(text, Does.Contain("\"totalRounds\""));
        }

        [Test]
        public void Replay_prints_events_and_can_export_a_snapshot()
        {
            string dir = Path.Combine(Path.GetTempPath(), "pcd-sim-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            try
            {
                string replayPath = Path.Combine(dir, "replay.json");
                string snapshotPath = Path.Combine(dir, "step.json");
                var playOut = new StringWriter();
                var playErr = new StringWriter();
                int play = SimProgram.Run(
                    new[] { "play", "--seed", "1", "--auto", "--max", "200", "--replay-out", replayPath },
                    playOut,
                    playErr);
                Assert.That(play, Is.EqualTo(0), playErr.ToString());

                var stdout = new StringWriter();
                var stderr = new StringWriter();
                int code = SimProgram.Run(
                    new[] { "replay", "--file", replayPath, "--snapshot-at", "1", "--snapshot-out", snapshotPath },
                    stdout,
                    stderr);

                string text = stdout.ToString();
                Assert.That(code, Is.EqualTo(0), stderr.ToString() + text);
                Assert.That(text, Does.Contain("入场"));
                Assert.That(text, Does.Contain("\"type\":\"card-entered\""));
                string snapshot = File.ReadAllText(snapshotPath);
                Assert.That(snapshot, Does.Contain("\"snapshot\":2"));
                Assert.That(snapshot, Does.Contain("\"nextEvent\":2"));
            }
            finally
            {
                Directory.Delete(dir, true);
            }
        }
    }
}
