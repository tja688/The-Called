---
name: pixel-layer
description: >-
  The-Called demo presentation on the Canvas 2D pixel stack — 640×360 Stage,
  MASTER palette, src/pixel, pixels.html, sprites:lint. Use when building this
  repo's present/pixel layer (not a standalone canvas pixel preview).
---

# Pixel Layer

本仓库 demo 的表现层走 **Canvas 2D**。绘制（_snap_ / _bake_ / _nearest_ / _sight_）走 [canvas-pixel](C:/Users/jinji/.cursor/skills/canvas-pixel/SKILL.md)。

独立一张图、打开 web 看：只走 canvas-pixel，不要在本仓库另起预览脚手架。

`src/pixel` 只负责「怎么画」，不知道游戏。规则只通过 `GameService` 的 `dispatch` / `ask` / `on`。

## 落地顺序

从当前缺的那一步接着做：

1. **Stage 能转**：`#stage` → `new Stage(host).start()` → 每帧 `update` / `render(world, ui, text)`。验收：整数倍放大 + letterbox，`imageSmoothingEnabled = false`。
2. **主色板 + DSL**：`palette.ts`、`dsl.ts`、`shapes.ts`、`lint.ts`。验收：一张 ASCII 精灵 `bake` 后 `drawSprite` 画在 world 上，坐标 `Math.round`。
3. **查表**：`assets.ts` 按 `id` 取图；缺图画 `?` 占位并 `console.warn` 一次，不抛错。
4. **文字 / 输入 / 补间**：`text.ts`、`input.ts`、`tween.ts`。验收：逻辑坐标点按钮能点中；`Space` 提高 `tween.speed`。
5. **编辑页 + lint**：`pixels.html` 仅 development；`npm run sprites:lint` 失败即构建失败。
6. **场景壳**（有玩法再做）：`present` 消费游戏，只通过命令 / 查询 / 事件。

新画面进 `src/pixel`，不要在 WebGL 里复刻这套管线。

## 本仓库额外

| 项 | 值 |
| :-- | :-- |
| Stage | 640×360；`world` / `ui` nearest，`text` 设备分辨率 |
| 色板 | `src/pixel/palette.ts` 的 `MASTER`，只增不换 |
| 合成 | display 先 blit world，再 ui，再 `text.flush`；`dt` 上限 50ms |
| 调试 | `?scale=2` `?raf=timeout` `?debugText=1` |

- 像素层：整数像素、有限色板、无抗锯齿、无抖动。
- 光效（`light.ts` / `sky.ts`）允许渐变与半透明；角色精灵不允许。
- 新资产写 `src/pixel/sprites/`。角色 / 表情走 ASCII；图标 / 卡面 / 道具走 `ShapeIcon`。
- 格式见 [dsl.md](dsl.md)。生成时色值必须 ∈ `MASTER`，不要换成 mulfok32。

## 硬规则

`lintSprite` / `sprites:lint` 违反即失败：id 前缀 ∈ `char. | npc. | card. | icon. | ui. | fx. | bg. | prop.`；私有色板 hex ∈ `MASTER`；不用 `#000000` / `#ffffff`；必须有 `o` 且用过；颜色数角色 ≤ 16、卡图标 ≤ 8、符号 ≤ 5。

`drawSprite` 的 `(x,y)` 是锚点，缺省脚底中心。影子：`tint(still, shadow)` 后压到 `[1, 0.3]`。
