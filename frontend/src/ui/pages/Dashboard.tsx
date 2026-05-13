import { useEffect, useRef, useState } from 'react'
import {
  Package, Layers, ShoppingCart, Leaf,
  RefreshCw, Plus, Database, ArrowRight,
  Search, Filter, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api }             from '../../lib/api'
import { endpoints }       from '../../lib/endpoints'
import { SelectorAnalytics } from './SelectorAnalytics'
import { PendingDeliveries } from '../components/PendingDeliveries'

interface Props { roleKey: string; userSpecialisation?: string | null }

interface Stats {
  lotsCount:       number
  stockTotal:      number
  ordersCount:     number
  varietiesCount:  number
  ordersPending:   number
  genCounts:       Record<string, number>
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
const GEN_CFG: Record<string, { bg: string; color: string }> = {
  G0: { bg: '#eff6ff', color: '#1d4ed8' },
  G1: { bg: '#f0fdf4', color: '#15803d' },
  G2: { bg: '#fef9ed', color: '#92660a' },
  G3: { bg: '#faf5ff', color: '#6d28d9' },
  G4: { bg: '#fef2f2', color: '#b91c1c' },
  R1: { bg: '#f0fdfa', color: '#0f766e' },
  R2: { bg: '#dcfce7', color: '#16a34a' },
}
const GEN_LABELS: Record<string, string> = {
  G0: 'Noyau génétique', G1: 'Pré-base',  G2: 'Base',
  G3: 'Certifiée C1',    G4: 'Certifiée C2', R1: 'R1', R2: 'Commerciale R2',
}
const GEN_COLOR: Record<string, string> = {
  G0: '#1d4ed8', G1: '#15803d', G2: '#92660a',
  G3: '#6d28d9', G4: '#b91c1c', R1: '#0f766e', R2: '#16a34a',
}
const GEN_LABEL: Record<string, string> = {
  G0: 'Génétique', G1: 'Pré-base', G2: 'Base',
  G3: 'Certif. C1', G4: 'Certif. C2', R1: 'R1', R2: 'Commerciale',
}
const ROLE_GENS: Record<string, string[]> = {
  'seed-admin':         ['G0','G1','G2','G3','G4','R1','R2'],
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

const REFRESH_MS = 30_000

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
function KpiCard({ icon: Icon, label, value, sub, accent, delay, suffix }: {
  icon: LucideIcon; label: string; value: number
  sub?: string; accent: string; delay: number; suffix?: string
}) {
  const [vis, setVis] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t) }, [delay])
  const displayed = useCountUp(value, delay + 80, vis)

  return (
    <div
      style={{
        background: '#fff', borderRadius: 14,
        border: '1px solid var(--border)', overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 0.45s ease, transform 0.45s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 28px ${accent}20, 0 2px 8px rgba(0,0,0,0.06)` }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${accent}1c, ${accent}08)`,
            border: `1px solid ${accent}1e`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
          }}>
            <Icon size={17} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', paddingTop: 2 }}>
            {label}
          </span>
        </div>
        <div style={{ lineHeight: 1 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Fraunces, serif', letterSpacing: '-0.03em' }}>
            {displayed.toLocaleString('fr-FR')}
          </span>
          {suffix && <span style={{ fontSize: 15, fontWeight: 600, color: accent, marginLeft: 5 }}>{suffix}</span>}
        </div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ────────────────── BarChart SVG ────────────────── */
function BarChart({ data, yLabel = 'Stock disponible (kg)' }: { data: BarDatum[]; yLabel?: string }) {
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
              fontSize={9} fill="var(--text-muted)" fontFamily="Outfit,sans-serif">
              {v > 999 ? `${(v / 1000).toFixed(0)}k` : v}
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
                fontSize={isHov ? 10 : 9} fontWeight={700} fill={d.color} fontFamily="Outfit,sans-serif"
                style={{ transition: 'font-size 0.1s' }}>
                {d.value > 9999 ? `${(d.value / 1000).toFixed(1)}k` : d.value.toLocaleString('fr-FR')} kg
              </text>
            )}
            <text x={x + bw / 2} y={PAD_T + innerH + 14} textAnchor="middle"
              fontSize={9} fill={isHov ? d.color : 'var(--text-secondary)'}
              fontWeight={isHov ? 700 : 400} fontFamily="Outfit,sans-serif">
              {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
            </text>
            <text x={x + bw / 2} y={PAD_T + innerH + 26} textAnchor="middle"
              fontSize={8} fill={d.color} fontWeight={600} fontFamily="Outfit,sans-serif" opacity={0.8}>
              {d.gen}
            </text>
            {isHov && (
              <g>
                <rect x={x + bw / 2 - 46} y={y - 42} width={92} height={32} rx={5} fill="var(--text-primary)" opacity={0.92} />
                <text x={x + bw / 2} y={y - 28} textAnchor="middle" fontSize={9} fill="#fff" fontWeight={700} fontFamily="Outfit,sans-serif">
                  {d.label}
                </text>
                <text x={x + bw / 2} y={y - 16} textAnchor="middle" fontSize={9} fill={d.color} fontWeight={600} fontFamily="Outfit,sans-serif">
                  {d.value.toLocaleString('fr-FR')} kg · {GEN_LABEL[d.gen] ?? d.gen}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {/* Label axe Y */}
      <text x={10} y={PAD_T + innerH / 2} textAnchor="middle"
        fontSize={9} fill="var(--text-muted)" fontFamily="Outfit,sans-serif"
        transform={`rotate(-90, 10, ${PAD_T + innerH / 2})`}>
        {yLabel}
      </text>
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════ */
export function Dashboard({ roleKey, userSpecialisation }: Props) {
  const [stats, setStats] = useState<Stats>({
    lotsCount: 0, stockTotal: 0, ordersCount: 0, varietiesCount: 0,
    ordersPending: 0, genCounts: {}, recentLots: [],
  })
  const [rawLots,      setRawLots]      = useState<any[]>([])
  const [rawStocks,    setRawStocks]    = useState<any[]>([])
  const [rawVarieties, setRawVarieties] = useState<any[]>([])
  const [rawOrders,    setRawOrders]    = useState<any[]>([])
  const [varMap,       setVarMap]       = useState<Record<number, string>>({})
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [heroVis,      setHeroVis]      = useState(false)

  /* Stock filters */
  const [filterEspece,   setFilterEspece]   = useState('')
  const [filterVariete,  setFilterVariete]  = useState('')
  const [filterGenStock, setFilterGenStock] = useState('')
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
    const lotsUrl   = isMulti ? endpoints.lotsMesLots    : endpoints.lots
    const stocksUrl = isMulti ? endpoints.stockMonStock  : endpoints.stocks
    const ordersUrl = isMulti ? endpoints.ordersATraiter : endpoints.orders

    const results = await Promise.allSettled([
      api.get(lotsUrl), api.get(stocksUrl), api.get(ordersUrl), api.get(endpoints.varieties),
    ])

    const lots      = results[0].status === 'fulfilled' ? results[0].value.data : []
    const stocks    = results[1].status === 'fulfilled' ? results[1].value.data : []
    const orders    = results[2].status === 'fulfilled' ? results[2].value.data : []
    const varieties = results[3].status === 'fulfilled' ? results[3].value.data : []

    const genCounts = lots.reduce((acc: Record<string, number>, l: any) => {
      const g = l.generation?.codeGeneration || 'N/A'
      acc[g] = (acc[g] || 0) + 1
      return acc
    }, {})

    const stockTotal    = stocks.reduce((s: number, x: any) => s + (parseFloat(x.quantiteDisponible) || 0), 0)
    const ordersPending = orders.filter((o: any) => ['PENDING', 'EN_ATTENTE'].includes(o.statut)).length
    const recentLots    = [...lots].sort((a: any, b: any) => (b.id || 0) - (a.id || 0)).slice(0, 8)

    const vm: Record<number, string> = {}
    varieties.forEach((v: any) => { if (v.id) vm[v.id] = v.nomVariete ?? v.codeVariete ?? `#${v.id}` })

    setVarMap(vm)
    setRawLots(lots)
    setRawStocks(stocks)
    setRawVarieties(varieties)
    setRawOrders(orders)
    setStats({ lotsCount: lots.length, stockTotal, ordersCount: orders.length, varietiesCount: varieties.length, ordersPending, genCounts, recentLots })
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(() => fetchAll(true), REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [roleKey])

  const role     = ROLE_CFG[roleKey] || { color: '#16a34a', label: 'Tableau de bord' }
  const accent   = role.color
  const greeting = GREETINGS[roleKey] || { title: 'Tableau de bord', sub: "Vue d'ensemble" }
  const maxGen   = Math.max(1, ...Object.values(stats.genCounts))

  const isQuotaire   = roleKey === 'seed-quotataire'
  const showStats    = !isQuotaire
  const showPipeline = ['seed-admin', 'seed-selector', 'seed-upsemcl'].includes(roleKey)
  const showLots     = !isQuotaire
  const showOrders   = isQuotaire || ['seed-admin', 'seed-upsemcl', 'seed-multiplicator'].includes(roleKey)
  const showStock    = !isQuotaire

  /* Items KPI selon le rôle */
  const kpiItems = [
    ...(showStats ? [
      { icon: Package,      label: 'Total lots',        value: stats.lotsCount,              sub: 'tous statuts',          accent: '#16a34a', delay: 0,   suffix: undefined },
      { icon: Database,     label: 'Stock total',       value: Math.round(stats.stockTotal), sub: undefined,               accent: '#2563eb', delay: 80,  suffix: 'kg' },
    ] : []),
    { icon: Leaf,           label: 'Variétés actives',  value: stats.varietiesCount,          sub: 'espèces enregistrées', accent: '#b45309', delay: showStats ? 160 : 0,  suffix: undefined },
    ...(showOrders ? [
      { icon: ShoppingCart, label: roleKey === 'seed-multiplicator' ? 'Cmdes reçues' : 'Commandes',
        value: stats.ordersCount, sub: `${stats.ordersPending} en attente`, accent, delay: showStats ? 240 : 80, suffix: undefined },
    ] : []),
  ]

  /* ── Stock computation ── */
  const allowedStockGens = ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2']
  const varietyMap: Record<number, any> = Object.fromEntries(rawVarieties.map((v: any) => [v.id, v]))
  const lotMap: Record<number, any>     = Object.fromEntries(rawLots.map((l: any) => [l.id, l]))

  const stockRowMap: Record<string, StockRow> = {}
  rawStocks.forEach((st: any) => {
    const lotObj      = st.lot ?? lotMap[st.idLot ?? st.lotId] ?? {}
    const gen         = lotObj.generation?.codeGeneration ?? st.generation ?? '?'
    if (!allowedStockGens.includes(gen)) return
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
  rawLots.forEach((l: any) => {
    const gen         = l.generation?.codeGeneration ?? '?'
    if (!allowedStockGens.includes(gen)) return
    const variety     = varietyMap[l.idVariete ?? l.varieteId ?? -1] ?? l.variete ?? {}
    const codeVariete = variety.codeVariete ?? l.codeVariete
    if (!codeVariete) return
    const key    = `${codeVariete}|${gen}`
    const active = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT','SOUCHE']
    if (stockRowMap[key] && active.includes((l.statut ?? '').toUpperCase())) stockRowMap[key].nbLots++
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
    (!filterEspece   || r.codeEspece === filterEspece) &&
    (!filterGenStock || r.generation === filterGenStock) &&
    (!filterVariete  || r.codeVariete.toLowerCase().includes(filterVariete.toLowerCase())
                     || r.nomVariete.toLowerCase().includes(filterVariete.toLowerCase()))
  )
  const filteredStockBarData: BarDatum[] = [...filteredStockRows]
    .sort((a, b) => b.stockKg - a.stockKg).slice(0, 10)
    .map(r => ({ label: r.codeVariete, value: Math.round(r.stockKg), color: GEN_COLOR[r.generation] ?? '#6b7280', gen: r.generation }))

  const stockTotalAll      = stockRows.reduce((s, r) => s + r.stockKg, 0)
  const stockTotalFiltered = filteredStockRows.reduce((s, r) => s + r.stockKg, 0)
  const hasStockFilter     = !!(filterEspece || filterVariete || filterGenStock)

  /* ── Couverture stock / demande par espèce ── */
  const especeCovMap: Record<string, { nom: string; stockKg: number; demandKg: number }> = {}
  rawStocks.forEach((st: any) => {
    const lotObj    = st.lot ?? lotMap[st.idLot ?? st.lot?.id ?? -1] ?? {}
    const gen       = lotObj.generation?.codeGeneration ?? st.generation ?? '?'
    if (!allowedStockGens.includes(gen)) return
    let variety: any = lotObj.variete ?? varietyMap[lotObj.idVariete ?? -1] ?? {}
    if (!variety.codeVariete) variety = varietyMap[st.idVariete ?? -1] ?? st.variete ?? {}
    const esp  = variety.espece ?? {}
    const code = esp.codeEspece ?? '?'
    if (code === '?') return
    if (!especeCovMap[code]) especeCovMap[code] = { nom: esp.nomEspece ?? code, stockKg: 0, demandKg: 0 }
    especeCovMap[code].stockKg += parseFloat(st.quantiteDisponible) || 0
  })
  rawOrders.forEach((o: any) => {
    const lot     = lotMap[o.idLot ?? o.lotId ?? -1] ?? {}
    const gen     = lot.generation?.codeGeneration ?? o.generation ?? '?'
    if (!allowedStockGens.includes(gen)) return
    const variety = varietyMap[lot.idVariete ?? -1] ?? {}
    const esp     = variety.espece ?? {}
    const code    = esp.codeEspece ?? '?'
    if (code === '?') return
    const activeStatuts = ['EN_ATTENTE','PENDING','CONFIRMEE','CONFIRMED','ALLOUEE','ALLOCATED']
    if (!activeStatuts.includes((o.statut ?? '').toUpperCase())) return
    if (!especeCovMap[code]) especeCovMap[code] = { nom: esp.nomEspece ?? code, stockKg: 0, demandKg: 0 }
    especeCovMap[code].demandKg += parseFloat(o.quantite ?? o.quantiteDemandee ?? 0) || 0
  })
  const coverageItems = Object.entries(especeCovMap)
    .map(([code, v]) => ({ code, nom: v.nom, stockKg: v.stockKg, demandKg: v.demandKg, ratio: v.demandKg > 0 ? v.stockKg / v.demandKg : 99 }))
    .filter(c => c.stockKg > 0 || c.demandKg > 0)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 8)
  const maxCovKg     = Math.max(...coverageItems.map(c => Math.max(c.stockKg, c.demandKg)), 1)
  const criticalCov  = coverageItems.filter(c => c.demandKg > 0 && c.ratio < 1).length
  const warningCov   = coverageItems.filter(c => c.demandKg > 0 && c.ratio >= 1 && c.ratio < 2).length

  /* ── Prévisions de récolte (lots EN_PRODUCTION) ── */
  const forecastByGen: Record<string, { lots: number; ha: number; expectedKg: number }> = {}
  rawLots.forEach((l: any) => {
    const statut = (l.statut ?? '').toUpperCase()
    if (!['EN_PRODUCTION','EN_COURS_PRODUCTION','PLANTE','EN_CULTURE'].includes(statut)) return
    const gen = l.generation?.codeGeneration ?? '?'
    if (!allowedStockGens.includes(gen)) return
    const ha       = parseFloat(l.superficieHa ?? l.superficie_ha ?? 0) || 0
    const rend     = parseFloat(l.rendementKgHa ?? l.rendement_kg_ha ?? 0) || 0
    const brute    = parseFloat(l.productionBruteKg ?? l.production_brute_kg ?? 0) || 0
    const expected = brute > 0 ? brute : (ha > 0 && rend > 0 ? ha * rend : 0)
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
    ['EN_COURS_CERT','A_CERTIFIER','SOUMIS_CERT','SOUMIS_CERTIFICATION'].includes((l.statut ?? '').toUpperCase())
  ).length

  const hasAnyAlerts = criticalCov > 0 || warningCov > 0 || lotsACertifierCount > 0 || stats.ordersPending > 0

  return (
    <div>

      {/* ═══════════════ HERO BANNIÈRE ═══════════════ */}
      <div style={{
        marginBottom: 20, borderRadius: 16, overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: `0 4px 24px ${accent}18, 0 1px 4px rgba(0,0,0,0.06)`,
        opacity: heroVis ? 1 : 0,
        transform: heroVis ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}bb 42%, #0c1520 100%)`,
          padding: '22px 28px 20px', position: 'relative', overflow: 'hidden',
        }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="db-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#db-grid)" />
          </svg>
          <div style={{ position: 'absolute', top: -60, right: -40,  width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 200, width: 90,  height: 90,  borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 99, padding: '3px 12px', marginBottom: 10, backdropFilter: 'blur(6px)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block' }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{role.label}</span>
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 6 }}>
                {greeting.title}
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                {greeting.sub} · <span style={{ color: 'rgba(255,255,255,0.4)' }}>{today}</span>
              </p>
            </div>
            <button
              className="btn"
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.28)', color: '#fff', backdropFilter: 'blur(8px)', height: 36, fontSize: 12.5, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Strip résumé */}
        {!loading && (
          <div style={{ background: '#fff', borderTop: `3px solid ${accent}18`, display: 'flex', alignItems: 'center' }}>
            {([
              showStats  && { label: 'lots actifs',  value: stats.lotsCount.toLocaleString('fr-FR'),              color: '#16a34a' },
              showStats  && { label: 'kg en stock',  value: Math.round(stats.stockTotal).toLocaleString('fr-FR'), color: '#2563eb' },
              true       && { label: 'variétés',     value: stats.varietiesCount.toLocaleString('fr-FR'),         color: '#b45309' },
              showOrders && { label: 'commandes',    value: stats.ordersCount.toLocaleString('fr-FR'),            color: accent },
            ] as const).filter(Boolean).map((item: any, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: item.color, fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em' }}>{item.value}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{item.label}</span>
                </div>
                {i < arr.length - 1 && <div style={{ width: 1, height: 26, background: 'var(--border)', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════ KPI CARDS ═══════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiItems.length}, 1fr)`, gap: 14, marginBottom: 20 }}>
        {loading
          ? kpiItems.map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ height: 3, background: 'var(--surface-3)' }} />
                <div style={{ padding: '18px 20px' }}>
                  <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 14 }} />
                  <div className="skeleton" style={{ width: 64, height: 30, borderRadius: 6,  marginBottom: 8  }} />
                  <div className="skeleton" style={{ width: 96, height: 11, borderRadius: 4  }} />
                </div>
              </div>
            ))
          : kpiItems.map((item, i) => (
              <KpiCard key={i}
                icon={item.icon} label={item.label} value={item.value}
                sub={item.sub}   accent={item.accent} delay={item.delay} suffix={item.suffix}
              />
            ))
        }
      </div>

      {/* ══════════════════════════════════════════════════════
          CENTRE DE PILOTAGE — Alertes & Décisions
      ══════════════════════════════════════════════════════ */}
      {showStats && (
        <div style={{
          marginBottom: 20, borderRadius: 14, overflow: 'hidden',
          border: `1px solid ${hasAnyAlerts ? (criticalCov > 0 ? '#fecaca' : '#fde68a') : 'var(--border)'}`,
          boxShadow: criticalCov > 0 ? '0 2px 12px rgba(220,38,38,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {/* En-tête */}
          <div style={{
            padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 10,
            background: criticalCov > 0 ? 'linear-gradient(90deg,#fef2f2,#fff)' : hasAnyAlerts ? 'linear-gradient(90deg,#fffbeb,#fff)' : 'var(--surface-2)',
            borderBottom: `1px solid ${hasAnyAlerts ? (criticalCov > 0 ? '#fecaca' : '#fde68a') : 'var(--border)'}`,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: criticalCov > 0 ? '#fef2f2' : hasAnyAlerts ? '#fffbeb' : `${accent}12`,
              color: criticalCov > 0 ? '#dc2626' : hasAnyAlerts ? '#92660a' : accent,
              border: `1px solid ${criticalCov > 0 ? '#fecaca' : hasAnyAlerts ? '#fde68a' : accent + '28'}`,
            }}>
              <span style={{ fontSize: 13 }}>{criticalCov > 0 ? '⚠' : hasAnyAlerts ? '◎' : '✓'}</span>
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Centre de pilotage</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— alertes &amp; décisions</span>
            {!loading && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 10px',
                background: criticalCov > 0 ? '#fef2f2' : hasAnyAlerts ? '#fffbeb' : '#f0fdf4',
                color:      criticalCov > 0 ? '#dc2626' : hasAnyAlerts ? '#92660a' : '#15803d',
                border:     `1px solid ${criticalCov > 0 ? '#fecaca' : hasAnyAlerts ? '#fde68a' : '#bbf7d0'}`,
              }}>
                {criticalCov > 0 ? 'Action requise' : hasAnyAlerts ? 'À surveiller' : 'Situation nominale'}
              </span>
            )}
          </div>

          {/* Tuiles d'alertes */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#fff' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ padding: '18px 22px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                  <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, marginBottom: 10 }} />
                  <div className="skeleton" style={{ width: 48, height: 26, borderRadius: 5, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: 80, height: 11, borderRadius: 4 }} />
                </div>
              ))}
            </div>
          ) : !hasAnyAlerts ? (
            <div style={{ padding: '20px 22px', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d', flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>✓</span>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#15803d' }}>Situation nominale</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Stock couvert, aucun lot en attente de certification, commandes traitées.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 4 tuiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#fff' }}>
                {[
                  { count: criticalCov,          label: 'Espèces critiques',    sub: 'stock < demande',          emoji: '🔴', clr: '#dc2626', bg: '#fef2f2', brd: '#fecaca' },
                  { count: warningCov,            label: 'En tension',           sub: 'stock < 2× demande',       emoji: '🟡', clr: '#92660a', bg: '#fffbeb', brd: '#fde68a' },
                  { count: lotsACertifierCount,   label: 'Lots à certifier',     sub: 'certification en cours',   emoji: '📋', clr: '#0369a1', bg: '#eff6ff', brd: '#bfdbfe' },
                  { count: stats.ordersPending,   label: 'Cmdes en attente',     sub: 'nécessitent traitement',   emoji: '🕐', clr: accent,    bg: `${accent}0e`, brd: `${accent}30` },
                ].map((t, i) => (
                  <div key={i} style={{
                    padding: '18px 22px',
                    borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                    background: t.count > 0 ? t.bg : '#fff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>{t.emoji}</span>
                      {t.count > 0 && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.clr, display: 'inline-block', animation: t.clr === '#dc2626' ? 'pulse-dot 1.5s ease infinite' : 'none' }} />
                      )}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Fraunces, serif', letterSpacing: '-0.03em', color: t.count > 0 ? t.clr : 'var(--text-muted)', lineHeight: 1 }}>
                      {t.count}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>{t.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{t.sub}</div>
                  </div>
                ))}
              </div>

              {/* Liste des espèces critiques */}
              {criticalCov > 0 && (
                <div style={{ borderTop: '1px solid #fecaca', background: '#fef2f208' }}>
                  <div style={{ padding: '10px 22px 6px', fontSize: 10.5, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                    Espèces en rupture de couverture
                  </div>
                  {coverageItems.filter(c => c.demandKg > 0 && c.ratio < 1).map((c, i, arr) => {
                    const pct = Math.min((c.stockKg / c.demandKg) * 100, 100)
                    return (
                      <div key={c.code} style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px',
                        borderBottom: i < arr.length - 1 ? '1px solid #fecaca30' : 'none',
                      }}>
                        <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#dc2626' }}>{c.code}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.nom !== c.code ? c.nom : ''}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              Stock&nbsp;<span style={{ fontWeight: 700, color: '#dc2626', fontFamily: 'DM Mono, monospace' }}>{c.stockKg.toLocaleString('fr-FR',{maximumFractionDigits:0})}</span> kg
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              Demande&nbsp;<span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{c.demandKg.toLocaleString('fr-FR',{maximumFractionDigits:0})}</span> kg
                            </span>
                          </div>
                          <div style={{ height: 6, background: '#fee2e2', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#ef4444,#fca5a5)', borderRadius: 99, transition: 'width 0.7s ease' }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', fontFamily: 'DM Mono, monospace', flexShrink: 0 }}>
                          {c.ratio.toFixed(1)}×
                        </span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: '2px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', flexShrink: 0 }}>
                          CRITIQUE
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════ PIPELINE GÉNÉRATIONNEL ═══════════════ */}
      {showPipeline && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accent}15`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={13} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Pipeline générationnel</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— campagne en cours</span>
            {!loading && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '2px 10px' }}>
                {stats.lotsCount} lots au total
              </span>
            )}
          </div>
          <div style={{ padding: '22px 24px', display: 'flex', alignItems: 'center' }}>
            {['G0','G1','G2','G3','G4','R1','R2'].map((g, idx, arr) => {
              const cfg   = GEN_CFG[g]
              const count = loading ? 0 : (stats.genCounts[g] || 0)
              const pct   = Math.round((count / maxGen) * 100)
              return (
                <div key={g} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 11,
                      background: cfg.bg, border: `2px solid ${cfg.color}28`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: cfg.color,
                      boxShadow: count > 0 ? `0 3px 10px ${cfg.color}28` : 'none',
                      transition: 'box-shadow 0.3s ease',
                    }}>{g}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em', color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {loading ? <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 4 }} /> : count}
                    </div>
                    <div style={{ width: '76%', height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: loading ? '0%' : `${pct}%`,
                        background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}77)`,
                        borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 500, lineHeight: 1.3, maxWidth: 68 }}>
                      {GEN_LABELS[g]}
                    </div>
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ color: 'var(--border-strong)', flexShrink: 0, paddingBottom: 24 }}>
                      <ArrowRight size={13} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ ACTIONS RAPIDES ═══════════════ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
          <a href={endpoints.swagger.lot} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ background: accent, borderColor: accent, boxShadow: `0 3px 12px ${accent}40` }}>
              <Plus size={14} /> Nouveau lot
            </button>
          </a>
        )}
        {['seed-admin','seed-selector'].includes(roleKey) && (
          <a href={endpoints.swagger.catalog} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary"><Leaf size={13} /> Nouvelle variété</button>
          </a>
        )}
        {isQuotaire && (
          <a href={endpoints.swagger.order} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ background: accent, borderColor: accent, boxShadow: `0 3px 12px ${accent}40` }}>
              <ShoppingCart size={14} /> Passer une commande
            </button>
          </a>
        )}
        {['seed-admin','seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
          <a href={endpoints.swagger.stock} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary"><Database size={13} /> Mouvement stock</button>
          </a>
        )}
      </div>

      {/* ═══════════════ LOTS RÉCENTS ═══════════════ */}
      {showLots && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 20 }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: '#16a34a1a', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={13} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Lots récents</span>
            {!loading && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 99, padding: '2px 10px' }}>
                {stats.recentLots.length} derniers lots
              </span>
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
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '11px 22px', borderLeft: `3px solid ${cfg ? cfg.color : 'var(--border)'}` }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
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
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>
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
                onFocusCapture={e => (e.currentTarget.style.borderColor = accent)}
                onBlurCapture={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
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

              {/* Filtre génération */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 32,
                background: filterGenStock ? `${GEN_COLOR[filterGenStock] ?? accent}0e` : 'var(--surface-2)',
                border: `1px solid ${filterGenStock ? (GEN_COLOR[filterGenStock] ?? accent) + '40' : 'var(--border)'}`,
                borderRadius: 8, padding: '0 10px',
              }}>
                <Filter size={11} color={filterGenStock ? (GEN_COLOR[filterGenStock] ?? accent) : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                <select value={filterGenStock}
                  onChange={e => setFilterGenStock(e.target.value)}
                  style={{ border: 'none', background: 'none', fontSize: 12, color: filterGenStock ? (GEN_COLOR[filterGenStock] ?? accent) : 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontWeight: filterGenStock ? 700 : 400 }}>
                  <option value="">Toutes générations</option>
                  {allowedStockGens.map(g => <option key={g} value={g}>{g} — {GEN_LABEL[g]}</option>)}
                </select>
                {filterGenStock && (
                  <button onClick={() => setFilterGenStock('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: GEN_COLOR[filterGenStock] ?? accent, padding: 0, display: 'flex', flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Effacer tout */}
              {hasStockFilter && (
                <button
                  onClick={() => { setFilterEspece(''); setFilterVariete(''); setFilterGenStock('') }}
                  style={{
                    fontSize: 11.5, fontWeight: 700, color: '#dc2626',
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, height: 32,
                  }}>
                  <X size={11} /> Effacer
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
                    <span style={{ fontWeight: 700, color: accent, fontFamily: 'DM Mono, monospace' }}>
                      {(hasStockFilter ? stockTotalFiltered : stockTotalAll).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                    </span>
                    <span style={{ marginLeft: 3 }}>kg{hasStockFilter ? ' filtrés' : ' au total'}</span>
                  </span>
                  <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{stockRows.length}</span>
                    <span style={{ marginLeft: 3 }}>variétés × génération</span>
                  </span>
                  {hasStockFilter && (
                    <>
                      <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>
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
                  Top {filteredStockBarData.length} variétés
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>— stock disponible (kg)</span>
                {hasStockFilter && (
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface-3)', borderRadius: 99, padding: '1px 8px', border: '1px solid var(--border)', marginLeft: 4 }}>
                    filtres actifs
                  </span>
                )}
              </div>
              <BarChart data={filteredStockBarData} yLabel="Stock disponible (kg)" />
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
                  { col: 'stockKg'    as StockSortKey, label: 'Stock disponible' },
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
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>{r.codeVariete}</div>
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
                      <td style={{ padding: '12px 22px' }}>
                        <span style={{
                          fontWeight: 800, fontSize: 14, fontVariantNumeric: 'tabular-nums',
                          fontFamily: 'DM Mono, monospace', letterSpacing: '-0.01em',
                          color: isCrit ? '#dc2626' : isLow ? '#92660a' : 'var(--text-primary)',
                        }}>
                          {r.stockKg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 11 }}>kg</span>
                        {(isCrit || isLow) && (
                          <span style={{
                            marginLeft: 7, fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 7px',
                            background: isCrit ? '#fef2f2' : '#fffbeb',
                            color: isCrit ? '#dc2626' : '#92660a',
                            border: `1px solid ${isCrit ? '#fecaca' : '#fde68a'}`,
                          }}>
                            {isCrit ? '⚠ Critique' : '⚠ Bas'}
                          </span>
                        )}
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
                            fontFamily: 'DM Mono, monospace',
                            color: r.demandKg > r.stockKg ? '#dc2626' : 'var(--text-secondary)',
                          }}>
                            {r.demandKg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg
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
                          <span style={{ fontSize: 11, fontWeight: 700, color: clr, fontFamily: 'DM Mono, monospace' }}>
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
                          }} title={`Demande : ${c.demandKg.toLocaleString('fr-FR',{maximumFractionDigits:0})} kg`} />
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                        <span>Stock&nbsp;<span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{c.stockKg.toLocaleString('fr-FR',{maximumFractionDigits:0})}</span> kg</span>
                        {c.demandKg > 0 && <span>Demande&nbsp;<span style={{ fontWeight: 700, color: clr, fontFamily: 'DM Mono, monospace' }}>{c.demandKg.toLocaleString('fr-FR',{maximumFractionDigits:0})}</span> kg</span>}
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
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>Lots en production — campagne en cours</div>
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
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Aucun lot en production</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Les prévisions apparaissent dès qu'un lot passe au statut EN_PRODUCTION avec superficie et rendement renseignés
                </div>
              </div>
            ) : (
              <>
                {/* Résumé global */}
                <div style={{ padding: '12px 20px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 20, background: 'var(--surface-2)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Fraunces, serif', color: '#15803d', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {totalForecastLots}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>lots actifs</div>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Fraunces, serif', color: '#0369a1', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {totalForecastHa > 0 ? totalForecastHa.toLocaleString('fr-FR',{maximumFractionDigits:1}) : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>ha plantés</div>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Fraunces, serif', color: accent, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {totalForecastKg > 0 ? `~${(totalForecastKg/1000).toFixed(1)}t` : '—'}
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
                              {f.lots} lot{f.lots > 1 ? 's' : ''}
                              {f.ha > 0 && ` · ${f.ha.toLocaleString('fr-FR',{maximumFractionDigits:1})} ha`}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: genClr, fontFamily: 'DM Mono, monospace' }}>
                            {f.expectedKg > 0 ? `~${f.expectedKg.toLocaleString('fr-FR',{maximumFractionDigits:0})} kg` : 'données manquantes'}
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
                            Superficie et rendement non renseignés sur ces lots
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Note de bas */}
                <div style={{ padding: '8px 20px 14px', fontSize: 10.5, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                  Estimation basée sur superficie × rendement (ou production brute si disponible). Complétez les fiches lots pour affiner les prévisions.
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
                  <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {loading ? '…' : stats.varietiesCount}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>variétés</div>
                </div>
                <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em', lineHeight: 1 }}>
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

      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.7)} }
      `}</style>
    </div>
  )
}
