/** 玩家可见名。规则 / 模拟仍用 Key；这里只给画面。 */
export const FICTION: Record<string, string> = {
  'SYS.A': '游侠',
  'SYS.B': '死灵',
  'SYS.C': '牧师',
  'MK.A': '猎印',
  'RES.A': '圣油',
  'PC.A00': '巡猎者',
  'PC.A01': '猎犬',
  'PC.A02': '猎箭',
  'PC.A03': '猎网',
  'PC.A04': '溅印',
  'PC.A08': '近刃',
  'PC.A09': '钉阱',
  'PC.A13': '对射',
  'PC.A14': '补印',
  'PC.B00': '唤骨者',
  'PC.B01': '孪尸',
  'PC.B02': '骨种',
  'PC.B03': '食骨',
  'PC.B04': '焚骸',
  'PC.B05': '掘回',
  'PC.B06': '噬身',
  'PC.B07': '丧鼓',
  'PC.B10': '散骨',
  'PC.B11': '裂影',
  'PC.B12': '冢积',
  'PC.B14': '薄棺',
  'PC.C00': '司油者',
  'PC.C01': '油灯',
  'PC.C02': '圣盾',
  'PC.C03': '添油',
  'PC.C04': '油囊',
  'PC.C05': '加持',
  'PC.C12': '满灯',
  'PC.C13': '还魂',
  'PC.C14': '守夜',
  'PC.N01': '木盾',
  'PC.N02': '探图',
  'PC.N03': '净水',
  'PC.N04': '碎砖',
  'PC.N06': '巨锤',
  'PC.N07': '护符',
  'PC.N11': '战鼓',
  'PC.X01': '霉咒',
  'PC.X02': '湿苔',
  'DK.A': '巡猎行囊',
  'DK.B': '唤骨行囊',
  'DK.C': '司油行囊',
  'EC.01': '食人魔',
  'EC.02': '蛛后',
  'EC.03': '蛛卵',
  'EC.04': '瘟疫之心',
  'EC.05': '石碾',
  'EC.06': '酸液柱',
  'EC.07': '骷髅兵',
  'EC.10': '食血苔',
  'EC.11': '疫鼠',
  'EC.16': '蛀牌虫',
  'EC.17': '缄口石像',
  'EC.19': '领地史莱姆',
  'EC.21': '噬法蝠',
  'EC.22': '骨秤',
  'EC.23': '饕餮巨口',
  'MON.N01': '独行食人魔',
  'MON.N02': '巡廊伏击',
  'MON.N04': '苔巢鼠角',
  'MON.N05': '蛀牌两角',
  'MON.N06': '三黏边厅',
  'MON.E01': '三蛛产房',
  'MON.B01': '疫核碾道',
  'RL.01': '破门槌',
  'ME.01': '狭廊',
  'ME.02': '血砖',
  'ME.03': '墙根',
  'ME.04': '塌心',
  'ME.05': '对廊',
  'ME.06': '整列',
  'ME.07': '独行',
  'ME.08': '斜风',
  'ME.09': '丧邻',
  'EV.01': '半开锈箱',
  'EV.01.A': '掏硬币',
  'EV.01.B': '连柄抽出',
  'EV.02': '渗水井',
  'EV.02.A': '舀水喝',
  'EV.02.B': '捞金光',
  'EV.03': '缠住的旅人',
  'EV.03.A': '拉他出来',
  'EV.03.B': '拿走掌心的卡',
  'EV.03.C': '不管',
  'EV.04': '墙根整顿',
  'EV.04.A': '丢掉一张',
  'EV.04.B': '加抄一份',
  'EV.04.C': '不整理',
  'EV.05': '染血兵器',
  'EV.05.A': '拿金的',
  'EV.05.B': '拿干净的',
  'EV.06': '锈牙当铺',
  'EV.06.A': '当掉一张',
  'EV.06.B': '付钱改牌',
  'EV.08': '血誓龛',
  'EV.08.A': '以身换刃',
  'EV.08.B': '以刃换身',
  'EV.08.C': '不跪',
  'EV.09': '双匣',
  'EV.09.A': '开左匣',
  'EV.09.B': '开右匣',
  'EV.10': '驱霉坛',
  'EV.10.A': '以血驱霉',
  'EV.10.B': '花钱驱霉',
  'EV.10.C': '再拿一张霉',
  'EV.11': '赌瓮',
  'EV.11.A': '投三十金币',
  'EV.11.B': '不赌',
  'EV.12': '熔金炉',
  'EV.12.A': '熔成金卡',
  'EV.12.B': '捡硬币',
  'EV.13': '轻装税',
  'EV.13.A': '报轻装',
  'EV.13.B': '报重载',
  'EV.13.C': '不申报',
  'EV.15': '商脚摊',
  'EV.15.A': '买一袋硬币',
  'EV.15.B': '买一件旧货',
  'EV.15.C': '先记下折扣',
  'EV.16': '侧门',
  'EV.16.A': '推门进去',
  'EV.16.B': '不进',
}

export const FICTION_TXT: Record<string, string> = {
  'EV.01.TXT': '门厅墙根一只铁箱，锁已锈断，盖子掀开一条缝。缝里有硬币的反光，也有一截扎手的旧木柄。',
  'EV.02.TXT': '井栏长满青苔，水面偶尔跳过金光。井壁刻着一行字：可饮。勿贪。',
  'EV.03.TXT': '一个裹着破布的人影卡在格位之间，见到你就伸出手，掌心里是一张卡。',
  'EV.04.TXT': '一段难得干爽的墙根。可以把行囊摊开：扔掉累赘，或把一张牌再抄一份。',
  'EV.05.TXT': '武器架上躺着一件金边兵器，刃上的血已经结壳。旁边还有一把没那么亮、也没那么脏的。',
  'EV.06.TXT': '倒扣的盾当柜台。柜台后是一只叫锈牙的地城商贩，收牌给钱，也收钱改牌。',
  'EV.08.TXT': '神龛上只剩半截蜡烛。铭文写：以身换刃，或以刃换身。',
  'EV.09.TXT': '左右各一只匣。左匣贴着你们行会的印，右匣贴着杂货印，缝里漏出几枚硬币。',
  'EV.10.TXT': '一座长满绿毛的石坛。可以驱霉，可以花钱请人驱，也可以把霉卖给坛下的老鼠。',
  'EV.11.TXT': '一只封口的陶瓮，旁边写着：三十金币，金货或白货，各一半。',
  'EV.12.TXT': '一座还能亮的熔炉。三张同名的牌可以熔成一张金的；也可以只从炉边捡几枚硬币。',
  'EV.13.TXT': '过廊挂着一块木牌：轻装赏，重载也赏。看你口袋鼓不鼓。',
  'EV.15.TXT': '拐角处一张折叠摊。摊主是锈牙的表弟，货少，嘴快，下次进店可以讲价。',
  'EV.16.TXT': '侧门后有打斗声，也有钱袋碰撞声。门没锁。',
}

export function fictionName(key: string): string {
  return FICTION[key] ?? key
}

export function fictionTxt(key: string): string {
  return FICTION_TXT[`${key}.TXT`] ?? FICTION_TXT[key] ?? ''
}

const FICTION_KEYS = Object.keys(FICTION).sort((a, b) => b.length - a.length)

/** 把规则正文里的 Key 换成玩家可见名（猎印、圣油等）。 */
export function fictionText(str: string): string {
  let out = str
  for (const k of FICTION_KEYS) {
    if (out.includes(k)) out = out.split(k).join(FICTION[k])
  }
  return out
}

export const STATUS_NAME: Record<string, string> = {
  sealed: '封印',
  marked: '猎印',
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
  'DK.A': '给猎物涂猎印，再打带印的。狗、箭、网。',
  'DK.B': '牌组当祭品，弃牌堆当粮仓。孪尸会分到对面那格。',
  'DK.C': '积圣油。灯是油井，盾和加持都靠油。',
}

export const NODE_HINT: Record<string, string> = {
  normal: '普通战斗。打赢拿奖励。',
  elite: '精英。更难，奖更好。',
  boss: '层主。打赢才能离开锈门层。',
  event: '随机事件。看旁白再选。',
  shop: '锈牙当铺。买卡、复制、遗物。',
  chest: '铁箍木箱。遗物或铜币。',
  rest: '渗泉龛。舀水回血，或把化身磨硬。',
  forge: '铁砧窝。砸牌面强化，或重铸成同稀有度另一张。',
  nextFloor: '向下的石阶。打赢层主才是出口。',
  unknown: '走近才看得见是什么。',
}

export const HELP_PAGES: { title: string; body: string }[] = [
  {
    title: '怎么赢',
    body: '九宫格战场。打出占场卡占格，己方总点数更大就赢。\n化身是你本人，必须先落下才能打其他牌或结束回合。封印的卡总点数计 0，但仍提供占领费用。\n覆盖：打到对方格必须自己当前点数更大。大的占格并扣掉小的当前点。点数相同则双方都进弃牌堆。',
  },
  {
    title: '费用与代价',
    body: '占领费用：场上每张己方占场或化身，每回合开始提供 1 点。化身入场立刻再 +1。手牌右下角是费用。\n化身代价：战后扣血 = 初始化身点数 − 终局当前点数。化身离场则终局为 0。\n普通/精英里化身离场只负本场；BOSS 里化身离场或无牌可出则整局失败。血条归零也失败。',
  },
  {
    title: '地图与卡盒',
    body: '大地图是锈门层的走廊网，整面岩壁铺在画面上。只能走正交相邻的节点。\n没走进去的房间是暗的，走到隔壁才看清类型；看过的类型会留着。走过的房间更亮。\n卡盒是本局拿到的牌；牌组才是战斗抽的那叠。奖励、商店、事件进卡盒，不自动进牌组。回地图后点右下角的卡盒再编，下限 10 张。放弃这一趟在菜单里。\n本层天气（狭廊 / 血砖 / 墙根）写在顶栏，双方都吃。',
  },
  {
    title: '按键',
    body: '主菜单用 ↑↓ 选择，Enter 确认。选行囊用 1 2 3 或 ←→，Enter 开局，Esc 返回。\n局内 Esc 打开或关上菜单。已经选中卡牌时，Esc 先取消选择。\n空格快进演出。M 开关音效。F1 或 H 看规则。\n右键等同 Esc。指向卡牌可看说明；费用不够的牌也能看，只是打不出去。',
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
