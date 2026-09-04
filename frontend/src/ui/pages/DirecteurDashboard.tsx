import React, { useEffect, useRef, useState } from 'react'
import {
  Package, TrendingUp, CheckCircle2, AlertTriangle, Layers, Wheat,
  ArrowRight, Lock, RefreshCw, AlertCircle, Info, ShieldCheck,
  Activity, BarChart3, Clock,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { extractList, normalizeLot, normalizeVariete } from '../../lib/normalizers'

// ── Constantes génération ──────────────────────────────────────────
const GEN_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2']
const GEN_LABEL: Record<string, string> = {
  G0: 'Souche', G1: 'Pré-base', G2: 'Base', G3: 'Certifiée C1',
  G4: 'Certifiée C2', R1: 'Certifiée R1', R2: 'Commerciale',
}
const GEN_COLOR: Record<string, string> = {
  G0: '#7c3aed', G1: '#0369a1', G2: '#0f766e', G3: '#15803d',
  G4: '#d97706', R1: '#c2410c', R2: '#9333ea',
}
const GEN_BG: Record<string, string> = {
  G0: '#f5f3ff', G1: '#e0f2fe', G2: '#f0fdfa', G3: '#f0fdf4',
  G4: '#fffbeb', R1: '#fff7ed', R2: '#fdf4ff',
}

// ── Helpers ───────────────────────────────────────────────────────
function kgLabel(kg: number) {
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(1)} t`
  if (kg >= 1_000)     return `${(kg / 1_000).toFixed(1)} t`
  return `${kg.toLocaleString('fr-FR')} kg`
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'à l\'instant'
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`
  return `il y a ${Math.floor(seconds / 3600)} h`
}

// ── Hook : compteur animé ─────────────────────────────────────────
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (target === prev.current) return
    const from = prev.current
    prev.current = target
    if (target === 0) { setValue(0); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return value
}

// ── Types ──────────────────────────────────────────────────────────
interface GenStat { gen: string; count: number; totalKg: number }
interface LotBrief {
  id: number; codeLot: string; idVariete: number; codeEspece?: string
  statutCertification?: string; statutEdition?: string
  generation?: { codeGeneration: string }
}

// ══════════════════════════════════════════════════════════════════
export function DirecteurDashboard() {
  const [genStats,  setGenStats]  = useState<GenStat[]>([])
  const [lots,      setLots]      = useState<LotBrief[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    Promise.allSettled([
      api.get(endpoints.lotsStats),
      api.get(endpoints.lots),
      api.get(endpoints.varieties),
    ]).then(([statsRes, lotsRes, varRes]) => {
      if (statsRes.status === 'fulfilled') {
        setGenStats((statsRes.value.data ?? []).map((d: any) => ({
          gen: d.generation ?? d[0],
          count: Number(d.nbLots ?? d[1] ?? 0),
          totalKg: Number(d.totalKg ?? d[2] ?? 0),
        })))
      }
      if (lotsRes.status === 'fulfilled') setLots(extractList(lotsRes.value.data).map(normalizeLot))
      if (varRes.status === 'fulfilled')  setVarieties(extractList(varRes.value.data).map(normalizeVariete))
      setLastFetch(new Date())
    }).finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { fetchAll() }, [])

  // ── Métriques dérivées ────────────────────────────────────────
  const totalLots  = genStats.reduce((s, g) => s + g.count, 0)
  const totalKg    = genStats.reduce((s, g) => s + g.totalKg, 0)
  const certifies  = lots.filter(l => l.statutCertification === 'CERTIFIE').length
  const enAttente  = lots.filter(l => l.statutCertification === 'EN_ATTENTE').length
  const rejetes    = lots.filter(l => l.statutCertification === 'REJETE').length
  const sansCertif = lots.filter(l => !l.statutCertification || l.statutCertification === 'SANS_CERTIFICAT').length
  const confirmes  = lots.filter(l => l.statutEdition === 'CONFIRME').length
  const brouillons = lots.filter(l => l.statutEdition !== 'CONFIRME').length

  const orderedStats = GEN_ORDER.map(g => genStats.find(s => s.gen === g) ?? { gen: g, count: 0, totalKg: 0 })
  const maxCount = Math.max(...orderedStats.map(s => s.count), 1)

  const generationActive = orderedStats.reduce(
    (a, g) => g.count > (orderedStats.find(x => x.gen === a)?.count ?? 0) ? g.gen : a, 'G0'
  )

  // Ruptures dans le pipeline (gen intermédiaire vide, voisins actifs)
  const pipelineGaps = orderedStats.filter((s, i) =>
    s.count === 0 && i > 0 && i < orderedStats.length - 1 &&
    (orderedStats[i - 1].count > 0 || orderedStats[i + 1].count > 0)
  )

  // Variétés top 6 par nombre de lots
  const varMap = Object.fromEntries(varieties.map((v: any) => [v.id, v]))
  const countByVariete: Record<number, { nomVariete: string; codeEspece: string; count: number }> = {}
  lots.forEach(l => {
    if (!l.idVariete) return
    const v = varMap[l.idVariete]
    if (!countByVariete[l.idVariete])
      countByVariete[l.idVariete] = { nomVariete: v?.nomVariete ?? `#${l.idVariete}`, codeEspece: v?.espece?.codeEspece ?? l.codeEspece ?? '—', count: 0 }
    countByVariete[l.idVariete].count++
  })
  const topVarietes = Object.values(countByVariete).sort((a, b) => b.count - a.count).slice(0, 6)

  // ── Alertes décisionnelles ────────────────────────────────────
  const alerts: { level: 'critical' | 'warning' | 'info'; message: string }[] = []
  if (pipelineGaps.length > 0)
    alerts.push({ level: 'critical', message: `Rupture de pipeline détectée — ${pipelineGaps.map(g => g.gen).join(', ')} sans lots actifs cette campagne` })
  if (enAttente > 0)
    alerts.push({ level: 'warning', message: `${enAttente} lot${enAttente > 1 ? 's' : ''} en attente de certification — action UPSemCL requise` })
  if (rejetes > 0)
    alerts.push({ level: 'warning', message: `${rejetes} lot${rejetes > 1 ? 's' : ''} rejeté${rejetes > 1 ? 's' : ''} à la certification — vérification nécessaire` })
  if (brouillons > 0 && totalLots > 0)
    alerts.push({ level: 'info', message: `${brouillons} lot${brouillons > 1 ? 's' : ''} en brouillon — non verrouillé${brouillons > 1 ? 's' : ''}, modifiable${brouillons > 1 ? 's' : ''}` })

  // ── Loading ───────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: 320, color: 'var(--text-muted)' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13 }}>Chargement du tableau de bord…</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── En-tête avec horodatage & refresh ─────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastFetch && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} />
              Données actualisées {timeAgo(lastFetch)}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 12, cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.6 : 1, transition: 'all .15s' }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* ── Bannière d'alertes décisionnelles ─────────────────── */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => (
            <AlertBanner key={i} level={a.level} message={a.message} />
          ))}
        </div>
      )}

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
        <KpiCard
          icon={<Package size={15} />} label="Lots enregistrés"
          value={totalLots} color="#1d4ed8"
          status={totalLots === 0 ? 'neutral' : 'good'}
        />
        <KpiCard
          icon={<Wheat size={15} />} label="Production totale"
          value={kgLabel(totalKg)} rawValue={totalKg} color="#15803d"
          status={totalKg === 0 ? 'neutral' : 'good'}
        />
        <KpiCard
          icon={<CheckCircle2 size={15} />} label="Lots certifiés"
          value={certifies} color="#0f766e"
          sub={enAttente > 0 ? `${enAttente} en attente` : undefined}
          status={certifies === 0 && totalLots > 0 ? 'warning' : certifies > 0 ? 'good' : 'neutral'}
        />
        <KpiCard
          icon={<Lock size={15} />} label="Lots verrouillés"
          value={confirmes} color="#0369a1"
          sub={brouillons > 0 ? `${brouillons} en brouillon` : undefined}
          status={confirmes === 0 && totalLots > 0 ? 'warning' : confirmes > 0 ? 'good' : 'neutral'}
        />
        <KpiCard
          icon={<AlertTriangle size={15} />} label="En attente certif."
          value={enAttente} color="#d97706"
          status={enAttente > 0 ? 'warning' : 'neutral'}
        />
        <KpiCard
          icon={<Activity size={15} />} label="Génération active"
          value={totalLots > 0 ? generationActive : '—'} color={GEN_COLOR[generationActive] ?? '#6b7280'}
          status={totalLots > 0 ? 'good' : 'neutral'}
          isText
        />
      </div>

      {/* ── Pipeline G0 → R2 ──────────────────────────────────── */}
      <PipelineSection stats={orderedStats} maxCount={maxCount} lots={lots} />

      {/* ── Certifications + Édition ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Section title="Certifications" sub="Répartition par statut" icon={<ShieldCheck size={14} />}>
          {lots.length === 0 ? (
            <EmptyState message="Aucun lot enregistré" />
          ) : (
            <>
              <ProgressRow label="CERTIFIÉ"     count={certifies}  total={lots.length} color="#16a34a" />
              <ProgressRow label="EN ATTENTE"   count={enAttente}  total={lots.length} color="#d97706" />
              <ProgressRow label="REJETÉ"       count={rejetes}    total={lots.length} color="#dc2626" />
              <ProgressRow label="SANS CERTIF." count={sansCertif} total={lots.length} color="#9ca3af" />
            </>
          )}
        </Section>

        <Section title="Politique d'édition" sub="Verrouillage des lots" icon={<Lock size={14} />}>
          {lots.length === 0 ? (
            <EmptyState message="Aucun lot enregistré" />
          ) : (
            <>
              <ProgressRow label="CONFIRMÉS"  count={confirmes}  total={lots.length} color="#0369a1" />
              <ProgressRow label="BROUILLONS" count={brouillons} total={lots.length} color="#9333ea" />
              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 7, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, borderLeft: '3px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>BROUILLON</strong> — modifiable · auto-lock à 30 jours<br />
                <strong style={{ color: 'var(--text-primary)' }}>CONFIRMÉ</strong> — verrouillé, données définitives
              </div>
            </>
          )}
        </Section>
      </div>

      {/* ── Top variétés + Matrice ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Section title="Variétés en production" sub="Top 6 par nombre de lots" icon={<BarChart3 size={14} />}>
          {topVarietes.length === 0
            ? <EmptyState message="Aucune donnée de variété" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topVarietes.map((v, idx) => (
                  <VarieteRow key={idx} rank={idx + 1} name={v.nomVariete} espece={v.codeEspece} count={v.count} max={topVarietes[0].count} />
                ))}
              </div>
            )}
        </Section>

        <Section title="Répartition espèces × génération" sub="Nombre de lots par espèce" icon={<Layers size={14} />}>
          <EspecesTable lots={lots} varieties={varieties} />
        </Section>
      </div>

    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ── Sous-composants ───────────────────────────────────────────────

function AlertBanner({ level, message }: { level: 'critical' | 'warning' | 'info'; message: string }) {
  const cfg = {
    critical: { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', icon: <AlertCircle size={14} />, label: 'Critique' },
    warning:  { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', icon: <AlertTriangle size={14} />, label: 'Attention' },
    info:     { bg: '#eff6ff', border: '#93c5fd', color: '#1e40af', icon: <Info size={14} />, label: 'Info' },
  }[level]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>
        <strong style={{ fontWeight: 700 }}>{cfg.label} — </strong>{message}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, color, sub, status, isText }: {
  icon: React.ReactNode; label: string; value: string | number; color: string
  sub?: string; status: 'good' | 'warning' | 'neutral'; isText?: boolean
}) {
  const animated = useCountUp(typeof value === 'number' ? value : 0, 900)
  const displayed = isText ? value : typeof value === 'number' ? animated : value
  const statusColor = status === 'good' ? '#16a34a' : status === 'warning' ? '#d97706' : 'var(--border)'
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderTop: `3px solid ${statusColor}`,
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: 'var(--shadow-xs)', transition: 'box-shadow .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: `${color}18`, color }}>{icon}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', lineHeight: 1.2 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {displayed}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: status === 'warning' ? '#d97706' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {status === 'warning' && <AlertTriangle size={10} />}
          {sub}
        </div>
      )}
    </div>
  )
}

function PipelineSection({ stats, maxCount, lots }: { stats: GenStat[]; maxCount: number; lots: LotBrief[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            <TrendingUp size={14} />
            Pipeline semencier
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Volume de lots actifs par génération</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} />Actif</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#dc2626', display: 'inline-block', opacity: 0.5 }} />Rupture</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
        {stats.map((stat, i) => {
          const barH = Math.max(6, (stat.count / maxCount) * 100)
          const color = GEN_COLOR[stat.gen] ?? '#6b7280'
          const bg    = GEN_BG[stat.gen] ?? '#f9fafb'
          const isEmpty = stat.count === 0
          const isGap = isEmpty && i > 0 && i < stats.length - 1 &&
            (stats[i - 1].count > 0 || stats[i + 1].count > 0)
          const isActive = hovered === stat.gen

          return (
            <React.Fragment key={stat.gen}>
              <div
                onMouseEnter={() => setHovered(stat.gen)}
                onMouseLeave={() => setHovered(null)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minWidth: 72, cursor: 'default', padding: '0 4px' }}
              >
                {/* Barre */}
                <div style={{ width: '100%', position: 'relative', height: 110, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  {/* Tooltip hover */}
                  {isActive && stat.totalKg > 0 && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                      background: '#1e293b', color: '#fff', fontSize: 11, padding: '4px 8px',
                      borderRadius: 5, whiteSpace: 'nowrap', marginBottom: 4, zIndex: 10,
                      boxShadow: '0 2px 8px rgba(0,0,0,.2)',
                    }}>
                      {kgLabel(stat.totalKg)}
                    </div>
                  )}
                  <div style={{
                    width: '100%', background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden',
                    border: isGap ? '1.5px dashed #dc2626' : `1px solid ${isEmpty ? 'var(--border)' : color + '44'}`,
                    height: '100%', display: 'flex', alignItems: 'flex-end',
                    transition: 'transform .15s',
                    transform: isActive ? 'scaleX(1.04)' : 'scaleX(1)',
                  }}>
                    <div style={{
                      width: '100%', height: `${barH}px`,
                      background: isGap ? '#dc262618' : isEmpty ? 'transparent' : color,
                      opacity: isEmpty ? 0.3 : isActive ? 1 : 0.85,
                      borderRadius: '0 0 4px 4px',
                      transition: 'height .5s cubic-bezier(.4,0,.2,1), opacity .2s',
                    }} />
                  </div>
                </div>

                {/* Code génération */}
                <div style={{ fontSize: 13, fontWeight: 800, color: isEmpty ? 'var(--text-muted)' : color, letterSpacing: '.04em' }}>{stat.gen}</div>

                {/* Compteur */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isEmpty ? 'var(--text-muted)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {stat.count}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>lot{stat.count !== 1 ? 's' : ''}</div>
                </div>

                {/* Badge catégorie */}
                <div style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap',
                  background: isEmpty ? 'var(--surface-2)' : bg,
                  color: isEmpty ? 'var(--text-muted)' : color,
                  border: `1px solid ${isEmpty ? 'var(--border)' : color + '33'}`,
                }}>
                  {GEN_LABEL[stat.gen]}
                </div>
              </div>

              {i < stats.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 48, color: 'var(--text-muted)', opacity: 0.35, flexShrink: 0 }}>
                  <ArrowRight size={13} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

function Section({ title, sub, icon, children }: { title: string; sub: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          {icon && <span style={{ color: 'var(--text-muted)' }}>{icon}</span>}
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
      {children}
    </div>
  )
}

function ProgressRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  const animated = useCountUp(count, 700)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ width: 90, fontSize: 10.5, fontWeight: 700, color, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <div style={{ width: 66, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {animated} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 10 }}>({pct.toFixed(0)}%)</span>
      </div>
    </div>
  )
}

function VarieteRow({ rank, name, espece, count, max }: { rank: number; name: string; espece: string; count: number; max: number }) {
  const rankColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : rank === 3 ? '#b45309' : 'var(--text-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: 5, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: rankColor, flexShrink: 0 }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>{espece}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#15803d', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{count} lot{count !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: '#15803d', borderRadius: 3, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 0', color: 'var(--text-muted)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Package size={16} style={{ opacity: 0.4 }} />
      </div>
      <span style={{ fontSize: 12.5 }}>{message}</span>
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
  const especes  = Object.keys(matrix).sort()
  const genList  = GEN_ORDER.filter(g => gens.has(g))

  if (especes.length === 0) return <EmptyState message="Aucune donnée disponible" />

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px 6px 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10.5, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>Espèce</th>
            {genList.map(g => (
              <th key={g} style={{ textAlign: 'center', padding: '6px 8px', color: GEN_COLOR[g] ?? 'var(--text-muted)', fontWeight: 800, fontSize: 10.5, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>{g}</th>
            ))}
            <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10.5, borderBottom: '2px solid var(--border)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {especes.map(esp => {
            const total = Object.values(matrix[esp]).reduce((s, n) => s + n, 0)
            return (
              <tr key={esp} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 8px 8px 0', fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{esp}</td>
                {genList.map(g => (
                  <td key={g} style={{ textAlign: 'center', padding: '8px', fontVariantNumeric: 'tabular-nums' }}>
                    {matrix[esp][g]
                      ? <span style={{ fontWeight: 700, color: GEN_COLOR[g], background: GEN_BG[g], padding: '2px 7px', borderRadius: 5, fontSize: 11 }}>{matrix[esp][g]}</span>
                      : <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>}
                  </td>
                ))}
                <td style={{ textAlign: 'center', padding: '8px', fontWeight: 800, fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
