using System.Collections.Generic;
using System.Globalization;

namespace Pcd.Kernel
{
    public static class CardText
    {
        public static string Render(ContentCatalog catalog, CardDefinition card)
        {
            if (card.TextOverride.Length > 0)
            {
                return card.TextOverride;
            }

            var parts = new List<string>();
            for (int i = 0; i < card.Abilities.Length; i++)
            {
                string text = RenderAbility(catalog, card.Abilities[i]);
                if (text.Length > 0)
                {
                    parts.Add(text);
                }
            }

            return string.Join("", parts);
        }

        public static string RenderBack(ContentCatalog catalog, BackDefinition back)
        {
            var parts = new List<string>();
            if (back.Points > 0)
            {
                parts.Add("点数+" + back.Points.ToString(CultureInfo.InvariantCulture));
            }

            for (int i = 0; i < back.Abilities.Length; i++)
            {
                string text = RenderAbility(catalog, back.Abilities[i]);
                if (text.Length > 0)
                {
                    parts.Add(text);
                }
            }

            if (parts.Count == 0)
            {
                return "";
            }

            if (back.Points > 0 && parts.Count > 1)
            {
                parts[0] = parts[0] + "。";
            }

            return string.Join("", parts);
        }

        private static string RenderAbility(ContentCatalog catalog, AbilityDefinition ability)
        {
            if (ability.Trigger == "static")
            {
                var bits = new List<string>();
                if (ability.Swift)
                {
                    bits.Add(Word(catalog, "keyword.swift", "迅捷"));
                }

                if (ability.Exhaust)
                {
                    bits.Add(Word(catalog, "keyword.exhaust", "燃尽"));
                }

                if (ability.CoverAlly)
                {
                    bits.Add("可以打出到己方卡牌所在的格位");
                }

                if (ability.Absorb)
                {
                    bits.Add("获得该卡的当前点数，然后移除该卡");
                }

                return bits.Count == 0 ? "" : string.Join("，", bits) + "。";
            }

            string body = RenderBody(catalog, ability);
            string timing = RenderTiming(catalog, ability);
            if (timing.Length == 0)
            {
                return body;
            }

            return timing + body;
        }

        private static string RenderTiming(ContentCatalog catalog, AbilityDefinition ability)
        {
            string enter = Word(catalog, "keyword.enter", "入场");
            string leave = Word(catalog, "keyword.leave", "离场");
            string board = Word(catalog, "keyword.board", "驻场");
            if (ability.Trigger == "enter" || ability.Trigger == "cast")
            {
                return enter + "：";
            }

            if (ability.Trigger == "leave")
            {
                return leave + "：";
            }

            if (ability.Trigger == "countdown")
            {
                return board + "：" + Word(catalog, "keyword.countdown", "计时") + ability.Countdown.ToString(CultureInfo.InvariantCulture) + "，";
            }

            if (ability.Trigger == "turn-start" && ability.WhileOnBoard)
            {
                return board + "：己方回合开始时，";
            }

            if (ability.Trigger == "turn-end" && ability.WhileOnBoard)
            {
                return board + "：己方回合结束时，";
            }

            if (ability.Trigger == "unit-leave" && ability.WhileOnBoard)
            {
                return board + "：每当一张占场卡离场，";
            }

            if (ability.Trigger == "ally-play" && ability.WhileOnBoard)
            {
                return board + "：每当己方打出一张其他卡牌，";
            }

            if (ability.WhileOnBoard && (ability.Trigger == "continuous" || ability.Trigger == "enemy-adjacent-play" || ability.Trigger == "enemy-spell" || ability.Trigger == "polluted-play" || ability.Trigger == "other-enter"))
            {
                return board + "：";
            }

            if (ability.Trigger == "activated")
            {
                return Word(catalog, "keyword.activated", "主动触发") + "：";
            }

            return "";
        }

        private static string RenderBody(ContentCatalog catalog, AbilityDefinition ability)
        {
            if (ability.Trigger == "continuous")
            {
                return Continuous(catalog, ability);
            }

            if (ability.Trigger == "enemy-adjacent-play")
            {
                return "敌方卡牌打出到相邻格时，为其添加" + StatusName(catalog, "status.mark") + "。";
            }

            if (ability.Trigger == "enemy-spell")
            {
                return "敌方每打出一张法术卡，己方卡牌的计时-1。";
            }

            if (ability.Trigger == "polluted-play")
            {
                return "每当有卡牌打出到" + Word(catalog, "keyword.pollution", "污染格") + "，本卡点数+2。";
            }

            var parts = new List<string>();
            if (ability.Cost != null && ability.Cost.Sacrifice > 0)
            {
                parts.Add(Word(catalog, "keyword.sacrifice", "献祭") + ability.Cost.Sacrifice.ToString(CultureInfo.InvariantCulture));
            }

            if (ability.Cost != null && ability.Cost.Resource.Length > 0)
            {
                if (ability.Cost.All)
                {
                    parts.Add("消耗所有" + catalog.NameOf(ability.Cost.Resource));
                }
                else
                {
                    parts.Add("消耗" + ability.Cost.Amount.ToString(CultureInfo.InvariantCulture) + "点" + catalog.NameOf(ability.Cost.Resource));
                }
            }

            if (ability.Target != null && ability.Target.Pick == "one")
            {
                parts.Add("选择" + TargetPhrase(catalog, ability.Target));
            }
            else if (ability.Target != null && ability.Target.Pick == "random")
            {
                parts.Add("随机选择" + TargetPhrase(catalog, ability.Target));
            }

            for (int i = 0; i < ability.Actions.Length; i++)
            {
                parts.Add(ActionPhrase(catalog, ability.Actions[i]));
            }

            if (parts.Count == 0)
            {
                return "";
            }

            return Join(parts) + "。";
        }

        private static string Continuous(ContentCatalog catalog, AbilityDefinition ability)
        {
            for (int i = 0; i < ability.Actions.Length; i++)
            {
                ActionDefinition action = ability.Actions[i];
                if (action.Kind == "continuous-points")
                {
                    return "每有一张拥有" + StatusName(catalog, action.EachStatus) + "的卡牌，本卡点数+" + action.Amount.ToString(CultureInfo.InvariantCulture) + "。";
                }
            }

            return "";
        }

        private static string TargetPhrase(ContentCatalog catalog, TargetDefinition target)
        {
            string who = target.Side == "opponent" ? "敌方" : target.Side == "ally" ? "己方" : "";
            if (target.Zone == "discard")
            {
                return "一张" + who + "弃牌堆中的卡牌";
            }

            string where = target.Adjacent ? Word(catalog, "keyword.adjacent", "相邻") : "";
            string status = target.Status.Length == 0 ? "" : "拥有" + StatusName(catalog, target.Status) + "的";
            string kind = target.Kind == "unit" ? "占场卡" : "卡牌";
            return "一张" + where + status + who + kind;
        }

        private static string ActionPhrase(ContentCatalog catalog, ActionDefinition action)
        {
            if (action.Kind == "add-status")
            {
                if (action.Target == "self")
                {
                    return "为本卡添加" + StatusName(catalog, action.Status);
                }

                if (action.Target == "adjacent-opponents")
                {
                    return "为相邻敌方卡牌添加" + StatusName(catalog, action.Status);
                }

                if (action.Status == "status.seal")
                {
                    return "封印该卡牌";
                }

                if (action.Status == "status.protect" || action.Status == "status.return")
                {
                    return "使其获得" + StatusName(catalog, action.Status);
                }

                return "添加" + StatusName(catalog, action.Status);
            }

            if (action.Kind == "clear-status")
            {
                return "清除" + StatusName(catalog, action.Status);
            }

            if (action.Kind == "change-points")
            {
                string who = action.Target == "self" ? "本卡" : "使其";
                if (action.From == "discard-count" && action.Amount <= 1 && action.Target == "self")
                {
                    return "本卡点数+己方弃牌堆的卡牌数量";
                }

                if (action.From == "discard-count" || action.From == "discard-units")
                {
                    int each = action.Amount == 0 ? 1 : action.Amount;
                    string whoCount = action.Target == "self" ? "本卡" : "使其";
                    string pile = action.From == "discard-units" ? "己方弃牌堆里每有一张占场卡，" : "己方弃牌堆里每有一张卡牌，";
                    return pile + whoCount + "点数+" + each.ToString(CultureInfo.InvariantCulture);
                }

                if (action.From == "spent")
                {
                    int eachSpent = action.Amount == 0 ? 1 : action.Amount;
                    return "每消耗1点，本卡点数+" + eachSpent.ToString(CultureInfo.InvariantCulture);
                }

                string amount = action.Amount.ToString(CultureInfo.InvariantCulture);
                return action.Amount >= 0 ? who + "点数+" + amount : who + "点数" + amount;
            }

            if (action.Kind == "gain-resource")
            {
                return "获得" + action.Amount.ToString(CultureInfo.InvariantCulture) + "点" + catalog.NameOf(action.Resource);
            }

            if (action.Kind == "copy")
            {
                string place;
                if (action.Of == "chosen" && action.To == "empty")
                {
                    place = "在一个空格生成一张它的复制";
                }
                else if (action.To == "mirror")
                {
                    place = "在镜像格生成一张本卡的复制";
                }
                else if (action.To == "deck")
                {
                    place = "将一张本卡的复制洗入牌组";
                }
                else
                {
                    place = "生成一张复制";
                }
                if (action.Link)
                {
                    place += "，当其中一张离场，移除另一张";
                }

                return place;
            }

            if (action.Kind == "transform")
            {
                return Word(catalog, "keyword.transform", "转化") + "为" + catalog.NameOf(action.Card);
            }

            if (action.Kind == "grant")
            {
                AbilityDefinition granted = catalog.RequireAbility(action.Ability);
                return "并获得计时" + granted.Countdown.ToString(CultureInfo.InvariantCulture) + "：点数" + GrantDelta(granted);
            }

            if (action.Kind == "shuffle-discard")
            {
                return "随机将至多" + CountWord(action.Count) + "张弃牌堆卡牌洗入牌组";
            }

            if (action.Kind == "branch-status")
            {
                string mark = StatusName(catalog, action.Status);
                return "若其拥有" + mark + "，则" + JoinActions(catalog, action.Present) + "，否则" + JoinActions(catalog, action.Absent);
            }

            if (action.Kind == "draw")
            {
                int drawn = action.Count == 0 ? 1 : action.Count;
                return drawn == 1 ? "抽一张牌" : "抽" + CountWord(drawn) + "张牌";
            }

            if (action.Kind == "look-top")
            {
                int looked = action.Count == 0 ? 3 : action.Count;
                return "查看牌组顶部" + looked.ToString(CultureInfo.InvariantCulture) + "张卡牌，选择一张加入手牌，移除其余";
            }

            if (action.Kind == "play-extra")
            {
                return "再打出一张手牌";
            }

            if (action.Kind == "take-hand")
            {
                return "将其放回手牌";
            }

            if (action.Kind == "reset-points")
            {
                return "将其点数重置为初始点数";
            }

            if (action.Kind == "double-points")
            {
                return "本卡点数翻倍";
            }

            if (action.Kind == "shuffle-self")
            {
                return "将本卡洗入牌组";
            }

            if (action.Kind == "branch-deck")
            {
                return "若己方牌组不超过" + action.Count.ToString(CultureInfo.InvariantCulture) + "张，则" + JoinActions(catalog, action.Present) + Otherwise(catalog, action.Absent);
            }

            if (action.Kind == "branch-resource")
            {
                return "若" + catalog.NameOf(action.Resource) + "不少于" + action.Count.ToString(CultureInfo.InvariantCulture) + "，则" + JoinActions(catalog, action.Present) + Otherwise(catalog, action.Absent);
            }

            if (action.Kind == "branch-adjacent")
            {
                return "若有相邻敌方卡牌，则" + JoinActions(catalog, action.Present) + Otherwise(catalog, action.Absent);
            }

            if (action.Kind == "remove")
            {
                return Word(catalog, "keyword.remove", "移除") + "该卡牌";
            }

            return action.Kind;
        }

        private static string GrantDelta(AbilityDefinition ability)
        {
            for (int i = 0; i < ability.Actions.Length; i++)
            {
                if (ability.Actions[i].Kind == "change-points")
                {
                    return ability.Actions[i].Amount.ToString(CultureInfo.InvariantCulture);
                }
            }

            return "0";
        }

        private static string Otherwise(ContentCatalog catalog, ActionDefinition[] actions)
        {
            if (actions.Length == 0)
            {
                return "";
            }

            return "，否则" + JoinActions(catalog, actions);
        }

        private static string JoinActions(ContentCatalog catalog, ActionDefinition[] actions)
        {
            var parts = new List<string>();
            for (int i = 0; i < actions.Length; i++)
            {
                parts.Add(ActionPhrase(catalog, actions[i]));
            }

            return Join(parts);
        }

        private static string Join(List<string> parts)
        {
            return string.Join("，", parts);
        }

        private static string StatusName(ContentCatalog catalog, string id)
        {
            return id.Length == 0 ? "" : catalog.NameOf(id);
        }

        private static string Word(ContentCatalog catalog, string id, string fallback)
        {
            string name = catalog.NameOf(id);
            return name == id ? fallback : name;
        }

        private static string CountWord(int count)
        {
            if (count == 3)
            {
                return "三";
            }

            if (count == 2)
            {
                return "两";
            }

            return count.ToString(CultureInfo.InvariantCulture);
        }
    }
}
