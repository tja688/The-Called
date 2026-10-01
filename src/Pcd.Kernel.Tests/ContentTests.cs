using System;
using NUnit.Framework;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class ContentTests
    {
        [Test]
        public void Blank_catalog_exposes_working_names()
        {
            ContentCatalog catalog = RepoCatalog.LoadBlank();

            Assert.That(catalog.DefaultMonster, Is.EqualTo("monster.901"));
            Assert.That(catalog.DefaultDeck.Length, Is.EqualTo(15));
            Assert.That(catalog.NameOf("card.c901"), Is.EqualTo("一点"));
            Assert.That(catalog.NameOf("monster.901"), Is.EqualTo("白板怪物"));
            Assert.That(catalog.Hash, Does.Match("^[0-9a-f]{64}$"));
        }

        [Test]
        public void Content_hash_ignores_working_names()
        {
            const string named = @"
cards:
  - id: card.c901
    name: 甲
    points: 2
monster:
  id: monster.901
  name: 甲怪
  intents:
    - card.c901
";
            const string renamed = @"
cards:
  - id: card.c901
    name: 乙
    points: 2
monster:
  id: monster.901
  name: 乙怪
  intents:
    - card.c901
";
            const string retuned = @"
cards:
  - id: card.c901
    name: 甲
    points: 3
monster:
  id: monster.901
  name: 甲怪
  intents:
    - card.c901
";

            string hash = ContentCatalog.Parse(named).Hash;

            Assert.That(ContentCatalog.Parse(renamed).Hash, Is.EqualTo(hash));
            Assert.That(ContentCatalog.Parse(retuned).Hash, Is.Not.EqualTo(hash));
        }

        [Test]
        public void Duplicate_card_id_names_the_id()
        {
            const string yaml = @"
cards:
  - id: card.a01
    points: 1
  - id: card.a01
    points: 2
monster:
  id: monster.a01
  intents:
    - card.a01
";

            var error = Assert.Throws<ContentException>(() => ContentCatalog.Parse(yaml));

            Assert.That(error!.Message, Does.Contain("card.a01"));
            Assert.That(error.Message, Does.Contain("标识重复"));
        }

        [Test]
        public void Missing_intent_card_names_the_reference()
        {
            const string yaml = @"
cards:
  - id: card.a01
    points: 1
monster:
  id: monster.a01
  intents:
    - card.missing
";

            var error = Assert.Throws<ContentException>(() => ContentCatalog.Parse(yaml));

            Assert.That(error!.Message, Does.Contain("monster.a01"));
            Assert.That(error.Message, Does.Contain("card.missing"));
        }

        [Test]
        public void Yaml_reads_nested_maps_and_inline_flow()
        {
            const string yaml = @"
board:
  - cell: 5
    modifiers:
      - source: cover
        amount: -2
intents: [card.a01, card.a02]
inline:
  - { cell: 1, card: card.a01, owner: player }
";
            YamlNode root = YamlNode.Parse(yaml);

            Assert.That(root.Get("board")!.Items[0].Get("modifiers")!.Items[0].Int("amount"), Is.EqualTo(-2));
            Assert.That(root.Get("intents")!.Items[1].Scalar, Is.EqualTo("card.a02"));
            Assert.That(root.Get("inline")!.Items[0].Str("owner"), Is.EqualTo("player"));
            Assert.That(root.Get("inline")!.Items[0].Int("cell"), Is.EqualTo(1));
        }
    }
}
