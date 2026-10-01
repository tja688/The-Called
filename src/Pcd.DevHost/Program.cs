using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Pcd.HostCatalog;
using Pcd.Kernel;

var builder = WebApplication.CreateBuilder(args);
if (string.IsNullOrEmpty(builder.Configuration["urls"]))
{
    builder.WebHost.UseSetting("urls", "http://127.0.0.1:5180");
}
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});
var app = builder.Build();
var catalog = RepoCatalog.LoadRules();
app.MapGet("/api/catalog", () => new
{
    contentHash = catalog.Hash,
    cards = catalog.Cards.Select(c => new
    {
        c.Id, c.Name, c.IsSpell, c.Points, c.Load, c.Rarity, c.School,
        text = CardText.Render(catalog, c)
    }),
    backs = catalog.Backs.Select(b => new
    {
        b.Id, b.Name, b.Load, b.Points, b.Cap, isBack = true, text = CardText.RenderBack(catalog, b)
    }),
    monsters = catalog.Monsters.Select(m => new { m.Id, m.Name, m.Starting, m.Intents, m.Skills }),
    decks = catalog.Decks.Select(d => new
    {
        d.Id, d.Name, d.Cards, load = DeckRules.TotalLoad(catalog, d.Cards, null)
    }),
    statuses = catalog.Statuses.Select(s => new { s.Id, s.Name }),
    resources = catalog.Resources.Select(r => new { r.Id, r.Name })
});
app.MapPost("/api/start", (StartRequest request) => Execute(() =>
{
    string monsterId = request.MonsterId ?? catalog.DefaultMonster ?? "";
    catalog.RequireMonster(monsterId);
    string[] deck = request.BuildDeck ?? catalog.Decks.FirstOrDefault(d => d.Id == request.DeckId)?.Cards
        ?? throw new ArgumentException("请选择现有牌组。");
    string[]? backs = request.BuildBacks;
    string[] issues = DeckRules.Validate(catalog, deck, backs);
    if (issues.Length > 0) throw new ArgumentException(string.Join(" ", issues));
    var session = MatchSession.Start(catalog, new MatchSetup
    {
        Seed = request.Seed, MonsterId = monsterId, BuildDeck = deck, BuildBacks = backs
    });
    return Advance(session, session.Advance(), monsterId, request.Seed);
}));
app.MapPost("/api/deck/validate", (DeckValidateRequest request) => Execute(() =>
{
    string[] cards = request.Cards ?? Array.Empty<string>();
    string[] issues = DeckRules.Validate(catalog, cards, request.Backs);
    return new
    {
        ok = issues.Length == 0,
        issues,
        load = DeckRules.TotalLoad(catalog, cards, request.Backs)
    };
}));
app.MapPost("/api/answer", (AnswerRequest request) => Execute(() =>
{
    if (string.IsNullOrEmpty(request.Snapshot) || string.IsNullOrEmpty(request.Option))
        throw new ArgumentException("对局快照和合法选项不能为空。");
    var session = MatchSession.FromSnapshot(request.Snapshot, catalog);
    var pending = session.Advance().Pending;
    if (pending == null || pending.Actor != "player") throw new ArgumentException("现在不是玩家待决策。");
    using var snapshot = JsonDocument.Parse(request.Snapshot);
    var root = snapshot.RootElement;
    var setup = root.GetProperty("setup");
    return Advance(session, session.SubmitAndAdvance(request.Option), root.GetProperty("monster").GetString()!, setup.GetProperty("seed").GetUInt64());
}));
app.MapPost("/api/trace", async (HttpRequest request) =>
{
    try
    {
        using var reader = new StreamReader(request.Body);
        string body = await reader.ReadToEndAsync();
        if (string.IsNullOrWhiteSpace(body))
            return Results.BadRequest(new { error = "没有可写入的对局记录。" });
        using var document = JsonDocument.Parse(body);
        string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (string.IsNullOrEmpty(desktop))
            return Results.BadRequest(new { error = "找不到桌面目录。" });
        string name = "the-call-" + DateTime.Now.ToString("yyyyMMdd-HHmmss-fff") + ".json";
        string path = Path.Combine(desktop, name);
        await using var stream = new FileStream(path, FileMode.CreateNew);
        await using var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = true });
        document.WriteTo(writer);
        await writer.FlushAsync();
        return Results.Ok(new { file = path });
    }
    catch (JsonException)
    {
        return Results.BadRequest(new { error = "对局记录不是合法的 JSON。" });
    }
    catch (Exception error)
    {
        return Results.BadRequest(new { error = error.Message });
    }
});
app.Run();

IResult Execute(Func<object> action)
{
    try { return Results.Ok(action()); }
    catch (Exception error)
    {
        app.Logger.LogError(error, "对局请求失败");
        return Results.BadRequest(new { error = error.GetType().Name + ": " + error.Message });
    }
}

object Advance(MatchSession session, AdvanceResult advance, string monsterId, ulong seed)
{
    var steps = new List<object>();
    var events = new List<GameEvent>();
    var monster = catalog.RequireMonster(monsterId);
    while (true)
    {
        steps.Add(new { view = session.View("player"), advance.Pending, advance.Result, advance.Events });
        events.AddRange(advance.Events);
        if (advance.Pending == null || advance.Pending.Actor != "monster") break;
        var choice = MonsterAi.Choose(session, advance.Pending, monster.Personality,
            DecisionSeed.Mix(seed, session.View("public").Round, advance.Pending.Id));
        advance = session.SubmitAndAdvance(choice.Choice);
    }
    return new
    {
        view = session.View("player"), advance.Pending, advance.Result, events,
        snapshot = session.ToSnapshot(), replay = session.ToReplay(), hash = session.EventHash(), steps
    };
}

internal sealed record StartRequest(string? MonsterId, string? DeckId, string[]? BuildDeck, string[]? BuildBacks, ulong Seed = 1);
internal sealed record DeckValidateRequest(string[]? Cards, string[]? Backs);
internal sealed record AnswerRequest(string Snapshot, string Option);
