using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Pcd.Kernel
{
    public static class LoadQuote
    {
        public static string Report(ContentCatalog catalog)
        {
            if (catalog == null)
            {
                throw new ArgumentNullException(nameof(catalog));
            }

            var loads = new List<string>();
            var rarities = new List<string>();
            for (int i = 0; i < Samples.Length; i++)
            {
                Sample sample = Samples[i];
                CardDefinition card = catalog.RequireCard(sample.CardId);
                if (sample.Load != card.Load)
                {
                    loads.Add(Line(card, "试报价 " + sample.Load.ToString(CultureInfo.InvariantCulture) + "，卡表负荷 " + card.Load.ToString(CultureInfo.InvariantCulture)));
                }

                if (sample.Rarity.Length > 0 && sample.Rarity != card.Rarity)
                {
                    rarities.Add("- " + card.Name + "（" + card.Id + "）：试报价按" + RarityWord(sample.Rarity) + "卡计算得到 " + sample.Load.ToString(CultureInfo.InvariantCulture) + "，与负荷一致，但卡表稀有度是" + RarityWord(card.Rarity) + "。");
                }
            }

            var formulas = new List<string>();
            var uncovered = new List<string>();
            var cards = new List<CardDefinition>();
            for (int i = 0; i < catalog.Cards.Length; i++)
            {
                if (catalog.Cards[i].Rarity.Length > 0)
                {
                    cards.Add(catalog.Cards[i]);
                }
            }

            cards.Sort(CompareCard);
            for (int i = 0; i < cards.Count; i++)
            {
                CardDefinition card = cards[i];
                Priced priced = Price(catalog, card);
                if (priced.Unpriced)
                {
                    uncovered.Add(Line(card, "公式还没有覆盖这张卡的全部效果"));
                    continue;
                }

                if (card.Load >= priced.Low && card.Load <= priced.High)
                {
                    continue;
                }

                string quoted = priced.Low == priced.High
                    ? priced.Low.ToString(CultureInfo.InvariantCulture)
                    : priced.Low.ToString(CultureInfo.InvariantCulture) + "～" + priced.High.ToString(CultureInfo.InvariantCulture);
                formulas.Add(Line(card, "公式报价 " + quoted + "，卡表负荷 " + card.Load.ToString(CultureInfo.InvariantCulture)));
            }

            var builder = new StringBuilder();
            builder.Append("# 负荷报价检查\n\n");
            builder.Append("## 试报价与卡表不一致\n\n");
            AppendLines(builder, loads);
            builder.Append("\n## 稀有度不一致\n\n");
            AppendLines(builder, rarities);
            builder.Append("\n## 公式报价与卡表不一致\n\n");
            AppendLines(builder, formulas);
            builder.Append("\n## 公式尚未覆盖\n\n");
            AppendLines(builder, uncovered);
            return builder.ToString();
        }

        private static string Line(CardDefinition card, string detail)
        {
            return "- " + card.Name + "（" + card.Id + "）：" + detail + "。";
        }

        private static void AppendLines(StringBuilder builder, List<string> lines)
        {
            if (lines.Count == 0)
            {
                builder.Append("无\n");
                return;
            }

            for (int i = 0; i < lines.Count; i++)
            {
                builder.Append(lines[i]);
                builder.Append('\n');
            }
        }

        private static int CompareCard(CardDefinition left, CardDefinition right)
        {
            return string.CompareOrdinal(left.Id, right.Id);
        }

        private static string RarityWord(string rarity)
        {
            if (rarity == "blue")
            {
                return "蓝";
            }

            if (rarity == "gold")
            {
                return "金";
            }

            return "白";
        }

        private static Priced Price(ContentCatalog catalog, CardDefinition card)
        {
            var parts = new Parts();
            for (int i = 0; i < card.Abilities.Length; i++)
            {
                PriceAbility(catalog, card, card.Abilities[i], parts);
            }

            int sum = Body(card.IsSpell ? 0 : card.Points) * 2 + parts.Effect - parts.Discount;
            if (card.Rarity == "gold")
            {
                return new Priced(QuoteOf(sum - 4), QuoteOf(sum - 2), parts.Unpriced);
            }

            if (card.Rarity == "blue" && parts.Conditional)
            {
                return new Priced(QuoteOf(sum - 2), QuoteOf(sum), parts.Unpriced);
            }

            int quote = QuoteOf(sum);
            return new Priced(quote, quote, parts.Unpriced);
        }

        private static void PriceAbility(ContentCatalog catalog, CardDefinition card, AbilityDefinition ability, Parts parts)
        {
            if (IsConditional(ability))
            {
                parts.Conditional = true;
            }

            int times = Times(ability);
            if (ability.Absorb)
            {
                parts.Effect += 4;
            }

            PriceActions(catalog, card, ability, ability.Actions, times, parts);
            if (ability.Cost == null)
            {
                return;
            }

            if (ability.Cost.Sacrifice > 0)
            {
                parts.Discount += ability.Cost.Sacrifice * (times == 0 ? 1 : times);
            }

            if (ability.Cost.Resource.Length == 0)
            {
                return;
            }

            if (ability.Cost.All)
            {
                parts.Discount += 4;
                return;
            }

            parts.Discount += ability.Cost.Amount * (times == 0 ? 1 : times);
        }

        private static void PriceActions(ContentCatalog catalog, CardDefinition card, AbilityDefinition ability, ActionDefinition[] actions, int times, Parts parts)
        {
            for (int i = 0; i < actions.Length; i++)
            {
                PriceAction(catalog, card, ability, actions[i], times, parts);
            }
        }

        private static void PriceAction(ContentCatalog catalog, CardDefinition card, AbilityDefinition ability, ActionDefinition action, int times, Parts parts)
        {
            int scale = times == 0 ? 1 : times;
            if (action.Kind == "change-points")
            {
                if (action.From == "discard-count" || action.From == "discard-units")
                {
                    int each = action.Amount == 0 ? 1 : action.Amount;
                    parts.Effect += 6 * each * scale;
                    return;
                }

                if (action.From == "spent")
                {
                    int each = action.Amount == 0 ? 1 : action.Amount;
                    parts.Effect += 8 * each;
                    return;
                }

                if (action.Amount > 0)
                {
                    parts.Effect += action.Amount * 2 * scale;
                    return;
                }

                if (action.Amount < 0)
                {
                    int loss = -action.Amount * 2 * scale;
                    if (HurtsOpponent(ability, action))
                    {
                        parts.Effect += loss;
                    }
                    else if (action.Target == "self")
                    {
                        parts.Discount += loss;
                    }
                }

                return;
            }

            if (action.Kind == "add-status")
            {
                if (action.Status == "status.mark")
                {
                    parts.Effect += action.Target == "adjacent-opponents" ? 3 * scale : scale;
                    return;
                }

                if (action.Status == "status.protect")
                {
                    parts.Effect += 2 * scale;
                    return;
                }

                if (action.Status == "status.return")
                {
                    parts.Effect += 4 * scale;
                    return;
                }

                if (action.Status == "status.seal")
                {
                    parts.Effect += 6 * scale;
                }

                return;
            }

            if (action.Kind == "draw")
            {
                int count = action.Count == 0 ? 1 : action.Count;
                parts.Effect += count * 2 * scale;
                return;
            }

            if (action.Kind == "play-extra")
            {
                parts.Effect += 6 * scale;
                return;
            }

            if (action.Kind == "gain-resource")
            {
                parts.Effect += action.Amount * scale;
                return;
            }

            if (action.Kind == "copy")
            {
                parts.Effect += action.To == "deck" ? 2 * scale : 16 * scale;
                if (action.Link)
                {
                    parts.Discount += 2;
                }

                return;
            }

            if (action.Kind == "look-top")
            {
                parts.Effect += 4 * scale;
                return;
            }

            if (action.Kind == "shuffle-discard")
            {
                int count = action.Count == 0 ? 1 : action.Count;
                if (count > 3)
                {
                    count = 3;
                }

                parts.Effect += count * 2 * scale;
                return;
            }

            if (action.Kind == "remove")
            {
                parts.Effect += 12 * scale;
                return;
            }

            if (action.Kind == "transform")
            {
                parts.Unpriced = true;
                return;
            }

            if (action.Kind == "reset-points" || action.Kind == "take-hand")
            {
                parts.Effect += 6 * scale;
                return;
            }

            if (action.Kind == "shuffle-self")
            {
                parts.Effect += 2 * scale;
                return;
            }

            if (action.Kind == "double-points")
            {
                parts.Effect += card.Points * 2 * scale;
                return;
            }

            if (action.Kind == "continuous-points")
            {
                parts.Effect += action.Amount * 6 * scale;
                return;
            }

            if (action.Kind == "grant" && action.Ability.Length > 0)
            {
                AbilityDefinition granted = catalog.RequireAbility(action.Ability);
                PriceActions(catalog, card, granted, granted.Actions, Times(granted), parts);
                return;
            }

            if (action.Kind == "branch-deck" || action.Kind == "branch-resource" || action.Kind == "branch-adjacent" || action.Kind == "branch-status")
            {
                parts.Conditional = true;
                var present = new Parts();
                var absent = new Parts();
                PriceActions(catalog, card, ability, action.Present, scale, present);
                PriceActions(catalog, card, ability, action.Absent, scale, absent);
                if (present.Unpriced || absent.Unpriced)
                {
                    parts.Unpriced = true;
                }

                if (present.Effect - present.Discount >= absent.Effect - absent.Discount)
                {
                    parts.Effect += present.Effect;
                    parts.Discount += present.Discount;
                }
                else
                {
                    parts.Effect += absent.Effect;
                    parts.Discount += absent.Discount;
                }
            }
        }

        private static bool HurtsOpponent(AbilityDefinition ability, ActionDefinition action)
        {
            if (action.Target == "self")
            {
                return false;
            }

            if (action.Target == "adjacent-opponents")
            {
                return true;
            }

            return ability.Target != null && ability.Target.Side == "opponent";
        }

        private static bool IsConditional(AbilityDefinition ability)
        {
            if (ability.Trigger != "enter" && ability.Trigger != "cast" && ability.Trigger != "static" && ability.Trigger != "leave")
            {
                return true;
            }

            if (ability.Target != null && (ability.Target.Status.Length > 0 || ability.Target.Adjacent))
            {
                return true;
            }

            return HasBranch(ability.Actions);
        }

        private static bool HasBranch(ActionDefinition[] actions)
        {
            for (int i = 0; i < actions.Length; i++)
            {
                string kind = actions[i].Kind;
                if (kind == "branch-deck" || kind == "branch-resource" || kind == "branch-adjacent" || kind == "branch-status")
                {
                    return true;
                }
            }

            return false;
        }

        private static int Times(AbilityDefinition ability)
        {
            if (ability.Trigger == "turn-start" || ability.Trigger == "turn-end" || ability.Trigger == "unit-leave" || ability.Trigger == "ally-play" || ability.Trigger == "enemy-adjacent-play" || ability.Trigger == "other-enter" || ability.Trigger == "polluted-play")
            {
                return 2;
            }

            if (ability.Trigger == "countdown")
            {
                int interval = ability.Countdown <= 0 ? 1 : ability.Countdown;
                int times = 2 / interval;
                return times < 1 ? 1 : times;
            }

            if (ability.Trigger == "static")
            {
                return 0;
            }

            return 1;
        }

        private static int Body(int points)
        {
            if (points <= 0)
            {
                return 0;
            }

            if (points <= 6)
            {
                return points;
            }

            if (points == 8)
            {
                return 7;
            }

            if (points == 10)
            {
                return 8;
            }

            if (points == 12)
            {
                return 9;
            }

            return points;
        }

        private static int QuoteOf(int halves)
        {
            if (halves < 0)
            {
                halves = 0;
            }

            int raw = (halves + 1) / 2;
            return raw < 4 ? 4 : raw;
        }

        private sealed class Parts
        {
            public int Effect;
            public int Discount;
            public bool Conditional;
            public bool Unpriced;
        }

        private readonly struct Priced
        {
            public Priced(int low, int high, bool unpriced)
            {
                Low = low;
                High = high < low ? low : high;
                Unpriced = unpriced;
            }

            public int Low { get; }
            public int High { get; }
            public bool Unpriced { get; }
        }

        private readonly struct Sample
        {
            public Sample(string cardId, int load, string rarity)
            {
                CardId = cardId;
                Load = load;
                Rarity = rarity;
            }

            public string CardId { get; }
            public int Load { get; }
            public string Rarity { get; }
        }

        private static readonly Sample[] Samples =
        {
            new Sample("card.c001", 4, ""),
            new Sample("card.c023", 5, "blue"),
            new Sample("card.c026", 4, "gold"),
            new Sample("card.c017", 10, ""),
            new Sample("card.c022", 6, ""),
            new Sample("card.c024", 4, ""),
            new Sample("card.c029", 5, ""),
            new Sample("card.c037", 9, "gold"),
            new Sample("card.c008", 5, ""),
            new Sample("card.c031", 6, ""),
            new Sample("card.c027", 4, ""),
            new Sample("card.c032", 6, ""),
            new Sample("card.c036", 8, "blue"),
            new Sample("card.c033", 8, ""),
            new Sample("card.c038", 4, ""),
            new Sample("card.c042", 7, ""),
            new Sample("card.c041", 6, "gold"),
            new Sample("card.c040", 5, ""),
            new Sample("card.c014", 10, ""),
            new Sample("card.c043", 8, ""),
            new Sample("card.c051", 7, ""),
            new Sample("card.c045", 4, ""),
            new Sample("card.c047", 4, "gold"),
            new Sample("card.c049", 7, ""),
            new Sample("card.c050", 5, "gold")
        };
    }
}
