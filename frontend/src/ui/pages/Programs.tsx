import React, { useEffect, useState } from 'react'
import {
  Workflow, Plus, RefreshCw, Search, X, Eye, Edit2, Trash2,
  Target, MapPin, BarChart3, Clock, CheckCircle2
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Pagination } from '../components/Pagination'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface Props { roleKey: string }
const PAGE_SIZE = 10

const STATUT_OPTIONS = [
  { value: 'PLANIFIE', label: 'Planifié' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'TERMINE', label: 'Terminé' },
  { value: 'ANNULE', label: 'Annulé' },
]

const ALL_GENS = ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2']


export function Programs({ roleKey }: Props) {
  const [programs, setPrograms] = useState<any[]>([])
  const [lots, setLots] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const canCreate = ['seed-admin', 'seed-upsemcl'].includes(roleKey)
  const canManage = ['seed-admin', 'seed-upsemcl', 'seed-multiplicator'].includes(roleKey)

  const [form, setForm] = useState({
    codeProgramme: '', idLotSource: '', generationCible: 'G3',
    multiplicateur: '', campagne: '', surfacePrevueHa: '',
    quantiteSemenceAllouee: '', dateAttribution: new Date().toISOString().split('T')[0],
    statutProgramme: 'PLANIFIE', observations: '',
  })

  async function fetchAll() {
    setLoading(true)
    const lotsUrl = roleKey === 'seed-multiplicator' ? endpoints.lotsMesLots : endpoints.lots
    const [pRes, lRes] = await Promise.allSettled([
      api.get(endpoints.programs),
      api.get(lotsUrl),
    ])
    setPrograms(pRes.status === 'fulfilled' ? pRes.value.data : [])
    setLots(lRes.status === 'fulfilled' ? lRes.value.data : [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = programs.filter(p => {
    const matchSearch = !search ||
      p.codeProgramme?.toLowerCase().includes(search.toLowerCase()) ||
      p.multiplicateur?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || p.statut === filterStatus
    return matchSearch && matchStatus
  })

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const byStatus = programs.reduce((acc: Record<string, number>, p: any) => {
    acc[p.statut] = (acc[p.statut] || 0) + 1; return acc
  }, {})
  const totalSurface = programs.reduce((sum, p) => sum + (parseFloat(p.superficieHa) || 0), 0)

  function openCreate() {
    setEditItem(null)
    setForm({ codeProgramme: '', idLotSource: '', generationCible: 'G3', multiplicateur: '', campagne: '', surfacePrevueHa: '', quantiteSemenceAllouee: '', dateAttribution: new Date().toISOString().split('T')[0], statutProgramme: 'PLANIFIE', observations: '' })
    setShowForm(true)
  }

  function openEdit(p: any) {
    setEditItem(p)
    setForm({
      codeProgramme: p.codeProgramme || '', idLotSource: p.idLot?.toString() || '',
      generationCible: p.generationCible || 'G3',
      multiplicateur: '',
      campagne: '',
      surfacePrevueHa: p.superficieHa?.toString() || '',
      quantiteSemenceAllouee: p.objectifKg?.toString() || '',
      dateAttribution: p.dateDebut || new Date().toISOString().split('T')[0],
      statutProgramme: p.statut || 'PLANIFIE', observations: p.observations || '',
    })
    setShowForm(true)
  }

  function getLotLabel(id: number): string {
    const lot = lots.find((l: any) => l.id === id)
    return lot ? lot.codeLot : `#${id}`
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const obs = [
        form.multiplicateur ? `Multiplicateur : ${form.multiplicateur}` : '',
        form.campagne ? `Campagne : ${form.campagne}` : '',
        form.observations || '',
      ].filter(Boolean).join(' — ') || undefined
      const payload = {
        codeProgramme: form.codeProgramme,
        idLot: Number(form.idLotSource),
        generationCible: form.generationCible,
        superficieHa: form.surfacePrevueHa ? Number(form.surfacePrevueHa) : undefined,
        objectifKg: form.quantiteSemenceAllouee ? Number(form.quantiteSemenceAllouee) : undefined,
        dateDebut: form.dateAttribution || undefined,
        statut: form.statutProgramme,
        observations: obs,
      }
      if (editItem) {
        await api.put(endpoints.programById(editItem.id), payload)
        setToast({ msg: `Programme "${form.codeProgramme}" mis à jour`, type: 'success' })
      } else {
        await api.post(endpoints.programs, payload)
        setToast({ msg: `Programme "${form.codeProgramme}" créé`, type: 'success' })
      }
      setShowForm(false); setEditItem(null); fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return; setSaving(true)
    try {
      await api.delete(endpoints.programById(deleteTarget.id))
      setToast({ msg: `Programme "${deleteTarget.codeProgramme}" supprimé`, type: 'success' })
      setDeleteTarget(null); fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer ce programme ?"
          message={`Le programme "${deleteTarget.codeProgramme}" sera supprimé avec ses parcelles et rendements.`}
          confirmLabel="Supprimer" variant="danger" loading={saving}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon violet"><Workflow size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : programs.length}</div><div className="stat-label">Programmes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['EN_COURS'] || 0}</div><div className="stat-label">En cours</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['TERMINE'] || 0}</div><div className="stat-label">Terminés</div></div></div>
        <div className="stat-card"><div className="stat-icon blue"><MapPin size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : totalSurface.toLocaleString('fr-FR')}</div><div className="stat-label">Surface totale (ha)</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><Workflow size={15} /></span>Programmes de multiplication <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canCreate && <button className="btn btn-primary" onClick={openCreate}><Plus size={13} /> Nouveau programme</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Code, multiplicateur…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 200 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">Statut</label>
            <select className="input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1) }} style={{ width: 140 }}>
              <option value="">Tous</option>
              {STATUT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {(search || filterStatus) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterStatus(''); setCurrentPage(1) }}><X size={12} /> Effacer</button>}
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr><th>Code</th><th>Lot source</th><th>Gén. cible</th><th>Multiplicateur</th><th>Surface (ha)</th><th>Qté allouée</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? [0, 1, 2, 3].map(i => <tr key={i}><td colSpan={8}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                pageItems.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><Workflow size={20} /></div><div className="empty-title">{search || filterStatus ? 'Aucun résultat' : 'Aucun programme'}</div>{canCreate && !search && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openCreate}>+ Nouveau programme</button>}</div></td></tr>
                ) : pageItems.map(p => (
                  <tr key={p.id}>
                    <td><span className="td-mono" style={{ fontWeight: 700 }}>{p.codeProgramme}</span></td>
                    <td><span className="td-mono" style={{ fontSize: 11 }}>{p.idLot ? getLotLabel(p.idLot) : '—'}</span></td>
                    <td><span className="badge badge-gold" style={{ fontSize: 11 }}>{p.generationCible || '—'}</span></td>
                    <td style={{ fontWeight: 500, fontSize: 12.5 }}>—</td>
                    <td style={{ fontWeight: 600 }}>{p.superficieHa ? Number(p.superficieHa).toLocaleString('fr-FR') : '—'}</td>
                    <td>{p.objectifKg ? <><span style={{ fontWeight: 600 }}>{Number(p.objectifKg).toLocaleString('fr-FR')}</span> <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>kg</span></> : '—'}</td>
                    <td><StatusBadge status={p.statut} showIcon /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => setShowDetail(p)}><Eye size={12} /></button>
                        {canManage && <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => openEdit(p)}><Edit2 size={12} /></button>}
                        {canCreate && <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', color: 'var(--red-600)' }} onClick={() => setDeleteTarget(p)}><Trash2 size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      </div>

      {/* Detail */}
      {showDetail && (
        <Modal title={`Programme — ${showDetail.codeProgramme}`} subtitle="Détails du programme de multiplication" onClose={() => setShowDetail(null)} size="lg">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Lot source</div><div style={{ fontSize: 13, fontWeight: 600 }}>{getLotLabel(showDetail.idLot)}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Génération cible</div><span className="badge badge-gold">{showDetail.generationCible || '—'}</span></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Surface prévue</div><div style={{ fontSize: 20, fontWeight: 700 }}>{showDetail.superficieHa || '—'} <span style={{ fontSize: 13, fontWeight: 400 }}>ha</span></div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Objectif récolte</div><div style={{ fontSize: 20, fontWeight: 700 }}>{showDetail.objectifKg ? Number(showDetail.objectifKg).toLocaleString('fr-FR') : '—'} <span style={{ fontSize: 13, fontWeight: 400 }}>kg</span></div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date début</div><div style={{ fontSize: 13 }}>{showDetail.dateDebut || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date fin</div><div style={{ fontSize: 13 }}>{showDetail.dateFin || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Statut</div><StatusBadge status={showDetail.statut} showIcon size="md" /></div>
            {showDetail.observations && (
              <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Observations</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{showDetail.observations}</div></div>
            )}
          </div>
        </Modal>
      )}

      {/* Form */}
      {showForm && (
        <Modal title={editItem ? `Modifier — ${editItem.codeProgramme}` : 'Nouveau Programme de Multiplication'} subtitle="Planifier la multiplication de semences" onClose={() => { setShowForm(false); setEditItem(null) }} size="lg">
          <form onSubmit={submitForm}>
            <FormRow>
              <Field label="Code programme" required hint="Ex: PROG-MIL-G3-2026"><FormInput value={form.codeProgramme} onChange={e => setForm(f => ({ ...f, codeProgramme: e.target.value.toUpperCase() }))} placeholder="PROG-MIL-G3-2026" required disabled={!!editItem} /></Field>
              <Field label="Lot source" required>
                <FormSelect value={form.idLotSource} onChange={e => setForm(f => ({ ...f, idLotSource: e.target.value }))} required>
                  <option value="">-- Sélectionner un lot --</option>
                  {lots.filter(l => l.statutLot === 'DISPONIBLE').map((l: any) => (
                    <option key={l.id} value={l.id}>{l.codeLot} — {l.generation?.codeGeneration || 'N/A'}</option>
                  ))}
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Génération cible" required>
                <FormSelect value={form.generationCible} onChange={e => setForm(f => ({ ...f, generationCible: e.target.value }))}>
                  {ALL_GENS.map(g => <option key={g} value={g}>{g}</option>)}
                </FormSelect>
              </Field>
              <Field label="Multiplicateur" required>
                <FormInput value={form.multiplicateur} onChange={e => setForm(f => ({ ...f, multiplicateur: e.target.value }))} placeholder="Nom du multiplicateur" required />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Campagne"><FormInput value={form.campagne} onChange={e => setForm(f => ({ ...f, campagne: e.target.value }))} placeholder="CAMP-HIV-2026" /></Field>
              <Field label="Date d'attribution"><FormInput type="date" value={form.dateAttribution} onChange={e => setForm(f => ({ ...f, dateAttribution: e.target.value }))} /></Field>
            </FormRow>
            <FormRow>
              <Field label="Surface prévue (ha)"><FormInput type="number" value={form.surfacePrevueHa} onChange={e => setForm(f => ({ ...f, surfacePrevueHa: e.target.value }))} placeholder="10" min="0" step="0.001" /></Field>
              <Field label="Quantité semence allouée (kg)"><FormInput type="number" value={form.quantiteSemenceAllouee} onChange={e => setForm(f => ({ ...f, quantiteSemenceAllouee: e.target.value }))} placeholder="500" min="0" step="0.001" /></Field>
            </FormRow>
            <Field label="Statut">
              <FormSelect value={form.statutProgramme} onChange={e => setForm(f => ({ ...f, statutProgramme: e.target.value }))}>
                {STATUT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </FormSelect>
            </Field>
            <Field label="Observations">
              <textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Notes…" style={{ width: '100%', minHeight: 70, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => { setShowForm(false); setEditItem(null) }} loading={saving} submitLabel={editItem ? 'Mettre à jour' : 'Créer le programme'} />
          </form>
        </Modal>
      )}
    </div>
  )
}
