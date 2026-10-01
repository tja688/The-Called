# 内容目录由宿主读入，内核只解析

`Pcd.Kernel` 同时被 .NET、WebAssembly 和 Unity 编译。MSBuild 的 `EmbeddedResource` 只在 SDK 工程里生效，Unity 的 asmdef 编译不会把同一项打进 DLL。若内核用 `Assembly.GetManifestResourceStream` 读取嵌进去的 YAML，.NET 与 WebAssembly 能找到内容，Unity 编出来的程序集里却没有这份资源。源码相同，编译产物不一定相同。

因此内核只提供 `ContentCatalog.Parse(string yaml)`，并接受已经解析好的内容目录。文件、TextAsset、Addressables、HTTP 或浏览器 fetch 由各端的宿主决定。共享内核程序集不嵌入内容文件，也不按文件路径加载。

## Considered Options

- 继续把 YAML 嵌进 `Pcd.Kernel`：.NET 侧方便，Unity 侧静默缺资源。
- 在内核里按路径读文件：浏览器与 Unity 的内容来源都不是这个路径。

## Consequences

- 网页预览和模拟命令行从仓库里的内容文件读文本再解析，改 YAML 不必重编译内核。
- 浏览器宿主没有仓库目录，规则目录嵌在 `Pcd.PlayHost`，不在内核里。
- 协议请求要自带 `catalog` 文本。对照脚本可以用 `catalogFile` 让两个宿主各自读文件，再把同一段文本交给内核。
