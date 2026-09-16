/**
 * 主色板（Master Palette）——所有精灵私有色板的唯一来源（见《视觉风格指南》第三节）。
 * 只能增，不能换。键名短、含义稳定；lint 会校验精灵色板里的每个值都在这里。
 */
export const PAL = {
  // 轮廓与中性
  ink: '#2a1e24', ink2: '#3d2b33', shadow: '#141020',
  gray1: '#5a5666', gray2: '#8a8494', gray3: '#c2bcc8', cream: '#f5e6c8', white: '#fff8ee',
  // 木与瓦
  wood1: '#6b3f26', wood2: '#a8683c', wood3: '#d9985a', tile1: '#3a3a4c', tile2: '#56566c',
  // 暮色天空与灯
  sky1: '#2b2d5e', sky2: '#6a4a7a', sky3: '#c9705e', sky4: '#f0a06a', night1: '#0f1330', night2: '#2d2a5a',
  lamp1: '#ffd27a', lamp2: '#ff9a3d', lamp3: '#d9412e',
  // 江与雾
  river1: '#26565c', river2: '#3f8a8c', river3: '#8fd3c8', fog: '#e8e0f0',
  // 体系主色
  sta: '#f2c14e', fruR: '#e05a4f', fruG: '#6fbf5a', dai: '#4f8fd9', sna: '#f5e6c8', sig: '#9b6bd9', ene: '#8a5a3a',
  // 嘟嘟 / 角色常用
  red: '#d94a3a', redD: '#8f2a22', redL: '#f07a5a', belly: '#f5dcb8', bellyD: '#d9b48a', eye: '#4a2a30', pupil: '#1c1414',
  sprout: '#6fbf5a', pack: '#8a5a3a',
  // 补充（开发中增补，只增不换）
  leaf: '#3f7f3a', leafL: '#9ad46a', yellowD: '#c48a1e', blueD: '#2f5f9e', blueL: '#8fc2f0', purpleD: '#5f3f8f', purpleL: '#c9a6f0',
  pink: '#f0a0b0', pinkD: '#c86a80', orange: '#f08a3a', orangeD: '#b85a1e', brown: '#4a2f22', tan: '#c8a070', tanL: '#e8d0a8',
  black: '#1c1414', teal: '#4fa8a0', gold: '#e8b040', goldL: '#ffe28a', paper: '#fff1d6', paperD: '#e8d7b4',
  grass: '#5a9a48', grassD: '#3d6e34', stone: '#7a7a8a', stoneL: '#a8a8b8', moon: '#f8f0d0',
  // 桌面材质
  bamboo: '#c8b070', bambooD: '#9a8450', copper: '#b06a3a', copperD: '#7a4424', copperL: '#e09a5a', slate: '#4e5a66', slateL: '#7a8896',
} as const

export type PalKey = keyof typeof PAL

/** 主色板 hex 集合（小写），lint 与烘焙用 */
export const MASTER: ReadonlySet<string> = new Set(Object.values(PAL).map((h) => h.toLowerCase()))

/** 体系 → 主色（卡框、符号、文字高亮） */
export const SCHOOL_COLOR: Record<string, string> = {
  science: PAL.sta, mystery: PAL.fruR, religion: PAL.dai, neutral: PAL.sna, monster: PAL.sig, enemy: PAL.ene,
}
export const SCHOOL_COLOR_DARK: Record<string, string> = {
  science: PAL.yellowD, mystery: PAL.redD, religion: PAL.blueD, neutral: PAL.tan, monster: PAL.purpleD, enemy: PAL.wood1,
}

/** 解析 'key' 或 '#hex' */
export function color(k: string): string {
  return (PAL as Record<string, string>)[k] ?? k
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b)
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}
