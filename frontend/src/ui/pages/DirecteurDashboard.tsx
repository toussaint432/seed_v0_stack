import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Package, TrendingUp, CheckCircle2, AlertTriangle, Layers, Wheat,
  ArrowRight, Lock, RefreshCw, AlertCircle, Info, ShieldCheck,
  Activity, BarChart3, Map, Clock, Database, Download, Search, Filter, X,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { extractList, normalizeLot, normalizeVariete } from '../../lib/normalizers'
import { MapSemences } from '../components/MapSemences'
import { fmtT, fmtKgTable } from '../../lib/fmt'
import { TD as D } from '../../lib/tokens'
import { GEN_CHART_COLORS } from '../../lib/constants'
import { downloadXlsx } from '../../lib/exportUtils'

const GEN_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2']
const GEN_COLOR: Record<string, string> = GEN_CHART_COLORS
const GEN_LABELS: Record<string, string> = {
  G0: 'Souche', G1: 'Pré-base', G2: 'Base', G3: 'Certifiée C1',
  G4: 'Certifiée C2', R1: 'Certifiée R1', R2: 'Commerciale',
}
const GEN_LABEL: Record<string, string> = {
  G0: 'Génétique', G1: 'Pré-base', G2: 'Base',
  G3: 'Certif. C1', G4: 'Certif. C2', R1: 'R1', R2: 'Commerciale',
}
const GEN_CFG: Record<string, { bg: string; color: string }> = {
  G0: { bg: '#eef2ff', color: GEN_COLOR.G0 },
  G1: { bg: '#f0f9ff', color: GEN_COLOR.G1 },
  G2: { bg: '#f0fdf4', color: GEN_COLOR.G2 },
  G3: { bg: '#fffbeb', color: GEN_COLOR.G3 },
  G4: { bg: '#fff7ed', color: GEN_COLOR.G4 },
  R1: { bg: '#fdf2f8', color: GEN_COLOR.R1 },
  R2: { bg: '#f0fdfa', color: GEN_COLOR.R2 },
}

const ACCENT = D.green

type StockSortKey = 'nomEspece' | 'nomVariete' | 'generation' | 'stockKg' | 'nbLots' | 'demandKg'
interface StockRow {
  codeEspece: string; nomEspece: string
  codeVariete: string; nomVariete: string
  generation: string; stockKg: number; nbLots: number; demandKg: number
}

function kgLabel(kg: number) {
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(1)} t`
  if (kg >= 1_000)     return `${(kg / 1_000).toFixed(1)} t`
  return `${kg.toLocaleString('fr-FR')} kg`
}
function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return 'à l\'instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  return `il y a ${Math.floor(s / 3600)} h`
}

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

/* ── GroupedHBarChart ── */
function GroupedHBarChart({ rows, accent }: { rows: StockRow[]; accent: string }) {
  const [hovered, setHovered] = useState<string | null>(null)
  if (rows.length === 0) return null
  const grouped: Record<string, { nomVariete: string; gens: [string, number][] }> = {}
  rows.forEach(r => {
    if (!grouped[r.codeVariete]) grouped[r.codeVariete] = { nomVariete: r.nomVariete, gens: [] }
    grouped[r.codeVariete].gens.push([r.generation, r.stockKg])
  })
  const globalMax = Math.max(1, ...rows.map(r => r.stockKg))
  const entries = Object.entries(grouped).sort(([, a], [, b]) =>
    b.gens.reduce((s, [, v]) => s + v, 0) - a.gens.reduce((s, [, v]) => s + v, 0)
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {entries.map(([code, { nomVariete, gens }]) => {
        const isHov = hovered === code
        const total = gens.reduce((s, [, v]) => s + v, 0)
        return (
          <div key={code}
            onMouseEnter={() => setHovered(code)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: 'grid', gridTemplateColumns: '150px 1fr 80px', alignItems: 'start', gap: 10, cursor: 'default' }}
          >
            <div style={{ paddingTop: 2 }}>
              <div style={{ fontSize: 11.5, fontWeight: isHov ? 600 : 400, color: isHov ? D.ink : D.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, transition: 'color 0.15s' }}>{nomVariete}</div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: D.mono, marginTop: 1 }}>{code}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {gens.map(([gen, kg]) => {
                const pct = (kg / globalMax) * 100
                return (
                  <div key={gen} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: GEN_COLOR[gen] ?? '#6b7280', width: 20, flexShrink: 0, fontFamily: D.mono }}>{gen}</span>
                    <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: GEN_COLOR[gen] ?? '#6b7280', borderRadius: 99, opacity: isHov ? 1 : 0.8, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, fontFamily: D.mono, color: 'var(--text-muted)', width: 48, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' }}>{fmtT(kg)}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums', fontFamily: D.mono, color: isHov ? accent : 'var(--text-secondary)', paddingTop: 2, transition: 'color 0.15s' }}>
              {fmtT(total)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Types ── */
interface GenStat { gen: string; count: number; totalKg: number }
interface LotBrief {
  id: number; codeLot: string; idVariete: number; codeEspece?: string
  statutCertification?: string; statutEdition?: string
  generation?: { codeGeneration: string }
}

/* ════════════════════════════════════════════════════════════════ */
export function DirecteurDashboard() {
  const [genStats,   setGenStats]   = useState<GenStat[]>([])
  const [lots,       setLots]       = useState<LotBrief[]>([])
  const [varieties,  setVarieties]  = useState<any[]>([])
  const [rawAgrege,  setRawAgrege]  = useState<any[]>([])
  const [rawOrders,  setRawOrders]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [ready,      setReady]      = useState(false)
  const [lastFetch,  setLastFetch]  = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // ── Stock filters ──
  const allowedStockGens = GEN_ORDER
  const [filterEspece,   setFilterEspece]   = useState('')
  const [filterVariete,  setFilterVariete]  = useState('')
  const [filterGens,     setFilterGens]     = useState<string[]>(allowedStockGens)
  const [stockSortCol,   setStockSortCol]   = useState<StockSortKey>('stockKg')
  const [stockSortAsc,   setStockSortAsc]   = useState(false)
  const [stockCollapsed, setStockCollapsed] = useState(false)

  // ── Demand filters ──
  const [demandPeriod, setDemandPeriod] = useState<'1m'|'3m'|'6m'|'1a'>('3m')
  const [demandGen,    setDemandGen]    = useState<'all'|'G3'|'R2'>('all')

  const fetchAll = (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    Promise.allSettled([
      api.get(endpoints.lotsStats),
      api.get(endpoints.lots),
      api.get(endpoints.varieties),
      api.get(endpoints.stocksAgrege),
      api.get(endpoints.orders),
    ]).then(([statsRes, lotsRes, varRes, agregeRes, ordersRes]) => {
      if (statsRes.status === 'fulfilled') {
        setGenStats((statsRes.value.data ?? []).map((d: any) => ({
          gen:     d.codeGeneration ?? d.generation ?? String(d[0] ?? ''),
          count:   Number(d.nbLots  ?? d[1] ?? 0),
          totalKg: Number(d.totalKg ?? d[2] ?? 0),
        })))
      }
      if (lotsRes.status === 'fulfilled')   setLots(extractList(lotsRes.value.data).map(normalizeLot))
      if (varRes.status === 'fulfilled')    setVarieties(extractList(varRes.value.data).map(normalizeVariete))
      if (agregeRes.status === 'fulfilled') setRawAgrege(extractList(agregeRes.value.data))
      if (ordersRes.status === 'fulfilled') setRawOrders(extractList(ordersRes.value.data))
      setLastFetch(new Date())
    }).finally(() => {
      setLoading(false)
      setRefreshing(false)
      setTimeout(() => setReady(true), 60)
    })
  }

  useEffect(() => { fetchAll() }, [])

  /* ── Métriques lots ── */
  const totalLots  = genStats.reduce((s, g) => s + g.count, 0)
  const totalKg    = genStats.reduce((s, g) => s + g.totalKg, 0)
  const certifies  = lots.filter(l => l.statutCertification === 'CERTIFIE').length
  const enAttente  = lots.filter(l => l.statutCertification === 'EN_ATTENTE').length
  const rejetes    = lots.filter(l => l.statutCertification === 'REJETE').length
  const sansCertif = lots.filter(l => !l.statutCertification || l.statutCertification === 'SANS_CERTIFICAT').length
  const confirmes  = lots.filter(l => l.statutEdition === 'CONFIRME').length
  const brouillons = lots.filter(l => l.statutEdition !== 'CONFIRME').length

  const orderedStats = GEN_ORDER.map(g =>
    genStats.find(s => s.gen === g) ?? { gen: g, count: 0, totalKg: 0 }
  )
  const maxGenCount = Math.max(...orderedStats.map(s => s.count), 1)
  const generationActive = orderedStats.reduce(
    (a, g) => g.count > (orderedStats.find(x => x.gen === a)?.count ?? 0) ? g.gen : a, 'G0'
  )
  const pipelineGaps = orderedStats.filter((s, i) =>
    s.count === 0 && i > 0 && i < orderedStats.length - 1 &&
    (orderedStats[i - 1].count > 0 || orderedStats[i + 1].count > 0)
  )

  /* ── Stock computation ── */
  const varietyMap: Record<number, any> = Object.fromEntries(varieties.map((v: any) => [v.id, v]))

  const stockRowMap: Record<string, StockRow> = {}
  rawAgrege.forEach((s: any) => {
    const gen = s.codeGeneration ?? '?'
    if (!allowedStockGens.includes(gen)) return
    const codeVariete = s.codeVariete ?? '?'
    if (codeVariete === '?') return
    const key = `${codeVariete}|${gen}`
    if (!stockRowMap[key]) stockRowMap[key] = {
      codeEspece: s.codeEspece ?? '?', nomEspece: s.nomEspece ?? s.codeEspece ?? '?',
      codeVariete, nomVariete: s.nomVariete ?? codeVariete,
      generation: gen, stockKg: 0, nbLots: 0, demandKg: 0,
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
  varieties.forEach((v: any) => {
    const code = v.espece?.codeEspece; const nom = v.espece?.nomEspece
    if (code && code !== '?') especeMap[code] = nom ?? code
  })
  rawAgrege.forEach((s: any) => {
    if (s.codeEspece && s.codeEspece !== '?') especeMap[s.codeEspece] = s.nomEspece ?? s.codeEspece
  })
  const especeOptions = Object.keys(especeMap).sort()

  const filteredStockRows = stockRows.filter(r =>
    (!filterEspece  || r.codeEspece === filterEspece) &&
    filterGens.includes(r.generation) &&
    (!filterVariete || r.codeVariete.toLowerCase().includes(filterVariete.toLowerCase())
                    || r.nomVariete.toLowerCase().includes(filterVariete.toLowerCase()))
  )

  const stockTotalAll      = stockRows.reduce((s, r) => s + r.stockKg, 0)
  const stockTotalFiltered = filteredStockRows.reduce((s, r) => s + r.stockKg, 0)
  const hasStockFilter     = !!(filterEspece || filterVariete || filterGens.length < allowedStockGens.length)

  /* ── Demand computation ── */
  const DEMAND_DAYS: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '1a': 365 }
  const demandCutoff = Date.now() - (DEMAND_DAYS[demandPeriod] ?? 90) * 86_400_000

  type DemandEntry = { nomVariete: string; codeEspece: string; g3kg: number; r2kg: number; g3Orders: Set<number>; r2Orders: Set<number> }
  const demandMap: Record<string, DemandEntry> = {}

  rawOrders.forEach((o: any) => {
    if (['ANNULEE', 'REJETEE'].includes(o.statut ?? '')) return
    if (!o.createdAt || new Date(o.createdAt).getTime() < demandCutoff) return
    ;(o.lignes ?? []).forEach((ligne: any) => {
      const gen = ligne.generation?.codeGeneration ?? '?'
      const isG3 = gen === 'G3'
      const isR2 = ['R1', 'R2'].includes(gen)
      if (!isG3 && !isR2) return
      const variety = varietyMap[ligne.idVariete ?? -1] ?? {}
      if (!variety.codeVariete) return
      const qty = parseFloat(ligne.quantiteDemandee ?? 0) || 0
      const key = variety.codeVariete
      if (!demandMap[key]) demandMap[key] = {
        nomVariete: variety.nomVariete ?? key,
        codeEspece: variety.espece?.codeEspece ?? '?',
        g3kg: 0, r2kg: 0, g3Orders: new Set(), r2Orders: new Set(),
      }
      if (isG3) { demandMap[key].g3kg += qty; demandMap[key].g3Orders.add(o.id ?? 0) }
      else      { demandMap[key].r2kg += qty; demandMap[key].r2Orders.add(o.id ?? 0) }
    })
  })

  const stockG3ByVariete: Record<string, number> = {}
  rawAgrege.forEach((s: any) => {
    if (s.codeGeneration !== 'G3') return
    const cv = s.codeVariete ?? ''
    if (cv) stockG3ByVariete[cv] = (stockG3ByVariete[cv] ?? 0) + (parseFloat(s.quantiteTotale) || 0)
  })

  const demandEntries = Object.entries(demandMap)
    .map(([code, d]) => ({
      code, nomVariete: d.nomVariete, codeEspece: d.codeEspece,
      g3kg: d.g3kg, r2kg: d.r2kg,
      total: d.g3kg + d.r2kg,
      g3OrderCount: d.g3Orders.size, r2OrderCount: d.r2Orders.size,
      stockG3: stockG3ByVariete[code] ?? 0,
    }))
    .filter(d => demandGen === 'G3' ? d.g3kg > 0 : demandGen === 'R2' ? d.r2kg > 0 : d.total > 0)
    .sort((a, b) => demandGen === 'G3' ? b.g3kg - a.g3kg : demandGen === 'R2' ? b.r2kg - a.r2kg : b.total - a.total)
    .slice(0, 10)

  function demandActiveKg(d: typeof demandEntries[0]) {
    if (demandGen === 'G3') return d.g3kg
    if (demandGen === 'R2') return d.r2kg
    return d.total
  }

  const demandMax     = Math.max(...demandEntries.map(demandActiveKg), 1)
  const demandTotalKg = demandEntries.reduce((s, d) => s + demandActiveKg(d), 0)
  const demandG3Total = demandEntries.reduce((s, d) => s + d.g3kg, 0)
  const demandR2Total = demandEntries.reduce((s, d) => s + d.r2kg, 0)

  /* ── Top variétés / Alertes ── */
  const varMap = Object.fromEntries(varieties.map((v: any) => [v.id, v]))
  const countByVar: Record<number, { nom: string; espece: string; count: number }> = {}
  lots.forEach(l => {
    if (!l.idVariete) return
    const v = varMap[l.idVariete]
    if (!countByVar[l.idVariete])
      countByVar[l.idVariete] = { nom: v?.nomVariete ?? `#${l.idVariete}`, espece: v?.espece?.codeEspece ?? l.codeEspece ?? '—', count: 0 }
    countByVar[l.idVariete].count++
  })
  const topVarietes = Object.values(countByVar).sort((a, b) => b.count - a.count).slice(0, 6)

  const alerts: { level: 'critical' | 'warning' | 'info'; message: string }[] = []
  if (pipelineGaps.length > 0)
    alerts.push({ level: 'critical', message: `Rupture de pipeline — ${pipelineGaps.map(g => g.gen).join(', ')} sans lots actifs cette campagne` })
  if (enAttente > 0)
    alerts.push({ level: 'warning', message: `${enAttente} lot${enAttente > 1 ? 's' : ''} en attente de certification — action UPSemCL requise` })
  if (rejetes > 0)
    alerts.push({ level: 'warning', message: `${rejetes} lot${rejetes > 1 ? 's' : ''} rejeté${rejetes > 1 ? 's' : ''} à la certification` })
  if (brouillons > 0 && totalLots > 0)
    alerts.push({ level: 'info', message: `${brouillons} lot${brouillons > 1 ? 's' : ''} en brouillon — non verrouillé${brouillons > 1 ? 's' : ''}` })

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1)

  const kpiItems = [
    { label: 'Lots enregistrés',  value: totalLots,  sub: 'toutes générations', accent: D.blue,    delay: 0,   suffix: undefined },
    { label: 'Production totale', value: Math.round(totalKg / 1000), sub: `${lots.length} lots total`, accent: D.green, delay: 80, suffix: 't' },
    { label: 'Lots certifiés',    value: certifies,  sub: enAttente > 0 ? `${enAttente} en attente` : 'aucune attente', accent: '#0f766e', delay: 160, suffix: undefined },
    { label: 'Lots verrouillés',  value: confirmes,  sub: brouillons > 0 ? `${brouillons} en brouillon` : 'tous verrouillés', accent: '#0369a1', delay: 240, suffix: undefined },
    { label: 'En attente certif.',value: enAttente,  sub: enAttente > 0 ? 'action requise' : 'aucune alerte', accent: '#d97706', delay: 320, suffix: undefined },
    { label: 'Génération active', value: orderedStats.find(s => s.gen === generationActive)?.count ?? 0,
      sub: totalLots > 0 ? generationActive + ' — ' + GEN_LABELS[generationActive] : 'aucun lot',
      accent: GEN_CFG[generationActive]?.color ?? D.muted, delay: 400, suffix: undefined },
  ]

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: 320, color: D.muted }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${D.line}`, borderTopColor: D.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontFamily: D.body, fontSize: 13 }}>Chargement du tableau de bord…</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 4 }}>
        <div>
          <h1 style={{ fontFamily: D.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', color: D.ink, lineHeight: 1.1, marginBottom: 5 }}>
            Vue décisionnelle CNRA
          </h1>
          <p style={{ fontFamily: D.body, fontSize: 12.5, color: D.muted }}>
            {todayCap}
            {lastFetch && (
              <span style={{ marginLeft: 10, opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} /> actualisé {timeAgo(lastFetch)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)} disabled={refreshing}
          style={{ background: '#fff', border: `1px solid ${D.line}`, color: D.muted, fontFamily: D.body, fontSize: 12, fontWeight: 500, borderRadius: 8, padding: '7px 14px', cursor: refreshing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: refreshing ? 0.6 : 1 }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* ── Alertes ── */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => <AlertBanner key={i} level={a.level} message={a.message} />)}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiItems.length}, 1fr)`, gap: 14 }}>
        {kpiItems.map((item, i) => (
          <KpiCard key={i} index={i} label={item.label} value={item.value}
            sub={item.sub} accent={item.accent} delay={item.delay} suffix={item.suffix}
            ready={ready}
          />
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          STOCK DISPONIBLE — G0 → R2
      ══════════════════════════════════════════════════════ */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        boxShadow: `0 6px 36px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)`,
      }}>
        {/* En-tête */}
        <div style={{
          background: `linear-gradient(135deg, ${ACCENT}0d 0%, transparent 65%)`,
          borderBottom: `1px solid ${ACCENT}20`,
          padding: '18px 24px 16px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${ACCENT}22, ${ACCENT}0c)`, border: `1px solid ${ACCENT}2e`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, boxShadow: `0 2px 8px ${ACCENT}18` }}>
            <Database size={16} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>Stock disponible</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Espèces &amp; Variétés · Scope <span style={{ fontWeight: 600, color: ACCENT }}>{allowedStockGens.join(' · ')}</span> · graphique en t · tableau en kg
            </div>
          </div>
          {!loading && (
            <span style={{ fontSize: 11.5, fontWeight: 700, background: `${ACCENT}12`, color: ACCENT, border: `1px solid ${ACCENT}2a`, borderRadius: 99, padding: '3px 12px', whiteSpace: 'nowrap' as const }}>
              {hasStockFilter ? `${filteredStockRows.length} / ${stockRows.length}` : stockRows.length} entrées
            </span>
          )}

          {/* Filtres */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
            {/* Recherche variété */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, minWidth: 192, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px' }}
              onFocusCapture={(e: any) => (e.currentTarget.style.borderColor = ACCENT)}
              onBlurCapture={(e: any) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <Search size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input type="text" placeholder="Rechercher variété…" value={filterVariete}
                onChange={e => setFilterVariete(e.target.value)}
                style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', width: '100%' }}
              />
              {filterVariete && (
                <button onClick={() => setFilterVariete('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', flexShrink: 0 }}>
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Filtre espèce */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, background: filterEspece ? `${ACCENT}0e` : 'var(--surface-2)', border: `1px solid ${filterEspece ? ACCENT + '40' : 'var(--border)'}`, borderRadius: 8, padding: '0 10px' }}>
              <Filter size={11} color={filterEspece ? ACCENT : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
              <select value={filterEspece} onChange={e => setFilterEspece(e.target.value)}
                style={{ border: 'none', background: 'none', fontSize: 12, color: filterEspece ? ACCENT : 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontWeight: filterEspece ? 600 : 400 }}>
                <option value="">Toutes espèces ({especeOptions.length})</option>
                {especeOptions.map(esp => (
                  <option key={esp} value={esp}>{esp}{especeMap[esp] && especeMap[esp] !== esp ? ` — ${especeMap[esp]}` : ''}</option>
                ))}
              </select>
              {filterEspece && (
                <button onClick={() => setFilterEspece('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, padding: 0, display: 'flex', flexShrink: 0 }}>
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Chips générations */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 8px' }}>
              <Filter size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              {allowedStockGens.map(g => {
                const active = filterGens.includes(g)
                const col = GEN_COLOR[g] ?? ACCENT
                return (
                  <button key={g} title={GEN_LABEL[g] ?? g}
                    onClick={() => setFilterGens(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                    style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 7px', background: active ? col + '22' : 'transparent', color: active ? col : 'var(--text-muted)', border: `1px solid ${active ? col + '55' : 'transparent'}`, cursor: 'pointer' }}>
                    {g}
                  </button>
                )
              })}
              {filterGens.length < allowedStockGens.length && (
                <button onClick={() => setFilterGens(allowedStockGens)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, padding: 0, display: 'flex', flexShrink: 0 }}>
                  <X size={11} />
                </button>
              )}
            </div>

            {hasStockFilter && (
              <button onClick={() => { setFilterEspece(''); setFilterVariete(''); setFilterGens(allowedStockGens) }}
                style={{ fontSize: 11.5, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, height: 32 }}>
                <X size={11} /> Effacer
              </button>
            )}

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

            <button onClick={() => setStockCollapsed(c => !c)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: stockCollapsed ? `${ACCENT}12` : 'var(--surface-2)', color: stockCollapsed ? ACCENT : 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
              {stockCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {!stockCollapsed && (<>
          {/* KPI bar */}
          <div style={{ padding: '9px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(90deg, var(--surface-2) 0%, var(--surface-3) 100%)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse-dot 2s ease infinite', boxShadow: '0 0 5px #16a34a60' }} />
              Données en temps réel
            </div>
            {!loading && (
              <>
                <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 700, color: ACCENT, fontFamily: 'var(--font-mono)' }}>{fmtT(hasStockFilter ? stockTotalFiltered : stockTotalAll)}</span>
                  <span style={{ marginLeft: 3 }}>{hasStockFilter ? 'filtrés' : 'au total'}</span>
                </span>
                <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{stockRows.length}</span>
                  <span style={{ marginLeft: 3 }}>variétés × génération</span>
                </span>
              </>
            )}
          </div>

          {/* Graphique */}
          {loading ? (
            <div style={{ padding: '20px 24px' }}>
              <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
            </div>
          ) : filteredStockRows.length > 0 ? (
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Stock par variété · génération</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>— {filteredStockRows.length} entrées affichées (t)</span>
              </div>
              <GroupedHBarChart rows={filteredStockRows} accent={ACCENT} />
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {[...new Set(filteredStockRows.map(r => r.generation))].map(gen => (
                  <span key={gen} style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 11px', background: `${GEN_COLOR[gen]}14`, color: GEN_COLOR[gen], border: `1px solid ${GEN_COLOR[gen]}32`, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: GEN_COLOR[gen], display: 'inline-block' }} />
                    {gen} — {GEN_LABEL[gen] ?? gen}
                  </span>
                ))}
              </div>
            </div>
          ) : stockRows.length > 0 ? (
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' as const }}>
              Aucune variété ne correspond aux filtres actifs — modifiez les critères.
            </div>
          ) : null}

          {/* Tableau */}
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
                ]).map(({ col, label }) => (
                  <th key={col} onClick={() => thSort(col)}
                    style={{ padding: '10px 22px', fontSize: 10, fontWeight: 700, color: stockSortCol === col ? ACCENT : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', textAlign: 'left', borderBottom: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' as const }}>
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
                    <div style={{ padding: '52px 20px', textAlign: 'center' as const }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--text-muted)' }}>
                        <Database size={20} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {hasStockFilter ? 'Aucun résultat' : 'Aucun stock disponible'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 5 }}>
                        {hasStockFilter ? 'Modifiez ou effacez les filtres' : 'Les entrées apparaîtront dès qu\'elles seront enregistrées'}
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
                  const isLast = i === Math.min(filteredStockRows.length, 100) - 1
                  return (
                    <tr key={`${r.codeVariete}|${r.generation}`}
                      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', background: isCrit ? '#fef2f210' : isLow ? '#fffbeb10' : 'transparent', transition: 'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = isCrit ? '#fef2f230' : isLow ? '#fffbeb30' : 'var(--surface-2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = isCrit ? '#fef2f210' : isLow ? '#fffbeb10' : 'transparent' }}
                    >
                      <td style={{ padding: '12px 22px', borderLeft: `3px solid ${genClr}` }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{r.codeEspece}</span>
                        {r.nomEspece !== r.codeEspece && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 6 }}>{r.nomEspece}</span>}
                      </td>
                      <td style={{ padding: '12px 22px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.nomVariete}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{r.codeVariete}</div>
                      </td>
                      <td style={{ padding: '12px 22px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '4px 10px', background: genBg, color: genClr, border: `1px solid ${genClr}32`, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {r.generation}
                          <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>{GEN_LABEL[r.generation] ?? ''}</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px 22px', minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em', color: isCrit ? '#dc2626' : isLow ? '#92660a' : 'var(--text-primary)' }}>
                            {fmtKgTable(r.stockKg)}
                          </span>
                          {(isCrit || isLow) && (
                            <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 7px', background: isCrit ? '#fef2f2' : '#fffbeb', color: isCrit ? '#dc2626' : '#92660a', border: `1px solid ${isCrit ? '#fecaca' : '#fde68a'}` }}>
                              {isCrit ? '⚠ Critique' : '⚠ Bas'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 22px', textAlign: 'center' as const }}>
                        <span style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: r.nbLots > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {r.nbLots}
                        </span>
                      </td>
                      <td style={{ padding: '12px 22px' }}>
                        {r.demandKg > 0 ? (
                          <span style={{ fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', color: r.demandKg > r.stockKg ? '#dc2626' : 'var(--text-secondary)' }}>
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
            <div style={{ textAlign: 'center' as const, padding: '12px 0', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              100 / {filteredStockRows.length} lignes affichées
            </div>
          )}
        </>)}
      </div>

      {/* ── Pipeline G0 → R2 ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${D.line}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${D.line}`, display: 'flex', alignItems: 'center', gap: 12, background: D.paper2 }}>
          <span style={{ fontFamily: D.mono, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: D.green, background: D.greenSoft, padding: '3px 10px', borderRadius: 999 }}>Pipeline</span>
          <span style={{ fontFamily: D.display, fontSize: 15, fontWeight: 600, color: D.ink }}>Production semencière · G0 → R2</span>
          <span style={{ marginLeft: 'auto', fontFamily: D.mono, fontSize: 10, fontWeight: 500, color: D.muted, background: D.paper2, border: `1px solid ${D.line}`, borderRadius: 999, padding: '3px 12px' }}>
            {totalLots.toLocaleString('fr-FR')} lots · {kgLabel(totalKg)}
          </span>
        </div>
        <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center' }}>
          {orderedStats.map((stat, idx, arr) => {
            const cfg    = GEN_CFG[stat.gen] ?? { bg: D.paper2, color: D.muted }
            const active = stat.count > 0
            const pct    = Math.round((stat.count / maxGenCount) * 100)
            return (
              <div key={stat.gen} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: active ? cfg.bg : D.paper2, border: `2px solid ${active ? cfg.color : D.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: D.mono, fontSize: 11, fontWeight: 700, color: active ? cfg.color : D.muted, boxShadow: active ? `0 2px 10px ${cfg.color}28` : 'none', transition: 'all 0.3s ease' }}>
                    {stat.gen}
                  </div>
                  <div style={{ textAlign: 'center', lineHeight: 1 }}>
                    <AnimatedNum value={stat.count} ready={ready} delay={idx * 60} style={{ fontFamily: D.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: active ? cfg.color : D.muted, transition: 'color 0.3s' }} />
                    <div style={{ fontFamily: D.mono, fontSize: 9, color: D.muted, marginTop: 2 }}>lot{stat.count !== 1 ? 's' : ''}</div>
                    {stat.totalKg > 0 && (
                      <div style={{ fontFamily: D.mono, fontSize: 9, color: active ? cfg.color : D.muted, marginTop: 3, fontWeight: 600 }}>{fmtT(stat.totalKg)}</div>
                    )}
                  </div>
                  <div style={{ width: '70%', height: 3, background: D.line, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: ready ? `${pct}%` : '0%', background: cfg.color, borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                  <div style={{ fontFamily: D.body, fontSize: 9, color: active ? cfg.color : D.muted, textAlign: 'center', fontWeight: active ? 600 : 400, lineHeight: 1.3, maxWidth: 64 }}>
                    {GEN_LABELS[stat.gen]}
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div style={{ color: D.line, opacity: active ? 1 : 0.4, flexShrink: 0, paddingBottom: 28 }}>
                    <ArrowRight size={12} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ANALYSE DE LA DEMANDE · toute la filière
      ══════════════════════════════════════════════════════ */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${D.line}`, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {/* En-tête avec filtres */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${D.line}`, background: 'linear-gradient(135deg,var(--surface-2) 0%,#fff 100%)', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${ACCENT}12`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Analyse de la demande · toute la filière</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              Consolidation nationale — G3 distribués par l'UPSemCL · R2 par les multiplicateurs
              {demandEntries.length > 0 && <span style={{ marginLeft: 6 }}>· <strong>{fmtT(demandTotalKg)}</strong> total</span>}
            </div>
          </div>

          {/* Filtre période */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
            {(['1m','3m','6m','1a'] as const).map(p => (
              <button key={p} onClick={() => setDemandPeriod(p)} style={{ padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: demandPeriod === p ? 700 : 400, background: demandPeriod === p ? '#fff' : 'transparent', color: demandPeriod === p ? ACCENT : 'var(--text-muted)', boxShadow: demandPeriod === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                {p === '1m' ? '1 mois' : p === '3m' ? '3 mois' : p === '6m' ? '6 mois' : '1 an'}
              </button>
            ))}
          </div>

          {/* Export */}
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
            >
              <Download size={11} /> Export .xls
            </button>
          )}

          {/* Filtre génération */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
            {([['all','Vue complète',ACCENT],['G3','G3 → Mult.',GEN_COLOR.G3],['R2','R2 → Quot.',GEN_COLOR.R2]] as [string,string,string][]).map(([v, label, clr]) => (
              <button key={v} onClick={() => setDemandGen(v as 'all'|'G3'|'R2')} style={{ padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: demandGen === v ? 700 : 400, background: demandGen === v ? '#fff' : 'transparent', color: demandGen === v ? clr : 'var(--text-muted)', boxShadow: demandGen === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding: '18px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 18, borderRadius: 6, width: `${82 - i * 10}%` }} />)}
            </div>
          ) : demandEntries.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '28px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Aucune commande enregistrée sur cette période</div>
              <div style={{ fontSize: 11.5, marginTop: 4 }}>Élargissez la fenêtre temporelle ou vérifiez que les commandes ont été saisies par les multiplicateurs et quotataires</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {demandEntries.map((d, i) => {
                  const activeQty = demandGen === 'G3' ? d.g3kg : demandGen === 'R2' ? d.r2kg : d.total
                  const g3pct    = demandMax > 0 ? (d.g3kg / demandMax) * 100 : 0
                  const r2pct    = demandMax > 0 ? (d.r2kg / demandMax) * 100 : 0
                  const activePct = demandMax > 0 ? (activeQty / demandMax) * 100 : 0
                  const sharePct  = demandTotalKg > 0 ? Math.round((activeQty / demandTotalKg) * 100) : 0
                  const showSeg   = demandGen === 'all'
                  const covRatio  = d.g3kg > 0 ? d.stockG3 / d.g3kg : null
                  const covColor  = covRatio === null ? 'var(--text-muted)' : covRatio >= 1 ? '#16a34a' : covRatio >= 0.5 ? '#d97706' : '#dc2626'
                  const covLabel  = covRatio === null ? '' : covRatio >= 1 ? 'Couvert' : covRatio >= 0.5 ? 'Partiel' : 'Critique'
                  const covBg     = covRatio === null ? '' : covRatio >= 1 ? '#f0fdf4' : covRatio >= 0.5 ? '#fffbeb' : '#fef2f2'
                  const cmdCount  = demandGen === 'R2' ? d.r2OrderCount : d.g3OrderCount
                  return (
                    <div key={d.code} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 120px', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0, minWidth: 14, textAlign: 'right' as const }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{d.nomVariete}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{d.codeEspece}</span>
                          </div>
                          {d.g3kg > 0 && demandGen !== 'R2' && covLabel && (
                            <span style={{ display: 'inline-block', marginTop: 2, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: covBg, color: covColor, border: `1px solid ${covColor}30` }}>
                              ● {covLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ position: 'relative', height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                        {showSeg ? (
                          <>
                            {g3pct > 0 && <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${g3pct}%`, background: GEN_COLOR.G3, borderRadius: 99, transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }} />}
                            {r2pct > 0 && <div style={{ position: 'absolute', left: `${g3pct}%`, top: 0, height: '100%', width: `${r2pct}%`, background: GEN_COLOR.R2, opacity: 0.85, transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }} />}
                          </>
                        ) : (
                          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${activePct}%`, background: demandGen === 'R2' ? GEN_COLOR.R2 : GEN_COLOR.G3, borderRadius: 99, transition: 'width 0.65s cubic-bezier(0.4,0,0.2,1)' }} />
                        )}
                      </div>
                      <div style={{ textAlign: 'right' as const, lineHeight: 1.3 }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtT(activeQty)}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{sharePct}%</span>
                        </div>
                        {cmdCount > 0 && (
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{cmdCount} commande{cmdCount > 1 ? 's' : ''}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Légende */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--surface-2)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const, fontSize: 11 }}>
                {demandGen === 'all' ? (
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

      {/* ── Certifications + Politique d'édition ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Section title="Certifications" sub="Répartition par statut" icon={<ShieldCheck size={14} />}>
          {lots.length === 0 ? <EmptyState message="Aucun lot enregistré" /> : <>
            <ProgressRow label="CERTIFIÉ"     count={certifies}  total={lots.length} color="#16a34a" ready={ready} />
            <ProgressRow label="EN ATTENTE"   count={enAttente}  total={lots.length} color="#d97706" ready={ready} />
            <ProgressRow label="REJETÉ"       count={rejetes}    total={lots.length} color="#dc2626" ready={ready} />
            <ProgressRow label="SANS CERTIF." count={sansCertif} total={lots.length} color="#9ca3af" ready={ready} />
          </>}
        </Section>
        <Section title="Politique d'édition" sub="Verrouillage des lots" icon={<Lock size={14} />}>
          {lots.length === 0 ? <EmptyState message="Aucun lot enregistré" /> : <>
            <ProgressRow label="CONFIRMÉS"  count={confirmes}  total={lots.length} color={D.blue}   ready={ready} />
            <ProgressRow label="BROUILLONS" count={brouillons} total={lots.length} color="#9333ea" ready={ready} />
            <div style={{ marginTop: 14, padding: '10px 12px', background: D.paper2, borderRadius: 7, fontSize: 11.5, color: D.muted, lineHeight: 1.6, borderLeft: `3px solid ${D.line}`, fontFamily: D.body }}>
              <strong style={{ color: D.ink }}>BROUILLON</strong> — modifiable · auto-lock à 30 j<br />
              <strong style={{ color: D.ink }}>CONFIRMÉ</strong> — verrouillé, données définitives
            </div>
          </>}
        </Section>
      </div>

      {/* ── Top variétés + Matrice ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Section title="Variétés en production" sub="Top 6 par nombre de lots" icon={<BarChart3 size={14} />}>
          {topVarietes.length === 0 ? <EmptyState message="Aucune donnée de variété" /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topVarietes.map((v, idx) => (
                <VarieteRow key={idx} rank={idx + 1} name={v.nom} espece={v.espece} count={v.count} max={topVarietes[0].count} ready={ready} />
              ))}
            </div>
          )}
        </Section>
        <Section title="Répartition espèces × génération" sub="Nombre de lots par espèce" icon={<Layers size={14} />}>
          <EspecesTable lots={lots} varieties={varieties} />
        </Section>
      </div>

      {/* ── Carte agro-écologique nationale ── */}
      <Section title="Répartition géographique nationale" sub="Zones agro-écologiques · sites ISRA · acteurs de la filière" icon={<Map size={14} />}>
        <MapSemences roleKey="seed-directeur" />
      </Section>

      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.7)} }
      `}</style>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   Sous-composants
════════════════════════════════════════════════════════════════ */

function AnimatedNum({ value, ready, delay, style }: { value: number; ready: boolean; delay: number; style: React.CSSProperties }) {
  const displayed = useCountUp(value, delay, ready)
  return <div style={style}>{displayed.toLocaleString('fr-FR')}</div>
}

function KpiCard({ index, label, value, sub, accent, delay, suffix, ready }: {
  index: number; label: string; value: number
  sub?: string; accent: string; delay: number; suffix?: string; ready: boolean
}) {
  const [vis, setVis] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVis(true), delay + 60); return () => clearTimeout(t) }, [delay])
  const displayed = useCountUp(value, delay + 80, vis && ready)
  return (
    <div className="kpi-card-outer">
      <div className="kpi-card-dot" />
      <div className="kpi-card-inner" style={{ background: '#fff', borderRadius: 12, border: `1px solid ${D.line}`, padding: '18px 22px 20px', opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(18px)', transition: 'opacity 0.44s ease, transform 0.44s ease' }}>
        <div style={{ fontFamily: D.mono, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: D.muted, marginBottom: 12 }}>{label}</div>
        <div style={{ lineHeight: 1, marginBottom: sub ? 10 : 0 }}>
          <span style={{ fontFamily: D.display, fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: D.ink, fontVariantNumeric: 'tabular-nums' }}>
            {displayed.toLocaleString('fr-FR')}
          </span>
          {suffix && <span style={{ fontFamily: D.mono, fontSize: 13, fontWeight: 500, color: D.muted, marginLeft: 5 }}>{suffix}</span>}
        </div>
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

function AlertBanner({ level, message }: { level: 'critical' | 'warning' | 'info'; message: string }) {
  const cfg = {
    critical: { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', icon: <AlertCircle size={13} /> },
    warning:  { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', icon: <AlertTriangle size={13} /> },
    info:     { bg: '#eff6ff', border: '#93c5fd', color: '#1e40af', icon: <Info size={13} /> },
  }[level]
  const levelLabel = { critical: 'Critique', warning: 'Attention', info: 'Info' }[level]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
      <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4, fontFamily: D.body }}>
        <strong style={{ fontWeight: 700 }}>{levelLabel} — </strong>{message}
      </span>
    </div>
  )
}

function Section({ title, sub, icon, children }: { title: string; sub: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${D.line}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '13px 20px', borderBottom: `1px solid ${D.line}`, background: D.paper2, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ color: D.green }}>{icon}</span>}
        <div>
          <div style={{ fontFamily: D.display, fontSize: 13.5, fontWeight: 600, color: D.ink }}>{title}</div>
          <div style={{ fontFamily: D.body, fontSize: 11, color: D.muted, marginTop: 1 }}>{sub}</div>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

function ProgressRow({ label, count, total, color, ready }: { label: string; count: number; total: number; color: string; ready: boolean }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  const displayed = useCountUp(count, 0, ready)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
      <div style={{ width: 90, fontSize: 10, fontWeight: 700, color, flexShrink: 0, fontFamily: D.mono, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: D.line, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: ready ? `${pct}%` : '0%', background: color, borderRadius: 3, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      <div style={{ width: 66, textAlign: 'right', fontSize: 12, fontWeight: 700, color: D.ink, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {displayed} <span style={{ fontWeight: 400, color: D.muted, fontSize: 10 }}>({pct.toFixed(0)}%)</span>
      </div>
    </div>
  )
}

function VarieteRow({ rank, name, espece, count, max, ready }: { rank: number; name: string; espece: string; count: number; max: number; ready: boolean }) {
  const rankColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : rank === 3 ? '#b45309' : D.muted
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: 5, background: D.paper2, border: `1px solid ${D.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: rankColor, flexShrink: 0 }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 12.5, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: D.body }}>{name}</span>
            <span style={{ fontSize: 10, color: D.muted, flexShrink: 0, background: D.paper2, padding: '1px 5px', borderRadius: 4, border: `1px solid ${D.line}`, fontFamily: D.mono }}>{espece}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: D.green, flexShrink: 0, fontVariantNumeric: 'tabular-nums', fontFamily: D.mono }}>{count} lot{count !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ height: 4, borderRadius: 3, background: D.line, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: ready ? `${(count / max) * 100}%` : '0%', background: D.green, borderRadius: 3, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: D.muted }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: D.paper2, border: `1px solid ${D.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Package size={16} style={{ opacity: 0.4 }} />
      </div>
      <span style={{ fontSize: 12.5, fontFamily: D.body }}>{message}</span>
    </div>
  )
}

function EspecesTable({ lots, varieties }: { lots: any[]; varieties: any[] }) {
  const varMap = Object.fromEntries(varieties.map((v: any) => [v.id, v]))
  const matrix: Record<string, Record<string, number>> = {}
  const gens = new Set<string>()
  lots.forEach(l => {
    const gen = l.generation?.codeGeneration ?? '?'
    const esp = varMap[l.idVariete]?.espece?.nomEspece ?? varMap[l.idVariete]?.espece?.codeEspece ?? l.codeEspece ?? '—'
    if (!matrix[esp]) matrix[esp] = {}
    matrix[esp][gen] = (matrix[esp][gen] ?? 0) + 1
    gens.add(gen)
  })
  const especes = Object.keys(matrix).sort()
  const genList = GEN_ORDER.filter(g => gens.has(g))
  if (especes.length === 0) return <EmptyState message="Aucune donnée disponible" />
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontFamily: D.body }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px 6px 0', color: D.muted, fontWeight: 600, fontSize: 10.5, borderBottom: `2px solid ${D.line}`, whiteSpace: 'nowrap' }}>Espèce</th>
            {genList.map(g => (
              <th key={g} style={{ textAlign: 'center', padding: '6px 8px', color: GEN_CFG[g]?.color ?? D.muted, fontWeight: 800, fontSize: 10.5, borderBottom: `2px solid ${D.line}`, whiteSpace: 'nowrap', fontFamily: D.mono }}>{g}</th>
            ))}
            <th style={{ textAlign: 'center', padding: '6px 8px', color: D.muted, fontWeight: 600, fontSize: 10.5, borderBottom: `2px solid ${D.line}` }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {especes.map(esp => {
            const total = Object.values(matrix[esp]).reduce((s, n) => s + n, 0)
            return (
              <tr key={esp} style={{ borderBottom: `1px solid ${D.line}` }}>
                <td style={{ padding: '8px 8px 8px 0', fontWeight: 600, fontSize: 12, color: D.ink, whiteSpace: 'nowrap' }}>{esp}</td>
                {genList.map(g => (
                  <td key={g} style={{ textAlign: 'center', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>
                    {matrix[esp][g]
                      ? <span style={{ fontWeight: 700, color: GEN_CFG[g]?.color, background: GEN_CFG[g]?.bg, padding: '2px 7px', borderRadius: 5, fontSize: 11 }}>{matrix[esp][g]}</span>
                      : <span style={{ color: D.line, fontSize: 11 }}>—</span>}
                  </td>
                ))}
                <td style={{ textAlign: 'center', padding: '8px', fontWeight: 800, fontSize: 13, color: D.ink, fontVariantNumeric: 'tabular-nums' }}>{total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
