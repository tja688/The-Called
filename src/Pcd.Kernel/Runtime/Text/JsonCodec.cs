using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Pcd.Kernel
{
    internal sealed class JsonValue
    {
        public string? Text;
        public bool Bool;
        public bool IsNull;
        public bool IsBool;
        public bool IsNumber;
        public bool IsString;
        public bool IsArray;
        public bool IsObject;
        public List<JsonValue>? Array;
        public List<KeyValuePair<string, JsonValue>>? Object;

        public JsonValue Require(string name)
        {
            JsonValue? child = Find(name);
            if (child == null)
            {
                throw new FormatException("缺少字段 " + name + "。");
            }

            return child;
        }

        public JsonValue? Find(string name)
        {
            if (Object == null)
            {
                throw new FormatException("需要对象才能读取 " + name + "。");
            }

            for (int i = 0; i < Object.Count; i++)
            {
                if (Object[i].Key == name)
                {
                    return Object[i].Value;
                }
            }

            return null;
        }

        public string String()
        {
            if (!IsString || Text == null)
            {
                throw new FormatException("需要字符串。");
            }

            return Text;
        }

        public long Long()
        {
            if (!IsNumber || Text == null)
            {
                throw new FormatException("需要整数。");
            }

            if (!long.TryParse(Text, NumberStyles.Integer, CultureInfo.InvariantCulture, out long value))
            {
                throw new FormatException("整数超出范围。");
            }

            return value;
        }

        public ulong ULong()
        {
            if (!IsNumber || Text == null)
            {
                throw new FormatException("需要无符号整数。");
            }

            if (!ulong.TryParse(Text, NumberStyles.Integer, CultureInfo.InvariantCulture, out ulong value))
            {
                throw new FormatException("整数超出范围。");
            }

            return value;
        }

        public int Int()
        {
            long value = Long();
            if (value < int.MinValue || value > int.MaxValue)
            {
                throw new FormatException("整数超出范围。");
            }

            return (int)value;
        }

        public bool Boolean()
        {
            if (!IsBool)
            {
                throw new FormatException("需要布尔值。");
            }

            return Bool;
        }
    }

    internal sealed class JsonWriter
    {
        private readonly StringBuilder _builder = new StringBuilder();
        private readonly Stack<Frame> _frames = new Stack<Frame>();

        public void BeginObject()
        {
            BeforeValue();
            _builder.Append('{');
            _frames.Push(new Frame(true));
        }

        public void EndObject()
        {
            _builder.Append('}');
            _frames.Pop();
        }

        public void BeginArray()
        {
            BeforeValue();
            _builder.Append('[');
            _frames.Push(new Frame(false));
        }

        public void EndArray()
        {
            _builder.Append(']');
            _frames.Pop();
        }

        public void Name(string name)
        {
            Frame frame = _frames.Peek();
            if (!frame.Object || frame.ExpectValue)
            {
                throw new InvalidOperationException("JSON 对象的键位置不对。");
            }

            if (frame.Count > 0)
            {
                _builder.Append(',');
            }

            frame.Count++;
            frame.ExpectValue = true;
            _builder.Append('"');
            AppendEscaped(name);
            _builder.Append("\":");
        }

        public void Value(string? value)
        {
            if (value == null)
            {
                Null();
                return;
            }

            BeforeValue();
            _builder.Append('"');
            AppendEscaped(value);
            _builder.Append('"');
        }

        public void Value(long value)
        {
            BeforeValue();
            _builder.Append(value.ToString(CultureInfo.InvariantCulture));
        }

        public void Value(ulong value)
        {
            BeforeValue();
            _builder.Append(value.ToString(CultureInfo.InvariantCulture));
        }

        public void Value(bool value)
        {
            BeforeValue();
            _builder.Append(value ? "true" : "false");
        }

        public void Null()
        {
            BeforeValue();
            _builder.Append("null");
        }

        public override string ToString()
        {
            return _builder.ToString();
        }

        private void BeforeValue()
        {
            if (_frames.Count == 0)
            {
                return;
            }

            Frame frame = _frames.Peek();
            if (frame.Object)
            {
                if (!frame.ExpectValue)
                {
                    throw new InvalidOperationException("JSON 对象缺少键。");
                }

                frame.ExpectValue = false;
                return;
            }

            if (frame.Count > 0)
            {
                _builder.Append(',');
            }

            frame.Count++;
        }

        private void AppendEscaped(string value)
        {
            for (int i = 0; i < value.Length; i++)
            {
                char c = value[i];
                switch (c)
                {
                    case '"':
                        _builder.Append("\\\"");
                        break;
                    case '\\':
                        _builder.Append("\\\\");
                        break;
                    case '\n':
                        _builder.Append("\\n");
                        break;
                    case '\r':
                        _builder.Append("\\r");
                        break;
                    case '\t':
                        _builder.Append("\\t");
                        break;
                    default:
                        if (c < 0x20)
                        {
                            _builder.Append("\\u");
                            _builder.Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            _builder.Append(c);
                        }

                        break;
                }
            }
        }

        private sealed class Frame
        {
            public Frame(bool obj)
            {
                Object = obj;
            }

            public bool Object;
            public int Count;
            public bool ExpectValue;
        }
    }

    internal static class JsonReader
    {
        public static JsonValue Parse(string json)
        {
            if (json == null)
            {
                throw new ArgumentNullException(nameof(json));
            }

            int index = 0;
            JsonValue value = ReadValue(json, ref index);
            Skip(json, ref index);
            if (index != json.Length)
            {
                throw new FormatException("JSON 末尾有多余内容。");
            }

            return value;
        }

        private static JsonValue ReadValue(string json, ref int index)
        {
            Skip(json, ref index);
            if (index >= json.Length)
            {
                throw new FormatException("JSON 意外结束。");
            }

            char c = json[index];
            if (c == '{')
            {
                return ReadObject(json, ref index);
            }

            if (c == '[')
            {
                return ReadArray(json, ref index);
            }

            if (c == '"')
            {
                return ReadString(json, ref index);
            }

            if (c == 't' || c == 'f')
            {
                return ReadBool(json, ref index);
            }

            if (c == 'n')
            {
                return ReadNull(json, ref index);
            }

            if (c == '-' || (c >= '0' && c <= '9'))
            {
                return ReadNumber(json, ref index);
            }

            throw new FormatException("无法识别的 JSON。");
        }

        private static JsonValue ReadObject(string json, ref int index)
        {
            index++;
            var items = new List<KeyValuePair<string, JsonValue>>();
            Skip(json, ref index);
            if (index < json.Length && json[index] == '}')
            {
                index++;
                return new JsonValue { IsObject = true, Object = items };
            }

            while (true)
            {
                Skip(json, ref index);
                JsonValue key = ReadString(json, ref index);
                Skip(json, ref index);
                Expect(json, ref index, ':');
                JsonValue value = ReadValue(json, ref index);
                string name = key.String();
                for (int i = 0; i < items.Count; i++)
                {
                    if (items[i].Key == name)
                    {
                        throw new FormatException("JSON 键重复：" + name);
                    }
                }

                items.Add(new KeyValuePair<string, JsonValue>(name, value));
                Skip(json, ref index);
                if (index >= json.Length)
                {
                    throw new FormatException("JSON 意外结束。");
                }

                if (json[index] == ',')
                {
                    index++;
                    continue;
                }

                if (json[index] == '}')
                {
                    index++;
                    break;
                }

                throw new FormatException("JSON 对象格式不对。");
            }

            return new JsonValue { IsObject = true, Object = items };
        }

        private static JsonValue ReadArray(string json, ref int index)
        {
            index++;
            var items = new List<JsonValue>();
            Skip(json, ref index);
            if (index < json.Length && json[index] == ']')
            {
                index++;
                return new JsonValue { IsArray = true, Array = items };
            }

            while (true)
            {
                items.Add(ReadValue(json, ref index));
                Skip(json, ref index);
                if (index >= json.Length)
                {
                    throw new FormatException("JSON 意外结束。");
                }

                if (json[index] == ',')
                {
                    index++;
                    continue;
                }

                if (json[index] == ']')
                {
                    index++;
                    break;
                }

                throw new FormatException("JSON 数组格式不对。");
            }

            return new JsonValue { IsArray = true, Array = items };
        }

        private static JsonValue ReadString(string json, ref int index)
        {
            Expect(json, ref index, '"');
            var builder = new StringBuilder();
            while (index < json.Length)
            {
                char c = json[index++];
                if (c == '"')
                {
                    return new JsonValue { IsString = true, Text = builder.ToString() };
                }

                if (c != '\\')
                {
                    builder.Append(c);
                    continue;
                }

                if (index >= json.Length)
                {
                    throw new FormatException("JSON 字符串未结束。");
                }

                char escaped = json[index++];
                switch (escaped)
                {
                    case '"':
                    case '\\':
                    case '/':
                        builder.Append(escaped);
                        break;
                    case 'n':
                        builder.Append('\n');
                        break;
                    case 'r':
                        builder.Append('\r');
                        break;
                    case 't':
                        builder.Append('\t');
                        break;
                    case 'u':
                        if (index + 4 > json.Length)
                        {
                            throw new FormatException("JSON 转义不完整。");
                        }

                        int code = 0;
                        for (int i = 0; i < 4; i++)
                        {
                            code = (code << 4) + Hex(json[index++]);
                        }

                        builder.Append((char)code);
                        break;
                    default:
                        throw new FormatException("JSON 转义无法识别。");
                }
            }

            throw new FormatException("JSON 字符串未结束。");
        }

        private static JsonValue ReadBool(string json, ref int index)
        {
            if (Match(json, ref index, "true"))
            {
                return new JsonValue { IsBool = true, Bool = true };
            }

            if (Match(json, ref index, "false"))
            {
                return new JsonValue { IsBool = true, Bool = false };
            }

            throw new FormatException("JSON 布尔值不对。");
        }

        private static JsonValue ReadNull(string json, ref int index)
        {
            if (!Match(json, ref index, "null"))
            {
                throw new FormatException("JSON 空值不对。");
            }

            return new JsonValue { IsNull = true };
        }

        private static JsonValue ReadNumber(string json, ref int index)
        {
            int start = index;
            if (json[index] == '-')
            {
                index++;
            }

            if (index >= json.Length || json[index] < '0' || json[index] > '9')
            {
                throw new FormatException("JSON 数字不对。");
            }

            while (index < json.Length && json[index] >= '0' && json[index] <= '9')
            {
                index++;
            }

            if (index < json.Length && (json[index] == '.' || json[index] == 'e' || json[index] == 'E'))
            {
                throw new FormatException("协议只接受整数。");
            }

            return new JsonValue { IsNumber = true, Text = json.Substring(start, index - start) };
        }

        private static bool Match(string json, ref int index, string word)
        {
            if (index + word.Length > json.Length)
            {
                return false;
            }

            for (int i = 0; i < word.Length; i++)
            {
                if (json[index + i] != word[i])
                {
                    return false;
                }
            }

            index += word.Length;
            return true;
        }

        private static void Expect(string json, ref int index, char expected)
        {
            if (index >= json.Length || json[index] != expected)
            {
                throw new FormatException("JSON 格式不对。");
            }

            index++;
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

        private static int Hex(char c)
        {
            if (c >= '0' && c <= '9')
            {
                return c - '0';
            }

            if (c >= 'a' && c <= 'f')
            {
                return c - 'a' + 10;
            }

            if (c >= 'A' && c <= 'F')
            {
                return c - 'A' + 10;
            }

            throw new FormatException("JSON 十六进制不对。");
        }
    }
}
