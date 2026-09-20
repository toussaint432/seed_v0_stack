import { useEffect, useState } from 'react'
import { Clock, RefreshCw, CheckCircle2, Package, ShoppingCart, XCircle, ArrowRight } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'

interface AuditEntry {
  id: number
  actionType: string
  description: string
  entityRef: string | null
  createdAt: string
}

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  COMMANDE_SOUMISE:        { icon: <ShoppingCart  size={12} />, color: '#1d4ed8', bg: '#eff6ff' },
  COMMANDE_ACCEPTEE:       { icon: <CheckCircle2  size={12} />, color: '#15803d', bg: '#f0fdf4' },
  COMMANDE_EN_PREPARATION: { icon: <Package       size={12} />, color: '#92660a', bg: '#fefce8' },
  COMMANDE_LIVREE:         { icon: <ArrowRight    size={12} />, color: '#0f766e', bg: '#f0fdfa' },
  COMMANDE_ANNULEE:        { icon: <XCircle       size={12} />, color: '#dc2626', bg: '#fef2f2' },
  COMMANDE_REJETEE:        { icon: <XCircle       size={12} />, color: '#dc2626', bg: '#fef2f2' },
}

function getConfig(actionType: string) {
  return ACTION_CONFIG[actionType] ?? {
    icon: <Clock size={12} />,
    color: '#6b7280',
    bg: '#f9fafb',
  }
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return "à l'instant"
  if (mins < 60)  return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours} h`
  if (days < 7)   return `il y a ${days} j`
  return new Date(isoDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function RecentActivity() {
  const [entries, setEntries]     = useState<AuditEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      const res = await api.get(endpoints.auditMonActivite)
      const list: AuditEntry[] = Array.isArray(res.data) ? res.data : []
      setEntries(list.slice(0, 5))
    } catch {
      setEntries([])
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return null

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      marginBottom: 20,
    }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 9,
        background: 'linear-gradient(135deg,var(--surface-2) 0%,#fff 100%)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: '#f8fafc', color: '#475569',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Clock size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Activité récente</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Vos 5 dernières actions</div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          title="Actualiser"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 26, height: 26, borderRadius: 6, cursor: refreshing ? 'default' : 'pointer',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-muted)', opacity: refreshing ? 0.5 : 1,
          }}
        >
          <RefreshCw size={11} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: '18px', textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
          Aucune activité enregistrée
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {entries.map((e, idx) => {
            const cfg = getConfig(e.actionType)
            return (
              <li key={e.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 18px',
                borderBottom: idx < entries.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: cfg.bg, color: cfg.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>
                  {cfg.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {e.description}
                  </div>
                  {e.entityRef && (
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}>
                      {e.entityRef}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
                  {timeAgo(e.createdAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
