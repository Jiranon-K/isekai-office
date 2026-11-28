import { Component, Suspense } from 'react'
import { useEscapeLayer } from '@/components/escape-layer'
import { LoadFailure, type LoadFailureProps } from '@/components/load-failure'

type DeferredProps = LoadFailureProps & { subject?: string; children: React.ReactNode }

class LoadBoundary extends Component<DeferredProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render(): React.ReactNode {
    const { children, subject, ...failure } = this.props
    return this.state.failed ? <LoadFailure key={subject} {...failure} /> : children
  }
}

function CancelWhileLoading({ onCancel }: { onCancel(): void }): null {
  useEscapeLayer(onCancel)
  return null
}

export function Deferred({ children, ...props }: DeferredProps): React.JSX.Element {
  return (
    <LoadBoundary {...props}>
      <Suspense fallback={<CancelWhileLoading onCancel={props.onClose} />}>{children}</Suspense>
    </LoadBoundary>
  )
}
