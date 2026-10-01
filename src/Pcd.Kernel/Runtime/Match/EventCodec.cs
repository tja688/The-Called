using System;
using System.Collections.Generic;

namespace Pcd.Kernel
{
    internal static class EventCodec
    {
        public static void WriteArray(JsonWriter writer, IReadOnlyList<GameEvent> events)
        {
            writer.BeginArray();
            for (int i = 0; i < events.Count; i++)
            {
                Write(writer, events[i]);
            }

            writer.EndArray();
        }

        public static void Write(JsonWriter writer, GameEvent evt)
        {
            writer.BeginObject();
            writer.Name("seq");
            writer.Value(evt.Seq);
            writer.Name("type");
            writer.Value(evt.Type);
            writer.Name("cause");
            writer.BeginArray();
            for (int i = 0; i < evt.Cause.Length; i++)
            {
                writer.Value(evt.Cause[i]);
            }

            writer.EndArray();
            writer.Name("card");
            writer.Value(evt.Card);
            WriteOptional(writer, "instance", evt.Instance);
            writer.Name("owner");
            writer.Value(evt.Owner);
            WriteOptional(writer, "cell", evt.Cell);
            writer.Name("zone");
            writer.Value(evt.Zone);
            writer.Name("reason");
            writer.Value(evt.Reason);
            writer.Name("source");
            writer.Value(evt.Source);
            WriteOptional(writer, "before", evt.Before);
            WriteOptional(writer, "after", evt.After);
            writer.Name("winner");
            writer.Value(evt.Winner);
            WriteOptional(writer, "index", evt.Index);
            WriteOptional(writer, "round", evt.Round);
            WriteOptional(writer, "points", evt.Points);
            WriteOptional(writer, "playerPoints", evt.PlayerPoints);
            WriteOptional(writer, "monsterPoints", evt.MonsterPoints);
            WriteOptional(writer, "playerOccupancy", evt.PlayerOccupancy);
            WriteOptional(writer, "monsterOccupancy", evt.MonsterOccupancy);
            writer.EndObject();
        }

        public static List<GameEvent> ReadArray(JsonValue node)
        {
            if (!node.IsArray || node.Array == null)
            {
                throw new FormatException("事件必须是数组。");
            }

            var events = new List<GameEvent>(node.Array.Count);
            for (int i = 0; i < node.Array.Count; i++)
            {
                events.Add(Read(node.Array[i]));
            }

            return events;
        }

        public static GameEvent Read(JsonValue node)
        {
            return new GameEvent
            {
                Seq = node.Require("seq").Int(),
                Type = node.Require("type").String(),
                Cause = ReadStrings(node.Require("cause")),
                Card = OptionalString(node, "card"),
                Instance = OptionalInt(node, "instance"),
                Owner = OptionalString(node, "owner"),
                Cell = OptionalInt(node, "cell"),
                Zone = OptionalString(node, "zone"),
                Reason = OptionalString(node, "reason"),
                Source = OptionalString(node, "source"),
                Before = OptionalInt(node, "before"),
                After = OptionalInt(node, "after"),
                Winner = OptionalString(node, "winner"),
                Index = OptionalInt(node, "index"),
                Round = OptionalInt(node, "round"),
                Points = OptionalInt(node, "points"),
                PlayerPoints = OptionalInt(node, "playerPoints"),
                MonsterPoints = OptionalInt(node, "monsterPoints"),
                PlayerOccupancy = OptionalInt(node, "playerOccupancy"),
                MonsterOccupancy = OptionalInt(node, "monsterOccupancy")
            };
        }

        public static string Canonical(IReadOnlyList<GameEvent> events)
        {
            var writer = new JsonWriter();
            WriteArray(writer, events);
            return writer.ToString();
        }

        private static void WriteOptional(JsonWriter writer, string name, int? value)
        {
            writer.Name(name);
            if (value.HasValue)
            {
                writer.Value(value.Value);
            }
            else
            {
                writer.Null();
            }
        }

        private static string? OptionalString(JsonValue node, string name)
        {
            JsonValue? child = node.Find(name);
            if (child == null || child.IsNull)
            {
                return null;
            }

            return child.String();
        }

        private static int? OptionalInt(JsonValue node, string name)
        {
            JsonValue? child = node.Find(name);
            if (child == null || child.IsNull)
            {
                return null;
            }

            return child.Int();
        }

        private static string[] ReadStrings(JsonValue node)
        {
            if (!node.IsArray || node.Array == null)
            {
                throw new FormatException("cause 必须是数组。");
            }

            var values = new string[node.Array.Count];
            for (int i = 0; i < node.Array.Count; i++)
            {
                values[i] = node.Array[i].String();
            }

            return values;
        }
    }
}
