import React, { useEffect, useState } from 'react'
import {
  ShoppingCart, RefreshCw, Plus, Settings2,
  CheckCircle2, Clock, XCircle, PackageCheck,
  ChevronLeft, ChevronRight, Search, Filter, X
} from 'lucide-react'
import { api } from '../../lib/api'

interface Props { roleKey: string }

const STATUS_CONFIG: Record<string, {
  label: string; badgeClass: string
  icon: React.ElementType; bg: string; color: string
}> = {
  PENDING:    { label: 'En attente',  badgeClass: 'badge-gold',  icon: Clock,        bg: '#fef9ed', color: '#92660a' },
  EN_ATTENTE: { label: 'En attente',  badgeClass: 'badge-gold',  icon: Clock,        bg: '#fef9ed', color: '#92660a' },
  CONFIRMED:  { label: 'Confirmée',   badgeClass: 'badge-blue',  icon: CheckCircle2, bg: '#eff6ff', color: '#1d4ed8' },
  CONFIRMEE:  { label: 'Confirmée',   badgeClass: 'badge-blue',  icon: CheckCircle2, bg: '#eff6ff', color: '#1d4ed8' },
  ALLOCATED:  { label: 'Allouée',     badgeClass: 'badge-green', icon: PackageCheck, bg: '#f0fdf4', color: '#15803d' },
  ALLOUEE:    { label: 'Allouée',     badgeClass: 'badge-green', icon: PackageCheck, bg: '#f0fdf4', color: '#15803d' },
  CANCELLED:  { label: 'Annulée',     badgeClass: 'badge-red',   icon: XCircle,      bg: '#fef2f2', color: '#dc2626' },
  ANNULEE:    { label: 'Annulée',     badgeClass: 'badge-red',   icon: XCircle,      bg: '#fef2f2', color: '#dc2626' },
}

const roleContext: Record<string, string> = {
  'seed-quotataire': 'Passez vos commandes de semences R2 certifiées et suivez leur avancement',
  'seed-upseml':     'Gérez et validez les commandes de semences entrantes',
  'seed-admin':      'Vue complète de toutes les commandes — tous clients et statuts',
}

const PAGE_SIZE = 10

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map(i => (
        <tr key={i} className="skeleton-row" style={{ opacity: 1 - i * 0.15 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}>
              <div className="skeleton" style={{ width: j === 2 ? 80 : 100, height: 13, borderRadius: 4 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function Orders({ roleKey }: Props) {
  const [orders,       setOrders]       = useState<any[]>([])
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [currentPage,  setCurrentPage]  = useState(1)

  const canCreate = roleKey === 'seed-quotataire'
  const canManage = ['seed-admin', 'seed-upseml'].includes(roleKey)

  async function refresh(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    setCurrentPage(1)
    api.get('http://localhost:18084/api/orders')
      .then(r => setOrders(r.data))
      .catch(() => setOrders([]))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { refresh() }, [])

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.codeCommande?.toLowerCase().includes(search.toLowerCase()) ||
      o.client?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || o.statut === filterStatus
    return matchSearch && matchStatus
  })

  const statuses   = [...new Set(orders.map((o: any) => o.statut).filter(Boolean))]
  const countByStatus = orders.reduce((acc: Record<string, number>, o: any) => {
    const s = o.statut || 'N/A'; acc[s] = (acc[s] || 0) + 1; return acc
  }, {})

  const pending   = (countByStatus['PENDING']   || 0) + (countByStatus['EN_ATTENTE'] || 0)
  const confirmed = (countByStatus['CONFIRMED'] || 0) + (countByStatus['CONFIRMEE']  || 0)
  const allocated = (countByStatus['ALLOCATED'] || 0) + (countByStatus['ALLOUEE']    || 0)
  const cancelled = (countByStatus['CANCELLED'] || 0) + (countByStatus['ANNULEE']    || 0)

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageOrders = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageNumbers = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1
    if (currentPage <= 3) return i + 1
    if (currentPage >= totalPages - 2) return totalPages - 4 + i
    return currentPage - 2 + i
  })

  return (
    <div>
      {/* Context banner */}
      {roleContext[roleKey] && (
        <div className="context-banner">
          <ShoppingCart size={14} />
          {roleContext[roleKey]}
        </div>
      )}

      {/* KPI cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><ShoppingCart size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : orders.length}</div>
            <div className="stat-label">Total commandes</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }}
          onClick={() => { setFilterStatus(filterStatus === 'PENDING' ? '' : 'PENDING'); setCurrentPage(1) }}>
          <div className="stat-icon gold"><Clock size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : pending}</div>
            <div className="stat-label">En attente</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }}
          onClick={() => { setFilterStatus(filterStatus === 'ALLOCATED' ? '' : 'ALLOCATED'); setCurrentPage(1) }}>
          <div className="stat-icon green"><PackageCheck size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : allocated}</div>
            <div className="stat-label">Allouées</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }}
          onClick={() => { setFilterStatus(filterStatus === 'CANCELLED' ? '' : 'CANCELLED'); setCurrentPage(1) }}>
          <div className="stat-icon red"><XCircle size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : cancelled}</div>
            <div className="stat-label">Annulées</div>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><ShoppingCart size={15} /></span>
            Commandes
            {!loading && (
              <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>
                {filtered.length}/{orders.length}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canCreate && (
              <a href="http://localhost:18084/swagger-ui/index.html" target="_blank" rel="noopener noreferrer">
                <button className="btn btn-primary">
                  <Plus size={13} /> Nouvelle commande
                </button>
              </a>
            )}
            {canManage && (
              <a href="http://localhost:18084/swagger-ui/index.html" target="_blank" rel="noopener noreferrer">
                <button className="btn btn-secondary">
                  <Settings2 size={13} /> Gérer
                </button>
              </a>
            )}
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => refresh(true)}
              title="Actualiser"
              disabled={refreshing}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Status quick filters */}
        {!loading && statuses.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            padding: '10px 22px', borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>
              Statut :
            </span>
            <button
              className={`gen-chain-btn ${!filterStatus ? 'active' : ''}`}
              style={{ background: !filterStatus ? 'var(--green-50)' : 'transparent', color: 'var(--green-700)' }}
              onClick={() => { setFilterStatus(''); setCurrentPage(1) }}
            >
              Tous ({orders.length})
            </button>
            {statuses.map((s: any) => {
              const cfg = STATUS_CONFIG[s]
              if (!cfg) return null
              const isActive = filterStatus === s
              return (
                <button
                  key={s}
                  className={`gen-chain-btn ${isActive ? 'active' : ''}`}
                  style={{
                    background: isActive ? cfg.bg : 'transparent',
                    color: cfg.color,
                  }}
                  onClick={() => { setFilterStatus(isActive ? '' : s); setCurrentPage(1) }}
                >
                  <cfg.icon size={10} />
                  {cfg.label} ({countByStatus[s] || 0})
                </button>
              )
            })}
          </div>
        )}

        {/* Filters bar */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)', padding: '0 11px', height: 34,
            }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                placeholder="Code commande ou client…"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                style={{
                  border: 'none', background: 'none', outline: 'none',
                  fontSize: 13, color: 'var(--text-primary)',
                  fontFamily: 'Outfit, sans-serif', width: 200,
                }}
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setCurrentPage(1) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  <X size={13} color="var(--text-muted)" />
                </button>
              )}
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">Statut</label>
            <select
              className="input"
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1) }}
              style={{ width: 160 }}
            >
              <option value="">Tous</option>
              {statuses.map((s: any) => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
              ))}
            </select>
          </div>
          {(search || filterStatus) && (
            <button
              className="btn btn-ghost"
              onClick={() => { setSearch(''); setFilterStatus(''); setCurrentPage(1) }}
            >
              <X size={12} /> Effacer les filtres
            </button>
          )}
          {!loading && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code commande</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Date commande</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={4} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <div className="empty-icon"><ShoppingCart size={22} /></div>
                      <div className="empty-title">
                        {search || filterStatus ? 'Aucun résultat' : 'Aucune commande'}
                      </div>
                      <div className="empty-sub">
                        {search
                          ? `Aucune commande ne correspond à « ${search} »`
                          : filterStatus
                            ? `Aucune commande avec le statut « ${STATUS_CONFIG[filterStatus]?.label || filterStatus} »`
                            : canCreate
                              ? 'Passez votre première commande de semences'
                              : 'Les commandes apparaîtront ici'}
                      </div>
                      {canCreate && !search && !filterStatus && (
                        <a
                          href="http://localhost:18084/swagger-ui/index.html"
                          target="_blank" rel="noopener noreferrer"
                          style={{ marginTop: 14 }}
                        >
                          <button className="btn btn-primary">
                            <Plus size={13} /> Passer une commande
                          </button>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageOrders.map(o => {
                  const cfg = STATUS_CONFIG[o.statut]
                  const Icon = cfg?.icon || Clock
                  return (
                    <tr key={o.id}>
                      <td>
                        <span className="td-mono" style={{ fontWeight: 600 }}>
                          {o.codeCommande}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{o.client || '—'}</td>
                      <td>
                        {cfg ? (
                          <span
                            className="badge"
                            style={{ background: cfg.bg, color: cfg.color, gap: 5 }}
                          >
                            <Icon size={11} style={{ flexShrink: 0 }} />
                            {cfg.label}
                          </span>
                        ) : (
                          <span className="badge badge-gray">{o.statut || '—'}</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Mono, monospace' }}>
                        {o.dateCommande
                          ? new Date(o.dateCommande).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="pagination">
            <span className="pagination-info">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} sur {filtered.length}
            </span>
            <div className="pagination-btns">
              <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={13} />
              </button>
              {pageNumbers.map(n => (
                <button key={n} className={`page-btn ${currentPage === n ? 'active' : ''}`} onClick={() => setCurrentPage(n)}>
                  {n}
                </button>
              ))}
              <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
