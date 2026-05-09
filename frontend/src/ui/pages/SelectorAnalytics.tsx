import { useEffect, useRef, useState } from 'react'
import { TrendingUp, AlertTriangle, RefreshCw, BarChart2, Activity, Database } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'

interface Props {
  userSpecialisation?: string | null
}

interface VarietyDemand {
  codeVariete: string
  nomVariete:  string
  codeEspece:  string
  count:       number
}

interface MonthlyPoint {
  month: string
  count: number
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

/* ── Mini BarChart SVG ── */
function BarChart({ data, height = 120 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const barW = 100 / data.length
  return (
    <svg width="100%" height={height} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const barH = (d.value / max) * (height - 24)
        const x = i * barW + barW * 0.15
        const w = barW * 0.7
        const y = height - 20 - barH
        return (
          <g key={d.label}>
            <rect
              x={`${x}%`} y={y} width={`${w}%`} height={barH}
              rx={3} fill={d.color} opacity={0.85}
            />
            <text
              x={`${i * barW + barW / 2}%`} y={height - 4}
              textAnchor="middle" fontSize={9} fill="var(--text-muted)"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {d.label.length > 8 ? d.label.slice(0, 8) + '…' : d.label}
            </text>
            <text
              x={`${i * barW + barW / 2}%`} y={y - 3}
              textAnchor="middle" fontSize={9} fontWeight={700} fill={d.color}
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Mini LineChart SVG ── */
function LineChart({ data, height = 100, color = '#0369a1' }: { data: MonthlyPoint[]; height?: number; color?: string }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 300
  const padX = 8
  const padY = 12
  const innerW = W - padX * 2
  const innerH = height - padY * 2

  const pts = data.map((d, i) => ({
    x: padX + (i / Math.max(data.length - 1, 1)) * innerW,
    y: padY + (1 - d.count / max) * innerH,
    ...d,
  }))

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaBottom = `${pts[pts.length - 1].x},${padY + innerH} ${pts[0].x},${padY + innerH}`
  const areaPath = `${polyline} ${areaBottom}`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <polygon points={areaPath} fill="url(#lcGrad)" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} />
          <text x={p.x} y={padY + innerH + 11} textAnchor="middle" fontSize={8}
            fill="var(--text-muted)" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {p.month}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function SelectorAnalytics({ userSpecialisation }: Props) {
  const [demands,    setDemands]    = useState<VarietyDemand[]>([])
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
        api.get(endpoints.lots),
      ])

      const orders    = ordersRes.status    === 'fulfilled' ? ordersRes.value.data    : []
      const varieties = varietiesRes.status === 'fulfilled' ? varietiesRes.value.data : []
      const stocks    = stocksRes.status    === 'fulfilled' ? stocksRes.value.data    : []
      const lotsData  = lotsRes.status      === 'fulfilled' ? lotsRes.value.data      : []
      setLots(lotsData)
      setRawStocks(stocks)
      setRawVarieties(varieties)

      /* ── Variétés les plus demandées ── */
      const demandMap: Record<string, number> = {}
      orders.forEach((o: any) => {
        const key = o.codeVariete || o.variete?.codeVariete || o.idVariete
        if (key) demandMap[key] = (demandMap[key] || 0) + 1
      })

      // Filtre par spécialisation si définie
      const specFilter = userSpecialisation?.toUpperCase()
      const relevantVarieties: any[] = specFilter
        ? varieties.filter((v: any) => v.espece?.codeEspece?.toUpperCase() === specFilter)
        : varieties

      const topDemands: VarietyDemand[] = relevantVarieties
        .map((v: any) => ({
          codeVariete: v.codeVariete,
          nomVariete:  v.nomVariete,
          codeEspece:  v.espece?.codeEspece ?? '',
          count:       demandMap[v.codeVariete] || 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

      setDemands(topDemands)

      /* ── Évolution mensuelle des commandes (6 derniers mois) ── */
      const now   = new Date()
      const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
      const monthPoints: MonthlyPoint[] = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        return { month: MONTHS[d.getMonth()], count: 0, _year: d.getFullYear(), _month: d.getMonth() }
      }) as any[]

      orders.forEach((o: any) => {
        const createdAt = o.createdAt || o.dateCommande
        if (!createdAt) return
        const d = new Date(createdAt)
        const mp = (monthPoints as any[]).find((p: any) => p._year === d.getFullYear() && p._month === d.getMonth())
        if (mp) mp.count++
      })

      setMonthly(monthPoints.map(p => ({ month: p.month, count: p.count })))

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

  const barData = demands.map((d, i) => ({
    label: d.codeVariete,
    value: d.count,
    color: ['#0369a1','#0f766e','#15803d','#7c3aed','#b45309','#dc2626'][i % 6],
  }))

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

        {/* ── BarChart — demandes ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><BarChart2 size={15} /></span>
              Variétés les plus demandées
            </span>
          </div>
          <div className="card-body" style={{ padding: '16px' }}>
            {loading ? (
              <div className="skeleton" style={{ height: 140, borderRadius: 6 }} />
            ) : demands.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Aucune donnée disponible
              </div>
            ) : (
              <BarChart data={barData} height={130} />
            )}
          </div>
        </div>

        {/* ── LineChart — évolution mensuelle ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><TrendingUp size={15} /></span>
              Évolution des commandes (6 mois)
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
              <LineChart data={monthly} height={120} color="#0369a1" />
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
