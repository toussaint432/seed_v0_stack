import { useEffect, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import {
  Database, RefreshCw, Plus, MapPin, Package, TrendingUp,
  X, Archive, Search, ChevronDown,
  ArrowRightLeft, FileText, Download, CheckCircle2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, normalizeVariete, extractList } from '../../lib/normalizers'
import { fmtT } from '../../lib/fmt'
import { downloadXlsx, formatDateForExport } from '../../lib/exportUtils'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { keycloak } from '../../lib/keycloak'
import {
  generateTransferDoc, generateNumero,
  TransferDocData, LotPdfData, PartiePdf,
} from '../../lib/pdf/generateTransferDoc'

interface Props { roleKey: string; userSpecialisation?: string | null }

import { GEN_CHART_COLORS, GEN_COLORS, ROLE_LABELS_LONG } from '../../lib/constants'
const GEN_COLOR = GEN_CHART_COLORS
const GEN_BADGE: Record<string, string> = Object.fromEntries(
  Object.entries(GEN_COLORS).map(([k, v]) => [k, v.badge])
)
const UPSEMCL_GENS   = ['G1', 'G2', 'G3']
const SELECTOR_GENS  = ['G0', 'G1']

/* ── Règles de transfert inter-organisations par rôle ── */
const TRANSFER_RULES_STOCK: Record<string, { allowedGens: string[]; source: string; destination: string; destRoleKey: string }> = {
  'seed-selector': { allowedGens: ['G1'], source: 'ISRA/CNRA',  destination: 'UPSemCL',       destRoleKey: 'seed-upsemcl'       },
  'seed-upsemcl':  { allowedGens: ['G3'], source: 'UPSemCL',    destination: 'Multiplicateur', destRoleKey: 'seed-multiplicator' },
}

const ROLE_LABELS_PDF = ROLE_LABELS_LONG

const STATUT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  DISPONIBLE:    { label: 'Disponible',    color: '#15803d', bg: '#f0fdf4' },
  CERTIFIE:      { label: 'Certifiée',     color: '#15803d', bg: '#dcfce7' },
  EN_COURS_CERT: { label: 'En certif.',    color: '#1d4ed8', bg: '#eff6ff' },
  DECLASS:       { label: 'Déclassée',     color: '#92660a', bg: '#fef9ed' },
  TRANSFERE:     { label: 'Transféré',     color: '#7e22ce', bg: '#fdf4ff' },
  EN_PRODUCTION: { label: 'En production', color: '#92660a', bg: '#fef9ed' },
  EPUISE:        { label: 'Épuisé',        color: '#6b7280', bg: '#f9fafb' },
  RETIRE:        { label: 'Retiré',        color: '#dc2626', bg: '#fef2f2' },
  SOUCHE:        { label: 'Souche',        color: '#0f766e', bg: '#f0fdfa' },
  PERDU:         { label: 'Perdu',         color: '#dc2626', bg: '#fef2f2' },
}

const MVT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  IN:       { label: '↓ Entrée',    color: '#15803d', bg: '#f0fdf4' },
  OUT:      { label: '↑ Sortie',    color: '#dc2626', bg: '#fef2f2' },
  TRANSFER: { label: '⇄ Transfert', color: '#7e22ce', bg: '#fdf4ff' },
}

function StatutBadge({ statut }: { statut?: string }) {
  if (!statut) return null
  const s = STATUT_STYLE[statut]
  if (!s) return <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{statut}</span>
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

interface BarDatum { label: string; value: number; color: string }
interface MultiGenBarDatum { label: string; gens: Record<string, number> }

interface ChartTip {
  xPct: number; yPct: number
  label: string
  entries: { gen: string; value: number; color: string }[]
  total: number
}

const fmtK = (v: number) => fmtT(v)

function ChartTooltip({ tip }: { tip: ChartTip }) {
  return (
    <div style={{
      position: 'absolute',
      left: `${Math.min(Math.max(tip.xPct, 16), 84)}%`,
      top:  `${tip.yPct}%`,
      transform: 'translate(-50%, calc(-100% - 12px))',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8, padding: '9px 13px',
      fontSize: 12, pointerEvents: 'none', zIndex: 60,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      minWidth: 160, whiteSpace: 'nowrap',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 7, color: 'var(--text-primary)' }}>
        {tip.label}
      </div>
      {tip.entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: i < tip.entries.length - 1 ? 4 : 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: e.color, flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--text-muted)' }}>{e.gen}</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', paddingLeft: 12 }}>
            {fmtT(e.value)}
          </span>
        </div>
      ))}
      {tip.entries.length > 1 && (
        <div style={{
          borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 5,
          display: 'flex', justifyContent: 'space-between',
          fontWeight: 700, color: 'var(--text-primary)', fontSize: 11,
        }}>
          <span>Total</span>
          <span>{fmtT(tip.total)}</span>
        </div>
      )}
    </div>
  )
}

function StockBarChart({ data }: { data: BarDatum[] }) {
  const [tip, setTip] = useState<ChartTip | null>(null)

  if (data.length === 0) return (
    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '36px 20px' }}>
      Aucune donnée à visualiser pour cette sélection
    </div>
  )

  const W = 680, H = 260, PL = 68, PR = 20, PT = 30, PB = 56
  const maxV   = Math.max(...data.map(d => d.value), 1)
  const chartW = W - PL - PR, chartH = H - PT - PB
  const n      = data.length
  const step   = chartW / n
  const barW   = Math.min(46, Math.max(12, step * 0.58))

  return (
    <div style={{ position: 'relative', overflow: 'visible' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setTip(null)}>
        <defs>
          {data.map((d, i) => (
            <linearGradient key={i} id={`scbar-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d.color} stopOpacity={0.88} />
              <stop offset="100%" stopColor={d.color} stopOpacity={0.44} />
            </linearGradient>
          ))}
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = PT + chartH - t * chartH
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y}
                stroke="var(--border)"
                strokeWidth={i === 0 ? 1.2 : 0.5}
                strokeDasharray={i === 0 ? '' : '4 4'} />
              <text x={PL - 8} y={y + 4} fontSize={9} fill="var(--text-muted)" textAnchor="end">
                {fmtK(Math.round(t * maxV))}
              </text>
            </g>
          )
        })}

        <text x={11} y={PT + chartH / 2} fontSize={9} fill="var(--text-muted)" textAnchor="middle"
          transform={`rotate(-90, 11, ${PT + chartH / 2})`}>t</text>

        {data.map((d, i) => {
          const cx     = PL + i * step + step / 2
          const bh     = Math.max(3, (d.value / maxV) * chartH)
          const bx     = cx - barW / 2
          const by     = PT + chartH - bh
          const isHov  = tip?.label === d.label
          const dimmed = !!tip && !isHov
          return (
            <g key={i}
              onMouseEnter={() => setTip({
                xPct: cx / W * 100, yPct: by / H * 100,
                label: d.label,
                entries: [{ gen: 'Quantité', value: d.value, color: d.color }],
                total: d.value,
              })}
              style={{ cursor: 'pointer' }}>
              <rect x={cx - step / 2 + 1} y={PT} width={step - 2} height={chartH + PB - 8}
                fill="transparent" />
              <rect x={bx} y={by} width={barW} height={bh} rx={4}
                fill={`url(#scbar-${i})`}
                opacity={dimmed ? 0.26 : 1}
                style={{ transition: 'opacity 0.12s ease' }} />
              {isHov && (
                <rect x={bx - 1} y={by - 1} width={barW + 2} height={bh + 1} rx={5}
                  fill="none" stroke={d.color} strokeWidth={1.5} />
              )}
              <text x={cx} y={by - 5} fontSize={9} fill={d.color}
                textAnchor="middle" fontWeight={700}
                opacity={dimmed ? 0.26 : 1}>
                {fmtK(d.value)}
              </text>
              <text x={cx} y={H - PB + 16} fontSize={9} fill="var(--text-muted)"
                textAnchor="middle" opacity={dimmed ? 0.38 : 1}>
                {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
              </text>
            </g>
          )
        })}
      </svg>
      {tip && <ChartTooltip tip={tip} />}
    </div>
  )
}

function MultiGenBarChart({ data, gens }: { data: MultiGenBarDatum[]; gens: string[] }) {
  const [tip, setTip] = useState<ChartTip | null>(null)

  if (data.length === 0 || gens.length === 0) return (
    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '36px 20px' }}>
      Aucune donnée à visualiser pour cette sélection
    </div>
  )

  const W = 700, H = 270, PL = 68, PR = 20, PT = 30, PB = 56
  const maxV   = Math.max(...data.flatMap(d => gens.map(g => d.gens[g] ?? 0)), 1)
  const chartW = W - PL - PR, chartH = H - PT - PB
  const n      = data.length
  const groupW = chartW / n
  const barW   = Math.min(28, Math.max(6, (groupW * 0.78) / gens.length - 2))
  const gap    = 2
  const totalBarSpan = barW * gens.length + gap * (gens.length - 1)

  return (
    <div style={{ position: 'relative', overflow: 'visible' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={() => setTip(null)}>
        <defs>
          {gens.map(g => (
            <linearGradient key={g} id={`mgbar-${g}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GEN_COLOR[g] ?? '#6b7280'} stopOpacity={0.9} />
              <stop offset="100%" stopColor={GEN_COLOR[g] ?? '#6b7280'} stopOpacity={0.44} />
            </linearGradient>
          ))}
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = PT + chartH - t * chartH
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y}
                stroke="var(--border)"
                strokeWidth={i === 0 ? 1.2 : 0.5}
                strokeDasharray={i === 0 ? '' : '4 4'} />
              <text x={PL - 8} y={y + 4} fontSize={9} fill="var(--text-muted)" textAnchor="end">
                {fmtK(Math.round(t * maxV))}
              </text>
            </g>
          )
        })}

        <text x={11} y={PT + chartH / 2} fontSize={9} fill="var(--text-muted)" textAnchor="middle"
          transform={`rotate(-90, 11, ${PT + chartH / 2})`}>t</text>

        {data.map((d, i) => {
          const groupCX = PL + i * groupW + groupW / 2
          const startX  = groupCX - totalBarSpan / 2
          const total   = gens.reduce((s, g) => s + (d.gens[g] ?? 0), 0)
          const isHov   = tip?.label === d.label
          const dimmed  = !!tip && !isHov

          let minBarY = PT + chartH
          gens.forEach(g => {
            const qty = d.gens[g] ?? 0
            if (qty > 0) {
              const bh = Math.max(3, (qty / maxV) * chartH)
              minBarY  = Math.min(minBarY, PT + chartH - bh)
            }
          })

          return (
            <g key={i}
              onMouseEnter={() => setTip({
                xPct: groupCX / W * 100,
                yPct: minBarY / H * 100,
                label: d.label,
                entries: gens
                  .filter(g => (d.gens[g] ?? 0) > 0)
                  .map(g => ({ gen: g, value: d.gens[g] ?? 0, color: GEN_COLOR[g] ?? '#6b7280' })),
                total,
              })}
              style={{ cursor: 'pointer' }}>
              <rect x={groupCX - groupW / 2 + 1} y={PT} width={groupW - 2} height={chartH + PB - 8}
                fill="transparent" />
              {gens.map((g, j) => {
                const qty = d.gens[g] ?? 0
                if (qty <= 0) return null
                const bh = Math.max(3, (qty / maxV) * chartH)
                const bx = startX + j * (barW + gap)
                const by = PT + chartH - bh
                return (
                  <g key={g}>
                    <rect x={bx} y={by} width={barW} height={bh} rx={3}
                      fill={`url(#mgbar-${g})`}
                      opacity={dimmed ? 0.26 : 1}
                      style={{ transition: 'opacity 0.12s ease' }} />
                    {bh > 22 && (
                      <text x={bx + barW / 2} y={by + 12} fontSize={7.5}
                        fill="white" textAnchor="middle" fontWeight={700}>
                        {fmtK(qty)}
                      </text>
                    )}
                  </g>
                )
              })}
              {total > 0 && (
                <text x={groupCX} y={minBarY - 5} fontSize={8.5} fontWeight={700}
                  fill="var(--text-muted)" textAnchor="middle"
                  opacity={dimmed ? 0.3 : 1}>
                  {fmtK(total)}
                </text>
              )}
              <text x={groupCX} y={H - PB + 16} fontSize={8.5}
                fill="var(--text-muted)" textAnchor="middle"
                opacity={dimmed ? 0.38 : 1}>
                {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
              </text>
            </g>
          )
        })}
      </svg>
      {tip && <ChartTooltip tip={tip} />}
    </div>
  )
}
function LotDropdown({ lots, value, onChange, placeholder = 'Sélectionner un lot…', varMap }: {
  lots: any[]; value: string; onChange: (v: string) => void
  placeholder?: string; varMap: Record<number, any>
}) {
  const [q,    setQ]    = useState('')
  const [open, setOpen] = useState(false)

  const filtered = lots.filter(l => {
    if (!q) return true
    const term = q.toLowerCase()
    const vnom = varMap[l.idVariete]?.nomVariete ?? varMap[l.idVariete]?.codeVariete ?? ''
    return l.codeLot?.toLowerCase().includes(term) || vnom.toLowerCase().includes(term)
  }).slice(0, 25)

  const selected = lots.find(l => String(l.id) === value)
  const selVnom  = selected ? (varMap[selected.idVariete]?.nomVariete ?? '') : ''
  const selGen   = selected?.generation?.codeGeneration ?? ''

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', background: 'var(--surface)', fontSize: 13, minHeight: 38 }}
        onClick={() => setOpen(o => !o)}
      >
        {selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: (GEN_COLOR[selGen] ?? '#6b7280') + '22', color: GEN_COLOR[selGen] ?? '#6b7280', flexShrink: 0 }}>{selGen}</span>
            <span style={{ fontWeight: 600, fontSize: 12 }}>{selected.codeLot}</span>
            {selVnom && <span style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {selVnom}</span>}
          </div>
        ) : (
          <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: 12 }}>{placeholder}</span>
        )}
        <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', zIndex: 100, top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', maxHeight: 260, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', borderRadius: 5, padding: '5px 8px' }}>
              <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                autoFocus
                value={q}
                onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
                placeholder="Code lot ou variété…"
                style={{ border: 'none', outline: 'none', fontSize: 12, flex: 1, background: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Aucun lot trouvé</div>
              : filtered.map(l => {
                  const gen     = l.generation?.codeGeneration ?? '?'
                  const vnom    = varMap[l.idVariete]?.nomVariete ?? varMap[l.idVariete]?.codeVariete ?? ''
                  const isSel   = String(l.id) === value
                  return (
                    <div
                      key={l.id}
                      style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: isSel ? 'var(--surface-2)' : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={(e: MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e: MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = isSel ? 'var(--surface-2)' : 'transparent')}
                      onClick={() => { onChange(String(l.id)); setOpen(false); setQ('') }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: (GEN_COLOR[gen] ?? '#6b7280') + '22', color: GEN_COLOR[gen] ?? '#6b7280', flexShrink: 0 }}>{gen}</span>
                      <span style={{ fontWeight: 600 }}>{l.codeLot}</span>
                      {vnom && <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {vnom}</span>}
                    </div>
                  )
                })
            }
          </div>
        </div>
      )}
    </div>
  )
}

export function Stocks({ roleKey, userSpecialisation }: Props) {
  const [agregeStocks, setAgregeStocks] = useState<any[]>([])
  const [lots,         setLots]         = useState<any[]>([])
  const [varieties,    setVarieties]    = useState<any[]>([])
  const [sitesList,    setSitesList]    = useState<any[]>([])
  const [movements,    setMovements]    = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const [site,         setSite]         = useState('')
  const [filterGen,    setFilterGen]    = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [showChart,    setShowChart]    = useState(true)
  const [showHistory,  setShowHistory]  = useState(false)
  const [historyLotId, setHistoryLotId] = useState<number | null>(null)

  /* Filtre du graphe : 'all' = total toutes générations du rôle, sinon code génération seul */
  const [chartGen, setChartGen] = useState<string>('all')

  const [showStockForm, setShowStockForm] = useState(false)
  const [showMvtForm,   setShowMvtForm]   = useState(false)
  const [editStock,     setEditStock]     = useState<any | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<any | null>(null)

  const isUPSemCL  = roleKey === 'seed-upsemcl'
  const isSelector = roleKey === 'seed-selector'
  const isMulti    = roleKey === 'seed-multiplicator'
  const isQuotaire = roleKey === 'seed-quotataire'
  const canManage  = ['seed-admin', 'seed-upsemcl', 'seed-multiplicator', 'seed-selector'].includes(roleKey)

  const [stockForm, setStockForm] = useState({ idLot: '', siteCode: '', quantite: '', unite: 'kg' })
  const [mvtForm,   setMvtForm]   = useState({ idLot: '', type: 'IN', siteSourceCode: '', siteDestinationCode: '', quantite: '', unite: 'kg', reference: '' })
  const [editForm,  setEditForm]  = useState({ quantite: '', unite: 'kg' })

  /* ── Transfert inter-organisations depuis le stock ── */
  const transferRule = TRANSFER_RULES_STOCK[roleKey] as typeof TRANSFER_RULES_STOCK[string] | undefined
  const [showTransferForm,  setShowTransferForm]  = useState(false)
  const [transferSource,    setTransferSource]    = useState<{ stock: any; lot: any } | null>(null)
  const [transferForm,      setTransferForm]      = useState({
    usernameDestinataire: '', quantite: '', observations: '',
  })
  const [transferSaving, setTransferSaving] = useState(false)
  const [lastTransfer,   setLastTransfer]   = useState<any>(null)
  const [membres,        setMembres]        = useState<any[]>([])

  const varMap: Record<number, any> = Object.fromEntries(varieties.map(v => [v.id, v]))
  const lotMap: Record<number, any> = Object.fromEntries(lots.map(l => [l.id, l]))

  const availableLots = isUPSemCL
    ? lots.filter(l => UPSEMCL_GENS.includes(l.generation?.codeGeneration))
    : isSelector
    ? lots.filter(l => SELECTOR_GENS.includes(l.generation?.codeGeneration))
    : lots

  function toggleRow(key: string) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function fetchAll(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    const lotsUrl = isMulti ? endpoints.lotsMesLots : endpoints.lots
    await Promise.all([
      api.get(endpoints.stocksAgrege).then(r => setAgregeStocks(r.data)).catch(() => setAgregeStocks([])),
      api.get(lotsUrl).then(r              => setLots(extractList(r.data).map(normalizeLot))).catch(() => {}),
      api.get(endpoints.varieties).then(r  => setVarieties(extractList(r.data).map(normalizeVariete))).catch(() => {}),
      api.get(roleKey === 'seed-admin' ? endpoints.sites : endpoints.sitesMesSites).then(r => setSitesList(r.data)).catch(() => {}),
      api.get(endpoints.movements).then(r  => setMovements(r.data)).catch(() => {}),
      transferRule ? api.get(endpoints.membres).then(r => setMembres(r.data)).catch(() => {}) : Promise.resolve(),
    ])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchAll() }, [])

  const stocks = (() => {
    let s = agregeStocks
    // Generation filter is already applied server-side; client-side is a safety guard
    if (isUPSemCL)  s = s.filter(st => UPSEMCL_GENS.includes(st.codeGeneration))
    if (isSelector) s = s.filter(st => SELECTOR_GENS.includes(st.codeGeneration))
    if (isQuotaire) s = s.filter(st => st.codeGeneration === 'R2')
    if (isSelector && userSpecialisation) s = s.filter(st => !st.codeEspece || st.codeEspece.toUpperCase() === userSpecialisation.toUpperCase())
    if (site)       s = s.filter(st => st.codeSite === site)
    if (filterGen)  s = s.filter(st => st.codeGeneration === filterGen)
    if (filterSearch) {
      const term = filterSearch.toLowerCase()
      s = s.filter(st =>
        st.nomVariete?.toLowerCase().includes(term)
        || st.codeVariete?.toLowerCase().includes(term)
        || st.nomEspece?.toLowerCase().includes(term)
        || st.codeSite?.toLowerCase().includes(term)
        || st.lotsDetail?.some((d: any) => d.codeLot?.toLowerCase().includes(term))
      )
    }
    return s
  })()

  const totalQty   = stocks.reduce((s, st) => s + (parseFloat(st.quantiteTotale) || 0), 0)
  const totalLots  = stocks.reduce((s, st) => s + (Number(st.nbLots) || 0), 0)
  const varietySet = new Set(stocks.map((s: any) => s.nomVariete).filter(Boolean))
  const siteList   = [...new Set(agregeStocks.map((s: any) => s.codeSite).filter(Boolean))]
  const maxQty     = Math.max(...stocks.map((s: any) => parseFloat(s.quantiteTotale) || 0), 1)

  /* Générations accessibles selon le rôle — pilote les boutons et le graphe groupé.
     Admin/Quotataire/Multiplicateur : déduites dynamiquement des données réelles. */
  const GEN_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2']
  const roleGens: string[] = (() => {
    if (isSelector) return SELECTOR_GENS
    if (isUPSemCL)  return UPSEMCL_GENS
    const present = new Set(agregeStocks.map((s: any) => s.codeGeneration).filter(Boolean))
    return GEN_ORDER.filter(g => present.has(g))
  })()

  /* Données multi-générations pour le graphe groupé (mode 'all').
     Agrège agregeStocks par variété × génération pour le périmètre du rôle. */
  const chartGroupedData: MultiGenBarDatum[] = (() => {
    if (roleGens.length < 2) return []   // graphe groupé inutile si une seule génération
    const agg: Record<string, Record<string, number>> = {}
    agregeStocks
      .filter(st => roleGens.includes(st.codeGeneration))
      .forEach(st => {
        const key = st.nomVariete ?? st.codeVariete ?? `Var#${st.idVariete}`
        if (!agg[key]) agg[key] = {}
        agg[key][st.codeGeneration] = (agg[key][st.codeGeneration] ?? 0) + (parseFloat(st.quantiteTotale) || 0)
      })
    return Object.entries(agg)
      .map(([label, gens]) => ({
        label,
        gens: Object.fromEntries(Object.entries(gens).map(([g, v]) => [g, Math.round(v)])),
      }))
      .sort((a, b) => {
        const totA = roleGens.reduce((s, g) => s + (a.gens[g] ?? 0), 0)
        const totB = roleGens.reduce((s, g) => s + (b.gens[g] ?? 0), 0)
        return totB - totA
      })
      .slice(0, 12)
  })()

  /* barData : utilisé en mode filtre d'une génération spécifique (chartGen !== 'all').
     Filtre agregeStocks sur la génération choisie, toutes roles confondus. */
  const barData: BarDatum[] = (() => {
    const source = chartGen !== 'all'
      ? agregeStocks.filter(st => st.codeGeneration === chartGen)
      : stocks
    const agg: Record<string, { qty: number; gen: string }> = {}
    source.forEach(st => {
      const key = st.nomVariete ?? st.codeVariete ?? `Var#${st.idVariete}`
      const gen = st.codeGeneration ?? '?'
      if (!agg[key]) agg[key] = { qty: 0, gen }
      agg[key].qty += parseFloat(st.quantiteTotale) || 0
    })
    return Object.entries(agg)
      .map(([label, { qty, gen }]) => ({ label, value: Math.round(qty), color: GEN_COLOR[gen] ?? '#6b7280' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  })()

  const filteredMvts = historyLotId
    ? movements.filter((m: any) => m.idLot === historyLotId)
    : movements

  function toastErr(err: any, fallback: string) {
    const st  = err?.response?.status
    const msg = err?.response?.data?.message || err?.response?.data?.error || fallback
    if (st === 409) return setToast({ msg: `Stock insuffisant — ${msg}`, type: 'error' })
    if (st === 400) return setToast({ msg: `Données invalides — ${msg}`, type: 'error' })
    if (st === 404) return setToast({ msg: `Introuvable — ${msg}`, type: 'error' })
    if (st === 500) return setToast({ msg: `Erreur serveur — veuillez réessayer`, type: 'error' })
    setToast({ msg, type: 'error' })
  }

  async function submitStock(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.stocks, {
        idLot: Number(stockForm.idLot), siteCode: stockForm.siteCode,
        quantite: Number(stockForm.quantite), unite: stockForm.unite
      })
      setToast({ msg: `Stock enregistré sur ${stockForm.siteCode}`, type: 'success' })
      setShowStockForm(false)
      setStockForm({ idLot: '', siteCode: '', quantite: '', unite: 'kg' })
      fetchAll(true)
    } catch (err: any) { toastErr(err, 'Erreur enregistrement stock')
    } finally { setSaving(false) }
  }

  async function submitMvt(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.movements, {
        idLot: Number(mvtForm.idLot), type: mvtForm.type,
        siteSourceCode:      mvtForm.siteSourceCode      || undefined,
        siteDestinationCode: mvtForm.siteDestinationCode || undefined,
        quantite: Number(mvtForm.quantite), unite: mvtForm.unite,
        reference: mvtForm.reference || undefined
      })
      const labels: Record<string, string> = { IN: 'Entrée', OUT: 'Sortie', TRANSFER: 'Transfert' }
      setToast({ msg: `${labels[mvtForm.type] || mvtForm.type} de ${mvtForm.quantite} ${mvtForm.unite} enregistré`, type: 'success' })
      setShowMvtForm(false)
      setMvtForm({ idLot: '', type: 'IN', siteSourceCode: '', siteDestinationCode: '', quantite: '', unite: 'kg', reference: '' })
      fetchAll(true)
    } catch (err: any) { toastErr(err, 'Erreur mouvement')
    } finally { setSaving(false) }
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    if (!editStock) return
    try {
      await api.put(endpoints.stockById(editStock.id), {
        idLot: editStock.idLot, siteCode: editStock.site?.codeSite,
        quantite: Number(editForm.quantite), unite: editForm.unite
      })
      setToast({ msg: `Stock mis à jour`, type: 'success' })
      setEditStock(null)
      fetchAll(true)
    } catch (err: any) { toastErr(err, 'Erreur mise à jour')
    } finally { setSaving(false) }
  }

  async function doDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await api.delete(endpoints.stockById(deleteTarget.id))
      setToast({ msg: `Entrée de stock supprimée`, type: 'success' })
      setDeleteTarget(null)
      fetchAll(true)
    } catch (err: any) { toastErr(err, 'Erreur suppression')
    } finally { setSaving(false) }
  }

  const genOptions = isUPSemCL  ? UPSEMCL_GENS
    : isSelector  ? SELECTOR_GENS
    : isQuotaire  ? ['R2']
    : isMulti     ? ['G3', 'G4', 'R1', 'R2']
    : ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2']

  /* ── Transfert inter-orgs depuis le stock ── */
  function openTransferFromStock(stock: any, lot: any) {
    setTransferSource({ stock, lot })
    setTransferForm({
      usernameDestinataire: '',
      quantite:             '',   // champ vide : l'utilisateur saisit explicitement la quantité partielle
      observations:         '',
    })
    setLastTransfer(null)
    setShowTransferForm(true)
  }

  async function submitTransferFromStock(e: FormEvent) {
    e.preventDefault()
    if (!transferSource || !transferRule) return
    if (!transferForm.usernameDestinataire) {
      toastErr(null, 'Veuillez sélectionner un destinataire')
      return
    }
    const saisi = parseFloat(transferForm.quantite) || 0
    const dispo  = parseFloat(transferSource.stock.quantiteDisponible) || 0
    if (saisi <= 0) {
      toastErr(null, 'La quantité à transférer doit être strictement positive')
      return
    }
    if (saisi > dispo) {
      toastErr(null, `Quantité insuffisante : stock disponible ${dispo.toLocaleString('fr-FR')} kg`)
      return
    }
    setTransferSaving(true)
    try {
      /* Le backend génère codeTransfert, usernameEmetteur et roleEmetteur depuis le JWT.
         Seul le lot-service crée le TransfertLot ET déclenche Kafka → débit stock. */
      const resp = await api.post(endpoints.lotTransfer(transferSource.lot.id), {
        usernameDestinataire: transferForm.usernameDestinataire,
        quantite:             Number(transferForm.quantite),
        observations:         transferForm.observations || undefined,
      })
      setLastTransfer({ ...resp.data, _lot: transferSource.lot })
      setShowTransferForm(false)
      setTransferSource(null)
      setToast({ msg: `Transfert ${resp.data.codeTransfert} initié → ${transferForm.usernameDestinataire}`, type: 'success' })
      fetchAll(true)
    } catch (err: any) {
      toastErr(err, 'Erreur lors du transfert')
    } finally { setTransferSaving(false) }
  }

  function downloadTransferDoc(t: any, docType: 'BORDEREAU' | 'ACCUSE_RECEPTION') {
    const lot     = t._lot ?? lotMap[t.idLot]
    const variete = varMap[lot?.idVariete]
    const gen     = lot?.generation?.codeGeneration || ''
    const jwt     = keycloak.tokenParsed as Record<string, unknown>
    const me      = (jwt?.preferred_username as string) || ''

    const lotData: LotPdfData = {
      codeLot:         lot?.codeLot || `LOT-${t.idLot}`,
      nomVariete:      variete?.nomVariete || 'N/D',
      nomEspece:       variete?.espece?.nomCommun || variete?.espece?.nomEspece || 'Semence',
      generationCode:  gen || '—',
      quantiteNette:   Number(t.quantite ?? lot?.quantiteNette ?? 0),
      unite:           lot?.unite || 'kg',
      tauxGermination: lot?.tauxGermination,
      puretePhysique:  lot?.puretePhysique,
      statutLot:       lot?.statutLot || 'TRANSFERE',
      dateProduction:  lot?.dateProduction,
      campagne:        lot?.campagne,
      lotParentCode:   lot?.lotParent?.codeLot,
    }
    const expediteur: PartiePdf = {
      username: t.usernameEmetteur || me,
      nom:      t.usernameEmetteur || me,
      roleKey,
      roleLabel: ROLE_LABELS_PDF[roleKey] || roleKey,
    }
    const destinataire: PartiePdf = {
      username:  t.usernameDestinataire || transferRule?.destination || '—',
      nom:       t.usernameDestinataire || transferRule?.destination || '—',
      roleKey:   transferRule?.destRoleKey || 'seed-upsemcl',
      roleLabel: ROLE_LABELS_PDF[transferRule?.destRoleKey || 'seed-upsemcl'],
    }
    const docData: TransferDocData = {
      type:               docType,
      codeTransfert:      t.codeTransfert,
      numero:             generateNumero(t.id),
      lot:                lotData,
      expediteur,
      destinataire,
      quantiteTransferee: Number(t.quantite ?? 0),
      dateDemande:        t.dateDemande || new Date().toISOString().split('T')[0],
      observations:       t.observations,
      dateAcceptation:    docType === 'ACCUSE_RECEPTION' ? (t.dateAcceptation || new Date().toISOString().split('T')[0]) : undefined,
      nomReceptionnaire:  docType === 'ACCUSE_RECEPTION' ? me : undefined,
      quantiteRecue:      docType === 'ACCUSE_RECEPTION' ? Number(t.quantite ?? 0) : undefined,
    }
    generateTransferDoc(docData)
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {lastTransfer && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#f3e8ff,#ede9fe)', border: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', gap: 14 }}>
          <CheckCircle2 size={20} style={{ color: '#7e22ce', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#581c87' }}>
              Transfert <span style={{ fontFamily: 'monospace' }}>{lastTransfer.codeTransfert}</span> créé avec succès
            </div>
            <div style={{ fontSize: 12, color: '#7e22ce', marginTop: 2 }}>
              {lastTransfer.quantite} {lastTransfer._lot?.unite || 'kg'} → {lastTransfer.usernameDestinataire || transferRule?.destination}
              {lastTransfer.statut && (
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: '#7e22ce22', color: '#7e22ce' }}>
                  {lastTransfer.statut}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 10px', gap: 5 }}
              onClick={() => downloadTransferDoc(lastTransfer, 'BORDEREAU')}
            >
              <FileText size={12} /> Bordereau PDF
            </button>
            {lastTransfer.statut === 'ACCEPTE' && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '5px 10px', gap: 5 }}
                onClick={() => downloadTransferDoc(lastTransfer, 'ACCUSE_RECEPTION')}
              >
                <Download size={12} /> Accusé de réception
              </button>
            )}
          </div>
          <button
            className="btn btn-ghost btn-icon"
            style={{ padding: '4px 6px', flexShrink: 0 }}
            onClick={() => setLastTransfer(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isUPSemCL && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e922,#22c55e11)', border: '1px solid #0ea5e933', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0ea5e9', background: '#0ea5e915', borderRadius: 4, padding: '2px 8px' }}>UPSEMCL</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Réception G1 → multiplication G1→G3 → transfert G3 aux multiplicateurs</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#22c55e' }}>Périmètre : G1 · G2 · G3</span>
        </div>
      )}

      {isSelector && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#6366f122,#0369a111)', border: '1px solid #0369a133', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', background: '#0369a115', borderRadius: 4, padding: '2px 8px' }}>SÉLECTIONNEUR</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Conservation noyau génétique G0 · production pré-base G1 → transfert vers UPSemCL</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#6366f1' }}>Périmètre : G0 · G1</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Database size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : varietySet.size}</div>
            <div className="stat-label">Variétés en stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><MapPin size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : siteList.length}</div>
            <div className="stat-label">Sites actifs</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold"><Package size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : fmtT(totalQty)}</div>
            <div className="stat-label">Quantité totale (t)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet"><TrendingUp size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : totalLots}</div>
            <div className="stat-label">Lots en stock</div>
          </div>
        </div>
      </div>

      {/* ── Graphe stock — dynamique selon le rôle ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowChart(c => !c)}>
          <span className="card-title">
            <span className="card-title-icon"><TrendingUp size={15} /></span>
            Visualisation stock par variété
            {/* Badge indiquant le filtre actif — couleur de la génération ou du rôle */}
            {roleGens.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 10, borderRadius: 3, padding: '1px 6px',
                color:      GEN_COLOR[chartGen === 'all' ? roleGens[0] : chartGen] ?? '#6366f1',
                background: (GEN_COLOR[chartGen === 'all' ? roleGens[0] : chartGen] ?? '#6366f1') + '18',
              }}>
                {chartGen === 'all' ? roleGens.join(' + ') : `${chartGen} uniquement`}
              </span>
            )}
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>{showChart ? '▲' : '▼'}</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {chartGen === 'all'
              ? `${chartGroupedData.length || barData.length} variété(s)`
              : `${barData.length} variété(s) · ${chartGen} seulement`
            }
          </span>
        </div>

        {showChart && (
          <div style={{ padding: '12px 20px 16px' }}>

            {/* ── Barre de filtres — visible uniquement si le rôle couvre ≥ 2 générations ── */}
            {roleGens.length >= 2 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>

                {/* Totaux par génération — contexte décisionnel */}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                  {roleGens.map((g, idx) => {
                    const total = agregeStocks
                      .filter(st => st.codeGeneration === g)
                      .reduce((s: number, st: any) => s + (parseFloat(st.quantiteTotale) || 0), 0)
                    return (
                      <span key={g}>
                        {idx > 0 && <span style={{ margin: '0 4px' }}>·</span>}
                        <span style={{ fontWeight: 700, color: GEN_COLOR[g] ?? '#6b7280' }}>
                          {g} : {fmtT(total)}
                        </span>
                      </span>
                    )
                  })}
                </span>

                {/* Bouton "Total toutes générations" */}
                <button
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); setChartGen('all') }}
                  style={{
                    padding: '4px 14px', borderRadius: 20, border: '1.5px solid',
                    borderColor:  chartGen === 'all' ? (GEN_COLOR[roleGens[0]] ?? '#6366f1') : 'var(--border)',
                    background:   chartGen === 'all' ? ((GEN_COLOR[roleGens[0]] ?? '#6366f1') + '14') : 'var(--surface)',
                    color:        chartGen === 'all' ? (GEN_COLOR[roleGens[0]] ?? '#6366f1') : 'var(--text-muted)',
                    fontSize: 12, fontWeight: chartGen === 'all' ? 700 : 400,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  Total {roleGens.join(' + ')}
                </button>

                {/* Un bouton par génération du rôle */}
                {roleGens.map(gen => (
                  <button
                    key={gen}
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setChartGen(gen) }}
                    style={{
                      padding: '4px 14px', borderRadius: 20, border: '1.5px solid',
                      borderColor:  chartGen === gen ? (GEN_COLOR[gen] ?? '#6b7280') : 'var(--border)',
                      background:   chartGen === gen ? ((GEN_COLOR[gen] ?? '#6b7280') + '14') : 'var(--surface)',
                      color:        chartGen === gen ? (GEN_COLOR[gen] ?? '#6b7280') : 'var(--text-muted)',
                      fontSize: 12, fontWeight: chartGen === gen ? 700 : 400,
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    {gen} seulement
                  </button>
                ))}
              </div>
            )}

            {/* Graphe groupé (mode total) ou simple (mode génération unique) */}
            {chartGen === 'all' && chartGroupedData.length > 0
              ? <MultiGenBarChart data={chartGroupedData} gens={roleGens} />
              : <StockBarChart data={barData} />
            }

            {/* Légende — fixe en mode groupé, déduite des données en mode simple */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, justifyContent: 'center' }}>
              {chartGen === 'all' && chartGroupedData.length > 0
                ? roleGens.map(gen => (
                    <div key={gen} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: GEN_COLOR[gen] ?? '#6b7280' }} />
                      {gen}
                    </div>
                  ))
                : Object.entries(GEN_COLOR).map(([gen, color]) => {
                    if (!barData.some(d => d.color === color)) return null
                    return (
                      <div key={gen} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                        {gen}
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )}
      </div>

      {/* Inventory table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Database size={15} /></span>
            Inventaire agrégé par variété / site
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{stocks.length} groupe{stocks.length > 1 ? 's' : ''}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManage && (
              <button className="btn btn-secondary" onClick={() => setShowStockForm(true)}><Plus size={13} /> Enregistrer stock</button>
            )}
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowMvtForm(true)}><Plus size={13} /> Mouvement</button>
            )}
            {stocks.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ gap: 5 }}
                onClick={() => {
                  const date = new Date().toISOString().slice(0, 10)

                  const inventaireRows = stocks.map((st: any) => {
                    const kg = parseFloat(st.quantiteTotale) || 0
                    return [st.codeGeneration ?? '', st.nomEspece ?? '', st.nomVariete ?? '', st.codeVariete ?? '', st.codeSite ?? '', Math.round(kg), parseFloat((kg / 1000).toFixed(3)), Number(st.nbLots) || 0]
                  })
                  const totalKg = stocks.reduce((s: number, st: any) => s + (parseFloat(st.quantiteTotale) || 0), 0)
                  const totalLotsCnt = stocks.reduce((s: number, st: any) => s + (Number(st.nbLots) || 0), 0)
                  inventaireRows.push(['TOTAL', '', '', '', '', Math.round(totalKg), parseFloat((totalKg / 1000).toFixed(3)), totalLotsCnt])

                  const mvtRows = movements.map((m: any) => {
                    const lot = lotMap[m.idLot]
                    const variete = lot ? varMap[lot.idVariete] : null
                    const kg = parseFloat(m.quantite) || 0
                    return [formatDateForExport(m.createdAt), MVT_STYLE[m.typeMouvement]?.label ?? m.typeMouvement ?? '', lot?.codeLot ?? String(m.idLot), variete?.nomVariete ?? '', m.siteSource?.codeSite ?? '', m.siteDestination?.codeSite ?? '', Math.round(kg), parseFloat((kg / 1000).toFixed(3)), m.referenceOperation ?? '', m.usernameOperateur ?? '']
                  })

                  const especeMap: Record<string, { nom: string; varietes: Set<string>; kg: number; lots: number }> = {}
                  agregeStocks.forEach((st: any) => {
                    const code = st.codeEspece ?? st.nomEspece ?? 'Inconnu'
                    if (!especeMap[code]) especeMap[code] = { nom: st.nomEspece ?? code, varietes: new Set(), kg: 0, lots: 0 }
                    especeMap[code].varietes.add(st.codeVariete ?? st.nomVariete ?? '')
                    especeMap[code].kg += parseFloat(st.quantiteTotale) || 0
                    especeMap[code].lots += Number(st.nbLots) || 0
                  })
                  const especeRows = Object.values(especeMap)
                    .sort((a, b) => b.kg - a.kg)
                    .map(e => [e.nom, e.varietes.size, Math.round(e.kg), parseFloat((e.kg / 1000).toFixed(3)), e.lots])

                  downloadXlsx(`senjiw-stock-${date}`, [
                    { name: 'Inventaire', headers: ['Génération', 'Espèce', 'Variété', 'Code variété', 'Site', 'Quantité (kg)', 'Quantité (t)', 'Nb lots'], rows: inventaireRows },
                    { name: 'Mouvements', headers: ['Date', 'Type', 'Code lot', 'Variété', 'Site source', 'Site destination', 'Quantité (kg)', 'Quantité (t)', 'Référence', 'Opérateur'], rows: mvtRows },
                    { name: 'Par espèce',  headers: ['Espèce', 'Nb variétés en stock', 'Stock total (kg)', 'Stock total (t)', 'Nb lots'], rows: especeRows },
                  ])
                }}
              >
                <Download size={13} /> Export .xls
              </button>
            )}
            <button
              className="btn btn-secondary"
              style={{ gap: 5, background: showHistory ? 'var(--surface-2)' : undefined }}
              onClick={() => { setShowHistory(h => !h); setHistoryLotId(null) }}
            >
              <Archive size={13} /> Historique
            </button>
            <button className="btn btn-secondary btn-icon" onClick={() => fetchAll(true)} disabled={refreshing}><RefreshCw size={13} /></button>
          </div>
        </div>

        {/* Site tabs */}
        {!loading && siteList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>Sites :</span>
            <button
              className={'gen-chain-btn ' + (!site ? 'active' : '')}
              style={{ background: !site ? 'var(--green-50)' : 'transparent', color: 'var(--green-700)' }}
              onClick={() => setSite('')}
            >Tous</button>
            {siteList.map((s: any) => (
              <button
                key={s}
                className={'gen-chain-btn ' + (site === s ? 'active' : '')}
                style={{ background: site === s ? 'var(--blue-50)' : 'transparent', color: 'var(--blue-700)' }}
                onClick={() => setSite(site === s ? '' : s)}
              >
                <MapPin size={10} />{s}
              </button>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <FormInput
                value={filterSearch}
                onChange={(e: { target: { value: string } }) => setFilterSearch(e.target.value)}
                placeholder="Lot, variété, espèce…"
                style={{ paddingLeft: 28, width: 210 }}
              />
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">Génération</label>
            <FormSelect value={filterGen} onChange={(e: { target: { value: string } }) => setFilterGen(e.target.value)}>
              <option value="">Toutes</option>
              {genOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </FormSelect>
          </div>
          {(filterSearch || filterGen || site) && (
            <button className="btn btn-ghost" onClick={() => { setFilterSearch(''); setFilterGen(''); setSite('') }}>
              <X size={12} /> Effacer filtres
            </button>
          )}
        </div>

        {/* Table agrégée */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Génération</th>
                <th>Espèce</th>
                <th>Variété</th>
                <th>Site</th>
                <th>Quantité totale</th>
                <th>Lots</th>
                <th>Enregistré le</th>
                <th style={{ width: 120 }}>Niveau relatif</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0, 1, 2, 3, 4].map(i => (
                    <tr key={i}><td colSpan={9}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>
                  ))
                : stocks.length === 0
                  ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state">
                          <div className="empty-icon"><Database size={20} /></div>
                          <div className="empty-title">
                            Aucun stock{isUPSemCL ? ' G1/G2/G3' : isSelector ? ' G0/G1' : ''} trouvé
                          </div>
                          {canManage && (
                            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowMvtForm(true)}>+ Enregistrer un mouvement</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                  : stocks.flatMap(row => {
                      const rowKey   = `${row.idVariete}-${row.idGeneration}-${row.idSite}`
                      const isExp    = expandedRows.has(rowKey)
                      const qty      = parseFloat(row.quantiteTotale) || 0
                      const pct      = Math.min(100, Math.round((qty / maxQty) * 100))
                      const barColor = pct > 60 ? '#16a34a' : pct > 30 ? '#f59e0b' : '#ef4444'
                      const gen      = row.codeGeneration || '—'

                      const rows: any[] = [
                        <tr
                          key={rowKey}
                          style={{ cursor: 'pointer', background: isExp ? 'var(--surface-2)' : undefined }}
                          onClick={() => toggleRow(rowKey)}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <ChevronDown
                              size={13}
                              style={{
                                color: 'var(--text-muted)',
                                transform: isExp ? 'rotate(0deg)' : 'rotate(-90deg)',
                                transition: 'transform 0.18s',
                              }}
                            />
                          </td>
                          <td>
                            {gen !== '—'
                              ? <span className={`badge ${GEN_BADGE[gen] || 'badge-gray'}`}>{gen}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{row.nomEspece || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.codeEspece}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{row.nomVariete}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.codeVariete}</div>
                          </td>
                          <td>
                            <span className="badge badge-blue" style={{ gap: 4 }}>
                              <MapPin size={10} />{row.codeSite}
                            </span>
                            {row.nomSite && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{row.nomSite}</div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{qty.toLocaleString('fr-FR')}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 12 }}>{row.unite || 'kg'}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {row.nbLots} lot{row.nbLots > 1 ? 's' : ''}
                            </span>
                          </td>
                          <td>
                            {row.createdAt
                              ? <div>
                                  <div style={{ fontSize: 12, fontWeight: 500 }}>
                                    {new Date(row.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {new Date(row.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 99, transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      ]

                      if (isExp) {
                        rows.push(
                          <tr key={`${rowKey}-detail`}>
                            <td colSpan={9} style={{ padding: 0, borderTop: 'none' }}>
                              <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '8px 16px 14px 48px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Code lot</th>
                                      <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Quantité</th>
                                      <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Statut</th>
                                      <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Campagne</th>
                                      <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>Enregistré le</th>
                                      {canManage && <th style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 6, borderBottom: '1px solid var(--border)' }} />}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(row.lotsDetail ?? []).map((d: any) => {
                                      const dQty   = parseFloat(d.quantite) || 0
                                      const dDate  = d.createdAt
                                        ? new Date(d.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : '—'
                                      const canTransfer = transferRule
                                        && transferRule.allowedGens.includes(gen)
                                        && dQty > 0
                                        && d.statut === 'DISPONIBLE'
                                      return (
                                        <tr key={d.idLot}>
                                          <td style={{ padding: '6px 8px 6px 0', fontSize: 12 }}>
                                            <span className="td-mono" style={{ fontSize: 11 }}>{d.codeLot}</span>
                                          </td>
                                          <td style={{ padding: '6px 8px', fontSize: 12 }}>
                                            <span style={{ fontWeight: 700 }}>{dQty.toLocaleString('fr-FR')}</span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 11 }}>{d.unite || row.unite}</span>
                                          </td>
                                          <td style={{ padding: '6px 8px', fontSize: 12 }}>
                                            <StatutBadge statut={d.statut} />
                                          </td>
                                          <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>{d.campagne || '—'}</td>
                                          <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{dDate}</td>
                                          {canManage && (
                                            <td style={{ padding: '6px 0 6px 8px', textAlign: 'right' }}>
                                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                <button
                                                  className="btn btn-ghost btn-icon"
                                                  style={{ padding: '3px 5px' }}
                                                  title="Historique des mouvements"
                                                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); setHistoryLotId(d.idLot); setShowHistory(true) }}
                                                >
                                                  <Archive size={12} />
                                                </button>
                                                {canTransfer && (
                                                  <button
                                                    className="btn btn-ghost btn-icon"
                                                    style={{ padding: '3px 5px', color: '#7e22ce' }}
                                                    title={`Transférer vers ${transferRule!.destination}`}
                                                    onClick={(e: React.MouseEvent) => {
                                                      e.stopPropagation()
                                                      openTransferFromStock(
                                                        { id: d.idStock, idLot: d.idLot, quantiteDisponible: d.quantite, unite: d.unite || row.unite },
                                                        { id: d.idLot, codeLot: d.codeLot, statutLot: d.statut, campagne: d.campagne, idVariete: row.idVariete, generation: { codeGeneration: gen } }
                                                      )
                                                    }}
                                                  >
                                                    <ArrowRightLeft size={12} />
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )
                      }

                      return rows
                    })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement history */}
      {showHistory && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><Archive size={15} /></span>
              Historique des mouvements
              <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filteredMvts.length}</span>
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {historyLotId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Lot : <strong style={{ color: 'var(--text-primary)' }}>{lotMap[historyLotId]?.codeLot ?? '#' + historyLotId}</strong>
                  </span>
                  <button
                    style={{ border: 'none', background: '#0ea5e915', cursor: 'pointer', color: '#0ea5e9', fontSize: 11, padding: '2px 6px', borderRadius: 4 } as any}
                    onClick={() => setHistoryLotId(null)}
                  >Voir tout</button>
                </div>
              )}
              <button className="btn btn-ghost btn-icon" onClick={() => setShowHistory(false)}><X size={13} /></button>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Code Lot</th>
                  <th>Variété</th>
                  <th>Site source</th>
                  <th>Site destination</th>
                  <th>Quantité</th>
                  <th>Référence</th>
                  <th>Opérateur</th>
                </tr>
              </thead>
              <tbody>
                {filteredMvts.length === 0
                  ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state">
                          <div className="empty-title">Aucun mouvement enregistré</div>
                        </div>
                      </td>
                    </tr>
                  )
                  : filteredMvts.slice(0, 100).map((m: any) => {
                      const lot     = lotMap[m.idLot]
                      const variete = lot ? varMap[lot.idVariete] : null
                      const ms      = MVT_STYLE[m.typeMouvement] ?? { label: m.typeMouvement, color: '#6b7280', bg: '#f9fafb' }
                      const date    = m.createdAt
                        ? new Date(m.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'
                      return (
                        <tr key={m.id}>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{date}</td>
                          <td>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: ms.bg, color: ms.color, whiteSpace: 'nowrap' }}>
                              {ms.label}
                            </span>
                          </td>
                          <td><span className="td-mono" style={{ fontSize: 11 }}>{lot?.codeLot ?? '#' + m.idLot}</span></td>
                          <td><span style={{ fontSize: 11 }}>{variete?.nomVariete ?? '—'}</span></td>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.siteSource?.codeSite ?? '—'}</span></td>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.siteDestination?.codeSite ?? '—'}</span></td>
                          <td>
                            <span style={{ fontWeight: 700 }}>{parseFloat(m.quantite).toLocaleString('fr-FR')}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 11 }}>{m.unite}</span>
                          </td>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.referenceOperation ?? '—'}</span></td>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.usernameOperateur ?? '—'}</span></td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {showStockForm && (
        <Modal title="Enregistrer un Stock" subtitle="Définir la quantité d'un lot sur un site (illimitée)" onClose={() => setShowStockForm(false)} size="sm">
          <form onSubmit={submitStock}>
            <Field label="Lot semencier" required hint="Rechercher par code lot ou variété">
              <LotDropdown lots={availableLots} value={stockForm.idLot} onChange={v => setStockForm(f => ({ ...f, idLot: v }))} varMap={varMap} />
            </Field>
            <Field label="Site de stockage" required>
              <FormSelect value={stockForm.siteCode} onChange={(e: { target: { value: string } }) => setStockForm(f => ({ ...f, siteCode: e.target.value }))}>
                <option value="">— Sélectionner un site —</option>
                {sitesList.map((s: any) => (
                  <option key={s.id} value={s.codeSite}>{s.codeSite}{s.nomSite ? ` — ${s.nomSite}` : ''}</option>
                ))}
              </FormSelect>
            </Field>
            <FormRow>
              <Field label="Quantité" required>
                <FormInput type="number" value={stockForm.quantite} onChange={(e: { target: { value: string } }) => setStockForm(f => ({ ...f, quantite: e.target.value }))} placeholder="1000" min="0" step="0.01" required />
              </Field>
              <Field label="Unité">
                <FormSelect value={stockForm.unite} onChange={(e: { target: { value: string } }) => setStockForm(f => ({ ...f, unite: e.target.value }))}>
                  <option value="kg">kg</option>
                  <option value="t">t</option>
                  <option value="g">g</option>
                </FormSelect>
              </Field>
            </FormRow>
            <FormActions onCancel={() => setShowStockForm(false)} loading={saving} submitLabel="Enregistrer le stock" />
          </form>
        </Modal>
      )}

      {showMvtForm && (
        <Modal title="Mouvement de Stock" subtitle="Enregistrer une entrée, sortie ou transfert de semences" onClose={() => setShowMvtForm(false)}>
          <form onSubmit={submitMvt}>
            <FormRow>
              <Field label="Lot semencier" required>
                <LotDropdown lots={availableLots} value={mvtForm.idLot} onChange={v => setMvtForm(f => ({ ...f, idLot: v }))} varMap={varMap} />
              </Field>
              <Field label="Type de mouvement" required>
                <FormSelect value={mvtForm.type} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="IN">↓ IN — Entrée en stock</option>
                  <option value="OUT">↑ OUT — Sortie de stock</option>
                  <option value="TRANSFER">⇄ TRANSFER — Transfert entre sites</option>
                </FormSelect>
              </Field>
            </FormRow>
            {(mvtForm.type === 'IN' || mvtForm.type === 'TRANSFER') && (
              <Field label="Site destination" required hint="Site qui reçoit les semences">
                <FormSelect value={mvtForm.siteDestinationCode} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, siteDestinationCode: e.target.value }))}>
                  <option value="">— Sélectionner un site —</option>
                  {sitesList.map((s: any) => (
                    <option key={s.id} value={s.codeSite}>{s.codeSite}{s.nomSite ? ` — ${s.nomSite}` : ''}</option>
                  ))}
                </FormSelect>
              </Field>
            )}
            {(mvtForm.type === 'OUT' || mvtForm.type === 'TRANSFER') && (
              <Field label="Site source" required hint="Site d'où partent les semences">
                <FormSelect value={mvtForm.siteSourceCode} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, siteSourceCode: e.target.value }))}>
                  <option value="">— Sélectionner un site —</option>
                  {sitesList.map((s: any) => (
                    <option key={s.id} value={s.codeSite}>{s.codeSite}{s.nomSite ? ` — ${s.nomSite}` : ''}</option>
                  ))}
                </FormSelect>
              </Field>
            )}
            <FormRow>
              <Field label="Quantité" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={mvtForm.quantite} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, quantite: e.target.value }))} placeholder="500" min="0.01" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={mvtForm.unite} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}>
                    <option value="kg">kg</option>
                    <option value="t">t</option>
                  </FormSelect>
                </div>
              </Field>
              <Field label="Référence opération">
                <FormInput value={mvtForm.reference} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, reference: e.target.value }))} placeholder="REF-2026-001" />
              </Field>
            </FormRow>
            <FormActions onCancel={() => setShowMvtForm(false)} loading={saving} submitLabel="Enregistrer le mouvement" />
          </form>
        </Modal>
      )}

      {editStock && (
        <Modal
          title="Modifier le stock"
          subtitle={`${lotMap[editStock.idLot]?.codeLot ?? '#' + editStock.idLot} — ${editStock.site?.codeSite ?? ''}`}
          onClose={() => setEditStock(null)}
          size="sm"
        >
          <form onSubmit={submitEdit}>
            <Field label="Nouvelle quantité disponible" required hint="Capacité illimitée — BigDecimal(14,2) côté serveur">
              <div style={{ display: 'flex', gap: 8 }}>
                <FormInput
                  type="number"
                  value={editForm.quantite}
                  onChange={(e: { target: { value: string } }) => setEditForm(f => ({ ...f, quantite: e.target.value }))}
                  min="0"
                  step="0.01"
                  required
                  style={{ flex: 1 }}
                />
                <FormSelect value={editForm.unite} onChange={(e: { target: { value: string } }) => setEditForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}>
                  <option value="kg">kg</option>
                  <option value="t">t</option>
                  <option value="g">g</option>
                </FormSelect>
              </div>
            </Field>
            <FormActions onCancel={() => setEditStock(null)} loading={saving} submitLabel="Mettre à jour" />
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Confirmer la suppression" subtitle="Cette action est irréversible" onClose={() => setDeleteTarget(null)} size="sm">
          <div style={{ paddingBottom: 8 }}>
            <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>Entrée à supprimer</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Lot <strong>{lotMap[deleteTarget.idLot]?.codeLot ?? '#' + deleteTarget.idLot}</strong>
                {' '}— Site <strong>{deleteTarget.site?.codeSite}</strong>
              </div>
              <div style={{ fontSize: 13, color: '#dc2626', marginTop: 4 }}>
                Quantité : {parseFloat(deleteTarget.quantiteDisponible).toLocaleString('fr-FR')} {deleteTarget.unite}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: 'white', border: 'none' }}
                onClick={doDelete}
                disabled={saving}
              >
                {saving ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showTransferForm && transferSource && transferRule && (
        <Modal
          title="Transférer vers l'organisation"
          subtitle={`${transferRule.source}  →  ${transferRule.destination}`}
          onClose={() => { setShowTransferForm(false); setTransferSource(null) }}
          size="sm"
        >
          <form onSubmit={submitTransferFromStock}>
            {/* Lot info — lecture seule */}
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    Lot sélectionné
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                      background: (GEN_COLOR[transferSource.lot?.generation?.codeGeneration] ?? '#6b7280') + '22',
                      color: GEN_COLOR[transferSource.lot?.generation?.codeGeneration] ?? '#6b7280',
                    }}>
                      {transferSource.lot?.generation?.codeGeneration || '—'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{transferSource.lot?.codeLot}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {varMap[transferSource.lot?.idVariete]?.nomVariete || '—'}
                    {varMap[transferSource.lot?.idVariete]?.espece?.nomCommun && ` · ${varMap[transferSource.lot?.idVariete].espece.nomCommun}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Disponible</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                    {parseFloat(transferSource.stock.quantiteDisponible).toLocaleString('fr-FR')}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>{transferSource.stock.unite || 'kg'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flux organisations */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: '#0369a115', border: '1px solid #0369a133', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0c4a6e', marginTop: 2 }}>{transferRule.source}</div>
              </div>
              <ArrowRightLeft size={16} style={{ color: '#7e22ce', flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: '#7e22ce15', border: '1px solid #7e22ce33', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destination</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#581c87', marginTop: 2 }}>{transferRule.destination}</div>
              </div>
            </div>

            {(() => {
              const eligibles = membres.filter((m: any) => m.keycloakRole === transferRule.destRoleKey)
              return (
                <Field label="Destinataire" required hint={`Rôle : ${transferRule.destination}`}>
                  <FormSelect
                    value={transferForm.usernameDestinataire}
                    onChange={(e: { target: { value: string } }) => setTransferForm(f => ({ ...f, usernameDestinataire: e.target.value }))}
                    required
                  >
                    <option value="">— Sélectionner un destinataire —</option>
                    {eligibles.length === 0
                      ? <option disabled value="">Aucun membre {transferRule.destination} enregistré</option>
                      : eligibles.map((m: any) => (
                        <option key={m.id} value={m.keycloakUsername}>
                          {m.nomComplet || m.keycloakUsername}{m.organisation?.nomOrganisation ? ` — ${m.organisation.nomOrganisation}` : ''}
                        </option>
                      ))
                    }
                  </FormSelect>
                </Field>
              )
            })()}

            {(() => {
              const dispo    = parseFloat(transferSource.stock.quantiteDisponible) || 0
              const saisi    = parseFloat(transferForm.quantite) || 0
              const restant  = dispo - saisi
              const trop     = saisi > dispo
              const total    = saisi > 0 && saisi === dispo
              const unite    = transferSource.stock.unite || 'kg'
              return (
                <Field
                  label="Quantité à transférer"
                  required
                  hint={`Stock disponible : ${dispo.toLocaleString('fr-FR')} ${unite}`}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <FormInput
                      type="number"
                      value={transferForm.quantite}
                      onChange={(e: { target: { value: string } }) => setTransferForm(f => ({ ...f, quantite: e.target.value }))}
                      min="0.01"
                      max={String(dispo)}
                      step="0.01"
                      required
                      placeholder={`ex. ${Math.round(dispo / 2).toLocaleString('fr-FR')}`}
                      style={{ flex: 1, borderColor: trop ? 'var(--red-500)' : undefined }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{unite}</span>
                  </div>
                  {saisi > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11.5, display: 'flex', gap: 12 }}>
                      {trop ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>
                          ✗ Dépasse le stock disponible ({dispo.toLocaleString('fr-FR')} {unite})
                        </span>
                      ) : (
                        <>
                          <span style={{ color: '#15803d', fontWeight: 600 }}>
                            → Transféré : {saisi.toLocaleString('fr-FR')} {unite}
                          </span>
                          <span style={{ color: total ? '#b45309' : 'var(--text-muted)', fontWeight: total ? 600 : 400 }}>
                            · Restant : {restant.toLocaleString('fr-FR')} {unite}
                            {total && ' ⚠ Lot entièrement transféré'}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </Field>
              )
            })()}

            <Field label="Observations">
              <FormInput
                value={transferForm.observations}
                onChange={(e: { target: { value: string } }) => setTransferForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Commentaires, conditions de transfert…"
              />
            </Field>

            <FormActions
              onCancel={() => { setShowTransferForm(false); setTransferSource(null) }}
              loading={transferSaving}
              submitLabel={`Initier le transfert vers ${transferRule.destination}`}
            />
          </form>
        </Modal>
      )}
    </div>
  )
}
