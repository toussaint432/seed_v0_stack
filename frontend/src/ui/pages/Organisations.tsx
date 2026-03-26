import React, { useEffect, useState } from 'react'
import { Building2, Plus, RefreshCw, Edit2, Trash2, Search, X, Users, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Pagination } from '../components/Pagination'

interface Props { roleKey: string }
const PAGE_SIZE = 10

const TYPES_ORG = [
  { value: 'RECHERCHE', label: 'Centre de recherche' },
  { value: 'UPSEM', label: 'UPSem / Unité de production' },
  { value: 'MULTIPLICATEUR', label: 'Multiplicateur privé' },
  { value: 'OP', label: 'Organisation de producteurs' },
  { value: 'COOPERATIVE', label: 'Coopérative' },
  { value: 'ONG', label: 'ONG / Projet' },
  { value: 'ETAT', label: 'Structure étatique' },
]

export function Organisations({ roleKey }: Props) {
  const [organisations, setOrganisations] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const canManage = ['seed-admin'].includes(roleKey)

  const [form, setForm] = useState({
    nom: '', sigle: '', typeOrganisation: 'RECHERCHE',
    telephone: '', email: '', adresse: '', statutActif: true,
  })

  async function fetchData() {
    setLoading(true)
    try { const r = await api.get(endpoints.organisations); setOrganisations(r.data) }
    catch { setOrganisations([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = organisations.filter(o => {
    const matchSearch = !search ||
      o.nom?.toLowerCase().includes(search.toLowerCase()) ||
      o.sigle?.toLowerCase().includes(search.toLowerCase()) ||
      o.email?.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || o.typeOrganisation === filterType || o.typeOrganisation?.codeType === filterType
    return matchSearch && matchType
  })

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const activeCount = organisations.filter(o => o.statutActif !== false).length

  function openCreate() {
    setEditItem(null)
    setForm({ nom: '', sigle: '', typeOrganisation: 'RECHERCHE', telephone: '', email: '', adresse: '', statutActif: true })
    setShowForm(true)
  }

  function openEdit(o: any) {
    setEditItem(o)
    setForm({
      nom: o.nom || '', sigle: o.sigle || '',
      typeOrganisation: o.typeOrganisation?.codeType || o.typeOrganisation || 'RECHERCHE',
      telephone: o.telephone || '', email: o.email || '', adresse: o.adresse || '',
      statutActif: o.statutActif !== false,
    })
    setShowForm(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      if (editItem) {
        await api.put(endpoints.organisationById(editItem.id), form)
        setToast({ msg: `Organisation "${form.nom}" mise à jour`, type: 'success' })
      } else {
        await api.post(endpoints.organisations, form)
        setToast({ msg: `Organisation "${form.nom}" créée`, type: 'success' })
      }
      setShowForm(false); setEditItem(null); fetchData()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setSaving(true)
    try {
      await api.delete(endpoints.organisationById(deleteTarget.id))
      setToast({ msg: `"${deleteTarget.nom}" supprimé`, type: 'success' })
      setDeleteTarget(null); fetchData()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer cette organisation ?"
          message={`"${deleteTarget.nom}" sera définitivement supprimé. Les utilisateurs et lots liés seront affectés.`}
          confirmLabel="Supprimer" variant="danger" loading={saving}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><Building2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : organisations.length}</div><div className="stat-label">Organisations</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : activeCount}</div><div className="stat-label">Actives</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : organisations.length - activeCount}</div><div className="stat-label">Inactives</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><Building2 size={15} /></span>Organisations <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}/{organisations.length}</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManage && <button className="btn btn-primary" onClick={openCreate}><Plus size={13} /> Nouvelle organisation</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchData}><RefreshCw size={13} /></button>
          </div>
        </div>

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Nom, sigle, email…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 200 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">Type</label>
            <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1) }} style={{ width: 180 }}>
              <option value="">Tous les types</option>
              {TYPES_ORG.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {(search || filterType) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterType(''); setCurrentPage(1) }}><X size={12} /> Effacer</button>}
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr><th>Nom</th><th>Sigle</th><th>Type</th><th>Téléphone</th><th>Email</th><th>Statut</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>
              {loading ? [0, 1, 2, 3].map(i => <tr key={i}><td colSpan={7}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                pageItems.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon"><Building2 size={20} /></div><div className="empty-title">{search || filterType ? 'Aucun résultat' : 'Aucune organisation'}</div>{canManage && !search && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openCreate}>+ Nouvelle organisation</button>}</div></td></tr>
                ) : pageItems.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.nom}</td>
                    <td><span className="td-mono">{o.sigle || '—'}</span></td>
                    <td>
                      <span className="badge badge-blue" style={{ fontSize: 11 }}>
                        {TYPES_ORG.find(t => t.value === (o.typeOrganisation?.codeType || o.typeOrganisation))?.label || o.typeOrganisation?.libelle || o.typeOrganisation || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5 }}>{o.telephone || '—'}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{o.email || '—'}</td>
                    <td>
                      {o.statutActif !== false
                        ? <span className="badge badge-green" style={{ fontSize: 11 }}><CheckCircle2 size={10} /> Actif</span>
                        : <span className="badge badge-red" style={{ fontSize: 11 }}><XCircle size={10} /> Inactif</span>
                      }
                    </td>
                    {canManage && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => openEdit(o)}><Edit2 size={12} /></button>
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', color: 'var(--red-600)' }} onClick={() => setDeleteTarget(o)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      </div>

      {showForm && (
        <Modal title={editItem ? `Modifier — ${editItem.sigle || editItem.nom}` : 'Nouvelle Organisation'} subtitle="Acteur de la chaîne semencière" onClose={() => { setShowForm(false); setEditItem(null) }} size="lg">
          <form onSubmit={submitForm}>
            <FormRow>
              <Field label="Nom complet" required><FormInput value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Institut Sénégalais de Recherches Agricoles" required /></Field>
              <Field label="Sigle"><FormInput value={form.sigle} onChange={e => setForm(f => ({ ...f, sigle: e.target.value.toUpperCase() }))} placeholder="ISRA" /></Field>
            </FormRow>
            <FormRow>
              <Field label="Type d'organisation" required>
                <FormSelect value={form.typeOrganisation} onChange={e => setForm(f => ({ ...f, typeOrganisation: e.target.value }))}>
                  {TYPES_ORG.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </FormSelect>
              </Field>
              <Field label="Statut">
                <FormSelect value={form.statutActif ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, statutActif: e.target.value === 'true' }))}>
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Téléphone"><FormInput value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+221 77 123 45 67" /></Field>
              <Field label="Email"><FormInput type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@isra.sn" /></Field>
            </FormRow>
            <Field label="Adresse">
              <textarea value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} placeholder="Adresse complète…" style={{ width: '100%', minHeight: 60, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => { setShowForm(false); setEditItem(null) }} loading={saving} submitLabel={editItem ? 'Mettre à jour' : 'Créer'} />
          </form>
        </Modal>
      )}
    </div>
  )
}
