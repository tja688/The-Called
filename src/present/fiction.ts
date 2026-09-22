/** 玩家可见名。规则 / 模拟仍用 Key；这里只给画面。 */
export const FICTION: Record<string, string> = {
  'SYS.A': '游侠',
  'SYS.B': '死灵法师',
  'SYS.C': '牧师',
  'MK.A': '印记',
  'RES.A': '法力',
  'PC.A00': '游侠',
  'PC.A01': '猎犬',
  'PC.A02': '射击',
  'PC.A03': '猎网',
  'PC.A04': '标记',
  'PC.A08': '短剑',
  'PC.A09': '陷阱',
  'PC.A13': '对位',
  'PC.A14': '瞄准',
  'PC.B00': '死灵法师',
  'PC.B01': '双尸',
  'PC.B02': '指骨',
  'PC.B03': '食尸',
  'PC.B04': '骨火',
  'PC.B05': '回收',
  'PC.B06': '吞并',
  'PC.B07': '亡鼓',
  'PC.B10': '碎骨',
  'PC.B11': '复制',
  'PC.B12': '尸堆',
  'PC.B14': '棺材',
  'PC.C00': '牧师',
  'PC.C01': '圣灯',
  'PC.C02': '圣盾',
  'PC.C03': '充能',
  'PC.C04': '药水',
  'PC.C05': '祝福',
  'PC.C12': '圣光',
  'PC.C13': '复活',
  'PC.C14': '守夜',
  'PC.N01': '木盾',
  'PC.N02': '探索',
  'PC.N03': '净化',
  'PC.N04': '碎砖',
  'PC.N06': '巨锤',
  'PC.N07': '护符',
  'PC.N11': '战鼓',
  'PC.X01': '诅咒',
  'PC.X02': '毒苔',
  'DK.A': '游侠套牌',
  'DK.B': '死灵套牌',
  'DK.C': '牧师套牌',
  'EC.01': '食人魔',
  'EC.02': '蛛后',
  'EC.03': '蛛卵',
  'EC.04': '瘟疫之心',
  'EC.05': '巨石',
  'EC.06': '酸液',
  'EC.07': '骷髅兵',
  'EC.10': '血苔',
  'EC.11': '老鼠',
  'EC.16': '蛀虫',
  'EC.17': '石像',
  'EC.19': '史莱姆',
  'EC.21': '蝙蝠',
  'EC.22': '天平',
  'EC.23': '巨口',
  'MON.N01': '食人魔',
  'MON.N02': '走廊伏击',
  'MON.N04': '鼠穴',
  'MON.N05': '蛀虫',
  'MON.N06': '史莱姆',
  'MON.E01': '蛛后',
  'MON.B01': '瘟疫之心',
  'RL.01': '战锤',
  'ME.01': '狭窄',
  'ME.02': '血地',
  'ME.03': '掩体',
  'ME.04': '塌陷',
  'ME.05': '对位',
  'ME.06': '列阵',
  'ME.07': '孤立',
  'ME.08': '斜角',
  'ME.09': '牵连',
  'EV.01': '半开的箱子',
  'EV.01.A': '只拿金币',
  'EV.01.B': '连东西一起抽出',
  'EV.02': '水井',
  'EV.02.A': '喝水',
  'EV.02.B': '捞闪光',
  'EV.03': '遇难的冒险者',
  'EV.03.A': '拉他出来',
  'EV.03.B': '拿走那张牌',
  'EV.03.C': '绕开',
  'EV.04': '整理行囊',
  'EV.04.A': '丢掉诅咒',
  'EV.04.B': '抄一张',
  'EV.04.C': '背上就走',
  'EV.05': '染血的武器',
  'EV.05.A': '拿镶金的',
  'EV.05.B': '拿普通的',
  'EV.06': '商店',
  'EV.06.A': '卖掉一张',
  'EV.06.B': '强化一张',
  'EV.08': '祭坛',
  'EV.08.A': '用生命换武器',
  'EV.08.B': '用武器换生命',
  'EV.08.C': '离开',
  'EV.09': '两个匣子',
  'EV.09.A': '开左边',
  'EV.09.B': '开右边',
  'EV.10': '诅咒祭坛',
  'EV.10.A': '用生命消除',
  'EV.10.B': '花钱消除',
  'EV.10.C': '再拿一张诅咒',
  'EV.11': '赌瓮',
  'EV.11.A': '投 30 金币',
  'EV.11.B': '不赌',
  'EV.12': '熔炉',
  'EV.12.A': '熔成金卡',
  'EV.12.B': '捡金币',
  'EV.13': '过路税',
  'EV.13.A': '报行囊薄',
  'EV.13.B': '报行囊沉',
  'EV.13.C': '不报',
  'EV.15': '小摊',
  'EV.15.A': '买一袋金币',
  'EV.15.B': '买旧货',
  'EV.15.C': '记下折扣',
  'EV.16': '侧门',
  'EV.16.A': '推门进去',
  'EV.16.B': '不进',
}

export const FICTION_TXT: Record<string, string> = {
  'EV.01.TXT': '墙边有一只铁箱，锁锈断了，盖子开了一条缝。里面有金币的反光，还露出一截木柄。',
  'EV.02.TXT': '井水很清，水面上有光在跳。井壁刻着：可以喝，别贪。',
  'EV.03.TXT': '砖缝里卡着一个活人，衣服破了。他朝你伸手，掌心摊着一张牌。',
  'EV.04.TXT': '这段墙根是干的。行囊可以卸下来。',
  'EV.05.TXT': '武器架上有一把镶金的武器，刃上结着血。旁边还有一把普通的。',
  'EV.06.TXT': '商人坐在柜台后面。他收牌给钱，也收钱改牌。',
  'EV.08.TXT': '神龛上只剩半截蜡烛。铭文写着，可以用生命换一把武器，也可以反过来。',
  'EV.09.TXT': '左边匣子贴着你的职业标记，右边是杂货。缝里漏出几枚金币。',
  'EV.10.TXT': '石坛长满绿毛，坛下有几只老鼠。',
  'EV.11.TXT': '陶瓮封着口。旁边写着：30 金币，一半是金卡，一半是白卡。',
  'EV.12.TXT': '熔炉还亮着。三张同名的牌可以熔成一张金卡，也可以只捡炉边的金币。',
  'EV.13.TXT': '过廊的木牌写着：行囊薄有赏，行囊沉也有赏。没人看着。',
  'EV.15.TXT': '拐角有个小摊，货不多。摊主说，下次进商店可以讲价。',
  'EV.16.TXT': '门后有打架声，还有钱袋碰在一起的声音。门没锁。',
}

export function fictionName(key: string): string {
  return FICTION[key] ?? key
}

export function fictionTxt(key: string): string {
  return FICTION_TXT[`${key}.TXT`] ?? FICTION_TXT[key] ?? ''
}

const FICTION_KEYS = Object.keys(FICTION).sort((a, b) => b.length - a.length)

/** 把规则正文里的 Key 换成玩家可见名（印记、法力等）。 */
export function fictionText(str: string): string {
  let out = str
  for (const k of FICTION_KEYS) {
    if (out.includes(k)) out = out.split(k).join(FICTION[k])
  }
  return out
}

/** 词条。卡面上加粗，悬停给解释。效果名不算词条。 */
export interface GlossaryEntry {
  name: string
  text: string
}

export const GLOSSARY: GlossaryEntry[] = [
  { name: '主动触发', text: '点这张牌发动，这一场只能用一次。' },
  { name: '角落格', text: '四个角：格 1、3、7、9。' },
  { name: '镜像格', text: '正对面那一格。1 对 9，2 对 8，3 对 7，4 对 6。' },
  { name: '入场', text: '打出或被生成到战场时发动一次。被移动过去不算。' },
  { name: '驻场', text: '在场且没被封印时一直生效。离场或被封印就停。' },
  { name: '离场', text: '离开战场时发动。被覆盖或被效果移走都算。' },
  { name: '相邻', text: '上下左右紧挨的格子，斜角不算。' },
  { name: '镜像', text: '两张牌分别在对面的格子上。' },
  { name: '覆盖', text: '点数更大才能打到对方那格。大的留下并扣掉小的点数，小的进弃牌堆。点数相同则都进弃牌堆。' },
  { name: '移动', text: '走到上下左右的空格。那格有牌就走不了。' },
  { name: '封印', text: '不计点数，驻场效果也停。下回合开始时解开。' },
  { name: '返魂', text: '被移走时回到手牌。手牌满了就进弃牌堆。' },
  { name: '易伤', text: '点数减少时再额外减四分之一，向上取整。回合结束去掉。' },
  { name: '保护', text: '挡住一次点数减少，然后这个状态消失。' },
  { name: '法力', text: '牧师这场攒的资源，战斗结束清零。不够时效果不发动，牌仍然打出。' },
  { name: '献祭', text: '从牌组里随机丢进弃牌堆。牌组不够时效果不发动。' },
  { name: '燃尽', text: '打出后这一局删除，卡盒里也不留。' },
  { name: '计时', text: '回合开始减 1，到 0 就发动，然后回到最初的数字。' },
  { name: '印记', text: '打在怪物身上的标记。有的牌只对带着印记的目标生效。' },
]

const GLOSSARY_BY_LENGTH = [...GLOSSARY].sort((a, b) => b.name.length - a.name.length)

/** 正文里出现的词条。长的先匹配，避免「镜像格」再拆出「镜像」。 */
export function keywordTips(raw: string, extraNames: string[] = []): GlossaryEntry[] {
  let rest = fictionText(raw)
  const found: GlossaryEntry[] = []
  for (const entry of GLOSSARY_BY_LENGTH) {
    const inText = rest.includes(entry.name)
    if (!inText && !extraNames.includes(entry.name)) continue
    found.push(entry)
    if (inText) rest = rest.split(entry.name).join('\u0000'.repeat(entry.name.length))
  }
  return found
}

/** 把词条包成 **名字**，供纸面加粗。 */
export function emphasizeKeywords(raw: string): string {
  let rest = fictionText(raw)
  const slots: string[] = []
  for (const entry of GLOSSARY_BY_LENGTH) {
    if (!rest.includes(entry.name)) continue
    const token = `\u0000${slots.length}\u0000`
    slots.push(`**${entry.name}**`)
    rest = rest.split(entry.name).join(token)
  }
  slots.forEach((slot, i) => {
    rest = rest.split(`\u0000${i}\u0000`).join(slot)
  })
  return rest
}

export const STATUS_NAME: Record<string, string> = {
  sealed: '封印',
  marked: '印记',
  vulnerable: '易伤',
  protected: '保护',
  rebirth: '返魂',
}

export const KIND_NAME: Record<string, string> = {
  occupy: '占场',
  spell: '法术',
  avatar: '化身',
}

export const RARITY_NAME: Record<string, string> = {
  basic: '基础',
  white: '白',
  blue: '蓝',
  gold: '金',
}

export const DECK_BLURB: Record<string, string> = {
  'DK.A': '给怪物挂上印记，再打带着印记的。猎犬、箭和网都认这个标记。',
  'DK.B': '牌组是燃料，弃牌堆是分数。双尸会分到对面那一格。',
  'DK.C': '攒法力。圣灯产出，圣盾和祝福都要花法力。',
}

export const NODE_HINT: Record<string, string> = {
  normal: '普通战斗。打赢有奖励。',
  elite: '精英。更难，奖励更好。',
  boss: 'Boss。打赢才能离开这一层。',
  event: '事件。看完再选。',
  shop: '商店。买牌、复制、遗物。',
  chest: '宝箱。遗物或金币。',
  rest: '休息处。回血，或强化英雄。',
  forge: '铁匠铺。强化一张牌，或重铸成另一张。',
  nextFloor: '楼梯。打赢 Boss 才能下去。',
  unknown: '走近才知道是什么。',
}

export const HELP_PAGES: { title: string; body: string }[] = [
  {
    title: '怎么赢',
    body: '九宫格战场。打出占场卡占格，己方总点数更大就赢。\n化身是你本人，必须先落下才能打其他牌或结束回合。封印的卡总点数计 0，但仍提供占领费用。\n覆盖：打到对方格必须自己当前点数更大。大的占格并扣掉小的当前点。点数相同则双方都进弃牌堆。',
  },
  {
    title: '费用与代价',
    body: '占领费用：场上每张己方占场或化身，每回合开始提供 1 点。化身入场立刻再 +1。画面写着「费用」，亮着的蓝晶体还能用，暗掉的是已经花掉的。\n化身代价：战后扣血 = 初始化身点数 − 终局当前点数。化身离场则终局为 0。\n普通/精英里化身离场只负本场；BOSS 里化身离场或无牌可出则整局失败。血条归零也失败。',
  },
  {
    title: '地图与卡盒',
    body: '大地图是这一层地下城的走廊。只能走上下左右相邻的房间。\n没走进去的房间是暗的，走到隔壁才看清类型；看过的类型会留着。走过的房间更亮。\n卡盒是本局拿到的牌；牌组才是战斗里抽的那叠。奖励、商店、事件进卡盒，不自动进牌组。回地图后点右下角的卡盒再编。牌组至少 10 张，不够就加碎砖补满。放弃这一局在菜单里。\n本层环境（狭窄 / 血地 / 掩体）写在顶栏，双方都吃。',
  },
  {
    title: '按键',
    body: '主菜单用 ↑↓ 选择，Enter 确认。选角色用 1 2 3 或 ←→，点角色或再按 Enter，确认后才开局，Esc 返回。\n局内 Esc 打开或关上菜单。已经选中卡牌时，Esc 先取消选择。\n空格快进演出。M 开关音效。F1 或 H 看规则。\n右键等同 Esc。指向卡牌可看说明；费用不够的牌也能看，只是打不出去。',
  },
]

export function avatarSpriteId(defId: string): string {
  if (defId === 'PC.B00') return 'char.pcb00'
  if (defId === 'PC.C00') return 'char.pcc00'
  return 'char.pca00'
}

export function avatarHeadId(defId: string): string {
  if (defId === 'PC.B00') return 'char.head.b'
  if (defId === 'PC.C00') return 'char.head.c'
  return 'char.head.a'
}
