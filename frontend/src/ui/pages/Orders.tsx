import React, { useEffect, useState } from 'react'
import { ShoppingCart, RefreshCw, Plus, Settings2, CheckCircle2, Clock, XCircle, PackageCheck, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; bg: string; color: string }> = {
  PENDING:    { label: 'En attente',  badgeClass: 'badge-gold',  bg: '#fef9ed', color: '#92660a' },
  EN_ATTENTE: { label: 'En attente',  badgeClass: 'badge-gold',  bg: '#fef9ed', color: '#92660a' },
  CONFIRMED:  { label: 'Confirmee',   badgeClass: 'badge-blue',  bg: '#eff6ff', color: '#1d4ed8' },
  CONFIRMEE:  { label: 'Confirmee',   badgeClass: 'badge-blue',  bg: '#eff6ff', color: '#1d4ed8' },
  ALLOCATED:  { label: 'Allouee',     badgeClass: 'badge-green', bg: '#f0fdf4', color: '#15803d' },
  ALLOUEE:    { label: 'Allouee',     badgeClass: 'badge-green', bg: '#f0fdf4', color: '#15803d' },
  CANCELLED:  { label: 'Annulee',     badgeClass: 'badge-red',   bg: '#fef2f2', color: '#dc2626' },
  ANNULEE:    { label: 'Annulee',     badgeClass: 'badge-red',   bg: '#fef2f2', color: '#dc2626' },
}

const PAGE_SIZE = 10

export function Orders({ roleKey }: Props) {
  const [orders, setOrders] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showAllocForm, setShowAllocForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const canCreate = roleKey === 'seed-quotataire'
  const canManage = ['seed-admin','seed-upseml'].includes(roleKey)

  const [orderForm, setOrderForm] = useState({
    codeCommande: '', client: '',
    lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }]
  })
  const [allocForm, setAllocForm] = useState({ idLigne: '', idLot: '', quantite: '' })

  async function fetchOrders() {
    setLoading(true)
    api.get('http://localhost:18084/api/orders').then(r => setOrders(r.data)).catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [])

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || o.statut === filterStatus
    return matchSearch && matchStatus
  })

  const countByStatus = orders.reduce((acc: Record<string, number>, o: any) => {
    const s = o.statut || 'N/A'; acc[s] = (acc[s] || 0) + 1; return acc
  }, {})
  const pending   = (countByStatus['PENDING']   || 0) + (countByStatus['EN_ATTENTE'] || 0)
  const allocated = (countByStatus['ALLOCATED'] || 0) + (countByStatus['ALLOUEE']    || 0)
  const cancelled = (countByStatus['CANCELLED'] || 0) + (countByStatus['ANNULEE']    || 0)
  const statuses  = [...new Set(orders.map((o: any) => o.statut).filter(Boolean))]

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageOrders = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function addLigne() {
    setOrderForm(f => ({ ...f, lignes: [...f.lignes, { idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] }))
  }
  function removeLigne(i: number) {
    setOrderForm(f => ({ ...f, lignes: f.lignes.filter((_, idx) => idx !== i) }))
  }
  function updateLigne(i: number, field: string, value: string) {
    setOrderForm(f => ({ ...f, lignes: f.lignes.map((l, idx) => idx === i ? { ...l, [field]: value } : l) }))
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('http://localhost:18084/api/orders', {
        codeCommande: orderForm.codeCommande, client: orderForm.client,
        lignes: orderForm.lignes.map(l => ({ idVariete: Number(l.idVariete), idGeneration: Number(l.idGeneration), quantite: Number(l.quantite), unite: l.unite }))
      })
      setToast({ msg: "Commande " + orderForm.codeCommande + " creee avec succes", type: 'success' })
      setShowOrderForm(false)
      setOrderForm({ codeCommande: '', client: '', lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] })
      fetchOrders()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la creation', type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitAlloc(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('http://localhost:18084/api/orders/allocate', { idLigne: Number(allocForm.idLigne), idLot: Number(allocForm.idLot), quantite: Number(allocForm.quantite) })
      setToast({ msg: "Allocation enregistree avec succes", type: 'success' })
      setShowAllocForm(false); setAllocForm({ idLigne: '', idLot: '', quantite: '' }); fetchOrders()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur allocation', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><ShoppingCart size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : orders.length}</div><div className="stat-label">Total commandes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : pending}</div><div className="stat-label">En attente</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><PackageCheck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : allocated}</div><div className="stat-label">Allouees</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : cancelled}</div><div className="stat-label">Annulees</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><ShoppingCart size={15} /></span>Commandes <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}/{orders.length}</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canCreate && <button className="btn btn-primary" onClick={() => setShowOrderForm(true)}><Plus size={13} /> Nouvelle commande</button>}
            {canManage && <button className="btn btn-secondary" onClick={() => setShowAllocForm(true)}><Settings2 size={13} /> Allouer</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchOrders}><RefreshCw size={13} /></button>
          </div>
        </div>

        {!loading && statuses.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button className={"gen-chain-btn " + (!filterStatus ? 'active' : '')} style={{ background: !filterStatus ? 'var(--green-50)' : 'transparent', color: 'var(--green-700)' }} onClick={() => { setFilterStatus(''); setCurrentPage(1) }}>Tous ({orders.length})</button>
            {statuses.map((s: any) => {
              const cfg = STATUS_CONFIG[s]; if (!cfg) return null
              const isActive = filterStatus === s
              return <button key={s} className={"gen-chain-btn " + (isActive ? 'active' : '')} style={{ background: isActive ? cfg.bg : 'transparent', color: cfg.color }} onClick={() => { setFilterStatus(isActive ? '' : s); setCurrentPage(1) }}>{cfg.label} ({countByStatus[s] || 0})</button>
            })}
          </div>
        )}

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Code commande ou client..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 200 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          {(search || filterStatus) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterStatus(''); setCurrentPage(1) }}><X size={12} /> Effacer filtres</button>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} resultat{filtered.length > 1 ? 's' : ''}</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr><th>Code commande</th><th>Client</th><th>Statut</th><th>Date commande</th></tr></thead>
            <tbody>
              {loading ? [0,1,2,3].map(i => <tr key={i}><td colSpan={4}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
               filtered.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state"><div className="empty-icon"><ShoppingCart size={20} /></div><div className="empty-title">{search || filterStatus ? 'Aucun resultat' : 'Aucune commande'}</div>{canCreate && !search && !filterStatus && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowOrderForm(true)}>+ Passer une commande</button>}</div></td></tr>
               ) : pageOrders.map(o => {
                const cfg = STATUS_CONFIG[o.statut]
                return (
                  <tr key={o.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                    <td style={{ fontWeight: 500 }}>{o.client || '—'}</td>
                    <td>{cfg ? <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span> : <span className="badge badge-gray">{o.statut || '—'}</span>}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="pagination">
            <span className="pagination-info">{(currentPage-1)*PAGE_SIZE+1}–{Math.min(currentPage*PAGE_SIZE, filtered.length)} sur {filtered.length}</span>
            <div className="pagination-btns">
              <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1}><ChevronLeft size={13} /></button>
              {Array.from({ length: Math.min(totalPages,5) }, (_,i) => i+1).map(n => <button key={n} className={"page-btn " + (currentPage===n?'active':'')} onClick={() => setCurrentPage(n)}>{n}</button>)}
              <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages}><ChevronRight size={13} /></button>
            </div>
          </div>
        )}
      </div>

      {showOrderForm && (
        <Modal title="Nouvelle Commande" subtitle="Passer une commande de semences certifiees R2" onClose={() => setShowOrderForm(false)} size="lg">
          <form onSubmit={submitOrder}>
            <FormRow>
              <Field label="Code commande" required hint="Ex: CMD-2026-001"><FormInput value={orderForm.codeCommande} onChange={e => setOrderForm(f => ({ ...f, codeCommande: e.target.value.toUpperCase() }))} placeholder="CMD-2026-001" required /></Field>
              <Field label="Nom du client" required><FormInput value={orderForm.client} onChange={e => setOrderForm(f => ({ ...f, client: e.target.value }))} placeholder="Cooperative Kaolack" required /></Field>
            </FormRow>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lignes de commande <span style={{ color: 'var(--red-500)' }}>*</span></label>
                <button type="button" className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={addLigne}><Plus size={11} /> Ajouter une ligne</button>
              </div>
              {orderForm.lignes.map((ligne, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 10, position: 'relative' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Ligne {i+1}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <Field label="ID variete" required><FormInput type="number" value={ligne.idVariete} onChange={e => updateLigne(i,'idVariete',e.target.value)} placeholder="ID variete" required /></Field>
                    <Field label="Generation" required>
                      <FormSelect value={ligne.idGeneration} onChange={e => updateLigne(i,'idGeneration',e.target.value)}>
                        <option value="1">G0</option><option value="2">G1</option><option value="3">G2</option>
                        <option value="4">G3</option><option value="5">G4</option><option value="6">R1</option><option value="7">R2</option>
                      </FormSelect>
                    </Field>
                    <Field label="Quantite" required>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <FormInput type="number" value={ligne.quantite} onChange={e => updateLigne(i,'quantite',e.target.value)} placeholder="500" min="1" required style={{ flex: 1 }} />
                        <FormSelect value={ligne.unite} onChange={e => updateLigne(i,'unite',e.target.value)} style={{ width: 70 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                      </div>
                    </Field>
                    {orderForm.lignes.length > 1 && <button type="button" onClick={() => removeLigne(i)} style={{ height: 36, width: 36, background: 'var(--red-50)', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: 'var(--red-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 0, alignSelf: 'flex-end' }}><X size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
            <FormActions onCancel={() => setShowOrderForm(false)} loading={saving} submitLabel="Soumettre la commande" />
          </form>
        </Modal>
      )}

      {showAllocForm && (
        <Modal title="Allouer un Lot a une Commande" subtitle="Affecter un lot de semences a une ligne de commande" onClose={() => setShowAllocForm(false)} size="sm">
          <div style={{ background: 'var(--blue-50)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1d4ed8' }}>
            Trouvez l'ID de la ligne de commande dans le detail de la commande.
          </div>
          <form onSubmit={submitAlloc}>
            <Field label="ID ligne de commande" required hint="Identifiant numerique de la ligne"><FormInput type="number" value={allocForm.idLigne} onChange={e => setAllocForm(f => ({ ...f, idLigne: e.target.value }))} placeholder="1" required /></Field>
            <Field label="ID du lot" required hint="Lot de semences a affecter"><FormInput type="number" value={allocForm.idLot} onChange={e => setAllocForm(f => ({ ...f, idLot: e.target.value }))} placeholder="22" required /></Field>
            <Field label="Quantite a allouer" required><FormInput type="number" value={allocForm.quantite} onChange={e => setAllocForm(f => ({ ...f, quantite: e.target.value }))} placeholder="1000" min="1" step="0.01" required /></Field>
            <FormActions onCancel={() => setShowAllocForm(false)} loading={saving} submitLabel="Confirmer l'allocation" />
          </form>
        </Modal>
      )}
    </div>
  )
}
