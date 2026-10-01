using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Pcd.Kernel
{
    public sealed class ContentException : Exception
    {
        public ContentException(string message) : base(message)
        {
        }
    }

    public sealed class CardDefinition
    {
        public CardDefinition(
            string id,
            string name,
            bool spell,
            int points,
            int load,
            string rarity,
            AbilityDefinition[] abilities,
            string textOverride,
            string school)
        {
            Id = id;
            Name = name;
            IsSpell = spell;
            Points = points;
            Load = load;
            Rarity = rarity;
            Abilities = abilities;
            TextOverride = textOverride;
            School = school ?? "";
        }

        public string Id { get; }
        public string Name { get; }
        public bool IsSpell { get; }
        public int Points { get; }
        public int Load { get; }
        public string Rarity { get; }
        public string School { get; }
        public AbilityDefinition[] Abilities { get; }
        public string TextOverride { get; }
    }

    public sealed class StartingPlacement
    {
        public StartingPlacement(string cardId, bool randomCell, int cell)
        {
            CardId = cardId;
            RandomCell = randomCell;
            Cell = cell;
        }

        public string CardId { get; }
        public bool RandomCell { get; }
        public int Cell { get; }
    }

    public sealed class MonsterDefinition
    {
        public MonsterDefinition(
            string id,
            string name,
            StartingPlacement[] starting,
            string[] intents,
            string[] skills,
            Personality personality,
            string intentMode,
            string information)
        {
            Id = id;
            Name = name;
            Starting = starting;
            Intents = intents;
            Skills = skills;
            Personality = personality;
            IntentMode = intentMode;
            Information = information;
        }

        public string Id { get; }
        public string Name { get; }
        public StartingPlacement[] Starting { get; }
        public string[] Intents { get; }
        public string[] Skills { get; }
        public Personality Personality { get; }
        public string IntentMode { get; }
        public string Information { get; }
    }

    public sealed partial class ContentCatalog
    {
        private readonly Dictionary<string, CardDefinition> _cards;
        private readonly Dictionary<string, MonsterDefinition> _monsters;
        private readonly Dictionary<string, AbilityDefinition> _abilities;
        private readonly Dictionary<string, StatusDefinition> _statuses;
        private readonly Dictionary<string, ResourceDefinition> _resources;
        private readonly Dictionary<string, BackDefinition> _backs;
        private readonly Dictionary<string, string> _names;

        public ContentCatalog(
            CardDefinition[] cards,
            MonsterDefinition[] monsters,
            AbilityDefinition[] abilities,
            StatusDefinition[] statuses,
            ResourceDefinition[] resources,
            KeywordDefinition[] keywords,
            DeckDefinition[] decks,
            BackDefinition[] backs,
            string[] defaultDeck,
            string? defaultMonster)
        {
            if (cards == null)
            {
                throw new ArgumentNullException(nameof(cards));
            }

            if (monsters == null)
            {
                throw new ArgumentNullException(nameof(monsters));
            }

            if (abilities == null)
            {
                throw new ArgumentNullException(nameof(abilities));
            }

            if (statuses == null)
            {
                throw new ArgumentNullException(nameof(statuses));
            }

            if (resources == null)
            {
                throw new ArgumentNullException(nameof(resources));
            }

            if (keywords == null)
            {
                throw new ArgumentNullException(nameof(keywords));
            }

            if (decks == null)
            {
                throw new ArgumentNullException(nameof(decks));
            }

            if (backs == null)
            {
                throw new ArgumentNullException(nameof(backs));
            }

            if (defaultDeck == null)
            {
                throw new ArgumentNullException(nameof(defaultDeck));
            }

            _cards = new Dictionary<string, CardDefinition>(StringComparer.Ordinal);
            _monsters = new Dictionary<string, MonsterDefinition>(StringComparer.Ordinal);
            _abilities = new Dictionary<string, AbilityDefinition>(StringComparer.Ordinal);
            _statuses = new Dictionary<string, StatusDefinition>(StringComparer.Ordinal);
            _resources = new Dictionary<string, ResourceDefinition>(StringComparer.Ordinal);
            _backs = new Dictionary<string, BackDefinition>(StringComparer.Ordinal);
            _names = new Dictionary<string, string>(StringComparer.Ordinal);
            for (int i = 0; i < statuses.Length; i++)
            {
                Remember(statuses[i].Id, statuses[i].Name);
                if (_statuses.ContainsKey(statuses[i].Id))
                {
                    throw new ContentException("内容 " + statuses[i].Id + "：标识重复。");
                }

                _statuses.Add(statuses[i].Id, statuses[i]);
            }

            for (int i = 0; i < resources.Length; i++)
            {
                Remember(resources[i].Id, resources[i].Name);
                if (_resources.ContainsKey(resources[i].Id))
                {
                    throw new ContentException("内容 " + resources[i].Id + "：标识重复。");
                }

                _resources.Add(resources[i].Id, resources[i]);
            }

            for (int i = 0; i < keywords.Length; i++)
            {
                Remember(keywords[i].Id, keywords[i].Name);
            }

            for (int i = 0; i < backs.Length; i++)
            {
                Remember(backs[i].Id, backs[i].Name);
                if (backs[i].Load < 0 || backs[i].Load > 4)
                {
                    throw new ContentException("内容 " + backs[i].Id + "：卡背负荷必须是 0 到 4。");
                }

                if (_backs.ContainsKey(backs[i].Id))
                {
                    throw new ContentException("内容 " + backs[i].Id + "：标识重复。");
                }

                _backs.Add(backs[i].Id, backs[i]);
            }

            for (int i = 0; i < abilities.Length; i++)
            {
                AbilityDefinition ability = abilities[i];
                if (ability.Id.Length == 0)
                {
                    throw new ContentException("共享能力缺少标识。");
                }

                ValidateId(ability.Id);
                if (_abilities.ContainsKey(ability.Id) || _names.ContainsKey(ability.Id))
                {
                    throw new ContentException("内容 " + ability.Id + "：标识重复。");
                }

                _abilities.Add(ability.Id, ability);
                _names[ability.Id] = ability.Id;
            }

            var cardList = new List<CardDefinition>();
            for (int i = 0; i < cards.Length; i++)
            {
                CardDefinition card = cards[i];
                ValidateId(card.Id);
                if (_cards.ContainsKey(card.Id) || _names.ContainsKey(card.Id))
                {
                    throw new ContentException("内容 " + card.Id + "：标识重复。");
                }

                if (!card.IsSpell && card.Points < 0)
                {
                    throw new ContentException("内容 " + card.Id + "：点数不能为负。");
                }

                if (card.Name.IndexOf('\n') >= 0 || card.Name.IndexOf('\r') >= 0)
                {
                    throw new ContentException("内容 " + card.Id + "：名称不能换行。");
                }

                if (card.Load < 0)
                {
                    throw new ContentException("内容 " + card.Id + "：负荷不能为负。");
                }

                if (card.Rarity.Length > 0 && card.Rarity != "white" && card.Rarity != "blue" && card.Rarity != "gold")
                {
                    throw new ContentException("内容 " + card.Id + "：稀有度必须是 white、blue 或 gold。");
                }

                if (!IsSchool(card.School))
                {
                    throw new ContentException("内容 " + card.Id + "：体系必须是 science、mystery、religion 或 neutral。");
                }

                _cards.Add(card.Id, card);
                _names[card.Id] = card.Name;
                cardList.Add(card);
            }

            var monsterList = new List<MonsterDefinition>();
            for (int i = 0; i < monsters.Length; i++)
            {
                MonsterDefinition monster = monsters[i];
                ValidateId(monster.Id);
                if (_monsters.ContainsKey(monster.Id) || _cards.ContainsKey(monster.Id) || _names.ContainsKey(monster.Id))
                {
                    throw new ContentException("内容 " + monster.Id + "：标识重复。");
                }

                if (monster.Intents.Length < 1 || monster.Intents.Length > 4)
                {
                    throw new ContentException("内容 " + monster.Id + "：意图必须是 1 到 4 条。");
                }

                for (int s = 0; s < monster.Starting.Length; s++)
                {
                    StartingPlacement place = monster.Starting[s];
                    RequireCard(monster.Id, place.CardId);
                    CardDefinition placed = _cards[place.CardId];
                    if (placed.IsSpell)
                    {
                        throw new ContentException("内容 " + monster.Id + "：初始卡 " + place.CardId + " 必须是占场卡。");
                    }

                    if (!place.RandomCell && (place.Cell < 1 || place.Cell > 9))
                    {
                        throw new ContentException("内容 " + monster.Id + "：格位必须是 1 到 9 或 random。");
                    }
                }

                for (int n = 0; n < monster.Intents.Length; n++)
                {
                    RequireCard(monster.Id, monster.Intents[n]);
                }

                for (int n = 0; n < monster.Skills.Length; n++)
                {
                    if (!_abilities.ContainsKey(monster.Skills[n]))
                    {
                        throw new ContentException("内容 " + monster.Id + "：找不到能力 " + monster.Skills[n] + "。");
                    }
                }

                _monsters.Add(monster.Id, monster);
                _names[monster.Id] = monster.Name;
                monsterList.Add(monster);
            }

            for (int i = 0; i < defaultDeck.Length; i++)
            {
                if (!_cards.ContainsKey(defaultDeck[i]))
                {
                    throw new ContentException("内容 " + defaultDeck[i] + "：默认牌组引用不存在。");
                }
            }

            if (defaultMonster != null && !_monsters.ContainsKey(defaultMonster))
            {
                throw new ContentException("内容 " + defaultMonster + "：默认怪物不存在。");
            }

            for (int i = 0; i < decks.Length; i++)
            {
                ValidateId(decks[i].Id);
                Remember(decks[i].Id, decks[i].Name);
                for (int c = 0; c < decks[i].Cards.Length; c++)
                {
                    if (!_cards.ContainsKey(decks[i].Cards[c]))
                    {
                        throw new ContentException("内容 " + decks[i].Id + "：找不到卡牌 " + decks[i].Cards[c] + "。");
                    }
                }
            }

            for (int i = 0; i < cards.Length; i++)
            {
                ValidateAbilities(cards[i].Id, cards[i].Abilities);
            }

            for (int i = 0; i < backs.Length; i++)
            {
                if (backs[i].Cap < 0)
                {
                    throw new ContentException("内容 " + backs[i].Id + "：卡背数量上限不能为负。");
                }

                if (backs[i].Points < 0)
                {
                    throw new ContentException("内容 " + backs[i].Id + "：卡背点数不能为负。");
                }

                ValidateAbilities(backs[i].Id, backs[i].Abilities);
            }

            ValidateSharedAbilities();

            Cards = cardList.ToArray();
            Monsters = monsterList.ToArray();
            Abilities = CopyAbilities(abilities);
            Statuses = (StatusDefinition[])statuses.Clone();
            Resources = (ResourceDefinition[])resources.Clone();
            Keywords = (KeywordDefinition[])keywords.Clone();
            Decks = (DeckDefinition[])decks.Clone();
            Backs = (BackDefinition[])backs.Clone();
            DefaultDeck = (string[])defaultDeck.Clone();
            DefaultMonster = defaultMonster;
            MayAsk = abilities.Length > 0 || AnyCardHasAbility(cards) || AnyBackHasAbility(backs);
            Hash = ComputeHash();
        }

        public CardDefinition[] Cards { get; }
        public MonsterDefinition[] Monsters { get; }
        public AbilityDefinition[] Abilities { get; }
        public StatusDefinition[] Statuses { get; }
        public ResourceDefinition[] Resources { get; }
        public KeywordDefinition[] Keywords { get; }
        public DeckDefinition[] Decks { get; }
        public BackDefinition[] Backs { get; }
        public string[] DefaultDeck { get; }
        public string? DefaultMonster { get; }
        public bool MayAsk { get; }
        public string Hash { get; }

        // Hosts supply the YAML text. This method only parses it.
        public static ContentCatalog Parse(string yaml)
        {
            YamlNode root = YamlNode.Parse(yaml);
            if (!root.IsMap)
            {
                throw new ContentException("内容文件的根必须是映射。");
            }

            var cards = new List<CardDefinition>();
            YamlNode? cardNode = root.Get("cards");
            if (cardNode != null)
            {
                if (!cardNode.IsSequence)
                {
                    throw new ContentException("cards 必须是列表。");
                }

                for (int i = 0; i < cardNode.Items.Count; i++)
                {
                    cards.Add(ReadCard(cardNode.Items[i]));
                }
            }

            var monsters = new List<MonsterDefinition>();
            YamlNode? monstersNode = root.Get("monsters");
            if (monstersNode != null)
            {
                if (!monstersNode.IsSequence)
                {
                    throw new ContentException("monsters 必须是列表。");
                }

                for (int i = 0; i < monstersNode.Items.Count; i++)
                {
                    monsters.Add(ReadMonster(monstersNode.Items[i]));
                }
            }

            if (root.Has("monster"))
            {
                YamlNode? one = root.Get("monster");
                if (one == null || !one.IsMap)
                {
                    throw new ContentException("monster 必须是映射。");
                }

                monsters.Add(ReadMonster(one));
            }

            string[] deck = Array.Empty<string>();
            YamlNode? deckNode = root.Get("defaultDeck");
            if (deckNode == null)
            {
                deckNode = root.Get("deck");
            }

            if (deckNode != null)
            {
                deck = ReadIdList(deckNode, "deck");
            }

            string? defaultMonster = root.Str("defaultMonster");
            if (defaultMonster == null && monsters.Count == 1 && root.Has("monster"))
            {
                defaultMonster = monsters[0].Id;
            }

            return new ContentCatalog(
                cards.ToArray(),
                monsters.ToArray(),
                ReadAbilities(root.Get("abilities")).ToArray(),
                ReadStatuses(root.Get("statuses")).ToArray(),
                ReadResources(root.Get("resources")).ToArray(),
                ReadKeywords(root.Get("keywords")).ToArray(),
                ReadDecks(root.Get("decks")).ToArray(),
                ReadBacks(root.Get("backs")).ToArray(),
                deck,
                defaultMonster);
        }

        public CardDefinition RequireCard(string id)
        {
            if (_cards.TryGetValue(id, out CardDefinition? card))
            {
                return card;
            }

            throw new ContentException("内容 " + id + "：卡牌不存在。");
        }

        public MonsterDefinition RequireMonster(string id)
        {
            if (_monsters.TryGetValue(id, out MonsterDefinition? monster))
            {
                return monster;
            }

            throw new ContentException("内容 " + id + "：怪物不存在。");
        }

        public string NameOf(string id)
        {
            if (_names.TryGetValue(id, out string? name) && name.Length > 0)
            {
                return name;
            }

            return id;
        }

        public AbilityDefinition RequireAbility(string id)
        {
            if (_abilities.TryGetValue(id, out AbilityDefinition? ability))
            {
                return ability;
            }

            throw new ContentException("内容 " + id + "：能力不存在。");
        }

        public bool TryAbility(string id, out AbilityDefinition ability)
        {
            if (_abilities.TryGetValue(id, out AbilityDefinition? found) && found != null)
            {
                ability = found;
                return true;
            }

            ability = new AbilityDefinition();
            return false;
        }

        public StatusDefinition? FindStatus(string id)
        {
            if (_statuses.TryGetValue(id, out StatusDefinition? status))
            {
                return status;
            }

            return null;
        }

        public BackDefinition? FindBack(string id)
        {
            if (_backs.TryGetValue(id, out BackDefinition? back))
            {
                return back;
            }

            return null;
        }

        public bool HasResource(string id)
        {
            return _resources.ContainsKey(id);
        }

        public string TextOf(string cardId)
        {
            return CardText.Render(this, RequireCard(cardId));
        }

        private void RequireCard(string owner, string cardId)
        {
            if (!_cards.ContainsKey(cardId))
            {
                throw new ContentException("内容 " + owner + "：找不到卡牌 " + cardId + "。");
            }
        }

        private string ComputeHash()
        {
            var ids = new List<string>();
            foreach (KeyValuePair<string, CardDefinition> pair in _cards)
            {
                ids.Add(pair.Key);
            }

            ids.Sort(StringComparer.Ordinal);
            var builder = new StringBuilder();
            for (int i = 0; i < ids.Count; i++)
            {
                CardDefinition card = _cards[ids[i]];
                builder.Append("card ");
                builder.Append(card.Id);
                builder.Append(' ');
                builder.Append(card.IsSpell ? "spell" : card.Points.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(card.Load.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(card.Rarity);
                builder.Append(' ');
                builder.Append(card.School);
                builder.Append('\n');
                AppendAbilities(builder, card.Id, card.Abilities);
            }

            var monsterIds = new List<string>();
            foreach (KeyValuePair<string, MonsterDefinition> pair in _monsters)
            {
                monsterIds.Add(pair.Key);
            }

            monsterIds.Sort(StringComparer.Ordinal);
            for (int i = 0; i < monsterIds.Count; i++)
            {
                MonsterDefinition monster = _monsters[monsterIds[i]];
                builder.Append("monster ");
                builder.Append(monster.Id);
                builder.Append('\n');
                for (int s = 0; s < monster.Starting.Length; s++)
                {
                    StartingPlacement place = monster.Starting[s];
                    builder.Append("place ");
                    builder.Append(monster.Id);
                    builder.Append(' ');
                    builder.Append(place.CardId);
                    builder.Append(' ');
                    builder.Append(place.RandomCell ? "random" : place.Cell.ToString(CultureInfo.InvariantCulture));
                    builder.Append('\n');
                }

                for (int n = 0; n < monster.Intents.Length; n++)
                {
                    builder.Append("intent ");
                    builder.Append(monster.Id);
                    builder.Append(' ');
                    builder.Append(n.ToString(CultureInfo.InvariantCulture));
                    builder.Append(' ');
                    builder.Append(monster.Intents[n]);
                    builder.Append('\n');
                }

                for (int n = 0; n < monster.Skills.Length; n++)
                {
                    builder.Append("skill ");
                    builder.Append(monster.Id);
                    builder.Append(' ');
                    builder.Append(n.ToString(CultureInfo.InvariantCulture));
                    builder.Append(' ');
                    builder.Append(monster.Skills[n]);
                    builder.Append('\n');
                }

                Personality mind = monster.Personality;
                builder.Append("mind ");
                builder.Append(monster.Id);
                builder.Append(' ');
                builder.Append(monster.Information);
                builder.Append(' ');
                builder.Append(monster.IntentMode);
                builder.Append(' ');
                builder.Append(mind.Points.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(mind.Occupancy.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(mind.CoverRisk.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(mind.FullBoard.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(mind.Resource.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(mind.Intent.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(mind.Depth.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(mind.Samples.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(mind.NodeBudget.ToString(CultureInfo.InvariantCulture));
                builder.Append('\n');
            }

            var abilityIds = new List<string>();
            foreach (KeyValuePair<string, AbilityDefinition> pair in _abilities)
            {
                abilityIds.Add(pair.Key);
            }

            abilityIds.Sort(StringComparer.Ordinal);
            for (int i = 0; i < abilityIds.Count; i++)
            {
                AppendAbilities(builder, abilityIds[i], new[] { _abilities[abilityIds[i]] });
            }

            for (int i = 0; i < DefaultDeck.Length; i++)
            {
                builder.Append("deck ");
                builder.Append(i.ToString(CultureInfo.InvariantCulture));
                builder.Append(' ');
                builder.Append(DefaultDeck[i]);
                builder.Append('\n');
            }

            if (DefaultMonster != null)
            {
                builder.Append("default ");
                builder.Append(DefaultMonster);
                builder.Append('\n');
            }

            return Hashing.Sha256Hex(builder.ToString());
        }

        private static CardDefinition ReadCard(YamlNode node)
        {
            if (!node.IsMap)
            {
                throw new ContentException("卡牌必须是映射。");
            }

            string? id = node.Str("id");
            if (id == null)
            {
                throw new ContentException("卡牌缺少 id。");
            }

            string name = node.Str("name") ?? id;
            bool spell = !node.Has("points");
            int points = spell ? 0 : node.Int("points");
            int load = node.Has("load") ? node.Int("load") : 0;
            string rarity = node.Str("rarity") ?? "";
            string text = node.Str("text") ?? "";
            AbilityDefinition[] abilities = ReadAbilityList(node.Get("abilities"), id).ToArray();
            string school = node.Str("school") ?? "";
            return new CardDefinition(id, name, spell, points, load, rarity, abilities, text, school);
        }

        private static MonsterDefinition ReadMonster(YamlNode node)
        {
            if (!node.IsMap)
            {
                throw new ContentException("怪物必须是映射。");
            }

            string? id = node.Str("id");
            if (id == null)
            {
                throw new ContentException("怪物缺少 id。");
            }

            string name = node.Str("name") ?? id;
            var starting = new List<StartingPlacement>();
            YamlNode? startingNode = node.Get("starting");
            if (startingNode != null)
            {
                if (!startingNode.IsSequence)
                {
                    throw new ContentException("内容 " + id + "：starting 必须是列表。");
                }

                for (int i = 0; i < startingNode.Items.Count; i++)
                {
                    YamlNode place = startingNode.Items[i];
                    if (!place.IsMap)
                    {
                        throw new ContentException("内容 " + id + "：初始摆放必须是映射。");
                    }

                    string? card = place.Str("card");
                    string? cellText = place.Str("cell");
                    if (card == null || cellText == null)
                    {
                        throw new ContentException("内容 " + id + "：初始摆放缺少 card 或 cell。");
                    }

                    if (cellText == "random")
                    {
                        starting.Add(new StartingPlacement(card, true, 0));
                    }
                    else if (int.TryParse(cellText, NumberStyles.Integer, CultureInfo.InvariantCulture, out int cell))
                    {
                        starting.Add(new StartingPlacement(card, false, cell));
                    }
                    else
                    {
                        throw new ContentException("内容 " + id + "：格位必须是 1 到 9 或 random。");
                    }
                }
            }

            YamlNode? intentsNode = node.Get("intents");
            if (intentsNode == null)
            {
                throw new ContentException("内容 " + id + "：缺少意图。");
            }

            string[] intents = ReadIdList(intentsNode, id);
            string[] skills = Array.Empty<string>();
            YamlNode? skillsNode = node.Get("skills");
            if (skillsNode != null)
            {
                skills = ReadIdList(skillsNode, id);
            }

            Personality personality = ReadPersonality(node.Get("personality"));
            string intentMode = IntentModes.Stored(node.Str("intentMode"));
            string information = InformationLevels.Normalize(node.Str("information") ?? "");
            personality.Information = information;
            return new MonsterDefinition(id, name, starting.ToArray(), intents, skills, personality, intentMode, information);
        }

        private static Personality ReadPersonality(YamlNode? node)
        {
            var personality = new Personality();
            if (node == null)
            {
                return personality;
            }

            if (!node.IsMap)
            {
                throw new ContentException("personality 必须是映射。");
            }

            personality.Points = ReadWeight(node, "points", personality.Points);
            personality.Occupancy = ReadWeight(node, "occupancy", personality.Occupancy);
            personality.CoverRisk = ReadWeight(node, "coverRisk", personality.CoverRisk);
            personality.FullBoard = ReadWeight(node, "fullBoard", personality.FullBoard);
            personality.Resource = ReadWeight(node, "resource", personality.Resource);
            personality.Intent = ReadWeight(node, "intent", personality.Intent);
            personality.Depth = ReadWeight(node, "depth", personality.Depth);
            personality.Samples = ReadWeight(node, "samples", personality.Samples);
            personality.NodeBudget = ReadWeight(node, "nodes", personality.NodeBudget);
            return personality;
        }

        private static int ReadWeight(YamlNode node, string key, int fallback)
        {
            if (!node.Has(key))
            {
                return fallback;
            }

            return node.Int(key);
        }

        private static string[] ReadIdList(YamlNode node, string owner)
        {
            if (!node.IsSequence)
            {
                throw new ContentException("内容 " + owner + "：需要一个列表。");
            }

            var ids = new string[node.Items.Count];
            for (int i = 0; i < node.Items.Count; i++)
            {
                YamlNode item = node.Items[i];
                if (!item.IsScalar || item.Scalar == null)
                {
                    throw new ContentException("内容 " + owner + "：列表项必须是标识。");
                }

                ids[i] = item.Scalar;
            }

            return ids;
        }

        private static void ValidateId(string id)
        {
            if (id == null || id.Length < 3)
            {
                throw new ContentException("内容标识不合法。");
            }

            int dot = id.IndexOf('.');
            if (dot <= 0 || dot != id.LastIndexOf('.') || dot == id.Length - 1)
            {
                throw new ContentException("内容 " + id + "：标识必须是“类别.编号”。");
            }

            for (int i = 0; i < id.Length; i++)
            {
                char c = id[i];
                bool ok = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '.';
                if (!ok)
                {
                    throw new ContentException("内容 " + id + "：标识只能使用小写字母、数字和点。");
                }
            }
        }
    }

    internal static class Hashing
    {
        public static string Sha256Hex(string text)
        {
            using SHA256 sha = SHA256.Create();
            byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(text));
            var builder = new StringBuilder(hash.Length * 2);
            for (int i = 0; i < hash.Length; i++)
            {
                builder.Append(hash[i].ToString("x2", CultureInfo.InvariantCulture));
            }

            return builder.ToString();
        }
    }
}
