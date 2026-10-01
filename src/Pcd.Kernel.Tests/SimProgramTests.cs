using System;
using System.IO;
using NUnit.Framework;
using Pcd.Sim;

namespace Pcd.Kernel.Tests
{
    public sealed class SimProgramTests
    {
        [Test]
        public void Version_command_prints_kernel_version()
        {
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(new[] { "version" }, stdout, stderr);

            Assert.That(code, Is.EqualTo(0));
            Assert.That(stdout.ToString(), Is.EqualTo("0.1.0\n"));
            Assert.That(stderr.ToString(), Is.Empty);
        }

        [Test]
        public void No_arguments_prints_kernel_version()
        {
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(Array.Empty<string>(), stdout, stderr);

            Assert.That(code, Is.EqualTo(0));
            Assert.That(stdout.ToString(), Is.EqualTo("0.1.0\n"));
            Assert.That(stderr.ToString(), Is.Empty);
        }

        [Test]
        public void Explain_prints_generated_card_text()
        {
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(new[] { "explain", "card.c001" }, stdout, stderr);

            Assert.That(code, Is.EqualTo(0));
            Assert.That(stdout.ToString(), Does.Contain("弱点采样机"));
            Assert.That(stdout.ToString(), Does.Contain("入场：选择一张敌方卡牌，添加解析标记。"));
            Assert.That(stderr.ToString(), Is.Empty);
        }

        [Test]
        public void Unknown_command_prints_usage_and_fails()
        {
            var stdout = new StringWriter();
            var stderr = new StringWriter();

            int code = SimProgram.Run(new[] { "nope" }, stdout, stderr);

            Assert.That(code, Is.EqualTo(1));
            Assert.That(stdout.ToString(), Is.Empty);
            Assert.That(stderr.ToString(), Is.EqualTo(SimProgram.Usage));
        }
    }
}
