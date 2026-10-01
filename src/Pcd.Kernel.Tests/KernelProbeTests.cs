using System;
using NUnit.Framework;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class KernelProbeTests
    {
        [Test]
        public void Invoke_returns_version_and_splitmix64_sequence()
        {
            // Seed 1234567, first five outputs: published SplitMix64 sample
            // (Rosetta Code, "Pseudo-random numbers/Splitmix64").
            const string request = "{\"seed\":1234567,\"count\":5}";
            const string expected =
                "{\"version\":\"0.1.0\",\"values\":[6457827717110365317,3203168211198807973,9817491932198370423,4593380528125082431,16408922859458223821]}";

            Assert.That(KernelProbe.Invoke(request), Is.EqualTo(expected));
        }

        [Test]
        public void Invoke_returns_splitmix64_sequence_for_another_seed()
        {
            // Seed 42, first output 0xBDD732262FEB6E95 from the SplitMix64 reference.
            const string request = "{\"seed\":42,\"count\":1}";
            const string expected = "{\"version\":\"0.1.0\",\"values\":[13679457532755275413]}";

            Assert.That(KernelProbe.Invoke(request), Is.EqualTo(expected));
        }

        [Test]
        public void Invoke_rejects_count_outside_1_to_16()
        {
            Assert.Throws<ArgumentOutOfRangeException>(() => KernelProbe.Invoke("{\"seed\":1,\"count\":0}"));
            Assert.Throws<ArgumentOutOfRangeException>(() => KernelProbe.Invoke("{\"seed\":1,\"count\":17}"));
        }

        [Test]
        public void Invoke_rejects_malformed_request()
        {
            Assert.Throws<ArgumentNullException>(() => KernelProbe.Invoke(null!));
            Assert.Throws<ArgumentException>(() => KernelProbe.Invoke("{\"count\":1,\"seed\":1}"));
        }
    }
}
