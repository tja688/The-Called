using System;

namespace Pcd.Kernel
{
    /// <summary>
    /// SplitMix64 (Vigna 2015). The constructor stores the state word as given.
    /// The state is a single integer so a later snapshot can persist it.
    /// </summary>
    public sealed class DeterministicRng
    {
        private ulong _state;

        public DeterministicRng(ulong state)
        {
            _state = state;
        }

        public ulong State
        {
            get { return _state; }
        }

        public ulong NextUInt64()
        {
            unchecked
            {
                ulong z = _state + 0x9E3779B97F4A7C15UL;
                _state = z;
                z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
                z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
                return z ^ (z >> 31);
            }
        }

        /// <summary>
        /// Uniform enough for small ranges. Uses modulo so every runtime takes the same branch.
        /// </summary>
        public int NextInt(int exclusiveMax)
        {
            if (exclusiveMax <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(exclusiveMax));
            }

            return (int)(NextUInt64() % (ulong)exclusiveMax);
        }
    }
}
