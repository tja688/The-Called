using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Pcd.Kernel
{
    public sealed class YamlNode
    {
        public bool IsNull { get; private set; }
        public bool IsScalar { get; private set; }
        public bool IsMap { get; private set; }
        public bool IsSequence { get; private set; }
        public string? Scalar { get; private set; }
        public List<YamlNode> Items { get; } = new List<YamlNode>();
        public List<string> Keys { get; } = new List<string>();
        public List<YamlNode> Values { get; } = new List<YamlNode>();

        public static YamlNode Parse(string text)
        {
            return YamlParser.Parse(text);
        }

        public bool Has(string key)
        {
            return IndexOf(key) >= 0;
        }

        public YamlNode? Get(string key)
        {
            int index = IndexOf(key);
            if (index < 0)
            {
                return null;
            }

            YamlNode node = Values[index];
            if (node.IsNull)
            {
                return null;
            }

            return node;
        }

        public string? Str(string key)
        {
            YamlNode? node = Get(key);
            if (node == null)
            {
                return null;
            }

            if (!node.IsScalar || node.Scalar == null)
            {
                throw new FormatException("字段 " + key + " 应该是标量。");
            }

            return node.Scalar;
        }

        public int Int(string key)
        {
            string? text = Str(key);
            if (text == null || !int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out int value))
            {
                throw new FormatException("字段 " + key + " 应该是整数。");
            }

            return value;
        }

        internal static YamlNode Null()
        {
            return new YamlNode { IsNull = true };
        }

        internal static YamlNode FromScalar(string text)
        {
            return new YamlNode { IsScalar = true, Scalar = text };
        }

        internal static YamlNode Map()
        {
            return new YamlNode { IsMap = true };
        }

        internal static YamlNode Sequence()
        {
            return new YamlNode { IsSequence = true };
        }

        internal void Put(string key, YamlNode value)
        {
            if (IndexOf(key) >= 0)
            {
                throw new FormatException("YAML 键重复：" + key);
            }

            Keys.Add(key);
            Values.Add(value);
        }

        private int IndexOf(string key)
        {
            for (int i = 0; i < Keys.Count; i++)
            {
                if (Keys[i] == key)
                {
                    return i;
                }
            }

            return -1;
        }
    }

    internal static class YamlParser
    {
        private sealed class Raw
        {
            public int Line;
            public int Indent;
            public bool IsSeq;
            public string Body = "";
        }

        public static YamlNode Parse(string text)
        {
            if (text == null)
            {
                throw new ArgumentNullException(nameof(text));
            }

            List<Raw> lines = Lex(text);
            int index = 0;
            if (lines.Count == 0)
            {
                return YamlNode.Map();
            }

            if (lines[0].IsSeq)
            {
                return ParseSequence(lines, ref index, lines[0].Indent);
            }

            return ParseMap(lines, ref index, lines[0].Indent);
        }

        private static List<Raw> Lex(string text)
        {
            string normalized = text.Replace("\r\n", "\n").Replace('\r', '\n');
            string[] split = normalized.Split('\n');
            var lines = new List<Raw>();
            for (int n = 0; n < split.Length; n++)
            {
                string raw = split[n];
                int indent = 0;
                while (indent < raw.Length && raw[indent] == ' ')
                {
                    indent++;
                }

                if (indent < raw.Length && raw[indent] == '\t')
                {
                    throw new FormatException("YAML 第 " + (n + 1) + " 行含有制表符。");
                }

                string body = raw.Substring(indent).TrimEnd();
                if (body.Length == 0 || body[0] == '#')
                {
                    continue;
                }

                body = StripComment(body);
                if (body.Length == 0)
                {
                    continue;
                }

                var line = new Raw { Line = n + 1, Indent = indent };
                if (body == "-")
                {
                    line.IsSeq = true;
                    line.Body = "";
                }
                else if (body.StartsWith("- ", StringComparison.Ordinal))
                {
                    line.IsSeq = true;
                    line.Body = body.Substring(2).Trim();
                }
                else
                {
                    line.Body = body;
                }

                lines.Add(line);
            }

            return lines;
        }

        private static YamlNode ParseMap(List<Raw> lines, ref int index, int indent)
        {
            YamlNode map = YamlNode.Map();
            while (index < lines.Count && lines[index].Indent == indent && !lines[index].IsSeq)
            {
                Raw line = lines[index];
                SplitKey(line.Body, line.Line, out string key, out string inline, out bool hasInline);
                if (hasInline)
                {
                    map.Put(key, ParseFlow(inline, line.Line));
                    index++;
                }
                else
                {
                    index++;
                    PutNested(map, key, lines, ref index, indent, line.Line);
                }
            }

            return map;
        }

        private static void PutNested(YamlNode map, string key, List<Raw> lines, ref int index, int indent, int line)
        {
            if (index >= lines.Count || lines[index].Indent <= indent)
            {
                map.Put(key, YamlNode.Null());
                return;
            }

            int childIndent = lines[index].Indent;
            YamlNode child = lines[index].IsSeq
                ? ParseSequence(lines, ref index, childIndent)
                : ParseMap(lines, ref index, childIndent);
            map.Put(key, child);
        }

        private static YamlNode ParseSequence(List<Raw> lines, ref int index, int indent)
        {
            YamlNode seq = YamlNode.Sequence();
            while (index < lines.Count && lines[index].Indent == indent && lines[index].IsSeq)
            {
                Raw line = lines[index];
                if (line.Body.Length == 0)
                {
                    index++;
                    if (index < lines.Count && lines[index].Indent > indent)
                    {
                        int childIndent = lines[index].Indent;
                        seq.Items.Add(lines[index].IsSeq
                            ? ParseSequence(lines, ref index, childIndent)
                            : ParseMap(lines, ref index, childIndent));
                    }
                    else
                    {
                        seq.Items.Add(YamlNode.Null());
                    }

                    continue;
                }

                if (LooksLikeKey(line.Body))
                {
                    YamlNode item = YamlNode.Map();
                    SplitKey(line.Body, line.Line, out string key, out string inline, out bool hasInline);
                    index++;
                    int keyIndent = indent + 2;
                    if (hasInline)
                    {
                        item.Put(key, ParseFlow(inline, line.Line));
                    }
                    else if (index < lines.Count && lines[index].Indent > keyIndent)
                    {
                        int nested = lines[index].Indent;
                        YamlNode child = lines[index].IsSeq
                            ? ParseSequence(lines, ref index, nested)
                            : ParseMap(lines, ref index, nested);
                        item.Put(key, child);
                    }
                    else
                    {
                        item.Put(key, YamlNode.Null());
                    }

                    while (index < lines.Count && lines[index].Indent == keyIndent && !lines[index].IsSeq)
                    {
                        Raw keyLine = lines[index];
                        SplitKey(keyLine.Body, keyLine.Line, out string nextKey, out string nextInline, out bool nextHas);
                        if (nextHas)
                        {
                            item.Put(nextKey, ParseFlow(nextInline, keyLine.Line));
                            index++;
                        }
                        else
                        {
                            index++;
                            PutNested(item, nextKey, lines, ref index, keyIndent, keyLine.Line);
                        }
                    }

                    seq.Items.Add(item);
                }
                else
                {
                    seq.Items.Add(ParseFlow(line.Body, line.Line));
                    index++;
                }
            }

            return seq;
        }

        private static bool LooksLikeKey(string body)
        {
            if (body.Length > 0 && (body[0] == '{' || body[0] == '[' || body[0] == '"'))
            {
                return false;
            }

            return FindKeyColon(body) >= 0;
        }

        private static int FindKeyColon(string body)
        {
            bool quote = false;
            for (int i = 0; i < body.Length; i++)
            {
                char c = body[i];
                if (c == '"')
                {
                    quote = !quote;
                    continue;
                }

                if (!quote && c == ':' && (i + 1 >= body.Length || body[i + 1] == ' '))
                {
                    return i;
                }
            }

            return -1;
        }

        private static void SplitKey(string body, int line, out string key, out string inline, out bool hasInline)
        {
            int colon = FindKeyColon(body);
            if (colon <= 0)
            {
                throw new FormatException("YAML 第 " + line + " 行缺少键。");
            }

            key = body.Substring(0, colon).Trim();
            if (key.Length == 0)
            {
                throw new FormatException("YAML 第 " + line + " 行缺少键。");
            }

            string rest = body.Substring(colon + 1).Trim();
            hasInline = rest.Length > 0;
            inline = rest;
        }

        private static YamlNode ParseFlow(string text, int line)
        {
            if (text.Length >= 2 && text[0] == '{' && text[text.Length - 1] == '}')
            {
                YamlNode map = YamlNode.Map();
                string inner = text.Substring(1, text.Length - 2).Trim();
                if (inner.Length == 0)
                {
                    return map;
                }

                foreach (string part in SplitCommas(inner))
                {
                    SplitKey(part.Trim(), line, out string key, out string inline, out bool hasInline);
                    if (!hasInline)
                    {
                        throw new FormatException("YAML 第 " + line + " 行的行内映射缺少值。");
                    }

                    map.Put(key, ParseScalar(inline, line));
                }

                return map;
            }

            if (text.Length >= 2 && text[0] == '[' && text[text.Length - 1] == ']')
            {
                YamlNode seq = YamlNode.Sequence();
                string inner = text.Substring(1, text.Length - 2).Trim();
                if (inner.Length == 0)
                {
                    return seq;
                }

                foreach (string part in SplitCommas(inner))
                {
                    seq.Items.Add(ParseScalar(part.Trim(), line));
                }

                return seq;
            }

            return ParseScalar(text, line);
        }

        private static YamlNode ParseScalar(string text, int line)
        {
            if (text.Length >= 2 && text[0] == '"' && text[text.Length - 1] == '"')
            {
                return YamlNode.FromScalar(Unquote(text, line));
            }

            return YamlNode.FromScalar(text);
        }

        private static string Unquote(string text, int line)
        {
            var builder = new StringBuilder();
            for (int i = 1; i < text.Length - 1; i++)
            {
                char c = text[i];
                if (c != '\\')
                {
                    builder.Append(c);
                    continue;
                }

                if (i + 1 >= text.Length - 1)
                {
                    throw new FormatException("YAML 第 " + line + " 行字符串未结束。");
                }

                char escaped = text[++i];
                if (escaped == '"' || escaped == '\\')
                {
                    builder.Append(escaped);
                }
                else
                {
                    throw new FormatException("YAML 第 " + line + " 行转义无法识别。");
                }
            }

            return builder.ToString();
        }

        private static List<string> SplitCommas(string text)
        {
            var parts = new List<string>();
            var current = new StringBuilder();
            bool quote = false;
            for (int i = 0; i < text.Length; i++)
            {
                char c = text[i];
                if (c == '"')
                {
                    quote = !quote;
                    current.Append(c);
                    continue;
                }

                if (c == ',' && !quote)
                {
                    parts.Add(current.ToString());
                    current.Clear();
                    continue;
                }

                current.Append(c);
            }

            parts.Add(current.ToString());
            return parts;
        }

        private static string StripComment(string body)
        {
            bool quote = false;
            for (int i = 0; i < body.Length; i++)
            {
                char c = body[i];
                if (c == '"')
                {
                    quote = !quote;
                    continue;
                }

                if (!quote && c == '#' && (i == 0 || body[i - 1] == ' '))
                {
                    return body.Substring(0, i).TrimEnd();
                }
            }

            return body;
        }
    }
}
