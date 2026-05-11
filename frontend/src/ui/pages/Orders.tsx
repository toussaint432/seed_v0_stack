import React, { useEffect, useState, useMemo } from 'react'
import {
  ShoppingCart, RefreshCw, Plus, Settings2, Clock, XCircle, PackageCheck,
  Search, X, ChevronLeft, ChevronRight, CheckCircle2, Ban, Eye, Building2,
  TrendingUp, TrendingDown, BarChart2, Truck, Receipt,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

// ─── Statuts ─────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  SOUMISE:        { label: 'Soumise',        bg: '#eff6ff', color: '#1d4ed8' },
  ACCEPTEE:       { label: 'Acceptée',       bg: '#f0fdf4', color: '#15803d' },
  CONFIRMEE:      { label: 'Confirmée',      bg: '#f0fdf4', color: '#15803d' },
  EN_PREPARATION: { label: 'En préparation', bg: '#fef9ed', color: '#92660a' },
  LIVREE:         { label: 'Livrée',         bg: '#ecfdf5', color: '#065f46' },
  ANNULEE:        { label: 'Annulée',        bg: '#fef2f2', color: '#dc2626' },
  REJETEE:        { label: 'Rejetée',        bg: '#fef2f2', color: '#dc2626' },
  ALLOUEE:        { label: 'Allouée',        bg: '#fdf4ff', color: '#7e22ce' },
  PENDING:        { label: 'En attente',     bg: '#fef9ed', color: '#92660a' },
  EN_ATTENTE:     { label: 'En attente',     bg: '#fef9ed', color: '#92660a' },
  CONFIRMED:      { label: 'Confirmée',      bg: '#f0fdf4', color: '#15803d' },
  ALLOCATED:      { label: 'Allouée',        bg: '#fdf4ff', color: '#7e22ce' },
  CANCELLED:      { label: 'Annulée',        bg: '#fef2f2', color: '#dc2626' },
}
const PAGE_SIZE = 10
const PIPELINE_STEPS = [
  { key: 'SOUMISE',        label: 'Soumise' },
  { key: 'ACCEPTEE',       label: 'Acceptée' },
  { key: 'EN_PREPARATION', label: 'En préparation' },
  { key: 'LIVREE',         label: 'Livrée' },
]
const PIPELINE_IDX: Record<string, number> = {
  SOUMISE: 0, ACCEPTEE: 1, CONFIRMEE: 1, EN_PREPARATION: 2, LIVREE: 3,
}
const TERMINAL = ['ANNULEE', 'REJETEE', 'CANCELLED']
const NEXT_ACTIONS: Record<string, { statut: string; label: string; danger?: boolean }[]> = {
  SOUMISE:        [{ statut: 'ACCEPTEE',       label: 'Accepter'           }, { statut: 'REJETEE',  label: 'Rejeter',  danger: true }],
  ACCEPTEE:       [{ statut: 'EN_PREPARATION', label: 'Démarrer préparation' }, { statut: 'ANNULEE', label: 'Annuler', danger: true }],
  CONFIRMEE:      [{ statut: 'EN_PREPARATION', label: 'Démarrer préparation' }, { statut: 'ANNULEE', label: 'Annuler', danger: true }],
  EN_PREPARATION: [{ statut: 'LIVREE',         label: 'Marquer livrée'    }, { statut: 'ANNULEE',  label: 'Annuler',  danger: true }],
}
const GENERATIONS_CMD = [
  { id: '1', label: 'G0 — Pré-base' }, { id: '2', label: 'G1 — Base' },
  { id: '3', label: 'G2 — R1' },       { id: '4', label: 'G3 — R2' },
  { id: '5', label: 'G4 — R3' },       { id: '6', label: 'R1' },
  { id: '7', label: 'R2 — Certifiée' },
]

// KPI filter predicates
type KpiKey = 'pending' | 'accepted' | 'rejected' | 'delivered'
const KPI_FILTER: Record<KpiKey, (o: any) => boolean> = {
  pending:   o => ['SOUMISE','PENDING','EN_ATTENTE'].includes(o.statut),
  accepted:  o => ['ACCEPTEE','CONFIRMEE','ALLOUEE','ALLOCATED','EN_PREPARATION'].includes(o.statut),
  rejected:  o => ['ANNULEE','REJETEE','CANCELLED'].includes(o.statut),
  delivered: o => o.statut === 'LIVREE',
}

// ─── Helper : calcul mensuel pour le graphe ───────────────────────────────────
function computeMonthly(orders: any[]) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = d.toLocaleDateString('fr-FR', { month: 'short' })
    const count = orders.filter(o => {
      if (!o.createdAt) return false
      const od = new Date(o.createdAt)
      return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth()
    }).length
    const isCurrent = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return { label, count, isCurrent }
  })
}

// ─── Composants partagés ──────────────────────────────────────────────────────

function StatusBadge({ statut }: { statut: string }) {
  const cfg = STATUS_CFG[statut]
  return cfg
    ? <span className="badge" style={{ background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
    : <span className="badge badge-gray">{statut || '—'}</span>
}

// KPI card cliquable — agit comme filtre sur le tableau
interface KpiProps {
  icon: React.ReactNode; value: number | string; label: string
  accent: string; active?: boolean; onClick?: () => void; loading?: boolean
}
function KpiCard({ icon, value, label, accent, active, onClick, loading }: KpiProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${accent}0e` : 'var(--surface)',
        border: `${active ? 2 : 1}px solid ${active ? accent : 'var(--border)'}`,
        borderRadius: 14, padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s, box-shadow .15s, background .15s',
        boxShadow: active ? `0 0 0 4px ${accent}1a` : '0 1px 4px rgba(0,0,0,.04)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Barre accent gauche */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent, borderRadius: '14px 0 0 14px' }} />
      <div style={{ marginLeft: 4, width: 44, height: 44, borderRadius: 12, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {loading ? <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>…</span> : value}
        </div>
        <div style={{ fontSize: 12.5, color: active ? accent : 'var(--text-muted)', fontWeight: active ? 600 : 400, marginTop: 4 }}>
          {label}
        </div>
      </div>
      {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0, boxShadow: `0 0 0 3px ${accent}33` }} />}
    </div>
  )
}

// Graphe d'évolution — 6 derniers mois
function EvolutionChart({ orders }: { orders: any[] }) {
  const data = useMemo(() => computeMonthly(orders), [orders])
  const max  = Math.max(...data.map(d => d.count), 1)
  const last = data[data.length - 1].count
  const prev = data[data.length - 2].count
  const trend = last - prev
  const BAR_W = 44, GAP = 14, H = 72
  const W = data.length * BAR_W + (data.length - 1) * GAP

  return (
    <div className="card" style={{ padding: '16px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={15} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>
            Évolution des commandes — 6 mois
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {trend !== 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {trend > 0 ? <TrendingUp size={13} color="#22c55e" /> : <TrendingDown size={13} color="#ef4444" />}
              <span style={{ fontSize: 12, fontWeight: 700, color: trend > 0 ? '#22c55e' : '#ef4444' }}>
                {trend > 0 ? '+' : ''}{trend} ce mois
              </span>
            </div>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total : <strong>{orders.length}</strong></span>
        </div>
      </div>
      <svg width="100%" viewBox={`-4 -14 ${W + 8} ${H + 28}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        {data.map((d, i) => {
          const barH  = max > 0 ? Math.max(Math.round((d.count / max) * H), d.count > 0 ? 5 : 2) : 2
          const x     = i * (BAR_W + GAP)
          const y     = H - barH
          const fill  = d.isCurrent ? '#16a34a' : '#86efac'
          const tFill = d.isCurrent ? '#166534' : 'var(--text-muted)'
          return (
            <g key={i}>
              {/* fond de barre */}
              <rect x={x} y={0} width={BAR_W} height={H} rx={6} fill="var(--surface-2,#f1f5f9)" />
              {/* barre valeur */}
              <rect x={x} y={y} width={BAR_W} height={barH} rx={6} fill={fill} opacity={0.9} />
              {d.count > 0 && (
                <text x={x + BAR_W / 2} y={y - 5} textAnchor="middle" fontSize={9.5} fontWeight="700" fill={tFill}>
                  {d.count}
                </text>
              )}
              <text x={x + BAR_W / 2} y={H + 15} textAnchor="middle" fontSize={9.5} fill={tFill} fontWeight={d.isCurrent ? '700' : '400'}>
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Pipeline progression statut
function StatusPipeline({ statut }: { statut: string }) {
  const isTerminal = TERMINAL.includes(statut)
  const idx = PIPELINE_IDX[statut] ?? (isTerminal ? -1 : -1)
  return (
    <div style={{ margin: '14px 0 18px', padding: '14px 12px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Progression de la commande</div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {PIPELINE_STEPS.flatMap((step, i) => {
          const done    = !isTerminal && idx > i
          const current = !isTerminal && idx === i
          return [
            <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, zIndex: 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: done ? 14 : 11, fontWeight: 700, background: done ? '#dcfce7' : current ? '#16a34a' : '#f1f5f9', color: done ? '#15803d' : current ? 'white' : '#94a3b8', border: `2px solid ${done ? '#86efac' : current ? '#16a34a' : '#e2e8f0'}`, transition: 'all .2s' }}>
                {done ? '✓' : current ? '●' : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: current ? 700 : 500, color: current ? '#15803d' : done ? '#16a34a' : '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>{step.label}</span>
            </div>,
            i < PIPELINE_STEPS.length - 1
              ? <div key={step.key + '-c'} style={{ flex: '0 0 12px', height: 2, background: done ? '#86efac' : '#e2e8f0', marginTop: 13 }} />
              : null,
          ].filter(Boolean)
        })}
      </div>
      {isTerminal && (
        <div style={{ marginTop: 10, padding: '7px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
          <XCircle size={13} /> {STATUS_CFG[statut]?.label ?? statut} — Commande clôturée
        </div>
      )}
    </div>
  )
}

// Tableau générique avec pagination + modal détail
interface OrderTableProps {
  orders: any[]; loading: boolean; emptyMsg: string
  orgs?: any[]; varieties?: any[]
  onUpdateStatus?: (id: number, statut: string) => Promise<void>
  extraColumns?: { head: string; cell: (o: any) => React.ReactNode }[]
}
function OrderTable({ orders, loading, emptyMsg, orgs = [], varieties = [], onUpdateStatus, extraColumns = [] }: OrderTableProps) {
  const [page, setPage]     = useState(1)
  const [detail, setDetail] = useState<any>(null)
  const [actioning, setActioning] = useState(false)
  const total = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
  const slice = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const colCount = 5 + extraColumns.length + (onUpdateStatus ? 1 : 0) + 1

  const orgName = (id: number | null) => {
    if (!id) return '—'
    const f = orgs.find((o: any) => o.id === id)
    return f ? f.nomOrganisation : `#${id}`
  }
  const handleAction = async (statut: string) => {
    if (!detail || !onUpdateStatus) return
    setActioning(true)
    try { await onUpdateStatus(detail.id, statut); setDetail((d: any) => d ? { ...d, statut } : null) }
    finally { setActioning(false) }
  }
  const nextActions = detail ? (NEXT_ACTIONS[detail.statut] ?? []) : []

  return (
    <>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Code commande</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Fournisseur</th>
              {extraColumns.map(c => <th key={c.head}>{c.head}</th>)}
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [0,1,2,3].map(i => <tr key={i}><td colSpan={colCount}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
              : orders.length === 0
                ? <tr><td colSpan={colCount}><div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-icon"><ShoppingCart size={20} /></div><div className="empty-title">{emptyMsg}</div></div></td></tr>
                : slice.map(o => (
                  <tr key={o.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                    <td style={{ fontWeight: 500 }}>{o.client || '—'}</td>
                    <td><StatusBadge statut={o.statut} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{orgName(o.idOrganisationFournisseur)}</td>
                    {extraColumns.map(c => <td key={c.head}>{c.cell(o)}</td>)}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                    <td><button className="btn btn-ghost btn-icon" style={{ width: 30, height: 30 }} onClick={() => setDetail(o)}><Eye size={13} /></button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      {!loading && orders.length > PAGE_SIZE && (
        <div className="pagination">
          <span className="pagination-info">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, orders.length)} sur {orders.length}</span>
          <div className="pagination-btns">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></button>
            {Array.from({ length: Math.min(total,5) }, (_,i) => i+1).map(n => (
              <button key={n} className={"page-btn " + (page===n?'active':'')} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="page-btn" onClick={() => setPage(p => Math.min(total,p+1))} disabled={page===total}><ChevronRight size={13} /></button>
          </div>
        </div>
      )}

      {detail && (
        <Modal
          title={`Commande — ${detail.codeCommande}`}
          subtitle={`${detail.usernameAcheteur || '—'} · ${detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('fr-FR') : ''}`}
          onClose={() => setDetail(null)} size="md"
        >
          <StatusPipeline statut={detail.statut} />
          <div style={{ display: 'grid', gap: 8, fontSize: 13, marginBottom: 16 }}>
            {([
              ['Client',          detail.client || '—'],
              ['Fournisseur',     orgName(detail.idOrganisationFournisseur)],
              ['Org acheteur',    orgName(detail.idOrganisationAcheteur)],
              ['Observations',    detail.observations || '—'],
            ] as [string,string][]).map(([k,v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span style={{ minWidth: 120, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</span>
                <span style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
          {Array.isArray(detail.lignes) && detail.lignes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Lignes ({detail.lignes.length})
              </div>
              <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Variété','Génération','Quantité'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Quantité' ? 'right' : 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.lignes.map((l: any, i: number) => {
                    const v = varieties.find((vv: any) => vv.id === l.idVariete)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                          {v ? v.nomVariete : `Variété #${l.idVariete}`}
                          {v && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 5 }}>({v.codeVariete})</span>}
                        </td>
                        <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>
                          {l.idGeneration === 7 ? 'R2 — Certifiée' : l.idGeneration === 6 ? 'R1' : `Gén. #${l.idGeneration}`}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{l.quantiteDemandee} {l.unite}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {onUpdateStatus && nextActions.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Action :</span>
              {nextActions.map(a => (
                <button
                  key={a.statut}
                  className={`btn ${a.danger ? 'btn-ghost' : 'btn-primary'}`}
                  style={a.danger ? { color: 'var(--red-600)', border: '1px solid #fecaca', height: 32, fontSize: 12 } : { height: 32, fontSize: 12 }}
                  onClick={() => handleAction(a.statut)}
                  disabled={actioning}
                >
                  {a.danger ? <Ban size={12} /> : <CheckCircle2 size={12} />} {a.label}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VUE QUOTATAIRE
   ══════════════════════════════════════════════════════════════════════════════ */
function VueQuotataire({ setToast }: { setToast: any }) {
  const [orders,    setOrders]    = useState<any[]>([])
  const [orgs,      setOrgs]      = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [kpiFilter, setKpiFilter] = useState<KpiKey | null>(null)
  const [search,    setSearch]    = useState('')

  const [form, setForm] = useState({
    idOrganisationFournisseur: '',
    observations: '',
    lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }],
  })

  async function fetchAll() {
    setLoading(true)
    const [ordRes, orgRes, varRes] = await Promise.allSettled([
      api.get(endpoints.ordersMesCommandes),
      api.get(endpoints.organisations),
      api.get(endpoints.varieties),
    ])
    setOrders(ordRes.status === 'fulfilled' ? ordRes.value.data : [])
    if (orgRes.status === 'fulfilled')
      setOrgs(orgRes.value.data.filter((o: any) => o.typeOrganisation?.toLowerCase().includes('multiplic') && o.active !== false))
    if (varRes.status === 'fulfilled')
      setVarieties(varRes.value.data.filter((v: any) => v.statutVariete === 'DIFFUSEE'))
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  function addLigne()                             { setForm(f => ({ ...f, lignes: [...f.lignes, { idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] })) }
  function removeLigne(i: number)                 { setForm(f => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) })) }
  function updateLigne(i: number, k: string, v: string) { setForm(f => ({ ...f, lignes: f.lignes.map((l, j) => j === i ? { ...l, [k]: v } : l) })) }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const code = 'CMD-' + Date.now().toString(36).toUpperCase()
      await api.post(endpoints.orders, {
        codeCommande: code, client: 'Commande portail',
        idOrganisationFournisseur: form.idOrganisationFournisseur ? Number(form.idOrganisationFournisseur) : null,
        observations: form.observations || null,
        lignes: form.lignes.map(l => ({ idVariete: Number(l.idVariete), idGeneration: Number(l.idGeneration), quantite: Number(l.quantite), unite: l.unite })),
      })
      setToast({ msg: `Commande ${code} soumise`, type: 'success' })
      setShowForm(false)
      setForm({ idOrganisationFournisseur: '', observations: '', lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  const pending   = orders.filter(o => ['SOUMISE','EN_ATTENTE'].includes(o.statut)).length
  const confirmed = orders.filter(o => ['CONFIRMEE','ACCEPTEE'].includes(o.statut)).length
  const cancelled = orders.filter(o => ['ANNULEE','CANCELLED'].includes(o.statut)).length
  const delivered = orders.filter(o => o.statut === 'LIVREE').length

  const toggleKpi = (k: KpiKey) => setKpiFilter(kpiFilter === k ? null : k)

  const displayed = orders.filter(o => {
    const matchKpi    = !kpiFilter || KPI_FILTER[kpiFilter](o)
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    return matchKpi && matchSearch
  })

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard icon={<ShoppingCart size={20} />}  value={orders.length}  label="Mes commandes"  accent="#3b82f6" loading={loading} />
        <KpiCard icon={<Clock size={20} />}          value={pending}        label="En attente"     accent="#f59e0b" active={kpiFilter === 'pending'}   onClick={() => toggleKpi('pending')}   loading={loading} />
        <KpiCard icon={<PackageCheck size={20} />}   value={confirmed}      label="Confirmées"     accent="#22c55e" active={kpiFilter === 'accepted'}   onClick={() => toggleKpi('accepted')}  loading={loading} />
        <KpiCard icon={<Truck size={20} />}          value={delivered}      label="Livrées"        accent="#10b981" active={kpiFilter === 'delivered'}  onClick={() => toggleKpi('delivered')} loading={loading} />
      </div>

      {/* Graphe évolution */}
      {!loading && <EvolutionChart orders={orders} />}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Receipt size={15} /></span>
            Mes commandes
            {kpiFilter && (
              <span style={{ marginLeft: 8, fontSize: 11, background: '#3b82f620', color: '#1d4ed8', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                Filtre actif
              </span>
            )}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{displayed.length}{displayed.length !== orders.length && `/${orders.length}`}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Nouvelle commande</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input placeholder="Code ou client…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer filtres</button>}
        </div>
        <OrderTable orders={displayed} loading={loading} emptyMsg="Aucune commande" orgs={orgs} varieties={varieties} />
      </div>

      {showForm && (
        <Modal title="Nouvelle Commande" subtitle="Soumettre une demande de semences certifiées" onClose={() => setShowForm(false)} size="lg">
          <form onSubmit={submitOrder}>
            <Field label="Organisation fournisseur" hint="Multiplicateur qui fournira les semences">
              <FormSelect value={form.idOrganisationFournisseur} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, idOrganisationFournisseur: e.target.value }))}>
                <option value="">— Choisir un fournisseur —</option>
                {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.nomOrganisation} ({o.region || o.localite || 'N/A'})</option>)}
              </FormSelect>
            </Field>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Lignes <span style={{ color: 'var(--red-500)' }}>*</span></label>
                <button type="button" className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={addLigne}><Plus size={11} /> Ajouter</button>
              </div>
              {form.lignes.map((ligne, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Ligne {i+1}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <Field label="Variété" required>
                      <FormSelect value={ligne.idVariete} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'idVariete',e.target.value)} required>
                        <option value="">— Variété —</option>
                        {Object.entries(
                          varieties.reduce((acc: Record<string,any[]>, v: any) => { const k = v.espece?.codeEspece||'Autre'; (acc[k]=acc[k]||[]).push(v); return acc }, {})
                        ).sort(([a],[b]) => a.localeCompare(b)).map(([esp, vs]) => (
                          <optgroup key={esp} label={esp}>
                            {(vs as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.nomVariete} ({v.codeVariete})</option>)}
                          </optgroup>
                        ))}
                      </FormSelect>
                    </Field>
                    <Field label="Génération" required>
                      <FormSelect value={ligne.idGeneration} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'idGeneration',e.target.value)}>
                        {GENERATIONS_CMD.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </FormSelect>
                    </Field>
                    <Field label="Quantité" required>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <FormInput type="number" value={ligne.quantite} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLigne(i,'quantite',e.target.value)} placeholder="500" min="1" required style={{ flex: 1 }} />
                        <FormSelect value={ligne.unite} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'unite',e.target.value)} style={{ width: 70 }}>
                          <option value="kg">kg</option><option value="t">t</option>
                        </FormSelect>
                      </div>
                    </Field>
                    {form.lignes.length > 1 && (
                      <button type="button" onClick={() => removeLigne(i)} style={{ height: 36, width: 36, background: 'var(--red-50)', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: 'var(--red-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}><X size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Field label="Observations">
              <textarea value={form.observations} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Précisions sur la commande…" rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setShowForm(false)} loading={saving} submitLabel="Soumettre la commande" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VUE MULTIPLICATEUR
   ══════════════════════════════════════════════════════════════════════════════ */
function VueMultiplicateur({ setToast }: { setToast: any }) {
  const [onglet,      setOnglet]      = useState<'recues'|'demandes'>('recues')
  const [recues,      setRecues]      = useState<any[]>([])
  const [demandes,    setDemandes]    = useState<any[]>([])
  const [loadingR,    setLoadingR]    = useState(true)
  const [loadingD,    setLoadingD]    = useState(true)
  const [kpiFilter,   setKpiFilter]   = useState<KpiKey | null>(null)
  const [search,      setSearch]      = useState('')
  const [refusModal,  setRefusModal]  = useState<{ id: number; code: string } | null>(null)
  const [motif,       setMotif]       = useState('')
  const [saving,      setSaving]      = useState(false)

  async function fetchAll() {
    setLoadingR(true); setLoadingD(true)
    const [rRes, dRes] = await Promise.allSettled([
      api.get(endpoints.ordersATraiter),
      api.get(endpoints.ordersMesDemandesG3),
    ])
    setRecues(rRes.status === 'fulfilled' ? rRes.value.data : [])
    setLoadingR(false)
    setDemandes(dRes.status === 'fulfilled' ? dRes.value.data : [])
    setLoadingD(false)
  }
  useEffect(() => { fetchAll() }, [])

  async function confirmer(id: number) {
    setSaving(true)
    try { await api.put(endpoints.orderStatut(id), { statut: 'ACCEPTEE' }); setToast({ msg: 'Commande acceptée', type: 'success' }); fetchAll() }
    catch { setToast({ msg: 'Erreur lors de la confirmation', type: 'error' }) }
    finally { setSaving(false) }
  }
  async function refuser(e: React.FormEvent) {
    e.preventDefault(); if (!refusModal) return; setSaving(true)
    try {
      await api.put(endpoints.orderStatut(refusModal.id), { statut: 'ANNULEE', observations: motif })
      setToast({ msg: `Commande ${refusModal.code} annulée`, type: 'success' })
      setRefusModal(null); setMotif(''); fetchAll()
    } catch { setToast({ msg: 'Erreur', type: 'error' }) }
    finally { setSaving(false) }
  }

  const activeOrders = onglet === 'recues' ? recues : demandes
  const loading      = onglet === 'recues' ? loadingR : loadingD

  const pendingCount   = recues.filter(o => o.statut === 'SOUMISE').length
  const confirmedCount = recues.filter(o => ['CONFIRMEE','ACCEPTEE'].includes(o.statut)).length
  const demandesTotal  = demandes.length
  const demandesAccept = demandes.filter(o => ['CONFIRMEE','ACCEPTEE','LIVREE'].includes(o.statut)).length

  const toggleKpi = (k: KpiKey) => { setKpiFilter(kpiFilter === k ? null : k); setSearch('') }

  const displayed = activeOrders.filter(o => {
    const matchKpi    = !kpiFilter || KPI_FILTER[kpiFilter](o)
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    return matchKpi && matchSearch
  })

  const tabBtn = (key: 'recues'|'demandes', icon: React.ReactNode, label: string, count: number) => (
    <button
      onClick={() => { setOnglet(key); setKpiFilter(null); setSearch('') }}
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: onglet === key ? 'var(--surface)' : 'transparent', color: onglet === key ? 'var(--green-700)' : 'var(--text-muted)', borderBottom: onglet === key ? '2px solid var(--green-600)' : '2px solid transparent', transition: 'all .15s' }}
    >
      {icon} {label}
      <span style={{ background: onglet === key ? 'var(--green-100)' : 'var(--surface-2)', color: onglet === key ? 'var(--green-700)' : 'var(--text-muted)', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{count}</span>
    </button>
  )

  return (
    <div>
      {/* KPI globaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard icon={<Building2 size={20} />}     value={recues.length}   label="Commandes reçues" accent="#3b82f6" loading={loadingR} />
        <KpiCard icon={<Clock size={20} />}          value={pendingCount}    label="À traiter"        accent="#f59e0b" active={kpiFilter === 'pending'}  onClick={() => toggleKpi('pending')}  loading={loadingR} />
        <KpiCard icon={<ShoppingCart size={20} />}   value={demandesTotal}   label="Mes demandes G3"  accent="#8b5cf6" loading={loadingD} />
        <KpiCard icon={<PackageCheck size={20} />}   value={demandesAccept}  label="Demandes acceptées" accent="#22c55e" active={kpiFilter === 'accepted'} onClick={() => toggleKpi('accepted')} loading={loadingD} />
      </div>

      {pendingCount > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#92400e', fontWeight: 500 }}>
          <Clock size={15} />
          <strong>{pendingCount} commande{pendingCount > 1 ? 's' : ''}</strong> en attente de votre décision.
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: '10px 10px 0 0', padding: '0 16px' }}>
        {tabBtn('recues',   <Building2 size={14} />,    'Commandes reçues',  recues.length)}
        {tabBtn('demandes', <ShoppingCart size={14} />, 'Mes demandes G3',   demandes.length)}
      </div>

      <div className="card" style={{ borderRadius: '0 0 var(--radius) var(--radius)', borderTop: 'none' }}>
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon">{onglet === 'recues' ? <Building2 size={15} /> : <ShoppingCart size={15} />}</span>
            {onglet === 'recues' ? 'Commandes de mon organisation' : "Mes demandes G3 auprès de l'UPSemCL"}
            {kpiFilter && <span style={{ marginLeft: 8, fontSize: 11, background: '#f59e0b20', color: '#92400e', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>Filtre actif</span>}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{displayed.length}{displayed.length !== activeOrders.length && `/${activeOrders.length}`}</span>
          </span>
          <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
        </div>

        {/* Graphe (contextualisé à l'onglet actif) */}
        {!loading && <div style={{ padding: '0 16px 0' }}><EvolutionChart orders={activeOrders} /></div>}

        {/* Barre de recherche */}
        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input placeholder="Code commande…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer</button>}
        </div>

        {/* Tableau commandes reçues */}
        {onglet === 'recues' && (
          <OrderTable
            orders={displayed}
            loading={loadingR}
            emptyMsg="Aucune commande reçue"
            extraColumns={[{
              head: 'Actions',
              cell: (o: any) => o.statut === 'SOUMISE' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px' }} onClick={() => confirmer(o.id)} disabled={saving}>
                    <CheckCircle2 size={11} /> Confirmer
                  </button>
                  <button className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 8px', color: 'var(--red-600)', border: '1px solid #fecaca' }} onClick={() => { setRefusModal({ id: o.id, code: o.codeCommande }); setMotif('') }} disabled={saving}>
                    <Ban size={11} />
                  </button>
                </div>
              ) : null,
            }]}
          />
        )}

        {/* Tableau mes demandes G3 */}
        {onglet === 'demandes' && (
          <OrderTable
            orders={displayed}
            loading={loadingD}
            emptyMsg="Aucune demande G3 — utilisez la page Lots pour en créer"
            extraColumns={[{
              head: 'Observations',
              cell: (o: any) => <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.observations || '—'}</span>,
            }]}
          />
        )}
      </div>

      {refusModal && (
        <Modal title="Annuler la commande" subtitle={`Commande ${refusModal.code}`} onClose={() => setRefusModal(null)} size="sm">
          <form onSubmit={refuser}>
            <Field label="Motif d'annulation" required hint="Visible par le demandeur">
              <textarea value={motif} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMotif(e.target.value)} placeholder="Stock insuffisant, variété indisponible…" rows={4} required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setRefusModal(null)} loading={saving} submitLabel="Confirmer l'annulation" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VUE UPSEMCL / SÉLECTIONNEUR
   ══════════════════════════════════════════════════════════════════════════════ */
function VueUpsemcl({ setToast, roleKey }: { setToast: any; roleKey: string }) {
  const [orders,    setOrders]    = useState<any[]>([])
  const [orgs,      setOrgs]      = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [kpiFilter, setKpiFilter] = useState<KpiKey | null>(null)
  const [search,    setSearch]    = useState('')
  const isUpsemcl = roleKey === 'seed-upsemcl'

  async function fetchAll() {
    setLoading(true)
    const [oRes, orgRes] = await Promise.allSettled([
      api.get(endpoints.ordersATraiter),
      api.get(endpoints.organisations),
    ])
    setOrders(oRes.status === 'fulfilled' ? oRes.value.data : [])
    setOrgs(orgRes.status === 'fulfilled' ? orgRes.value.data : [])
    setLoading(false)
  }
  async function handleUpdateStatus(id: number, statut: string) {
    await api.put(endpoints.orderStatut(id), { statut })
    setToast({ msg: `Commande → ${STATUS_CFG[statut]?.label ?? statut}`, type: 'success' })
    fetchAll()
  }
  useEffect(() => { fetchAll() }, [])

  const aTraiter  = orders.filter(o => o.statut === 'SOUMISE').length
  const acceptees = orders.filter(o => ['ACCEPTEE','CONFIRMEE','EN_PREPARATION'].includes(o.statut)).length
  const rejetees  = orders.filter(o => ['ANNULEE','REJETEE'].includes(o.statut)).length
  const livrees   = orders.filter(o => o.statut === 'LIVREE').length

  const toggleKpi = (k: KpiKey) => { setKpiFilter(kpiFilter === k ? null : k); setSearch('') }

  const displayed = orders.filter(o => {
    const matchKpi    = !kpiFilter || KPI_FILTER[kpiFilter](o)
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    return matchKpi && matchSearch
  })

  return (
    <div>
      {/* KPI cliquables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard icon={<ShoppingCart size={20} />}  value={orders.length} label="Total reçues"  accent="#3b82f6" loading={loading} onClick={() => setKpiFilter(null)} />
        <KpiCard icon={<Clock size={20} />}          value={aTraiter}      label="À traiter"     accent="#f59e0b" active={kpiFilter === 'pending'}   onClick={() => toggleKpi('pending')}   loading={loading} />
        <KpiCard icon={<PackageCheck size={20} />}   value={acceptees}     label="En cours"      accent="#22c55e" active={kpiFilter === 'accepted'}   onClick={() => toggleKpi('accepted')}  loading={loading} />
        <KpiCard icon={<XCircle size={20} />}        value={rejetees}      label="Rejetées"      accent="#ef4444" active={kpiFilter === 'rejected'}   onClick={() => toggleKpi('rejected')}  loading={loading} />
      </div>

      {aTraiter > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#92400e', fontWeight: 500 }}>
          <Clock size={15} />
          <strong>{aTraiter} commande{aTraiter > 1 ? 's' : ''}</strong> en attente de votre décision.
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, color: '#92400e', border: '1px solid #fde68a' }} onClick={() => toggleKpi('pending')}>
            Voir
          </button>
        </div>
      )}

      {/* Graphe */}
      {!loading && <EvolutionChart orders={orders} />}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Building2 size={15} /></span>
            {isUpsemcl ? 'Commandes des multiplicateurs' : 'Commandes reçues'}
            {kpiFilter && (
              <button className="btn btn-ghost" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', height: 22, color: '#f59e0b', border: '1px solid #fde68a' }} onClick={() => setKpiFilter(null)}>
                <X size={10} /> {STATUS_CFG[kpiFilter === 'pending' ? 'SOUMISE' : kpiFilter === 'accepted' ? 'ACCEPTEE' : kpiFilter === 'rejected' ? 'REJETEE' : 'LIVREE']?.label ?? kpiFilter}
              </button>
            )}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{displayed.length}{displayed.length !== orders.length && `/${orders.length}`}</span>
          </span>
          <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
        </div>

        {/* Recherche */}
        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              placeholder="Code commande ou client…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1 }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer</button>}
        </div>

        <OrderTable
          orders={displayed}
          loading={loading}
          emptyMsg={kpiFilter ? 'Aucune commande pour ce filtre' : 'Aucune commande reçue'}
          orgs={orgs}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>

      {/* Stat livrées discrète */}
      {!loading && livrees > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Truck size={13} /> <strong>{livrees}</strong> commande{livrees > 1 ? 's' : ''} livrée{livrees > 1 ? 's' : ''} ce cycle
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VUE ADMIN
   ══════════════════════════════════════════════════════════════════════════════ */
function VueAdmin({ setToast }: { setToast: any }) {
  const [orders,    setOrders]    = useState<any[]>([])
  const [orgs,      setOrgs]      = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [kpiFilter, setKpiFilter] = useState<KpiKey | null>(null)
  const [search,    setSearch]    = useState('')
  const [showAlloc, setShowAlloc] = useState(false)
  const [allocForm, setAllocForm] = useState({ idLigne: '', idLot: '', quantite: '' })
  const [saving,    setSaving]    = useState(false)

  async function fetchOrders() {
    setLoading(true)
    const [oRes, orgRes] = await Promise.allSettled([
      api.get(endpoints.orders),
      api.get(endpoints.organisations),
    ])
    setOrders(oRes.status === 'fulfilled' ? oRes.value.data : [])
    setOrgs(orgRes.status === 'fulfilled' ? orgRes.value.data : [])
    setLoading(false)
  }
  async function handleUpdateStatus(id: number, statut: string) {
    await api.put(endpoints.orderStatut(id), { statut })
    setToast({ msg: `Commande → ${STATUS_CFG[statut]?.label ?? statut}`, type: 'success' })
    fetchOrders()
  }
  async function submitAlloc(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.orderAllocate, { idLigne: Number(allocForm.idLigne), idLot: Number(allocForm.idLot), quantite: Number(allocForm.quantite) })
      setToast({ msg: 'Allocation enregistrée', type: 'success' })
      setShowAlloc(false); setAllocForm({ idLigne: '', idLot: '', quantite: '' })
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur allocation', type: 'error' })
    } finally { setSaving(false) }
  }
  useEffect(() => { fetchOrders() }, [])

  const pending   = orders.filter(o => ['SOUMISE','PENDING','EN_ATTENTE'].includes(o.statut)).length
  const accepted  = orders.filter(o => ['ACCEPTEE','CONFIRMEE','ALLOUEE','ALLOCATED','EN_PREPARATION'].includes(o.statut)).length
  const rejected  = orders.filter(o => ['ANNULEE','CANCELLED','REJETEE'].includes(o.statut)).length
  const delivered = orders.filter(o => o.statut === 'LIVREE').length

  const toggleKpi = (k: KpiKey) => { setKpiFilter(kpiFilter === k ? null : k); setSearch('') }

  const displayed = orders.filter(o => {
    const matchKpi    = !kpiFilter || KPI_FILTER[kpiFilter](o)
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    return matchKpi && matchSearch
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard icon={<ShoppingCart size={20} />}  value={orders.length} label="Total commandes"  accent="#3b82f6" loading={loading} onClick={() => setKpiFilter(null)} />
        <KpiCard icon={<Clock size={20} />}          value={pending}       label="À traiter"        accent="#f59e0b" active={kpiFilter === 'pending'}   onClick={() => toggleKpi('pending')}   loading={loading} />
        <KpiCard icon={<PackageCheck size={20} />}   value={accepted}      label="En cours"         accent="#22c55e" active={kpiFilter === 'accepted'}   onClick={() => toggleKpi('accepted')}  loading={loading} />
        <KpiCard icon={<Truck size={20} />}          value={delivered}     label="Livrées"          accent="#10b981" active={kpiFilter === 'delivered'}  onClick={() => toggleKpi('delivered')} loading={loading} />
      </div>

      {!loading && <EvolutionChart orders={orders} />}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><ShoppingCart size={15} /></span>
            Toutes les commandes
            {kpiFilter && (
              <button className="btn btn-ghost" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', height: 22, color: '#f59e0b', border: '1px solid #fde68a' }} onClick={() => setKpiFilter(null)}>
                <X size={10} /> Filtre actif
              </button>
            )}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{displayed.length}/{orders.length}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowAlloc(true)}><Settings2 size={13} /> Allouer</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchOrders}><RefreshCw size={13} /></button>
          </div>
        </div>

        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 360 }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              placeholder="Code commande ou client…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1 }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer</button>}
        </div>

        <OrderTable
          orders={displayed}
          loading={loading}
          emptyMsg={kpiFilter ? 'Aucune commande pour ce filtre' : 'Aucune commande'}
          orgs={orgs}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>

      {rejected > 0 && !loading && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <XCircle size={13} /> <strong>{rejected}</strong> commande{rejected > 1 ? 's' : ''} annulée{rejected > 1 ? 's' : ''} / rejetée{rejected > 1 ? 's' : ''}
          <button className="btn btn-ghost" style={{ fontSize: 11, marginLeft: 4 }} onClick={() => toggleKpi('rejected')}>Afficher</button>
        </div>
      )}

      {showAlloc && (
        <Modal title="Allouer un Lot" subtitle="Affecter un lot de semences à une ligne de commande" onClose={() => setShowAlloc(false)} size="sm">
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1d4ed8' }}>
            Trouvez l'ID de la ligne dans le détail de la commande (bouton Œil).
          </div>
          <form onSubmit={submitAlloc}>
            <Field label="ID ligne de commande" required><FormInput type="number" value={allocForm.idLigne} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, idLigne: e.target.value }))} placeholder="1" required /></Field>
            <Field label="ID du lot" required><FormInput type="number" value={allocForm.idLot} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, idLot: e.target.value }))} placeholder="22" required /></Field>
            <Field label="Quantité" required><FormInput type="number" value={allocForm.quantite} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, quantite: e.target.value }))} placeholder="1000" min="1" step="0.01" required /></Field>
            <FormActions onCancel={() => setShowAlloc(false)} loading={saving} submitLabel="Confirmer l'allocation" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPOSANT RACINE — dispatch par rôle
   ══════════════════════════════════════════════════════════════════════════════ */
export function Orders({ roleKey }: Props) {
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {roleKey === 'seed-quotataire'
        ? <VueQuotataire setToast={setToast} />
        : roleKey === 'seed-multiplicator'
          ? <VueMultiplicateur setToast={setToast} />
          : roleKey === 'seed-upsemcl' || roleKey === 'seed-selector'
            ? <VueUpsemcl setToast={setToast} roleKey={roleKey} />
            : <VueAdmin setToast={setToast} />
      }
    </div>
  )
}
