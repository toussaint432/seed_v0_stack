import { useEffect, useRef, useState } from 'react'
import {
  Package, TrendingUp, CheckCircle2, AlertTriangle, Layers, Wheat,
  ArrowRight, Lock, RefreshCw, AlertCircle, Info, ShieldCheck,
  Activity, BarChart3, Map, Clock,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { extractList, normalizeLot, normalizeVariete } from '../../lib/normalizers'
import { MapSemences } from '../components/MapSemences'
import { fmtT } from '../../lib/fmt'
import { TD as D } from '../../lib/tokens'
import { GEN_CHART_COLORS } from '../../lib/constants'

// ── Génération config ─────────────────────────────────────────────
const GEN_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2']
const GEN_LABELS: Record<string, string> = {
  G0: 'Souche', G1: 'Pré-base', G2: 'Base', G3: 'Certifiée C1',
  G4: 'Certifiée C2', R1: 'Certifiée R1', R2: 'Commerciale',
}
const GEN_CFG: Record<string, { bg: string; color: string }> = {
  G0: { bg: '#eef2ff', color: GEN_CHART_COLORS.G0 },
  G1: { bg: '#f0f9ff', color: GEN_CHART_COLORS.G1 },
  G2: { bg: '#f0fdf4', color: GEN_CHART_COLORS.G2 },
  G3: { bg: '#fffbeb', color: GEN_CHART_COLORS.G3 },
  G4: { bg: '#fff7ed', color: GEN_CHART_COLORS.G4 },
  R1: { bg: '#fdf2f8', color: GEN_CHART_COLORS.R1 },
  R2: { bg: '#f0fdfa', color: GEN_CHART_COLORS.R2 },
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

// ── Compteur animé — même pattern que Dashboard.tsx ───────────────
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
  const [ready,     setReady]     = useState(false)
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
        // ⚠ le DTO backend expose `codeGeneration`, pas `generation`
        setGenStats((statsRes.value.data ?? []).map((d: any) => ({
          gen:     d.codeGeneration ?? d.generation ?? String(d[0] ?? ''),
          count:   Number(d.nbLots   ?? d[1] ?? 0),
          totalKg: Number(d.totalKg  ?? d[2] ?? 0),
        })))
      }
      if (lotsRes.status === 'fulfilled') setLots(extractList(lotsRes.value.data).map(normalizeLot))
      if (varRes.status === 'fulfilled')  setVarieties(extractList(varRes.value.data).map(normalizeVariete))
      setLastFetch(new Date())
    }).finally(() => {
      setLoading(false)
      setRefreshing(false)
      setTimeout(() => setReady(true), 60)
    })
  }

  useEffect(() => { fetchAll() }, [])

  // ── Métriques ─────────────────────────────────────────────────
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

  // Ruptures pipeline (gen vide entre deux gens actives)
  const pipelineGaps = orderedStats.filter((s, i) =>
    s.count === 0 && i > 0 && i < orderedStats.length - 1 &&
    (orderedStats[i - 1].count > 0 || orderedStats[i + 1].count > 0)
  )

  // Top 6 variétés
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

  // Alertes
  const alerts: { level: 'critical' | 'warning' | 'info'; message: string }[] = []
  if (pipelineGaps.length > 0)
    alerts.push({ level: 'critical', message: `Rupture de pipeline — ${pipelineGaps.map(g => g.gen).join(', ')} sans lots actifs cette campagne` })
  if (enAttente > 0)
    alerts.push({ level: 'warning', message: `${enAttente} lot${enAttente > 1 ? 's' : ''} en attente de certification — action UPSemCL requise` })
  if (rejetes > 0)
    alerts.push({ level: 'warning', message: `${rejetes} lot${rejetes > 1 ? 's' : ''} rejeté${rejetes > 1 ? 's' : ''} à la certification — vérification nécessaire` })
  if (brouillons > 0 && totalLots > 0)
    alerts.push({ level: 'info', message: `${brouillons} lot${brouillons > 1 ? 's' : ''} en brouillon — non verrouillé${brouillons > 1 ? 's' : ''}` })

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1)

  // ── KPI items ─────────────────────────────────────────────────
  const kpiItems = [
    { label: 'Lots enregistrés',  value: totalLots,  sub: 'toutes générations', accent: D.blue,    delay: 0,   suffix: undefined },
    { label: 'Production totale', value: Math.round(totalKg / 1000), sub: `${lots.length} lots total`, accent: D.green, delay: 80, suffix: 't' },
    { label: 'Lots certifiés',    value: certifies,  sub: enAttente > 0 ? `${enAttente} en attente` : 'aucune attente', accent: '#0f766e', delay: 160, suffix: undefined },
    { label: 'Lots verrouillés',  value: confirmes,  sub: brouillons > 0 ? `${brouillons} en brouillon` : 'tous verrouillés', accent: '#0369a1', delay: 240, suffix: undefined },
    { label: 'En attente certif.',value: enAttente,  sub: enAttente > 0 ? 'action requise' : 'aucune alerte', accent: '#d97706', delay: 320, suffix: undefined },
    { label: 'Génération active', value: orderedStats.find(s => s.gen === generationActive)?.count ?? 0,
      sub: totalLots > 0 ? generationActive + ' — ' + GEN_LABELS[generationActive] : 'aucun lot', accent: GEN_CFG[generationActive]?.color ?? D.muted, delay: 400, suffix: undefined },
  ]

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: 320, color: D.muted }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${D.line}`, borderTopColor: D.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontFamily: D.body, fontSize: 13 }}>Chargement du tableau de bord…</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── En-tête ───────────────────────────────────────────── */}
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

      {/* ── Bannière alertes ──────────────────────────────────── */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => <AlertBanner key={i} level={a.level} message={a.message} />)}
        </div>
      )}

      {/* ── KPI Cards — même design que Dashboard.tsx ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiItems.length}, 1fr)`, gap: 14 }}>
        {kpiItems.map((item, i) => (
          <KpiCard key={i} index={i} label={item.label} value={item.value}
            sub={item.sub} accent={item.accent} delay={item.delay} suffix={item.suffix}
            ready={ready}
          />
        ))}
      </div>

      {/* ── Pipeline G0 → R2 ──────────────────────────────────── */}
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
                  {/* Cercle */}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: active ? cfg.bg : D.paper2, border: `2px solid ${active ? cfg.color : D.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: D.mono, fontSize: 11, fontWeight: 700, color: active ? cfg.color : D.muted, boxShadow: active ? `0 2px 10px ${cfg.color}28` : 'none', transition: 'all 0.3s ease' }}>
                    {stat.gen}
                  </div>
                  {/* Compteur */}
                  <div style={{ textAlign: 'center', lineHeight: 1 }}>
                    <AnimatedNum value={stat.count} ready={ready} delay={idx * 60} style={{ fontFamily: D.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: active ? cfg.color : D.muted, transition: 'color 0.3s' }} />
                    <div style={{ fontFamily: D.mono, fontSize: 9, color: D.muted, marginTop: 2 }}>lot{stat.count !== 1 ? 's' : ''}</div>
                    {stat.totalKg > 0 && (
                      <div style={{ fontFamily: D.mono, fontSize: 9, color: active ? cfg.color : D.muted, marginTop: 3, fontWeight: 600 }}>{fmtT(stat.totalKg)}</div>
                    )}
                  </div>
                  {/* Barre proportion */}
                  <div style={{ width: '70%', height: 3, background: D.line, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: ready ? `${pct}%` : '0%', background: cfg.color, borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                  {/* Label */}
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

      {/* ── Certifications + Politique d'édition ──────────────── */}
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

      {/* ── Top variétés + Matrice ────────────────────────────── */}
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

      {/* ── Carte agro-écologique nationale ───────────────────── */}
      <Section title="Répartition géographique nationale" sub="Zones agro-écologiques · sites ISRA · acteurs de la filière" icon={<Map size={14} />}>
        <MapSemences roleKey="seed-directeur" />
      </Section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ── Sous-composants ───────────────────────────────────────────────

function AnimatedNum({ value, ready, delay, style }: { value: number; ready: boolean; delay: number; style: React.CSSProperties }) {
  const displayed = useCountUp(value, delay, ready)
  return <div style={style}>{displayed.toLocaleString('fr-FR')}</div>
}

/** KpiCard — design identique à Dashboard.tsx */
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
        {/* Label */}
        <div style={{ fontFamily: D.mono, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: D.muted, marginBottom: 12 }}>
          {label}
        </div>
        {/* Valeur */}
        <div style={{ lineHeight: 1, marginBottom: sub ? 10 : 0 }}>
          <span style={{ fontFamily: D.display, fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: D.ink, fontVariantNumeric: 'tabular-nums' }}>
            {displayed.toLocaleString('fr-FR')}
          </span>
          {suffix && <span style={{ fontFamily: D.mono, fontSize: 13, fontWeight: 500, color: D.muted, marginLeft: 5 }}>{suffix}</span>}
        </div>
        {/* Sous-info */}
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
