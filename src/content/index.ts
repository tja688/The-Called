import { ANCHORS } from './anchors'
import { AVATAR_ID, CARDS, ECHO_DECK, cardDef, cardName, type CardDef } from './cards'
import { ENCOUNTERS, encounterDef, type EncounterDef } from './encounters'
import { DRAWER_EVENT } from './events'
import { BO_SHOU_POOL, YU_ZHUANG_POOL, rewardPool } from './rewards'
import { validateContent } from './validate'

let validated = false

export function content() {
  if (!validated) {
    validateContent()
    validated = true
  }
  return {
    anchors: ANCHORS,
    cards: CARDS,
    card: cardDef,
    name: cardName,
    echoDeck: ECHO_DECK,
    avatarId: AVATAR_ID,
    encounters: ENCOUNTERS,
    encounter: encounterDef,
    drawer: DRAWER_EVENT,
    rewardPool,
    pools: { yuZhuang: YU_ZHUANG_POOL, boShou: BO_SHOU_POOL },
  }
}

export type { CardDef, EncounterDef }
export { ANCHORS, AVATAR_ID, CARDS, ECHO_DECK, cardDef, cardName, validateContent }
