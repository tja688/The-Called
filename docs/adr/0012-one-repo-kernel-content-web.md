# 内核、内容与网页表现层放在这一个仓库

The-Called 同时承载规则内核、内容目录和网页试玩。Unity 只通过 Git 地址引用内核包和内容包，不再从旁边的 P_CD 仓库取代码或数据。网页上的对局合法性只来自这份内核；改规则或改表之后，网页和 Unity 用的是同一份源。

内核留在 `src/Pcd.Kernel`。Unity 引用：

```text
https://github.com/tja688/The-Called.git?path=/src/Pcd.Kernel#<标签>
```

内容留在 `content/`，单独成包，引用：

```text
https://github.com/tja688/The-Called.git?path=/content#<标签>
```

网页表现层是仓库里已有的三维矢量场景。开发时由本仓库的 `Pcd.DevHost` 提供 `/api`；发布到网页时把 `Pcd.Wasm` 编进页面，浏览器里跑同一份内核。局外的地图和构筑仍留在网页，进对局时只提交对局配置。

## Considered Options

- 内核继续留在 P_CD，网页用进程或子模块去连：双端要改两处仓库，数据也容易各改各的。
- 把 YAML 嵌进内核程序集：Unity 的 asmdef 编译带不走这份资源，见 ADR-0011。
- 把磷光终端一并迁过来当网页表现层：那套画面已经不用，本仓库的三维场景继续负责试玩。P_CD 的 ADR-0010 因此不在这里生效。

## Consequences

- 宿主从仓库根的 `global.json` 往上找到 `content/`，再把文本交给内核。浏览器发布包没有仓库目录，规则目录仍嵌在 `Pcd.PlayHost`，不在内核里。
- `Pcd.DevHost` 只提供对局接口，不再托管另一套网页。
- 旧的本地牌效表和 v6 规则文档不再作为规则来源。卡面文字、点数和能力以 `content/rules/catalog.yaml` 为准。
