import { useEffect, useState } from 'react'
import {
  Package, Layers, ShoppingCart, Leaf,
  RefreshCw, Plus, Database,
  CheckCircle2, Clock, XCircle, ArrowRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { SelectorAnalytics }   from './SelectorAnalytics'
import { GlobalAnalytics }     from './GlobalAnalytics'
import { PendingDeliveries }   from '../components/PendingDeliveries'

interface Props { roleKey: string; userSpecialisation?: string | null }

interface Stats {
  lotsCount:       number
  stockTotal:      number
  ordersCount:     number
  varietiesCount:  number
  ordersPending:   number
  ordersAllocated: number
  genCounts:       Record<string, number>
  recentLots:      any[]
}

const ROLE_CFG: Record<string, { color: string; label: string }> = {
  'seed-admin':         { color: '#7c3aed', label: 'Administrateur ISRA' },
  'seed-selector':      { color: '#0369a1', label: 'Sélectionneur' },
  'seed-upsemcl':       { color: '#0f766e', label: 'UPSemCL' },
  'seed-multiplicator': { color: '#15803d', label: 'Multiplicateur' },
  'seed-quotataire':    { color: '#b45309', label: 'Quotataire / OP' },
}

const GEN_CFG: Record<string, { bg: string; color: string }> = {
  G0: { bg: '#eff6ff', color: '#1d4ed8' },
  G1: { bg: '#f0fdf4', color: '#15803d' },
  G2: { bg: '#fef9ed', color: '#92660a' },
  G3: { bg: '#faf5ff', color: '#6d28d9' },
  G4: { bg: '#fef2f2', color: '#b91c1c' },
  R1: { bg: '#f0fdfa', color: '#0f766e' },
  R2: { bg: '#dcfce7', color: '#15803d' },
}

const GEN_LABELS: Record<string, string> = {
  G0: 'Noyau génétique', G1: 'Pré-base', G2: 'Base',
  G3: 'Certifiée C1', G4: 'Certifiée C2', R1: 'R1', R2: 'Commerciale R2',
}

const GREETINGS: Record<string, { title: string; sub: string }> = {
  'seed-admin':         { title: "Vue d'ensemble complète",   sub: 'Supervision de toute la chaîne semencière G0→R2' },
  'seed-selector':      { title: 'Vos lots G0 et G1',         sub: 'Gérez les semences génétiques avant transfert' },
  'seed-upsemcl':       { title: 'Centre de multiplication',  sub: 'Suivez les lots G1→G3 et vos stocks' },
  'seed-multiplicator': { title: 'Production G3→R2',          sub: 'Vos lots en cours et stocks disponibles' },
  'seed-quotataire':    { title: 'Catalogue semences',        sub: 'Consultez les disponibilités et passez vos commandes' },
}

/* ── Count-up hook ── */
function useCountUp(target: number, delay = 0, enabled = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!enabled) return
    setVal(0)
    let raf = 0
    const tid = setTimeout(() => {
      const t0 = performance.now()
      const dur = 750
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

/* ── KPI Card ── */
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
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 24px ${accent}22, 0 2px 8px rgba(0,0,0,0.07)` }}
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
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
            {label}
          </span>
        </div>
        <div style={{ lineHeight: 1 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Fraunces, serif', letterSpacing: '-0.03em' }}>
            {displayed.toLocaleString('fr-FR')}
          </span>
          {suffix && (
            <span style={{ fontSize: 16, fontWeight: 600, color: accent, marginLeft: 5 }}>{suffix}</span>
          )}
        </div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════ DASHBOARD ══════════════════════════════════════ */
export function Dashboard({ roleKey, userSpecialisation }: Props) {
  const [stats, setStats] = useState<Stats>({
    lotsCount: 0, stockTotal: 0, ordersCount: 0, varietiesCount: 0,
    ordersPending: 0, ordersAllocated: 0, genCounts: {}, recentLots: [],
  })
  const [varMap,     setVarMap]     = useState<Record<number, string>>({})
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [heroVis,    setHeroVis]    = useState(false)

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

    const stockTotal      = stocks.reduce((s: number, x: any) => s + (parseFloat(x.quantiteDisponible) || 0), 0)
    const ordersPending   = orders.filter((o: any) => ['PENDING','EN_ATTENTE'].includes(o.statut)).length
    const ordersAllocated = orders.filter((o: any) => ['ALLOCATED','ALLOUEE'].includes(o.statut)).length
    const recentLots      = [...lots].sort((a: any, b: any) => (b.id || 0) - (a.id || 0)).slice(0, 6)

    const vm: Record<number, string> = {}
    varieties.forEach((v: any) => { if (v.id) vm[v.id] = v.nomVariete ?? v.codeVariete ?? `#${v.id}` })
    setVarMap(vm)
    setStats({ lotsCount: lots.length, stockTotal, ordersCount: orders.length, varietiesCount: varieties.length, ordersPending, ordersAllocated, genCounts, recentLots })
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchAll() }, [])

  const role     = ROLE_CFG[roleKey] || { color: '#16a34a', label: 'Tableau de bord' }
  const accent   = role.color
  const greeting = GREETINGS[roleKey] || { title: 'Tableau de bord', sub: "Vue d'ensemble" }

  const showStats    = roleKey !== 'seed-quotataire'
  const showOrders   = ['seed-admin','seed-upsemcl','seed-quotataire','seed-multiplicator'].includes(roleKey)
  const showPipeline = ['seed-admin','seed-selector','seed-upsemcl'].includes(roleKey)
  const showLots     = ['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey)
  const ordersLabel  = roleKey === 'seed-multiplicator' ? 'Cmdes reçues' : 'Commandes'
  const maxGen       = Math.max(1, ...Object.values(stats.genCounts))

  const kpiItems = [
    ...(showStats ? [
      { icon: Package,      label: 'Total lots',       value: stats.lotsCount,              sub: 'tous statuts',            accent: '#16a34a', delay: 0,   suffix: undefined },
      { icon: Database,     label: 'Stock total',      value: Math.round(stats.stockTotal), sub: undefined,                 accent: '#2563eb', delay: 80,  suffix: 'kg' },
    ] : []),
    { icon: Leaf,           label: 'Variétés actives', value: stats.varietiesCount,          sub: 'espèces enregistrées',    accent: '#b45309', delay: showStats ? 160 : 0, suffix: undefined },
    ...(showOrders ? [
      { icon: ShoppingCart, label: ordersLabel,         value: stats.ordersCount,            sub: `${stats.ordersPending} en attente`, accent, delay: showStats ? 240 : 80, suffix: undefined },
    ] : []),
  ]

  return (
    <div>

      {/* ═══════════════ HERO HEADER ═══════════════ */}
      <div style={{
        marginBottom: 20, borderRadius: 16,
        overflow: 'hidden', border: '1px solid var(--border)',
        boxShadow: `0 4px 20px ${accent}1a, 0 1px 4px rgba(0,0,0,0.06)`,
        opacity: heroVis ? 1 : 0,
        transform: heroVis ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        {/* Bannière */}
        <div style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}bb 45%, #0c1520 100%)`,
          padding: '22px 28px 20px', position: 'relative', overflow: 'hidden',
        }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07, pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="db-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#db-grid)" />
          </svg>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 200, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

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
                {greeting.sub} · <span style={{ color: 'rgba(255,255,255,0.42)' }}>{today}</span>
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

        {/* Summary strip */}
        {!loading && (
          <div style={{ background: '#fff', borderTop: `3px solid ${accent}1e`, display: 'flex', alignItems: 'center' }}>
            {[
              showStats  && { label: 'lots',        value: stats.lotsCount.toLocaleString('fr-FR'),              color: '#16a34a' },
              showStats  && { label: 'kg en stock',  value: Math.round(stats.stockTotal).toLocaleString('fr-FR'), color: '#2563eb' },
              true       && { label: 'variétés',    value: stats.varietiesCount.toLocaleString('fr-FR'),         color: '#b45309' },
              showOrders && { label: 'commandes',   value: stats.ordersCount.toLocaleString('fr-FR'),            color: accent },
            ].filter(Boolean).map((item: any, i, arr) => (
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
                  <div className="skeleton" style={{ width: 70, height: 30, borderRadius: 6, marginBottom: 8 }} />
                  <div className="skeleton" style={{ width: 95, height: 11, borderRadius: 4 }} />
                </div>
              </div>
            ))
          : kpiItems.map((item, i) => (
              <KpiCard key={i} icon={item.icon} label={item.label} value={item.value}
                sub={item.sub} accent={item.accent} delay={item.delay} suffix={item.suffix} />
            ))
        }
      </div>

      {/* ═══════════════ PIPELINE GÉNÉRATIONNEL ═══════════════ */}
      {showPipeline && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accent}15`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={13} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Pipeline générationnel</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— campagne en cours</span>
            <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 99, padding: '2px 10px' }}>
              {loading ? '…' : `${stats.lotsCount} lots`}
            </div>
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center' }}>
            {['G0','G1','G2','G3','G4','R1','R2'].map((g, idx, arr) => {
              const cfg   = GEN_CFG[g]
              const count = loading ? 0 : (stats.genCounts[g] || 0)
              const pct   = Math.round((count / maxGen) * 100)
              return (
                <div key={g} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                    {/* Badge génération */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: cfg.bg, border: `2px solid ${cfg.color}2a`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: cfg.color, letterSpacing: '-0.02em',
                      boxShadow: count > 0 ? `0 2px 8px ${cfg.color}28` : 'none',
                      transition: 'box-shadow 0.3s',
                    }}>{g}</div>
                    {/* Nombre */}
                    <div style={{ fontSize: 22, fontWeight: 800, color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'Fraunces, serif', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {loading ? <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 4 }} /> : count}
                    </div>
                    {/* Barre de proportion */}
                    <div style={{ width: '80%', height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: loading ? '0%' : `${pct}%`,
                        background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`,
                        borderRadius: 99,
                        transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
                      }} />
                    </div>
                    {/* Label */}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 500, lineHeight: 1.3, maxWidth: 66 }}>
                      {GEN_LABELS[g]}
                    </div>
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ color: 'var(--border-strong)', flexShrink: 0, paddingBottom: 22 }}>
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
            <button className="btn btn-primary" style={{ background: accent, borderColor: accent, boxShadow: `0 3px 10px ${accent}44` }}>
              <Plus size={14} /> Nouveau lot
            </button>
          </a>
        )}
        {['seed-admin','seed-selector'].includes(roleKey) && (
          <a href={endpoints.swagger.catalog} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary"><Leaf size={13} /> Nouvelle variété</button>
          </a>
        )}
        {roleKey === 'seed-quotataire' && (
          <a href={endpoints.swagger.order} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ background: accent, borderColor: accent, boxShadow: `0 3px 10px ${accent}44` }}>
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

      {/* ═══════════════ GRILLE BAS : LOTS + COMMANDES ═══════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: showLots && showOrders ? '1fr 1fr' : '1fr', gap: 18, marginBottom: 20 }}>

        {/* Lots récents */}
        {showLots && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#16a34a1a', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={13} />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Lots récents</span>
              {!loading && (
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 99, padding: '2px 9px' }}>
                  {stats.recentLots.length} affichés
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ padding: '8px 0' }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 18px', alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: 130, height: 11, borderRadius: 4 }} />
                    <div className="skeleton" style={{ width: 70, height: 11, borderRadius: 4 }} />
                    <div className="skeleton" style={{ width: 32, height: 20, borderRadius: 99, marginLeft: 'auto' }} />
                  </div>
                ))}
              </div>
            ) : stats.recentLots.length === 0 ? (
              <div style={{ padding: '44px 20px', textAlign: 'center' }}>
                <div style={{ width: 50, height: 50, borderRadius: 13, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--text-muted)' }}>
                  <Package size={22} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Aucun lot enregistré</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Les lots créés apparaîtront ici</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {['Code lot', 'Variété', 'Gén.', 'Qté'].map(h => (
                      <th key={h} style={{ padding: '8px 18px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLots.map((l: any, idx) => {
                    const gen = l.generation?.codeGeneration || 'N/A'
                    const cfg = GEN_CFG[gen]
                    return (
                      <tr key={l.id}
                        style={{ borderBottom: idx < stats.recentLots.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '10px 18px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{l.codeLot}</span>
                        </td>
                        <td style={{ padding: '10px 18px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {varMap[l.idVariete] ?? l.variete?.nomVariete ?? (l.idVariete ? `#${l.idVariete}` : '—')}
                        </td>
                        <td style={{ padding: '10px 18px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 30, height: 22, borderRadius: 6, padding: '0 6px',
                            background: cfg ? cfg.bg : 'var(--surface-3)',
                            color: cfg ? cfg.color : 'var(--text-muted)',
                            fontSize: 11, fontWeight: 800,
                            border: `1px solid ${cfg ? cfg.color + '28' : 'var(--border)'}`,
                          }}>{gen}</span>
                        </td>
                        <td style={{ padding: '10px 18px' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}>{l.quantiteNette}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>{l.unite}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Statut commandes */}
        {showOrders && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accent}15`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={13} />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Statut des commandes</span>
              {!loading && (
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, background: `${accent}10`, color: accent, border: `1px solid ${accent}28`, borderRadius: 99, padding: '2px 9px' }}>
                  {stats.ordersCount} total
                </span>
              )}
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading ? (
                [0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 62, borderRadius: 10 }} />)
              ) : (
                <>
                  {([
                    { label: 'En attente',  count: stats.ordersPending,   icon: Clock,        color: '#92660a', bg: '#fef9ed', border: '#f59e0b28' },
                    { label: 'Allouées',    count: stats.ordersAllocated, icon: CheckCircle2, color: '#15803d', bg: '#f0fdf4', border: '#22c55e28' },
                    { label: 'Annulées',    count: Math.max(0, stats.ordersCount - stats.ordersPending - stats.ordersAllocated),
                      icon: XCircle, color: '#dc2626', bg: '#fef2f2', border: '#ef444428' },
                  ] as const).map(({ label, count, icon: Icon, color, bg, border }) => (
                    <div key={label}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 11, background: bg, border: `1px solid ${border}`, cursor: 'default', transition: 'transform 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(4px)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</div>
                        <div style={{ height: 4, background: `${color}18`, borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: stats.ordersCount > 0 ? `${Math.round((count / stats.ordersCount) * 100)}%` : '0%',
                            background: color, borderRadius: 99,
                            transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
                          }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'Fraunces, serif', letterSpacing: '-0.03em', minWidth: 36, textAlign: 'right', lineHeight: 1 }}>
                        {count}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', marginTop: 2 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Total commandes</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Fraunces, serif', letterSpacing: '-0.03em' }}>
                      {stats.ordersCount}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ SECTIONS RÔLE-SPÉCIFIQUES ═══════════════ */}
      {['seed-upsemcl','seed-multiplicator'].includes(roleKey) && <PendingDeliveries roleKey={roleKey} />}
      {roleKey === 'seed-selector' && <SelectorAnalytics userSpecialisation={userSpecialisation} />}
      {['seed-admin','seed-upsemcl','seed-multiplicator','seed-quotataire'].includes(roleKey) && <GlobalAnalytics roleKey={roleKey} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
