---
name: pixel-layer
description: Implements the Canvas 2D pixel stack — 640×360 Stage, ASCII/shape sprite DSL, master palette, integer nearest blit, device-resolution text. Use when building the demo presentation, src/pixel, bake/drawSprite, pixels.html, sprites:lint, or when the user mentions 像素层 / ASCII 精灵 / 形状 DSL.
---

# Pixel Layer

本仓库 demo 的表现层走 **Canvas 2D 像素栈**，不走 Three / R3F。`src/pixel` 只负责「怎么画」，不知道游戏。

参考实现在 git 分支 `the_called3` 的 `src/pixel/**`。搬引擎，不搬角色 / 卡牌 / 场景内容。

## 落地顺序

每次任务从当前缺的那一步接着做，做完再往下：

1. **Stage 能转**：`#stage` 全屏黑底 → `new Stage(host).start()` → 每帧 `update` / `render(world, ui, text)`。验收：整数倍放大 + letterbox，`imageSmoothingEnabled = false`。
2. **主色板 + DSL**：`palette.ts`、`dsl.ts`、`shapes.ts`、`lint.ts`。验收：一张 ASCII 精灵 `bake` 后 `drawSprite` 画在 world 上，坐标 `Math.round`。
3. **查表**：`assets.ts` 按 `id` 取图；缺图画 `?` 占位并 `console.warn` 一次，不抛错。
4. **文字 / 输入 / 补间**：`text.ts`、`input.ts`、`tween.ts`。验收：逻辑坐标点按钮能点中；`Space` 提高 `tween.speed`。
5. **编辑页 + lint**：`pixels.html` 仅 development；`npm run sprites:lint` 失败即构建失败。
6. **场景壳**（有玩法再做）：`present` 消费游戏，只通过命令 / 查询 / 事件，不反向改规则。

当前仓库若还是 R3F 占位立方体：新画面进 `src/pixel`，不要在 WebGL 里复刻这套管线。

## 三层画布

| 层 | 尺寸 | 用途 |
| :-- | :-- | :-- |
| `world` | 640×360 | 场景、角色、光效。nearest 放大。 |
| `ui` | 640×360 | HUD、面板底、卡框、图标。nearest 放大。 |
| `text` | 命令缓存，flush 时按设备分辨率画 | 所有可读文字。矢量、抗锯齿。 |

合成顺序：`display` 先 blit `world`，再 `ui`，再 `text.flush`。`dt` 上限 50ms。`?scale=2` 固定倍数，`?raf=timeout` 后台驱动，`?debugText=1` 画文字框。

- 像素层：整数像素、有限色板、无抗锯齿、无抖动。
- 光效（`light.ts` / `sky.ts`）：允许渐变与半透明；角色精灵不允许。
- 文字：逻辑坐标 / 逻辑字号，内部乘 `scale`。字体栈见 `text.ts` 的 `FONT_STACK`。

## 模块

```
src/pixel/
  palette.ts     主色板（只增不换）。color() / MASTER
  dsl.ts         ASCII：bake / bakeRows / applyDelta / drawSprite / tint / outline
  shapes.ts      几何原语 → 像素网格 + 1px 轮廓
  lint.ts        硬规则（与编辑页共用）
  stage.ts       Stage、W/H=640/360、toLogical、step
  text.ts        TextLayer
  input.ts       即时模式命中区，ui 优先；最小命中 24×24
  tween.ts       对象属性补间 + 全局 speed（快进）
  light.ts sky.ts scenery.ts terrain.ts
  ui.ts          像素面板 / 键帽 / 框
  assets.ts      id → 已烘焙 canvas
  sprites/       资产（chars 用 ASCII；icons/cards/props 用形状）
  editor/        pixels.html 编辑页
scripts/sprites-lint.ts
```

依赖方向：`present → pixel`，`pixel` 不引用游戏。

场景接口（有玩法时）：`enter` / `exit` / `update(dt)` / `render(world, ui, text)` / `handle(event)`（可 await tween）。演出期间 `input.locked`，只允许快进。

## 资产分流

| 种类 | 写法 | 画布 |
| :-- | :-- | :-- |
| 角色、表情、8×8 符号 | ASCII `SpriteDef` | 按 `size` |
| 图标、卡面、道具、Logo | `ShapeIcon` 原语 | 缺省 24×24 |

格式、字符表、原语、生成提示词：见 [dsl.md](dsl.md)。

## 硬规则

`lintSprite` / `sprites:lint` 违反即失败：

1. 行长 ≤ `size[0]`，行数 ≤ `size[1]`；`offset` 不越界。
2. 非透明字符都在私有 `palette`；每个 hex ∈ `MASTER`。
3. 不用 `#000000` / `#ffffff`（用 `ink` / `white`）。
4. 颜色数：角色 ≤ 16；卡图标 ≤ 8；符号 / 状态 ≤ 5。
5. 必须有 `o` 且至少用一次（轮廓）。
6. `delta` 不超过基帧；`~` 只出现在 delta。
7. `animations` 引用的部件 / 帧存在。
8. `id` 唯一，前缀 ∈ `char. | npc. | card. | icon. | ui. | fx. | bg. | prop.`。

形状图标：光栅化后颜色 ∈ `MASTER`；卡图标四周留 1px。

## 绘制约定

- `drawSprite(g, baked, x, y, opt)`：`(x,y)` 是锚点，缺省脚底中心 `[w/2, h]`。
- `compose` 先画的在下。`squash` / `flip` 用 `ctx.scale`，不改像素。
- 影子：`tint(still, shadow)` 后压到 `[1, 0.3]`。
- 光从左上。物体居中。
- 明暗 2～3 阶：小写主色、大写暗阶、`G` 高光、`y` 最深。

## 编辑页

`npm run dev` → `/pixels.html`（仅 `mode === 'development'` 进 rollup input）。

网格铅笔 / 橡皮 / 取色 / 填充；onion skin；动画预览。「导出 TS」只复制到剪贴板，不写文件。页内跑同一套 lint。

## 预算

每帧 `drawImage` ≤ 200，`fillRect` ≤ 100。精灵懒烘焙，同 `id` 只烘一次。目标：1080p 3× 稳 60fps。
