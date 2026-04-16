import React, { useEffect, useState } from 'react'
import { Calendar, Plus, RefreshCw, Edit2, Trash2, Eye, X, CheckCircle2, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface Props { roleKey: string }

const TYPE_CAMPAGNE = [
  { value: 'HIVERNALE', label: 'Hivernale' },
  { value: 'CONTRE_SAISON', label: 'Contre-saison' },
  { value: 'IRRIGUEE', label: 'Irriguée' },
]

export function Campagnes({ roleKey }: Props) {
  const [campagnes, setCampagnes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const canManage = ['seed-admin'].includes(roleKey)

  const [form, setForm] = useState({
    codeCampagne: '', libelle: '', dateDebut: '', dateFin: '',
    typeCampagne: 'HIVERNALE', statut: 'PLANIFIEE',
  })

  async function fetchData() {
    setLoading(true)
    try {
      const r = await api.get(endpoints.campagnes)
      setCampagnes(r.data)
    } catch { setCampagnes([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const activeCount = campagnes.filter(c => c.statut === 'EN_COURS').length

  function openCreate() {
    setEditItem(null)
    setForm({ codeCampagne: '', libelle: '', dateDebut: '', dateFin: '', typeCampagne: 'HIVERNALE', statut: 'PLANIFIEE' })
    setShowForm(true)
  }

  function openEdit(c: any) {
    setEditItem(c)
    setForm({
      codeCampagne: c.codeCampagne || '', libelle: c.libelle || '',
      dateDebut: c.dateDebut || '', dateFin: c.dateFin || '',
      typeCampagne: c.typeCampagne || 'HIVERNALE', statut: c.statut || 'PLANIFIEE',
    })
    setShowForm(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      if (editItem) {
        await api.put(`${endpoints.campagnes}/${editItem.id}`, form)
        setToast({ msg: `Campagne "${form.libelle}" mise à jour`, type: 'success' })
      } else {
        await api.post(endpoints.campagnes, form)
        setToast({ msg: `Campagne "${form.libelle}" créée`, type: 'success' })
      }
      setShowForm(false); setEditItem(null); fetchData()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setSaving(true)
    try {
      await api.delete(`${endpoints.campagnes}/${deleteTarget.id}`)
      setToast({ msg: `Campagne "${deleteTarget.libelle}" supprimée`, type: 'success' })
      setDeleteTarget(null); fetchData()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur de suppression', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer cette campagne ?"
          message={`La campagne "${deleteTarget.libelle}" sera définitivement supprimée.`}
          confirmLabel="Supprimer" variant="danger" loading={saving}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon green"><Calendar size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : campagnes.length}</div><div className="stat-label">Total campagnes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><CheckCircle2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : activeCount}</div><div className="stat-label">Ouvertes</div></div></div>
        <div className="stat-card"><div className="stat-icon blue"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : campagnes.length - activeCount}</div><div className="stat-label">Fermées</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><Calendar size={15} /></span>Campagnes agricoles</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManage && <button className="btn btn-primary" onClick={openCreate}><Plus size={13} /> Nouvelle campagne</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchData}><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Code</th><th>Libellé</th><th>Type</th><th>Début</th><th>Fin</th><th>Statut</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>
              {loading ? [0, 1, 2].map(i => <tr key={i}><td colSpan={7}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                campagnes.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon"><Calendar size={20} /></div><div className="empty-title">Aucune campagne</div>{canManage && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openCreate}>+ Créer une campagne</button>}</div></td></tr>
                ) : campagnes.map(c => (
                  <tr key={c.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{c.codeCampagne}</span></td>
                    <td style={{ fontWeight: 500 }}>{c.libelle}</td>
                    <td><span className="badge badge-blue" style={{ fontSize: 11 }}>{c.typeCampagne || '—'}</span></td>
                    <td style={{ fontSize: 12.5 }}>{c.dateDebut ? new Date(c.dateDebut).toLocaleDateString('fr-FR') : '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{c.dateFin ? new Date(c.dateFin).toLocaleDateString('fr-FR') : '—'}</td>
                    <td><StatusBadge status={c.statut} showIcon /></td>
                    {canManage && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => openEdit(c)}><Edit2 size={12} /></button>
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', color: 'var(--red-600)' }} onClick={() => setDeleteTarget(c)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title={editItem ? `Modifier — ${editItem.codeCampagne}` : 'Nouvelle Campagne'} subtitle="Campagne agricole pour la production de semences" onClose={() => { setShowForm(false); setEditItem(null) }}>
          <form onSubmit={submitForm}>
            <FormRow>
              <Field label="Code campagne" required hint="Ex: CAMP-HIV-2026"><FormInput value={form.codeCampagne} onChange={e => setForm(f => ({ ...f, codeCampagne: e.target.value.toUpperCase() }))} placeholder="CAMP-HIV-2026" required disabled={!!editItem} /></Field>
              <Field label="Libellé" required><FormInput value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))} placeholder="Campagne Hivernale 2026" required /></Field>
            </FormRow>
            <FormRow>
              <Field label="Type de campagne">
                <FormSelect value={form.typeCampagne} onChange={e => setForm(f => ({ ...f, typeCampagne: e.target.value }))}>
                  {TYPE_CAMPAGNE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </FormSelect>
              </Field>
              <Field label="Statut">
                <FormSelect value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                  <option value="PLANIFIEE">Planifiée</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="TERMINEE">Terminée</option>
                  <option value="ANNULEE">Annulée</option>
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Date de début" required><FormInput type="date" value={form.dateDebut} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))} required /></Field>
              <Field label="Date de fin" required><FormInput type="date" value={form.dateFin} onChange={e => setForm(f => ({ ...f, dateFin: e.target.value }))} required /></Field>
            </FormRow>
            <FormActions onCancel={() => { setShowForm(false); setEditItem(null) }} loading={saving} submitLabel={editItem ? 'Mettre à jour' : 'Créer la campagne'} />
          </form>
        </Modal>
      )}
    </div>
  )
}
