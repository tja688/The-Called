# The Called

第四版战斗原型。规则核走 `GameService`，默认像素表现；`?present=dom` 是规则白模。

## 运行

```bash
npm install
npm run dev
```

浏览器打开本地地址。控制台 `called.game.dispatch` / `ask`。空格快进演出。

```bash
npm test
npm run sprites:lint
npm run sim -- --seed 1
npm run sim -- --compare
```

开发时打开 `/pixels.html` 看资产与编辑页。

```bash
npm run pack
```

桌面包默认落到 `Documents/The-Called-Play/`：双击 `win-unpacked/The Called.exe`，或发旁边的 zip。F11 全屏。输出目录可用 `CALLED_PACK_OUT` 改。

## 结构

```text
docs/                 设计案（从 索引.md 读）
docs/6-开发交接/      表现层接缝
src/core              命令 / 查询 / 事件总线
src/domain            战斗与一趟
src/content           卡表、遭遇、锚点
src/application       GameService 与读模型类型
src/shell             HTML 白模（规则验收器）
src/pixel             像素引擎（不知道游戏）
src/present           场景：只消费事件
src/audio             短音效
src/tools/sim.ts      无头四节点
```

表现层只消费 `GameService`，见 [docs/6-开发交接/表现层接缝.md](docs/6-开发交接/表现层接缝.md)。
