using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using Pcd.Kernel;
using Pcd.PlayHost;

[assembly: SupportedOSPlatform("browser")]

return 0;

public partial class KernelBridge
{
    [JSExport]
    public static string Invoke(string requestJson)
    {
        return KernelEntry.Invoke(requestJson);
    }

    [JSExport]
    public static string Host(string requestJson)
    {
        return SessionHost.Invoke(requestJson);
    }
}
