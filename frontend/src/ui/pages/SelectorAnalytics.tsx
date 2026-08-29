import { useEffect, useRef, useState } from 'react'
import { TrendingUp, AlertTriangle, RefreshCw, BarChart2, Activity, Database } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, normalizeVariete, normalizeStock, extractList } from '../../lib/normalizers'
import { fmtT } from '../../lib/fmt'

interface Props {
  userSpecialisation?: string | null
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

function StackedMonthChart({ data }: { data: MonthlyPoint[] }) {
  const [hov, setHov] = useState<number | null>(null)
  const totalG1 = data.reduce((s, d) => s + d.g1Kg, 0)
  const totalG3 = data.reduce((s, d) => s + d.g3Kg, 0)
  const totalR2 = data.reduce((s, d) => s + d.r2Kg, 0)
  const totalKg = totalG1 + totalG3 + totalR2
  const totalOrders = data.reduce((s, d) => s + d.count, 0)

  const hasKg = totalKg > 0

  const W = 400; const H = 160; const PT = 24; const PB = 28; const PL = 36; const PR = 10
  const iW = W - PL - PR; const iH = H - PT - PB
  const maxPerBar = Math.max(...data.map(d => d.g1Kg + d.g3Kg + d.r2Kg), 1)
  const TICKS = 3
  const niceMax = maxPerBar <= 0.1 ? 1 : Math.ceil(maxPerBar / Math.pow(10, Math.floor(Math.log10(maxPerBar)))) * Math.pow(10, Math.floor(Math.log10(maxPerBar)))
  const bW = iW / data.length

  function fmt(kg: number) {
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
    return `${Math.round(kg)} kg`
  }

  const lastActiveIdx = data.reduce((best, d, i) => (d.g1Kg + d.g3Kg + d.r2Kg) > 0 ? i : best, -1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
          {hasKg ? fmt(totalKg) : `${totalOrders} commande${totalOrders !== 1 ? 's' : ''}`}
        </span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>6 derniers mois</span>
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

/* ── Orders Chart — barres mensuelles + ligne de tendance ── */
function OrdersChart({ data, color = '#0369a1' }: { data: MonthlyPoint[]; color?: string }) {
  const [hov, setHov] = useState<number | null>(null)
  if (data.length === 0) return null

  const total = data.reduce((s, d) => s + d.count, 0)
  const max   = Math.max(...data.map(d => d.count), 1)

  const half      = Math.floor(data.length / 2)
  const firstHalf = data.slice(0, half).reduce((s, d) => s + d.count, 0)
  const secHalf   = data.slice(half).reduce((s, d)  => s + d.count, 0)
  const trendPct  = firstHalf === 0 ? null : Math.round(((secHalf - firstHalf) / firstHalf) * 100)

  const lastActiveIdx = data.reduce((best, d, i) => d.count > 0 ? i : best, -1)

  const W = 400; const H = 150
  const PT = 22; const PB = 28; const PL = 28; const PR = 10
  const iW = W - PL - PR; const iH = H - PT - PB
  const TICKS = 3
  const niceMax = max <= 3 ? max + 1 : Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)))
  const bW = iW / data.length

  /* Régression linéaire pour droite de tendance */
  const n = data.length
  const sumX  = data.reduce((s, _, i) => s + i, 0)
  const sumY  = data.reduce((s, d) => s + d.count, 0)
  const sumXY = data.reduce((s, d, i) => s + i * d.count, 0)
  const sumX2 = data.reduce((s, _, i) => s + i * i, 0)
  const denom = n * sumX2 - sumX * sumX || 1
  const slope = (n * sumXY - sumX * sumY) / denom
  const inter = (sumY - slope * sumX) / n
  const trendLine = data.map((_, i) => ({
    x: PL + (i / Math.max(n - 1, 1)) * iW,
    y: Math.max(PT, Math.min(PT + iH, PT + iH - ((slope * i + inter) / niceMax) * iH)),
  }))

  return (
    <div>
      {/* Résumé */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
          {total} commande{total !== 1 ? 's' : ''}
        </span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>6 derniers mois</span>
        {trendPct !== null && (
          <>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
              background: trendPct > 0 ? '#f0fdf4' : trendPct < 0 ? '#fef2f2' : '#f1f5f9',
              color: trendPct > 0 ? '#15803d' : trendPct < 0 ? '#dc2626' : '#6b7280',
              border: `1px solid ${trendPct > 0 ? '#bbf7d0' : trendPct < 0 ? '#fecaca' : '#e2e8f0'}`,
            }}>
              {trendPct > 0 ? '+' : ''}{trendPct}% tendance
            </span>
          </>
        )}
      </div>

      {/* SVG */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="ocBarG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.45} />
          </linearGradient>
        </defs>

        {/* Grille Y */}
        {Array.from({ length: TICKS + 1 }, (_, t) => {
          const y = PT + (t / TICKS) * iH
          const v = Math.round(niceMax * (1 - t / TICKS))
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - PR} y2={y}
                stroke="var(--border)" strokeWidth={t === TICKS ? 1.5 : 0.6}
                strokeDasharray={t === TICKS ? '0' : '3,4'} />
              <text x={PL - 4} y={y + 4} textAnchor="end" fontSize={8}
                fill="var(--text-muted)" fontFamily="var(--font-sans)">{v}</text>
            </g>
          )
        })}

        {/* Barres */}
        {data.map((d, i) => {
          const bh    = Math.max((d.count / niceMax) * iH, d.count > 0 ? 3 : 0)
          const x     = PL + i * bW + bW * 0.18
          const bw    = bW * 0.64
          const y     = PT + iH - bh
          const isHov = hov === i
          const isLast = i === lastActiveIdx
          return (
            <g key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} style={{ cursor: 'default' }}>
              {/* Zone hover */}
              {isHov && <rect x={x - 2} y={PT} width={bw + 4} height={iH} rx={3} fill={color} opacity={0.07} />}

              {/* Barre */}
              <rect x={x} y={y} width={bw} height={Math.max(bh, 2)} rx={4}
                fill={isHov || isLast ? color : 'url(#ocBarG)'}
                opacity={d.count === 0 ? 0.14 : isHov ? 1 : 0.82}
                style={{ transition: 'opacity 0.15s' }} />

              {/* Valeur au-dessus */}
              {d.count > 0 && (
                <text x={x + bw / 2} y={y - 5} textAnchor="middle"
                  fontSize={isHov ? 10 : 9} fontWeight={700} fill={color}
                  fontFamily="var(--font-sans)" style={{ transition: 'font-size 0.1s' }}>
                  {d.count}
                </text>
              )}

              {/* Label mois */}
              <text x={x + bw / 2} y={H - PB + 12} textAnchor="middle" fontSize={9}
                fontWeight={isHov || isLast ? 700 : 400}
                fill={isHov || isLast ? color : 'var(--text-muted)'}
                fontFamily="var(--font-sans)">
                {d.month}
              </text>

              {/* Tooltip */}
              {isHov && (
                <g>
                  <rect x={x + bw / 2 - 40} y={y - 38} width={80} height={28} rx={5}
                    fill="var(--text-primary)" opacity={0.93} />
                  <text x={x + bw / 2} y={y - 24} textAnchor="middle" fontSize={9.5}
                    fontWeight={700} fill="#fff" fontFamily="var(--font-sans)">{d.month}</text>
                  <text x={x + bw / 2} y={y - 13} textAnchor="middle" fontSize={9}
                    fontWeight={600} fill={color} fontFamily="var(--font-sans)">
                    {d.count} commande{d.count !== 1 ? 's' : ''}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Droite de tendance */}
        {total > 0 && trendLine.length >= 2 && (
          <polyline
            points={trendLine.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5,3"
            strokeLinecap="round" opacity={0.35} />
        )}
      </svg>
    </div>
  )
}

export function SelectorAnalytics({ userSpecialisation }: Props) {
  const [prodByVariete, setProdByVariete] = useState<ProdVariete[]>([])
  const [monthly,    setMonthly]    = useState<MonthlyPoint[]>([])
  const [alerts,     setAlerts]     = useState<StockAlert[]>([])
  const [lots,        setLots]        = useState<any[]>([])
  const [rawStocks,   setRawStocks]   = useState<any[]>([])
  const [rawVarieties,setRawVarieties]= useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stkSortCol, setStkSortCol] = useState<SelStockSortKey>('stockKg')
  const [stkSortAsc, setStkSortAsc] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      const [ordersRes, varietiesRes, stocksRes, lotsRes] = await Promise.allSettled([
        api.get(endpoints.orders),
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

      /* ── Évolution mensuelle des commandes (6 derniers mois) ── */
      const now    = new Date()
      const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
      const monthPoints: any[] = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>

      {/* ── Titre ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--green-700)" />
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            Analytics Sélectionneur
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

        {/* ── Demandes reçues — barres empilées G1/G3/R2 ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><TrendingUp size={15} /></span>
              Demandes reçues sur vos variétés
            </span>
          </div>
          <div className="card-body" style={{ padding: '16px' }}>
            {loading ? (
              <div className="skeleton" style={{ height: 120, borderRadius: 6 }} />
            ) : monthly.every(m => m.count === 0) ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Aucune commande sur la période
              </div>
            ) : (
              <StackedMonthChart data={monthly} />
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
