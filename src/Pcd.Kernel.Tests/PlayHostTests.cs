using System.Linq;
using System.Text.Json;
using NUnit.Framework;
using Pcd.PlayHost;

namespace Pcd.Kernel.Tests
{
    public sealed class PlayHostTests
    {
        [Test]
        public void Catalog_lists_rules_content()
        {
            using JsonDocument doc = Open(SessionHost.Invoke("{\"op\":\"catalog\"}"));
            JsonElement data = doc.RootElement.GetProperty("data");
            Assert.That(data.GetProperty("monsters").GetArrayLength(), Is.EqualTo(3));
            Assert.That(data.GetProperty("cards").GetArrayLength(), Is.GreaterThan(0));
            Assert.That(data.GetProperty("decks").GetArrayLength(), Is.GreaterThan(0));
            Assert.That(data.GetProperty("contentHash").GetString(), Is.Not.Empty);
        }

        [Test]
        public void Start_and_answer_keep_a_nine_cell_view()
        {
            using JsonDocument catalog = Open(SessionHost.Invoke("{\"op\":\"catalog\"}"));
            JsonElement deck = catalog.RootElement.GetProperty("data").GetProperty("decks")[0];
            string body = "{\"op\":\"start\",\"monsterId\":\"monster.001\",\"seed\":4,\"buildDeck\":"
                + deck.GetProperty("cards").GetRawText() + "}";
            using JsonDocument started = Open(SessionHost.Invoke(body));
            JsonElement data = started.RootElement.GetProperty("data");
            Assert.That(data.GetProperty("view").GetProperty("cells").GetArrayLength(), Is.EqualTo(9));
            Assert.That(data.GetProperty("view").GetProperty("cells")[0].TryGetProperty("polluted", out _), Is.True);
            Assert.That(data.GetProperty("snapshot").GetString(), Is.Not.Empty);
            Assert.That(data.GetProperty("steps").GetArrayLength(), Is.GreaterThan(0));

            JsonElement pending = data.GetProperty("pending");
            if (pending.ValueKind == JsonValueKind.Null || pending.GetProperty("actor").GetString() != "player")
            {
                return;
            }

            string option = pending.GetProperty("options")[0].GetProperty("id").GetString()!;
            string answer = "{\"op\":\"answer\",\"option\":" + JsonSerializer.Serialize(option)
                + ",\"snapshot\":" + JsonSerializer.Serialize(data.GetProperty("snapshot").GetString()) + "}";
            using JsonDocument next = Open(SessionHost.Invoke(answer));
            Assert.That(next.RootElement.GetProperty("data").GetProperty("view").GetProperty("cells").GetArrayLength(), Is.EqualTo(9));
        }

        [Test]
        public void Validate_rejects_a_short_deck()
        {
            using JsonDocument doc = JsonDocument.Parse(SessionHost.Invoke("{\"op\":\"validate\",\"cards\":[\"card.missing\"],\"backs\":[\"\"]}"));
            Assert.That(doc.RootElement.GetProperty("ok").GetBoolean(), Is.True);
            Assert.That(doc.RootElement.GetProperty("data").GetProperty("ok").GetBoolean(), Is.False);
        }

        [Test]
        public void Web_host_embeds_the_rules_catalog_outside_the_kernel()
        {
            string[] names = typeof(SessionHost).Assembly.GetManifestResourceNames();

            Assert.That(names, Does.Contain("Pcd.PlayHost.RulesCatalog.yaml"));
            Assert.That(names.Any(name => name.StartsWith("Pcd.Kernel.")), Is.False);
        }

        private static JsonDocument Open(string json)
        {
            using JsonDocument probe = JsonDocument.Parse(json);
            Assert.That(probe.RootElement.GetProperty("ok").GetBoolean(), Is.True, json);
            return JsonDocument.Parse(json);
        }
    }
}
