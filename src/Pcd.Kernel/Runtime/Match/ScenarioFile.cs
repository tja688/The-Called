using System;
using System.Collections.Generic;
using System.Globalization;

namespace Pcd.Kernel
{
    public sealed class OpenedScenario
    {
        internal OpenedScenario(ContentCatalog catalog, MatchSession session, string monsterId, ulong seed)
        {
            Catalog = catalog;
            Session = session;
            MonsterId = monsterId;
            Seed = seed;
        }

        public ContentCatalog Catalog { get; }
        public MatchSession Session { get; }
        public string MonsterId { get; }
        public ulong Seed { get; }
    }

    public static class ScenarioFile
    {
        public static OpenedScenario Open(string yaml, ContentCatalog? catalog)
        {
            if (yaml == null)
            {
                throw new ArgumentNullException(nameof(yaml));
            }

            YamlNode doc = YamlNode.Parse(yaml);
            ContentCatalog resolved = catalog ?? ContentCatalog.Parse(yaml);
            string monsterId = MonsterIdOf(doc, resolved);
            ulong seed = ReadULong(doc, "seed", 1);
            MatchSession session;
            YamlNode? position = doc.Get("position");
            if (position != null)
            {
                seed = ReadULong(position, "seed", seed);
                session = MatchSession.FromPosition(resolved, BuildPosition(position, monsterId, seed));
            }
            else
            {
                session = MatchSession.Start(resolved, new MatchSetup
                {
                    Seed = seed,
                    MonsterId = monsterId,
                    BuildDeck = ReadIdList(doc.Get("deck")),
                    OpportunitiesPerTurn = doc.Has("opportunitiesPerTurn") ? doc.Int("opportunitiesPerTurn") : 1,
                    IntentMode = doc.Str("intentMode") ?? ""
                });
            }

            return new OpenedScenario(resolved, session, monsterId, seed);
        }

        private static string MonsterIdOf(YamlNode doc, ContentCatalog catalog)
        {
            YamlNode? monster = doc.Get("monster");
            if (monster == null)
            {
                if (catalog.DefaultMonster == null)
                {
                    throw new FormatException("场景缺少 monster。");
                }

                return catalog.DefaultMonster;
            }

            if (monster.IsScalar)
            {
                if (monster.Scalar == null)
                {
                    throw new FormatException("场景怪物缺少 id。");
                }

                return monster.Scalar;
            }

            string? id = monster.Str("id");
            if (id == null)
            {
                throw new FormatException("场景怪物缺少 id。");
            }

            return id;
        }

        private static MatchPosition BuildPosition(YamlNode position, string monsterId, ulong seed)
        {
            var built = new MatchPosition
            {
                MonsterId = monsterId,
                Seed = seed,
                Phase = position.Str("phase") ?? "player-action",
                Round = position.Has("round") ? position.Int("round") : 0,
                IntentIndex = position.Has("intentIndex") ? position.Int("intentIndex") : 0,
                OpportunitiesPerTurn = position.Has("opportunitiesPerTurn") ? position.Int("opportunitiesPerTurn") : 1,
                Opportunities = position.Has("opportunities") ? position.Int("opportunities") : 1,
                IntentMode = position.Str("intentMode") ?? "",
                PollutedCells = ReadInts(position.Get("polluted")),
                Board = ReadCards(position.Get("board"))
            };
            YamlNode? player = position.Get("player");
            if (player != null)
            {
                built.PlayerMatchDeck = ReadCards(player.Get("deck"));
                built.PlayerHand = ReadCards(player.Get("hand"));
                built.PlayerDiscard = ReadCards(player.Get("discard"));
                built.PlayerVoid = ReadCards(player.Get("void"));
                built.PlayerResources = ReadResources(player);
            }

            YamlNode? monster = position.Get("monster");
            if (monster != null)
            {
                built.MonsterDiscard = ReadCards(monster.Get("discard"));
                built.MonsterVoid = ReadCards(monster.Get("void"));
                built.MonsterResources = ReadResources(monster);
            }

            return built;
        }

        private static SetupResource[] ReadResources(YamlNode node)
        {
            var list = new List<SetupResource>();
            if (node.Has("faith"))
            {
                list.Add(new SetupResource { Id = "resource.faith", Amount = node.Int("faith") });
            }

            return list.ToArray();
        }

        private static PositionCard[] ReadCards(YamlNode? node)
        {
            if (node == null)
            {
                return Array.Empty<PositionCard>();
            }

            if (!node.IsSequence)
            {
                throw new FormatException("卡牌列表格式不对。");
            }

            var cards = new PositionCard[node.Items.Count];
            for (int i = 0; i < node.Items.Count; i++)
            {
                YamlNode item = node.Items[i];
                if (item.IsScalar)
                {
                    cards[i] = new PositionCard { CardId = item.Scalar ?? "" };
                    continue;
                }

                var card = new PositionCard
                {
                    CardId = item.Str("card") ?? "",
                    Owner = item.Str("owner"),
                    CardBackId = item.Str("back")
                };
                if (item.Has("cell"))
                {
                    card.Cell = item.Int("cell");
                }

                if (item.Has("points"))
                {
                    card.CurrentPoints = item.Int("points");
                }

                if (item.Has("base"))
                {
                    card.BasePoints = item.Int("base");
                }

                cards[i] = card;
            }

            return cards;
        }

        private static string[] ReadIdList(YamlNode? node)
        {
            if (node == null)
            {
                return Array.Empty<string>();
            }

            if (!node.IsSequence)
            {
                throw new FormatException("标识列表格式不对。");
            }

            var ids = new string[node.Items.Count];
            for (int i = 0; i < node.Items.Count; i++)
            {
                ids[i] = node.Items[i].Scalar ?? "";
            }

            return ids;
        }

        private static int[] ReadInts(YamlNode? node)
        {
            if (node == null)
            {
                return Array.Empty<int>();
            }

            var values = new int[node.Items.Count];
            for (int i = 0; i < node.Items.Count; i++)
            {
                values[i] = int.Parse(node.Items[i].Scalar ?? "", CultureInfo.InvariantCulture);
            }

            return values;
        }

        private static ulong ReadULong(YamlNode node, string key, ulong fallback)
        {
            string? text = node.Str(key);
            if (text == null)
            {
                return fallback;
            }

            return ulong.Parse(text, CultureInfo.InvariantCulture);
        }
    }
}
