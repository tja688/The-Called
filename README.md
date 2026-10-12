# The Called

策划试玩的网页，以及网页和 Unity 共用的规则内核与内容目录。

## 三块

| 领域 | 路径 | 谁用 |
| --- | --- | --- |
| 内核 | `src/Pcd.Kernel` | 网页宿主、浏览器内核、Unity |
| 数据 | `content/` | 同上，各端自己读 YAML 文本 |
| 网页表现层 | `src/` 中除 `Pcd.*` 外的 TypeScript | 浏览器里的二维俯视场景 |

局外的地图和构筑在网页里。进对局时只把对局配置交给内核。

当前画面采用低分辨率 Canvas 背景、像素 SVG 卡面和清晰的 DOM 界面。手牌与九宫格始终同时可见；点击和拖动都只提交内核给出的操作。表现层决定见 [ADR-0013](docs/adr/0013-pixel-2d-web-presentation.md)。

## 网页

```bash
start-game.bat
```

脚本会拉起本仓库的对局服务和 Vite。开发时浏览器通过 `/api` 访问对局服务，改 `content/rules/catalog.yaml` 后重启对局服务即可。发布到 GitHub Pages 时，工作流会把 `src/Pcd.Wasm` 编进页面，正式环境在浏览器里跑同一份内核。

## Unity

用 Git 地址加路径引用（把 `<标签>` 换成版本标签）：

```text
https://github.com/tja688/The-Called.git?path=/src/Pcd.Kernel#<标签>
https://github.com/tja688/The-Called.git?path=/content#<标签>
```

内核是 C# 9 / .NET Standard 2.1，不引用 UnityEngine。内容不要打进内核程序集。这两个包里的文件和子目录都带有 `.meta`；Unity 6 不会在 Git 包里自动生成它们。Unity 读出 YAML 文本后交给内核：

```csharp
ContentCatalog catalog = ContentCatalog.Parse(yamlText);
MatchSession session = MatchSession.Start(catalog, setup);
```

## 测试

```bash
dotnet test Pcd.slnx
npm test
```

表现层验证：

```bash
node scripts/check-2d.mjs
playwright-cli open http://localhost:4174/
playwright-cli run-code --filename=scripts/verify-2d.js
```

浏览器验证需要先启动 `start-game.bat`。脚本从主菜单经地图进入三个怪物的对局，用真实界面执行落牌、拖动、法术和目标选择，并保存实际截图到 `artifacts/visual/`。

`.NET` 与 WebAssembly 的对照：

```bash
dotnet workload install wasm-tools
node tools/compare-runtimes.mjs
```

模拟命令行：

```bash
dotnet run --project src/Pcd.Sim -- version
```
