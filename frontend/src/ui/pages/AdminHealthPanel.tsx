import { useEffect, useState, useCallback } from 'react'
import { Activity, RefreshCw, CheckCircle, XCircle, Loader, Clock } from 'lucide-react'
import { endpoints } from '../../lib/endpoints'

type ServiceId = 'catalog' | 'lot' | 'stock' | 'order'
type ServiceStatus = 'UP' | 'DOWN' | 'UNKNOWN' | 'LOADING'

interface ServiceHealth {
  status: ServiceStatus
  responseMs?: number
  checkedAt?: Date
}

const SERVICES: { id: ServiceId; label: string; desc: string }[] = [
  { id: 'catalog', label: 'Catalog Service', desc: 'Espèces & variétés' },
  { id: 'lot',     label: 'Lot Service',     desc: 'Lots & campagnes' },
  { id: 'stock',   label: 'Stock Service',   desc: 'Stocks & sites' },
  { id: 'order',   label: 'Order Service',   desc: 'Commandes & orgs' },
]

const EMPTY: Record<ServiceId, ServiceHealth> = {
  catalog: { status: 'LOADING' },
  lot:     { status: 'LOADING' },
  stock:   { status: 'LOADING' },
  order:   { status: 'LOADING' },
}

async function checkService(id: ServiceId): Promise<ServiceHealth> {
  const t0 = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(endpoints.health[id], { signal: ctrl.signal })
    clearTimeout(timer)
    const ms = Date.now() - t0
    if (!res.ok) return { status: 'DOWN', responseMs: ms, checkedAt: new Date() }
    const data = await res.json()
    return {
      status: data.status === 'UP' ? 'UP' : 'DOWN',
      responseMs: ms,
      checkedAt: new Date(),
    }
  } catch {
    clearTimeout(timer)
    return { status: 'DOWN', responseMs: Date.now() - t0, checkedAt: new Date() }
  }
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'LOADING') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
      <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Vérification…
    </span>
  )
  if (status === 'UP') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#15803d' }}>
      <CheckCircle size={13} /> UP
    </span>
  )
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
      <XCircle size={13} /> DOWN
    </span>
  )
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function AdminHealthPanel() {
  const [health, setHealth] = useState<Record<ServiceId, ServiceHealth>>(EMPTY)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const checkAll = useCallback(async () => {
    setRefreshing(true)
    const results = await Promise.all(SERVICES.map(s => checkService(s.id)))
    const next = Object.fromEntries(SERVICES.map((s, i) => [s.id, results[i]])) as Record<ServiceId, ServiceHealth>
    setHealth(next)
    setLastRefresh(new Date())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    checkAll()
    const id = setInterval(checkAll, 30_000)
    return () => clearInterval(id)
  }, [checkAll])

  const upCount   = SERVICES.filter(s => health[s.id]?.status === 'UP').length
  const downCount = SERVICES.filter(s => health[s.id]?.status === 'DOWN').length
  const allUp     = upCount === SERVICES.length
  const anyDown   = downCount > 0

  const summaryColor = allUp ? '#15803d' : anyDown ? '#dc2626' : '#6b7280'
  const summaryBg    = allUp ? '#f0fdf4' : anyDown ? '#fef2f2' : '#f9fafb'
  const summaryBorder= allUp ? '#bbf7d0' : anyDown ? '#fecaca' : '#e5e7eb'

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      marginBottom: 20,
    }}>
      {/* En-tête */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'linear-gradient(135deg,var(--surface-2) 0%,#fff 100%)',
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: '#f5f3ff', color: '#7c3aed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Activity size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Santé des services
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
            Surveillance en temps réel · actualisation toutes les 30 s
          </div>
        </div>

        {/* Badge résumé */}
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: summaryColor, background: summaryBg,
          border: `1px solid ${summaryBorder}`,
          borderRadius: 99, padding: '3px 10px', flexShrink: 0,
        }}>
          {upCount}/{SERVICES.length} UP
        </span>

        {/* Bouton refresh */}
        <button
          onClick={checkAll}
          disabled={refreshing}
          title="Actualiser maintenant"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 7, cursor: refreshing ? 'default' : 'pointer',
            border: '1px solid #ddd6fe', background: '#faf5ff',
            fontSize: 11, fontWeight: 600, color: '#7c3aed',
            opacity: refreshing ? 0.6 : 1, flexShrink: 0,
          }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* Grille des services */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 0,
      }}>
        {SERVICES.map((svc, idx) => {
          const h = health[svc.id]
          const isUp   = h.status === 'UP'
          const isDown = h.status === 'DOWN'
          const cardBorder = idx < SERVICES.length - 1 ? '1px solid var(--border)' : 'none'

          return (
            <div
              key={svc.id}
              style={{
                padding: '14px 18px',
                borderRight: (idx + 1) % 4 !== 0 ? '1px solid var(--border)' : 'none',
                borderBottom: idx < 2 && window.innerWidth > 900 ? 'none' : cardBorder,
                background: isDown ? '#fffbfb' : isUp ? '#fafffe' : '#fafafa',
                transition: 'background 0.3s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {svc.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                    {svc.desc}
                  </div>
                </div>
                <StatusBadge status={h.status} />
              </div>

              {/* Métriques */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
                {h.responseMs !== undefined && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 10.5, color: h.responseMs > 1000 ? '#d97706' : '#6b7280',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    <Clock size={10} />
                    {h.responseMs} ms
                  </span>
                )}
                {h.checkedAt && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {fmtTime(h.checkedAt)}
                  </span>
                )}
              </div>

              {/* Barre de latence */}
              {h.responseMs !== undefined && (
                <div style={{
                  marginTop: 8, height: 3, borderRadius: 99,
                  background: '#f3f4f6', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${Math.min(100, (h.responseMs / 2000) * 100)}%`,
                    background: h.responseMs > 1000 ? '#d97706' : isUp ? '#16a34a' : '#dc2626',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pied — dernière vérification */}
      {lastRefresh && (
        <div style={{
          padding: '8px 20px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10.5, color: 'var(--text-muted)',
        }}>
          <Clock size={10} />
          Dernière vérification : {fmtTime(lastRefresh)}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
