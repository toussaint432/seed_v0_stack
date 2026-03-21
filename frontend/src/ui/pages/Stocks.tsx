import React, { useEffect, useState } from 'react'
import {
  Database, RefreshCw, Plus, MapPin, Scale,
  ChevronLeft, ChevronRight, Filter, X, TrendingUp
} from 'lucide-react'
import { api } from '../../lib/api'

interface Props { roleKey: string }

const roleContext: Record<string, string> = {
  'seed-upseml':        'Stock UPSemCL — entrepôts G1→G3 sous votre gestion',
  'seed-multiplicator': 'Stock multiplicateur — semences G3→R2 disponibles pour production',
  'seed-admin':         'Vue complète de tous les sites de stockage',
}

const PAGE_SIZE = 10

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map(i => (
        <tr key={i} className="skeleton-row" style={{ opacity: 1 - i * 0.15 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}>
              <div
                className="skeleton"
                style={{ width: j === 0 ? 80 : j === 2 ? 100 : 70, height: 13, borderRadius: 4 }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function Stocks({ roleKey }: Props) {
  const [stocks,     setStocks]     = useState<any[]>([])
  const [site,       setSite]       = useState('')
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const canManage = ['seed-admin', 'seed-upseml', 'seed-multiplicator'].includes(roleKey)

  async function refresh(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    setCurrentPage(1)
    const url = site
      ? `http://localhost:18083/api/stocks?site=${site}`
      : 'http://localhost:18083/api/stocks'
    api.get(url)
      .then(r => setStocks(r.data))
      .catch(() => setStocks([]))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { refresh() }, [])

  const totalQty = stocks.reduce((sum, s) => sum + (parseFloat(s.quantiteDisponible) || 0), 0)
  const sites    = [...new Set(stocks.map((s: any) => s.site?.codeSite).filter(Boolean))]
  const maxQty   = Math.max(...stocks.map((s: any) => parseFloat(s.quantiteDisponible) || 0), 1)

  // Pagination
  const totalPages = Math.max(1, Math.ceil(stocks.length / PAGE_SIZE))
  const pageStocks = stocks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
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
          <Database size={14} />
          {roleContext[roleKey]}
        </div>
      )}

      {/* KPI cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Database size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : stocks.length}</div>
            <div className="stat-label">Entrées stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><MapPin size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : sites.length}</div>
            <div className="stat-label">Sites de stockage</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold"><Scale size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">
              {loading ? '…' : totalQty.toLocaleString('fr-FR')}
            </div>
            <div className="stat-label">Quantité totale (kg)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet"><TrendingUp size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">
              {loading ? '…' : stocks.length > 0
                ? (totalQty / stocks.length).toFixed(0)
                : '0'}
            </div>
            <div className="stat-label">Moyenne par entrée (kg)</div>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Database size={15} /></span>
            Inventaire par site
            {!loading && (
              <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>
                {stocks.length}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManage && (
              <a href="http://localhost:18083/swagger-ui/index.html" target="_blank" rel="noopener noreferrer">
                <button className="btn btn-primary">
                  <Plus size={13} /> Mouvement stock
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

        {/* Site quick filters */}
        {!loading && sites.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            padding: '10px 22px', borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>
              Sites :
            </span>
            <button
              className={`gen-chain-btn ${!site ? 'active' : ''}`}
              style={{ background: !site ? 'var(--green-50)' : 'transparent', color: 'var(--green-700)' }}
              onClick={() => { setSite(''); setTimeout(() => refresh(), 50) }}
            >
              Tous
            </button>
            {sites.map((s: any) => (
              <button
                key={s}
                className={`gen-chain-btn ${site === s ? 'active' : ''}`}
                style={{
                  background: site === s ? 'var(--blue-50)' : 'transparent',
                  color: 'var(--blue-700)',
                }}
                onClick={() => { setSite(s); setTimeout(() => refresh(), 50) }}
              >
                <MapPin size={10} />
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Filters bar */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Code site</label>
            <input
              className="input"
              placeholder="MAG-THIES…"
              value={site}
              onChange={e => setSite(e.target.value)}
              style={{ width: 200 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => refresh()} style={{ gap: 6 }}>
            <Filter size={12} /> Filtrer
          </button>
          {site && (
            <button
              className="btn btn-ghost"
              onClick={() => { setSite(''); setTimeout(() => refresh(), 50) }}
            >
              <X size={12} /> Effacer
            </button>
          )}
          {!loading && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              {stocks.length} entrée{stocks.length > 1 ? 's' : ''}
              {site && ` · site ${site}`}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Lot ID</th>
                <th>Site</th>
                <th>Quantité disponible</th>
                <th>Unité</th>
                <th style={{ width: 160 }}>Niveau</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={5} />
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-icon"><Database size={22} /></div>
                      <div className="empty-title">Aucun stock trouvé</div>
                      <div className="empty-sub">
                        {site
                          ? `Aucune entrée pour le site « ${site} »`
                          : 'Les mouvements de stock apparaîtront ici'}
                      </div>
                      {canManage && (
                        <a
                          href="http://localhost:18083/swagger-ui/index.html"
                          target="_blank" rel="noopener noreferrer"
                          style={{ marginTop: 14 }}
                        >
                          <button className="btn btn-primary">
                            <Plus size={13} /> Enregistrer un mouvement
                          </button>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageStocks.map(s => {
                  const qty     = parseFloat(s.quantiteDisponible || 0)
                  const pct     = Math.min(100, Math.round((qty / maxQty) * 100))
                  const barColor = pct > 60 ? '#16a34a' : pct > 30 ? '#f59e0b' : '#ef4444'
                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="td-mono">{s.idLot}</span>
                      </td>
                      <td>
                        <span className="badge badge-blue" style={{ gap: 4 }}>
                          <MapPin size={10} />
                          {s.site?.codeSite || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                          {qty.toLocaleString('fr-FR')}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                          {s.unite || 'kg'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            flex: 1, height: 6, background: 'var(--surface-3)',
                            borderRadius: 99, overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: barColor, borderRadius: 99,
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && stocks.length > PAGE_SIZE && (
          <div className="pagination">
            <span className="pagination-info">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, stocks.length)} sur {stocks.length}
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
