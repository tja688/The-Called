using System;

namespace Pcd.Kernel
{
    public static class KernelEntry
    {
        public static string Invoke(string requestJson)
        {
            if (requestJson == null)
            {
                throw new ArgumentNullException(nameof(requestJson));
            }

            if (requestJson.IndexOf("\"command\"", StringComparison.Ordinal) >= 0)
            {
                return MatchProtocol.Invoke(requestJson);
            }

            return KernelProbe.Invoke(requestJson);
        }
    }
}
