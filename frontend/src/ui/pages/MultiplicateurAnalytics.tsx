import { useEffect, useRef, useState } from 'react'
import { TrendingUp, RefreshCw, ChevronRight, AlertTriangle, Download, Package } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, normalizeVariete, extractList } from '../../lib/normalizers'
import { fmtT } from '../../lib/fmt'
import { GEN_CHART_COLORS } from '../../lib/constants'
import { downloadXlsx } from '../../lib/exportUtils'

const GC = GEN_CHART_COLORS

type Period = '1m' | '3m' | '6m' | '1a'
const PERIOD_MONTHS: Record<Period, number> = { '1m': 1, '3m': 3, '6m': 6, '1a': 12 }
const PERIOD_LABELS: Record<Period, string>  = { '1m': '1 mois', '3m': '3 mois', '6m': '6 mois', '1a': '1 an' }
const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const ACTIVE_STATUTS = ['SOUMISE','ACCEPTEE']
const REFRESH_INTERVAL = 30_000

interface PipelineKpi {
  g3Kg: number; g4Kg: number; r1Kg: number; r2StockKg: number; cmdCount: number
}
interface MonthlyPoint {
  month: string; r2Kg: number; count: number; _year: number; _month: number
}
interface CoverageRow {
  codeVariete: string; nomVariete: string; codeEspece: string
  stockR2Kg: number; demandR2Kg: number
}
interface CertifLot {
  id: number; codeLot: string; nomVariete: string; gen: string; statut: string; dateCreation: string
}

/* ── Graphe mensuel vertical R2 ── */
function R2MonthChart({ data, periodLabel }: { data: MonthlyPoint[]; periodLabel: string }) {
  const [hov, setHov] = useState<number | null>(null)
  const totalR2 = data.reduce((s, d) => s + d.r2Kg, 0)
  const totalCmd = data.reduce((s, d) => s + d.count, 0)
  const W = 380; const H = 180; const PT = 22; const PB = 26; const PL = 34; const PR = 8
  const iW = W - PL - PR; const iH = H - PT - PB
  const maxVal = Math.max(...data.map(d => d.r2Kg), 1)
  const niceMax = maxVal <= 0.1 ? 1
    : Math.ceil(maxVal / Math.pow(10, Math.floor(Math.log10(maxVal)))) * Math.pow(10, Math.floor(Math.log10(maxVal)))
  const bW = iW / Math.max(data.length, 1)
  const lastIdx = data.reduce((b, d, i) => d.r2Kg > 0 ? i : b, -1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {totalR2 > 0 ? fmtT(totalR2) : `${totalCmd} commande${totalCmd !== 1 ? 's' : ''}`}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{periodLabel}</span>
        <span style={{ fontSize: 10, background: `${GC.R2}14`, color: GC.R2,
          border: `1px solid ${GC.R2}35`, borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>
          R2 → Quotataires
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        {[0,1,2,3].map(t => {
          const y = PT + (t / 3) * iH
          const v = niceMax * (1 - t / 3)
          const lbl = v >= 1000 ? `${(v/1000).toFixed(0)}t` : v > 0 ? `${Math.round(v)}` : '0'
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="var(--border)"
                strokeWidth={t === 3 ? 1.5 : 0.5} strokeDasharray={t === 3 ? '0' : '3,4'} />
              <text x={PL-4} y={y+3.5} textAnchor="end" fontSize={7.5}
                fill="var(--text-muted)" fontFamily="var(--font-sans)">{lbl}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const bh  = Math.max((d.r2Kg / niceMax) * iH, d.r2Kg > 0 ? 3 : 0)
          const x   = PL + i * bW + bW * 0.15
          const bw  = bW * 0.70
          const y   = PT + iH - bh
          const isH = hov === i
          const isL = i === lastIdx
          return (
            <g key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} style={{ cursor: 'default' }}>
              {isH && <rect x={x-2} y={PT} width={bw+4} height={iH} rx={3} fill={GC.R2} opacity={0.07} />}
              <rect x={x} y={y} width={bw} height={Math.max(bh,2)} rx={4}
                fill={GC.R2} opacity={d.r2Kg === 0 ? 0.12 : isH ? 1 : isL ? 0.9 : 0.7}
                style={{ transition: 'opacity 0.15s' }} />
              {d.r2Kg > 0 && (
                <text x={x+bw/2} y={y-4} textAnchor="middle" fontSize={isH?9.5:8.5}
                  fontWeight={700} fill={GC.R2} fontFamily="var(--font-sans)">
                  {fmtT(d.r2Kg)}
                </text>
              )}
              <text x={x+bw/2} y={H-PB+12} textAnchor="middle" fontSize={8.5}
                fontWeight={isH||isL ? 700 : 400}
                fill={isH||isL ? GC.R2 : 'var(--text-muted)'} fontFamily="var(--font-sans)">
                {d.month}
              </text>
              {isH && d.r2Kg > 0 && (
                <g>
                  <rect x={x+bw/2-44} y={y-40} width={88} height={30} rx={5}
                    fill="var(--text-primary)" opacity={0.93} />
                  <text x={x+bw/2} y={y-26} textAnchor="middle" fontSize={9}
                    fontWeight={700} fill="#fff" fontFamily="var(--font-sans)">{d.month}</text>
                  <text x={x+bw/2} y={y-14} textAnchor="middle" fontSize={8.5}
                    fontWeight={600} fill={GC.R2} fontFamily="var(--font-sans)">
                    {fmtT(d.r2Kg)} · {d.count} cmd{d.count!==1?'s':''}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ── Couverture R2 stock vs commandes actives ── */
function CoverageBar({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
      Aucune donnée de stock R2
    </div>
  )
  const maxKg = Math.max(...rows.map(r => Math.max(r.stockR2Kg, r.demandR2Kg)), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.sort((a,b) => b.demandR2Kg - a.demandR2Kg).map(r => {
        const ratio = r.demandR2Kg > 0 ? r.stockR2Kg / r.demandR2Kg : Infinity
        const isCrit = r.demandR2Kg > 0 && ratio < 1
        const isWarn = r.demandR2Kg > 0 && ratio >= 1 && ratio < 2
        const clr = isCrit ? '#dc2626' : isWarn ? '#d97706' : '#15803d'
        const pctStock = Math.min((r.stockR2Kg / maxKg) * 100, 100)
        const pctDemand = Math.min((r.demandR2Kg / maxKg) * 100, 100)
        return (
          <div key={r.codeVariete}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.nomVariete}
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                {r.codeEspece}
              </span>
              {r.demandR2Kg > 0 && (
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                  background: `${clr}14`, color: clr, border: `1px solid ${clr}30`, flexShrink: 0 }}>
                  {isCrit ? '⚠ Critique' : isWarn ? '⚠ Bas' : '✓ OK'}
                </span>
              )}
            </div>
            <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pctStock}%`, background: clr, borderRadius: 4, opacity: 0.85,
                transition: 'width 0.5s ease' }} />
              {r.demandR2Kg > 0 && (
                <div style={{ position: 'absolute', left: `${pctDemand}%`, top: 0, bottom: 0,
                  width: 2, background: '#374151', borderRadius: 1, transform: 'translateX(-1px)' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                Stock {fmtT(r.stockR2Kg)}
              </span>
              {r.demandR2Kg > 0 && (
                <span style={{ fontSize: 10, color: clr, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  Demande {fmtT(r.demandR2Kg)}
                </span>
              )}
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 12, marginTop: 2, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 10, height: 8, borderRadius: 2, background: '#15803d', opacity: 0.85 }} />
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Stock R2</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 2, height: 10, background: '#374151', borderRadius: 1 }} />
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Demande active</span>
        </div>
      </div>
    </div>
  )
}

export function MultiplicateurAnalytics() {
  const [kpi,          setKpi]          = useState<PipelineKpi>({ g3Kg:0, g4Kg:0, r1Kg:0, r2StockKg:0, cmdCount:0 })
  const [monthly,      setMonthly]      = useState<MonthlyPoint[]>([])
  const [coverageRows, setCoverageRows] = useState<CoverageRow[]>([])
  const [certifLots,   setCertifLots]   = useState<CertifLot[]>([])
  const [sitesResume,  setSitesResume]  = useState<{ nomSite: string; codeSite: string; region: string; stockKg: number; nbEntrees: number }[]>([])
  const [alertes,      setAlertes]      = useState<{ label: string; detail: string; critical: boolean }[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [period,       setPeriod]       = useState<Period>('6m')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      const [lotsRes, ordersRes, stocksRes, certifRes, varietiesRes, monStockRes] = await Promise.allSettled([
        api.get(endpoints.lotsMesLots),
        api.get(`${endpoints.orders}?size=200`),
        api.get(endpoints.stocksAgrege),
        api.get(endpoints.lotsMultCertif),
        api.get(endpoints.varieties),
        api.get(endpoints.stockMonStock),
      ])

      const lotsData  = extractList(lotsRes.status     === 'fulfilled' ? lotsRes.value.data     : null).map(normalizeLot)
      const orders    = extractList(ordersRes.status    === 'fulfilled' ? ordersRes.value.data    : null)
      const stocks    = extractList(stocksRes.status    === 'fulfilled' ? stocksRes.value.data    : null)
      const certifRaw = extractList(certifRes.status    === 'fulfilled' ? certifRes.value.data    : null)
      const varieties = extractList(varietiesRes.status === 'fulfilled' ? varietiesRes.value.data : null).map(normalizeVariete)
      const monStock  = extractList(monStockRes.status  === 'fulfilled' ? monStockRes.value.data  : null)
      const varMap: Record<number, any> = Object.fromEntries(varieties.map((v: any) => [v.id, v]))

      /* ── KPI pipeline G3→G4→R1→R2→Commandes ── */
      const DISPO_STATUTS = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT']
      let g3Kg = 0, g4Kg = 0, r1Kg = 0
      lotsData.forEach((l: any) => {
        const gen = l.generation?.codeGeneration ?? ''
        const qty = parseFloat(l.quantiteNette) || 0
        if (gen === 'G3') g3Kg += qty
        else if (gen === 'G4') g4Kg += qty
        else if (gen === 'R1' && DISPO_STATUTS.includes((l.statut ?? '').toUpperCase())) r1Kg += qty
      })
      const r2StockKg = stocks
        .filter((s: any) => s.codeGeneration === 'R2')
        .reduce((sum: number, s: any) => sum + (parseFloat(s.quantiteTotale) || 0), 0)
      const cmdCount = orders.filter((o: any) => ACTIVE_STATUTS.includes((o.statut ?? '').toUpperCase())).length
      setKpi({ g3Kg, g4Kg, r1Kg, r2StockKg, cmdCount })

      /* ── Évolution mensuelle R2 (12 mois) ── */
      const now = new Date()
      const monthPoints: MonthlyPoint[] = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
        return { month: MONTHS[d.getMonth()], r2Kg: 0, count: 0, _year: d.getFullYear(), _month: d.getMonth() }
      })
      orders.forEach((o: any) => {
        const createdAt = o.createdAt || o.dateCommande
        if (!createdAt) return
        const d = new Date(createdAt)
        const mp = monthPoints.find(p => p._year === d.getFullYear() && p._month === d.getMonth())
        if (!mp) return
        const hasR2 = (o.lignes ?? []).some((l: any) =>
          (l.generation?.codeGeneration ?? l.codeGeneration ?? '') === 'R2'
        )
        if (!hasR2) return
        mp.count++
        ;(o.lignes ?? []).forEach((ligne: any) => {
          if ((ligne.generation?.codeGeneration ?? ligne.codeGeneration ?? '') === 'R2')
            mp.r2Kg += parseFloat(ligne.quantiteDemandee ?? 0) || 0
        })
      })
      setMonthly(monthPoints)

      /* ── Couverture R2 : stock vs commandes actives ── */
      const covMap: Record<string, CoverageRow> = {}
      stocks.forEach((s: any) => {
        if (s.codeGeneration !== 'R2') return
        const cv = s.codeVariete; if (!cv) return
        if (!covMap[cv]) covMap[cv] = {
          codeVariete: cv,
          nomVariete: s.nomVariete ?? cv,
          codeEspece: s.codeEspece ?? '?',
          stockR2Kg: 0, demandR2Kg: 0,
        }
        covMap[cv].stockR2Kg += parseFloat(s.quantiteTotale) || 0
      })
      orders.forEach((o: any) => {
        if (!ACTIVE_STATUTS.includes((o.statut ?? '').toUpperCase())) return
        ;(o.lignes ?? []).forEach((ligne: any) => {
          const gen = ligne.generation?.codeGeneration ?? ligne.codeGeneration ?? '?'
          if (gen !== 'R2') return
          const v = varMap[ligne.idVariete ?? ligne.varieteId ?? -1]
            ?? ligne.variete ?? {}
          const cv = v.codeVariete; if (!cv) return
          if (!covMap[cv]) covMap[cv] = { codeVariete: cv, nomVariete: v.nomVariete ?? cv,
            codeEspece: v.espece?.codeEspece ?? '?', stockR2Kg: 0, demandR2Kg: 0 }
          covMap[cv].demandR2Kg += parseFloat(ligne.quantiteDemandee ?? 0) || 0
        })
      })
      setCoverageRows(Object.values(covMap))

      /* ── Lots en certification G4→R1 ── */
      const certifs: CertifLot[] = certifRaw.map((l: any) => ({
        id: l.id ?? 0,
        codeLot: l.codeLot ?? l.code ?? '—',
        nomVariete: l.variete?.nomVariete ?? varMap[l.idVariete ?? -1]?.nomVariete ?? l.codeVariete ?? '—',
        gen: l.generation?.codeGeneration ?? l.codeGeneration ?? '?',
        statut: (l.statut ?? '').toUpperCase(),
        dateCreation: l.dateCreation ?? l.createdAt ?? '',
      })).filter((l: CertifLot) => ['G4','R1'].includes(l.gen))
        .sort((a: CertifLot, b: CertifLot) => {
          const ORDER = ['G4','R1']; return ORDER.indexOf(a.gen) - ORDER.indexOf(b.gen)
        })
      setCertifLots(certifs)

      /* ── Alertes spécifiques ── */
      const als: { label: string; detail: string; critical: boolean }[] = []
      Object.values(covMap).forEach(r => {
        if (r.demandR2Kg > 0 && r.stockR2Kg < r.demandR2Kg) {
          als.push({
            label: `Stock R2 insuffisant — ${r.nomVariete}`,
            detail: `Stock ${fmtT(r.stockR2Kg)} · Demande ${fmtT(r.demandR2Kg)}`,
            critical: r.stockR2Kg === 0,
          })
        }
      })
      certifRaw.forEach((l: any) => {
        const gen = l.generation?.codeGeneration ?? '?'
        const statut = (l.statut ?? '').toUpperCase()
        if (gen === 'G4' && statut === 'DISPONIBLE') {
          als.push({
            label: `Lot G4 non soumis — ${l.codeLot ?? l.code ?? '?'}`,
            detail: 'Lot G4 disponible mais pas encore soumis à certification',
            critical: false,
          })
        }
      })
      orders.forEach((o: any) => {
        if (!['ACCORDEE'].includes((o.statut ?? '').toUpperCase())) return
        const createdAt = o.createdAt || o.dateCommande
        if (!createdAt) return
        const daysAgo = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
        if (daysAgo > 14) {
          als.push({
            label: `Livraison en retard — commande #${o.id}`,
            detail: `Accordée il y a ${daysAgo} jours sans livraison`,
            critical: daysAgo > 30,
          })
        }
      })
      setAlertes(als)

      /* ── Résumé sites de stockage ── */
      const siteMap: Record<string, { nomSite: string; codeSite: string; region: string; stockKg: number; nbEntrees: number }> = {}
      monStock.forEach((s: any) => {
        const code = s.site?.codeSite ?? s.codeSite ?? '?'
        if (code === '?') return
        if (!siteMap[code]) siteMap[code] = {
          codeSite: code,
          nomSite:  s.site?.nomSite  ?? s.nomSite  ?? code,
          region:   s.site?.region   ?? s.region   ?? '—',
          stockKg: 0, nbEntrees: 0,
        }
        siteMap[code].stockKg  += parseFloat(s.quantiteDisponible ?? s.quantite ?? 0) || 0
        siteMap[code].nbEntrees++
      })
      setSitesResume(Object.values(siteMap).sort((a, b) => b.stockKg - a.stockKg))

    } catch { /* silencieux */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    timer.current = setInterval(() => fetchData(true), REFRESH_INTERVAL)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  /* ── Données filtrées par période ── */
  const displayMonthly = monthly.slice(monthly.length - PERIOD_MONTHS[period])

  /* ── Export ── */
  function handleExport() {
    const date = new Date().toISOString().slice(0, 10)
    const monthRows = displayMonthly.map(m => [m.month, Math.round(m.r2Kg), parseFloat((m.r2Kg/1000).toFixed(3)), m.count])
    const covRows = coverageRows.map(r => [r.nomVariete, r.codeVariete, r.codeEspece,
      Math.round(r.stockR2Kg), Math.round(r.demandR2Kg),
      r.demandR2Kg > 0 ? parseFloat((r.stockR2Kg/r.demandR2Kg).toFixed(2)) : '—'])
    downloadXlsx(`senjiw-multiplicateur-${period}-${date}`, [
      { name: 'Commandes R2', headers: ['Mois','R2 (kg)','R2 (t)','Nb commandes'], rows: monthRows },
      { name: 'Couverture R2', headers: ['Variété','Code','Espèce','Stock (kg)','Demande (kg)','Ratio'], rows: covRows },
    ])
  }

  /* ── Pipeline KPI steps ── */
  const pipelineSteps = [
    { label: 'G3 reçus',      value: fmtT(kpi.g3Kg),       color: GC.G3, sub: 'de l\'UPSemCL' },
    { label: 'G4 produits',   value: fmtT(kpi.g4Kg),       color: GC.G4, sub: 'multiplication' },
    { label: 'R1 certifiés',  value: fmtT(kpi.r1Kg),       color: GC.R1, sub: 'disponibles' },
    { label: 'R2 en stock',   value: fmtT(kpi.r2StockKg),  color: GC.R2, sub: 'commerciaux' },
    { label: 'Commandes',     value: String(kpi.cmdCount),  color: '#6b7280', sub: 'actives' },
  ]

  const statutColor: Record<string, string> = {
    SOUMISE:'#6b7280', EN_NEGOCIATION:'#d97706', ACCORDEE:'#2563eb',
    EN_LIVRAISON:'#7c3aed', LIVREE:'#15803d', EN_COURS_CERT:'#0891b2',
    DISPONIBLE:'#15803d', CERTIFIE:'#15803d',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} color={GC.R2} />
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            Activité commerciale R2 — Quotataires
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!loading && (
            <button onClick={handleExport}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600,
                padding: '4px 10px', borderRadius: 7, background: 'var(--surface-2)',
                border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <Download size={11} /> Export .xls
            </button>
          )}
          <button className="btn btn-ghost" style={{ gap: 5, fontSize: 12 }}
            onClick={() => fetchData(true)} disabled={refreshing} title="Actualiser">
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            {refreshing ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* ══ ① Pipeline KPI G3→G4→R1→R2→Commandes ══ */}
      <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {pipelineSteps.map((step, i) => {
          const isLast = i === pipelineSteps.length - 1
          return (
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
              {!isLast && (
                <ChevronRight size={14} style={{ color: 'var(--border)', flexShrink: 0, marginRight: -1 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* ══ ② Graphe mensuel + Couverture R2 ══ */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* En-tête avec filtres période */}
        <div style={{ padding: '12px 18px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="card-title">
              <span className="card-title-icon"><TrendingUp size={14} /></span>
              Commandes R2 reçues — Quotataires
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
              {(['1m','3m','6m','1a'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: period === p ? 700 : 400,
                  background: period === p ? 'var(--surface)' : 'transparent',
                  color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.12s',
                }}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 240 }}>
          {/* Graphe mensuel */}
          <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
            {loading ? (
              <div className="skeleton" style={{ height: 180, borderRadius: 6 }} />
            ) : displayMonthly.every(m => m.count === 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 8, padding: '24px 0' }}>
                <TrendingUp size={32} style={{ opacity: 0.2 }} />
                <span style={{ fontSize: 12 }}>Aucune commande R2 sur la période</span>
              </div>
            ) : (
              <R2MonthChart data={displayMonthly} periodLabel={`${PERIOD_LABELS[period]}`} />
            )}
          </div>

          {/* Couverture R2 stock vs demandes */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={13} style={{ color: 'var(--text-muted)' }} />
              Couverture R2 — stock vs demande
              {!loading && coverageRows.length > 0 && (
                <span className="badge badge-blue" style={{ fontSize: 10, marginLeft: 'auto' }}>
                  {coverageRows.length} variété{coverageRows.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {loading ? (
              <div className="skeleton" style={{ height: 160, borderRadius: 6 }} />
            ) : (
              <CoverageBar rows={coverageRows} />
            )}
          </div>
        </div>
      </div>

      {/* ══ ③ Lots en certification G4 → R1 ══ */}
      {!loading && certifLots.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon" style={{ background: `${GC.G4}15` }}>
                <span style={{ fontSize: 11 }}>🔬</span>
              </span>
              Lots en certification · G4 → R1
            </span>
            <span className="badge badge-blue" style={{ fontSize: 11 }}>
              {certifLots.length} lot{certifLots.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code lot</th>
                  <th>Variété</th>
                  <th>Génération</th>
                  <th>Statut</th>
                  <th>Date création</th>
                </tr>
              </thead>
              <tbody>
                {certifLots.map(l => {
                  const genClr = GC[l.gen as keyof typeof GC] ?? '#6b7280'
                  const sClr = statutColor[l.statut] ?? '#6b7280'
                  const daysAgo = l.dateCreation
                    ? Math.floor((Date.now() - new Date(l.dateCreation).getTime()) / 86400000)
                    : null
                  return (
                    <tr key={l.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 11.5, fontWeight: 600 }}>
                          {l.codeLot}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5, fontWeight: 500 }}>{l.nomVariete}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 8px',
                          background: `${genClr}18`, color: genClr, border: `1px solid ${genClr}35` }}>
                          {l.gen}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: '2px 8px',
                          background: `${sClr}14`, color: sClr, border: `1px solid ${sClr}30` }}>
                          {l.statut.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {l.dateCreation ? new Date(l.dateCreation).toLocaleDateString('fr-FR') : '—'}
                          {daysAgo !== null && daysAgo > 30 && (
                            <span style={{ marginLeft: 4, fontSize: 10, color: '#d97706', fontWeight: 600 }}>
                              ({daysAgo}j)
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ ④ Sites de stockage ══ */}
      {!loading && sitesResume.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon" style={{ background: '#f0fdf4' }}>
                <span style={{ fontSize: 13 }}>🏪</span>
              </span>
              Sites de stockage R2
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {sitesResume.length} site{sitesResume.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, padding: '12px 16px 14px' }}>
            {sitesResume.map(site => (
              <div key={site.codeSite} style={{
                background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {site.nomSite}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {site.region} · {site.nbEntrees} entrée{site.nbEntrees > 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: GC.R2, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtT(site.stockKg)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ ⑤ Alertes spécifiques ══ */}
      {!loading && alertes.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ color: alertes.some(a => a.critical) ? 'var(--red-600)' : 'var(--gold-dark)' }}>
              <span className="card-title-icon"
                style={{ background: alertes.some(a => a.critical) ? '#fef2f2' : 'var(--gold-light)' }}>
                <AlertTriangle size={14} color={alertes.some(a => a.critical) ? 'var(--red-600)' : 'var(--gold-dark)'} />
              </span>
              Alertes — livraisons & stock
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
              background: alertes.some(a => a.critical) ? '#fef2f2' : '#fffbeb',
              color: alertes.some(a => a.critical) ? '#dc2626' : '#d97706',
              border: `1px solid ${alertes.some(a => a.critical) ? '#fecaca' : '#fde68a'}` }}>
              {alertes.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {alertes.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                borderBottom: i < alertes.length - 1 ? '1px solid var(--border)' : 'none',
                background: a.critical ? '#fef2f220' : '#fffbeb20',
              }}>
                <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: a.critical ? '#dc2626' : '#d97706',
                    display: 'inline-block',
                    animation: 'pulse-dot 1.5s ease-in-out infinite',
                  }} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.5); }
        }
      `}</style>
    </div>
  )
}
