import type { QuestCard } from '@shared/types'
import { Badge } from '@/components/badge'
import { loopStageLabel } from '@/board/board-logic'
import { ExternalLinkIcon, MergeIcon } from '@/components/icons'

const LINK = 'focus-ring inline-flex items-center gap-1 rounded-sm text-caption text-primary underline-offset-4 hover:underline'

function MergeRequestLink({ url }: { url: string }): React.JSX.Element {
  return (
    <a href={url} target="_blank" rel="noreferrer" className={LINK}>
      <MergeIcon className="size-3" />
      MR
    </a>
  )
}

function CardRow({ card }: { card: QuestCard }): React.JSX.Element {
  const mergeRequest = card.mergeRequest?.url ?? card.loop?.mr ?? null
  return (
    <li className="flex flex-col gap-1 rounded-md px-2 py-1.5">
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-small font-medium">{card.title}</span>
        {card.loop ? <Badge variant="muted">{loopStageLabel(card.loop.status)}</Badge> : null}
      </span>
      <span className="flex items-center gap-3">
        <a href={card.url} target="_blank" rel="noreferrer" className={LINK}>
          <ExternalLinkIcon className="size-3" />
          {card.key ?? 'เปิดการ์ด'}
        </a>
        {mergeRequest ? <MergeRequestLink url={mergeRequest} /> : null}
      </span>
    </li>
  )
}

export function CardRows({ cards, label }: { cards: QuestCard[]; label: string }): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-1" aria-label={label}>
      {cards.map((card) => (
        <CardRow key={card.id} card={card} />
      ))}
    </ul>
  )
}
