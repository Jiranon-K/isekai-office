import { Component, Suspense } from 'react'

type DeferredProps = { children: React.ReactNode }

class LoadBoundary extends Component<DeferredProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render(): React.ReactNode {
    return this.state.failed ? null : this.props.children
  }
}

export function Deferred({ children }: DeferredProps): React.JSX.Element {
  return (
    <LoadBoundary>
      <Suspense fallback={null}>{children}</Suspense>
    </LoadBoundary>
  )
}
