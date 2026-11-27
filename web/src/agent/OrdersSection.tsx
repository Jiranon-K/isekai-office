import { LIST_LABELS, SCOPE_LABELS, type RuleList, type StandingOrders } from '@shared/orders'
import { useState } from 'react'
import { Badge } from '@/components/badge'
import { XIcon } from '@/components/icons'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { OrderForm } from './OrderForm'
import { canEdit, canRemove, describeLayerError, describeOrderError, entriesFor, SCOPE_FILES, type RuleEntry } from './orders-logic'
import { useOrders } from './use-orders'

const SHOWN_LISTS: RuleList[] = ['allow', 'deny', 'ask']

type RuleRowProps = { entry: RuleEntry; removable: boolean; onRemove(): void }

function RuleRow({ entry, removable, onRemove }: RuleRowProps): React.JSX.Element {
  return (
    <li className="flex items-center gap-2 rounded-md bg-muted px-2 py-1">
      <code className="min-w-0 flex-1 text-caption break-all">{entry.rule}</code>
      <Badge variant={entry.scope === 'local' ? 'green' : 'outline'} title={SCOPE_FILES[entry.scope]}>
        {SCOPE_LABELS[entry.scope]}
      </Badge>
      {removable ? (
        <Button variant="ghost" size="icon-sm" aria-label={`ลบกฎ ${entry.rule}`} onClick={onRemove}>
          <XIcon />
        </Button>
      ) : null}
    </li>
  )
}

function LayerNotices({ orders }: { orders: StandingOrders }): React.JSX.Element {
  return (
    <>
      {orders.layers.map((layer) => {
        const message = describeLayerError(layer.error)
        return message ? (
          <p key={layer.scope} role="alert" className="text-small text-destructive">
            {SCOPE_LABELS[layer.scope]}: {message} ({SCOPE_FILES[layer.scope]})
          </p>
        ) : null
      })}
    </>
  )
}

function RuleGroup({ list, orders, onRemove }: { list: RuleList; orders: StandingOrders; onRemove(list: 'allow' | 'deny', rule: string): void }): React.JSX.Element | null {
  const entries = entriesFor(orders.layers, list)
  if (entries.length === 0 && list === 'ask') {
    return null
  }
  return (
    <section aria-label={LIST_LABELS[list]} className="flex flex-col gap-1">
      <h3 className="text-small font-medium">{LIST_LABELS[list]}</h3>
      {entries.length === 0 ? <p className="text-small text-muted-foreground">ยังไม่มีกฎ</p> : null}
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <RuleRow
            key={`${entry.scope}:${entry.rule}`}
            entry={entry}
            removable={list !== 'ask' && canRemove(entry, orders)}
            onRemove={() => list !== 'ask' && onRemove(list, entry.rule)}
          />
        ))}
      </ul>
    </section>
  )
}

function Pane({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">{children}</div>
}

export function OrdersSection({ agentId }: { agentId: string }): React.JSX.Element {
  const orders = useOrders(agentId)
  const [failure, setFailure] = useState<string | null>(null)
  if (orders.error && !orders.data) {
    return (
      <Pane>
        <p role="alert" className="text-small text-destructive">อ่านคำสั่งประจำไม่ได้</p>
      </Pane>
    )
  }
  if (!orders.data) {
    return (
      <Pane>
        <Spinner />
      </Pane>
    )
  }
  const data = orders.data
  async function remove(list: 'allow' | 'deny', rule: string): Promise<void> {
    setFailure(await orders.change({ op: 'remove', list, rule }))
  }
  return (
    <Pane>
      <p className="text-small text-muted-foreground">กฎที่ Claude Code ใช้กับ worktree นี้ แก้ได้เฉพาะ worktree นี้ ส่วนอื่นต้องแก้ที่ไฟล์</p>
      <LayerNotices orders={data} />
      {SHOWN_LISTS.map((list) => (
        <RuleGroup key={list} list={list} orders={data} onRemove={(from, rule) => void remove(from, rule)} />
      ))}
      {failure ? <p role="alert" className="text-small text-destructive">{describeOrderError(failure)}</p> : null}
      <OrderForm
        disabled={!canEdit(data)}
        onAdd={(draft) => orders.change({ op: 'add', list: draft.list, rule: draft.rule })}
      />
    </Pane>
  )
}
