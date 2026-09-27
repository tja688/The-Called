# 第 5 版原型架构地图

只读勘察。当前分支 `the_called5`。本仓库没有 Unity 工程，也没有 Luban / ScriptableObject / JSON 内容管线。

根目录没有 `CONTEXT.md`，没有 `docs/adr/`。技能 `table-nine-effect-landing` 描述的是另一套 Unity + Luban + `TableNineContentCatalog.cs` 落地流程，**本仓库不存在这些目录，不要照那套改文件**。

## 1. 项目形态与启动方式

网页卡牌原型：React 19 + TypeScript 5.8 + Vite 7 + React Three Fiber + Zustand。包名 `strix-tabletop`。CI（`.github/workflows/pages.yml`）用 Node 22 执行 `npm ci` 与 `npm run build`，部署 GitHub Pages。

没有 Unity 版本、没有 `.asmdef`、没有 `.unity` 场景、没有 C#。卡牌、关卡、规则都是 `src/config/*.ts` 里的常量。`public/` 与 `doc/` 目前是空目录；代码仍引用 `/card/*.png` 与 `/Audio/**`，牌面实际由 `Card3D` 用 Canvas 画出来。

本机启动：双击 `start-game.bat`，或 `npm run dev`。默认 `http://localhost:4174/`（占用则顺延）。本回合 `user-unity` MCP 命名空间不可用，没有连编辑器。

进入一局：主菜单「开始游戏」→ `navigationStore.openMap` → 地图页牌组满 12 张且是当前关 → `startLevel` → `App` 渲染 `LevelPage` → `gameStore.initialize` → `createMatch`。

没有独立的回合状态机类。阶段是 `MatchState` 上的 `status` / `turn` / `finalBattle` / `openingTurn`，由 `LevelPage` 的 effect 驱动 `gameStore`。

## 2. 目录地图

| 区域 | 路径 | 职责 |
|---|---|---|
| 入口 | `index.html`，`src/main.tsx`，`src/app/App.tsx` | 加载后按 `screen` 切页 |
| 页面 | `src/pages/HomePage.tsx`，`MapPage.tsx`，`LevelPage.tsx`，`PausePage.tsx` | 菜单、线性地图、对局、暂停 |
| 规则核 | `src/game/types.ts`，`src/game/core/matchEngine.ts`，`spatial.ts`，`commands.ts` | 纯函数对局 |
| 内容 | `src/config/cardCatalog.ts`，`decks.ts`，`deckLoadout.ts`，`matchRules.ts`，`gameContent.ts`，`monsterStrategies.ts` | 硬编码卡、牌组、规则、三关三怪 |
| 对局店 | `src/stores/gameStore.ts` | 创建对局、出牌、怪物回合、预告牌 |
| 流程店 | `navigationStore.ts`，`campaignStore.ts`，`deckStore.ts` | 屏幕、通关下标、牌库/出战位 |
| 表现店 | `interactionStore.ts`，`presentationStore.ts` | 镜头、选牌、输入锁、动画速度 |
| 画面 | `src/scene/**` | R3F：桌面、九宫格、手牌、飞牌、地图 |
| DOM UI | `src/ui/**`，`src/styles/**` | 血条位实际是点数条、奖励、牌组构筑、暂停 |
| AI | `src/game/ai/**` | 后置。见第 4 节 |
| 测试 | `src/**/*.test.ts`（18 个） | Vitest，无 EditMode/PlayMode 之分 |
| 音频 | `src/audio/gameAudio.ts` | DOM Audio，资源路径指向空的 `public` |

画面栈：React DOM 叠层（主菜单、地图、HUD）+ 一块 `@react-three/fiber` Canvas。不是 UI Toolkit，不是 uGUI。

## 3. 运行时骨架

屏幕：`home | map | level | pause`（`src/stores/navigationStore.ts`）。

`HomePage` 点开始 → `openMap`。`MapPage` + `LevelPath` 点当前关，且 `canEnterBattle()`（`deckStore`，12 格全满）→ `startLevel`。只允许 `campaignStore.cleared` 指向的那一关。

`LevelPage`（`src/pages/LevelPage.tsx`）挂上后：

1. `useGameStore.initialize(levelId, monsterId)`
2. `getBattleDeck()` + `monsterDeckForLevel(levelId)` → `createMatch`（`src/game/core/matchEngine.ts`）
3. 洗牌、各抽 `openingHandSize`（5）、`turn = player`、`createBoard()` 九格

玩家出牌（点选，不是拖拽）：

1. `Hand3D` 点击手牌 → `interactionStore.beginCardPlacement`（镜头切 `overview`）
2. `Cell` 点击格子 → `gameStore.play({ side:'player', cardInstanceId, cellId })`
3. `playCard`：校验回合 / 手牌 / `canPlaceCard` → 克隆状态 → 手牌移除 → 盖牌进 `coveredCards` → `resolveEntryEffect` → 用被盖牌的 Power 扣顶牌 → `removeSpentCards`（Power ≤ 0 进 `graveyard`）→ `advanceTurn`（对方抽 1，手牌已满且规则为 `skip` 则不抽走）
4. 九格刚满：`finalBattle = true` 且 `openingTurn = true`
5. 有覆盖或离场：`presentationStore.inputLocked = true`，`Board` 的 `ResolutionClock` 等动画后 `finishResolution`

怪物回合（`LevelPage` 看到 `turn === 'monster'`）：

1. `prepareMonsterTurn` → `search.ts` 给已亮出的牌选格，写入 `telegraph.cellId`
2. `MonsterTelegraphCard` 飞到格子后调用 `playMonsterTurn` → 再次 `playCard`
3. 选不出合法格：`passTurn` + `resolveIdleTurn`（双方都不能打也不能再抽则按点数、占格、`tieResult` 结束）

终局：`openingTurn` 时 1 秒后 `resolveFinalBattleTurn`。回合方场上点数更高则胜；否则有合法覆盖就放行出牌；否则把回合让给对方；双方都不能动则 `winnerByExhaustion`。

规则常量：`beginnerMatchRules`（`src/config/matchRules.ts`）。3×3，手牌上限 5，先手玩家，首回合不补抽，Power 下限 0，必须严格大于才能覆盖，满盘进终局，平局结果 `draw`（终局文案写怪物胜，和 `tieResult: 'draw'` 不一致，以代码为准）。

没有费用。唯一数值是 Power。没有玩家弃牌堆操作；`graveyard` 只收被扣到 0 离场的牌（含压在下面的）。牌堆打完不洗回。

## 4. 可复用 vs 必须推倒

### 可复用（画面、操作、页面流）

- 页面流与转场：`App.tsx`，`navigationStore.ts`，`SceneTransition.tsx`，`PausePage.tsx`
- 点选手牌、滚轮/Tab 俯视、点格落子：`Hand3D.tsx`，`interactionStore.ts`，`CameraRig.tsx`，`cameraMotion.ts`，`Cell.tsx` 的点击与高亮
- 牌面绘制、翻面、飞入、覆盖点数滚动、离场淡出：`Card3D.tsx`，`MonsterTelegraphCard.tsx`，`monsterCardHandoff.ts`，`resolutionBeat.ts`，`landingEase.ts`，`presentationStore.ts`
- DOM HUD 壳、暂停、音量、结算弹层节奏：`HUD.tsx`，`PlaybackControls.tsx`，`gameAudio.ts`，`LoadingScreen.tsx`
- 桌面舞台、开场 staggered 格子：`TableScene.tsx`，`stageIntro.ts`，`Board.tsx` 的入场动画

这些文件通过 store 读 `MatchState`。规则换成别的棋盘时，镜头和点选手势还能留，格子数量和牌面字段不能假装不用改。

没有血条。HUD 两侧数字是 `getBoardPower` 的场上 Power 合计。

### 必须按新设计推倒

- **全部旧卡与效果。** 31 张定义在 `src/config/cardCatalog.ts`。效果是闭集联合类型 `CardEffect`（`src/game/types.ts`），执行在 `matchEngine.resolveEntryEffect`。类型：`none`，`self_power_if_position`（edge / corner / center / isolated / adjacent_friendly / adjacent_enemy），`adjacent_power_change`，`self_power_on_cover`，`mirror`，`line`，`edge_tax`，`self_power_if_count`。没有 DSL、没有原子表、没有 JSON。
- **九宫格战斗。** `spatial.ts` 写死 `BOARD_SIZE = 3`。覆盖、扣点、离场、终局都在 `matchEngine.ts`。
- **大地图。** 有，但是三节点直线，不是分支地图。`gameContent.levels` 三点：`level-01` SVARBHĀNU、`level-02` Rahu & Ketu、`level-03` Moon。`campaignStore.cleared` 是下标。场景只有 `scenes.default`。
- **牌组。** `decks.ts` 四副配置；`deckLoadout.ts` + `deckStore.ts` + `DeckBuilder.tsx` 做 12 张出战位和收藏库。抽牌在 `createMatch` / `advanceTurn`。
- **经济。** 没有金币、商店、遗物。唯一投放是胜利后 `claimLevelReward`：`level-01`、`level-02` 各发 3 张进收藏库（不自动塞进出战位），`level-03` 没有奖励。
- **怪物内容。** 三只怪的立绘占位、牌组、预告牌。意图不是独立系统，就是 `telegraph`：玩家回合先亮一张牌，怪物回合再补格子。

玩家卡 10：`player_reference_point`，`player_observation_record`，`player_calibration`，`player_error_correction`，`player_boundary_condition`，`player_falsification`，`player_antipode`，`player_meridian`，`player_center_condition`，`player_syzygy`。

怪物卡 21：`sva_*` 七张，`rk_*` 七张，`moon_*` 七张。起始牌组只用其中一部分，其余靠奖励进库。

### 删旧卡的编译爆炸半径

硬编码具体卡 ID 的文件（删掉或改名会直接红）：

- `src/config/cardCatalog.ts`
- `src/config/decks.ts`（牌组与 `levelRewardCardIds`）
- `src/config/decks.test.ts`
- `src/config/deckLoadout.test.ts`
- `src/game/core/matchEngine.test.ts`
- `src/game/ai/monsterAI.test.ts`
- `src/game/ai/belief.test.ts`
- `src/game/ai/evaluate.test.ts`
- `src/stores/deckReward.test.ts`
- `src/stores/gameStore.test.ts`（还绑 `level-01` / `svarbhanu`）

只通过 `getCardDefinition(cardId)` 读取、不写死 ID，但会随 `CardEffect` 形状一起炸：

- `src/game/core/matchEngine.ts`
- `src/game/ai/search.ts`，`evaluate.ts`，`belief.ts`，`observation.ts`
- `src/scene/board/Cell.tsx`，`src/scene/cards/Hand3D.tsx`，`SelectedCardPreview.tsx`，`PlayerDeckPile.tsx`，`MonsterTelegraphCard.tsx`
- `src/ui/HUD.tsx`，`CardRewardDialog.tsx`，`DeckBuilder.tsx`
- `src/config/deckLoadout.ts`（`CardId` 是 `keyof typeof cardCatalog`）

### 打牌 AI（后置改造）

入口只有两个公开函数，`src/game/ai/monsterAI.ts`：

- `chooseMonsterAction(state, profile?, lockedInstanceId?) → PlayCardAction | null`
- `chooseShownCard(state, profile?) → CardInstance | null`

`MonsterAiProfile`（`src/config/monsterStrategies.ts`）只有 `opponentDeck: DeckConfig` 和可选 `risk`。`gameStore` 把玩家出战牌组塞进这个字段，怪物知道牌表、不知道手牌和牌序。

算法轮廓：`search.ts` 里带时间片的搜索（`searchMonsterAction` / `searchMonsterIntent`，节点上限 20000，硬预算约 110ms，每帧约 6ms）。对方手牌用 `belief.ts` 枚举加权。估值在 `evaluate.ts`。`thinkLane.ts` 的 `driveThink` 把生成器摊到 `requestAnimationFrame`。

内容改造若改坏这些就会编不过：

- `MatchState`，`PlayCardAction`，`CardInstance`，`CardEffect`，`BoardCell`，`CellId`
- `canPlaceCard`，`playCard`，`resolveIdleTurn`，`resolveFinalBattleTurn`，`getBoardPower`
- `getCardDefinition`
- `BOARD_SIZE`，`getMirrorCell`，`getOrthogonalNeighbors`
- `DeckConfig`

调用方是 `src/stores/gameStore.ts`。不要在内容替换的同一轮去改 AI 算法。

## 5. 逻辑 / 表现接缝

规则在 `src/game/core/**` 与 `src/config/matchRules.ts`，不引用 React。效果查表发生在 `matchEngine` 调 `getCardDefinition` 时。

表现只应该读 store 和调用这些动作：`play`，`prepareMonsterTurn`，`playMonsterTurn`，`passIfNoMove`，`resolveFinalBattleTurn`，`settlePlacement`，`finishResolution`，`abandon`。选牌与镜头走 `interactionStore`。输入锁走 `presentationStore.inputLocked`。

接缝文件（两边都会碰到，当共享热点）：

- `src/stores/gameStore.ts`（算完立即 `setInputLocked`，并排程终局）
- `src/pages/LevelPage.tsx`（用 effect 当回合驱动器）
- `src/scene/board/Cell.tsx`（点击即调用 `play`）
- `src/ui/HUD.tsx`（结算、发奖、滚轮切镜头）

改逻辑时不要动：`src/scene/**`（除了上面两个接缝）、`src/styles/**`、`src/audio/**`、`src/loading/**`、`src/pages/HomePage.tsx`、`src/scene/home/**`、`src/scene/camera/**`、`Card3D.tsx` 的网格与绘制。

改表现时不要动：`src/game/core/**`，`src/game/types.ts`，`src/game/ai/**`，`src/config/cardCatalog.ts`，`decks.ts`，`deckLoadout.ts`，`matchRules.ts`，`gameContent.ts`。

## 6. 现在加一张卡 / 一只怪 / 一个效果要改哪里

**新卡（现有效果能表达）：** 只改 `src/config/cardCatalog.ts`，再把 ID 写进 `src/config/decks.ts` 的某副牌或 `levelRewardCardIds`。`CardId` 会跟着目录键自动变。牌面会走 `Card3D` 的程序绘制；`art` 路径目前几乎不被渲染使用，`DeckBuilder` 只拿 `art.back` 是否含 `"Monster"` 区分阵营。

**新效果：** `src/game/types.ts` 的 `CardEffect` 加一个分支 → `matchEngine.ts` 的 `resolveEntryEffect`（位置条件在 `positionConditionMet`）→ 目录里引用它 → `search.ts` 的落子启发式和 `evaluate.ts` 的 `coverReach` 要认识新分支，否则 AI 会按「没有这个效果」估值。然后补 `matchEngine.test.ts`。

**新怪：** `gameContent.ts` 的 `monsters` 加视觉参数，`levels` 加节点；`decks.ts` 加牌组并登记到 `monsterDecks`（按关卡 id，不按怪物 id）；`TableScene.tsx` 的 `OpponentMark` 按 `config.id` 画环。通关顺序是 `levels` 数组顺序，没有单独的关卡图配置。

没有表、没有生成代码、没有内容目录可填。

## 7. 热点文件（同一轮不能两个代理改同一个）

- `src/game/types.ts`
- `src/game/core/matchEngine.ts`
- `src/game/core/spatial.ts`
- `src/config/cardCatalog.ts`
- `src/config/decks.ts`
- `src/config/matchRules.ts`
- `src/config/gameContent.ts`
- `src/config/deckLoadout.ts`
- `src/stores/gameStore.ts`
- `src/stores/deckStore.ts`
- `src/pages/LevelPage.tsx`
- `src/scene/board/Cell.tsx`
- `src/scene/cards/Hand3D.tsx`
- `src/ui/HUD.tsx`
- `src/game/ai/search.ts`

## 8. 不开画布如何验证逻辑

没有 Unity Play 模式。逻辑测试是 Node 上的 Vitest，直接调 `createMatch` / `playCard`，不渲染。

```text
npm test
npm run lint
npm run build
```

`npm test` 即 `vitest run`。`npm run lint` 是 `tsc --noEmit`。`npm run build` 是 `tsc -b && vite build`。

绑死旧卡 ID 或旧关卡的测试：`matchEngine.test.ts`，`monsterAI.test.ts`，`belief.test.ts`，`evaluate.test.ts`，`gameStore.test.ts`，`deckReward.test.ts`，`decks.test.ts`，`deckLoadout.test.ts`。`navigationStore.test.ts` 会 `initialize('level-01','svarbhanu')`。`matchReview.test.ts` 用牌组对象跑整局，牌组被替换后会跟着变结果。

较少绑卡名、改规则仍可能红的：`spatial.test.ts`，`gameContent.test.ts`，`HUD.test.ts`，`thinkLane.test.ts`，镜头/缓动/字形测试。
