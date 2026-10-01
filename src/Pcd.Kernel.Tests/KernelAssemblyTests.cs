using System;
using System.IO;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using Pcd.Kernel;

namespace Pcd.Kernel.Tests
{
    public sealed class KernelAssemblyTests
    {
        [Test]
        public void Compiled_kernel_does_not_reference_unity()
        {
            AssemblyName[] references = typeof(KernelProbe).Assembly.GetReferencedAssemblies();
            string[] names = references.Select(reference => reference.Name ?? string.Empty).ToArray();

            Assert.That(names, Does.Not.Contain("UnityEngine"));
            Assert.That(names, Does.Not.Contain("UnityEditor"));
            Assert.That(names, Does.Not.Contain("UnityEngine.CoreModule"));
        }

        [Test]
        public void Package_targets_csharp9_netstandard21_without_engine_references()
        {
            string root = RepoRoot();
            string csproj = File.ReadAllText(Path.Combine(root, "src", "Pcd.Kernel", "Pcd.Kernel.csproj"));
            string packageJson = File.ReadAllText(Path.Combine(root, "src", "Pcd.Kernel", "package.json"));
            string asmdef = File.ReadAllText(Path.Combine(root, "src", "Pcd.Kernel", "Runtime", "Pcd.Kernel.asmdef"));

            Assert.That(csproj, Does.Contain("<TargetFramework>netstandard2.1</TargetFramework>"));
            Assert.That(csproj, Does.Contain("<LangVersion>9.0</LangVersion>"));
            Assert.That(packageJson, Does.Contain("\"version\": \"" + KernelVersion.Text + "\""));
            Assert.That(asmdef, Does.Contain("\"noEngineReferences\": true"));
            Assert.That(csproj, Does.Not.Contain("EmbeddedResource"));
        }

        [Test]
        public void Kernel_assembly_does_not_embed_catalog_yaml()
        {
            string[] names = typeof(ContentCatalog).Assembly.GetManifestResourceNames();

            Assert.That(names, Is.Empty);
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
