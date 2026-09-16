/**
 * npm run sprites:lint —— 校验全部 ASCII 精灵与形状图标。纯数据，不依赖 DOM。
 */
import { lintSprite } from '../src/pixel/lint'
import { MASTER } from '../src/pixel/palette'
import { rasterize, type ShapeIcon } from '../src/pixel/shapes'
import { ASCII_SPRITES, SHAPE_ICONS, defToAssetId } from '../src/pixel/catalog'
import { CARDS } from '../src/content/cards'

declare const process: { exit(code: number): void }

const errors: string[] = []
const warns: string[] = []
const ids = new Set<string>()

for (const d of ASCII_SPRITES) {
  if (ids.has(d.id)) errors.push(`${d.id}: id 重复`)
  ids.add(d.id)
  for (const e of lintSprite(d)) errors.push(`${d.id}: ${e}`)
}

function lintShape(icon: ShapeIcon, maxColors: number): void {
  if (ids.has(icon.id)) errors.push(`${icon.id}: id 重复`)
  ids.add(icon.id)
  if (!/^(char|npc|card|icon|ui|fx|bg|prop)\./.test(icon.id)) errors.push(`${icon.id}: id 前缀不合法`)
  const { grid, w, h } = rasterize(icon)
  const colors = new Set(grid.filter((x): x is string => !!x).map((x) => x.toLowerCase()))
  if (colors.size === 0) errors.push(`${icon.id}: 空图`)
  if (colors.size > maxColors) warns.push(`${icon.id}: 颜色 ${colors.size} > ${maxColors}`)
  for (const c of colors) if (!MASTER.has(c)) errors.push(`${icon.id}: 颜色 ${c} 不在主色板`)
  let touch = false
  for (let x = 0; x < w; x++) if (grid[x] || grid[(h - 1) * w + x]) touch = true
  for (let y = 0; y < h; y++) if (grid[y * w] || grid[y * w + w - 1]) touch = true
  if (touch && icon.id.startsWith('card.')) warns.push(`${icon.id}: 物体贴到画布边缘（建议留 1px）`)
}

for (const icon of SHAPE_ICONS) {
  const max = icon.id.startsWith('card.') || icon.id.startsWith('icon.') ? 8 : icon.id.startsWith('npc.') ? 8 : 10
  lintShape(icon, max)
}

for (const id of Object.keys(CARDS)) {
  const asset = defToAssetId(id)
  if (!ids.has(asset)) errors.push(`${asset}（${CARDS[id].name}）缺图`)
}

console.log(`sprites: ${ids.size} 个资产已检查`)
for (const w of warns) console.log('  warn  ' + w)
for (const e of errors) console.log('  ERROR ' + e)
if (errors.length) {
  console.log(`\n${errors.length} 个错误`)
  process.exit(1)
}
console.log(warns.length ? `\n通过（${warns.length} 个警告）` : '\n全部通过')
