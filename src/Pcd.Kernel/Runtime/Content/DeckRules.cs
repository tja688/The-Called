using System;
using System.Collections.Generic;

namespace Pcd.Kernel
{
    public static class DeckRules
    {
        public const int DeckSize = 15;
        public const int LoadCap = 90;

        public static string[] Validate(ContentCatalog catalog, string[] cards, string[]? backs)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            if (cards == null)
            {
                throw new ArgumentNullException(nameof(cards));
            }

            var issues = new List<string>();
            if (cards.Length != DeckSize)
            {
                issues.Add("牌组必须是 15 张，当前是 " + cards.Length + "。");
            }

            if (backs != null && backs.Length != cards.Length)
            {
                issues.Add("卡背数量必须和卡牌数量一致。");
            }

            int load = 0;
            var counts = new Dictionary<string, int>(StringComparer.Ordinal);
            var order = new List<string>();
            for (int i = 0; i < cards.Length; i++)
            {
                string id = cards[i];
                CardDefinition card;
                try
                {
                    card = catalog.RequireCard(id);
                }
                catch (ContentException)
                {
                    issues.Add("内容 " + id + "：牌组引用的卡牌不存在。");
                    continue;
                }

                load += card.Load;
                if (backs != null && i < backs.Length && backs[i].Length > 0)
                {
                    BackDefinition? back = catalog.FindBack(backs[i]);
                    if (back == null)
                    {
                        issues.Add("内容 " + backs[i] + "：牌组引用的卡背不存在。");
                    }
                    else
                    {
                        load += back.Load;
                    }
                }

                if (!counts.ContainsKey(id))
                {
                    counts[id] = 0;
                    order.Add(id);
                }

                counts[id] = counts[id] + 1;
            }

            if (load > LoadCap)
            {
                issues.Add("牌组总负荷是 " + load + "，不能超过 90。");
            }

            if (backs != null)
            {
                var backCounts = new Dictionary<string, int>(StringComparer.Ordinal);
                var backOrder = new List<string>();
                for (int i = 0; i < backs.Length; i++)
                {
                    if (backs[i].Length == 0)
                    {
                        continue;
                    }

                    if (!backCounts.ContainsKey(backs[i]))
                    {
                        backCounts[backs[i]] = 0;
                        backOrder.Add(backs[i]);
                    }

                    backCounts[backs[i]] = backCounts[backs[i]] + 1;
                }

                backOrder.Sort(StringComparer.Ordinal);
                for (int i = 0; i < backOrder.Count; i++)
                {
                    string id = backOrder[i];
                    BackDefinition? back = catalog.FindBack(id);
                    if (back == null)
                    {
                        continue;
                    }

                    if (back.Cap > 0 && backCounts[id] > back.Cap)
                    {
                        issues.Add("内容 " + id + "：同一种卡背最多 " + back.Cap + " 个，当前是 " + backCounts[id] + "。");
                    }
                }
            }

            order.Sort(StringComparer.Ordinal);
            for (int i = 0; i < order.Count; i++)
            {
                string id = order[i];
                CardDefinition card = catalog.RequireCard(id);
                int cap = CopyCap(card.Rarity);
                if (cap < 0)
                {
                    issues.Add("内容 " + id + "：没有稀有度，不能计入构筑。");
                    continue;
                }

                if (counts[id] > cap)
                {
                    issues.Add("内容 " + id + "：同名最多 " + cap + " 张，当前是 " + counts[id] + "。");
                }
            }

            return issues.ToArray();
        }

        public static int WholeLoad(ContentCatalog catalog, string cardId, string? backId)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            int load = catalog.RequireCard(cardId).Load;
            if (backId != null && backId.Length > 0)
            {
                BackDefinition? back = catalog.FindBack(backId);
                if (back != null)
                {
                    load += back.Load;
                }
            }

            return load;
        }

        public static int TotalLoad(ContentCatalog catalog, string[] cards, string[]? backs)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            if (cards == null)
            {
                throw new ArgumentNullException(nameof(cards));
            }

            int load = 0;
            for (int i = 0; i < cards.Length; i++)
            {
                CardDefinition card;
                try
                {
                    card = catalog.RequireCard(cards[i]);
                }
                catch (ContentException)
                {
                    continue;
                }

                load += card.Load;
                if (backs != null && i < backs.Length && backs[i].Length > 0)
                {
                    BackDefinition? back = catalog.FindBack(backs[i]);
                    if (back != null)
                    {
                        load += back.Load;
                    }
                }
            }

            return load;
        }

        public static int CopyCap(string rarity)
        {
            if (rarity == "white")
            {
                return 3;
            }

            if (rarity == "blue")
            {
                return 2;
            }

            if (rarity == "gold")
            {
                return 1;
            }

            return -1;
        }
    }
}
