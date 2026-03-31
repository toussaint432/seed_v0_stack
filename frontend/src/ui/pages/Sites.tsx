import React, { useEffect, useState } from 'react'
import { MapPin, Plus, RefreshCw, Edit2, Trash2, Search, X, Warehouse, Globe } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Pagination } from '../components/Pagination'

interface Props { roleKey: string }
const PAGE_SIZE = 10

const TYPES_SITE = [
  { value: 'MAGASIN', label: 'Magasin de stockage' },
  { value: 'FERME', label: 'Ferme de production' },
  { value: 'CENTRE_RECHERCHE', label: 'Centre de recherche' },
  { value: 'DEPOT', label: 'Dépôt' },
  { value: 'PARCELLE', label: 'Parcelle' },
]

const REGIONS_SENEGAL = [
  'Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Louga', 'Matam',
  'Kaolack', 'Fatick', 'Kaffrine', 'Tambacounda', 'Kédougou',
  'Kolda', 'Sédhiou', 'Ziguinchor',
]

export function Sites({ roleKey }: Props) {
  const [sites, setSites] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const canManage = ['seed-admin', 'seed-upsemcl', 'seed-multiplicator'].includes(roleKey)

  const [form, setForm] = useState({
    codeSite: '', nomSite: '', typeSite: 'MAGASIN', localite: '',
    region: '', latitude: '', longitude: '', idOrganisation: '',
  })

  async function fetchSites() {
    setLoading(true)
    try { const r = await api.get(endpoints.sites); setSites(r.data) }
    catch { setSites([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSites() }, [])

  const filtered = sites.filter(s => {
    const matchSearch = !search ||
      s.codeSite?.toLowerCase().includes(search.toLowerCase()) ||
      s.nomSite?.toLowerCase().includes(search.toLowerCase()) ||
      s.localite?.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || s.typeSite === filterType
    const matchRegion = !filterRegion || s.region === filterRegion
    return matchSearch && matchType && matchRegion
  })

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const regions = [...new Set(sites.map(s => s.region).filter(Boolean))]
  const typeCount = sites.reduce((acc: Record<string, number>, s: any) => {
    acc[s.typeSite] = (acc[s.typeSite] || 0) + 1; return acc
  }, {})

  function openCreate() {
    setEditItem(null)
    setForm({ codeSite: '', nomSite: '', typeSite: 'MAGASIN', localite: '', region: '', latitude: '', longitude: '', idOrganisation: '' })
    setShowForm(true)
  }

  function openEdit(s: any) {
    setEditItem(s)
    setForm({
      codeSite: s.codeSite || '', nomSite: s.nomSite || '', typeSite: s.typeSite || 'MAGASIN',
      localite: s.localite || '', region: s.region || '',
      latitude: s.latitude?.toString() || '', longitude: s.longitude?.toString() || '',
      idOrganisation: s.idOrganisation?.toString() || '',
    })
    setShowForm(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        idOrganisation: form.idOrganisation ? Number(form.idOrganisation) : undefined,
      }
      if (editItem) {
        await api.put(endpoints.siteById(editItem.id), payload)
        setToast({ msg: `Site "${form.nomSite}" mis à jour`, type: 'success' })
      } else {
        await api.post(endpoints.sites, payload)
        setToast({ msg: `Site "${form.nomSite}" créé`, type: 'success' })
      }
      setShowForm(false); setEditItem(null); fetchSites()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setSaving(true)
    try {
      await api.delete(endpoints.siteById(deleteTarget.id))
      setToast({ msg: `Site "${deleteTarget.nomSite}" supprimé`, type: 'success' })
      setDeleteTarget(null); fetchSites()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer ce site ?"
          message={`Le site "${deleteTarget.nomSite}" (${deleteTarget.codeSite}) sera supprimé.`}
          detail="Les stocks associés pourraient être affectés."
          confirmLabel="Supprimer" variant="danger" loading={saving}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><MapPin size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : sites.length}</div><div className="stat-label">Total sites</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><Warehouse size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : typeCount['MAGASIN'] || 0}</div><div className="stat-label">Magasins</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Globe size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : regions.length}</div><div className="stat-label">Régions couvertes</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><MapPin size={15} /></span>Sites <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}/{sites.length}</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManage && <button className="btn btn-primary" onClick={openCreate}><Plus size={13} /> Nouveau site</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchSites}><RefreshCw size={13} /></button>
          </div>
        </div>

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Code, nom, localité…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 180 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">Type</label>
            <select className="input" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1) }} style={{ width: 160 }}>
              <option value="">Tous</option>
              {TYPES_SITE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Région</label>
            <select className="input" value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setCurrentPage(1) }} style={{ width: 140 }}>
              <option value="">Toutes</option>
              {REGIONS_SENEGAL.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {(search || filterType || filterRegion) && (
            <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterType(''); setFilterRegion(''); setCurrentPage(1) }}><X size={12} /> Effacer</button>
          )}
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Localité</th><th>Région</th><th>Coordonnées</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>
              {loading ? [0, 1, 2, 3].map(i => <tr key={i}><td colSpan={7}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                pageItems.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon"><MapPin size={20} /></div><div className="empty-title">{search || filterType || filterRegion ? 'Aucun résultat' : 'Aucun site'}</div>{canManage && !search && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openCreate}>+ Nouveau site</button>}</div></td></tr>
                ) : pageItems.map(s => (
                  <tr key={s.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{s.codeSite}</span></td>
                    <td style={{ fontWeight: 500 }}>{s.nomSite}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 11 }}>{TYPES_SITE.find(t => t.value === s.typeSite)?.label || s.typeSite}</span></td>
                    <td style={{ fontSize: 12.5 }}>{s.localite || '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{s.region || '—'}</td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : '—'}
                    </td>
                    {canManage && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => openEdit(s)}><Edit2 size={12} /></button>
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', color: 'var(--red-600)' }} onClick={() => setDeleteTarget(s)}><Trash2 size={12} /></button>
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
        <Modal title={editItem ? `Modifier — ${editItem.codeSite}` : 'Nouveau Site'} subtitle="Site de stockage ou production de semences" onClose={() => { setShowForm(false); setEditItem(null) }}>
          <form onSubmit={submitForm}>
            <FormRow>
              <Field label="Code site" required hint="Ex: MAG-THIES"><FormInput value={form.codeSite} onChange={e => setForm(f => ({ ...f, codeSite: e.target.value.toUpperCase() }))} placeholder="MAG-THIES" required disabled={!!editItem} /></Field>
              <Field label="Nom du site" required><FormInput value={form.nomSite} onChange={e => setForm(f => ({ ...f, nomSite: e.target.value }))} placeholder="Magasin central Thiès" required /></Field>
            </FormRow>
            <FormRow>
              <Field label="Type" required>
                <FormSelect value={form.typeSite} onChange={e => setForm(f => ({ ...f, typeSite: e.target.value }))}>
                  {TYPES_SITE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </FormSelect>
              </Field>
              <Field label="Région">
                <FormSelect value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                  <option value="">-- Sélectionner --</option>
                  {REGIONS_SENEGAL.map(r => <option key={r} value={r}>{r}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <Field label="Localité"><FormInput value={form.localite} onChange={e => setForm(f => ({ ...f, localite: e.target.value }))} placeholder="Bambey, Diourbel" /></Field>
            <FormRow>
              <Field label="Latitude" hint="Ex: 14.6928"><FormInput type="number" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="14.6928" step="0.0000001" /></Field>
              <Field label="Longitude" hint="Ex: -17.4467"><FormInput type="number" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-17.4467" step="0.0000001" /></Field>
            </FormRow>
            <FormActions onCancel={() => { setShowForm(false); setEditItem(null) }} loading={saving} submitLabel={editItem ? 'Mettre à jour' : 'Créer le site'} />
          </form>
        </Modal>
      )}
    </div>
  )
}
