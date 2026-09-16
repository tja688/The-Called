export interface EventOptionDef {
  index: 0 | 1 | 2
  label: string
  text: string
}

export const DRAWER_EVENT = {
  id: 'drawer',
  name: '裂开的抽屉',
  options: [
    { index: 0, label: '摸出一块冷铁', text: '卡盒加入冷钉子（0 费 6 点）。' },
    { index: 1, label: '包扎', text: '血条 +8，不超过上限。' },
    { index: 2, label: '夹层', text: '下一场（剥手）开战多抽 1 张。' },
  ] as EventOptionDef[],
}
