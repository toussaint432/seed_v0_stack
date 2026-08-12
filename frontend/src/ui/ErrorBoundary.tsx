import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f2f5f2', fontFamily: 'system-ui, sans-serif', padding: 32,
      }}>
        <div style={{
          maxWidth: 520, background: '#fff', borderRadius: 12,
          border: '1px solid #e3e8e3', padding: '32px 36px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', color: '#0d1f11', fontSize: '1.1rem' }}>
            Une erreur inattendue est survenue
          </h2>
          <p style={{ color: '#7a9280', fontSize: '0.85rem', margin: '0 0 20px' }}>
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#16a34a', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 20px', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600,
            }}
          >
            Recharger la page
          </button>
        </div>
      </div>
    )
  }
}
