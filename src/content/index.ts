import { ANCHORS } from './anchors'
import { CARDS, cardDef, cardName, type CardDef } from './cards'
import { ENCOUNTERS, encounterDef, type EncounterDef } from './encounters'
import { STARTING_DECKS } from './decks'
import { EVENTS } from './events'
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
    encounters: ENCOUNTERS,
    encounter: encounterDef,
    decks: STARTING_DECKS,
    events: EVENTS,
  }
}

export type { CardDef, EncounterDef }
export { ANCHORS, CARDS, cardDef, cardName, validateContent }
