using System;
using System.IO;
using Pcd.Kernel;

namespace Pcd.HostCatalog
{
    public static class RepoCatalog
    {
        public static ContentCatalog LoadBlank()
        {
            return ContentCatalog.Parse(Read("content/blank/catalog.yaml"));
        }

        public static ContentCatalog LoadRules()
        {
            return ContentCatalog.Parse(Read("content/rules/catalog.yaml"));
        }

        public static string Read(string relative)
        {
            if (!TryRead(relative, out string? text) || text == null)
            {
                throw new ContentException("找不到内容文件：" + relative);
            }

            return text;
        }

        public static bool TryRead(string relative, out string? text)
        {
            text = null;
            try
            {
                string? root = TryRoot();
                if (root == null)
                {
                    return false;
                }

                string path = Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(path))
                {
                    return false;
                }

                text = File.ReadAllText(path);
                return true;
            }
            catch (Exception error) when (error is IOException
                || error is UnauthorizedAccessException
                || error is NotSupportedException
                || error is ArgumentException)
            {
                return false;
            }
        }

        private static string? TryRoot()
        {
            string start = AppContext.BaseDirectory;
            if (start.Length == 0)
            {
                return null;
            }

            DirectoryInfo? dir = new DirectoryInfo(start);
            while (dir != null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "global.json")))
                {
                    return dir.FullName;
                }

                dir = dir.Parent;
            }

            return null;
        }
    }
}
