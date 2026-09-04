import React, { useEffect, useState } from 'react'
import { Package, TrendingUp, CheckCircle2, Clock, AlertTriangle, Layers, Wheat, ArrowRight, Lock } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { extractList, normalizeLot, normalizeVariete } from '../../lib/normalizers'

// ── Helpers ──────────────────────────────────────────────────────
const GEN_ORDER = ['G0','G1','G2','G3','G4','R1','R2']
const GEN_COLOR: Record<string, string> = {
  G0: '#7c3aed', G1: '#0369a1', G2: '#0f766e', G3: '#15803d',
  G4: '#d97706', R1: '#c2410c', R2: '#9333ea',
}
const GEN_BG: Record<string, string> = {
  G0: '#f5f3ff', G1: '#e0f2fe', G2: '#f0fdfa', G3: '#f0fdf4',
  G4: '#fffbeb', R1: '#fff7ed', R2: '#fdf4ff',
}

function kgLabel(kg: number) {
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(1)} t`
  if (kg >= 1_000)     return `${(kg / 1_000).toFixed(1)} t`
  return `${kg.toLocaleString('fr-FR')} kg`
}

interface GenStat { gen: string; count: number; totalKg: number }
interface LotBrief { id: number; codeLot: string; idVariete: number; codeEspece?: string; statutCertification?: string; statutEdition?: string; generation?: { codeGeneration: string } }

export function DirecteurDashboard() {
  const [genStats,   setGenStats]   = useState<GenStat[]>([])
  const [lots,       setLots]       = useState<LotBrief[]>([])
  const [varieties,  setVarieties]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    Promise.allSettled([
      api.get(endpoints.lotsStats),
      api.get(endpoints.lots),
      api.get(endpoints.varieties),
    ]).then(([statsRes, lotsRes, varRes]) => {
      if (statsRes.status === 'fulfilled') {
        const rows: GenStat[] = (statsRes.value.data ?? []).map((d: any) => ({
          gen: d.generation ?? d[0], count: Number(d.nbLots ?? d[1] ?? 0), totalKg: Number(d.totalKg ?? d[2] ?? 0),
        }))
        setGenStats(rows)
      }
      if (lotsRes.status === 'fulfilled') {
        setLots(extractList(lotsRes.value.data).map(normalizeLot))
      }
      if (varRes.status === 'fulfilled') {
        setVarieties(extractList(varRes.value.data).map(normalizeVariete))
      }
    }).finally(() => setLoading(false))
  }, [])

  // ── Calculs dérivés ──────────────────────────────────────────
  const totalLots   = genStats.reduce((s, g) => s + g.count, 0)
  const totalKg     = genStats.reduce((s, g) => s + g.totalKg, 0)
  const certifies   = lots.filter(l => l.statutCertification === 'CERTIFIE').length
  const enAttente   = lots.filter(l => l.statutCertification === 'EN_ATTENTE').length
  const confirmes   = lots.filter(l => l.statutEdition === 'CONFIRME').length
  const brouillons  = lots.filter(l => l.statutEdition !== 'CONFIRME').length

  // Variétés les plus produites
  const varMap = Object.fromEntries(varieties.map((v: any) => [v.id, v]))
  const kgByVariete: Record<number, { nomVariete: string; codeEspece: string; totalKg: number; count: number }> = {}
  lots.forEach(l => {
    if (!l.idVariete) return
    const v = varMap[l.idVariete]
    if (!kgByVariete[l.idVariete]) kgByVariete[l.idVariete] = { nomVariete: v?.nomVariete ?? `#${l.idVariete}`, codeEspece: v?.espece?.codeEspece ?? l.codeEspece ?? '—', totalKg: 0, count: 0 }
    const gen = l.generation?.codeGeneration
    const stat = genStats.find(g => g.gen === gen)
    kgByVariete[l.idVariete].totalKg += stat ? stat.totalKg / Math.max(1, stat.count) : 0
    kgByVariete[l.idVariete].count++
  })
  const topVarietes = Object.values(kgByVariete).sort((a, b) => b.count - a.count).slice(0, 6)

  // Ordonnancement pour la barre pipeline
  const orderedStats = GEN_ORDER.map(g => genStats.find(s => s.gen === g) ?? { gen: g, count: 0, totalKg: 0 })
  const maxCount = Math.max(...orderedStats.map(s => s.count), 1)

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14, gap: 10 }}>
        <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Chargement du tableau de bord…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KpiCard icon={<Package size={16} />} label="Lots enregistrés" value={totalLots} color="#7c3aed" />
        <KpiCard icon={<Wheat size={16} />} label="Production totale" value={kgLabel(totalKg)} color="#15803d" />
        <KpiCard icon={<CheckCircle2 size={16} />} label="Lots certifiés" value={certifies} color="#0f766e" sub={`${enAttente} en attente`} />
        <KpiCard icon={<Lock size={16} />} label="Lots verrouillés" value={confirmes} color="#0369a1" sub={`${brouillons} en brouillon`} />
        <KpiCard icon={<AlertTriangle size={16} />} label="En attente certif." value={enAttente} color="#d97706" />
        <KpiCard icon={<Layers size={16} />} label="Génération active" value={orderedStats.reduce((a, g) => g.count > (orderedStats.find(x => x.gen === a)?.count ?? 0) ? g.gen : a, 'G0')} color="#c2410c" />
      </div>

      {/* ── Pipeline G0 → R2 ─────────────────────────────────── */}
      <Section title="Pipeline semencier" sub="Volume de lots actifs par génération">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, overflowX: 'auto' }}>
          {orderedStats.map((stat, i) => {
            const barH = Math.max(8, (stat.count / maxCount) * 80)
            const color = GEN_COLOR[stat.gen] ?? '#6b7280'
            const bg    = GEN_BG[stat.gen] ?? '#f9fafb'
            return (
              <React.Fragment key={stat.gen}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 72 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '.05em' }}>{stat.gen}</div>
                  <div style={{ width: '100%', background: 'var(--surface-2)', borderRadius: 6, height: 90, display: 'flex', alignItems: 'flex-end', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ width: '100%', height: `${barH}px`, background: color, opacity: stat.count === 0 ? 0.15 : 1, borderRadius: '0 0 5px 5px', transition: 'height .4s ease' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: stat.count === 0 ? 'var(--text-muted)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{stat.count}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>lot{stat.count !== 1 ? 's' : ''}</div>
                    {stat.totalKg > 0 && <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>{kgLabel(stat.totalKg)}</div>}
                  </div>
                  <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: bg, color, border: `1px solid ${color}33`, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {stat.gen === 'G0' ? 'Souche' : stat.gen === 'G1' ? 'Pre-base' : stat.gen === 'G2' ? 'Base' : stat.gen === 'G3' ? 'Certifiée C1' : stat.gen === 'G4' ? 'Certifiée C2' : stat.gen === 'R1' ? 'Certifiée R1' : 'Commerciale'}
                  </div>
                </div>
                {i < orderedStats.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40, color: 'var(--text-muted)', opacity: 0.4 }}>
                    <ArrowRight size={14} />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </Section>

      {/* ── Certifications + Édition ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Certification */}
        <Section title="Certifications" sub="Statut des lots G4/R1/R2">
          {[
            { label: 'CERTIFIÉ',     count: certifies,                                                  color: '#16a34a', bg: '#f0fdf4' },
            { label: 'EN ATTENTE',   count: enAttente,                                                  color: '#d97706', bg: '#fffbeb' },
            { label: 'REJETÉ',       count: lots.filter(l => l.statutCertification === 'REJETE').length, color: '#dc2626', bg: '#fef2f2' },
            { label: 'SANS CERTIF.', count: lots.filter(l => !l.statutCertification || l.statutCertification === 'SANS_CERTIFICAT').length, color: '#6b7280', bg: '#f9fafb' },
          ].map(row => (
            <ProgressRow key={row.label} label={row.label} count={row.count} total={lots.length} color={row.color} bg={row.bg} />
          ))}
        </Section>

        {/* Politique édition */}
        <Section title="Politique d'édition" sub="Statut de verrouillage des lots">
          {[
            { label: 'CONFIRMÉS',  count: confirmes,  color: '#0369a1', bg: '#e0f2fe' },
            { label: 'BROUILLONS', count: brouillons, color: '#9333ea', bg: '#fdf4ff' },
          ].map(row => (
            <ProgressRow key={row.label} label={row.label} count={row.count} total={lots.length} color={row.color} bg={row.bg} />
          ))}
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Les lots en <strong>BROUILLON</strong> peuvent encore être modifiés par leur créateur.<br />
            Les lots <strong>CONFIRMÉS</strong> sont verrouillés — données définitives.
          </div>
        </Section>
      </div>

      {/* ── Top variétés ─────────────────────────────────────── */}
      <Section title="Variétés en production" sub="Répartition des lots par variété (top 6)">
        {topVarietes.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>Aucune donnée de variété disponible.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topVarietes.map((v, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nomVariete}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>{v.codeEspece}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{v.count} lot{v.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(v.count / Math.max(...topVarietes.map(x => x.count), 1)) * 100}%`, background: '#15803d', borderRadius: 3, transition: 'width .4s ease' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Répartition par génération & espèce ─────────────── */}
      <Section title="Répartition espèces × génération" sub="Nombre de lots par espèce et génération">
        <EspecesTable lots={lots} varieties={varieties} />
      </Section>

    </div>
  )
}

// ── Sous-composants ──────────────────────────────────────────────

function KpiCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
      {children}
    </div>
  )
}

function ProgressRow({ label, count, total, color, bg }: { label: string; count: number; total: number; color: string; bg: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ width: 100, fontSize: 10.5, fontWeight: 700, color, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .5s ease' }} />
      </div>
      <div style={{ width: 60, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {count} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 10 }}>({pct.toFixed(0)}%)</span>
      </div>
    </div>
  )
}

function EspecesTable({ lots, varieties }: { lots: any[]; varieties: any[] }) {
  const varMap = Object.fromEntries(varieties.map((v: any) => [v.id, v]))
  // Regroupement espèce × génération
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

  if (especes.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucune donnée disponible.</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 10px 6px 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Espèce</th>
            {genList.map(g => (
              <th key={g} style={{ textAlign: 'center', padding: '6px 8px', color: GEN_COLOR[g] ?? 'var(--text-muted)', fontWeight: 700, fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{g}</th>
            ))}
            <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {especes.map(esp => {
            const total = Object.values(matrix[esp]).reduce((s, n) => s + n, 0)
            return (
              <tr key={esp} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px 8px 0', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{esp}</td>
                {genList.map(g => (
                  <td key={g} style={{ textAlign: 'center', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>
                    {matrix[esp][g]
                      ? <span style={{ fontWeight: 700, color: GEN_COLOR[g] }}>{matrix[esp][g]}</span>
                      : <span style={{ color: 'var(--border)' }}>—</span>}
                  </td>
                ))}
                <td style={{ textAlign: 'center', padding: '8px', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
