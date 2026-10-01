---
status: superseded by ADR-0012
---

# 网页表现层：整数像素 Canvas2D + 原生 WebGL CRT

本仓库不采用这份表现层。网页画面是已有的三维矢量场景，见 ADR-0012。下面的决定只保留作来源记录，磷光终端没有迁进 The-Called。

网页端的全部玩家画面，包括菜单和对局，都绘制在一块 640×360 的 Canvas2D 逻辑帧缓冲上：场景先以六级灰度和整数坐标绘制，再由原生 WebGL 在设备分辨率执行琥珀色 CRT 后处理。后处理包含最近邻采样、扫描栅格、荧光余辉、克制辉光、暗角、曲率和轻微信号扰动。没有 WebGL 时保留 Canvas2D 琥珀映射，不让设备黑屏。

像素资产沿用“形状指令烘焙成像素网格”的思路；资产和场景不携带颜色语义，由 CRT 统一染成 Amber Phosphor。当前字体由随仓库提供的 Fusion Pixel 位图字形承担中文显示。PixiJS 不再是运行时依赖：原生 Canvas2D + 原生 WebGL 足以满足低分辨率帧缓冲和设备级后处理，减少网页预览版的依赖面。

## Implementation status

ADR 已落地于 `src/Pcd.Web/draw.js`、`src/Pcd.Web/art.js`、`src/Pcd.Web/crt.js` 和 `src/Pcd.Web/app.js`。`src/Pcd.DevHost` 只适配真实 `Pcd.Kernel` 会话、内容和事件；表现层不复制合法性判断。完整视觉接力规则见 `docs/amber-phosphor-presentation-handoff.md`。

## Considered Options

- DOM + CSS：文字排版最省事，但做不出荧光余辉等真正的 CRT 质感。
- 纯 Canvas2D：在屏幕分辨率上逐像素做 CRT 后处理太慢，只能用 CSS 叠层近似。

## Consequences

- 补间动画产生的坐标一律取整；场景和历史纹理全局使用最近邻过滤。
- 中文像素字体按设计字号绘制在整数坐标上；Fusion Pixel 字形随仓库提供，避免运行时依赖系统字体。
- 表现层验证已经完成：原创像素图形、中文像素字形、WebGL CRT 余辉，以及无 WebGL 的琥珀 Canvas2D 降级路径均在真实浏览器中可见。
