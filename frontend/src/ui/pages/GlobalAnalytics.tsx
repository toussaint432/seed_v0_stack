import { useEffect, useRef, useState } from 'react'
import {
  RefreshCw, BarChart2, TrendingUp, AlertTriangle,
  Package, Database, ShoppingCart, Filter, X, Search,
  CheckCircle2, Clock, XCircle, ArrowUpRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, normalizeVariete, normalizeStock, extractList } from '../../lib/normalizers'

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
interface Props { roleKey: string }

interface OrderRow {
  id: number; codeCommande: string; client: string
  generation: string; quantite: number; unite: string
  statut: string; date: string; nomVariete: string
}
interface MonthPoint { month: string; count: number; _y?: number; _m?: number }
interface SpeciesAlert { codeEspece: string; stockKg: number; demande: number; ratio: number }
interface BarDatum     { label: string; value: number; color: string; gen: string }
interface StockRow {
  codeEspece: string; nomEspece: string; codeVariete: string; nomVariete: string
  generation: string; stockKg: number; nbLots: number; demandKg: number
}
type StockSortKey = 'nomEspece' | 'nomVariete' | 'generation' | 'stockKg' | 'nbLots' | 'demandKg'

/* ═══════════════════════════════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════════════════════════════ */
const ROLE_GENS: Record<string, string[]> = {
  'seed-admin':         ['G0','G1','G2','G3','G4','R1','R2'],
  'seed-upsemcl':       ['G1','G2','G3'],
  'seed-multiplicator': ['G3','G4','R1','R2'],
  'seed-quotataire':    ['R2'],
}

const GEN_COLOR: Record<string, string> = {
  G0:'#1d4ed8', G1:'#15803d', G2:'#92660a',
  G3:'#6d28d9', G4:'#b91c1c', R1:'#0f766e', R2:'#16a34a',
}
const GEN_LABEL: Record<string, string> = {
  G0:'Génétique', G1:'Pré-base', G2:'Base',
  G3:'Certif. C1', G4:'Certif. C2', R1:'R1', R2:'Commerciale',
}

const STATUT_BADGE: Record<string, string> = {
  SOUMISE:        'badge-blue',
  ACCEPTEE:       'badge-green',
  EN_PREPARATION: 'badge-gold',
  LIVREE:         'badge-green',
  ANNULEE:        'badge-red',
  REJETEE:        'badge-red',
}
const STATUT_LABEL: Record<string, string> = {
  SOUMISE:        'Soumise',
  ACCEPTEE:       'Acceptée',
  EN_PREPARATION: 'En préparation',
  LIVREE:         'Livrée',
  ANNULEE:        'Annulée',
  REJETEE:        'Rejetée',
}
const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const REFRESH_MS = 30_000

/* ═══════════════════════════════════════════════════════════════
   BarChart professionnel — axes + grille + tooltip + labels
═══════════════════════════════════════════════════════════════ */
function BarChart({ data, yLabel = 'Quantité demandée (kg)' }: { data: BarDatum[]; yLabel?: string }) {
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

  // Arrondi propre pour l'axe Y
  const magnitude = Math.pow(10, Math.floor(Math.log10(max || 1)))
  const niceMax   = Math.ceil(max / magnitude) * magnitude

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        {data.map((d, i) => (
          <linearGradient key={i} id={`bar-g${i}`} x1="0" y1="0" x2="0" y2="1">
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
              {v > 999 ? `${(v/1000).toFixed(0)}k` : v}
            </text>
          </g>
        )
      })}

      {/* Barres */}
      {data.map((d, i) => {
        const bh   = (d.value / niceMax) * innerH
        const x    = PAD_L + i * barW + barW * 0.14
        const bw   = barW * 0.72
        const y    = PAD_T + innerH - bh
        const isHov = hovered === i
        return (
          <g key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}>
            {/* Ombre subtile */}
            {isHov && <rect x={x+2} y={y+2} width={bw} height={bh} rx={5}
              fill={d.color} opacity={0.12} />}
            <rect x={x} y={y} width={bw} height={Math.max(bh, 2)}
              rx={5} fill={`url(#bar-g${i})`}
              style={{ transition: 'all 0.15s' }} />

            {/* Valeur au-dessus */}
            {d.value > 0 && (
              <text x={x + bw / 2} y={y - 5} textAnchor="middle"
                fontSize={isHov ? 10 : 9} fontWeight={700} fill={d.color}
                fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
                style={{ transition: 'font-size 0.1s' }}>
                {d.value > 9999 ? `${(d.value/1000).toFixed(1)}k` : d.value.toLocaleString('fr-FR')} kg
              </text>
            )}

            {/* Label X — variété */}
            <text x={x + bw / 2} y={PAD_T + innerH + 14} textAnchor="middle"
              fontSize={9} fill={isHov ? d.color : 'var(--text-secondary)'}
              fontWeight={isHov ? 700 : 400} fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
              {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
            </text>
            {/* Label X — génération */}
            <text x={x + bw / 2} y={PAD_T + innerH + 26} textAnchor="middle"
              fontSize={8} fill={d.color} fontWeight={600}
              fontFamily="Plus Jakarta Sans, system-ui, sans-serif" opacity={0.8}>
              {d.gen}
            </text>

            {/* Tooltip au survol */}
            {isHov && (
              <g>
                <rect x={x + bw / 2 - 46} y={y - 42} width={92} height={32}
                  rx={5} fill="var(--text-primary)" opacity={0.92} />
                <text x={x + bw / 2} y={y - 28} textAnchor="middle"
                  fontSize={9} fill="#fff" fontWeight={700}
                  fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
                  {d.label}
                </text>
                <text x={x + bw / 2} y={y - 16} textAnchor="middle"
                  fontSize={9} fill={d.color} fontWeight={600}
                  fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
                  {d.value.toLocaleString('fr-FR')} kg · {GEN_LABEL[d.gen] ?? d.gen}
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

/* ═══════════════════════════════════════════════════════════════
   LineChart professionnel — axes + grille + points + tooltip + aire
═══════════════════════════════════════════════════════════════ */
function LineChart({ data, color = '#0f766e' }: { data: MonthPoint[]; color?: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (data.length === 0) return null

  const max    = Math.max(...data.map(d => d.count), 1)
  const H      = 180
  const PAD_T  = 20; const PAD_B = 32; const PAD_L = 40; const PAD_R = 16
  const W      = 520
  const innerH = H - PAD_T - PAD_B
  const innerW = W - PAD_L - PAD_R
  const TICKS  = 4

  const magnitude = Math.pow(10, Math.floor(Math.log10(max || 1)))
  const niceMax   = Math.ceil(max / magnitude) * magnitude || 1

  const pts = data.map((d, i) => ({
    x: PAD_L + (i / Math.max(data.length - 1, 1)) * innerW,
    y: PAD_T + (1 - d.count / niceMax) * innerH,
    ...d,
  }))

  const linePath  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath  = `${linePath} L${pts[pts.length-1].x},${PAD_T+innerH} L${pts[0].x},${PAD_T+innerH} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
          <stop offset="85%"  stopColor={color} stopOpacity={0.04} />
        </linearGradient>
        <filter id="lc-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Grille */}
      {Array.from({ length: TICKS + 1 }, (_, t) => {
        const y = PAD_T + (t / TICKS) * innerH
        const v = Math.round(niceMax * (1 - t / TICKS))
        return (
          <g key={t}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke="var(--border)" strokeWidth={t === TICKS ? 1.5 : 0.7}
              strokeDasharray={t === TICKS ? '0' : '3,4'} />
            <text x={PAD_L - 5} y={y + 4} textAnchor="end"
              fontSize={9} fill="var(--text-muted)" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
              {v}
            </text>
          </g>
        )
      })}

      {/* Aire */}
      <path d={areaPath} fill="url(#lc-area)" />

      {/* Ligne */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round" filter="url(#lc-glow)" />

      {/* Points + tooltip */}
      {pts.map((p, i) => {
        const isHov = hovered === i
        return (
          <g key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}>
            {/* Zone de capture */}
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            {/* Halo */}
            {isHov && <circle cx={p.x} cy={p.y} r={8} fill={color} opacity={0.15} />}
            {/* Point */}
            <circle cx={p.x} cy={p.y} r={isHov ? 5 : 3.5}
              fill={color} stroke="#fff" strokeWidth={1.5}
              style={{ transition: 'r 0.12s' }} />

            {/* Label mois */}
            <text x={p.x} y={PAD_T + innerH + 14} textAnchor="middle"
              fontSize={9} fill={isHov ? color : 'var(--text-muted)'}
              fontWeight={isHov ? 700 : 400} fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
              {p.month}
            </text>

            {/* Valeur au-dessus si > 0 */}
            {p.count > 0 && !isHov && (
              <text x={p.x} y={p.y - 7} textAnchor="middle"
                fontSize={8} fontWeight={600} fill={color}
                fontFamily="Plus Jakarta Sans, system-ui, sans-serif" opacity={0.8}>
                {p.count}
              </text>
            )}

            {/* Tooltip */}
            {isHov && (
              <g>
                <rect x={p.x - 36} y={p.y - 42} width={72} height={30}
                  rx={5} fill="var(--text-primary)" opacity={0.92} />
                <text x={p.x} y={p.y - 28} textAnchor="middle"
                  fontSize={9} fill="#fff" fontWeight={700}
                  fontFamily="Plus Jakarta Sans, system-ui, sans-serif">{p.month}</text>
                <text x={p.x} y={p.y - 16} textAnchor="middle"
                  fontSize={9} fill={color} fontWeight={600}
                  fontFamily="Plus Jakarta Sans, system-ui, sans-serif">
                  {p.count} commande{p.count > 1 ? 's' : ''}
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
        Nb commandes
      </text>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════
   KPI Card animée
═══════════════════════════════════════════════════════════════ */
function KpiCard({ icon: Icon, label, value, color, delay, sub, trend }: {
  icon: LucideIcon; label: string; value: string | number
  color: string; delay: number; sub?: string; trend?: { val: string; up: boolean }
}) {
  const [vis, setVis] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t) }, [])
  return (
    <div className="stat-card" style={{
      opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(14px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease, box-shadow 0.15s',
    }}>
      <div className={`stat-icon ${color}`}><Icon size={18} /></div>
      <div className="stat-body">
        <div className="stat-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        {trend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4,
            fontSize: 11, fontWeight: 600, color: trend.up ? 'var(--green-700)' : 'var(--red-600)' }}>
            <ArrowUpRight size={11} style={{ transform: trend.up ? 'none' : 'rotate(90deg)' }} />
            {trend.val}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════ */
export function GlobalAnalytics({ roleKey }: Props) {
  const allowedGens    = ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2']
  const isMultiplicator = roleKey === 'seed-multiplicator'
  const isAdmin         = roleKey === 'seed-admin'

  const [orders,     setOrders]     = useState<any[]>([])
  const [lots,       setLots]       = useState<any[]>([])
  const [varieties,  setVarieties]  = useState<any[]>([])
  const [stocks,     setStocks]     = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterGen,    setFilterGen]    = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [stockSortCol, setStockSortCol] = useState<StockSortKey>('stockKg')
  const [stockSortAsc, setStockSortAsc] = useState(false)
  const [filterEspece,   setFilterEspece]   = useState('')
  const [filterVariete,  setFilterVariete]  = useState('')
  const [filterGenStock, setFilterGenStock] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchAll(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    const [oR, lR, vR, sR] = await Promise.allSettled([
      api.get(isMultiplicator ? endpoints.ordersATraiter : endpoints.orders),
      api.get(isMultiplicator ? endpoints.lotsMesLots    : endpoints.lots),
      api.get(endpoints.varieties),
      api.get(isMultiplicator ? endpoints.stockMonStock  : endpoints.stocks),
    ])
    setOrders(extractList(oR.status === 'fulfilled' ? oR.value.data : null))
    setLots(extractList(lR.status      === 'fulfilled' ? lR.value.data : null).map(normalizeLot))
    setVarieties(extractList(vR.status === 'fulfilled' ? vR.value.data : null).map(normalizeVariete))
    setStocks(extractList(sR.status    === 'fulfilled' ? sR.value.data : null).map(normalizeStock))
    setLoading(false); setRefreshing(false)
  }

  useEffect(() => {
    fetchAll()
    timer.current = setInterval(() => fetchAll(true), REFRESH_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [roleKey])

  /* ── Lookup maps ── */
  const lotMap:     Record<number, any> = Object.fromEntries(lots.map(l     => [l.id, l]))
  const varietyMap: Record<number, any> = Object.fromEntries(varieties.map(v => [v.id, v]))

  /* ── Enrichissement des commandes ── */
  const enriched: OrderRow[] = orders.map((o: any) => {
    const lot     = lotMap[o.idLot ?? o.lotId] ?? {}
    const genCode = lot.generation?.codeGeneration ?? o.generation ?? '?'
    const varId   = lot.idVariete ?? o.idVariete
    const variety = varietyMap[varId] ?? {}
    return {
      id:           o.id,
      codeCommande: o.codeCommande ?? o.reference ?? `CMD-${o.id}`,
      client:       o.client ?? o.username ?? o.demandeur ?? '—',
      generation:   genCode,
      quantite:     parseFloat(o.quantite ?? o.quantiteDemandee ?? 0),
      unite:        o.unite ?? 'kg',
      statut:       o.statut ?? 'SOUMISE',
      date:         (o.createdAt ?? o.dateCommande ?? '').slice(0, 10),
      nomVariete:   variety.nomVariete ?? o.codeVariete ?? o.nomVariete ?? '—',
    }
  })

  /* ── Filtre rôle : multiplicateur voit R2 seulement ── */
  const roleFiltered = enriched.filter(o =>
    allowedGens.includes(o.generation) &&
    (!isMultiplicator || o.generation === 'R2')
  )

  /* ── Filtres interactifs ── */
  const tableRows = roleFiltered.filter(o =>
    (!filterGen    || o.generation === filterGen) &&
    (!filterStatut || o.statut     === filterStatut)
  )

  /* ── KPIs ── */
  const kpiLots    = lots.filter(l => allowedGens.includes(l.generation?.codeGeneration)).length

  /* Stock filtré par génération du rôle (chaque acteur voit son propre scope) */
  const roleLotIds = new Set(
    lots.filter((l: any) => allowedGens.includes(l.generation?.codeGeneration ?? '')).map((l: any) => l.id)
  )
  const kpiStock = stocks
    .filter((st: any) => {
      if (isAdmin) return true
      if (st.lot?.id)                          return roleLotIds.has(st.lot.id)
      if (st.lot?.generation?.codeGeneration)  return allowedGens.includes(st.lot.generation.codeGeneration)
      if (st.generation)                       return allowedGens.includes(st.generation)
      return false
    })
    .reduce((s: number, st: any) => s + (parseFloat(st.quantiteDisponible) || 0), 0)
  const kpiPending = roleFiltered.filter(o => o.statut === 'SOUMISE').length
  const kpiAlloc   = roleFiltered.filter(o => o.statut === 'EN_PREPARATION').length
  const kpiCancel  = roleFiltered.filter(o => ['ANNULEE','REJETEE'].includes(o.statut)).length

  /* ── BarChart : quantité demandée par variété ── */
  const demandMap: Record<string, { qty: number; gen: string }> = {}
  roleFiltered.forEach(o => {
    if (!demandMap[o.nomVariete]) demandMap[o.nomVariete] = { qty: 0, gen: o.generation }
    demandMap[o.nomVariete].qty += o.quantite
  })
  const barData: BarDatum[] = Object.entries(demandMap)
    .sort((a, b) => b[1].qty - a[1].qty).slice(0, 8)
    .map(([name, { qty, gen }]) => ({ label: name, value: Math.round(qty), color: GEN_COLOR[gen] ?? '#6b7280', gen }))

  /* ── LineChart : évolution mensuelle ── */
  const now = new Date()
  const monthly: MonthPoint[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { month: MONTHS_FR[d.getMonth()], count: 0, _y: d.getFullYear(), _m: d.getMonth() }
  })
  roleFiltered.forEach(o => {
    if (!o.date) return
    const d  = new Date(o.date)
    const mp = monthly.find(p => p._y === d.getFullYear() && p._m === d.getMonth())
    if (mp) mp.count++
  })

  /* ── Alertes stock vs demande par espèce ── */
  const especeStock:  Record<string, number> = {}
  const especeDemande: Record<string, number> = {}
  stocks.forEach((s: any) => {
    const code = s.variete?.espece?.codeEspece ?? '?'
    if (code !== '?') especeStock[code] = (especeStock[code] ?? 0) + (parseFloat(s.quantiteDisponible) || 0)
  })
  roleFiltered.forEach(o => {
    const lot     = lotMap[o.id]
    const variety = varietyMap[lot?.idVariete ?? -1]
    const code    = variety?.espece?.codeEspece ?? '?'
    if (code !== '?') especeDemande[code] = (especeDemande[code] ?? 0) + o.quantite
  })
  const speciesAlerts: SpeciesAlert[] = Object.keys({ ...especeStock, ...especeDemande })
    .filter(k => k !== '?')
    .map(code => {
      const stock = especeStock[code] ?? 0; const demande = especeDemande[code] ?? 0
      return { codeEspece: code, stockKg: stock, demande, ratio: demande > 0 ? stock / demande : 999 }
    }).sort((a, b) => a.ratio - b.ratio)

  /* ── Stock par espèce / variété / génération ── */
  const stockRowMap: Record<string, StockRow> = {}
  stocks.forEach((st: any) => {
    const lotObj      = st.lot ?? lotMap[st.idLot ?? st.lotId] ?? {}
    const gen         = lotObj.generation?.codeGeneration ?? st.generation ?? '?'
    if (!allowedGens.includes(gen)) return
    let variety: any  = lotObj.variete ?? varietyMap[lotObj.idVariete ?? lotObj.varieteId ?? -1] ?? {}
    if (!variety.codeVariete) variety = varietyMap[st.idVariete ?? -1] ?? st.variete ?? {}
    if (!variety.codeVariete) return
    const codeVariete = variety.codeVariete
    const nomVariete  = variety.nomVariete ?? codeVariete
    const esp         = variety.espece ?? {}
    const codeEspece  = esp.codeEspece ?? '?'
    const nomEspece   = esp.nomEspece  ?? codeEspece
    const key = `${codeVariete}|${gen}`
    if (!stockRowMap[key]) stockRowMap[key] = { codeEspece, nomEspece, codeVariete, nomVariete, generation: gen, stockKg: 0, nbLots: 0, demandKg: 0 }
    stockRowMap[key].stockKg += parseFloat(st.quantiteDisponible) || 0
  })
  lots.forEach((l: any) => {
    const gen         = l.generation?.codeGeneration ?? '?'
    if (!allowedGens.includes(gen)) return
    const variety     = varietyMap[l.idVariete ?? l.varieteId ?? -1] ?? l.variete ?? {}
    const codeVariete = variety.codeVariete ?? l.codeVariete
    if (!codeVariete) return
    const key = `${codeVariete}|${gen}`
    const active = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT','SOUCHE']
    if (stockRowMap[key] && active.includes((l.statut ?? '').toUpperCase())) stockRowMap[key].nbLots++
  })
  roleFiltered.forEach(o => {
    const lot         = lotMap[o.id] ?? {}
    const variety     = varietyMap[lot.idVariete ?? -1] ?? {}
    const codeVariete = variety.codeVariete ?? (o as any).codeVariete
    if (!codeVariete) return
    const key = `${codeVariete}|${o.generation}`
    if (stockRowMap[key]) stockRowMap[key].demandKg += o.quantite
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

  /* ── Filtres stock : options dérivées du catalogue complet (toutes espèces, même sans stock) ── */
  const especeMap: Record<string, string> = {}
  varieties.forEach((v: any) => {
    const code = v.espece?.codeEspece
    const nom  = v.espece?.nomEspece
    if (code && code !== '?') especeMap[code] = nom ?? code
  })
  const especeOptions = Object.keys(especeMap).sort()
  const filteredStockRows = stockRows.filter(r =>
    (!filterEspece   || r.codeEspece === filterEspece) &&
    (!filterGenStock || r.generation === filterGenStock) &&
    (!filterVariete  || r.codeVariete.toLowerCase().includes(filterVariete.toLowerCase())
                     || r.nomVariete.toLowerCase().includes(filterVariete.toLowerCase()))
  )
  const filteredStockBarData: BarDatum[] = [...filteredStockRows]
    .sort((a, b) => b.stockKg - a.stockKg).slice(0, 10)
    .map(r => ({ label: r.codeVariete, value: Math.round(r.stockKg), color: GEN_COLOR[r.generation] ?? '#6b7280', gen: r.generation }))
  const stockTotalFiltered = filteredStockRows.reduce((s, r) => s + r.stockKg, 0)
  const hasStockFilter = !!(filterEspece || filterVariete || filterGenStock)

  const availableGens    = allowedGens.filter(g => !isMultiplicator || g === 'R2')
  const availableStatuts = [...new Set(roleFiltered.map(o => o.statut))]

  const lineColor = isMultiplicator ? '#16a34a' : roleKey === 'seed-upsemcl' ? '#0f766e' : '#7c3aed'

  /* ── Statut commandes (donut-like summary) ── */
  const total = roleFiltered.length || 1
  const statusSummary = [
    { label: 'En attente',  count: kpiPending, icon: Clock,        color: '#92660a', bg: '#fef9ed', pct: kpiPending/total },
    { label: 'Allouées',    count: kpiAlloc,   icon: CheckCircle2, color: '#15803d', bg: '#f0fdf4', pct: kpiAlloc/total   },
    { label: 'Annulées',    count: kpiCancel,  icon: XCircle,      color: '#dc2626', bg: '#fef2f2', pct: kpiCancel/total  },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>

      {/* ── Barre analytique — refresh + indicateurs ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderRadius: 10,
        background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a',
              display: 'inline-block', animation: 'pulse-dot 2s ease infinite' }} />
            Mise à jour auto · 30s
            {refreshing && <span style={{ color: lineColor, fontWeight: 600 }}>· Actualisation…</span>}
          </div>
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{stockRows.length}</span> entrées stock
              </span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <span style={{ color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, color: lineColor }}>
                  {(hasStockFilter ? stockTotalFiltered : kpiStock).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg
                </span>
                {hasStockFilter ? ' filtrés' : ' total'}
              </span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <span style={{ color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{kpiLots}</span> lots actifs
              </span>
            </div>
          )}
        </div>
        <button className="btn btn-secondary" style={{ gap: 5, fontSize: 12, height: 30 }}
          onClick={() => fetchAll(true)} disabled={refreshing}>
          <RefreshCw size={11} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* ── Indicateurs commandes (non dupliqués depuis Dashboard) ── */}
      {!loading && roleFiltered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <KpiCard icon={ShoppingCart} label="Commandes en cours"  value={roleFiltered.length}
            sub={`Gens : ${availableGens.join(' · ')}`} color="gold" delay={0} />
          <KpiCard icon={CheckCircle2} label="Allouées"            value={kpiAlloc}
            sub={`${kpiPending} en attente`}           color="green" delay={60} />
          <KpiCard icon={Package}      label="Lots dans le scope"  value={kpiLots}
            sub={isAdmin ? 'G0→R2 complet' : `Périmètre ${allowedGens.join('·')}`} color="blue" delay={120} />
        </div>
      )}

      {/* ── Stock disponible par espèce / variété ── */}
      <div className="card">
        {/* En-tête + filtres */}
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="card-title">
            <span className="card-title-icon"><Database size={14}/></span>
            Stock disponible — Espèces &amp; Variétés
            {!loading && (
              <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 11 }}>
                {hasStockFilter ? `${filteredStockRows.length} / ${stockRows.length}` : stockRows.length} entrées
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Recherche variété */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, minWidth: 180,
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px' }}>
              <Search size={11} color="var(--text-muted)" />
              <input type="text" placeholder="Rechercher une variété…" value={filterVariete}
                onChange={(e: { target: { value: string } }) => setFilterVariete(e.target.value)}
                style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12,
                  color: 'var(--text-primary)', width: '100%' }} />
              {filterVariete && (
                <button onClick={() => setFilterVariete('')}
                  style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0,display:'flex' }}>
                  <X size={10}/>
                </button>
              )}
            </div>
            {/* Filtre espèce */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30,
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px' }}>
              <Filter size={10} color="var(--text-muted)" />
              <select value={filterEspece}
                onChange={(e: { target: { value: string } }) => setFilterEspece(e.target.value)}
                style={{ border:'none',background:'none',fontSize:12,color:'var(--text-primary)',outline:'none',cursor:'pointer' }}>
                <option value="">Toutes espèces ({especeOptions.length})</option>
                {especeOptions.map(esp => (
                  <option key={esp} value={esp}>
                    {esp}{especeMap[esp] && especeMap[esp] !== esp ? ` — ${especeMap[esp]}` : ''}
                  </option>
                ))}
              </select>
              {filterEspece && (
                <button onClick={() => setFilterEspece('')}
                  style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0,display:'flex' }}>
                  <X size={10}/>
                </button>
              )}
            </div>
            {/* Filtre génération */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30,
              background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px' }}>
              <Filter size={10} color="var(--text-muted)" />
              <select value={filterGenStock}
                onChange={(e: { target: { value: string } }) => setFilterGenStock(e.target.value)}
                style={{ border:'none',background:'none',fontSize:12,color:'var(--text-primary)',outline:'none',cursor:'pointer' }}>
                <option value="">Toutes générations</option>
                {availableGens.map(g => <option key={g} value={g}>{g} — {GEN_LABEL[g]}</option>)}
              </select>
              {filterGenStock && (
                <button onClick={() => setFilterGenStock('')}
                  style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:0,display:'flex' }}>
                  <X size={10}/>
                </button>
              )}
            </div>
            {/* Effacer tout */}
            {hasStockFilter && (
              <button onClick={() => { setFilterEspece(''); setFilterVariete(''); setFilterGenStock('') }}
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--red-600)', background: 'none',
                  border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                Effacer filtres
              </button>
            )}
          </div>
        </div>

        {/* Résumé filtré */}
        {hasStockFilter && !loading && (
          <div style={{ padding: '8px 16px', background: `${lineColor}08`,
            borderBottom: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Filtré :
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: 5 }}>
                {filteredStockRows.length} variétés
              </span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Stock total filtré :
              <span style={{ fontWeight: 700, color: lineColor, marginLeft: 5 }}>
                {stockTotalFiltered.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg
              </span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              Espèces :
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: 5 }}>
                {[...new Set(filteredStockRows.map(r => r.codeEspece))].length}
              </span>
            </span>
          </div>
        )}

        {/* BarChart stock filtré */}
        {!loading && filteredStockBarData.length > 0 && (
          <div style={{ padding: '12px 16px 4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Top {filteredStockBarData.length} variétés — stock disponible (kg)
              {hasStockFilter && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>(filtre actif)</span>}
            </div>
            <BarChart data={filteredStockBarData} yLabel="Stock disponible (kg)" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10,
              paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              {[...new Set(filteredStockBarData.map(b => b.gen))].map(gen => (
                <span key={gen} style={{
                  fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: '2px 9px',
                  background: `${GEN_COLOR[gen]}15`, color: GEN_COLOR[gen],
                  border: `1px solid ${GEN_COLOR[gen]}35`,
                }}>
                  {gen} — {GEN_LABEL[gen] ?? gen}
                </span>
              ))}
            </div>
          </div>
        )}
        {!loading && filteredStockBarData.length === 0 && stockRows.length > 0 && (
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center' }}>
            Aucune variété ne correspond aux filtres actifs — modifiez les critères pour afficher le graphique.
          </div>
        )}

        {/* Tableau triable */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {([
                  { col: 'nomEspece'  as StockSortKey, label: 'Espèce' },
                  { col: 'nomVariete' as StockSortKey, label: 'Variété' },
                  { col: 'generation' as StockSortKey, label: 'Gén.' },
                  { col: 'stockKg'    as StockSortKey, label: 'Stock disponible' },
                  { col: 'nbLots'     as StockSortKey, label: 'Lots actifs' },
                  { col: 'demandKg'   as StockSortKey, label: 'Demande (kg)' },
                ] as { col: StockSortKey; label: string }[]).map(({ col, label }) => (
                  <th key={col} onClick={() => thSort(col)}
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {label}
                      {stockSortCol === col
                        ? <span style={{ fontSize: 9, opacity: 0.85 }}>{stockSortAsc ? '↑' : '↓'}</span>
                        : <span style={{ fontSize: 9, opacity: 0.25 }}>↕</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0,1,2,3,4].map(i => (
                  <tr key={i}><td colSpan={6}>
                    <div className="skeleton" style={{ height: 13, borderRadius: 4 }}/>
                  </td></tr>
                ))
              ) : filteredStockRows.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <div className="empty-icon"><Database size={18}/></div>
                    <div className="empty-title">{hasStockFilter ? 'Aucun résultat' : 'Aucun stock disponible'}</div>
                    <div className="empty-sub">
                      {hasStockFilter ? 'Modifiez ou effacez les filtres ci-dessus' : 'Les entrées de stock apparaîtront ici dès qu\'elles seront enregistrées'}
                    </div>
                  </div>
                </td></tr>
              ) : (
                filteredStockRows.slice(0, 100).map((r, i) => {
                  const genClr = GEN_COLOR[r.generation] ?? '#6b7280'
                  const isCrit = r.demandKg > 0 && r.stockKg < r.demandKg * 0.5
                  const isLow  = !isCrit && r.demandKg > 0 && r.stockKg < r.demandKg
                  return (
                    <tr key={i} style={{ background: isCrit ? '#fef2f220' : isLow ? '#fffbeb20' : 'transparent' }}>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{r.codeEspece}</span>
                        {r.nomEspece !== r.codeEspece && (
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 5 }}>{r.nomEspece}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.nomVariete}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.codeVariete}</div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 9px',
                          background: `${genClr}18`, color: genClr, border: `1px solid ${genClr}35`,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          {r.generation}
                          <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>{GEN_LABEL[r.generation] ?? ''}</span>
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700, fontSize: 13.5, fontVariantNumeric: 'tabular-nums',
                          color: isCrit ? 'var(--red-600)' : isLow ? 'var(--gold-dark)' : 'var(--text-primary)',
                        }}>
                          {r.stockKg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 11 }}>kg</span>
                        {(isCrit || isLow) && (
                          <span style={{
                            marginLeft: 6, fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px',
                            background: isCrit ? '#fef2f2' : '#fffbeb',
                            color: isCrit ? 'var(--red-600)' : 'var(--gold-dark)',
                            border: `1px solid ${isCrit ? '#fecaca' : '#fde68a'}`,
                          }}>
                            {isCrit ? '⚠ Critique' : '⚠ Bas'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{r.nbLots}</span>
                      </td>
                      <td>
                        {r.demandKg > 0 ? (
                          <span style={{
                            fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums',
                            color: r.demandKg > r.stockKg ? 'var(--red-600)' : 'var(--text-secondary)',
                          }}>
                            {r.demandKg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {filteredStockRows.length > 100 && (
            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12,
              color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              100 / {filteredStockRows.length} lignes affichées
            </div>
          )}
        </div>
      </div>

      {/* ── Graphiques ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>

        {/* BarChart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><BarChart2 size={14}/></span>
              Quantité demandée par variété
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Top {barData.length} variétés</span>
          </div>
          <div style={{ padding: '12px 16px 16px' }}>
            {loading ? <div className="skeleton" style={{ height: 180, borderRadius: 6 }}/> :
             barData.length === 0 ?
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Aucune commande disponible
              </div> : (
              <>
                <BarChart data={barData} />
                {/* Légende */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12,
                  padding: '8px 4px', borderTop: '1px solid var(--border)' }}>
                  {[...new Set(barData.map(b => b.gen))].map(gen => (
                    <span key={gen} style={{
                      fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: '2px 9px',
                      background: `${GEN_COLOR[gen]}15`, color: GEN_COLOR[gen],
                      border: `1px solid ${GEN_COLOR[gen]}35`,
                    }}>
                      {gen} — {GEN_LABEL[gen] ?? gen}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* LineChart + statuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* LineChart */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">
                <span className="card-title-icon"><TrendingUp size={14}/></span>
                Évolution mensuelle
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>6 mois glissants</span>
            </div>
            <div style={{ padding: '12px 16px 16px' }}>
              {loading ? <div className="skeleton" style={{ height: 180, borderRadius: 6 }}/> :
               monthly.every(m => m.count === 0) ?
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Aucune donnée sur 6 mois
                </div> :
                <LineChart data={monthly} color={lineColor} />
              }
            </div>
          </div>

          {/* Résumé statuts commandes */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <span className="card-title-icon"><ShoppingCart size={14}/></span>
                Répartition des statuts
              </span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {loading ? (
                [0,1,2].map(i => <div key={i} className="skeleton"
                  style={{ height: 44, margin: '6px 16px', borderRadius: 7 }}/>)
              ) : (
                statusSummary.map(({ label, count, icon: Icon, color, bg, pct }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 16px', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: color,
                          width: `${(pct * 100).toFixed(0)}%`, transition: 'width 0.6s ease' }}/>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tableau des commandes ── */}
      <div className="card">
        <div className="card-header" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="card-title">
            <span className="card-title-icon"><ShoppingCart size={14}/></span>
            Détail des commandes
            {!loading && (
              <span className="badge badge-gold" style={{ marginLeft: 6, fontSize: 11 }}>
                {tableRows.length}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {/* Filtre génération */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '0 10px' }}>
              <Filter size={10} color="var(--text-muted)" />
              <select value={filterGen} onChange={(e: { target: { value: string } }) => setFilterGen(e.target.value)}
                style={{ border: 'none', background: 'none', fontSize: 12,
                  color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                <option value="">Toutes générations</option>
                {availableGens.map(g => <option key={g} value={g}>{g} — {GEN_LABEL[g]}</option>)}
              </select>
              {filterGen && <button onClick={() => setFilterGen('')}
                style={{ background:'none',border:'none',cursor:'pointer',display:'flex',color:'var(--text-muted)',padding:0 }}>
                <X size={10}/></button>}
            </div>
            {/* Filtre statut */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '0 10px' }}>
              <Filter size={10} color="var(--text-muted)" />
              <select value={filterStatut} onChange={(e: { target: { value: string } }) => setFilterStatut(e.target.value)}
                style={{ border: 'none', background: 'none', fontSize: 12,
                  color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                <option value="">Tous statuts</option>
                {availableStatuts.map(s => <option key={s} value={s}>{STATUT_LABEL[s] ?? s}</option>)}
              </select>
              {filterStatut && <button onClick={() => setFilterStatut('')}
                style={{ background:'none',border:'none',cursor:'pointer',display:'flex',color:'var(--text-muted)',padding:0 }}>
                <X size={10}/></button>}
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code commande</th>
                <th>Client</th>
                <th>Variété</th>
                <th>Génération</th>
                <th>Quantité demandée</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0,1,2,3,5].map(i => (
                  <tr key={i}><td colSpan={7}>
                    <div className="skeleton" style={{ height: 13, borderRadius: 4 }}/>
                  </td></tr>
                ))
              ) : tableRows.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state" style={{ padding: '36px 0' }}>
                    <div className="empty-icon"><ShoppingCart size={20}/></div>
                    <div className="empty-title">Aucune commande</div>
                    <div className="empty-sub">
                      {(filterGen || filterStatut) ? 'Modifiez les filtres ci-dessus' : 'Aucune commande dans vos générations'}
                    </div>
                  </div>
                </td></tr>
              ) : (
                tableRows.slice(0, 50).map(o => {
                  const genClr = GEN_COLOR[o.generation] ?? '#6b7280'
                  return (
                    <tr key={o.id}>
                      <td>
                        <span className="td-mono" style={{ fontWeight: 700, fontSize: 11.5, letterSpacing: '0.03em' }}>
                          {o.codeCommande}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: 12.5 }}>{o.client}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{o.nomVariete}</td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 9px',
                          background: `${genClr}18`, color: genClr,
                          border: `1px solid ${genClr}35`,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          {o.generation}
                          <span style={{ fontWeight: 400, opacity: 0.75 }}>·</span>
                          <span style={{ fontSize: 9, fontWeight: 400 }}>{GEN_LABEL[o.generation] ?? ''}</span>
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                          {o.quantite.toLocaleString('fr-FR')}
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 11 }}>{o.unite}</span>
                      </td>
                      <td>
                        <span className={`badge ${STATUT_BADGE[o.statut] ?? 'badge-gray'}`} style={{ fontSize: 11 }}>
                          {STATUT_LABEL[o.statut] ?? o.statut}
                        </span>
                      </td>
                      <td style={{ fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {o.date || '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {tableRows.length > 50 && (
            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12,
              color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              50 / {tableRows.length} commandes affichées
            </div>
          )}
        </div>
      </div>

      {/* ── Alertes stock vs demande ── */}
      {!loading && speciesAlerts.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon" style={{ background: '#fef9ed' }}>
                <AlertTriangle size={14} color="var(--gold-dark)"/>
              </span>
              Couverture stock / demande — par espèce
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Ratio = stock disponible ÷ demandes en cours
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {speciesAlerts.map((a, i) => {
              const crit = a.ratio < 1; const warn = a.ratio >= 1 && a.ratio < 2
              const clr  = crit ? 'var(--red-600)' : warn ? 'var(--gold-dark)' : 'var(--green-700)'
              const bg   = crit ? '#fef2f2'         : warn ? '#fffbeb'          : '#f0fdf4'
              const barC = crit ? '#ef4444'          : warn ? '#f59e0b'          : '#16a34a'
              const pct  = Math.min((a.stockKg / Math.max(a.demande, 1)) * 50, 100)
              return (
                <div key={a.codeEspece} style={{
                  padding: '16px 18px', background: bg,
                  borderRight: (i % 3) !== 2 ? '1px solid var(--border)' : 'none',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {crit && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
                        display: 'inline-block', animation: 'pulse-dot 1.4s ease infinite' }}/>}
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{a.codeEspece}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px',
                      borderRadius: 99, background: `${clr}18`, color: clr, border: `1px solid ${clr}30` }}>
                      {crit ? 'CRITIQUE' : warn ? 'Attention' : 'Couvert'}
                    </span>
                  </div>

                  {/* Barre avec label intégré */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4,
                      fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                      <span>Couverture</span>
                      <span style={{ color: clr, fontWeight: 700 }}>{a.ratio < 10 ? `${a.ratio.toFixed(1)}×` : '>10×'}</span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: barC,
                        width: `${pct}%`, transition: 'width 0.7s ease',
                        boxShadow: `0 0 6px ${barC}80` }}/>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 2 }}>Stock</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {a.stockKg.toLocaleString('fr-FR')} kg
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 2 }}>Demande</div>
                      <div style={{ fontWeight: 700, color: clr, fontVariantNumeric: 'tabular-nums' }}>
                        {a.demande.toLocaleString('fr-FR')} kg
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.7)} }
      `}</style>
    </div>
  )
}
