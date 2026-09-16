# 像素资产 DSL

`SpriteDef` / `ShapeIcon` 的字段与生成模板。实现以 `the_called3` 的 `src/pixel/dsl.ts`、`shapes.ts` 为准。

## ASCII：`SpriteDef`

```ts
export type Rows = string[]
export type Frame = Rows | { delta: Rows }
export interface PartDef { frames: Frame[] | Record<string, Frame>; offset: [number, number] }
export interface AnimDef { fps?: number; [part: string]: number | string | (number | string)[] | undefined }
export interface SpriteDef {
  id: string
  size: [number, number]
  anchor?: [number, number]          // 缺省 [w/2, h]
  palette: Record<string, string>    // 值必须 ∈ MASTER
  parts: Record<string, Rows | PartDef>
  compose?: string[]
  animations?: Record<string, AnimDef>
  mirror?: 'none' | 'flipX'
}
```

纯 `Rows` 当作单帧、`offset [0,0]`。`delta` 相对同部件第一帧 / `neutral`：空格保留，`~` 擦透明，其它覆盖。

### 字符

| 字符 | 含义 |
| :-- | :-- |
| `.` 或空格 | 透明 |
| `o` | 轮廓（`ink` 或 `ink2`） |
| 小写 | 主色阶 |
| 对应大写 | 暗阶 |
| `G` | 最亮高光（`white`） |
| `y` | 最深 |
| `~` | 仅 delta：擦透明 |

烘焙：逐字 `fillRect(x, y, 1, 1)`。未知字符抛错。

走路帧常用四拍：分开 / 并拢 / 换边分开 / 并拢（第 2 与第 4 可相同）。

## 形状：`ShapeIcon`

角色不用这个。图标 / 卡面 / 道具用。

```ts
type Op =
  | { c: 'disc'; x; y; r; f }
  | { c: 'ell'; x; y; rx; ry; f }
  | { c: 'rect'; x; y; w; h; f }
  | { c: 'rrect'; x; y; w; h; r?; f }
  | { c: 'line'; x1; y1; x2; y2; f; w? }
  | { c: 'poly'; pts; f }
  | { c: 'px'; pts; f }
  | { c: 'ring' | 'arc'; x; y; r; f; a0?; a1? }
  | { c: 'hl'; x; y; w? }          // 左上高光，缺省 white
  | { c: 'clear'; x; y; w; h }
interface ShapeIcon {
  id: string
  size?: [number, number]          // 缺省 [24, 24]
  ops: Op[]
  outline?: string | false         // 缺省 ink
  shadow?: boolean                 // 底部 1 行 ink2，缺省 true
  innerLines?: boolean
}
```

`f` 写主色板键或 `#hex`。光栅化后自动描 1px 轮廓。光从左上。≤ 8 色（含轮廓）。

## 生成提示词

输出只要合法 TypeScript，不要解释。

```
你在写像素精灵。只输出 TypeScript，不要其它文字。

约束：
- 画布 W×H；每行恰好 W 个字符；共 ≤ H 行。
- '.' 透明。'o' 轮廓，颜色 '#2a1e24'。不用纯黑纯白。
- 最多 N 种颜色，全部从主色板选：[hex 列表]
- 明暗 2~3 阶：主色小写、暗阶大写、高光 'G' '#fff8ee'。
- 无抗锯齿、无抖动；轮廓闭合；居中，四周留 1 像素。
- 光从左上。

参考（已通过 lint 的同风格一张）：
[粘贴 rows]

任务：
画「……」。id: 'card.XXX' 或 'char.xxx'
```

只改可变层时，只要求那一层（例如只输出 4 张走路腿，或只输出 face 的 delta）。
