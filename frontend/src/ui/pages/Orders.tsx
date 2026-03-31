import React, { useEffect, useState } from 'react'
import {
  ShoppingCart, RefreshCw, Plus, Settings2, Clock, XCircle, PackageCheck,
  Search, X, ChevronLeft, ChevronRight, CheckCircle2, Ban, Eye, Building2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  SOUMISE:   { label: 'Soumise',   bg: '#eff6ff', color: '#1d4ed8' },
  CONFIRMEE: { label: 'Confirmée', bg: '#f0fdf4', color: '#15803d' },
  ANNULEE:   { label: 'Annulée',   bg: '#fef2f2', color: '#dc2626' },
  ALLOUEE:   { label: 'Allouée',   bg: '#fdf4ff', color: '#7e22ce' },
  // alias anciens statuts
  PENDING:    { label: 'En attente', bg: '#fef9ed', color: '#92660a' },
  EN_ATTENTE: { label: 'En attente', bg: '#fef9ed', color: '#92660a' },
  CONFIRMED:  { label: 'Confirmée',  bg: '#f0fdf4', color: '#15803d' },
  ALLOCATED:  { label: 'Allouée',    bg: '#fdf4ff', color: '#7e22ce' },
  CANCELLED:  { label: 'Annulée',    bg: '#fef2f2', color: '#dc2626' },
}

const PAGE_SIZE = 10

function StatusBadge({ statut }: { statut: string }) {
  const cfg = STATUS_CFG[statut]
  return cfg
    ? <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
    : <span className="badge badge-gray">{statut || '—'}</span>
}

function OrderTable({ orders, loading, emptyMsg }: { orders: any[]; loading: boolean; emptyMsg: string }) {
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<any>(null)
  const total = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
  const slice = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Code commande</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Fournisseur (org)</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [0,1,2,3].map(i => <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
              : orders.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><ShoppingCart size={20} /></div><div className="empty-title">{emptyMsg}</div></div></td></tr>
                : slice.map(o => (
                  <tr key={o.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                    <td style={{ fontWeight: 500 }}>{o.client || '—'}</td>
                    <td><StatusBadge statut={o.statut} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.idOrganisationFournisseur ? `Org #${o.idOrganisationFournisseur}` : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                    <td><button className="btn btn-ghost btn-icon" onClick={() => setDetail(o)}><Eye size={13} /></button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {!loading && orders.length > PAGE_SIZE && (
        <div className="pagination">
          <span className="pagination-info">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, orders.length)} sur {orders.length}</span>
          <div className="pagination-btns">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></button>
            {Array.from({ length: Math.min(total,5) }, (_,i) => i+1).map(n => (
              <button key={n} className={"page-btn " + (page===n?'active':'')} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="page-btn" onClick={() => setPage(p => Math.min(total,p+1))} disabled={page===total}><ChevronRight size={13} /></button>
          </div>
        </div>
      )}

      {detail && (
        <Modal title={`Commande — ${detail.codeCommande}`} subtitle="Détail de la commande" onClose={() => setDetail(null)} size="sm">
          <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
            {[
              ['Client', detail.client],
              ['Statut', <StatusBadge key="s" statut={detail.statut} />],
              ['Acheteur', detail.usernameAcheteur || '—'],
              ['Org acheteur', detail.idOrganisationAcheteur ? `#${detail.idOrganisationAcheteur}` : '—'],
              ['Org fournisseur', detail.idOrganisationFournisseur ? `#${detail.idOrganisationFournisseur}` : '—'],
              ['Observations', detail.observations || '—'],
              ['Créée le', detail.createdAt ? new Date(detail.createdAt).toLocaleString('fr-FR') : '—'],
            ].map(([k, v]) => (
              <div key={String(k)} style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span style={{ minWidth: 130, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE QUOTATAIRE — mes commandes + nouvelle commande
   ══════════════════════════════════════════════════════════════ */
function VueQuotataire({ setToast }: { toast: any; setToast: any }) {
  const [orders, setOrders]       = useState<any[]>([])
  const [orgs, setOrgs]           = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)

  const [form, setForm] = useState({
    idOrganisationFournisseur: '',
    observations: '',
    lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }],
  })

  async function fetchAll() {
    setLoading(true)
    const [ordRes, orgRes] = await Promise.allSettled([
      api.get(endpoints.ordersMesCommandes),
      api.get(endpoints.organisations),
    ])
    setOrders(ordRes.status === 'fulfilled' ? ordRes.value.data : [])
    if (orgRes.status === 'fulfilled') {
      setOrgs(orgRes.value.data.filter((o: any) =>
        o.typeOrganisation?.toLowerCase().includes('multiplic') && o.active !== false
      ))
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  function addLigne() {
    setForm(f => ({ ...f, lignes: [...f.lignes, { idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] }))
  }
  function removeLigne(i: number) {
    setForm(f => ({ ...f, lignes: f.lignes.filter((_, idx) => idx !== i) }))
  }
  function updateLigne(i: number, field: string, value: string) {
    setForm(f => ({ ...f, lignes: f.lignes.map((l, idx) => idx === i ? { ...l, [field]: value } : l) }))
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const code = 'CMD-' + Date.now().toString(36).toUpperCase()
      await api.post(endpoints.orders, {
        codeCommande: code,
        client: 'Commande portail',
        idOrganisationFournisseur: form.idOrganisationFournisseur ? Number(form.idOrganisationFournisseur) : null,
        observations: form.observations || null,
        lignes: form.lignes.map(l => ({
          idVariete: Number(l.idVariete),
          idGeneration: Number(l.idGeneration),
          quantite: Number(l.quantite),
          unite: l.unite,
        })),
      })
      setToast({ msg: `Commande ${code} soumise avec succès`, type: 'success' })
      setShowForm(false)
      setForm({ idOrganisationFournisseur: '', observations: '', lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la soumission', type: 'error' })
    } finally { setSaving(false) }
  }

  const soumises   = orders.filter(o => o.statut === 'SOUMISE').length
  const confirmees = orders.filter(o => o.statut === 'CONFIRMEE').length
  const annulees   = orders.filter(o => o.statut === 'ANNULEE').length

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><ShoppingCart size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : orders.length}</div><div className="stat-label">Mes commandes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : soumises}</div><div className="stat-label">En attente</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><PackageCheck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : confirmees}</div><div className="stat-label">Confirmées</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : annulees}</div><div className="stat-label">Annulées</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><ShoppingCart size={15} /></span>Mes commandes</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Nouvelle commande</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>
        <OrderTable orders={orders} loading={loading} emptyMsg="Aucune commande passée" />
      </div>

      {showForm && (
        <Modal title="Nouvelle Commande" subtitle="Soumettre une demande de semences certifiées" onClose={() => setShowForm(false)} size="lg">
          <form onSubmit={submitOrder}>
            <Field label="Organisation fournisseur" hint="Multiplicateur qui fournira les semences">
              <FormSelect value={form.idOrganisationFournisseur} onChange={e => setForm(f => ({ ...f, idOrganisationFournisseur: e.target.value }))}>
                <option value="">— Choisir un fournisseur —</option>
                {orgs.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.nomOrganisation} ({o.region || o.localite || 'N/A'})</option>
                ))}
              </FormSelect>
            </Field>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lignes de commande <span style={{ color: 'var(--red-500)' }}>*</span></label>
                <button type="button" className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={addLigne}><Plus size={11} /> Ajouter</button>
              </div>
              {form.lignes.map((ligne, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Ligne {i+1}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <Field label="ID variété" required><FormInput type="number" value={ligne.idVariete} onChange={e => updateLigne(i,'idVariete',e.target.value)} placeholder="Ex: 12" required /></Field>
                    <Field label="Génération" required>
                      <FormSelect value={ligne.idGeneration} onChange={e => updateLigne(i,'idGeneration',e.target.value)}>
                        <option value="1">G0</option><option value="2">G1</option><option value="3">G2</option>
                        <option value="4">G3</option><option value="5">G4</option><option value="6">R1</option><option value="7">R2</option>
                      </FormSelect>
                    </Field>
                    <Field label="Quantité" required>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <FormInput type="number" value={ligne.quantite} onChange={e => updateLigne(i,'quantite',e.target.value)} placeholder="500" min="1" required style={{ flex: 1 }} />
                        <FormSelect value={ligne.unite} onChange={e => updateLigne(i,'unite',e.target.value)} style={{ width: 70 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                      </div>
                    </Field>
                    {form.lignes.length > 1 && (
                      <button type="button" onClick={() => removeLigne(i)} style={{ height: 36, width: 36, background: 'var(--red-50)', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: 'var(--red-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}><X size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Field label="Observations">
              <textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Précisions sur la commande, urgence, qualité attendue..." rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setShowForm(false)} loading={saving} submitLabel="Soumettre la commande" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE MULTIPLICATEUR — commandes à traiter
   ══════════════════════════════════════════════════════════════ */
function VueMultiplicateur({ setToast }: { toast: any; setToast: any }) {
  const [orders, setOrders]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [refusModal, setRefusModal] = useState<{ id: number; code: string } | null>(null)
  const [motif, setMotif]         = useState('')
  const [saving, setSaving]       = useState(false)

  async function fetchAll() {
    setLoading(true)
    api.get(endpoints.ordersATraiter).then(r => setOrders(r.data)).catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  async function confirmer(id: number) {
    setSaving(true)
    try {
      await api.put(endpoints.orderStatut(id), { statut: 'CONFIRMEE' })
      setToast({ msg: 'Commande confirmée', type: 'success' })
      fetchAll()
    } catch { setToast({ msg: 'Erreur lors de la confirmation', type: 'error' }) }
    finally { setSaving(false) }
  }

  async function refuser(e: React.FormEvent) {
    e.preventDefault()
    if (!refusModal) return
    setSaving(true)
    try {
      await api.put(endpoints.orderStatut(refusModal.id), { statut: 'ANNULEE', observations: motif })
      setToast({ msg: `Commande ${refusModal.code} annulée`, type: 'success' })
      setRefusModal(null); setMotif('')
      fetchAll()
    } catch { setToast({ msg: 'Erreur lors du refus', type: 'error' }) }
    finally { setSaving(false) }
  }

  const soumises   = orders.filter(o => o.statut === 'SOUMISE').length
  const confirmees = orders.filter(o => o.statut === 'CONFIRMEE').length
  const annulees   = orders.filter(o => o.statut === 'ANNULEE').length

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><Building2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : orders.length}</div><div className="stat-label">Commandes reçues</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : soumises}</div><div className="stat-label">À traiter</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><PackageCheck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : confirmees}</div><div className="stat-label">Confirmées</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : annulees}</div><div className="stat-label">Annulées</div></div></div>
      </div>

      {soumises > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#1d4ed8' }}>
          <Clock size={16} />
          <strong>{soumises} commande{soumises > 1 ? 's' : ''} en attente</strong> de votre décision.
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><ShoppingCart size={15} /></span>Commandes de mon organisation</span>
          <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Acheteur</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0,1,2].map(i => <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                : orders.length === 0
                  ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><Building2 size={20} /></div><div className="empty-title">Aucune commande reçue</div></div></td></tr>
                  : orders.map(o => (
                    <tr key={o.id}>
                      <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                      <td style={{ fontWeight: 500 }}>{o.client || '—'}</td>
                      <td><StatusBadge statut={o.statut} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.usernameAcheteur || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>
                        {o.statut === 'SOUMISE' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px' }} onClick={() => confirmer(o.id)} disabled={saving}>
                              <CheckCircle2 size={12} /> Confirmer
                            </button>
                            <button className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 10px', color: 'var(--red-600)', border: '1px solid #fecaca' }} onClick={() => { setRefusModal({ id: o.id, code: o.codeCommande }); setMotif('') }} disabled={saving}>
                              <Ban size={12} /> Annuler
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {refusModal && (
        <Modal title="Annuler la commande" subtitle={`Commande ${refusModal.code}`} onClose={() => setRefusModal(null)} size="sm">
          <form onSubmit={refuser}>
            <Field label="Motif d'annulation" required hint="Ce motif sera visible par le quotataire">
              <textarea value={motif} onChange={e => setMotif(e.target.value)} placeholder="Stock insuffisant, variété indisponible..." rows={4} required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setRefusModal(null)} loading={saving} submitLabel="Confirmer l'annulation" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE ADMIN / UPSEMCL — toutes les commandes + allocation
   ══════════════════════════════════════════════════════════════ */
function VueAdmin({ setToast }: { toast: any; setToast: any }) {
  const [orders, setOrders]       = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [showAlloc, setShowAlloc] = useState(false)
  const [allocForm, setAllocForm] = useState({ idLigne: '', idLot: '', quantite: '' })
  const [saving, setSaving]       = useState(false)

  async function fetchOrders() {
    setLoading(true)
    api.get(endpoints.orders).then(r => setOrders(r.data)).catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [])

  const statuses = [...new Set(orders.map((o: any) => o.statut).filter(Boolean))]
  const filtered = orders.filter(o => {
    const ms = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    const mf = !filterStatus || o.statut === filterStatus
    return ms && mf
  })

  async function submitAlloc(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.orderAllocate, { idLigne: Number(allocForm.idLigne), idLot: Number(allocForm.idLot), quantite: Number(allocForm.quantite) })
      setToast({ msg: 'Allocation enregistrée', type: 'success' })
      setShowAlloc(false); setAllocForm({ idLigne: '', idLot: '', quantite: '' })
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur allocation', type: 'error' })
    } finally { setSaving(false) }
  }

  const pending   = orders.filter(o => ['SOUMISE','PENDING','EN_ATTENTE'].includes(o.statut)).length
  const allocated = orders.filter(o => ['ALLOUEE','ALLOCATED'].includes(o.statut)).length
  const cancelled = orders.filter(o => ['ANNULEE','CANCELLED'].includes(o.statut)).length

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><ShoppingCart size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : orders.length}</div><div className="stat-label">Total commandes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : pending}</div><div className="stat-label">En attente</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><PackageCheck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : allocated}</div><div className="stat-label">Allouées</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : cancelled}</div><div className="stat-label">Annulées</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><ShoppingCart size={15} /></span>Toutes les commandes <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}/{orders.length}</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowAlloc(true)}><Settings2 size={13} /> Allouer</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchOrders}><RefreshCw size={13} /></button>
          </div>
        </div>

        {!loading && statuses.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button className={"gen-chain-btn " + (!filterStatus ? 'active' : '')} onClick={() => setFilter('')}>Tous ({orders.length})</button>
            {statuses.map(s => {
              const cfg = STATUS_CFG[s]; if (!cfg) return null
              return <button key={s} className={"gen-chain-btn " + (filterStatus===s?'active':'')} style={{ color: cfg.color }} onClick={() => setFilter(filterStatus===s ? '' : s)}>{cfg.label} ({orders.filter(o=>o.statut===s).length})</button>
            })}
          </div>
        )}

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Code commande ou client..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 200 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          {(search || filterStatus) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilter('') }}><X size={12} /> Effacer</button>}
        </div>

        <OrderTable orders={filtered} loading={loading} emptyMsg="Aucune commande" />
      </div>

      {showAlloc && (
        <Modal title="Allouer un Lot à une Commande" subtitle="Affecter un lot de semences à une ligne de commande" onClose={() => setShowAlloc(false)} size="sm">
          <div style={{ background: 'var(--blue-50)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1d4ed8' }}>
            Trouvez l'ID de la ligne dans le détail de la commande.
          </div>
          <form onSubmit={submitAlloc}>
            <Field label="ID ligne de commande" required><FormInput type="number" value={allocForm.idLigne} onChange={e => setAllocForm(f => ({ ...f, idLigne: e.target.value }))} placeholder="1" required /></Field>
            <Field label="ID du lot" required><FormInput type="number" value={allocForm.idLot} onChange={e => setAllocForm(f => ({ ...f, idLot: e.target.value }))} placeholder="22" required /></Field>
            <Field label="Quantité à allouer" required><FormInput type="number" value={allocForm.quantite} onChange={e => setAllocForm(f => ({ ...f, quantite: e.target.value }))} placeholder="1000" min="1" step="0.01" required /></Field>
            <FormActions onCancel={() => setShowAlloc(false)} loading={saving} submitLabel="Confirmer l'allocation" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL — dispatch par rôle
   ══════════════════════════════════════════════════════════════ */
export function Orders({ roleKey }: Props) {
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {roleKey === 'seed-quotataire'
        ? <VueQuotataire toast={toast} setToast={setToast} />
        : roleKey === 'seed-multiplicator'
          ? <VueMultiplicateur toast={toast} setToast={setToast} />
          : <VueAdmin toast={toast} setToast={setToast} />
      }
    </div>
  )
}
