import type { PcdCardInfo } from '../pcd/types'
import { Sigil } from './Sigil'
import './cards.css'

export const SCHOOL_NAMES: Record<string, string> = {
    science: '科学',
    mystery: '神秘',
    religion: '宗教',
    neutral: '中立',
}

export function CardFace({
    card,
    points = card.points,
    owner = 'player',
    statuses = [],
    compact = false,
}: {
    card: PcdCardInfo
    points?: number
    owner?: string
    statuses?: string[]
    compact?: boolean
}) {
    return (
        <div
            className={`card-face card-face--${card.school || 'monster'}${compact ? ' card-face--compact' : ''}`}
            data-owner={owner}
        >
            <div className="card-face__top">
                <span>{card.isSpell ? '✦' : points}</span>
                <small>
                    {card.isSpell ? '法术' : '占场'}
                    <i />
                </small>
            </div>
            <div className="card-face__art">
                <div className="card-face__art-grid" />
                <Sigil id={card.id} />
                <span className="card-face__art-corner">
                    {card.id.split('.').at(-1)?.toUpperCase()}
                </span>
            </div>
            <strong className="card-face__name">{card.name}</strong>
            {!compact && (
                <p className="card-face__text">
                    {card.text || '以纯粹的力量占据战场。'}
                </p>
            )}
            <div className="card-face__bottom">
                <span>{SCHOOL_NAMES[card.school] ?? '怪物'}</span>
                <span>
                    {statuses.length
                        ? statuses.join(' · ')
                        : `负荷 ${card.load}`}
                </span>
            </div>
        </div>
    )
}
