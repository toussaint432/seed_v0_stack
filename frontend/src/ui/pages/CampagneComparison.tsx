import { useEffect, useState } from 'react'
import { BarChart2, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, extractList } from '../../lib/normalizers'

/* ── Types ── */
interface Campagne {
  id: number
  codeCampagne: string
  libelle?: string
  dateDebut?: string
  dateFin?: string
  statut: 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE'
}

interface LotStats {
  nbLots: number
  totalKg: number
  nbVarietes: number
  rendementMoyen: number | null
  nbConfirmes: number
  parGeneration: Record<string, { nb: number; kg: number }>
}

/* ── Constantes ── */
const GEN_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2']
const GEN_COLOR: Record<string, string> = {
  G0: '#1d4ed8', G1: '#15803d', G2: '#92660a',
  G3: '#6d28d9', G4: '#b91c1c', R1: '#0f766e', R2: '#16a34a',
}
const STATUT_COLOR: Record<string, string> = {
  EN_COURS:  '#15803d',
  TERMINEE:  '#6b7280',
  PLANIFIEE: '#d97706',
}
const STATUT_BG: Record<string, string> = {
  EN_COURS:  '#f0fdf4',
  TERMINEE:  '#f9fafb',
  PLANIFIEE: '#fffbeb',
}
const STATUT_LABEL: Record<string, string> = {
  EN_COURS:  'En cours',
  TERMINEE:  'Terminée',
  PLANIFIEE: 'Planifiée',
}

function campagneLabel(c: Campagne) {
  return c.libelle ?? c.codeCampagne
}

function fmtKg(kg: number): string {
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(1)} t`
  if (kg >= 1_000)     return `${(kg / 1_000).toFixed(1)} t`
  return `${Math.round(kg)} kg`
}

function computeStats(lots: any[]): LotStats {
  const parGeneration: Record<string, { nb: number; kg: number }> = {}
  const varIds = new Set<number>()
  let totalKg = 0
  let rendementSum = 0
  let rendementCount = 0
  let nbConfirmes = 0

  for (const lot of lots) {
    const gen = lot.generation?.codeGeneration ?? lot.generation ?? '?'
    if (!parGeneration[gen]) parGeneration[gen] = { nb: 0, kg: 0 }
    const kg = parseFloat(lot.quantiteNette ?? 0) || 0
    parGeneration[gen].nb++
    parGeneration[gen].kg += kg
    totalKg += kg
    if (lot.idVariete) varIds.add(Number(lot.idVariete))
    const rend = parseFloat(lot.rendementKgHa ?? 0) || 0
    if (rend > 0) { rendementSum += rend; rendementCount++ }
    if (lot.statutEdition === 'CONFIRME') nbConfirmes++
  }

  return {
    nbLots: lots.length,
    totalKg,
    nbVarietes: varIds.size,
    rendementMoyen: rendementCount > 0 ? Math.round(rendementSum / rendementCount) : null,
    nbConfirmes,
    parGeneration,
  }
}

/* ── Carte métrique ── */
function MetricRow({
  label, valA, valB, highlight,
}: {
  label: string
  valA: string
  valB: string
  highlight?: 'A' | 'B' | 'equal' | null
}) {
  const boldA = highlight === 'A' ? 700 : 500
  const boldB = highlight === 'B' ? 700 : 500
  const clrA  = highlight === 'A' ? '#15803d' : highlight === 'B' ? '#b91c1c' : 'var(--text-primary)'
  const clrB  = highlight === 'B' ? '#15803d' : highlight === 'A' ? '#b91c1c' : 'var(--text-primary)'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', gap: 8,
      padding: '9px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 13, fontWeight: boldA, color: clrA, textAlign: 'right' }}>{valA}</span>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'center', minWidth: 120 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: boldB, color: clrB }}>{valB}</span>
    </div>
  )
}

/* ── Barre de génération ── */
function GenBar({ gen, nbA, kgA, nbB, kgB, maxKg }: {
  gen: string; nbA: number; kgA: number; nbB: number; kgB: number; maxKg: number
}) {
  const color = GEN_COLOR[gen] ?? '#94a3b8'
  const wA = maxKg > 0 ? Math.min(100, (kgA / maxKg) * 100) : 0
  const wB = maxKg > 0 ? Math.min(100, (kgB / maxKg) * 100) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      {/* Barre A — alignée à droite */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 50, textAlign: 'right' }}>
          {nbA > 0 ? `${nbA} lot${nbA > 1 ? 's' : ''}` : '—'}
        </span>
        <div style={{ width: 90, height: 10, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${wA}%`, background: color,
            marginLeft: `${100 - wA}%`,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Label génération */}
      <span style={{
        fontSize: 10, fontWeight: 700, color: color,
        background: `${color}18`, border: `1px solid ${color}44`,
        borderRadius: 99, padding: '1px 7px', textAlign: 'center', minWidth: 32,
      }}>{gen}</span>

      {/* Barre B — alignée à gauche */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 90, height: 10, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${wB}%`, background: color,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 50 }}>
          {nbB > 0 ? `${nbB} lot${nbB > 1 ? 's' : ''}` : '—'}
        </span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════ */
interface Props { lang?: 'fr' | 'en' }

export function CampagneComparison({ lang = 'fr' }: Props) {
  const [campagnes,  setCampagnes]  = useState<Campagne[]>([])
  const [lots,       setLots]       = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selA, setSelA] = useState<number | ''>('')
  const [selB, setSelB] = useState<number | ''>('')

  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    const [cR, lR] = await Promise.allSettled([
      api.get(endpoints.campagnes),
      api.get(endpoints.lots),
    ])
    const campList: Campagne[] = extractList(cR.status === 'fulfilled' ? cR.value.data : null)
      .sort((a: Campagne, b: Campagne) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''))
    const lotList = extractList(lR.status === 'fulfilled' ? lR.value.data : null).map(normalizeLot)

    setCampagnes(campList)
    setLots(lotList)

    // Présélection : 2 campagnes les plus récentes
    if (!isRefresh && campList.length >= 2) {
      setSelA(campList[0]?.id ?? '')
      setSelB(campList[1]?.id ?? '')
    }

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchData() }, [])

  /* ── Calculs ── */
  const lotsA = selA !== '' ? lots.filter(l => Number(l.idCampagne) === selA) : []
  const lotsB = selB !== '' ? lots.filter(l => Number(l.idCampagne) === selB) : []
  const statsA = computeStats(lotsA)
  const statsB = computeStats(lotsB)

  const campA = campagnes.find(c => c.id === selA)
  const campB = campagnes.find(c => c.id === selB)

  const gens = GEN_ORDER.filter(g =>
    (statsA.parGeneration[g]?.nb ?? 0) > 0 || (statsB.parGeneration[g]?.nb ?? 0) > 0
  )
  const maxKg = Math.max(
    ...GEN_ORDER.map(g => Math.max(statsA.parGeneration[g]?.kg ?? 0, statsB.parGeneration[g]?.kg ?? 0)),
    1
  )

  function highlight(a: number, b: number): 'A' | 'B' | 'equal' | null {
    if (a === 0 && b === 0) return null
    if (a > b) return 'A'
    if (b > a) return 'B'
    return 'equal'
  }

  const title    = lang === 'en' ? 'Campaign Comparison' : 'Comparaison inter-campagnes'
  const subtitle = lang === 'en'
    ? 'Select two campaigns to compare their production metrics side by side'
    : 'Sélectionnez deux campagnes pour comparer leurs métriques de production'
  const labelA   = lang === 'en' ? 'Campaign A' : 'Campagne A'
  const labelB   = lang === 'en' ? 'Campaign B' : 'Campagne B'
  const noData   = lang === 'en' ? 'No lots recorded for this campaign' : 'Aucun lot enregistré pour cette campagne'

  const pctConfirmesA = statsA.nbLots > 0 ? Math.round((statsA.nbConfirmes / statsA.nbLots) * 100) : 0
  const pctConfirmesB = statsB.nbLots > 0 ? Math.round((statsB.nbConfirmes / statsB.nbLots) * 100) : 0

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      marginBottom: 20,
    }}>
      {/* ── En-tête ── */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(135deg,var(--surface-2) 0%,#fff 100%)',
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: '#eff6ff', color: '#1d4ed8',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <BarChart2 size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 7, cursor: refreshing ? 'default' : 'pointer',
            border: '1px solid #bfdbfe', background: '#eff6ff',
            fontSize: 11, fontWeight: 600, color: '#1d4ed8',
            opacity: refreshing ? 0.6 : 1, flexShrink: 0,
          }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {lang === 'en' ? 'Refresh' : 'Actualiser'}
        </button>
      </div>

      <div style={{ padding: '18px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 12 }}>
            {lang === 'en' ? 'Loading campaigns…' : 'Chargement des campagnes…'}
          </div>
        ) : campagnes.length < 2 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
            {lang === 'en'
              ? 'At least 2 campaigns are required to compare.'
              : 'Au moins 2 campagnes sont nécessaires pour comparer.'}
          </div>
        ) : (
          <>
            {/* ── Sélecteurs ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center', gap: 12, marginBottom: 20,
            }}>
              {/* Sélect A */}
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {labelA}
                </label>
                <select
                  value={selA}
                  onChange={e => setSelA(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 8,
                    border: '1px solid var(--border)', fontSize: 12.5,
                    background: '#fff', color: 'var(--text-primary)',
                    appearance: 'none', cursor: 'pointer',
                  }}
                >
                  {campagnes.map(c => (
                    <option key={c.id} value={c.id} disabled={c.id === selB}>
                      {campagneLabel(c)} — {STATUT_LABEL[c.statut] ?? c.statut}
                    </option>
                  ))}
                </select>
              </div>

              {/* Versus */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#f1f5f9', border: '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: 'var(--text-muted)',
                flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2,
              }}>
                VS
              </div>

              {/* Sélect B */}
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {labelB}
                </label>
                <select
                  value={selB}
                  onChange={e => setSelB(Number(e.target.value))}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 8,
                    border: '1px solid var(--border)', fontSize: 12.5,
                    background: '#fff', color: 'var(--text-primary)',
                    appearance: 'none', cursor: 'pointer',
                  }}
                >
                  {campagnes.map(c => (
                    <option key={c.id} value={c.id} disabled={c.id === selA}>
                      {campagneLabel(c)} — {STATUT_LABEL[c.statut] ?? c.statut}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selA !== '' && selB !== '' && campA && campB && (
              <>
                {/* ── Badges campagnes ── */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center', gap: 8, marginBottom: 16,
                }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: STATUT_BG[campA.statut] ?? '#f9fafb',
                    border: `1px solid ${STATUT_COLOR[campA.statut] ?? '#e5e7eb'}44`,
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {campagneLabel(campA)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: STATUT_COLOR[campA.statut] ?? '#6b7280' }}>
                        ● {STATUT_LABEL[campA.statut] ?? campA.statut}
                      </span>
                      {campA.dateDebut && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {campA.dateDebut.slice(0, 7)} → {campA.dateFin?.slice(0, 7) ?? '…'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ width: 8 }} />

                  <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: STATUT_BG[campB.statut] ?? '#f9fafb',
                    border: `1px solid ${STATUT_COLOR[campB.statut] ?? '#e5e7eb'}44`,
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {campagneLabel(campB)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: STATUT_COLOR[campB.statut] ?? '#6b7280' }}>
                        ● {STATUT_LABEL[campB.statut] ?? campB.statut}
                      </span>
                      {campB.dateDebut && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {campB.dateDebut.slice(0, 7)} → {campB.dateFin?.slice(0, 7) ?? '…'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Métriques globales ── */}
                {(lotsA.length === 0 && lotsB.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 11.5 }}>
                    {noData}
                  </div>
                ) : (
                  <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '4px 16px', marginBottom: 16 }}>
                    <MetricRow
                      label={lang === 'en' ? 'Total lots' : 'Lots produits'}
                      valA={statsA.nbLots > 0 ? String(statsA.nbLots) : '—'}
                      valB={statsB.nbLots > 0 ? String(statsB.nbLots) : '—'}
                      highlight={highlight(statsA.nbLots, statsB.nbLots)}
                    />
                    <MetricRow
                      label={lang === 'en' ? 'Volume produced' : 'Volume produit'}
                      valA={statsA.totalKg > 0 ? fmtKg(statsA.totalKg) : '—'}
                      valB={statsB.totalKg > 0 ? fmtKg(statsB.totalKg) : '—'}
                      highlight={highlight(statsA.totalKg, statsB.totalKg)}
                    />
                    <MetricRow
                      label={lang === 'en' ? 'Varieties' : 'Variétés impliquées'}
                      valA={statsA.nbVarietes > 0 ? String(statsA.nbVarietes) : '—'}
                      valB={statsB.nbVarietes > 0 ? String(statsB.nbVarietes) : '—'}
                      highlight={highlight(statsA.nbVarietes, statsB.nbVarietes)}
                    />
                    {(statsA.rendementMoyen !== null || statsB.rendementMoyen !== null) && (
                      <MetricRow
                        label={lang === 'en' ? 'Avg yield (kg/ha)' : 'Rendement moy. (kg/ha)'}
                        valA={statsA.rendementMoyen !== null ? `${statsA.rendementMoyen} kg/ha` : '—'}
                        valB={statsB.rendementMoyen !== null ? `${statsB.rendementMoyen} kg/ha` : '—'}
                        highlight={highlight(statsA.rendementMoyen ?? 0, statsB.rendementMoyen ?? 0)}
                      />
                    )}
                    <MetricRow
                      label={lang === 'en' ? 'Confirmed lots' : 'Lots confirmés'}
                      valA={statsA.nbLots > 0 ? `${statsA.nbConfirmes} (${pctConfirmesA} %)` : '—'}
                      valB={statsB.nbLots > 0 ? `${statsB.nbConfirmes} (${pctConfirmesB} %)` : '—'}
                      highlight={highlight(pctConfirmesA, pctConfirmesB)}
                    />
                  </div>
                )}

                {/* ── Répartition par génération ── */}
                {gens.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      {lang === 'en' ? 'Distribution by generation' : 'Répartition par génération'}
                    </div>
                    {gens.map(gen => (
                      <GenBar
                        key={gen}
                        gen={gen}
                        nbA={statsA.parGeneration[gen]?.nb ?? 0}
                        kgA={statsA.parGeneration[gen]?.kg ?? 0}
                        nbB={statsB.parGeneration[gen]?.nb ?? 0}
                        kgB={statsB.parGeneration[gen]?.kg ?? 0}
                        maxKg={maxKg}
                      />
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', marginTop: 6 }}>
                      <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        ← {campagneLabel(campA)}
                      </div>
                      <div style={{ width: 50 }} />
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {campagneLabel(campB)} →
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
