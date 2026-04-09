import React, { useEffect, useState } from 'react'
import {
  Package, Layers, ShoppingCart, Leaf, TrendingUp,
  TrendingDown, ArrowRight, RefreshCw, Plus, Database,
  AlertCircle, CheckCircle2, Clock, XCircle
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { SelectorAnalytics }   from './SelectorAnalytics'
import { GlobalAnalytics }     from './GlobalAnalytics'
import { PendingDeliveries }   from '../components/PendingDeliveries'

interface Props { roleKey: string; userSpecialisation?: string | null }

interface Stats {
  lotsCount:    number
  stockTotal:   number
  ordersCount:  number
  varietiesCount: number
  ordersPending: number
  ordersAllocated: number
  genCounts: Record<string, number>
  recentLots: any[]
}

const GEN_COLORS: Record<string, { bg: string; color: string }> = {
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
  G3: 'Certifiée C1',   G4: 'Certifiée C2',
  R1: 'R1',             R2: 'Commerciale R2',
}

const roleGreetings: Record<string, { title: string; sub: string }> = {
  'seed-admin':         { title: 'Vue d\'ensemble complète',      sub: 'Supervision de toute la chaîne semencière G0→R2' },
  'seed-selector':      { title: 'Vos lots G0 et G1',             sub: 'Gérez les semences génétiques avant transfert' },
  'seed-upsemcl':        { title: 'Centre de multiplication',       sub: 'Suivez les lots G1→G3 et vos stocks' },
  'seed-multiplicator': { title: 'Production G3→R2',              sub: 'Vos lots en cours et stocks disponibles' },
  'seed-quotataire':    { title: 'Catalogue semences',            sub: 'Consultez les disponibilités et passez vos commandes' },
}

function StatCard({
  icon: Icon, label, value, sub, trend, trendUp, color, delay
}: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; trend?: string; trendUp?: boolean
  color: string; delay: number
}) {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVis(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  return (
    <div
      className="stat-card"
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.35s ease, transform 0.35s ease, box-shadow 0.15s',
      }}
    >
      <div className={`stat-icon ${color}`}>
        <Icon size={18} />
      </div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {trend && (
          <div className={`stat-trend ${trendUp ? 'up' : 'down'}`}>
            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend}
          </div>
        )}
      </div>
    </div>
  )
}

export function Dashboard({ roleKey, userSpecialisation }: Props) {
  const [stats, setStats] = useState<Stats>({
    lotsCount: 0, stockTotal: 0, ordersCount: 0, varietiesCount: 0,
    ordersPending: 0, ordersAllocated: 0,
    genCounts: {}, recentLots: [],
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  async function fetchAll(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)

    const results = await Promise.allSettled([
      api.get(endpoints.lots),
      api.get(endpoints.stocks),
      api.get(endpoints.orders),
      api.get(endpoints.varieties),
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

    const stockTotal = stocks.reduce((sum: number, s: any) =>
      sum + (parseFloat(s.quantiteDisponible) || 0), 0)

    const ordersPending   = orders.filter((o: any) => ['PENDING','EN_ATTENTE'].includes(o.statut)).length
    const ordersAllocated = orders.filter((o: any) => ['ALLOCATED','ALLOUEE'].includes(o.statut)).length

    const recentLots = [...lots]
      .sort((a: any, b: any) => (b.id || 0) - (a.id || 0))
      .slice(0, 6)

    setStats({
      lotsCount: lots.length, stockTotal, ordersCount: orders.length,
      varietiesCount: varieties.length, ordersPending, ordersAllocated,
      genCounts, recentLots,
    })
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchAll() }, [])

  const greeting = roleGreetings[roleKey] || { title: 'Tableau de bord', sub: "Vue d'ensemble" }

  const showStats = (r: string) => !['seed-quotataire'].includes(r)
  const showOrders = ['seed-admin','seed-upsemcl','seed-quotataire'].includes(roleKey)
  const showPipeline = ['seed-admin','seed-selector','seed-upsemcl'].includes(roleKey)

  return (
    <div>
      {/* Welcome header */}
      <div className="page-header">
        <div className="dashboard-welcome">
          <h1>{greeting.title}</h1>
          <p>{greeting.sub} · {today}</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          style={{ gap: 6 }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="stats-grid" style={{ marginBottom: 22 }}>
          {[0,1,2,3].map(i => (
            <div key={i} className="stat-card">
              <div className="stat-icon green" style={{ opacity: 0.3 }}><Package size={18} /></div>
              <div className="stat-body">
                <div className="skeleton" style={{ width: 60, height: 24, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: 90, height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stats-grid">
          {showStats(roleKey) && (
            <StatCard icon={Package} label="Total lots" value={stats.lotsCount}
              sub="tous statuts" color="green" delay={0} />
          )}
          {showStats(roleKey) && (
            <StatCard icon={Database} label="Stock total"
              value={stats.stockTotal.toLocaleString('fr-FR') + ' kg'}
              color="blue" delay={80} />
          )}
          <StatCard icon={Leaf} label="Variétés actives"
            value={stats.varietiesCount} color="gold" delay={160} />
          {showOrders && (
            <StatCard icon={ShoppingCart} label="Commandes"
              value={stats.ordersCount}
              sub={`${stats.ordersPending} en attente`}
              color="violet" delay={240} />
          )}
        </div>
      )}

      {/* Generation pipeline */}
      {showPipeline && (
        <div className="gen-pipeline">
          <div className="gen-pipeline-title">
            <Layers size={14} />
            Pipeline générationnel — campagne en cours
          </div>
          <div className="gen-steps">
            {['G0','G1','G2','G3','G4','R1','R2'].map(g => {
              const col = GEN_COLORS[g]
              const count = loading ? '…' : (stats.genCounts[g] || 0)
              return (
                <div key={g} className="gen-step">
                  <div
                    className="gen-step-code"
                    style={{ background: col.bg, color: col.color }}
                  >{g}</div>
                  <div className="gen-step-count">{count}</div>
                  <div className="gen-step-label">{GEN_LABELS[g]}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="quick-actions">
        {['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
          <a href={endpoints.swagger.lot} target="_blank" rel="noopener noreferrer">
            <button className="btn btn-primary">
              <Plus size={14} /> Nouveau lot
            </button>
          </a>
        )}
        {['seed-admin','seed-selector'].includes(roleKey) && (
          <a href={endpoints.swagger.catalog} target="_blank" rel="noopener noreferrer">
            <button className="btn btn-secondary">
              <Leaf size={13} /> Nouvelle variété
            </button>
          </a>
        )}
        {['seed-quotataire'].includes(roleKey) && (
          <a href={endpoints.swagger.order} target="_blank" rel="noopener noreferrer">
            <button className="btn btn-primary">
              <ShoppingCart size={14} /> Passer une commande
            </button>
          </a>
        )}
        {['seed-admin','seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
          <a href={endpoints.swagger.stock} target="_blank" rel="noopener noreferrer">
            <button className="btn btn-secondary">
              <Database size={13} /> Mouvement stock
            </button>
          </a>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid-2">

        {/* Recent lots */}
        {['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <span className="card-title-icon"><Package size={15} /></span>
                Lots récents
              </span>
            </div>
            {loading ? (
              <table>
                <tbody>
                  {[0,1,2,3].map(i => (
                    <tr key={i} className="skeleton-row">
                      <td><div className="skeleton" style={{ width: 100, height: 12 }} /></td>
                      <td><div className="skeleton" style={{ width: 70,  height: 12 }} /></td>
                      <td><div className="skeleton" style={{ width: 40,  height: 20, borderRadius: 99 }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : stats.recentLots.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Package size={20} /></div>
                <div className="empty-title">Aucun lot enregistré</div>
                <div className="empty-sub">Les lots créés apparaîtront ici</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code lot</th>
                    <th>Variété</th>
                    <th>Gén.</th>
                    <th>Qté</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentLots.map((l: any) => {
                    const gen = l.generation?.codeGeneration || 'N/A'
                    const col = GEN_COLORS[gen]
                    return (
                      <tr key={l.id}>
                        <td>
                          <span className="td-mono" style={{ fontWeight: 600 }}>
                            {l.codeLot}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{l.idVariete || '—'}</td>
                        <td>
                          {col ? (
                            <span
                              className="badge"
                              style={{ background: col.bg, color: col.color }}
                            >
                              {gen}
                            </span>
                          ) : (
                            <span className="badge badge-gray">{gen}</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{l.quantiteNette}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 12 }}>
                            {l.unite}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Orders summary */}
        {showOrders && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <span className="card-title-icon"><ShoppingCart size={15} /></span>
                Statut des commandes
              </span>
            </div>
            <div className="card-body">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'En attente',   count: stats.ordersPending,   icon: Clock,        color: '#92660a', bg: '#fef9ed' },
                    { label: 'Allouées',      count: stats.ordersAllocated, icon: CheckCircle2, color: '#15803d', bg: '#f0fdf4' },
                    { label: 'Annulées',      count: Math.max(0, stats.ordersCount - stats.ordersPending - stats.ordersAllocated),
                      icon: XCircle, color: '#dc2626', bg: '#fef2f2' },
                  ].map(({ label, count, icon: Icon, color, bg }) => (
                    <div key={label} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 14px', borderRadius: 8,
                      background: bg, border: `1px solid ${color}20`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon size={16} color={color} />
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                      </div>
                      <span style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                        {count}
                      </span>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 14px', borderRadius: 8,
                    background: 'var(--surface-3)', marginTop: 4,
                    borderTop: '1px dashed var(--border-strong)'
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Total</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {stats.ordersCount}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Livraisons en attente (upsemcl + multiplicateur) */}
      {['seed-upsemcl','seed-multiplicator'].includes(roleKey) && (
        <PendingDeliveries roleKey={roleKey} />
      )}

      {/* Analytics sélectionneur */}
      {roleKey === 'seed-selector' && (
        <SelectorAnalytics userSpecialisation={userSpecialisation} />
      )}

      {/* Analytics global (admin / upsemcl / multiplicateur / quotataire) */}
      {['seed-admin','seed-upsemcl','seed-multiplicator','seed-quotataire'].includes(roleKey) && (
        <GlobalAnalytics roleKey={roleKey} />
      )}

      {/* CSS for spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
