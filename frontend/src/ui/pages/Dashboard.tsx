import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, ShoppingCart, Leaf,
  RefreshCw, Plus, Database, ArrowRight,
  Search, Filter, X, TrendingUp,
  Navigation, MapPin, Clock, Download,
} from 'lucide-react'
import { api }             from '../../lib/api'
import { endpoints }       from '../../lib/endpoints'
import { normalizeLot, normalizeVariete, normalizeStock, extractList } from '../../lib/normalizers'
import { SelectorAnalytics } from './SelectorAnalytics'
import { PendingDeliveries } from '../components/PendingDeliveries'
import { MapSemences }     from '../components/MapSemences'
import { TD as D }         from '../../lib/tokens'
import { downloadXlsx, formatDateForExport, type XlsxSheet } from '../../lib/exportUtils'
import { GEN_CHART_COLORS } from '../../lib/constants'

interface Props { roleKey: string; userSpecialisation?: string | null }

interface GenStat { nbLots: number; totalKg: number }
interface Stats {
  lotsCount:       number
  stockTotal:      number
  ordersCount:     number
  varietiesCount:  number
  ordersPending:   number
  genStats:        Record<string, GenStat>
  recentLots:      any[]
}
interface BarDatum  { label: string; value: number; color: string; gen: string }
interface StockRow {
  codeEspece: string; nomEspece: string; codeVariete: string; nomVariete: string
  generation: string; stockKg: number; nbLots: number; demandKg: number
}
type StockSortKey = 'nomEspece' | 'nomVariete' | 'generation' | 'stockKg' | 'nbLots' | 'demandKg'

/* ── Couleurs par rôle ── */
const ROLE_CFG: Record<string, { color: string; label: string }> = {
  'seed-admin':         { color: '#7c3aed', label: 'Administrateur ISRA' },
  'seed-selector':      { color: '#0369a1', label: 'Sélectionneur' },
  'seed-upsemcl':       { color: '#0f766e', label: 'UPSemCL' },
  'seed-multiplicator': { color: '#15803d', label: 'Multiplicateur' },
  'seed-quotataire':    { color: '#b45309', label: 'Quotataire / OP' },
}

/* ── Couleurs par génération ── */
// Palette unifiée avec Lots.tsx et Stocks.tsx
const GEN_COLOR = GEN_CHART_COLORS
const GEN_CFG: Record<string, { bg: string; color: string }> = {
  G0: { bg: '#eef2ff', color: GEN_COLOR.G0 },
  G1: { bg: '#f0f9ff', color: GEN_COLOR.G1 },
  G2: { bg: '#f0fdf4', color: GEN_COLOR.G2 },
  G3: { bg: '#fffbeb', color: GEN_COLOR.G3 },
  G4: { bg: '#fff7ed', color: GEN_COLOR.G4 },
  R1: { bg: '#fdf2f8', color: GEN_COLOR.R1 },
  R2: { bg: '#f0fdfa', color: GEN_COLOR.R2 },
}
const GEN_LABELS: Record<string, string> = {
  G0: 'Noyau génétique', G1: 'Pré-base',  G2: 'Base',
  G3: 'Certifiée C1',    G4: 'Certifiée C2', R1: 'R1', R2: 'Commerciale R2',
}
const GEN_LABEL: Record<string, string> = {
  G0: 'Génétique', G1: 'Pré-base', G2: 'Base',
  G3: 'Certif. C1', G4: 'Certif. C2', R1: 'R1', R2: 'Commerciale',
}
const ROLE_GENS: Record<string, string[]> = {
  'seed-admin':         ['G0','G1','G2','G3','G4','R1','R2'],
  'seed-selector':      ['G0','G1'],
  'seed-upsemcl':       ['G1','G2','G3'],
  'seed-multiplicator': ['G3','G4','R1','R2'],
  'seed-quotataire':    ['R2'],
}

const GREETINGS: Record<string, { title: string; sub: string }> = {
  'seed-admin':         { title: "Vue d'ensemble complète",   sub: 'Supervision de toute la chaîne semencière G0→R2' },
  'seed-selector':      { title: 'Vos lots G0 et G1',         sub: 'Gérez les semences génétiques avant transfert vers UPSemCL' },
  'seed-upsemcl':       { title: 'Centre de multiplication',  sub: 'Suivi des lots G1→G3 et gestion des stocks UPSemCL' },
  'seed-multiplicator': { title: 'Production G3→R2',          sub: 'Vos lots de multiplication et stocks disponibles' },
  'seed-quotataire':    { title: 'Espace Quotataire',         sub: 'Consultez le catalogue et passez vos commandes de semences' },
}

const REFRESH_MS = 15_000

/* ────────────────── hook count-up ────────────────── */
function useCountUp(target: number, delay = 0, enabled = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!enabled) return
    setVal(0)
    let raf = 0
    const tid = setTimeout(() => {
      const t0 = performance.now()
      const dur = 700
      function tick(now: number) {
        const p = Math.min((now - t0) / dur, 1)
        const e = 1 - Math.pow(1 - p, 3)
        setVal(Math.round(e * target))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => { clearTimeout(tid); cancelAnimationFrame(raf) }
  }, [target, enabled, delay])
  return val
}

/* ────────────────── KPI Card ────────────────── */
function KpiCard({ index, label, value, sub, accent, delay, suffix }: {
  index: number; label: string; value: number
  sub?: string; accent: string; delay: number; suffix?: string
}) {
  const [vis, setVis] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t) }, [delay])
  const displayed = useCountUp(value, delay + 80, vis)
  return (
    <div className="kpi-card-outer">
      <div className="kpi-card-dot" />
      <div
        className="kpi-card-inner"
        style={{
          background: '#fff',
          borderRadius: 12,
          border: `1px solid ${D.line}`,
          padding: '18px 22px 20px',
          opacity: vis ? 1 : 0,
          transform: vis ? 'translateY(0)' : 'translateY(18px)',
          transition: 'opacity 0.44s ease, transform 0.44s ease',
          cursor: 'default',
        }}
      >
        {/* Label */}
        <div style={{
          fontFamily: D.mono, fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: D.muted, marginBottom: 12,
        }}>
          {label}
        </div>

        {/* Valeur principale */}
        <div style={{ lineHeight: 1, marginBottom: sub ? 10 : 0 }}>
          <span style={{
            fontFamily: D.display, fontSize: 34, fontWeight: 700,
            letterSpacing: '-0.03em', color: D.ink,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {displayed.toLocaleString('fr-FR')}
          </span>
          {suffix && (
            <span style={{ fontFamily: D.mono, fontSize: 13, fontWeight: 500, color: D.muted, marginLeft: 5 }}>
              {suffix}
            </span>
          )}
        </div>

        {/* Sous-info */}
        {sub && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, display: 'inline-block', opacity: 0.8 }} />
            <span style={{ fontFamily: D.body, fontSize: 11, color: D.muted, lineHeight: 1 }}>{sub}</span>
          </div>
        )}
      </div>
    </div>
  )
}

import { fmtT, fmtTCentre, fmtKgTable } from '../../lib/fmt'

/* ────────────────── Donut Chart ────────────────── */
function DonutChart({ data }: { data: { label: string; value: number; color: string; gen: string }[] }) {
  const [hov, setHov] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const R = 62; const ri = 42; const cx = 76; const cy = 76
  let angle = -Math.PI / 2

  const arcs = data.map((d) => {
    const sweep = (d.value / total) * 2 * Math.PI
    const x1 = cx + R * Math.cos(angle);        const y1 = cy + R * Math.sin(angle)
    const x2 = cx + R * Math.cos(angle + sweep); const y2 = cy + R * Math.sin(angle + sweep)
    const xi1 = cx + ri * Math.cos(angle);        const yi1 = cy + ri * Math.sin(angle)
    const xi2 = cx + ri * Math.cos(angle + sweep); const yi2 = cy + ri * Math.sin(angle + sweep)
    const large = sweep > Math.PI ? 1 : 0
    const path = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${xi2.toFixed(2)} ${yi2.toFixed(2)} A ${ri} ${ri} 0 ${large} 0 ${xi1.toFixed(2)} ${yi1.toFixed(2)} Z`
    angle += sweep
    return { ...d, path, pct: Math.round((d.value / total) * 100) }
  })

  const active = hov !== null ? arcs[hov] : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={152} height={152} style={{ flexShrink: 0, overflow: 'visible' }}>
        {arcs.map((arc, i) => (
          <path key={i} d={arc.path}
            fill={arc.color}
            opacity={hov === null ? 0.88 : hov === i ? 1 : 0.3}
            stroke={D.paper} strokeWidth={2.5}
            style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={14} fontWeight={700} fontFamily={D.display} fill={active ? active.color : D.ink}>
          {fmtTCentre(active ? active.value : total)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fontFamily={D.mono} fill={D.muted}>
          {active ? active.gen : 'Production'}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize={8} fontFamily={D.mono} fill={D.muted}>
          {active ? '' : 'totale'}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
        {arcs.map((arc, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
            opacity: hov === null ? 1 : hov === i ? 1 : 0.3,
            transition: 'opacity 0.15s',
          }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: arc.color, flexShrink: 0 }} />
            <span style={{ fontFamily: D.mono, fontSize: 9.5, fontWeight: 700, color: arc.color, width: 20, flexShrink: 0 }}>{arc.gen}</span>
            <span style={{ fontFamily: D.mono, fontSize: 9.5, fontWeight: 500, color: D.ink, flex: 1, letterSpacing: '0.01em' }}>
              {fmtT(arc.value)}
            </span>
            <span style={{ fontFamily: D.mono, fontSize: 9, color: D.muted, width: 30, textAlign: 'right', flexShrink: 0 }}>{arc.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ────────────────── BarChart SVG ────────────────── */
function BarChart({ data, yLabel = 'Stock disponible (t)' }: { data: BarDatum[]; yLabel?: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (data.length === 0) return null

  const max    = Math.max(...data.map(d => d.value), 1)
  const H      = 180
  const PAD_T  = 20; const PAD_B = 44; const PAD_L = 52; const PAD_R = 12
  const W      = 520
  const innerH = H - PAD_T - PAD_B
  const innerW = W - PAD_L - PAD_R
  const barW   = innerW / data.length
  const TICKS  = 4

  const magnitude = Math.pow(10, Math.floor(Math.log10(max || 1)))
  const niceMax   = Math.ceil(max / magnitude) * magnitude

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        {data.map((d, i) => (
          <linearGradient key={i} id={`db-bar-g${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={d.color} stopOpacity={hovered === i ? 1 : 0.88} />
            <stop offset="100%" stopColor={d.color} stopOpacity={hovered === i ? 0.75 : 0.45} />
          </linearGradient>
        ))}
      </defs>

      {/* Grille horizontale */}
      {Array.from({ length: TICKS + 1 }, (_, t) => {
        const y = PAD_T + (t / TICKS) * innerH
        const v = Math.round(niceMax * (1 - t / TICKS))
        return (
          <g key={t}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke="var(--border)" strokeWidth={t === TICKS ? 1.5 : 0.7}
              strokeDasharray={t === TICKS ? '0' : '3,4'} />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end"
              fontSize={9} fill="var(--text-muted)" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
              {fmtT(v)}
            </text>
          </g>
        )
      })}

      {/* Barres */}
      {data.map((d, i) => {
        const bh    = (d.value / niceMax) * innerH
        const x     = PAD_L + i * barW + barW * 0.14
        const bw    = barW * 0.72
        const y     = PAD_T + innerH - bh
        const isHov = hovered === i
        return (
          <g key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}>
            {isHov && <rect x={x + 2} y={y + 2} width={bw} height={bh} rx={5} fill={d.color} opacity={0.12} />}
            <rect x={x} y={y} width={bw} height={Math.max(bh, 2)}
              rx={5} fill={`url(#db-bar-g${i})`} style={{ transition: 'all 0.15s' }} />
            {d.value > 0 && (
              <text x={x + bw / 2} y={y - 5} textAnchor="middle"
                fontSize={isHov ? 10 : 9} fontWeight={700} fill={d.color} fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
                style={{ transition: 'font-size 0.1s' }}>
                {fmtT(d.value)}
              </text>
            )}
            <text x={x + bw / 2} y={PAD_T + innerH + 14} textAnchor="middle"
              fontSize={9} fill={isHov ? d.color : 'var(--text-secondary)'}
              fontWeight={isHov ? 700 : 400} fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
              {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
            </text>
            <text x={x + bw / 2} y={PAD_T + innerH + 26} textAnchor="middle"
              fontSize={8} fill={d.color} fontWeight={600} fontFamily="Plus Jakarta Sans, system-ui, sans-serif" opacity={0.8}>
              {d.gen}
            </text>
            {isHov && (
              <g>
                <rect x={x + bw / 2 - 46} y={y - 42} width={92} height={32} rx={5} fill="var(--text-primary)" opacity={0.92} />
                <text x={x + bw / 2} y={y - 28} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={700} fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
                  {d.label}
                </text>
                <text x={x + bw / 2} y={y - 16} textAnchor="middle" fontSize={9} fill={d.color} fontWeight={600} fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
                  {fmtT(d.value)} · {GEN_LABEL[d.gen] ?? d.gen}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {/* Label axe Y */}
      <text x={10} y={PAD_T + innerH / 2} textAnchor="middle"
        fontSize={9} fill="var(--text-muted)" fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
        transform={`rotate(-90, 10, ${PAD_T + innerH / 2})`}>
        {yLabel}
      </text>
    </svg>
  )
}

/* ────────────────── Horizontal Bar Chart ────────────────── */
function HBarChart({ data }: { data: BarDatum[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => {
        const pct   = (d.value / max) * 100
        const isHov = hovered === i
        return (
          <div key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: 'grid', gridTemplateColumns: '154px 1fr 88px', alignItems: 'center', gap: 10, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{
                fontSize: 11.5, fontWeight: 500, color: isHov ? D.ink : D.muted,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: 'color 0.15s', flex: 1,
              }}>
                {d.label}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                background: GEN_CFG[d.gen]?.bg ?? '#f8f8f8',
                color: GEN_COLOR[d.gen] ?? '#6b7280',
                border: `1px solid ${GEN_COLOR[d.gen] ?? '#6b7280'}28`,
              }}>{d.gen}</span>
            </div>
            <div style={{ position: 'relative', height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${pct}%`, background: d.color, borderRadius: 99,
                opacity: isHov ? 1 : 0.82,
                transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1), opacity 0.15s',
              }} />
            </div>
            <div style={{
              fontSize: 11.5, fontWeight: 700, textAlign: 'right',
              fontVariantNumeric: 'tabular-nums', fontFamily: D.mono,
              color: isHov ? d.color : 'var(--text-secondary)',
              transition: 'color 0.15s',
            }}>
              {fmtT(d.value)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Distance badge (vert/amber/gris selon km) ── */
function distBadge(km: number) {
  if (km < 80)  return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
  if (km < 150) return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' }
  return { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
}

/* ═══════════════════════════════════════════════════════════
   QUOTATAIRE HOME — Widgets dédiés
═══════════════════════════════════════════════════════════ */
const ORDER_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  SOUMISE:        { label: 'Soumise',       color: '#d97706', bg: '#fffbeb' },
  ACCEPTEE:       { label: 'Acceptée',      color: '#0369a1', bg: '#eff6ff' },
  EN_PREPARATION: { label: 'En préparation',color: '#0f766e', bg: '#f0fdfa' },
  LIVREE:         { label: 'Livrée',        color: '#16a34a', bg: '#f0fdf4' },
  ANNULEE:        { label: 'Annulée',       color: '#dc2626', bg: '#fef2f2' },
  REJETEE:        { label: 'Rejetée',       color: '#7c3aed', bg: '#faf5ff' },
}

function QuotataireHome({ accent, navigate, rawOrders }: {
  accent: string
  navigate: ReturnType<typeof useNavigate>
  rawOrders: any[]
}) {
  const [stocks,     setStocks]     = useState<any[]>([])
  const [proches,    setProches]    = useState<any[]>([])
  const [geoReady,   setGeoReady]   = useState(false)
  const [loadingCat, setLoadingCat] = useState(true)
  const [loadingGeo, setLoadingGeo] = useState(true)

  useEffect(() => {
    api.get(endpoints.catalogue)
      .then(r => setStocks(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoadingCat(false))

    if (!navigator.geolocation) { setLoadingGeo(false); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        api.get(`${endpoints.catalogueProximite}?lat=${lat}&lng=${lng}&rayonKm=300`)
          .then(r => { setProches(Array.isArray(r.data) ? r.data : []); setGeoReady(true) })
          .catch(() => {})
          .finally(() => setLoadingGeo(false))
      },
      () => setLoadingGeo(false),
      { timeout: 8000, maximumAge: 300000 }
    )
  }, [])

  type EspeceRow = { code: string; nom: string; stockKg: number; nbVarietes: number; nbOrgs: number }
  const especeRows: EspeceRow[] = useMemo(() => {
    const map: Record<string, { nom: string; stockKg: number; v: Set<number>; o: Set<number> }> = {}
    for (const item of stocks) {
      const code = item.codeEspece || '?'
      if (code === '?') continue
      if (!map[code]) map[code] = { nom: item.nomEspece || code, stockKg: 0, v: new Set(), o: new Set() }
      map[code].stockKg += item.quantiteDisponible || 0
      map[code].v.add(item.varieteId)
      map[code].o.add(item.organisationId)
    }
    return Object.entries(map)
      .map(([code, d]) => ({ code, nom: d.nom, stockKg: d.stockKg, nbVarietes: d.v.size, nbOrgs: d.o.size }))
      .sort((a, b) => b.stockKg - a.stockKg)
  }, [stocks])

  type OrgRow = { orgId: number; orgNom: string; region: string; distanceKm?: number; stockKg: number; nbVarietes: number }
  const orgRows: OrgRow[] = useMemo(() => {
    const map: Record<number, OrgRow> = {}
    for (const item of proches) {
      const id = item.organisationId
      if (!map[id]) map[id] = { orgId: id, orgNom: item.nomOrganisation, region: item.region, distanceKm: item.distanceKm, stockKg: 0, nbVarietes: 0 }
      map[id].stockKg += item.quantiteDisponible || 0
      map[id].nbVarietes++
      if (item.distanceKm != null && (map[id].distanceKm == null || item.distanceKm < map[id].distanceKm!))
        map[id].distanceKm = item.distanceKm
    }
    return Object.values(map).sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)).slice(0, 5)
  }, [proches])

  const recentOrders = useMemo(
    () => [...rawOrders].sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).slice(0, 4),
    [rawOrders]
  )
  const pendingCount = rawOrders.filter(o => ['SOUMISE', 'ACCEPTEE', 'EN_PREPARATION'].includes(o.statut ?? '')).length

  const maxKg = especeRows[0]?.stockKg ?? 1

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

      {/* ── Stocks disponibles par espèce ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${D.line}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${D.line}`, background: D.paper2, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Database size={13} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: D.ink }}>Semences R1/R2 disponibles</div>
            <div style={{ fontSize: 11, color: D.muted }}>Stocks certifiés — toutes espèces</div>
          </div>
          <button onClick={() => navigate('/catalogue')}
            style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Voir catalogue →
          </button>
        </div>
        {loadingCat ? (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 32, borderRadius: 8 }} />)}
          </div>
        ) : especeRows.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: D.muted, fontSize: 13 }}>Aucun stock disponible</div>
        ) : (
          <div style={{ padding: '12px 20px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {especeRows.map(row => (
              <div key={row.code} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: D.ink }}>{row.nom}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <div style={{ flex: 1, height: 4, background: '#f0f4f0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(row.stockKg / maxKg) * 100}%`, background: '#16a34a', borderRadius: 99, transition: 'width 0.7s ease' }} />
                    </div>
                    <span style={{ fontSize: 10, color: D.muted, flexShrink: 0 }}>{row.nbVarietes} var. · {row.nbOrgs} fourn.</span>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#16a34a', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {fmtT(row.stockKg)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Multiplicateurs proches ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${D.line}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${D.line}`, background: D.paper2, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Navigation size={13} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: D.ink }}>
              {geoReady ? 'Multiplicateurs proches' : 'Multiplicateurs agréés'}
            </div>
            <div style={{ fontSize: 11, color: D.muted }}>
              {geoReady ? 'Rayon 300 km · triés par distance' : 'Activez la géoloc pour trier par proximité'}
            </div>
          </div>
          <button onClick={() => navigate('/catalogue')}
            style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Voir sur carte →
          </button>
        </div>

        {loadingGeo ? (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : orgRows.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: D.muted }}>
            <MapPin size={28} style={{ opacity: 0.25, marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>
              {geoReady ? 'Aucun multiplicateur dans un rayon de 300 km' : 'Accédez au catalogue pour localiser les fournisseurs'}
            </div>
            <button onClick={() => navigate('/catalogue')}
              style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: accent, background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 7, padding: '6px 14px', cursor: 'pointer' }}>
              Accéder au catalogue
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {orgRows.map((org, idx) => (
              <div key={org.orgId}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: idx < orgRows.length - 1 ? `1px solid ${D.line}` : 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: idx === 0 ? '#eff6ff' : D.paper2, border: `1.5px solid ${idx === 0 ? '#bfdbfe' : D.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: idx === 0 ? '#1d4ed8' : D.muted, flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: D.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{org.orgNom}</div>
                  <div style={{ fontSize: 10.5, color: D.muted, marginTop: 1 }}>
                    <MapPin size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />{org.region} · {org.nbVarietes} variété{org.nbVarietes > 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {org.distanceKm != null && (() => {
                    const km = Math.round(org.distanceKm!)
                    const dc = distBadge(km)
                    const h  = Math.ceil(km / 50)
                    return (
                      <div style={{ fontSize: 11, fontWeight: 700, color: dc.color, background: dc.bg, border: `1px solid ${dc.border}`, padding: '1px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                        <Navigation size={9} /> {km} km · ~{h}h
                      </div>
                    )
                  })()}
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                    {fmtT(org.stockKg)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Commandes récentes (pleine largeur) ── */}
      {rawOrders.length > 0 && (
        <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 14, border: `1px solid ${D.line}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          {pendingCount > 0 && (
            <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '9px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#f59e0b', color: '#fff', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                {pendingCount} en attente
              </span>
              <span style={{ fontSize: 11.5, color: '#92400e', flex: 1 }}>
                {pendingCount === 1 ? 'Une commande nécessite votre suivi' : `${pendingCount} commandes nécessitent votre suivi`}
              </span>
              <button onClick={() => navigate('/orders')}
                style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                Voir <ArrowRight size={11} />
              </button>
            </div>
          )}
          <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${D.line}`, background: D.paper2, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accent}12`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShoppingCart size={13} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: D.ink }}>Mes commandes</div>
              <div style={{ fontSize: 11, color: D.muted }}>
                {rawOrders.length} commande{rawOrders.length > 1 ? 's' : ''} au total
              </div>
            </div>
            <button onClick={() => navigate('/orders')}
              style={{ fontSize: 11, fontWeight: 600, color: accent, background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Toutes les commandes →
            </button>
          </div>
          <div>
            {recentOrders.map((o: any, idx) => {
              const s = ORDER_STATUS_CFG[o.statut] ?? { label: o.statut ?? '—', color: '#6b7280', bg: '#f3f4f6' }
              const nbLignes = o.lignes?.length ?? 0
              return (
                <div key={o.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px', borderBottom: idx < recentOrders.length - 1 ? `1px solid ${D.line}` : 'none' }}>
                  <span style={{ fontFamily: D.mono, fontSize: 12, fontWeight: 700, color: D.ink, minWidth: 160 }}>
                    {o.codeCommande ?? `CMD-${o.id}`}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 11.5, color: D.muted, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nbLignes > 0 ? `${nbLignes} variété${nbLignes > 1 ? 's' : ''}` : '—'}
                    {o.observations ? ` · ${o.observations}` : ''}
                  </span>
                  {o.createdAt && (
                    <span style={{ fontSize: 10.5, color: D.muted, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} />
                      {new Date(o.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════ */
export function Dashboard({ roleKey, userSpecialisation }: Props) {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    lotsCount: 0, stockTotal: 0, ordersCount: 0, varietiesCount: 0,
    ordersPending: 0, genStats: {}, recentLots: [],
  })
  const [rawLots,      setRawLots]      = useState<any[]>([])
  const [rawStocks,    setRawStocks]    = useState<any[]>([])
  const [rawVarieties, setRawVarieties] = useState<any[]>([])
  const [rawOrders,    setRawOrders]    = useState<any[]>([])
  const [rawAgrege,    setRawAgrege]    = useState<any[]>([])
  const [rawPrograms,  setRawPrograms]  = useState<any[]>([])
  const [varMap,       setVarMap]       = useState<Record<number, string>>({})
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [heroVis,      setHeroVis]      = useState(false)
  const [mapExpanded,  setMapExpanded]  = useState(true)
  const [demandPeriod, setDemandPeriod] = useState<'1m' | '3m' | '6m' | '1a'>('3m')
  const [demandGen,    setDemandGen]    = useState<'all' | 'G3' | 'R2'>('all')

  /* Stock filters */
  const [filterEspece,   setFilterEspece]   = useState('')
  const [filterVariete,  setFilterVariete]  = useState('')
  const [filterGens, setFilterGens] = useState<string[]>(() => ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2'])
  const [stockSortCol,   setStockSortCol]   = useState<StockSortKey>('stockKg')
  const [stockSortAsc,   setStockSortAsc]   = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  useEffect(() => { const t = setTimeout(() => setHeroVis(true), 50); return () => clearTimeout(t) }, [])

  async function fetchAll(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    const isMulti   = roleKey === 'seed-multiplicator'
    const isUpsemcl = roleKey === 'seed-upsemcl'
    const isSel     = roleKey === 'seed-selector'
    // UPSemCL et multiplicateur utilisent mes-lots (non paginé, filtré par org)
    const lotsUrl   = (isMulti || isUpsemcl) ? endpoints.lotsMesLots   : endpoints.lots
    // UPSemCL et multiplicateur utilisent mon-stock (filtré par org, sans pagination)
    const stocksUrl = (isMulti || isUpsemcl) ? endpoints.stockMonStock : endpoints.stocks
    const ordersUrl = isMulti ? endpoints.ordersATraiter : endpoints.orders

    const results = await Promise.allSettled([
      api.get(lotsUrl), api.get(stocksUrl), api.get(ordersUrl), api.get(endpoints.varieties),
      api.get(endpoints.stocksAgrege), api.get(endpoints.lotsStats),
      api.get(endpoints.programs),
    ])

    const lots      = extractList(results[0].status === 'fulfilled' ? results[0].value.data : []).map(normalizeLot)
    const stocks    = extractList(results[1].status === 'fulfilled' ? results[1].value.data : []).map(normalizeStock)
    const orders    = extractList(results[2].status === 'fulfilled' ? results[2].value.data : [])
    const varieties = extractList(results[3].status === 'fulfilled' ? results[3].value.data : []).map(normalizeVariete)
    const agrege    = results[4].status === 'fulfilled' && results[4].value
      ? extractList(results[4].value.data)
      : []

    const rawStats = results[5].status === 'fulfilled'
      ? (Array.isArray(results[5].value.data) ? results[5].value.data : [])
      : []
    const programs  = results[6].status === 'fulfilled'
      ? extractList(results[6].value.data)
      : []
    // UPSemCL/multi/sélectionneur : count depuis leurs lots filtrés, tonnes depuis agrege (stock physique)
    // Autres rôles (admin, quotataire) : stats globales depuis /lots/stats
    const genStats: Record<string, GenStat> = {}
    if (isMulti || isUpsemcl || isSel) {
      lots.forEach((l: any) => {
        const g = l.generation?.codeGeneration ?? 'N/A'
        if (!genStats[g]) genStats[g] = { nbLots: 0, totalKg: 0 }
        genStats[g].nbLots++
      })
      agrege.forEach((s: any) => {
        const g = s.codeGeneration ?? 'N/A'
        if (!genStats[g]) genStats[g] = { nbLots: 0, totalKg: 0 }
        genStats[g].totalKg += parseFloat(s.quantiteTotale) || 0
      })
    } else {
      rawStats.forEach((s: any) => {
        genStats[s.codeGeneration] = { nbLots: Number(s.nbLots ?? 0), totalKg: Number(s.totalKg ?? 0) }
      })
    }
    // UPSemCL/multi/sélectionneur : lotsCount depuis leurs lots filtrés
    const lotsCount = (isMulti || isUpsemcl || isSel)
      ? lots.length
      : Object.values(genStats).reduce((s, g) => s + g.nbLots, 0)

    // stockTotal : agrege (filtré par org pour UPSemCL/multiplicateur) > mon-stock > fallback stocks paginé
    const stockTotal = (isMulti || isUpsemcl)
      ? agrege.reduce((s: number, x: any) => s + (parseFloat(x.quantiteTotale) || 0), 0)
      : stocks.reduce((s: number, x: any) => s + (parseFloat(x.quantiteDisponible) || 0), 0)
    const ordersPending = orders.filter((o: any) => o.statut === 'SOUMISE').length
    const recentLots    = [...lots].sort((a: any, b: any) => (b.id || 0) - (a.id || 0)).slice(0, 8)

    const vm: Record<number, string> = {}
    varieties.forEach((v: any) => { if (v.id) vm[v.id] = v.nomVariete ?? v.codeVariete ?? `#${v.id}` })

    setVarMap(vm)
    setRawLots(lots)
    setRawStocks(stocks)
    setRawVarieties(varieties)
    setRawOrders(orders)
    setRawAgrege(agrege)
    setRawPrograms(programs)
    // UPSemCL/multi/sélectionneur : variétés actives depuis leurs lots filtrés
    const varietiesCount = (isMulti || isUpsemcl || isSel)
      ? new Set(lots.map((l: any) => l.idVariete).filter(Boolean)).size
      : varieties.length
    setStats({ lotsCount, stockTotal, ordersCount: orders.length, varietiesCount, ordersPending, genStats, recentLots })
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(() => fetchAll(true), REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [roleKey])

  useEffect(() => {
    setFilterGens(ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2'])
  }, [roleKey])

  const role     = ROLE_CFG[roleKey] || { color: '#16a34a', label: 'Tableau de bord' }
  const accent   = role.color
  const greeting = GREETINGS[roleKey] || { title: 'Tableau de bord', sub: "Vue d'ensemble" }

  const pipelineTitle = roleKey === 'seed-selector'      ? 'Production prébase · G0 → G1'
    : roleKey === 'seed-upsemcl'       ? 'Multiplication base · G1 → G3'
    : roleKey === 'seed-multiplicator' ? 'Multiplication commerciale · G3 → R2'
    : roleKey === 'seed-quotataire'    ? 'Semences commerciales · R2'
    : 'Chaîne semencière · G0 → R2'

  const HERO_CFG: Record<string, { border: string; tagBg: string; tagColor: string; tagBorder: string }> = {
    'seed-admin':         { border: '#6d28d9', tagBg: '#f5f3ff', tagColor: '#5b21b6', tagBorder: '#ddd6fe' },
    'seed-selector':      { border: '#0369a1', tagBg: '#eff6ff', tagColor: '#1e40af', tagBorder: '#bfdbfe' },
    'seed-upsemcl':       { border: '#0f766e', tagBg: '#f0fdfa', tagColor: '#0f766e', tagBorder: '#99f6e4' },
    'seed-multiplicator': { border: '#15803d', tagBg: '#f0fdf4', tagColor: '#15803d', tagBorder: '#bbf7d0' },
    'seed-quotataire':    { border: '#b45309', tagBg: '#fffbeb', tagColor: '#92400e', tagBorder: '#fde68a' },
  }
  const heroCfg = HERO_CFG[roleKey] ?? { border: accent, tagBg: '#f8faf8', tagColor: accent, tagBorder: '#e3e8e3' }
  const maxGenKg    = Math.max(1, ...Object.values(stats.genStats).map(g => g.totalKg))
  const maxGenCount = Math.max(1, ...Object.values(stats.genStats).map(g => g.nbLots))

  const isQuotaire   = roleKey === 'seed-quotataire'
  const showStats    = !isQuotaire
  const showPipeline = ['seed-admin', 'seed-selector', 'seed-upsemcl'].includes(roleKey)
  const showLots     = !isQuotaire
  const showOrders   = isQuotaire || ['seed-admin', 'seed-upsemcl', 'seed-multiplicator'].includes(roleKey)
  const showStock    = ['seed-admin', 'seed-upsemcl'].includes(roleKey)

  const isSelector = roleKey === 'seed-selector'
  const specUp     = userSpecialisation?.toUpperCase()

  const displayStockTotal = useMemo(() => {
    if (!isSelector || !specUp) return Math.round(stats.stockTotal)
    // stocksAgrege a codeEspece directement + quantiteTotale — pas de pagination problématique
    return Math.round(rawAgrege
      .filter((s: any) => (s.codeEspece ?? '').toUpperCase() === specUp)
      .reduce((sum: number, s: any) => sum + (parseFloat(s.quantiteTotale) || 0), 0))
  }, [isSelector, specUp, rawAgrege, stats.stockTotal])

  const displayVarietiesCount = useMemo(() => {
    if (!isSelector || !specUp) return stats.varietiesCount
    const activeStatuts = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT','SOUCHE']
    const varIds = new Set<number>()
    rawLots.forEach((l: any) => {
      const statut = (l.statut ?? l.statutLot ?? '').toUpperCase()
      if (!activeStatuts.includes(statut)) return
      const varId = Number(l.idVariete ?? l.varieteId)
      if (varId) varIds.add(varId)
    })
    return varIds.size
  }, [isSelector, specUp, rawLots, stats.varietiesCount])

  /* Items KPI selon le rôle */
  const kpiItems = [
    ...(showStats ? [
      { label: 'Total lots',
        value: stats.lotsCount,
        sub: 'tous statuts',
        accent, delay: 0, suffix: undefined },
      { label: isSelector && specUp ? `Stock ${specUp}` : 'Stock total',
        value: isSelector ? Math.round(displayStockTotal) : Math.round(displayStockTotal / 1000),
        sub: isSelector && specUp ? 'votre spécialisation' : undefined,
        accent, delay: 80, suffix: isSelector ? 'kg' : 't' },
    ] : []),
    { label: isSelector && specUp ? `Variétés ${specUp}` : 'Variétés actives',
      value: displayVarietiesCount,
      sub: isSelector && specUp ? 'de votre espèce' : 'variétés certifiées',
      accent, delay: showStats ? 160 : 0, suffix: undefined },
    ...(showOrders ? [
      { label: roleKey === 'seed-multiplicator' ? 'Cmdes reçues' : 'Commandes',
        value: stats.ordersCount, sub: `${stats.ordersPending} en attente`, accent, delay: showStats ? 240 : 80, suffix: undefined },
    ] : []),
  ]

  /* ── Stock computation ── */
  const allowedStockGens = ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2']
  const varietyMap: Record<number, any> = Object.fromEntries(rawVarieties.map((v: any) => [v.id, v]))

  const stockRowMap: Record<string, StockRow> = {}
  rawAgrege.forEach((s: any) => {
    const gen = s.codeGeneration ?? '?'
    if (!allowedStockGens.includes(gen)) return
    const codeVariete = s.codeVariete ?? '?'
    if (codeVariete === '?') return
    const key = `${codeVariete}|${gen}`
    if (!stockRowMap[key]) stockRowMap[key] = {
      codeEspece:  s.codeEspece  ?? '?',
      nomEspece:   s.nomEspece   ?? s.codeEspece ?? '?',
      codeVariete,
      nomVariete:  s.nomVariete  ?? codeVariete,
      generation:  gen,
      stockKg: 0, nbLots: 0, demandKg: 0,
    }
    stockRowMap[key].stockKg += parseFloat(s.quantiteTotale) || 0
    stockRowMap[key].nbLots  += Number(s.nbLots) || 0
  })

  const stockRows: StockRow[] = Object.values(stockRowMap).sort((a, b) => {
    const va = a[stockSortCol], vb = b[stockSortCol]
    if (typeof va === 'string') return stockSortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va as string)
    return stockSortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })

  function thSort(col: StockSortKey) {
    if (stockSortCol === col) setStockSortAsc(v => !v)
    else { setStockSortCol(col); setStockSortAsc(false) }
  }

  const especeMap: Record<string, string> = {}
  rawVarieties.forEach((v: any) => {
    const code = v.espece?.codeEspece; const nom = v.espece?.nomEspece
    if (code && code !== '?') especeMap[code] = nom ?? code
  })
  const especeOptions = Object.keys(especeMap).sort()

  const filteredStockRows = stockRows.filter(r =>
    (!filterEspece  || r.codeEspece === filterEspece) &&
    filterGens.includes(r.generation) &&
    (!filterVariete || r.codeVariete.toLowerCase().includes(filterVariete.toLowerCase())
                    || r.nomVariete.toLowerCase().includes(filterVariete.toLowerCase()))
  )
  const filteredStockBarData: BarDatum[] = [...filteredStockRows]
    .sort((a, b) => b.stockKg - a.stockKg)
    .map(r => ({ label: r.codeVariete, value: Math.round(r.stockKg), color: GEN_COLOR[r.generation] ?? '#6b7280', gen: r.generation }))

  const stockTotalAll      = stockRows.reduce((s, r) => s + r.stockKg, 0)
  const stockTotalFiltered = filteredStockRows.reduce((s, r) => s + r.stockKg, 0)
  const stockMaxKg         = Math.max(1, ...filteredStockRows.map(r => r.stockKg))
  const hasStockFilter     = !!(filterEspece || filterVariete || filterGens.length < allowedStockGens.length)

  /* ── Couverture stock / demande par espèce ──
     Stock : via rawAgrege (codeEspece + codeGeneration déjà résolus, pas de pagination)
     Demande : via rawOrders (commandes actives) + résolution lot→variete→espece via rawAgrege */
  const especeCovMap: Record<string, { nom: string; stockKg: number; demandKg: number }> = {}
  rawAgrege.forEach((s: any) => {
    const gen  = s.codeGeneration ?? '?'
    if (!allowedStockGens.includes(gen)) return
    const code = s.codeEspece ?? '?'
    if (code === '?') return
    if (!especeCovMap[code]) especeCovMap[code] = { nom: s.nomEspece ?? code, stockKg: 0, demandKg: 0 }
    especeCovMap[code].stockKg += parseFloat(s.quantiteTotale) || 0
  })
  rawOrders.forEach((o: any) => {
    if (!['SOUMISE','ACCEPTEE','EN_PREPARATION'].includes(o.statut ?? '')) return
    ;(o.lignes ?? []).forEach((ligne: any) => {
      const gen  = ligne.generation?.codeGeneration ?? '?'
      if (!allowedStockGens.includes(gen)) return
      const variety = varietyMap[ligne.idVariete ?? -1] ?? {}
      const esp     = variety.espece ?? {}
      const code    = esp.codeEspece ?? '?'
      if (code === '?') return
      if (!especeCovMap[code]) especeCovMap[code] = { nom: esp.nomEspece ?? code, stockKg: 0, demandKg: 0 }
      especeCovMap[code].demandKg += parseFloat(ligne.quantiteDemandee ?? 0) || 0
    })
  })
  const coverageItems = Object.entries(especeCovMap)
    .map(([code, v]) => ({ code, nom: v.nom, stockKg: v.stockKg, demandKg: v.demandKg, ratio: v.demandKg > 0 ? v.stockKg / v.demandKg : 99 }))
    .filter(c => c.stockKg > 0 || c.demandKg > 0)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 8)
  const maxCovKg     = Math.max(...coverageItems.map(c => Math.max(c.stockKg, c.demandKg)), 1)
  const criticalCov  = coverageItems.filter(c => c.demandKg > 0 && c.ratio < 1).length
  const warningCov   = coverageItems.filter(c => c.demandKg > 0 && c.ratio >= 1 && c.ratio < 2).length

  /* ── Prévisions de récolte (Programmes EN_COURS) ──
     Un programme "En cours" = multiplication physiquement en production.
     On utilise superficieHa + objectifKg du Programme comme données prévisionnelles. */
  const forecastByGen: Record<string, { lots: number; ha: number; expectedKg: number }> = {}
  rawPrograms.forEach((p: any) => {
    const statut = (p.statut ?? '').toUpperCase()
    if (statut !== 'EN_COURS') return
    const gen = p.generationCible ?? '?'
    if (!allowedStockGens.includes(gen)) return
    const ha       = parseFloat(p.superficieHa ?? 0) || 0
    const expected = parseFloat(p.objectifKg ?? 0) || 0
    if (!forecastByGen[gen]) forecastByGen[gen] = { lots: 0, ha: 0, expectedKg: 0 }
    forecastByGen[gen].lots++
    forecastByGen[gen].ha += ha
    forecastByGen[gen].expectedKg += expected
  })
  const forecastEntries   = Object.entries(forecastByGen).filter(([_, f]) => f.lots > 0).sort(([a], [b]) => allowedStockGens.indexOf(a) - allowedStockGens.indexOf(b))
  const totalForecastKg   = forecastEntries.reduce((s, [_, f]) => s + f.expectedKg, 0)
  const maxForecastKg     = Math.max(...forecastEntries.map(([_, f]) => f.expectedKg), 1)
  const totalForecastLots = forecastEntries.reduce((s, [_, f]) => s + f.lots, 0)
  const totalForecastHa   = forecastEntries.reduce((s, [_, f]) => s + f.ha, 0)

  /* ── Lots à certifier (alertes) ── */
  const lotsACertifierCount = rawLots.filter((l: any) =>
    allowedStockGens.includes(l.generation?.codeGeneration ?? '') &&
    (l.statut === 'EN_COURS_CERT')
  ).length

  const hasAnyAlerts = criticalCov > 0 || warningCov > 0 || lotsACertifierCount > 0 || stats.ordersPending > 0

  /* ── Demande annuelle par variété (UPSemCL · Sélectionneurs · Multiplicateurs) ── */
  const showDemandWidget = ['seed-upsemcl', 'seed-selector', 'seed-multiplicator', 'seed-admin'].includes(roleKey)
  const DEMAND_DAYS: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '1a': 365 }
  const demandCutoff = Date.now() - (DEMAND_DAYS[demandPeriod] ?? 90) * 86_400_000

  type DemandEntry = { nomVariete: string; codeEspece: string; g3kg: number; r2kg: number; g3Orders: Set<number>; r2Orders: Set<number> }
  const demandMap: Record<string, DemandEntry> = {}

  if (showDemandWidget) {
    rawOrders.forEach((o: any) => {
      if (['ANNULEE', 'REJETEE'].includes(o.statut ?? '')) return
      if (!o.createdAt || new Date(o.createdAt).getTime() < demandCutoff) return
      ;(o.lignes ?? []).forEach((ligne: any) => {
        const gen      = ligne.generation?.codeGeneration ?? '?'
        const isG3type = ['G0','G1','G2','G3','G4'].includes(gen)
        const isR2type = ['R1','R2'].includes(gen)
        if (!isG3type && !isR2type) return
        const variety = varietyMap[ligne.idVariete ?? -1] ?? {}
        if (!variety.codeVariete) return
        if (roleKey === 'seed-selector' && userSpecialisation && variety.espece?.codeEspece !== userSpecialisation) return
        const qty = parseFloat(ligne.quantiteDemandee ?? 0) || 0
        const key = variety.codeVariete
        if (!demandMap[key]) demandMap[key] = {
          nomVariete: variety.nomVariete ?? key,
          codeEspece: variety.espece?.codeEspece ?? '?',
          g3kg: 0, r2kg: 0, g3Orders: new Set(), r2Orders: new Set(),
        }
        if (isG3type) { demandMap[key].g3kg += qty; demandMap[key].g3Orders.add(o.id ?? 0) }
        else          { demandMap[key].r2kg += qty; demandMap[key].r2Orders.add(o.id ?? 0) }
      })
    })
  }

  // Stock G3 disponible par variété — signal de couverture pour UPSemCL et Admin
  const stockG3ByVariete: Record<string, number> = {}
  rawAgrege.forEach((s: any) => {
    if (!['G1','G2','G3'].includes(s.codeGeneration ?? '')) return
    const codeVar = s.codeVariete ?? ''
    if (codeVar) stockG3ByVariete[codeVar] = (stockG3ByVariete[codeVar] ?? 0) + (parseFloat(s.quantiteTotale) || 0)
  })

  const demandEntries = Object.entries(demandMap)
    .map(([code, d]) => ({
      code,
      nomVariete: d.nomVariete,
      codeEspece: d.codeEspece,
      g3kg: d.g3kg,
      r2kg: d.r2kg,
      total: d.g3kg + d.r2kg,
      g3OrderCount: d.g3Orders.size,
      r2OrderCount: d.r2Orders.size,
      stockG3: stockG3ByVariete[code] ?? 0,
    }))
    .filter(d => demandGen === 'G3' ? d.g3kg > 0 : demandGen === 'R2' ? d.r2kg > 0 : d.total > 0)
    .sort((a, b) => demandGen === 'G3' ? b.g3kg - a.g3kg : demandGen === 'R2' ? b.r2kg - a.r2kg : b.total - a.total)
    .slice(0, roleKey === 'seed-admin' ? 10 : 6)

  const demandMax     = Math.max(...demandEntries.map(d => demandGen === 'G3' ? d.g3kg : demandGen === 'R2' ? d.r2kg : d.total), 1)
  const demandTotalKg = demandEntries.reduce((s, d) => s + (demandGen === 'G3' ? d.g3kg : demandGen === 'R2' ? d.r2kg : d.total), 0)
  const demandG3Total = demandEntries.reduce((s, d) => s + d.g3kg, 0)
  const demandR2Total = demandEntries.reduce((s, d) => s + d.r2kg, 0)

  return (
    <div>

      {/* ═══════════════ HERO BANNIÈRE ═══════════════ */}
      <div style={{
        marginBottom: 20,
        borderRadius: 12,
        background: '#fff',
        border: `1px solid ${D.line}`,
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 20,
        opacity: heroVis ? 1 : 0,
        transform: heroVis ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div>
          {/* Badge rôle */}
          <span style={{
            display: 'inline-block',
            fontFamily: D.mono, fontSize: 10, fontWeight: 600,
            color: heroCfg.tagColor,
            background: heroCfg.tagBg,
            border: `1px solid ${heroCfg.tagBorder}`,
            borderRadius: 6, padding: '3px 10px',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 14,
          }}>
            {role.label}
          </span>

          {/* Titre */}
          <h1 style={{
            fontFamily: D.display, fontSize: 26, fontWeight: 700,
            letterSpacing: '-0.025em', color: D.ink,
            lineHeight: 1.1, marginBottom: 6,
          }}>
            {greeting.title}
          </h1>

          {/* Sous-titre + date */}
          <p style={{ fontFamily: D.body, fontSize: 13, color: D.muted, lineHeight: 1.4 }}>
            {greeting.sub}
            <span style={{ color: D.line, margin: '0 8px' }}>·</span>
            <span style={{ color: D.muted, opacity: 0.7 }}>{today}</span>
          </p>
        </div>

        {/* Actualiser + actions rapides */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              style={{
                background: '#fff', border: `1px solid ${D.line}`,
                color: D.muted, fontFamily: D.body, fontSize: 12, fontWeight: 500,
                borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = heroCfg.border; (e.currentTarget as HTMLButtonElement).style.color = heroCfg.border }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = D.line; (e.currentTarget as HTMLButtonElement).style.color = D.muted }}
            >
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              Actualiser
            </button>
            {roleKey === 'seed-admin' && !loading && (
              <button
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10)
                  const totalStockKg = stockRows.reduce((s, r) => s + r.stockKg, 0)

                  const sheets: XlsxSheet[] = [
                    {
                      name: 'Synthèse',
                      headers: ['Indicateur', 'Valeur'],
                      rows: [
                        ['Date export',             today],
                        ['Nb variétés au catalogue', rawVarieties.length],
                        ['Nb lots',                  rawLots.length],
                        ['Stock total (kg)',          Math.round(totalStockKg)],
                        ['Stock total (t)',           parseFloat((totalStockKg / 1000).toFixed(3))],
                        ['Demande totale (kg)',       demandEntries.length > 0 ? Math.round(demandTotalKg) : '—'],
                        ['Demande totale (t)',        demandEntries.length > 0 ? parseFloat((demandTotalKg / 1000).toFixed(3)) : '—'],
                        ['Nb commandes',             rawOrders.length],
                        ['Commandes actives',        rawOrders.filter((o: any) => !['ANNULEE','REJETEE','LIVREE'].includes(o.statut ?? '')).length],
                      ],
                    },
                    {
                      name: 'Variétés',
                      headers: ['Code', 'Nom variété', 'Espèce', 'Origine', 'Statut', 'Cycle min (j)', 'Cycle max (j)', 'Rendement min (t/ha)', 'Rendement max (t/ha)', 'Année création', 'Année homologation', 'Sélectionneur', 'Nature génétique', 'Vocation'],
                      rows: rawVarieties.map((v: any) => [v.codeVariete, v.nomVariete, v.espece?.nomCommun ?? v.espece?.codeEspece ?? '', v.origine ?? '', v.statutVariete ?? '', v.cycleMin ?? '', v.cycleMax ?? '', v.rendementMin ?? '', v.rendementMax ?? '', v.anneeCreation ?? '', v.anneeHomologation ?? '', v.selectionneurPrincipal ?? '', v.natureGenetique ?? '', v.vocationCulturale ?? '']),
                    },
                    {
                      name: 'Lots',
                      headers: ['Code lot', 'Variété', 'Génération', 'Campagne', 'Quantité nette (kg)', 'Quantité nette (t)', 'Germination (%)', 'Pureté (%)', 'Superficie (ha)', 'Statut', 'Créé le', 'Responsable'],
                      rows: rawLots.map((l: any) => {
                        const kg = Number(l.quantiteNette) || 0
                        return [l.codeLot, l.variete?.nomVariete ?? l.nomVariete ?? '', l.generation?.codeGeneration ?? '', l.campagne ?? '', kg, parseFloat((kg / 1000).toFixed(3)), l.tauxGermination ?? '', l.puretePhysique ?? '', l.superficieHa ?? '', l.statutLot ?? l.statut ?? '', formatDateForExport(l.createdAt), l.responsableNom ?? '']
                      }),
                    },
                    {
                      name: 'Stock disponible',
                      headers: ['Espèce', 'Code espèce', 'Variété', 'Code variété', 'Génération', 'Stock (kg)', 'Stock (t)', 'Nb lots', 'Demande (kg)', 'Demande (t)'],
                      rows: stockRows.map(r => [r.nomEspece, r.codeEspece, r.nomVariete, r.codeVariete, r.generation, Math.round(r.stockKg), parseFloat((r.stockKg / 1000).toFixed(3)), r.nbLots, Math.round(r.demandKg), parseFloat((r.demandKg / 1000).toFixed(3))]),
                    },
                    ...(demandEntries.length > 0 ? [{
                      name: 'Demande variétés',
                      headers: ['Rang', 'Code variété', 'Variété', 'Espèce', 'G3 — Mult. (kg)', 'G3 — Mult. (t)', 'R2 — Quot. (kg)', 'R2 — Quot. (t)', 'Total (kg)', 'Total (t)', 'Part (%)'],
                      rows: demandEntries.map((d, i) => [
                        i + 1, d.code, d.nomVariete, d.codeEspece,
                        Math.round(d.g3kg), parseFloat((d.g3kg / 1000).toFixed(3)),
                        Math.round(d.r2kg), parseFloat((d.r2kg / 1000).toFixed(3)),
                        Math.round(d.total), parseFloat((d.total / 1000).toFixed(3)),
                        demandTotalKg > 0 ? Math.round((d.total / demandTotalKg) * 100) : 0,
                      ]),
                    }] : []),
                    {
                      name: 'Commandes',
                      headers: ['Code commande', 'Client', 'Statut', 'Acheteur (username)', 'Date création', 'Observations'],
                      rows: rawOrders.map((o: any) => [o.codeCommande ?? '', o.client ?? '', o.statut ?? '', o.usernameAcheteur ?? '', formatDateForExport(o.createdAt), o.observations ?? '']),
                    },
                  ]
                  downloadXlsx(`senjiw-dashboard-admin-${today}`, sheets)
                }}
                style={{
                  background: accent, border: `1px solid ${accent}`,
                  color: '#fff', fontFamily: D.body, fontSize: 12, fontWeight: 600,
                  borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                title="Exporter toutes les données en Excel multi-feuilles"
              >
                <Download size={12} /> Export complet .xls
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
              <button className="btn btn-primary" style={{ background: accent, borderColor: accent, fontSize: 12, padding: '6px 12px' }}
                onClick={() => navigate('/lots')}>
                <Plus size={12} /> Nouveau lot
              </button>
            )}
            {['seed-admin','seed-selector'].includes(roleKey) && (
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => navigate('/varieties')}>
                <Leaf size={12} /> Nouvelle variété
              </button>
            )}
            {isQuotaire && (
              <button className="btn btn-primary" style={{ background: accent, borderColor: accent, fontSize: 12, padding: '6px 12px' }}
                onClick={() => navigate('/catalogue')}>
                <ShoppingCart size={12} /> Passer une commande
              </button>
            )}
            {['seed-admin','seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => navigate('/stocks')}>
                <Database size={12} /> Mouvement stock
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiItems.length}, 1fr)`, gap: 14, marginBottom: 20 }}>
        {loading
          ? kpiItems.map((_, i) => (
              <div key={i} style={{ background: D.paper, borderRadius: 12, border: `1px solid ${D.line}`, borderLeft: `3px solid ${D.line}`, padding: '20px 22px' }}>
                <div className="skeleton" style={{ width: 20, height: 10, borderRadius: 3, marginBottom: 18 }} />
                <div className="skeleton" style={{ width: 72, height: 36, borderRadius: 6, marginBottom: 12 }} />
                <div className="skeleton" style={{ width: 100, height: 10, borderRadius: 3 }} />
              </div>
            ))
          : kpiItems.map((item, i) => (
              <KpiCard key={i}
                index={i} label={item.label} value={item.value}
                sub={item.sub} accent={item.accent} delay={item.delay} suffix={item.suffix}
              />
            ))
        }
      </div>

      {/* ═══════════════ WIDGETS QUOTATAIRE ═══════════════ */}
      {isQuotaire && !loading && (
        <QuotataireHome accent={accent} navigate={navigate} rawOrders={rawOrders} />
      )}

      {/* ══ Barre d'alertes compacte ══ */}
      {showStats && (
        <div style={{
          marginBottom: 20, padding: '10px 18px',
          background: '#fff', borderRadius: 10,
          border: `1px solid ${criticalCov > 0 ? '#fecaca' : hasAnyAlerts ? D.blueBorder : D.line}`,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          boxShadow: criticalCov > 0 ? '0 1px 8px rgba(220,38,38,0.07)' : 'none',
        }}>
          <span style={{ fontFamily: D.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.11em', color: D.muted, flexShrink: 0 }}>
            Pilotage
          </span>
          <span style={{ color: D.line, flexShrink: 0 }}>·</span>
          {loading ? (
            <div className="skeleton" style={{ width: 240, height: 14, borderRadius: 4 }} />
          ) : (
            ([
              { count: criticalCov,        label: criticalCov <= 1 ? 'espèce critique' : 'espèces critiques', clr: '#dc2626', bg: '#fef2f2', brd: '#fecaca', action: false },
              { count: warningCov,          label: 'en tension',                                                clr: '#d97706', bg: '#fffbeb', brd: '#fde68a', action: false },
              { count: lotsACertifierCount, label: 'lots à certifier',                                          clr: '#1e40af', bg: '#eff6ff', brd: '#bfdbfe', action: false },
              { count: stats.ordersPending, label: 'commandes en attente',                                      clr: accent,    bg: `${accent}0d`, brd: `${accent}30`, action: true },
            ] as { count: number; label: string; clr: string; bg: string; brd: string; action: boolean }[]).map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {i > 0 && <span style={{ color: D.line }}>·</span>}
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: D.body, fontSize: 12,
                    color: item.count > 0 ? item.clr : D.green,
                    fontWeight: item.count > 0 ? 600 : 400,
                    cursor: item.action && item.count > 0 ? 'pointer' : 'default',
                  }}
                  onClick={item.action && item.count > 0 ? () => navigate('/orders') : undefined}
                >
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                    background: item.count > 0 ? item.bg : D.greenSoft,
                    color: item.count > 0 ? item.clr : D.green,
                    border: `1px solid ${item.count > 0 ? item.brd : '#bbf7d0'}`,
                  }}>
                    {item.count > 0 ? '!' : '✓'}
                  </span>
                  {item.count} {item.label}
                  {item.action && item.count > 0 && <span style={{ fontSize: 11, opacity: 0.75 }}>→</span>}
                </span>
              </span>
            ))
          )}
        </div>
      )}

      {/* ═══════════════ PIPELINE GÉNÉRATIONNEL ═══════════════ */}
      {showPipeline && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${D.line}`, marginBottom: 20, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${D.line}`, display: 'flex', alignItems: 'center', gap: 12, background: D.paper2 }}>
            <span style={{ fontFamily: D.mono, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: D.green, background: D.greenSoft, padding: '3px 10px', borderRadius: 999 }}>Pipeline</span>
            <span style={{ fontFamily: D.display, fontSize: 15, fontWeight: 600, color: D.ink }}>{pipelineTitle}</span>
            {!loading && (
              <span style={{ marginLeft: 'auto', fontFamily: D.mono, fontSize: 10, fontWeight: 500, color: D.muted, background: D.paper2, border: `1px solid ${D.line}`, borderRadius: 999, padding: '3px 12px' }}>
                {stats.lotsCount.toLocaleString('fr-FR')} lots
              </span>
            )}
          </div>
          <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, alignItems: 'center' }}>

            {/* ── Flow générationnel ── */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {(ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2']).map((g, idx, arr) => {
                const cfg     = GEN_CFG[g]
                const stat    = loading ? null : (stats.genStats[g] ?? { nbLots: 0, totalKg: 0 })
                const count   = stat?.nbLots ?? 0
                const kgTotal = stat?.totalKg ?? 0
                const active  = count > 0
                const pct     = Math.round((count / maxGenCount) * 100)
                return (
                  <div key={g} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                      {/* Cercle génération */}
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: active ? cfg.bg : D.paper2,
                        border: `2px solid ${active ? cfg.color : D.line}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: D.mono, fontSize: 11, fontWeight: 700,
                        color: active ? cfg.color : D.muted,
                        boxShadow: active ? `0 2px 10px ${cfg.color}28` : 'none',
                        transition: 'all 0.3s ease',
                      }}>{g}</div>

                      {/* Compteur */}
                      <div style={{ textAlign: 'center', lineHeight: 1 }}>
                        {loading
                          ? <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 4, margin: '0 auto' }} />
                          : <>
                              <div style={{ fontFamily: D.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: active ? cfg.color : D.muted, transition: 'color 0.3s' }}>
                                {count}
                              </div>
                              <div style={{ fontFamily: D.mono, fontSize: 9, color: D.muted, marginTop: 2 }}>
                                lot{count !== 1 ? 's' : ''}
                              </div>
                              {kgTotal > 0 && (
                                <div style={{ fontFamily: D.mono, fontSize: 9, color: active ? cfg.color : D.muted, marginTop: 3, fontWeight: 600 }}>
                                  {fmtT(kgTotal)}
                                </div>
                              )}
                            </>
                        }
                      </div>

                      {/* Barre — proportionnelle au tonnage */}
                      <div style={{ width: '70%', height: 3, background: D.line, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: loading ? '0%' : `${pct}%`, background: cfg.color, borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
                      </div>

                      {/* Label */}
                      <div style={{ fontFamily: D.body, fontSize: 9, color: active ? cfg.color : D.muted, textAlign: 'center', fontWeight: active ? 600 : 400, lineHeight: 1.3, maxWidth: 64, transition: 'color 0.3s' }}>
                        {GEN_LABELS[g]}
                      </div>
                    </div>

                    {idx < arr.length - 1 && (
                      <div style={{ color: D.line, opacity: active ? 1 : 0.4, flexShrink: 0, paddingBottom: 28, transition: 'opacity 0.3s' }}>
                        <ArrowRight size={12} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Donut distribution ── */}
            {!loading && (
              <DonutChart data={
                (ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2'])
                  .filter(g => (stats.genStats[g]?.nbLots ?? 0) > 0)
                  .map(g => ({ label: GEN_LABEL[g] ?? g, value: stats.genStats[g]?.totalKg ?? 0, color: GEN_COLOR[g], gen: g }))
              } />
            )}
          </div>
        </div>
      )}


      {/* ═══════════════ LOTS RÉCENTS ═══════════════ */}
      {showLots && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 20 }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#16a34a1a', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={13} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Lots récents</span>
            {!loading && (
              <>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 99, padding: '2px 10px' }}>
                  {stats.recentLots.length} derniers lots
                </span>
                <button
                  onClick={() => {
                    const date = new Date().toISOString().slice(0, 10)
                    const rows = stats.recentLots.map((l: any) => {
                      const kg = Number(l.quantiteNette ?? l.quantite) || 0
                      return [l.codeLot ?? '', l.variete?.nomVariete ?? varMap[l.idVariete] ?? '', l.variete?.espece?.nomEspece ?? l.espece?.nomEspece ?? '', l.generation?.codeGeneration ?? '', kg, parseFloat((kg / 1000).toFixed(3)), l.statutLot ?? l.statut ?? '']
                    })
                    downloadXlsx(`senjiw-lots-recents-${date}`, [
                      { name: 'Lots récents', headers: ['Code lot', 'Variété', 'Espèce', 'Génération', 'Quantité (kg)', 'Quantité (t)', 'Statut'], rows },
                    ])
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap' as const }}
                  title="Exporter en Excel"
                >
                  <Download size={11} /> Export .xls
                </button>
              </>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '10px 0' }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 22px', alignItems: 'center', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <div className="skeleton" style={{ width: 170, height: 12, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 36,  height: 22, borderRadius: 6, marginLeft: 'auto' }} />
                  <div className="skeleton" style={{ width: 60,  height: 12, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          ) : stats.recentLots.length === 0 ? (
            <div style={{ padding: '56px 20px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--text-muted)' }}>
                <Package size={24} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Aucun lot enregistré</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 5 }}>Les lots créés apparaîtront ici</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Code lot', 'Variété', 'Espèce', 'Génération', 'Quantité', 'Unité'].map(h => (
                    <th key={h} style={{ padding: '9px 22px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentLots.map((l: any, idx) => {
                  const gen = l.generation?.codeGeneration || 'N/A'
                  const cfg = GEN_CFG[gen]
                  const isLast = idx === stats.recentLots.length - 1
                  return (
                    <tr key={l.id}
                      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', transition: 'background 0.12s' }}
                      onMouseEnter={(e: { currentTarget: HTMLElement }) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e: { currentTarget: HTMLElement }) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '11px 22px', borderLeft: `3px solid ${cfg ? cfg.color : 'var(--border)'}` }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          {l.codeLot}
                        </span>
                      </td>
                      <td style={{ padding: '11px 22px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {varMap[l.idVariete] ?? l.variete?.nomVariete ?? (l.idVariete ? `#${l.idVariete}` : '—')}
                      </td>
                      <td style={{ padding: '11px 22px', fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 400 }}>
                        {l.variete?.espece?.nomEspece ?? l.espece?.nomEspece ?? '—'}
                      </td>
                      <td style={{ padding: '11px 22px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 34, height: 22, borderRadius: 6, padding: '0 7px',
                          background: cfg ? cfg.bg : 'var(--surface-3)',
                          color: cfg ? cfg.color : 'var(--text-muted)',
                          fontSize: 11, fontWeight: 800,
                          border: `1px solid ${cfg ? cfg.color + '28' : 'var(--border)'}`,
                        }}>{gen}</span>
                      </td>
                      <td style={{ padding: '11px 22px' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {(l.quantiteNette ?? l.quantite ?? '—').toLocaleString?.('fr-FR') ?? l.quantiteNette ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 22px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {l.unite ?? 'kg'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STOCK DISPONIBLE — ESPÈCES & VARIÉTÉS
      ══════════════════════════════════════════════════════ */}
      {showStock && (
        <div style={{
          background: '#fff', borderRadius: 16,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: `0 6px 36px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)`,
          marginBottom: 20,
        }}>

          {/* ── En-tête premium ── */}
          <div style={{
            background: `linear-gradient(135deg, ${accent}0d 0%, transparent 65%)`,
            borderBottom: `1px solid ${accent}20`,
            padding: '18px 24px 16px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            {/* Icône */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${accent}22, ${accent}0c)`,
              border: `1px solid ${accent}2e`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
              boxShadow: `0 2px 8px ${accent}18`,
            }}>
              <Database size={16} />
            </div>

            {/* Titre */}
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                Stock disponible
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Espèces &amp; Variétés &nbsp;·&nbsp; Scope&nbsp;
                <span style={{ fontWeight: 600, color: accent }}>{allowedStockGens.join(' · ')}</span>
                &nbsp;·&nbsp; graphique en t &nbsp;·&nbsp; tableau en kg
              </div>
            </div>

            {/* Badge compteur */}
            {!loading && (
              <span style={{
                fontSize: 11.5, fontWeight: 700,
                background: `${accent}12`, color: accent,
                border: `1px solid ${accent}2a`, borderRadius: 99,
                padding: '3px 12px', whiteSpace: 'nowrap',
              }}>
                {hasStockFilter ? `${filteredStockRows.length} / ${stockRows.length}` : stockRows.length} entrées
              </span>
            )}

            {/* Filtres dans l'en-tête */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

              {/* Recherche variété */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 32, minWidth: 192,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0 10px',
                transition: 'border-color 0.15s',
              }}
                onFocusCapture={(e: { currentTarget: HTMLElement }) => (e.currentTarget.style.borderColor = accent)}
                onBlurCapture={(e: { currentTarget: HTMLElement })  => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <Search size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <input
                  type="text" placeholder="Rechercher variété…" value={filterVariete}
                  onChange={e => setFilterVariete(e.target.value)}
                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', width: '100%' }}
                />
                {filterVariete && (
                  <button onClick={() => setFilterVariete('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Filtre espèce */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 32,
                background: filterEspece ? `${accent}0e` : 'var(--surface-2)',
                border: `1px solid ${filterEspece ? accent + '40' : 'var(--border)'}`,
                borderRadius: 8, padding: '0 10px',
              }}>
                <Filter size={11} color={filterEspece ? accent : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                <select value={filterEspece}
                  onChange={e => setFilterEspece(e.target.value)}
                  style={{ border: 'none', background: 'none', fontSize: 12, color: filterEspece ? accent : 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontWeight: filterEspece ? 600 : 400 }}>
                  <option value="">Toutes espèces ({especeOptions.length})</option>
                  {especeOptions.map(esp => (
                    <option key={esp} value={esp}>
                      {esp}{especeMap[esp] && especeMap[esp] !== esp ? ` — ${especeMap[esp]}` : ''}
                    </option>
                  ))}
                </select>
                {filterEspece && (
                  <button onClick={() => setFilterEspece('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, padding: 0, display: 'flex', flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Filtre générations — chips multi-sélection */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, height: 32,
                background: filterGens.length ? `${accent}08` : 'var(--surface-2)',
                border: `1px solid ${filterGens.length ? accent + '40' : 'var(--border)'}`,
                borderRadius: 8, padding: '0 8px',
              }}>
                <Filter size={11} color={filterGens.length ? accent : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                {allowedStockGens.map(g => {
                  const active = filterGens.includes(g)
                  const col = GEN_COLOR[g] ?? accent
                  return (
                    <button key={g} title={GEN_LABEL[g] ?? g}
                      onClick={() => setFilterGens(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                      style={{
                        fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 7px',
                        background: active ? col + '22' : 'transparent',
                        color: active ? col : 'var(--text-muted)',
                        border: `1px solid ${active ? col + '55' : 'transparent'}`,
                        cursor: 'pointer',
                      }}>
                      {g}
                    </button>
                  )
                })}
                {filterGens.length < allowedStockGens.length && (
                  <button onClick={() => setFilterGens(allowedStockGens)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, padding: 0, display: 'flex', flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Effacer tout */}
              {hasStockFilter && (
                <button
                  onClick={() => { setFilterEspece(''); setFilterVariete(''); setFilterGens(allowedStockGens) }}
                  style={{
                    fontSize: 11.5, fontWeight: 700, color: '#dc2626',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, height: 32,
                  }}>
                  <X size={11} /> Effacer
                </button>
              )}

              {/* Export stock */}
              {!loading && filteredStockRows.length > 0 && (
                <button
                  onClick={() => {
                    const date = new Date().toISOString().slice(0, 10)
                    const rows = filteredStockRows.map(r => [r.nomEspece, r.codeEspece, r.nomVariete, r.codeVariete, r.generation, Math.round(r.stockKg), parseFloat((r.stockKg / 1000).toFixed(3)), r.nbLots, Math.round(r.demandKg), parseFloat((r.demandKg / 1000).toFixed(3))])
                    downloadXlsx(`senjiw-stock-disponible-${date}`, [
                      { name: 'Stock disponible', headers: ['Espèce', 'Code espèce', 'Variété', 'Code variété', 'Génération', 'Stock (kg)', 'Stock (t)', 'Nb lots', 'Demande (kg)', 'Demande (t)'], rows },
                    ])
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', height: 32, whiteSpace: 'nowrap' as const }}
                  title="Exporter le stock filtré en Excel"
                >
                  <Download size={11} /> Export .xls
                </button>
              )}
            </div>
          </div>

          {/* ── Barre auto-refresh + KPIs ── */}
          <div style={{
            padding: '9px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse-dot 2s ease infinite', boxShadow: '0 0 5px #16a34a60' }} />
                Mise à jour auto · 30s
                {refreshing && <span style={{ color: accent, fontWeight: 600, marginLeft: 2 }}>· Actualisation…</span>}
              </div>
              {!loading && (
                <>
                  <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 700, color: accent, fontFamily: 'var(--font-mono)' }}>
                      {fmtT(hasStockFilter ? stockTotalFiltered : stockTotalAll)}
                    </span>
                    <span style={{ marginLeft: 3 }}>{hasStockFilter ? 'filtrés' : 'au total'}</span>
                  </span>
                  <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{stockRows.length}</span>
                    <span style={{ marginLeft: 3 }}>variétés × génération</span>
                  </span>
                  {hasStockFilter && (
                    <>
                      <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {[...new Set(filteredStockRows.map(r => r.codeEspece))].length}
                        </span>
                        <span style={{ marginLeft: 3 }}>espèce(s) filtrée(s)</span>
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── BarChart ── */}
          {loading ? (
            <div style={{ padding: '20px 24px' }}>
              <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
            </div>
          ) : filteredStockBarData.length > 0 ? (
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Stock par variété · génération
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>— {filteredStockBarData.length} entrées affichées (t)</span>
                {hasStockFilter && (
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-3)', borderRadius: 99, padding: '1px 8px', border: '1px solid var(--border)', marginLeft: 4 }}>
                    filtres actifs
                  </span>
                )}
              </div>
              <HBarChart data={filteredStockBarData} />
              {/* Légende générations */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {[...new Set(filteredStockBarData.map(b => b.gen))].map(gen => (
                  <span key={gen} style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 11px',
                    background: `${GEN_COLOR[gen]}14`, color: GEN_COLOR[gen],
                    border: `1px solid ${GEN_COLOR[gen]}32`,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: GEN_COLOR[gen], display: 'inline-block' }} />
                    {gen} — {GEN_LABEL[gen] ?? gen}
                  </span>
                ))}
              </div>
            </div>
          ) : stockRows.length > 0 ? (
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              Aucune variété ne correspond aux filtres actifs — modifiez les critères pour afficher le graphique.
            </div>
          ) : null}

          {/* ── Tableau triable ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {([
                  { col: 'nomEspece'  as StockSortKey, label: 'Espèce' },
                  { col: 'nomVariete' as StockSortKey, label: 'Variété' },
                  { col: 'generation' as StockSortKey, label: 'Gén.' },
                  { col: 'stockKg'    as StockSortKey, label: 'Stock disponible (kg)' },
                  { col: 'nbLots'     as StockSortKey, label: 'Lots actifs' },
                  { col: 'demandKg'   as StockSortKey, label: 'Demande (kg)' },
                ] as { col: StockSortKey; label: string }[]).map(({ col, label }) => (
                  <th key={col}
                    onClick={() => thSort(col)}
                    style={{
                      padding: '10px 22px', fontSize: 10, fontWeight: 700,
                      color: stockSortCol === col ? accent : 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.09em',
                      textAlign: 'left', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                      transition: 'color 0.15s',
                    }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {label}
                      {stockSortCol === col
                        ? <span style={{ fontSize: 10, opacity: 0.9 }}>{stockSortAsc ? '↑' : '↓'}</span>
                        : <span style={{ fontSize: 10, opacity: 0.22 }}>↕</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0,1,2,3,4].map(i => (
                  <tr key={i}>
                    <td colSpan={6} style={{ padding: '10px 22px', borderBottom: '1px solid var(--border)' }}>
                      <div className="skeleton" style={{ height: 13, borderRadius: 4 }} />
                    </td>
                  </tr>
                ))
              ) : filteredStockRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div style={{ padding: '52px 20px', textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--text-muted)' }}>
                        <Database size={20} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {hasStockFilter ? 'Aucun résultat' : 'Aucun stock disponible'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 5 }}>
                        {hasStockFilter ? 'Modifiez ou effacez les filtres ci-dessus' : "Les entrées de stock apparaîtront ici dès qu'elles seront enregistrées"}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStockRows.slice(0, 100).map((r, i) => {
                  const genClr = GEN_COLOR[r.generation] ?? '#6b7280'
                  const genBg  = GEN_CFG[r.generation]?.bg ?? 'var(--surface-2)'
                  const isCrit = r.demandKg > 0 && r.stockKg < r.demandKg * 0.5
                  const isLow  = !isCrit && r.demandKg > 0 && r.stockKg < r.demandKg
                  const isLast = i === filteredStockRows.slice(0, 100).length - 1
                  return (
                    <tr key={`${r.codeVariete}|${r.generation}`}
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid var(--border)',
                        background: isCrit ? '#fef2f210' : isLow ? '#fffbeb10' : 'transparent',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = isCrit ? '#fef2f230' : isLow ? '#fffbeb30' : 'var(--surface-2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = isCrit ? '#fef2f210' : isLow ? '#fffbeb10' : 'transparent' }}
                    >
                      {/* Espèce — bord gauche coloré par génération */}
                      <td style={{ padding: '12px 22px', borderLeft: `3px solid ${genClr}` }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{r.codeEspece}</span>
                        {r.nomEspece !== r.codeEspece && (
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 6 }}>{r.nomEspece}</span>
                        )}
                      </td>

                      {/* Variété */}
                      <td style={{ padding: '12px 22px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.nomVariete}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{r.codeVariete}</div>
                      </td>

                      {/* Génération badge */}
                      <td style={{ padding: '12px 22px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '4px 10px',
                          background: genBg, color: genClr, border: `1px solid ${genClr}32`,
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                          {r.generation}
                          <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>{GEN_LABEL[r.generation] ?? ''}</span>
                        </span>
                      </td>

                      {/* Stock disponible */}
                      <td style={{ padding: '10px 22px', minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                          <span style={{
                            fontWeight: 800, fontSize: 14, fontVariantNumeric: 'tabular-nums',
                            fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em',
                            color: isCrit ? '#dc2626' : isLow ? '#92660a' : 'var(--text-primary)',
                          }}>
                            {fmtKgTable(r.stockKg)}
                          </span>
                          {(isCrit || isLow) && (
                            <span style={{
                              marginLeft: 4, fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 7px',
                              background: isCrit ? '#fef2f2' : '#fffbeb',
                              color: isCrit ? '#dc2626' : '#92660a',
                              border: `1px solid ${isCrit ? '#fecaca' : '#fde68a'}`,
                            }}>
                              {isCrit ? '⚠ Critique' : '⚠ Bas'}
                            </span>
                          )}
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${Math.min(100, (r.stockKg / stockMaxKg) * 100)}%`,
                            background: isCrit ? '#dc2626' : isLow ? '#d97706' : (GEN_COLOR[r.generation] ?? accent),
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </td>

                      {/* Lots actifs */}
                      <td style={{ padding: '12px 22px', textAlign: 'center' }}>
                        <span style={{
                          fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums',
                          color: r.nbLots > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}>
                          {r.nbLots}
                        </span>
                      </td>

                      {/* Demande */}
                      <td style={{ padding: '12px 22px' }}>
                        {r.demandKg > 0 ? (
                          <span style={{
                            fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums',
                            fontFamily: 'var(--font-mono)',
                            color: r.demandKg > r.stockKg ? '#dc2626' : 'var(--text-secondary)',
                          }}>
                            {fmtKgTable(r.demandKg)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {filteredStockRows.length > 100 && (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              100 / {filteredStockRows.length} lignes affichées
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          DEMANDE VARIÉTÉS — UPSemCL · Sélectionneurs · Multiplicateurs
      ══════════════════════════════════════════════════════ */}
      {showDemandWidget && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${D.line}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', marginBottom: 20 }}>

          {/* ── En-tête avec filtres ── */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${D.line}`, background: 'linear-gradient(135deg,var(--surface-2) 0%,#fff 100%)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accent}12`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {roleKey === 'seed-upsemcl'
                  ? 'Pilotage production & distribution · G3 & R2'
                  : roleKey === 'seed-selector'
                  ? 'Demande sur vos variétés'
                  : roleKey === 'seed-multiplicator'
                  ? 'Variétés demandées par vos acheteurs'
                  : 'Analyse de la demande · toute la filière'}
                {roleKey === 'seed-selector' && userSpecialisation && (
                  <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', color: accent, background: `${accent}12`, padding: '1px 6px', borderRadius: 4 }}>{userSpecialisation}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {roleKey === 'seed-upsemcl'
                  ? 'G3 commandés par les multiplicateurs · R2 commandés par les quotataires'
                  : roleKey === 'seed-admin'
                  ? 'Consolidation nationale — G3 distribués par l\'UPSemCL · R2 par les multiplicateurs'
                  : roleKey === 'seed-multiplicator'
                  ? 'R2 commandés par vos quotataires'
                  : 'Commandes reçues sur votre spécialisation'}
                {demandEntries.length > 0 && <span style={{ marginLeft: 6 }}>· <strong>{fmtT(demandTotalKg)}</strong> total</span>}
              </div>
            </div>

            {/* Filtre période */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
              {(['1m','3m','6m','1a'] as const).map(p => (
                <button key={p} onClick={() => setDemandPeriod(p)} style={{
                  padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: demandPeriod === p ? 700 : 400,
                  background: demandPeriod === p ? '#fff' : 'transparent',
                  color: demandPeriod === p ? accent : 'var(--text-muted)',
                  boxShadow: demandPeriod === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {p === '1m' ? '1 mois' : p === '3m' ? '3 mois' : p === '6m' ? '6 mois' : '1 an'}
                </button>
              ))}
            </div>

            {/* Export demande variétés */}
            {!loading && demandEntries.length > 0 && (
              <button
                onClick={() => {
                  const date = new Date().toISOString().slice(0, 10)
                  const rows = demandEntries.map((d, i) => [
                    i + 1, d.code, d.nomVariete, d.codeEspece,
                    Math.round(d.g3kg), parseFloat((d.g3kg / 1000).toFixed(3)),
                    Math.round(d.r2kg), parseFloat((d.r2kg / 1000).toFixed(3)),
                    Math.round(d.total), parseFloat((d.total / 1000).toFixed(3)),
                    demandTotalKg > 0 ? Math.round((d.total / demandTotalKg) * 100) : 0,
                  ])
                  downloadXlsx(`senjiw-demande-varietes-${demandPeriod}-${date}`, [
                    { name: 'Demande variétés', headers: ['Rang', 'Code variété', 'Variété', 'Espèce', 'G3 — Mult. (kg)', 'G3 — Mult. (t)', 'R2 — Quot. (kg)', 'R2 — Quot. (t)', 'Total (kg)', 'Total (t)', 'Part (%)'], rows },
                  ])
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap' as const }}
                title="Exporter en Excel"
              >
                <Download size={11} /> Export .xls
              </button>
            )}

            {/* Filtre génération — masqué pour multiplicateurs (toujours R2) */}
            {roleKey !== 'seed-multiplicator' && (
              <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
                {(['all','G3','R2'] as const).map(v => {
                  const label = v === 'all' ? 'Vue complète' : v === 'G3' ? 'G3 → Mult.' : 'R2 → Quot.'
                  const clr   = v === 'G3' ? GEN_COLOR.G3 : v === 'R2' ? GEN_COLOR.R2 : accent
                  return (
                    <button key={v} onClick={() => setDemandGen(v)} style={{
                      padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      fontSize: 11.5, fontWeight: demandGen === v ? 700 : 400,
                      background: demandGen === v ? '#fff' : 'transparent',
                      color: demandGen === v ? clr : 'var(--text-muted)',
                      boxShadow: demandGen === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s',
                    }}>{label}</button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Corps ── */}
          <div style={{ padding: '18px 20px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 18, borderRadius: 6, width: `${82 - i * 10}%` }} />
                ))}
              </div>
            ) : demandEntries.length === 0 ? (
              <div style={{ textAlign: 'center' as const, padding: '28px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Aucune commande enregistrée sur cette période</div>
                <div style={{ fontSize: 11.5, marginTop: 4 }}>
                  {(roleKey === 'seed-upsemcl' || roleKey === 'seed-admin')
                    ? 'Élargissez la fenêtre temporelle ou vérifiez que les commandes ont été saisies par les multiplicateurs et les quotataires'
                    : 'Élargissez la fenêtre temporelle ou changez le filtre de génération'}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {demandEntries.map((d, i) => {
                    const activeQty  = roleKey === 'seed-multiplicator' ? d.r2kg
                                      : demandGen === 'G3' ? d.g3kg
                                      : demandGen === 'R2' ? d.r2kg : d.total
                    const g3pct      = demandMax > 0 ? (d.g3kg / demandMax) * 100 : 0
                    const r2pct      = demandMax > 0 ? (d.r2kg / demandMax) * 100 : 0
                    const activePct  = demandMax > 0 ? (activeQty / demandMax) * 100 : 0
                    const sharePct   = demandTotalKg > 0 ? Math.round((activeQty / demandTotalKg) * 100) : 0
                    const showSeg    = roleKey !== 'seed-multiplicator' && demandGen === 'all'
                    // Badge couverture G3 (stock UPSemCL vs demande)
                    const showCovBadge = d.g3kg > 0 && (roleKey === 'seed-upsemcl' || roleKey === 'seed-admin') && demandGen !== 'R2'
                    const covRatio   = d.g3kg > 0 ? d.stockG3 / d.g3kg : null
                    const covColor   = covRatio === null ? 'var(--text-muted)' : covRatio >= 1 ? '#16a34a' : covRatio >= 0.5 ? '#d97706' : '#dc2626'
                    const covLabel   = covRatio === null ? '' : covRatio >= 1 ? 'Couvert' : covRatio >= 0.5 ? 'Partiel' : 'Critique'
                    const covBg      = covRatio === null ? '' : covRatio >= 1 ? '#f0fdf4' : covRatio >= 0.5 ? '#fffbeb' : '#fef2f2'
                    // Compteur de commandes
                    const cmdCount   = roleKey === 'seed-multiplicator' ? d.r2OrderCount
                                      : demandGen === 'R2' ? d.r2OrderCount : d.g3OrderCount
                    return (
                      <div key={d.code} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 120px', alignItems: 'center', gap: 10 }}>
                        {/* Label variété + espèce + badge couverture */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0, minWidth: 14, textAlign: 'right' as const }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{d.nomVariete}</span>
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{d.codeEspece}</span>
                            </div>
                            {showCovBadge && covLabel && (
                              <span style={{ display: 'inline-block', marginTop: 2, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: covBg, color: covColor, border: `1px solid ${covColor}30` }}>
                                ● {covLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Barre */}
                        <div style={{ position: 'relative', height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                          {showSeg ? (
                            <>
                              {g3pct > 0 && <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${g3pct}%`, background: GEN_COLOR.G3, borderRadius: 99, transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }} />}
                              {r2pct > 0 && <div style={{ position: 'absolute', left: `${g3pct}%`, top: 0, height: '100%', width: `${r2pct}%`, background: GEN_COLOR.R2, opacity: 0.85, transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1), left 0.65s cubic-bezier(0.4,0,0.2,1)' }} />}
                            </>
                          ) : (
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${activePct}%`, background: (roleKey === 'seed-multiplicator' || demandGen === 'R2') ? GEN_COLOR.R2 : demandGen === 'G3' ? GEN_COLOR.G3 : accent, borderRadius: 99, transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }} />
                          )}
                        </div>
                        {/* Quantité + part + nb commandes */}
                        <div style={{ textAlign: 'right' as const, lineHeight: 1.3 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                              {fmtT(activeQty)}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{sharePct}%</span>
                          </div>
                          {cmdCount > 0 && (
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                              {cmdCount} commande{cmdCount > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Légende bas de carte */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--surface-2)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const, fontSize: 11 }}>
                  {(roleKey !== 'seed-multiplicator' && demandGen === 'all') ? (
                    <>
                      {demandG3Total > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: GEN_COLOR.G3, display: 'inline-block', flexShrink: 0 }} />
                          G3 → Multiplicateurs · <strong style={{ color: GEN_COLOR.G3 }}>{fmtT(demandG3Total)}</strong>
                        </span>
                      )}
                      {demandR2Total > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: GEN_COLOR.R2, display: 'inline-block', flexShrink: 0 }} />
                          R2 → Quotataires · <strong style={{ color: GEN_COLOR.R2 }}>{fmtT(demandR2Total)}</strong>
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {demandEntries.length} variété{demandEntries.length > 1 ? 's' : ''} · période {demandPeriod === '1m' ? '1 mois' : demandPeriod === '3m' ? '3 mois' : demandPeriod === '6m' ? '6 mois' : '12 mois'}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
                    Total · <strong style={{ color: 'var(--text-primary)' }}>{fmtT(demandTotalKg)}</strong>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          COUVERTURE DEMANDE & PRÉVISIONS DE RÉCOLTE
      ══════════════════════════════════════════════════════ */}
      {showStock && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* ── Couverture stock / demande par espèce ── */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9, background: 'linear-gradient(135deg,var(--surface-2) 0%,#fff 100%)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13 }}>⚖</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Couverture stock / demande</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>Ratio stock disponible ÷ commandes actives</div>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '12px 20px' }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div className="skeleton" style={{ width: '40%', height: 11, borderRadius: 4, marginBottom: 6 }} />
                    <div className="skeleton" style={{ width: '100%', height: 8, borderRadius: 99 }} />
                  </div>
                ))}
              </div>
            ) : coverageItems.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Aucune donnée de couverture</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Enregistrez du stock et des commandes pour voir les ratios</div>
              </div>
            ) : (
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {coverageItems.map(c => {
                  const isCrit = c.demandKg > 0 && c.ratio < 1
                  const isWarn = c.demandKg > 0 && c.ratio >= 1 && c.ratio < 2
                  const isOk   = !isCrit && !isWarn
                  const clr    = isCrit ? '#dc2626' : isWarn ? '#92660a' : '#15803d'
                  const trackBg = isCrit ? '#fee2e2' : isWarn ? '#fef3c7' : '#dcfce7'
                  const fillBg  = isCrit ? 'linear-gradient(90deg,#ef4444,#fca5a5)' : isWarn ? 'linear-gradient(90deg,#f59e0b,#fcd34d)' : 'linear-gradient(90deg,#16a34a,#4ade80)'
                  const stockPct  = c.demandKg > 0 ? Math.min((c.stockKg  / maxCovKg) * 100, 100) : Math.min((c.stockKg / maxCovKg) * 100, 100)
                  const demandPct = c.demandKg > 0 ? Math.min((c.demandKg / maxCovKg) * 100, 100) : 0
                  return (
                    <div key={c.code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{c.code}</span>
                          {c.nom !== c.code && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.nom}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: clr, fontFamily: 'var(--font-mono)' }}>
                            {c.ratio >= 99 ? '—' : `${c.ratio.toFixed(1)}×`}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 7px', background: trackBg, color: clr, border: `1px solid ${isCrit ? '#fecaca' : isWarn ? '#fde68a' : '#bbf7d0'}` }}>
                            {isCrit ? 'CRITIQUE' : isWarn ? 'Bas' : isOk && c.demandKg === 0 ? 'Stock libre' : 'Couvert'}
                          </span>
                        </div>
                      </div>
                      {/* Barre stock */}
                      <div style={{ position: 'relative', marginBottom: 4 }}>
                        <div style={{ height: 7, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${stockPct}%`, background: fillBg, borderRadius: 99, transition: 'width 0.8s ease' }} />
                        </div>
                        {c.demandKg > 0 && (
                          <div style={{
                            position: 'absolute', top: 0, left: `${demandPct}%`, width: 2, height: 7,
                            background: '#374151', borderRadius: 1, transform: 'translateX(-50%)',
                          }} title={`Demande : ${fmtT(c.demandKg)}`} />
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                        <span>Stock&nbsp;<span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fmtT(c.stockKg)}</span></span>
                        {c.demandKg > 0 && <span>Demande&nbsp;<span style={{ fontWeight: 700, color: clr, fontFamily: 'var(--font-mono)' }}>{fmtT(c.demandKg)}</span></span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Prévisions de récolte ── */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9, background: 'linear-gradient(135deg,var(--surface-2) 0%,#fff 100%)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f0fdf4', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13 }}>🌱</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Prévisions de récolte</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>Programmes en cours — campagne active</div>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '12px 20px' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div className="skeleton" style={{ width: '30%', height: 20, borderRadius: 6, marginBottom: 8 }} />
                    <div className="skeleton" style={{ width: '100%', height: 8, borderRadius: 99, marginBottom: 6 }} />
                    <div className="skeleton" style={{ width: '60%', height: 10, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ) : forecastEntries.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🌾</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Aucun programme en cours</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Les prévisions apparaissent dès qu'un programme passe au statut « En cours » avec superficie et objectif renseignés
                </div>
              </div>
            ) : (
              <>
                {/* Résumé global */}
                <div style={{ padding: '12px 20px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 20, background: 'var(--surface-2)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-sans)', color: '#15803d', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {totalForecastLots}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>programmes actifs</div>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-sans)', color: '#0369a1', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {totalForecastHa > 0 ? totalForecastHa.toLocaleString('fr-FR',{maximumFractionDigits:1}) : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>ha prévus</div>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-sans)', color: accent, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {totalForecastKg > 0 ? `~${fmtT(totalForecastKg)}` : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>production estimée</div>
                  </div>
                </div>

                {/* Par génération */}
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {forecastEntries.map(([gen, f]) => {
                    const genClr = GEN_COLOR[gen] ?? '#6b7280'
                    const genBg  = GEN_CFG[gen]?.bg ?? 'var(--surface-2)'
                    const pct    = (f.expectedKg / maxForecastKg) * 100
                    return (
                      <div key={gen}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 7, padding: '3px 9px', background: genBg, color: genClr, border: `1px solid ${genClr}28` }}>
                              {gen}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {f.lots} programme{f.lots > 1 ? 's' : ''}
                              {f.ha > 0 && ` · ${f.ha.toLocaleString('fr-FR',{maximumFractionDigits:1})} ha`}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: genClr, fontFamily: 'var(--font-mono)' }}>
                            {f.expectedKg > 0 ? `~${fmtT(f.expectedKg)}` : 'données manquantes'}
                          </span>
                        </div>
                        {f.expectedKg > 0 && (
                          <div style={{ height: 9, background: `${genClr}14`, borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: `linear-gradient(90deg, ${genClr}, ${genClr}88)`,
                              borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
                              boxShadow: `0 1px 6px ${genClr}40`,
                            }} />
                          </div>
                        )}
                        {f.expectedKg === 0 && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Superficie et objectif non renseignés sur ces programmes
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Note de bas */}
                <div style={{ padding: '8px 20px 14px', fontSize: 10.5, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                  Estimé à partir de l'objectif (kg) et de la superficie de chaque programme en cours. Mettez à jour les programmes pour affiner les prévisions.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ CARTE ACCUEIL QUOTATAIRE ═══════════════ */}
      {isQuotaire && (
        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${accent}28`,
          overflow: 'hidden', boxShadow: `0 2px 12px ${accent}12`, marginBottom: 20,
        }}>
          <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />
          <div style={{ padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: `${accent}15`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShoppingCart size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Catalogue des semences disponibles</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Consultez les variétés disponibles par espèce, filtrez par zone d'adaptation et passez vos commandes directement auprès des multiplicateurs agréés.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {loading ? '…' : stats.varietiesCount}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>variétés</div>
                </div>
                <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {loading ? '…' : stats.ordersCount}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>commandes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SECTIONS RÔLE-SPÉCIFIQUES ═══════════════ */}
      {['seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
        <PendingDeliveries roleKey={roleKey} />
      )}
      {roleKey === 'seed-selector' && (
        <SelectorAnalytics userSpecialisation={userSpecialisation} />
      )}

      {/* ══════════════════════════════════════════════════════
          CARTE AGRO-ÉCOLOGIQUE — rétractable
      ══════════════════════════════════════════════════════ */}
      <div style={{
        background: '#fff', borderRadius: 14,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        marginBottom: 20,
      }}>
        {/* En-tête cliquable */}
        <div
          onClick={() => setMapExpanded(v => !v)}
          style={{
            padding: '14px 24px',
            borderBottom: mapExpanded ? '1px solid var(--border)' : 'none',
            background: '#fafafa',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', userSelect: 'none',
          }}>
          <span style={{
            fontFamily: D.mono, fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: D.green, background: D.greenSoft,
            padding: '3px 10px', borderRadius: 999,
          }}>Géographie</span>
          <span style={{ fontFamily: D.display, fontSize: 15, fontWeight: 600, color: D.ink }}>
            Répartition géographique des semences
          </span>
          <span style={{ fontFamily: D.body, fontSize: 12, color: D.muted }}>
            — zones agro-écologiques &amp; sites ISRA
          </span>
          <span style={{
            marginLeft: 'auto', fontFamily: D.body, fontSize: 12,
            color: D.muted, display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {mapExpanded ? 'Réduire' : 'Afficher la carte'}
            <span style={{
              fontSize: 10, display: 'inline-block',
              transform: mapExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}>▼</span>
          </span>
        </div>

        {mapExpanded && (
          <div style={{ padding: '16px 20px 20px' }}>
            <MapSemences roleKey={roleKey} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.7)} }
      `}</style>
    </div>
  )
}
