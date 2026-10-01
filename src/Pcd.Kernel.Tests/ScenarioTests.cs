using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class ScenarioTests
    {
        public static IEnumerable<TestCaseData> Files()
        {
            string rules = Path.Combine(RepoRoot(), "scenarios", "rules");
            foreach (string file in Directory.GetFiles(rules, "*.yaml").OrderBy(path => path))
            {
                yield return new TestCaseData(file).SetName(Path.GetFileNameWithoutExtension(file));
            }
        }

        [TestCaseSource(nameof(Files))]
        public void Rules_scenario(string file)
        {
            ScenarioRunner.Run(file);
        }

        public static IEnumerable<TestCaseData> CardFiles()
        {
            string cards = Path.Combine(RepoRoot(), "scenarios", "cards");
            if (!Directory.Exists(cards))
            {
                yield break;
            }

            foreach (string file in Directory.GetFiles(cards, "*.yaml").OrderBy(path => path))
            {
                yield return new TestCaseData(file).SetName(Path.GetFileNameWithoutExtension(file));
            }
        }

        [TestCaseSource(nameof(CardFiles))]
        public void Content_scenario(string file)
        {
            ScenarioRunner.Run(file);
        }

        [Test]
        public void Every_collectible_card_has_a_content_scenario()
        {
            ContentCatalog catalog = RepoCatalog.LoadRules();
            string all = "";
            foreach (string file in Directory.GetFiles(Path.Combine(RepoRoot(), "scenarios", "cards"), "*.yaml"))
            {
                all += File.ReadAllText(file);
            }

            for (int i = 0; i < catalog.Cards.Length; i++)
            {
                if (catalog.Cards[i].Rarity.Length == 0)
                {
                    continue;
                }

                Assert.That(catalog.Cards[i].School.Length, Is.GreaterThan(0), catalog.Cards[i].Name);
                Assert.That(all, Does.Contain(catalog.Cards[i].Id), catalog.Cards[i].Name);
            }

            for (int i = 0; i < catalog.Backs.Length; i++)
            {
                Assert.That(all, Does.Contain(catalog.Backs[i].Id), catalog.Backs[i].Name);
            }
        }

        private static string RepoRoot()
        {
            DirectoryInfo? dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "global.json")))
                {
                    return dir.FullName;
                }

                dir = dir.Parent;
            }

            throw new DirectoryNotFoundException("Could not find global.json above the test output.");
        }
    }
}
