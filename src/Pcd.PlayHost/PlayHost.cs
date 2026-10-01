using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using Pcd.Kernel;

namespace Pcd.PlayHost
{
    public static class SessionHost
    {
        // Browser builds have no repo checkout. This web host embeds the rules
        // catalog. The kernel assembly must not: Unity asmdef ignores MSBuild
        // EmbeddedResource items.
        private static readonly ContentCatalog Catalog = LoadEmbeddedRules();

        private static ContentCatalog LoadEmbeddedRules()
        {
            using Stream? stream = typeof(SessionHost).Assembly.GetManifestResourceStream("Pcd.PlayHost.RulesCatalog.yaml");
            if (stream == null)
            {
                throw new ContentException("浏览器宿主没有规则内容。把 content/rules/catalog.yaml 作为本程序集的嵌入资源，不要放进内核。");
            }

            using var reader = new StreamReader(stream, Encoding.UTF8);
            return ContentCatalog.Parse(reader.ReadToEnd());
        }

        public static string Invoke(string requestJson)
        {
            if (requestJson == null)
            {
                throw new ArgumentNullException(nameof(requestJson));
            }

            try
            {
                HostRequest? request = JsonSerializer.Deserialize(requestJson, HostReadContext.Default.HostRequest);
                if (request == null || request.Op.Length == 0)
                {
                    return Fail("请求缺少操作。");
                }

                switch (request.Op)
                {
                    case "catalog":
                        return Ok(CatalogPayload(), HostJsonContext.Default.CatalogDto);
                    case "start":
                        return Ok(Start(request), HostJsonContext.Default.AdvanceDto);
                    case "answer":
                        return Ok(Answer(request), HostJsonContext.Default.AdvanceDto);
                    case "validate":
                        return Ok(Validate(request), HostJsonContext.Default.DeckReportDto);
                    default:
                        return Fail("未知操作：" + request.Op);
                }
            }
            catch (Exception error)
            {
                return Fail(error.GetType().Name + ": " + error.Message);
            }
        }

        private static CatalogDto CatalogPayload()
        {
            var cards = new CardDto[Catalog.Cards.Length];
            for (int i = 0; i < Catalog.Cards.Length; i++)
            {
                CardDefinition card = Catalog.Cards[i];
                cards[i] = new CardDto
                {
                    Id = card.Id,
                    Name = card.Name,
                    IsSpell = card.IsSpell,
                    Points = card.Points,
                    Load = card.Load,
                    Rarity = card.Rarity,
                    School = card.School,
                    Text = CardText.Render(Catalog, card)
                };
            }

            var backs = new BackDto[Catalog.Backs.Length];
            for (int i = 0; i < Catalog.Backs.Length; i++)
            {
                BackDefinition back = Catalog.Backs[i];
                backs[i] = new BackDto
                {
                    Id = back.Id,
                    Name = back.Name,
                    Load = back.Load,
                    Points = back.Points,
                    Cap = back.Cap,
                    IsBack = true,
                    Text = CardText.RenderBack(Catalog, back)
                };
            }

            var monsters = new MonsterDto[Catalog.Monsters.Length];
            for (int i = 0; i < Catalog.Monsters.Length; i++)
            {
                MonsterDefinition monster = Catalog.Monsters[i];
                var starting = new StartingDto[monster.Starting.Length];
                for (int s = 0; s < monster.Starting.Length; s++)
                {
                    StartingPlacement place = monster.Starting[s];
                    starting[s] = new StartingDto
                    {
                        CardId = place.CardId,
                        RandomCell = place.RandomCell,
                        Cell = place.Cell
                    };
                }

                monsters[i] = new MonsterDto
                {
                    Id = monster.Id,
                    Name = monster.Name,
                    Starting = starting,
                    Intents = monster.Intents,
                    Skills = monster.Skills
                };
            }

            var decks = new DeckDto[Catalog.Decks.Length];
            for (int i = 0; i < Catalog.Decks.Length; i++)
            {
                DeckDefinition deck = Catalog.Decks[i];
                decks[i] = new DeckDto
                {
                    Id = deck.Id,
                    Name = deck.Name,
                    Cards = deck.Cards,
                    Load = DeckRules.TotalLoad(Catalog, deck.Cards, null)
                };
            }

            var statuses = new NameDto[Catalog.Statuses.Length];
            for (int i = 0; i < Catalog.Statuses.Length; i++)
            {
                statuses[i] = new NameDto { Id = Catalog.Statuses[i].Id, Name = Catalog.Statuses[i].Name };
            }

            var resources = new NameDto[Catalog.Resources.Length];
            for (int i = 0; i < Catalog.Resources.Length; i++)
            {
                resources[i] = new NameDto { Id = Catalog.Resources[i].Id, Name = Catalog.Resources[i].Name };
            }

            return new CatalogDto
            {
                ContentHash = Catalog.Hash,
                Cards = cards,
                Backs = backs,
                Monsters = monsters,
                Decks = decks,
                Statuses = statuses,
                Resources = resources
            };
        }

        private static AdvanceDto Start(HostRequest request)
        {
            string monsterId = request.MonsterId ?? Catalog.DefaultMonster ?? "";
            Catalog.RequireMonster(monsterId);
            string[]? deck = request.BuildDeck;
            if (deck == null && request.DeckId != null)
            {
                for (int i = 0; i < Catalog.Decks.Length; i++)
                {
                    if (Catalog.Decks[i].Id == request.DeckId)
                    {
                        deck = Catalog.Decks[i].Cards;
                        break;
                    }
                }
            }

            if (deck == null)
            {
                throw new ArgumentException("请选择现有牌组。");
            }

            string[]? backs = request.BuildBacks;
            string[] issues = DeckRules.Validate(Catalog, deck, backs);
            if (issues.Length > 0)
            {
                throw new ArgumentException(string.Join(" ", issues));
            }

            MatchSession session = MatchSession.Start(Catalog, new MatchSetup
            {
                Seed = request.Seed,
                MonsterId = monsterId,
                BuildDeck = deck,
                BuildBacks = backs
            });
            return Advance(session, session.Advance(), monsterId, request.Seed);
        }

        private static DeckReportDto Validate(HostRequest request)
        {
            string[] cards = request.Cards ?? Array.Empty<string>();
            string[] issues = DeckRules.Validate(Catalog, cards, request.Backs);
            return new DeckReportDto
            {
                Ok = issues.Length == 0,
                Issues = issues,
                Load = DeckRules.TotalLoad(Catalog, cards, request.Backs)
            };
        }

        private static AdvanceDto Answer(HostRequest request)
        {
            if (string.IsNullOrEmpty(request.Snapshot) || string.IsNullOrEmpty(request.Option))
            {
                throw new ArgumentException("对局快照和合法选项不能为空。");
            }

            MatchSession session = MatchSession.FromSnapshot(request.Snapshot, Catalog);
            AdvanceResult pending = session.Advance();
            if (pending.Pending == null || pending.Pending.Actor != "player")
            {
                throw new ArgumentException("现在不是玩家的回合。");
            }

            using JsonDocument snapshot = JsonDocument.Parse(request.Snapshot);
            JsonElement root = snapshot.RootElement;
            JsonElement setup = root.GetProperty("setup");
            string? monsterId = root.GetProperty("monster").GetString();
            if (string.IsNullOrEmpty(monsterId))
            {
                throw new ArgumentException("快照里没有怪物。");
            }

            return Advance(session, session.SubmitAndAdvance(request.Option), monsterId, setup.GetProperty("seed").GetUInt64());
        }

        private static AdvanceDto Advance(MatchSession session, AdvanceResult advance, string monsterId, ulong seed)
        {
            var steps = new List<StepDto>();
            var events = new List<GameEvent>();
            MonsterDefinition monster = Catalog.RequireMonster(monsterId);
            while (true)
            {
                steps.Add(new StepDto
                {
                    View = session.View("player"),
                    Pending = advance.Pending,
                    Result = advance.Result,
                    Events = advance.Events
                });
                events.AddRange(advance.Events);
                if (advance.Pending == null || advance.Pending.Actor != "monster")
                {
                    break;
                }

                AiReport choice = MonsterAi.Choose(
                    session,
                    advance.Pending,
                    monster.Personality,
                    DecisionSeed.Mix(seed, session.View("public").Round, advance.Pending.Id));
                advance = session.SubmitAndAdvance(choice.Choice);
            }

            return new AdvanceDto
            {
                View = session.View("player"),
                Pending = advance.Pending,
                Result = advance.Result,
                Events = events.ToArray(),
                Snapshot = session.ToSnapshot(),
                Replay = session.ToReplay(),
                Hash = session.EventHash(),
                Steps = steps.ToArray()
            };
        }

        private static string Ok<T>(T value, JsonTypeInfo<T> type)
        {
            return "{\"ok\":true,\"data\":" + JsonSerializer.Serialize(value, type) + "}";
        }

        private static string Fail(string error)
        {
            return JsonSerializer.Serialize(new ErrorEnvelope { Ok = false, Error = error }, HostJsonContext.Default.ErrorEnvelope);
        }
    }

    public sealed class HostRequest
    {
        public string Op { get; set; } = "";
        public string? MonsterId { get; set; }
        public string? DeckId { get; set; }
        public string[]? BuildDeck { get; set; }
        public string[]? BuildBacks { get; set; }
        public ulong Seed { get; set; } = 1;
        public string? Snapshot { get; set; }
        public string? Option { get; set; }
        public string[]? Cards { get; set; }
        public string[]? Backs { get; set; }
    }

    public sealed class ErrorEnvelope
    {
        public bool Ok { get; set; }
        public string? Error { get; set; }
    }

    public sealed class CatalogDto
    {
        public string ContentHash { get; set; } = "";
        public CardDto[] Cards { get; set; } = Array.Empty<CardDto>();
        public BackDto[] Backs { get; set; } = Array.Empty<BackDto>();
        public MonsterDto[] Monsters { get; set; } = Array.Empty<MonsterDto>();
        public DeckDto[] Decks { get; set; } = Array.Empty<DeckDto>();
        public NameDto[] Statuses { get; set; } = Array.Empty<NameDto>();
        public NameDto[] Resources { get; set; } = Array.Empty<NameDto>();
    }

    public sealed class CardDto
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public bool IsSpell { get; set; }
        public int Points { get; set; }
        public int Load { get; set; }
        public string Rarity { get; set; } = "";
        public string School { get; set; } = "";
        public string Text { get; set; } = "";
    }

    public sealed class BackDto
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public int Load { get; set; }
        public int Points { get; set; }
        public int Cap { get; set; }
        public bool IsBack { get; set; }
        public string Text { get; set; } = "";
    }

    public sealed class StartingDto
    {
        public string CardId { get; set; } = "";
        public bool RandomCell { get; set; }
        public int Cell { get; set; }
    }

    public sealed class MonsterDto
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public StartingDto[] Starting { get; set; } = Array.Empty<StartingDto>();
        public string[]? Intents { get; set; }
        public string[]? Skills { get; set; }
    }

    public sealed class DeckDto
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string[] Cards { get; set; } = Array.Empty<string>();
        public int Load { get; set; }
    }

    public sealed class NameDto
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
    }

    public sealed class DeckReportDto
    {
        public bool Ok { get; set; }
        public string[] Issues { get; set; } = Array.Empty<string>();
        public int Load { get; set; }
    }

    public sealed class StepDto
    {
        public MatchView View { get; set; } = new MatchView();
        public Decision? Pending { get; set; }
        public MatchResult? Result { get; set; }
        public GameEvent[] Events { get; set; } = Array.Empty<GameEvent>();
    }

    public sealed class AdvanceDto
    {
        public MatchView View { get; set; } = new MatchView();
        public Decision? Pending { get; set; }
        public MatchResult? Result { get; set; }
        public GameEvent[] Events { get; set; } = Array.Empty<GameEvent>();
        public string Snapshot { get; set; } = "";
        public string Replay { get; set; } = "";
        public string Hash { get; set; } = "";
        public StepDto[] Steps { get; set; } = Array.Empty<StepDto>();
    }

    [JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
    [JsonSerializable(typeof(HostRequest))]
    internal partial class HostReadContext : JsonSerializerContext
    {
    }

    [JsonSourceGenerationOptions(
        GenerationMode = JsonSourceGenerationMode.Serialization,
        PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
    [JsonSerializable(typeof(ErrorEnvelope))]
    [JsonSerializable(typeof(CatalogDto))]
    [JsonSerializable(typeof(DeckReportDto))]
    [JsonSerializable(typeof(AdvanceDto))]
    internal partial class HostJsonContext : JsonSerializerContext
    {
    }
}
