using System;
using System.Text;
using System.Text.Json.Nodes;
using Pcd.HostCatalog;
using Pcd.Kernel;

namespace Pcd.ProbeHost
{
    public static class Program
    {
        public static int Main(string[] args)
        {
            Console.OutputEncoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
            if (args.Length != 1)
            {
                Console.Error.Write("用法：Pcd.ProbeHost <request-json>\n");
                return 1;
            }

            Console.Out.Write(KernelEntry.Invoke(ExpandCatalog(args[0])));
            Console.Out.Write('\n');
            return 0;
        }

        private static string ExpandCatalog(string request)
        {
            if (request.IndexOf("\"catalogFile\"", StringComparison.Ordinal) < 0)
            {
                return request;
            }

            JsonNode? node = JsonNode.Parse(request);
            if (node is not JsonObject obj)
            {
                return request;
            }

            JsonNode? file = obj["catalogFile"];
            if (file == null)
            {
                return request;
            }

            string relative = file.GetValue<string>();
            obj.Remove("catalogFile");
            obj["catalog"] = RepoCatalog.Read(relative);
            return obj.ToJsonString();
        }
    }
}
