import React, { useEffect, useState } from 'react'
import { Building2, Plus, RefreshCw, Edit2, Trash2, Search, X, Users, CheckCircle2, XCircle, MapPin } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Pagination } from '../components/Pagination'

interface Props { roleKey: string }
const PAGE_SIZE = 10

const TYPES_ORG = [
  { value: 'ISRA',           label: 'ISRA — Centre de recherche' },
  { value: 'UPSEML',         label: 'UPSemCL — Unité de production' },
  { value: 'MULTIPLICATEUR', label: 'Multiplicateur agréé' },
  { value: 'OP',             label: 'Organisation de producteurs' },
  { value: 'COOPERATIVE',    label: 'Coopérative' },
]

const REGIONS_SENEGAL = [
  'Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Louga', 'Matam',
  'Kaolack', 'Fatick', 'Kaffrine', 'Tambacounda', 'Kédougou',
  'Kolda', 'Sédhiou', 'Ziguinchor',
]

export function Organisations({ roleKey }: Props) {
  const [organisations, setOrganisations] = useState<any[]>([])
  const [membres, setMembres] = useState<any[]>([])
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
  const [showMembres, setShowMembres] = useState<any>(null)
  const [orgMembres, setOrgMembres] = useState<any[]>([])

  const canManage = ['seed-admin'].includes(roleKey)

  const [form, setForm] = useState({
    codeOrganisation: '', nomOrganisation: '', typeOrganisation: 'ISRA',
    region: '', localite: '', telephone: '', email: '',
    latitude: '', longitude: '', active: true,
  })

  async function fetchData() {
    setLoading(true)
    try {
      const r = await api.get(endpoints.organisations)
      setOrganisations(r.data)
    } catch { setOrganisations([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const filtered = organisations.filter(o => {
    const matchSearch = !search ||
      o.nomOrganisation?.toLowerCase().includes(search.toLowerCase()) ||
      o.codeOrganisation?.toLowerCase().includes(search.toLowerCase()) ||
      o.email?.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || o.typeOrganisation === filterType
    const matchRegion = !filterRegion || o.region === filterRegion
    return matchSearch && matchType && matchRegion
  })

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const activeCount = organisations.filter(o => o.active !== false).length

  function openCreate() {
    setEditItem(null)
    setForm({ codeOrganisation: '', nomOrganisation: '', typeOrganisation: 'ISRA', region: '', localite: '', telephone: '', email: '', latitude: '', longitude: '', active: true })
    setShowForm(true)
  }

  function openEdit(o: any) {
    setEditItem(o)
    setForm({
      codeOrganisation: o.codeOrganisation || '',
      nomOrganisation: o.nomOrganisation || '',
      typeOrganisation: o.typeOrganisation || 'ISRA',
      region: o.region || '', localite: o.localite || '',
      telephone: o.telephone || '', email: o.email || '',
      latitude: o.latitude != null ? String(o.latitude) : '',
      longitude: o.longitude != null ? String(o.longitude) : '',
      active: o.active !== false,
    })
    setShowForm(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        ...form,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      }
      if (editItem) {
        await api.put(endpoints.organisationById(editItem.id), payload)
        setToast({ msg: `Organisation "${form.nomOrganisation}" mise à jour`, type: 'success' })
      } else {
        await api.post(endpoints.organisations, payload)
        setToast({ msg: `Organisation "${form.nomOrganisation}" créée`, type: 'success' })
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
      setToast({ msg: `"${deleteTarget.nomOrganisation}" désactivée`, type: 'success' })
      setDeleteTarget(null); fetchData()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function viewMembres(org: any) {
    setShowMembres(org)
    try {
      const r = await api.get(endpoints.membresByOrg(org.id))
      setOrgMembres(r.data)
    } catch { setOrgMembres([]) }
  }

  const typeBadge = (type: string) => {
    const map: Record<string, string> = {
      'ISRA': 'badge-blue', 'UPSEML': 'badge-teal', 'MULTIPLICATEUR': 'badge-green',
      'OP': 'badge-gold', 'COOPERATIVE': 'badge-gray',
    }
    return map[type] || 'badge-gray'
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Désactiver cette organisation ?"
          message={`"${deleteTarget.nomOrganisation}" sera désactivée (soft delete). Les lots et membres existants ne seront pas affectés.`}
          confirmLabel="Désactiver" variant="danger" loading={saving}
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
              <input placeholder="Code, nom, email…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 180 }} />
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
          <div className="filter-group">
            <label className="filter-label">Région</label>
            <select className="input" value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setCurrentPage(1) }} style={{ width: 150 }}>
              <option value="">Toutes</option>
              {REGIONS_SENEGAL.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {(search || filterType || filterRegion) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterType(''); setFilterRegion(''); setCurrentPage(1) }}><X size={12} /> Effacer</button>}
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Localité</th><th>Région</th><th>Coordonnées</th><th>Statut</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>
              {loading ? [0,1,2,3].map(i => <tr key={i}><td colSpan={8}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                pageItems.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><Building2 size={20} /></div><div className="empty-title">{search || filterType ? 'Aucun résultat' : 'Aucune organisation'}</div>{canManage && !search && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openCreate}>+ Nouvelle organisation</button>}</div></td></tr>
                ) : pageItems.map(o => (
                  <tr key={o.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600, fontSize: 11.5 }}>{o.codeOrganisation}</span></td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{o.nomOrganisation}</div>
                        {o.telephone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.telephone}</div>}
                      </div>
                    </td>
                    <td><span className={"badge " + typeBadge(o.typeOrganisation)} style={{ fontSize: 11 }}>{TYPES_ORG.find(t => t.value === o.typeOrganisation)?.label?.split('—')[0]?.trim() || o.typeOrganisation}</span></td>
                    <td style={{ fontSize: 12.5 }}>{o.localite || '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{o.region || '—'}</td>
                    <td style={{ fontSize: 11 }}>
                      {o.latitude && o.longitude ? (
                        <span style={{ color: 'var(--green-700)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={10} /> {Number(o.latitude).toFixed(2)}, {Number(o.longitude).toFixed(2)}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {o.active !== false
                        ? <span className="badge badge-green" style={{ fontSize: 11 }}>Actif</span>
                        : <span className="badge badge-red" style={{ fontSize: 11 }}>Inactif</span>
                      }
                    </td>
                    {canManage && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} title="Membres" onClick={() => viewMembres(o)}><Users size={12} /></button>
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

      {/* ── Modal Création / Édition ── */}
      {showForm && (
        <Modal title={editItem ? `Modifier — ${editItem.codeOrganisation}` : 'Nouvelle Organisation'} subtitle="Acteur de la chaîne semencière" onClose={() => { setShowForm(false); setEditItem(null) }} size="lg">
          <form onSubmit={submitForm}>
            <FormRow>
              <Field label="Code organisation" required hint="Ex: ISRA-BAMBEY, MULTI-DIALLO">
                <FormInput value={form.codeOrganisation} onChange={e => setForm(f => ({ ...f, codeOrganisation: e.target.value.toUpperCase() }))} placeholder="ISRA-BAMBEY" required disabled={!!editItem} />
              </Field>
              <Field label="Nom complet" required>
                <FormInput value={form.nomOrganisation} onChange={e => setForm(f => ({ ...f, nomOrganisation: e.target.value }))} placeholder="ISRA CNRA Bambey" required />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Type" required>
                <FormSelect value={form.typeOrganisation} onChange={e => setForm(f => ({ ...f, typeOrganisation: e.target.value }))}>
                  {TYPES_ORG.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </FormSelect>
              </Field>
              <Field label="Région">
                <FormSelect value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {REGIONS_SENEGAL.map(r => <option key={r} value={r}>{r}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Localité"><FormInput value={form.localite} onChange={e => setForm(f => ({ ...f, localite: e.target.value }))} placeholder="Bambey, Nioro du Rip…" /></Field>
              <Field label="Statut">
                <FormSelect value={form.active ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, active: e.target.value === 'true' }))}>
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Téléphone"><FormInput value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} placeholder="+221 77 123 45 67" /></Field>
              <Field label="Email"><FormInput type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@isra.sn" /></Field>
            </FormRow>
            <FormRow>
              <Field label="Latitude" hint="Ex: 14.700000"><FormInput type="number" step="0.000001" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="14.700000" /></Field>
              <Field label="Longitude" hint="Ex: -16.450000"><FormInput type="number" step="0.000001" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-16.450000" /></Field>
            </FormRow>
            <FormActions onCancel={() => { setShowForm(false); setEditItem(null) }} loading={saving} submitLabel={editItem ? 'Mettre à jour' : 'Créer'} />
          </form>
        </Modal>
      )}

      {/* ── Modal Membres d'une organisation ── */}
      {showMembres && (
        <Modal title={`Membres — ${showMembres.nomOrganisation}`} subtitle={showMembres.codeOrganisation} onClose={() => { setShowMembres(null); setOrgMembres([]) }} size="md">
          {orgMembres.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <div className="empty-icon"><Users size={20} /></div>
              <div className="empty-title">Aucun membre lié</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Utilisez la page Utilisateurs pour lier des comptes Keycloak à cette organisation.</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Nom complet</th><th>Username</th><th>Rôle plateforme</th><th>Rôle dans l'org</th><th>Principal</th></tr></thead>
                <tbody>
                  {orgMembres.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.nomComplet}</td>
                      <td><span className="td-mono" style={{ fontSize: 11.5 }}>@{m.keycloakUsername}</span></td>
                      <td><span className="badge badge-blue" style={{ fontSize: 10.5 }}>{m.keycloakRole?.replace('seed-', '')}</span></td>
                      <td style={{ fontSize: 12 }}>{m.roleDansOrg || 'MEMBRE'}</td>
                      <td>{m.principal ? <CheckCircle2 size={14} color="var(--green-600)" /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
