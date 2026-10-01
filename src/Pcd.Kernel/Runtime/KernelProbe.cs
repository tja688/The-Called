using System;
using System.Globalization;
using System.Text;

namespace Pcd.Kernel
{
    public static class KernelProbe
    {
        private const int MinCount = 1;
        private const int MaxCount = 16;

        public static string Invoke(string requestJson)
        {
            if (requestJson == null)
            {
                throw new ArgumentNullException(nameof(requestJson));
            }

            ulong seed;
            int count;
            Parse(requestJson, out seed, out count);

            var rng = new DeterministicRng(seed);
            var values = new ulong[count];
            for (int i = 0; i < count; i++)
            {
                values[i] = rng.NextUInt64();
            }

            return Write(values);
        }

        private static void Parse(string json, out ulong seed, out int count)
        {
            int index = 0;
            Skip(json, ref index);
            Expect(json, ref index, '{');
            Skip(json, ref index);
            ExpectKey(json, ref index, "seed");
            Skip(json, ref index);
            Expect(json, ref index, ':');
            Skip(json, ref index);
            seed = ReadUInt64(json, ref index);
            Skip(json, ref index);
            Expect(json, ref index, ',');
            Skip(json, ref index);
            ExpectKey(json, ref index, "count");
            Skip(json, ref index);
            Expect(json, ref index, ':');
            Skip(json, ref index);
            ulong rawCount = ReadUInt64(json, ref index);
            Skip(json, ref index);
            Expect(json, ref index, '}');
            Skip(json, ref index);
            if (index != json.Length)
            {
                throw new ArgumentException("Invalid probe request.");
            }

            if (rawCount < (ulong)MinCount || rawCount > (ulong)MaxCount)
            {
                throw new ArgumentOutOfRangeException(nameof(count), "Probe count must be from 1 to 16.");
            }

            count = (int)rawCount;
        }

        private static string Write(ulong[] values)
        {
            var builder = new StringBuilder();
            builder.Append("{\"version\":\"");
            builder.Append(KernelVersion.Text);
            builder.Append("\",\"values\":[");
            for (int i = 0; i < values.Length; i++)
            {
                if (i > 0)
                {
                    builder.Append(',');
                }

                builder.Append(values[i].ToString(CultureInfo.InvariantCulture));
            }

            builder.Append("]}");
            return builder.ToString();
        }

        private static void Skip(string json, ref int index)
        {
            while (index < json.Length)
            {
                char c = json[index];
                if (c != ' ' && c != '\t' && c != '\r' && c != '\n')
                {
                    return;
                }

                index++;
            }
        }

        private static void Expect(string json, ref int index, char expected)
        {
            if (index >= json.Length || json[index] != expected)
            {
                throw new ArgumentException("Invalid probe request.");
            }

            index++;
        }

        private static void ExpectKey(string json, ref int index, string key)
        {
            Expect(json, ref index, '"');
            for (int i = 0; i < key.Length; i++)
            {
                if (index >= json.Length || json[index] != key[i])
                {
                    throw new ArgumentException("Invalid probe request.");
                }

                index++;
            }

            Expect(json, ref index, '"');
        }

        private static ulong ReadUInt64(string json, ref int index)
        {
            if (index >= json.Length || json[index] < '0' || json[index] > '9')
            {
                throw new ArgumentException("Invalid probe request.");
            }

            ulong value = 0;
            while (index < json.Length && json[index] >= '0' && json[index] <= '9')
            {
                int digit = json[index] - '0';
                try
                {
                    checked
                    {
                        value = (value * 10UL) + (ulong)digit;
                    }
                }
                catch (OverflowException)
                {
                    throw new ArgumentException("Invalid probe request.");
                }

                index++;
            }

            return value;
        }
    }
}
