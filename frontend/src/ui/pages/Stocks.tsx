import React, { useEffect, useState } from 'react'
import { Database, RefreshCw, Plus, MapPin, Scale, TrendingUp, X, Filter } from 'lucide-react'
import { api } from '../../lib/api'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

const TYPES_MOUVEMENT = ['IN', 'OUT', 'TRANSFER']

export function Stocks({ roleKey }: Props) {
  const [stocks, setStocks] = useState<any[]>([])
  const [site, setSite] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [showStockForm, setShowStockForm] = useState(false)
  const [showMvtForm, setShowMvtForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const canManage = ['seed-admin','seed-upseml','seed-multiplicator'].includes(roleKey)

  const [stockForm, setStockForm] = useState({ idLot: '', siteCode: '', quantite: '', unite: 'kg' })
  const [mvtForm, setMvtForm] = useState({ idLot: '', type: 'IN', siteSourceCode: '', siteDestinationCode: '', quantite: '', unite: 'kg', reference: '' })

  async function fetchStocks(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    const url = site ? "http://localhost:18083/api/stocks?site=" + site : 'http://localhost:18083/api/stocks'
    api.get(url).then(r => setStocks(r.data)).catch(() => setStocks([]))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { fetchStocks() }, [])

  const totalQty = stocks.reduce((sum, s) => sum + (parseFloat(s.quantiteDisponible) || 0), 0)
  const sites = [...new Set(stocks.map((s: any) => s.site?.codeSite).filter(Boolean))]
  const maxQty = Math.max(...stocks.map((s: any) => parseFloat(s.quantiteDisponible) || 0), 1)

  async function submitStock(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('http://localhost:18083/api/stocks', { idLot: Number(stockForm.idLot), siteCode: stockForm.siteCode, quantite: Number(stockForm.quantite), unite: stockForm.unite })
      setToast({ msg: "Stock enregistre pour lot " + stockForm.idLot, type: 'success' })
      setShowStockForm(false); setStockForm({ idLot: '', siteCode: '', quantite: '', unite: 'kg' }); fetchStocks(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitMvt(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('http://localhost:18083/api/movements', { idLot: Number(mvtForm.idLot), type: mvtForm.type, siteSourceCode: mvtForm.siteSourceCode || undefined, siteDestinationCode: mvtForm.siteDestinationCode || undefined, quantite: Number(mvtForm.quantite), unite: mvtForm.unite, reference: mvtForm.reference || undefined })
      setToast({ msg: "Mouvement " + mvtForm.type + " enregistre", type: 'success' })
      setShowMvtForm(false); setMvtForm({ idLot: '', type: 'IN', siteSourceCode: '', siteDestinationCode: '', quantite: '', unite: 'kg', reference: '' }); fetchStocks(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur mouvement', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon green"><Database size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : stocks.length}</div><div className="stat-label">Entrees stock</div></div></div>
        <div className="stat-card"><div className="stat-icon blue"><MapPin size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : sites.length}</div><div className="stat-label">Sites de stockage</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Scale size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : totalQty.toLocaleString('fr-FR')}</div><div className="stat-label">Quantite totale (kg)</div></div></div>
        <div className="stat-card"><div className="stat-icon violet"><TrendingUp size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : stocks.length > 0 ? Math.round(totalQty / stocks.length).toLocaleString('fr-FR') : 0}</div><div className="stat-label">Moyenne par entree (kg)</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><Database size={15} /></span>Inventaire par site <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{stocks.length}</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManage && <button className="btn btn-secondary" onClick={() => setShowStockForm(true)}><Plus size={13} /> Enregistrer stock</button>}
            {canManage && <button className="btn btn-primary" onClick={() => setShowMvtForm(true)}><Plus size={13} /> Mouvement</button>}
            <button className="btn btn-secondary btn-icon" onClick={() => fetchStocks(true)} disabled={refreshing}><RefreshCw size={13} /></button>
          </div>
        </div>

        {!loading && sites.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>Sites :</span>
            <button className={"gen-chain-btn " + (!site ? 'active' : '')} style={{ background: !site ? 'var(--green-50)' : 'transparent', color: 'var(--green-700)' }} onClick={() => { setSite(''); setTimeout(() => fetchStocks(), 50) }}>Tous</button>
            {sites.map((s: any) => (
              <button key={s} className={"gen-chain-btn " + (site === s ? 'active' : '')} style={{ background: site === s ? 'var(--blue-50)' : 'transparent', color: 'var(--blue-700)' }} onClick={() => { setSite(s); setTimeout(() => fetchStocks(), 50) }}>
                <MapPin size={10} />{s}
              </button>
            ))}
          </div>
        )}

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Code site</label>
            <FormInput value={site} onChange={e => setSite(e.target.value)} placeholder="MAG-THIES..." style={{ width: 200 }} />
          </div>
          <button className="btn btn-primary" onClick={() => fetchStocks()}><Filter size={12} /> Filtrer</button>
          {site && <button className="btn btn-ghost" onClick={() => { setSite(''); setTimeout(() => fetchStocks(), 50) }}><X size={12} /> Effacer</button>}
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr><th>Lot ID</th><th>Site</th><th>Quantite disponible</th><th>Unite</th><th style={{ width: 160 }}>Niveau</th></tr></thead>
            <tbody>
              {loading ? [0,1,2,3].map(i => <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
               stocks.length === 0 ? <tr><td colSpan={5}><div className="empty-state"><div className="empty-icon"><Database size={20} /></div><div className="empty-title">Aucun stock</div>{canManage && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowMvtForm(true)}>+ Enregistrer un mouvement</button>}</div></td></tr> :
               stocks.map(s => {
                const qty = parseFloat(s.quantiteDisponible || 0)
                const pct = Math.min(100, Math.round((qty / maxQty) * 100))
                const barColor = pct > 60 ? '#16a34a' : pct > 30 ? '#f59e0b' : '#ef4444'
                return (
                  <tr key={s.id}>
                    <td><span className="td-mono">{s.idLot}</span></td>
                    <td><span className="badge badge-blue" style={{ gap: 4 }}><MapPin size={10} />{s.site?.codeSite || '—'}</span></td>
                    <td><span style={{ fontWeight: 700, fontSize: 15 }}>{qty.toLocaleString('fr-FR')}</span></td>
                    <td><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.unite || 'kg'}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 99, transition: 'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showStockForm && (
        <Modal title="Enregistrer un Stock" subtitle="Ajouter ou mettre a jour un stock sur un site" onClose={() => setShowStockForm(false)} size="sm">
          <form onSubmit={submitStock}>
            <Field label="ID du lot" required hint="L'identifiant numerique du lot"><FormInput type="number" value={stockForm.idLot} onChange={e => setStockForm(f => ({ ...f, idLot: e.target.value }))} placeholder="22" required /></Field>
            <Field label="Code site" required hint="Ex: MAG-THIES, FERME-MULTI-02"><FormInput value={stockForm.siteCode} onChange={e => setStockForm(f => ({ ...f, siteCode: e.target.value.toUpperCase() }))} placeholder="MAG-THIES" required /></Field>
            <FormRow>
              <Field label="Quantite" required><FormInput type="number" value={stockForm.quantite} onChange={e => setStockForm(f => ({ ...f, quantite: e.target.value }))} placeholder="1000" min="0" step="0.01" required /></Field>
              <Field label="Unite"><FormSelect value={stockForm.unite} onChange={e => setStockForm(f => ({ ...f, unite: e.target.value }))}><option value="kg">kg</option><option value="t">t</option><option value="g">g</option></FormSelect></Field>
            </FormRow>
            <FormActions onCancel={() => setShowStockForm(false)} loading={saving} submitLabel="Enregistrer le stock" />
          </form>
        </Modal>
      )}

      {showMvtForm && (
        <Modal title="Mouvement de Stock" subtitle="Enregistrer une entree, sortie ou transfert de semences" onClose={() => setShowMvtForm(false)}>
          <form onSubmit={submitMvt}>
            <FormRow>
              <Field label="ID du lot" required><FormInput type="number" value={mvtForm.idLot} onChange={e => setMvtForm(f => ({ ...f, idLot: e.target.value }))} placeholder="22" required /></Field>
              <Field label="Type de mouvement" required>
                <FormSelect value={mvtForm.type} onChange={e => setMvtForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="IN">IN — Entree en stock</option>
                  <option value="OUT">OUT — Sortie de stock</option>
                  <option value="TRANSFER">TRANSFER — Transfert entre sites</option>
                </FormSelect>
              </Field>
            </FormRow>
            {(mvtForm.type === 'IN' || mvtForm.type === 'TRANSFER') && (
              <Field label="Site destination" required hint="Site qui recoit les semences"><FormInput value={mvtForm.siteDestinationCode} onChange={e => setMvtForm(f => ({ ...f, siteDestinationCode: e.target.value.toUpperCase() }))} placeholder="MAG-KAOLACK" required={mvtForm.type !== 'OUT'} /></Field>
            )}
            {(mvtForm.type === 'OUT' || mvtForm.type === 'TRANSFER') && (
              <Field label="Site source" required hint="Site d'ou partent les semences"><FormInput value={mvtForm.siteSourceCode} onChange={e => setMvtForm(f => ({ ...f, siteSourceCode: e.target.value.toUpperCase() }))} placeholder="MAG-THIES" required={mvtForm.type !== 'IN'} /></Field>
            )}
            <FormRow>
              <Field label="Quantite" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={mvtForm.quantite} onChange={e => setMvtForm(f => ({ ...f, quantite: e.target.value }))} placeholder="500" min="0" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={mvtForm.unite} onChange={e => setMvtForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                </div>
              </Field>
              <Field label="Reference operation"><FormInput value={mvtForm.reference} onChange={e => setMvtForm(f => ({ ...f, reference: e.target.value }))} placeholder="REF-2026-001" /></Field>
            </FormRow>
            <FormActions onCancel={() => setShowMvtForm(false)} loading={saving} submitLabel="Enregistrer le mouvement" />
          </form>
        </Modal>
      )}
    </div>
  )
}
