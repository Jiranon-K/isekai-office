import { Component, Suspense } from 'react'
import { useEscapeLayer } from '@/components/escape-layer'
import { LoadFailure, type LoadFailureProps } from '@/components/load-failure'

type DeferredProps = LoadFailureProps & { children: React.ReactNode }

class LoadBoundary extends Component<DeferredProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render(): React.ReactNode {
    const { children, ...failure } = this.props
    return this.state.failed ? <LoadFailure {...failure} /> : children
  }
}

function CancelWhileLoading({ onCancel }: { onCancel(): void }): null {
  useEscapeLayer(onCancel)
  return null
}

export function Deferred({ children, ...failure }: DeferredProps): React.JSX.Element {
  return (
    <LoadBoundary {...failure}>
      <Suspense fallback={<CancelWhileLoading onCancel={failure.onClose} />}>{children}</Suspense>
    </LoadBoundary>
  )
}
