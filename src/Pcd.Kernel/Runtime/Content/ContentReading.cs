using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Pcd.Kernel
{
    public sealed partial class ContentCatalog
    {
        private void Remember(string id, string name)
        {
            ValidateId(id);
            if (_names.ContainsKey(id) || _cards.ContainsKey(id) || _abilities.ContainsKey(id))
            {
                throw new ContentException("内容 " + id + "：标识重复。");
            }

            _names[id] = name.Length == 0 ? id : name;
        }

        private void ValidateAbilities(string owner, AbilityDefinition[] abilities)
        {
            for (int i = 0; i < abilities.Length; i++)
            {
                ValidateAbilityRefs(owner, abilities[i]);
            }
        }

        private void ValidateSharedAbilities()
        {
            var ids = new List<string>();
            foreach (KeyValuePair<string, AbilityDefinition> pair in _abilities)
            {
                ids.Add(pair.Key);
            }

            ids.Sort(StringComparer.Ordinal);
            for (int i = 0; i < ids.Count; i++)
            {
                ValidateAbilityRefs(ids[i], _abilities[ids[i]]);
            }
        }

        private void ValidateAbilityRefs(string owner, AbilityDefinition ability)
        {
            if (ability.Cost != null && ability.Cost.Resource.Length > 0 && !_resources.ContainsKey(ability.Cost.Resource))
            {
                throw new ContentException("内容 " + owner + "：找不到资源 " + ability.Cost.Resource + "。");
            }

            if (ability.Target != null && ability.Target.Status.Length > 0 && !_statuses.ContainsKey(ability.Target.Status))
            {
                throw new ContentException("内容 " + owner + "：找不到状态 " + ability.Target.Status + "。");
            }

            for (int i = 0; i < ability.Actions.Length; i++)
            {
                ValidateAction(owner, ability.Actions[i]);
            }
        }

        private void ValidateAction(string owner, ActionDefinition action)
        {
            if (action.Status.Length > 0 && !_statuses.ContainsKey(action.Status))
            {
                throw new ContentException("内容 " + owner + "：找不到状态 " + action.Status + "。");
            }

            if (action.EachStatus.Length > 0 && !_statuses.ContainsKey(action.EachStatus))
            {
                throw new ContentException("内容 " + owner + "：找不到状态 " + action.EachStatus + "。");
            }

            if (action.Resource.Length > 0 && !_resources.ContainsKey(action.Resource))
            {
                throw new ContentException("内容 " + owner + "：找不到资源 " + action.Resource + "。");
            }

            if (action.Card.Length > 0 && !_cards.ContainsKey(action.Card))
            {
                throw new ContentException("内容 " + owner + "：找不到卡牌 " + action.Card + "。");
            }

            if (action.Ability.Length > 0 && !_abilities.ContainsKey(action.Ability))
            {
                throw new ContentException("内容 " + owner + "：找不到能力 " + action.Ability + "。");
            }

            for (int i = 0; i < action.Present.Length; i++)
            {
                ValidateAction(owner, action.Present[i]);
            }

            for (int i = 0; i < action.Absent.Length; i++)
            {
                ValidateAction(owner, action.Absent[i]);
            }
        }

        private static bool IsSchool(string school)
        {
            return school.Length == 0 || school == "science" || school == "mystery" || school == "religion" || school == "neutral";
        }

        private static bool AnyBackHasAbility(BackDefinition[] backs)
        {
            for (int i = 0; i < backs.Length; i++)
            {
                if (backs[i].Abilities.Length > 0)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool AnyCardHasAbility(CardDefinition[] cards)
        {
            for (int i = 0; i < cards.Length; i++)
            {
                if (cards[i].Abilities.Length > 0)
                {
                    return true;
                }
            }

            return false;
        }

        private static AbilityDefinition[] CopyAbilities(AbilityDefinition[] abilities)
        {
            var copy = new AbilityDefinition[abilities.Length];
            for (int i = 0; i < abilities.Length; i++)
            {
                copy[i] = abilities[i];
            }

            return copy;
        }

        private static void AppendAbilities(StringBuilder builder, string owner, AbilityDefinition[] abilities)
        {
            for (int i = 0; i < abilities.Length; i++)
            {
                AbilityDefinition ability = abilities[i];
                builder.Append("ability ");
                builder.Append(owner);
                builder.Append(' ');
                builder.Append(i.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(ability.Trigger);
                builder.Append(' ');
                builder.Append(ability.WhileOnBoard ? "board" : "any");
                builder.Append(' ');
                builder.Append(ability.Countdown.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(ability.Swift ? "swift" : "-");
                builder.Append(' ');
                builder.Append(ability.Exhaust ? "exhaust" : "-");
                builder.Append(' ');
                builder.Append(ability.CoverAlly ? "ally" : "-");
                builder.Append(' ');
                builder.Append(ability.Absorb ? "absorb" : "-");
                builder.Append(' ');
                builder.Append(ability.Script);
                builder.Append(' ');
                builder.Append(ability.Side);
                if (ability.Cost != null)
                {
                    builder.Append(" cost ");
                    builder.Append(ability.Cost.Sacrifice.ToString(CultureInfo.InvariantCulture));
                    builder.Append(' ');
                    builder.Append(ability.Cost.Resource);
                    builder.Append(' ');
                    builder.Append(ability.Cost.Amount.ToString(CultureInfo.InvariantCulture));
                    builder.Append(' ');
                    builder.Append(ability.Cost.All ? "all" : "-");
                }

                builder.Append('\n');
                for (int a = 0; a < ability.Actions.Length; a++)
                {
                    AppendAction(builder, owner, i, a, ability.Actions[a]);
                }
            }
        }

        private static void AppendAction(StringBuilder builder, string owner, int ability, int index, ActionDefinition action)
        {
            builder.Append("action ");
            builder.Append(owner);
            builder.Append(' ');
            builder.Append(ability.ToString(CultureInfo.InvariantCulture));
            builder.Append(' ');
            builder.Append(index.ToString(CultureInfo.InvariantCulture));
            builder.Append(' ');
            builder.Append(action.Kind);
            builder.Append(' ');
            builder.Append(action.Amount.ToString(CultureInfo.InvariantCulture));
            builder.Append(' ');
            builder.Append(action.Count.ToString(CultureInfo.InvariantCulture));
            builder.Append(' ');
            builder.Append(action.Status);
            builder.Append(' ');
            builder.Append(action.Card);
            builder.Append(' ');
            builder.Append(action.Resource);
            builder.Append(' ');
            builder.Append(action.Ability);
            builder.Append(' ');
            builder.Append(action.To);
            builder.Append(' ');
            builder.Append(action.From);
            builder.Append(' ');
            builder.Append(action.EachStatus);
            builder.Append(' ');
            builder.Append(action.Link ? "link" : "-");
            builder.Append('\n');
            for (int p = 0; p < action.Present.Length; p++)
            {
                AppendAction(builder, owner, ability, index * 100 + p, action.Present[p]);
            }

            for (int p = 0; p < action.Absent.Length; p++)
            {
                AppendAction(builder, owner, ability, index * 100 + 50 + p, action.Absent[p]);
            }
        }

        private static List<AbilityDefinition> ReadAbilities(YamlNode? node)
        {
            return ReadAbilityList(node, "abilities");
        }

        private static List<AbilityDefinition> ReadAbilityList(YamlNode? node, string owner)
        {
            var list = new List<AbilityDefinition>();
            if (node == null)
            {
                return list;
            }

            if (!node.IsSequence)
            {
                throw new ContentException("内容 " + owner + "：abilities 必须是列表。");
            }

            for (int i = 0; i < node.Items.Count; i++)
            {
                list.Add(ReadAbility(node.Items[i], owner));
            }

            return list;
        }

        private static AbilityDefinition ReadAbility(YamlNode node, string owner)
        {
            if (!node.IsMap)
            {
                throw new ContentException("内容 " + owner + "：能力必须是映射。");
            }

            var ability = new AbilityDefinition
            {
                Id = node.Str("id") ?? "",
                Trigger = node.Str("trigger") ?? "enter",
                WhileOnBoard = node.Str("zone") == "board" || node.Str("while") == "board",
                OwnerTurn = node.Str("ownerTurn") != "false",
                Side = node.Str("side") ?? "",
                Countdown = node.Has("countdown") ? node.Int("countdown") : 0,
                Swift = node.Str("swift") == "true",
                Exhaust = node.Str("exhaust") == "true",
                CoverAlly = node.Str("coverAlly") == "true",
                Absorb = node.Str("absorb") == "true",
                Script = node.Str("script") ?? ""
            };
            YamlNode? cost = node.Get("cost");
            if (cost != null)
            {
                if (!cost.IsMap)
                {
                    throw new ContentException("内容 " + owner + "：代价必须是映射。");
                }

                ability.Cost = new CostDefinition
                {
                    Sacrifice = cost.Has("sacrifice") ? cost.Int("sacrifice") : 0,
                    Resource = cost.Str("resource") ?? "",
                    Amount = cost.Has("amount") ? cost.Int("amount") : 0,
                    All = cost.Str("all") == "true"
                };
            }

            YamlNode? target = node.Get("target");
            if (target != null)
            {
                ability.Target = ReadTarget(target, owner);
            }

            ability.Actions = ReadActions(node.Get("actions"), owner).ToArray();
            return ability;
        }

        private static TargetDefinition ReadTarget(YamlNode node, string owner)
        {
            if (!node.IsMap)
            {
                throw new ContentException("内容 " + owner + "：目标必须是映射。");
            }

            return new TargetDefinition
            {
                Pick = node.Str("pick") ?? "one",
                Side = node.Str("side") ?? "any",
                Zone = node.Str("zone") ?? "board",
                Status = node.Str("status") ?? "",
                Adjacent = node.Str("adjacent") == "true",
                AllowSelf = node.Str("allowSelf") != "false",
                Kind = node.Str("kind") ?? "any"
            };
        }

        private static List<ActionDefinition> ReadActions(YamlNode? node, string owner)
        {
            var list = new List<ActionDefinition>();
            if (node == null)
            {
                return list;
            }

            if (!node.IsSequence)
            {
                throw new ContentException("内容 " + owner + "：动作必须是列表。");
            }

            for (int i = 0; i < node.Items.Count; i++)
            {
                list.Add(ReadAction(node.Items[i], owner));
            }

            return list;
        }

        private static ActionDefinition ReadAction(YamlNode node, string owner)
        {
            if (!node.IsMap)
            {
                throw new ContentException("内容 " + owner + "：动作必须是映射。");
            }

            string? kind = node.Str("kind");
            if (kind == null)
            {
                throw new ContentException("内容 " + owner + "：动作缺少 kind。");
            }

            return new ActionDefinition
            {
                Kind = kind,
                Amount = node.Has("amount") ? node.Int("amount") : 0,
                Count = node.Has("count") ? node.Int("count") : 0,
                Status = node.Str("status") ?? "",
                Card = node.Str("card") ?? "",
                Resource = node.Str("resource") ?? "",
                Target = node.Str("target") ?? "",
                To = node.Str("to") ?? "",
                Of = node.Str("of") ?? "",
                From = node.Str("from") ?? "",
                Ability = node.Str("ability") ?? "",
                Script = node.Str("script") ?? "",
                Side = node.Str("side") ?? "",
                EachStatus = node.Str("eachStatus") ?? "",
                Link = node.Str("link") == "true",
                Present = ReadActions(node.Get("present"), owner).ToArray(),
                Absent = ReadActions(node.Get("absent"), owner).ToArray()
            };
        }

        private static List<StatusDefinition> ReadStatuses(YamlNode? node)
        {
            var list = new List<StatusDefinition>();
            if (node == null)
            {
                return list;
            }

            if (!node.IsSequence)
            {
                throw new ContentException("statuses 必须是列表。");
            }

            for (int i = 0; i < node.Items.Count; i++)
            {
                YamlNode item = node.Items[i];
                string? id = item.Str("id");
                if (id == null)
                {
                    throw new ContentException("状态缺少 id。");
                }

                list.Add(new StatusDefinition(id, item.Str("name") ?? id, item.Str("stack") == "true", item.Str("suppresses") == "true"));
            }

            return list;
        }

        private static List<ResourceDefinition> ReadResources(YamlNode? node)
        {
            var list = new List<ResourceDefinition>();
            if (node == null)
            {
                return list;
            }

            if (!node.IsSequence)
            {
                throw new ContentException("resources 必须是列表。");
            }

            for (int i = 0; i < node.Items.Count; i++)
            {
                YamlNode item = node.Items[i];
                string? id = item.Str("id");
                if (id == null)
                {
                    throw new ContentException("资源缺少 id。");
                }

                list.Add(new ResourceDefinition(id, item.Str("name") ?? id));
            }

            return list;
        }

        private static List<KeywordDefinition> ReadKeywords(YamlNode? node)
        {
            var list = new List<KeywordDefinition>();
            if (node == null)
            {
                return list;
            }

            if (!node.IsSequence)
            {
                throw new ContentException("keywords 必须是列表。");
            }

            for (int i = 0; i < node.Items.Count; i++)
            {
                YamlNode item = node.Items[i];
                string? id = item.Str("id");
                if (id == null)
                {
                    throw new ContentException("词条缺少 id。");
                }

                list.Add(new KeywordDefinition(id, item.Str("name") ?? id));
            }

            return list;
        }

        private static List<DeckDefinition> ReadDecks(YamlNode? node)
        {
            var list = new List<DeckDefinition>();
            if (node == null)
            {
                return list;
            }

            if (!node.IsSequence)
            {
                throw new ContentException("decks 必须是列表。");
            }

            for (int i = 0; i < node.Items.Count; i++)
            {
                YamlNode item = node.Items[i];
                string? id = item.Str("id");
                if (id == null)
                {
                    throw new ContentException("牌组缺少 id。");
                }

                YamlNode? cards = item.Get("cards");
                if (cards == null)
                {
                    throw new ContentException("内容 " + id + "：牌组缺少 cards。");
                }

                list.Add(new DeckDefinition(id, item.Str("name") ?? id, ReadIdList(cards, id)));
            }

            return list;
        }

        private static List<BackDefinition> ReadBacks(YamlNode? node)
        {
            var list = new List<BackDefinition>();
            if (node == null)
            {
                return list;
            }

            if (!node.IsSequence)
            {
                throw new ContentException("backs 必须是列表。");
            }

            for (int i = 0; i < node.Items.Count; i++)
            {
                YamlNode item = node.Items[i];
                string? id = item.Str("id");
                if (id == null)
                {
                    throw new ContentException("卡背缺少 id。");
                }

                int load = item.Has("load") ? item.Int("load") : 0;
                int cap = item.Has("cap") ? item.Int("cap") : 0;
                int points = item.Has("points") ? item.Int("points") : 0;
                AbilityDefinition[] abilities = ReadAbilityList(item.Get("abilities"), id).ToArray();
                list.Add(new BackDefinition(id, item.Str("name") ?? id, load, abilities, cap, points));
            }

            return list;
        }
    }
}
