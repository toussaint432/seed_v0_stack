import { useEffect, useRef, useState } from 'react'
import { TrendingUp, AlertTriangle, RefreshCw, BarChart2, Activity, Database, GitBranch, Download, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, normalizeVariete, normalizeStock, extractList } from '../../lib/normalizers'
import { fmtT } from '../../lib/fmt'
import { downloadXlsx } from '../../lib/exportUtils'

interface Props {
  userSpecialisation?: string | null
}

interface ChainDemand {
  gen:      string
  username: string
  client:   string
  qtyKg:    number
  statut:   string
  orderId:  number
}

interface ChainVariete {
  codeVariete: string
  nomVariete:  string
  codeEspece:  string
  demands:     ChainDemand[]
}

interface ProdVariete {
  codeVariete: string
  nomVariete:  string
  g0Kg:        number
  g1Kg:        number
  total:       number
  nbLots:      number
}

interface MonthlyPoint {
  month: string
  count: number
  g1Kg: number
  g3Kg: number
  r2Kg: number
}

interface StockAlert {
  codeVariete: string
  nomVariete:  string
  quantite:    number
  unite:       string
  site:        string
  low:         boolean
}

interface SelStockRow {
  codeEspece: string; nomEspece: string; codeVariete: string; nomVariete: string
  generation: string; stockKg: number; nbLots: number; demandKg: number
}
type SelStockSortKey = 'nomEspece' | 'nomVariete' | 'generation' | 'stockKg' | 'nbLots' | 'demandKg'

const GEN_COLOR: Record<string, string> = {
  G0:'#1d4ed8', G1:'#15803d', G2:'#92660a',
  G3:'#6d28d9', G4:'#b91c1c', R1:'#0f766e', R2:'#16a34a',
}
const GEN_LABEL: Record<string, string> = {
  G0:'Génétique', G1:'Pré-base', G2:'Base',
  G3:'Certif. C1', G4:'Certif. C2', R1:'R1', R2:'Commerciale',
}

const REFRESH_INTERVAL = 30_000

/* ── Barres horizontales bicolores G0/G1 ── */
function ProdHBarChart({ data }: { data: ProdVariete[] }) {
  const max = Math.max(...data.map(d => d.total), 1)
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((d, i) => {
        const pctG0 = (d.g0Kg / max) * 100
        const pctG1 = (d.g1Kg / max) * 100
        const isHov = hovered === i
        return (
          <div
            key={d.codeVariete}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              borderRadius: 4, padding: '3px 6px',
              background: isHov ? 'var(--surface-hover, #f1f5f9)' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ width: 88, flexShrink: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={d.nomVariete}>
                {d.nomVariete}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {d.codeVariete}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden',
              background: 'var(--border)', gap: 1 }}>
              {d.g0Kg > 0 && (
                <div style={{ width: `${pctG0}%`, background: '#1d4ed8', borderRadius: '5px 0 0 5px',
                  transition: 'width 0.4s ease', minWidth: 2 }} title={`G0 : ${fmtT(d.g0Kg)}`} />
              )}
              {d.g1Kg > 0 && (
                <div style={{ width: `${pctG1}%`, background: '#15803d',
                  borderRadius: d.g0Kg > 0 ? '0 5px 5px 0' : 5,
                  transition: 'width 0.4s ease', minWidth: 2 }} title={`G1 : ${fmtT(d.g1Kg)}`} />
              )}
            </div>
            <div style={{ width: 72, textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-primary)' }}>
                {fmtT(d.total)}
              </span>
            </div>
            <div style={{ width: 28, textAlign: 'right', flexShrink: 0,
              fontSize: 10.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
              title="Lots actifs">
              {d.nbLots}L
            </div>
          </div>
        )
      })}
      {data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Aucune production G0/G1
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 96 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#1d4ed8' }} />
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>G0 — Génétique</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#15803d' }} />
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>G1 — Pré-base</span>
        </div>
      </div>
    </div>
  )
}

/* ── Graphe mensuel empilé G1/G3/R2 en kg ── */
const STACK_COLORS = { g1: '#0ea5e9', g3: '#f59e0b', r2: '#14b8a6' }
const STACK_LABELS = { g1: 'G1 — UPSemCL', g3: 'G3 — Multiplicateurs', r2: 'R2 — Quotataires' }

function StackedMonthChart({ data, periodLabel }: { data: MonthlyPoint[]; periodLabel: string }) {
  const [hov, setHov] = useState<number | null>(null)
  const totalG1 = data.reduce((s, d) => s + d.g1Kg, 0)
  const totalG3 = data.reduce((s, d) => s + d.g3Kg, 0)
  const totalR2 = data.reduce((s, d) => s + d.r2Kg, 0)
  const totalKg = totalG1 + totalG3 + totalR2
  const totalOrders = data.reduce((s, d) => s + d.count, 0)

  const hasKg = totalKg > 0

  const W = 400; const H = 200; const PT = 24; const PB = 28; const PL = 36; const PR = 10
  const iW = W - PL - PR; const iH = H - PT - PB
  const maxPerBar = Math.max(...data.map(d => d.g1Kg + d.g3Kg + d.r2Kg), 1)
  const TICKS = 3
  const niceMax = maxPerBar <= 0.1 ? 1 : Math.ceil(maxPerBar / Math.pow(10, Math.floor(Math.log10(maxPerBar)))) * Math.pow(10, Math.floor(Math.log10(maxPerBar)))
  const bW = iW / Math.max(data.length, 1)

  function fmt(kg: number) {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
    return `${Math.round(kg)} kg`
  }

  const lastActiveIdx = data.reduce((best, d, i) => (d.g1Kg + d.g3Kg + d.r2Kg) > 0 ? i : best, -1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {hasKg ? fmt(totalKg) : `${totalOrders} commande${totalOrders !== 1 ? 's' : ''}`}
        </span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{periodLabel}</span>
        {hasKg && (
          <>
            {(['g1','g3','r2'] as const).map(k => {
              const kg = k === 'g1' ? totalG1 : k === 'g3' ? totalG3 : totalR2
              if (kg <= 0) return null
              return (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: STACK_COLORS[k], display: 'inline-block' }} />
                  {STACK_LABELS[k]} · <strong style={{ color: STACK_COLORS[k] }}>{fmt(kg)}</strong>
                </span>
              )
            })}
          </>
        )}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        {Array.from({ length: TICKS + 1 }, (_, t) => {
          const y = PT + (t / TICKS) * iH
          const v = niceMax * (1 - t / TICKS)
          const label = v >= 1000 ? `${(v / 1000).toFixed(0)}t` : v > 0 ? `${Math.round(v)}` : '0'
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)"
                strokeWidth={t === TICKS ? 1.5 : 0.6} strokeDasharray={t === TICKS ? '0' : '3,4'} />
              <text x={PL - 4} y={y + 4} textAnchor="end" fontSize={8}
                fill="var(--text-muted)" fontFamily="var(--font-sans)">{label}</text>
            </g>
          )
        })}

        {data.map((d, i) => {
          const total = d.g1Kg + d.g3Kg + d.r2Kg
          const isHov  = hov === i
          const isLast = i === lastActiveIdx
          const x = PL + i * bW + bW * 0.15
          const bw = bW * 0.7

          let yBase = PT + iH
          const segments = [
            { key: 'g1', kg: d.g1Kg, color: STACK_COLORS.g1 },
            { key: 'g3', kg: d.g3Kg, color: STACK_COLORS.g3 },
            { key: 'r2', kg: d.r2Kg, color: STACK_COLORS.r2 },
          ].filter(s => s.kg > 0)

          const bars = segments.map(s => {
            const bh = Math.max((s.kg / niceMax) * iH, 2)
            const y  = yBase - bh
            yBase -= bh
            return { ...s, y, bh }
          })

          const topY = bars.length > 0 ? bars[bars.length - 1].y : PT + iH

          return (
            <g key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} style={{ cursor: 'default' }}>
              {isHov && <rect x={x - 2} y={PT} width={bw + 4} height={iH} rx={3} fill="#0ea5e9" opacity={0.05} />}
              {bars.length === 0 && (
                <rect x={x} y={PT + iH - 2} width={bw} height={2} rx={1} fill="var(--border)" opacity={0.4} />
              )}
              {bars.map((b, j) => (
                <rect key={b.key} x={x} y={b.y} width={bw} height={b.bh}
                  rx={j === bars.length - 1 ? 3 : 0}
                  fill={b.color}
                  opacity={isHov ? 1 : isLast ? 0.9 : 0.75}
                  style={{ transition: 'opacity 0.15s' }} />
              ))}
              {total > 0 && (
                <text x={x + bw / 2} y={topY - 5} textAnchor="middle"
                  fontSize={isHov ? 9.5 : 8.5} fontWeight={700} fill="var(--text-secondary)"
                  fontFamily="var(--font-sans)" style={{ transition: 'font-size 0.1s' }}>
                  {fmt(total)}
                </text>
              )}
              <text x={x + bw / 2} y={H - PB + 12} textAnchor="middle" fontSize={9}
                fontWeight={isHov || isLast ? 700 : 400}
                fill={isHov || isLast ? '#0369a1' : 'var(--text-muted)'}
                fontFamily="var(--font-sans)">
                {d.month}
              </text>
              {isHov && total > 0 && (
                <g>
                  <rect x={x + bw / 2 - 54} y={topY - 58} width={108} height={48} rx={6}
                    fill="var(--text-primary)" opacity={0.92} />
                  <text x={x + bw / 2} y={topY - 44} textAnchor="middle" fontSize={9.5}
                    fontWeight={700} fill="#fff" fontFamily="var(--font-sans)">{d.month}</text>
                  {d.g1Kg > 0 && <text x={x + bw / 2} y={topY - 32} textAnchor="middle" fontSize={8.5}
                    fill={STACK_COLORS.g1} fontFamily="var(--font-sans)">G1: {fmt(d.g1Kg)}</text>}
                  {d.g3Kg > 0 && <text x={x + bw / 2} y={topY - 32 + (d.g1Kg > 0 ? 11 : 0)} textAnchor="middle" fontSize={8.5}
                    fill={STACK_COLORS.g3} fontFamily="var(--font-sans)">G3: {fmt(d.g3Kg)}</text>}
                  {d.r2Kg > 0 && <text x={x + bw / 2} y={topY - 32 + (d.g1Kg > 0 ? 11 : 0) + (d.g3Kg > 0 ? 11 : 0)} textAnchor="middle" fontSize={8.5}
                    fill={STACK_COLORS.r2} fontFamily="var(--font-sans)">R2: {fmt(d.r2Kg)}</text>}
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

type Period = '1m'|'3m'|'6m'|'1a'
type GenKey = 'g1'|'g3'|'r2'
const PERIOD_COUNTS: Record<Period, number> = { '1m': 1, '3m': 3, '6m': 6, '1a': 12 }
const PERIOD_LABELS: Record<Period, string> = { '1m': '1 dernier mois', '3m': '3 derniers mois', '6m': '6 derniers mois', '1a': '12 derniers mois' }

export function SelectorAnalytics({ userSpecialisation }: Props) {
  const [prodByVariete, setProdByVariete] = useState<ProdVariete[]>([])
  const [monthly,    setMonthly]    = useState<MonthlyPoint[]>([])
  const [alerts,     setAlerts]     = useState<StockAlert[]>([])
  const [lots,        setLots]        = useState<any[]>([])
  const [rawStocks,   setRawStocks]   = useState<any[]>([])
  const [rawVarieties,setRawVarieties]= useState<any[]>([])
  const [chainVarietes, setChainVarietes] = useState<ChainVariete[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stkSortCol, setStkSortCol] = useState<SelStockSortKey>('stockKg')
  const [stkSortAsc, setStkSortAsc] = useState(false)
  const [period, setPeriod]         = useState<Period>('6m')
  const [genFilter, setGenFilter]   = useState<Set<GenKey>>(new Set())
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      const [ordersRes, varietiesRes, stocksRes, lotsRes] = await Promise.allSettled([
        api.get(`${endpoints.orders}?size=200`),
        api.get(endpoints.varieties),
        api.get(endpoints.stocks),
        api.get(endpoints.lotsMesLots),
      ])

      const orders    = extractList(ordersRes.status === 'fulfilled' ? ordersRes.value.data : null)
      const varieties = extractList(varietiesRes.status === 'fulfilled' ? varietiesRes.value.data : null).map(normalizeVariete)
      const stocks    = extractList(stocksRes.status    === 'fulfilled' ? stocksRes.value.data    : null).map(normalizeStock)
      const lotsData  = extractList(lotsRes.status      === 'fulfilled' ? lotsRes.value.data      : null).map(normalizeLot)
      setLots(lotsData)
      setRawStocks(stocks)
      setRawVarieties(varieties)

      /* ── Production G0/G1 par variété ── */
      const specFilter = userSpecialisation?.toUpperCase()
      const varMap: Record<number, any> = Object.fromEntries(varieties.map((v: any) => [v.id, v]))
      const prodMap: Record<string, ProdVariete> = {}
      lotsData.forEach((l: any) => {
        const gen = l.generation?.codeGeneration ?? l.codeGeneration ?? ''
        if (gen !== 'G0' && gen !== 'G1') return
        const variety = varMap[l.idVariete ?? l.varieteId ?? -1] ?? l.variete ?? {}
        const cv = variety.codeVariete ?? l.codeVariete
        if (!cv) return
        if (specFilter) {
          const esp = (variety.espece?.codeEspece ?? '').toUpperCase()
          if (esp && esp !== specFilter) return
        }
        const activeStatuts = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT','SOUCHE']
        const statut = (l.statut ?? '').toUpperCase()
        if (!activeStatuts.includes(statut)) return
        if (!prodMap[cv]) prodMap[cv] = {
          codeVariete: cv,
          nomVariete: variety.nomVariete ?? cv,
          g0Kg: 0, g1Kg: 0, total: 0, nbLots: 0,
        }
        const qty = parseFloat(l.quantiteNette) || 0
        if (gen === 'G0') prodMap[cv].g0Kg += qty
        else              prodMap[cv].g1Kg += qty
        prodMap[cv].total += qty
        prodMap[cv].nbLots++
      })
      setProdByVariete(
        Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 8)
      )

      /* ── Évolution mensuelle des commandes (12 derniers mois) ── */
      const now    = new Date()
      const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
      const monthPoints: any[] = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
        return { month: MONTHS[d.getMonth()], count: 0, g1Kg: 0, g3Kg: 0, r2Kg: 0, _year: d.getFullYear(), _month: d.getMonth() }
      })

      orders.forEach((o: any) => {
        const createdAt = o.createdAt || o.dateCommande
        if (!createdAt) return
        const d = new Date(createdAt)
        const mp = monthPoints.find(p => p._year === d.getFullYear() && p._month === d.getMonth())
        if (!mp) return
        mp.count++
        ;(o.lignes ?? []).forEach((ligne: any) => {
          const gen = ligne.generation?.codeGeneration ?? ligne.codeGeneration ?? '?'
          const qty = parseFloat(ligne.quantiteDemandee ?? 0) || 0
          if (gen === 'G1')                         mp.g1Kg += qty
          else if (['G2','G3','G4'].includes(gen))  mp.g3Kg += qty
          else if (['R1','R2'].includes(gen))        mp.r2Kg += qty
        })
      })

      setMonthly(monthPoints.map(p => ({ month: p.month, count: p.count, g1Kg: p.g1Kg, g3Kg: p.g3Kg, r2Kg: p.r2Kg })))

      /* ── Alertes stock faible (< 100 kg) ── */
      const lowStocks: StockAlert[] = stocks
        .filter((s: any) => {
          const qty = parseFloat(s.quantiteDisponible) || 0
          if (qty >= 100) return false
          if (!specFilter) return true
          const codeEspece = s.variete?.espece?.codeEspece?.toUpperCase()
                          || s.lot?.variete?.espece?.codeEspece?.toUpperCase()
          return !codeEspece || codeEspece === specFilter
        })
        .slice(0, 5)
        .map((s: any) => ({
          codeVariete: s.variete?.codeVariete || s.codeLot || '—',
          nomVariete:  s.variete?.nomVariete  || s.nomVariete || '—',
          quantite:    parseFloat(s.quantiteDisponible) || 0,
          unite:       s.unite || 'kg',
          site:        s.site?.nomSite || s.site?.codeSite || '—',
          low:         (parseFloat(s.quantiteDisponible) || 0) < 50,
        }))

      setAlerts(lowStocks)

      /* ── Chaîne aval : qui commande mes variétés à quel niveau ── */
      const chainMap: Record<string, ChainVariete> = {}
      const ACTIVE_STATUTS = ['SOUMISE','EN_NEGOCIATION','ACCORDEE','EN_LIVRAISON','LIVREE']
      orders.forEach((o: any) => {
        if (!ACTIVE_STATUTS.includes((o.statut ?? '').toUpperCase())) return
        ;(o.lignes ?? []).forEach((ligne: any) => {
          const gen = ligne.generation?.codeGeneration ?? ligne.codeGeneration ?? '?'
          if (!['G1','G3','G4','R1','R2'].includes(gen)) return
          const variety = varMap[ligne.idVariete ?? ligne.varieteId ?? -1]
            ?? ligne.variete
            ?? varMap[ligne.lot?.idVariete ?? ligne.lot?.varieteId ?? -1]
            ?? ligne.lot?.variete
            ?? {}
          if (!variety.codeVariete) return
          if (specFilter) {
            const esp = (variety.espece?.codeEspece ?? '').toUpperCase()
            if (esp && esp !== specFilter) return
          }
          const cv = variety.codeVariete
          if (!chainMap[cv]) chainMap[cv] = {
            codeVariete: cv,
            nomVariete:  variety.nomVariete ?? cv,
            codeEspece:  variety.espece?.codeEspece ?? '?',
            demands: [],
          }
          const qtyKg = parseFloat(ligne.quantiteDemandee ?? 0) || 0
          chainMap[cv].demands.push({
            gen,
            username: o.usernameAcheteur ?? o.client ?? '—',
            client:   o.client ?? o.usernameAcheteur ?? '—',
            qtyKg,
            statut:   (o.statut ?? '').toUpperCase(),
            orderId:  o.id ?? 0,
          })
        })
      })
      setChainVarietes(
        Object.values(chainMap)
          .map(v => ({ ...v, demands: v.demands.sort((a, b) => {
            const ORDER = ['G1','G3','G4','R1','R2']
            return ORDER.indexOf(a.gen) - ORDER.indexOf(b.gen)
          })}))
          .sort((a, b) => b.demands.length - a.demands.length)
      )
    } catch { /* silencieux */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    timer.current = setInterval(() => fetchData(true), REFRESH_INTERVAL)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [userSpecialisation])

  /* ── Stock par espèce / variété / génération (filtré par spécialisation) ── */
  const specUp      = userSpecialisation?.toUpperCase()
  const varById: Record<number, any> = Object.fromEntries(rawVarieties.map(v => [v.id, v]))
  const lotById: Record<number, any> = Object.fromEntries(lots.map(l => [l.id, l]))
  const stkRowMap: Record<string, SelStockRow> = {}

  rawStocks.forEach((st: any) => {
    const lotObj      = st.lot ?? lotById[st.idLot ?? st.lotId] ?? {}
    const gen         = lotObj.generation?.codeGeneration ?? st.generation ?? '?'
    if (gen === '?') return
    let variety: any  = lotObj.variete ?? varById[lotObj.idVariete ?? lotObj.varieteId ?? -1] ?? {}
    if (!variety.codeVariete) variety = varById[st.idVariete ?? -1] ?? st.variete ?? {}
    if (!variety.codeVariete) return
    const esp         = variety.espece ?? {}
    const codeEspece  = esp.codeEspece ?? '?'
    if (specUp && codeEspece.toUpperCase() !== specUp) return
    const key = `${variety.codeVariete}|${gen}`
    if (!stkRowMap[key]) stkRowMap[key] = {
      codeEspece, nomEspece: esp.nomEspece ?? codeEspece,
      codeVariete: variety.codeVariete, nomVariete: variety.nomVariete ?? variety.codeVariete,
      generation: gen, stockKg: 0, nbLots: 0, demandKg: 0,
    }
    stkRowMap[key].stockKg += parseFloat(st.quantiteDisponible) || 0
  })

  lots.forEach((l: any) => {
    const gen         = l.generation?.codeGeneration ?? '?'
    if (gen === '?') return
    const variety     = varById[l.idVariete ?? l.varieteId ?? -1] ?? l.variete ?? {}
    const cv          = variety.codeVariete ?? l.codeVariete
    if (!cv) return
    const key = `${cv}|${gen}`
    const active = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT','SOUCHE']
    if (stkRowMap[key] && active.includes((l.statut ?? '').toUpperCase()))
      stkRowMap[key].nbLots++
  })

  const stkRows: SelStockRow[] = Object.values(stkRowMap).sort((a, b) => {
    const va = a[stkSortCol], vb = b[stkSortCol]
    if (typeof va === 'string') return stkSortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va as string)
    return stkSortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })
  function stkThSort(col: SelStockSortKey) {
    if (stkSortCol === col) setStkSortAsc(v => !v)
    else { setStkSortCol(col); setStkSortAsc(false) }
  }

  /* ── Données filtrées par période et génération ── */
  const displayMonthly = monthly.slice(monthly.length - PERIOD_COUNTS[period])
  const activeGens: Set<GenKey> = genFilter.size === 0 ? new Set(['g1','g3','r2']) : genFilter
  const filteredMonthly: MonthlyPoint[] = displayMonthly.map(m => ({
    ...m,
    g1Kg: activeGens.has('g1') ? m.g1Kg : 0,
    g3Kg: activeGens.has('g3') ? m.g3Kg : 0,
    r2Kg: activeGens.has('r2') ? m.r2Kg : 0,
  }))

/* ── Chaîne complète : production G0/G1 (lots) + commandes aval ── */
  const fullChainMap: Record<string, {
    codeVariete: string; nomVariete: string; codeEspece: string
    g0kg: number; g1kg: number; lotCount: number
    demandesG1: ChainDemand[]; demandesG3: ChainDemand[]; demandesR2: ChainDemand[]
  }> = {}

  lots.forEach((l: any) => {
    const gen = l.generation?.codeGeneration ?? ''
    if (!['G0','G1'].includes(gen)) return
    const v = varById[l.idVariete ?? l.varieteId ?? -1] ?? {}
    const cv = v.codeVariete ?? l.codeVariete
    if (!cv) return
    if (specUp && (v.espece?.codeEspece ?? '').toUpperCase() !== specUp) return
    if (!fullChainMap[cv]) fullChainMap[cv] = {
      codeVariete: cv, nomVariete: v.nomVariete ?? cv,
      codeEspece: v.espece?.codeEspece ?? '?',
      g0kg: 0, g1kg: 0, lotCount: 0, demandesG1: [], demandesG3: [], demandesR2: [],
    }
    const qty = parseFloat(l.quantiteNette) || 0
    if (gen === 'G0') fullChainMap[cv].g0kg += qty
    else fullChainMap[cv].g1kg += qty
    fullChainMap[cv].lotCount++
  })

  chainVarietes.forEach(v => {
    if (!fullChainMap[v.codeVariete]) fullChainMap[v.codeVariete] = {
      codeVariete: v.codeVariete, nomVariete: v.nomVariete, codeEspece: v.codeEspece,
      g0kg: 0, g1kg: 0, lotCount: 0, demandesG1: [], demandesG3: [], demandesR2: [],
    }
    const entry = fullChainMap[v.codeVariete]
    v.demands.forEach(d => {
      if (d.gen === 'G1') entry.demandesG1.push(d)
      else if (['G3','G4'].includes(d.gen)) entry.demandesG3.push(d)
      else if (['R1','R2'].includes(d.gen)) entry.demandesR2.push(d)
    })
  })

  const fullChain = Object.values(fullChainMap)
    .filter(v => v.lotCount > 0 || v.demandesG1.length > 0 || v.demandesG3.length > 0 || v.demandesR2.length > 0)
    .sort((a, b) => {
      const ta = a.demandesR2.length + a.demandesG3.length + a.demandesG1.length
      const tb = b.demandesR2.length + b.demandesG3.length + b.demandesG1.length
      return tb !== ta ? tb - ta : (b.g1kg + b.g0kg) - (a.g1kg + a.g0kg)
    })

  /* ── KPI pipeline G0→G1→G3→Commandes ── */
  const ACTIVE_LOT = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT','SOUCHE']
  const kpiG0Kg = lots
    .filter((l: any) => l.generation?.codeGeneration === 'G0' && ACTIVE_LOT.includes((l.statut ?? '').toUpperCase()))
    .reduce((s: number, l: any) => s + (parseFloat(l.quantiteNette) || 0), 0)
  const kpiG1Kg = lots
    .filter((l: any) => l.generation?.codeGeneration === 'G1' && ACTIVE_LOT.includes((l.statut ?? '').toUpperCase()))
    .reduce((s: number, l: any) => s + (parseFloat(l.quantiteNette) || 0), 0)
  const kpiG3Kg = chainVarietes.reduce((s, v) =>
    s + v.demands.filter(d => ['G3','G4'].includes(d.gen)).reduce((ss, d) => ss + d.qtyKg, 0), 0)
  const kpiCmdActives = new Set(chainVarietes.flatMap(v => v.demands.map(d => d.orderId))).size

  function handleExport() {
    const date = new Date().toISOString().slice(0, 10)
    const monthRows = filteredMonthly.map(m => [
      m.month,
      Math.round(m.g1Kg), parseFloat((m.g1Kg / 1000).toFixed(3)),
      Math.round(m.g3Kg), parseFloat((m.g3Kg / 1000).toFixed(3)),
      Math.round(m.r2Kg), parseFloat((m.r2Kg / 1000).toFixed(3)),
      Math.round(m.g1Kg + m.g3Kg + m.r2Kg), parseFloat(((m.g1Kg + m.g3Kg + m.r2Kg) / 1000).toFixed(3)),
      m.count,
    ])
    const chainRows: any[] = []
    fullChain.forEach(v => {
      const allD = [
        ...v.demandesG1.map(d => ({ ...d, _gen: 'G1' })),
        ...v.demandesG3.map(d => ({ ...d, _gen: d.gen })),
        ...v.demandesR2.map(d => ({ ...d, _gen: d.gen })),
      ]
      allD.forEach(d => {
        chainRows.push([v.nomVariete, v.codeVariete, v.codeEspece, d._gen, d.username, d.client, Math.round(d.qtyKg), parseFloat((d.qtyKg / 1000).toFixed(3)), d.statut])
      })
    })
    downloadXlsx(`senjiw-demandes-selecteur-${period}-${date}`, [
      { name: 'Mensuel', headers: ['Mois','G1 (kg)','G1 (t)','G3 (kg)','G3 (t)','R2 (kg)','R2 (t)','Total (kg)','Total (t)','Nb commandes'], rows: monthRows },
      { name: 'Chaîne aval', headers: ['Variété','Code variété','Espèce','Génération','Username','Client','Quantité (kg)','Quantité (t)','Statut'], rows: chainRows },
    ])
  }

  function toggleGen(k: GenKey) {
    setGenFilter(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>

      {/* ── Titre ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--green-700)" />
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            Pilotage semencier — Production & Chaîne aval
            {userSpecialisation && (
              <span style={{ marginLeft: 8, background: '#0369a120', color: '#0369a1', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                {userSpecialisation}
              </span>
            )}
          </span>
        </div>
        <button
          className="btn btn-ghost"
          style={{ gap: 5, fontSize: 12 }}
          onClick={() => fetchData(true)}
          disabled={refreshing}
          title="Actualiser"
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {/* ══ Pipeline KPI G0 → G1 → G3 → Commandes ══ */}
      <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {([
          { label: 'G0 en stock',      value: fmtT(kpiG0Kg),         color: GEN_COLOR.G0, sub: 'Génétique' },
          { label: 'G1 disponible',    value: fmtT(kpiG1Kg),         color: GEN_COLOR.G1, sub: 'Pré-base' },
          { label: 'G3 demandés',      value: fmtT(kpiG3Kg),         color: GEN_COLOR.G3, sub: 'vers Multiplicateurs' },
          { label: 'Commandes actives',value: String(kpiCmdActives),  color: '#6b7280',    sub: 'en cours' },
        ] as const).map((step, i, arr) => (
          <div key={step.label} style={{ flex: 1, display: 'flex', alignItems: 'center',
            background: 'var(--surface)', minWidth: 0 }}>
            <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
              {loading ? (
                <div className="skeleton" style={{ height: 40, borderRadius: 6 }} />
              ) : (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: step.color,
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                    {step.value}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {step.sub}
                  </div>
                </>
              )}
            </div>
            {i < arr.length - 1 && (
              <ChevronRight size={14} style={{ color: 'var(--border)', flexShrink: 0, marginRight: -1 }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* ── Production G0/G1 par variété ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><BarChart2 size={15} /></span>
              Production G0 → G1 par variété
            </span>
            {!loading && (
              <span className="badge badge-blue" style={{ fontSize: 11 }}>
                {prodByVariete.length} variétés
              </span>
            )}
          </div>
          <div className="card-body" style={{ padding: '16px' }}>
            {loading ? (
              <div className="skeleton" style={{ height: 140, borderRadius: 6 }} />
            ) : (
              <ProdHBarChart data={prodByVariete} />
            )}
          </div>
        </div>

      </div>

      {/* ── Stock disponible par variété / génération ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Database size={14}/></span>
            Stock disponible — Variétés
            {specUp && (
              <span style={{ marginLeft: 6, background: '#0369a120', color: '#0369a1',
                borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                {specUp}
              </span>
            )}
            {!loading && (
              <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: 11 }}>
                {stkRows.length} entrées
              </span>
            )}
          </span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {([
                  { col: 'nomEspece'  as SelStockSortKey, label: 'Espèce' },
                  { col: 'nomVariete' as SelStockSortKey, label: 'Variété' },
                  { col: 'generation' as SelStockSortKey, label: 'Gén.' },
                  { col: 'stockKg'    as SelStockSortKey, label: 'Stock (kg)' },
                  { col: 'nbLots'     as SelStockSortKey, label: 'Lots actifs' },
                  { col: 'demandKg'   as SelStockSortKey, label: 'Demande (kg)' },
                ] as { col: SelStockSortKey; label: string }[]).map(({ col, label }) => (
                  <th key={col} onClick={() => stkThSort(col)}
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {label}
                      {stkSortCol === col
                        ? <span style={{ fontSize: 9, opacity: 0.85 }}>{stkSortAsc ? '↑' : '↓'}</span>
                        : <span style={{ fontSize: 9, opacity: 0.25 }}>↕</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0,1,2,3].map(i => (
                  <tr key={i}><td colSpan={6}>
                    <div className="skeleton" style={{ height: 13, borderRadius: 4 }}/>
                  </td></tr>
                ))
              ) : stkRows.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state" style={{ padding: '28px 0' }}>
                    <div className="empty-icon"><Database size={16}/></div>
                    <div className="empty-title">Aucun stock enregistré</div>
                    <div className="empty-sub">
                      {specUp ? `Aucun stock pour la spécialisation ${specUp}` : 'Les données apparaîtront ici'}
                    </div>
                  </div>
                </td></tr>
              ) : (
                stkRows.slice(0, 60).map((r, i) => {
                  const genClr = GEN_COLOR[r.generation] ?? '#6b7280'
                  const isCrit = r.demandKg > 0 && r.stockKg < r.demandKg * 0.5
                  const isLow  = !isCrit && r.demandKg > 0 && r.stockKg < r.demandKg
                  return (
                    <tr key={i} style={{ background: isCrit ? '#fef2f220' : isLow ? '#fffbeb20' : 'transparent' }}>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{r.codeEspece}</span>
                        {r.nomEspece !== r.codeEspece && (
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 5 }}>
                            {r.nomEspece}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.nomVariete}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {r.codeVariete}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 8px',
                          background: `${genClr}18`, color: genClr, border: `1px solid ${genClr}35`,
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          {r.generation}
                          <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>
                            {GEN_LABEL[r.generation] ?? ''}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums',
                          color: isCrit ? 'var(--red-600)' : isLow ? 'var(--gold-dark)' : 'var(--text-primary)',
                        }}>
                          {r.stockKg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 11 }}>kg</span>
                        {(isCrit || isLow) && (
                          <span style={{
                            marginLeft: 5, fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px',
                            background: isCrit ? '#fef2f2' : '#fffbeb',
                            color: isCrit ? 'var(--red-600)' : 'var(--gold-dark)',
                            border: `1px solid ${isCrit ? '#fecaca' : '#fde68a'}`,
                          }}>
                            {isCrit ? '⚠ Critique' : '⚠ Bas'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                          {r.nbLots}
                        </span>
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
          {stkRows.length > 60 && (
            <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12,
              color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              60 / {stkRows.length} lignes affichées
            </div>
          )}
        </div>
      </div>

      {/* ── Alertes stock faible ── */}
      {!loading && alerts.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ color: 'var(--gold-dark)' }}>
              <span className="card-title-icon" style={{ background: 'var(--gold-light)' }}>
                <AlertTriangle size={15} color="var(--gold-dark)" />
              </span>
              Alertes — stock faible
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {alerts.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none',
                  background: a.low ? '#fef2f2' : '#fffbeb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Indicateur pulsant */}
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: a.low ? 'var(--red-600)' : 'var(--gold-dark)',
                      display: 'inline-block',
                      animation: 'pulse-dot 1.5s ease-in-out infinite',
                    }} />
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.codeVariete}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.site}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: a.low ? 'var(--red-600)' : 'var(--gold-dark)',
                  background: a.low ? '#fef2f2' : '#fef9ed',
                  border: `1px solid ${a.low ? '#fecaca' : '#fde68a'}`,
                  borderRadius: 6, padding: '3px 10px',
                }}>
                  {a.quantite.toLocaleString('fr-FR')} {a.unite}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section unifiée : Demandes reçues + Chaîne aval ── */}
      <div className="card" style={{ overflow: 'hidden' }}>

        {/* En-tête avec filtres */}
        <div style={{ padding: '14px 18px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="card-title">
              <span className="card-title-icon"><TrendingUp size={15} /></span>
              Demandes reçues sur vos variétés
              {specUp && (
                <span style={{ marginLeft: 6, background: '#0369a120', color: '#0369a1', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                  {specUp}
                </span>
              )}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Export */}
              {!loading && (
                <button
                  onClick={handleExport}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
                  title="Exporter en Excel"
                >
                  <Download size={11} /> Export .xls
                </button>
              )}
            </div>
          </div>

          {/* Barre de filtres */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, flexWrap: 'wrap' }}>
            {/* Période */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
              {(['1m','3m','6m','1a'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: period === p ? 700 : 400,
                  background: period === p ? 'var(--surface)' : 'transparent',
                  color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.12s',
                }}>
                  {p === '1m' ? '1 mois' : p === '3m' ? '3 mois' : p === '6m' ? '6 mois' : '1 an'}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
            {/* Filtres génération */}
            {([
              { key: 'g1' as GenKey, label: 'G1 → UPSemCL', color: STACK_COLORS.g1 },
              { key: 'g3' as GenKey, label: 'G3 → Mult.',   color: STACK_COLORS.g3 },
              { key: 'r2' as GenKey, label: 'R2 → Quot.',   color: STACK_COLORS.r2 },
            ]).map(({ key, label, color }) => {
              const active = genFilter.size === 0 || genFilter.has(key)
              const selected = genFilter.has(key)
              return (
                <button key={key} onClick={() => toggleGen(key)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.12s',
                  background: selected ? `${color}18` : 'var(--surface-2)',
                  color: active ? color : 'var(--text-muted)',
                  border: `1.5px solid ${selected ? color + '55' : 'var(--border)'}`,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: active ? color : 'var(--border)', display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Corps : graphique + chaîne aval côte à côte */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 280 }}>

          {/* Graphique mensuel */}
          <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
            {loading ? (
              <div className="skeleton" style={{ height: 220, borderRadius: 6 }} />
            ) : filteredMonthly.every(m => m.g1Kg === 0 && m.g3Kg === 0 && m.r2Kg === 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 8 }}>
                <TrendingUp size={32} style={{ opacity: 0.2 }} />
                <span style={{ fontSize: 13 }}>Aucune commande sur la période</span>
              </div>
            ) : (
              <StackedMonthChart data={filteredMonthly} periodLabel={PERIOD_LABELS[period]} />
            )}
          </div>

          {/* Chaîne aval — pipeline 3 niveaux */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <GitBranch size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Chaîne aval — qui commande mes variétés
              </span>
              {!loading && (() => {
                const g3t = fullChain.reduce((s, v) => s + v.demandesG3.reduce((ss, d) => ss + d.qtyKg, 0), 0)
                const r2t = fullChain.reduce((s, v) => s + v.demandesR2.reduce((ss, d) => ss + d.qtyKg, 0), 0)
                return (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {(genFilter.size === 0 || genFilter.has('g3')) && g3t > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: STACK_COLORS.g3, fontVariantNumeric: 'tabular-nums' }}>
                        G3 {fmtT(g3t)}
                      </span>
                    )}
                    {(genFilter.size === 0 || genFilter.has('r2')) && r2t > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: STACK_COLORS.r2, fontVariantNumeric: 'tabular-nums' }}>
                        R2 {fmtT(r2t)}
                      </span>
                    )}
                    <span className="badge badge-blue" style={{ fontSize: 10 }}>
                      {fullChain.length} variété{fullChain.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )
              })()}
            </div>

            <div style={{ overflowY: 'auto', maxHeight: 320, flex: 1 }}>
              {loading ? (
                <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 160, borderRadius: 6 }} /></div>
              ) : fullChain.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', color: 'var(--text-muted)', gap: 8 }}>
                  <GitBranch size={28} style={{ opacity: 0.2 }} />
                  <span style={{ fontSize: 12 }}>Aucune variété en production</span>
                </div>
              ) : (
                fullChain.map((v, vi) => {
                  const showG1 = genFilter.size === 0 || genFilter.has('g1')
                  const showG3 = genFilter.size === 0 || genFilter.has('g3')
                  const showR2 = genFilter.size === 0 || genFilter.has('r2')
                  const C: Record<string, string> = { G1:'#0ea5e9', G3:'#f59e0b', R2:'#14b8a6' }
                  const sC: Record<string, string> = {
                    SOUMISE:'#6b7280', EN_NEGOCIATION:'#d97706', ACCORDEE:'#2563eb',
                    EN_LIVRAISON:'#7c3aed', LIVREE:'#15803d',
                  }
                  const r2Total = v.demandesR2.reduce((s, d) => s + d.qtyKg, 0)
                  const g3Total = v.demandesG3.reduce((s, d) => s + d.qtyKg, 0)
                  const g1HasNext = showG1 && (showG3 || showR2)
                  const g3HasNext = showG3 && showR2

                  return (
                    <div key={v.codeVariete} style={{
                      borderBottom: vi < fullChain.length - 1 ? '1px solid var(--border)' : 'none',
                      padding: '10px 14px',
                    }}>
                      {/* En-tête variété */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{v.nomVariete}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          background: 'var(--surface-2)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {v.codeEspece}
                        </span>
                        {(r2Total + g3Total) > 0 && (
                          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800,
                            color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtT(r2Total + g3Total)}
                          </span>
                        )}
                      </div>

                      {/* Pipeline niveaux */}
                      <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 2 }}>

                        {/* Niveau G0/G1 */}
                        {showG1 && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                                background: v.lotCount > 0 ? C.G1 : 'var(--border)',
                                border: '2px solid var(--surface)',
                                boxShadow: v.lotCount > 0 ? `0 0 0 2px ${C.G1}30` : 'none',
                              }} />
                              {g1HasNext && <div style={{ width: 2, flex: 1, minHeight: 14, background: 'var(--border)', marginTop: 2 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: g1HasNext ? 6 : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: v.lotCount > 0 ? C.G1 : 'var(--text-muted)' }}>G0/G1</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Production souche</span>
                                {(v.g0kg + v.g1kg) > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: C.G1, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtT(v.g0kg + v.g1kg)}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                {v.lotCount > 0
                                  ? `${v.lotCount} lot${v.lotCount > 1 ? 's' : ''} · transfert vers UPSemCL`
                                  : 'Aucun lot actif'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Niveau G3 */}
                        {showG3 && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                                background: v.demandesG3.length > 0 ? C.G3 : 'var(--border)',
                                border: '2px solid var(--surface)',
                                boxShadow: v.demandesG3.length > 0 ? `0 0 0 2px ${C.G3}30` : 'none',
                              }} />
                              {g3HasNext && <div style={{ width: 2, flex: 1, minHeight: 14, background: 'var(--border)', marginTop: 2 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: g3HasNext ? 6 : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: v.demandesG3.length > 0 ? C.G3 : 'var(--text-muted)' }}>G3</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→ Multiplicateurs</span>
                                {g3Total > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: C.G3, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtT(g3Total)}
                                  </span>
                                )}
                              </div>
                              {v.demandesG3.length > 0 ? (
                                v.demandesG3.map((d, i) => {
                                  const sc = sC[d.statut] ?? '#6b7280'
                                  return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap',
                                      padding: '2px 6px', borderRadius: 5, background: i % 2 === 0 ? 'var(--surface-2)' : 'transparent' }}>
                                      <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)',
                                        flex: 1, minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {d.client !== d.username && d.client ? d.client : d.username}
                                      </span>
                                      <span style={{ fontSize: 10.5, fontWeight: 700, color: C.G3, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                        {fmtT(d.qtyKg)}
                                      </span>
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
                                        background: `${sc}14`, color: sc, border: `1px solid ${sc}30`, flexShrink: 0 }}>
                                        {d.statut.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                  )
                                })
                              ) : (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                  Distribution via UPSemCL — non suivi directement
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Niveau R2 */}
                        {showR2 && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                                background: v.demandesR2.length > 0 ? C.R2 : 'var(--border)',
                                border: '2px solid var(--surface)',
                                boxShadow: v.demandesR2.length > 0 ? `0 0 0 2px ${C.R2}30` : 'none',
                              }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: v.demandesR2.length > 0 ? C.R2 : 'var(--text-muted)' }}>R2</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→ Quotataires</span>
                                {r2Total > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: C.R2, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtT(r2Total)}
                                  </span>
                                )}
                              </div>
                              {v.demandesR2.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                                  {v.demandesR2.map((d, i) => {
                                    const sc = sC[d.statut] ?? '#6b7280'
                                    return (
                                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                                        padding: '2px 6px', borderRadius: 5, background: i % 2 === 0 ? 'var(--surface-2)' : 'transparent' }}>
                                        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-primary)',
                                          flex: 1, minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {d.client !== d.username && d.client ? d.client : d.username}
                                        </span>
                                        {d.client !== d.username && d.username && (
                                          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                                            @{d.username}
                                          </span>
                                        )}
                                        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.R2, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                          {fmtT(d.qtyKg)}
                                        </span>
                                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
                                          background: `${sc}14`, color: sc, border: `1px solid ${sc}30`, flexShrink: 0 }}>
                                          {d.statut.replace(/_/g, ' ')}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                  Aucune commande R2 en cours
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.5); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
