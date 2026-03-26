import React, { useEffect, useState } from 'react'
import {
  Leaf, Sprout, CheckCircle2, Plus, Search, X,
  RefreshCw, Edit2, FlaskConical, ChevronRight,
  Archive, Trash2, AlertTriangle, Eye, EyeOff, MessageSquare
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

const STATUT_CONFIG: Record<string, { label: string; cls: string }> = {
  DIFFUSEE: { label: 'Diffusée',  cls: 'badge-green' },
  EN_TEST:  { label: 'En test',   cls: 'badge-gold'  },
  RETIREE:  { label: 'Retirée',   cls: 'badge-red'   },
  ARCHIVEE: { label: 'Archivée',  cls: 'badge-gray'  },
}

export function Varieties({ roleKey }: Props) {
  const [species,   setSpecies]   = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [search,    setSearch]    = useState('')
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showEspeceForm,  setShowEspeceForm]  = useState(false)
  const [showVarieteForm, setShowVarieteForm] = useState(false)
  const [editVariete,     setEditVariete]     = useState<any>(null)
  const [saving, setSaving] = useState(false)

  // Archivage
  const [archiveTarget,  setArchiveTarget]  = useState<any>(null)
  const [archiveComment, setArchiveComment] = useState('')
  const [archiving,      setArchiving]      = useState(false)

  // Suppression définitive
  const [deleteTarget,  setDeleteTarget]  = useState<any>(null)
  const [deleteComment, setDeleteComment] = useState('')
  const [deleting,      setDeleting]      = useState(false)

  // Afficher / masquer les archivées
  const [showArchived, setShowArchived] = useState(false)

  const [especeForm, setEspeceForm] = useState({
    codeEspece: '', nomCommun: '', nomScientifique: '',
  })
  const [varieteForm, setVarieteForm] = useState({
    codeVariete: '', nomVariete: '', idEspece: '', origine: '',
    selectionneurPrincipal: '', anneeCreation: '', cycleJours: '',
    statutVariete: 'DIFFUSEE',
  })

  const canCreate  = ['seed-admin', 'seed-selector'].includes(roleKey)
  const canEdit    = ['seed-admin', 'seed-selector'].includes(roleKey)
  const canArchive = ['seed-admin', 'seed-selector'].includes(roleKey)

  /* ── Fetch ── */
  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    Promise.allSettled([
      api.get(endpoints.species),
      api.get(endpoints.varieties),
    ]).then(([s, v]) => {
      setSpecies(s.status === 'fulfilled' ? s.value.data : [])
      setVarieties(v.status === 'fulfilled' ? v.value.data : [])
    }).finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { fetchData() }, [])

  /* ── Dérivés ── */
  const selectedSpecies = species.find(s => s.id === selectedSpeciesId) ?? null

  const filtered = varieties.filter(v => {
    const isArchived   = v.statutVariete === 'ARCHIVEE'
    if (isArchived && !showArchived) return false
    const matchSpecies = selectedSpeciesId === null || v.espece?.id === selectedSpeciesId
    const q            = search.toLowerCase()
    const matchSearch  = !search
      || v.nomVariete?.toLowerCase().includes(q)
      || v.codeVariete?.toLowerCase().includes(q)
      || v.espece?.nomCommun?.toLowerCase().includes(q)
      || v.espece?.codeEspece?.toLowerCase().includes(q)
    return matchSpecies && matchSearch
  })

  const diffuseeCount = varieties.filter(v => v.statutVariete === 'DIFFUSEE').length
  const enTestCount   = varieties.filter(v => v.statutVariete === 'EN_TEST').length
  const archivedCount = varieties.filter(v => v.statutVariete === 'ARCHIVEE').length

  function varietyCountForSpecies(s: any) {
    return varieties.filter(v => v.espece?.id === s.id && v.statutVariete !== 'ARCHIVEE').length
  }

  /* ── Archivage ── */
  async function submitArchive(e: React.FormEvent) {
    e.preventDefault()
    if (!archiveTarget || !archiveComment.trim()) return
    setArchiving(true)
    try {
      await api.patch(endpoints.varietyArchive(archiveTarget.id), { commentaire: archiveComment.trim() })
      setToast({ msg: `Variété "${archiveTarget.nomVariete}" archivée`, type: 'success' })
      setArchiveTarget(null)
      setArchiveComment('')
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de l\'archivage', type: 'error' })
    } finally { setArchiving(false) }
  }

  /* ── Suppression définitive ── */
  async function submitDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!deleteTarget || !deleteComment.trim()) return
    setDeleting(true)
    try {
      await api.delete(endpoints.varietyDelete(deleteTarget.id))
      setToast({ msg: `Variété "${deleteTarget.nomVariete}" supprimée définitivement`, type: 'success' })
      setDeleteTarget(null)
      setDeleteComment('')
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la suppression', type: 'error' })
    } finally { setDeleting(false) }
  }

  /* ── Actions espèce ── */
  async function submitEspece(e: React.FormEvent) {
    e.preventDefault()
    if (!especeForm.codeEspece || !especeForm.nomCommun) return
    setSaving(true)
    try {
      await api.post(endpoints.species, especeForm)
      setToast({ msg: `Espèce "${especeForm.nomCommun}" créée avec succès`, type: 'success' })
      setShowEspeceForm(false)
      setEspeceForm({ codeEspece: '', nomCommun: '', nomScientifique: '' })
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la création', type: 'error' })
    } finally { setSaving(false) }
  }

  /* ── Actions variété ── */
  async function submitVariete(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editVariete) {
        await api.patch(endpoints.varietyStatut(editVariete.id), { statut: varieteForm.statutVariete })
        setToast({ msg: 'Variété mise à jour', type: 'success' })
      } else {
        await api.post(endpoints.varieties, {
          codeVariete:           varieteForm.codeVariete,
          nomVariete:            varieteForm.nomVariete,
          idEspece:              Number(varieteForm.idEspece),
          origine:               varieteForm.origine || undefined,
          selectionneurPrincipal:varieteForm.selectionneurPrincipal || undefined,
          anneeCreation:         varieteForm.anneeCreation ? Number(varieteForm.anneeCreation) : undefined,
          cycleJours:            varieteForm.cycleJours    ? Number(varieteForm.cycleJours)    : undefined,
          statutVariete:         varieteForm.statutVariete,
        })
        setToast({ msg: `Variété "${varieteForm.nomVariete}" créée`, type: 'success' })
      }
      setShowVarieteForm(false)
      setEditVariete(null)
      setVarieteForm({ codeVariete: '', nomVariete: '', idEspece: '', origine: '', selectionneurPrincipal: '', anneeCreation: '', cycleJours: '', statutVariete: 'DIFFUSEE' })
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  function openEdit(v: any) {
    setEditVariete(v)
    setVarieteForm({
      codeVariete: v.codeVariete, nomVariete: v.nomVariete,
      idEspece: v.espece?.id?.toString() || '', origine: v.origine || '',
      selectionneurPrincipal: v.selectionneurPrincipal || '',
      anneeCreation: v.anneeCreation?.toString() || '',
      cycleJours: v.cycleJours?.toString() || '',
      statutVariete: v.statutVariete || 'DIFFUSEE',
    })
    setShowVarieteForm(true)
  }

  function openNewVariete() {
    setEditVariete(null)
    setVarieteForm({
      codeVariete: '', nomVariete: '',
      idEspece: selectedSpeciesId?.toString() || '',
      origine: '', selectionneurPrincipal: '', anneeCreation: '', cycleJours: '',
      statutVariete: 'DIFFUSEE',
    })
    setShowVarieteForm(true)
  }

  /* ── Render ── */
  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── KPI Cards ── */}
      <div className="stats-grid" style={{ marginBottom: 22 }}>
        <div className="stat-card">
          <div className="stat-icon green"><Leaf size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : species.length}</div>
            <div className="stat-label">Espèces</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold"><Sprout size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : varieties.filter(v => v.statutVariete !== 'ARCHIVEE').length}</div>
            <div className="stat-label">Variétés actives</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : diffuseeCount}</div>
            <div className="stat-label">Diffusées</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold"><FlaskConical size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : enTestCount}</div>
            <div className="stat-label">En test</div>
          </div>
        </div>
        {archivedCount > 0 && (
          <div className="stat-card" style={{ opacity: 0.7 }}>
            <div className="stat-icon" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
              <Archive size={18} />
            </div>
            <div className="stat-body">
              <div className="stat-value">{archivedCount}</div>
              <div className="stat-label">Archivées</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Corps principal : espèces + variétés ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ═══ Panel espèces ═══ */}
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><Leaf size={15} /></span>
              Espèces
              <span className="badge badge-green" style={{ marginLeft: 6, fontSize: 11 }}>{species.length}</span>
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {canCreate && (
                <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px' }} onClick={() => setShowEspeceForm(true)}>
                  <Plus size={11} /> Nouvelle
                </button>
              )}
              <button className="btn btn-secondary btn-icon" style={{ width: 28, height: 28 }} onClick={() => fetchData(true)} disabled={refreshing} title="Actualiser">
                <RefreshCw size={11} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          <div style={{ padding: '6px 8px' }}>

            {/* Option "Toutes les espèces" */}
            <button
              className="species-filter-item"
              data-active={selectedSpeciesId === null}
              onClick={() => { setSelectedSpeciesId(null); setSearch('') }}
            >
              <span className="species-filter-all-dot" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Toutes les espèces</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 99, fontVariantNumeric: 'tabular-nums' }}>
                {varieties.length}
              </span>
              {selectedSpeciesId === null && <ChevronRight size={12} color="var(--green-600)" />}
            </button>

            {/* Liste des espèces */}
            {loading
              ? [0, 1, 2, 3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 4 }} />
                ))
              : species.length === 0
              ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <div className="empty-icon"><Leaf size={18} /></div>
                    <div className="empty-title" style={{ fontSize: 13 }}>Aucune espèce</div>
                    {canCreate && (
                      <button className="btn btn-primary" style={{ marginTop: 10, fontSize: 11 }} onClick={() => setShowEspeceForm(true)}>
                        + Créer
                      </button>
                    )}
                  </div>
                )
              : species.map(s => {
                  const count   = varietyCountForSpecies(s)
                  const isActive = selectedSpeciesId === s.id
                  return (
                    <button
                      key={s.id}
                      className="species-filter-item"
                      data-active={isActive}
                      onClick={() => setSelectedSpeciesId(isActive ? null : s.id)}
                    >
                      <span className="species-code">{s.codeEspece}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="species-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.nomCommun}
                        </div>
                        {s.nomScientifique && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.nomScientifique}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                        color: isActive ? 'var(--green-700)' : 'var(--text-muted)',
                        background: isActive ? 'var(--green-100)' : 'var(--surface-3)',
                        padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                      }}>
                        {count}
                      </span>
                      {isActive && <ChevronRight size={12} color="var(--green-600)" style={{ flexShrink: 0 }} />}
                    </button>
                  )
                })
            }
          </div>
        </div>

        {/* ═══ Panel variétés ═══ */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><Sprout size={15} /></span>
              {selectedSpecies ? selectedSpecies.nomCommun : 'Toutes les variétés'}
              <span className="badge badge-gold" style={{ marginLeft: 6, fontSize: 11 }}>
                {filtered.length}{varieties.length !== filtered.length && `/${varieties.length}`}
              </span>
            </span>
            {canCreate && (
              <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={openNewVariete}>
                <Plus size={12} /> Nouvelle variété
              </button>
            )}
          </div>

          {/* Barre de recherche + chip espèce active */}
          <div style={{ padding: '10px 16px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Chip espèce sélectionnée */}
            {selectedSpecies && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--green-50)', border: '1px solid var(--green-200)',
                borderRadius: 99, padding: '3px 10px 3px 8px', fontSize: 12, color: 'var(--green-700)',
              }}>
                <Leaf size={11} />
                <span style={{ fontWeight: 600 }}>{selectedSpecies.codeEspece}</span>
                <span style={{ fontWeight: 400 }}>{selectedSpecies.nomCommun}</span>
                <button
                  onClick={() => setSelectedSpeciesId(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginLeft: 2, color: 'var(--green-700)' }}
                  title="Effacer le filtre espèce"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Champ de recherche */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'white', border: '1px solid var(--border-strong)',
              borderRadius: 6, padding: '0 11px', height: 34, flex: 1, minWidth: 200,
            }}>
              <Search size={13} color="var(--text-placeholder)" />
              <input
                placeholder={selectedSpecies ? `Rechercher dans ${selectedSpecies.nomCommun}…` : 'Code, nom, espèce…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13, fontFamily: 'Outfit, sans-serif' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Barre d'outils tableau : toggle archivées */}
          {canArchive && archivedCount > 0 && (
            <div style={{ padding: '6px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, gap: 6, color: showArchived ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                onClick={() => setShowArchived(v => !v)}
              >
                {showArchived ? <EyeOff size={13} /> : <Eye size={13} />}
                {showArchived ? 'Masquer les archivées' : `Afficher les archivées (${archivedCount})`}
              </button>
            </div>
          )}

          {/* Tableau des variétés */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom variété</th>
                  <th>Espèce</th>
                  <th>Cycle</th>
                  <th>Statut</th>
                  {canEdit && <th style={{ width: 80 }}></th>}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [0, 1, 2, 3, 4].map(i => (
                      <tr key={i}>
                        <td colSpan={canEdit ? 6 : 5}>
                          <div className="skeleton" style={{ height: 14, borderRadius: 4 }} />
                        </td>
                      </tr>
                    ))
                  : filtered.length === 0
                  ? (
                      <tr>
                        <td colSpan={canEdit ? 6 : 5}>
                          <div className="empty-state" style={{ padding: '40px 0' }}>
                            <div className="empty-icon"><Sprout size={20} /></div>
                            <div className="empty-title">
                              {search
                                ? 'Aucune variété correspondante'
                                : selectedSpecies
                                ? `Aucune variété pour ${selectedSpecies.nomCommun}`
                                : 'Aucune variété enregistrée'}
                            </div>
                            <div className="empty-sub" style={{ marginTop: 4 }}>
                              {search && <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 6 }} onClick={() => setSearch('')}><X size={11} /> Effacer la recherche</button>}
                              {!search && canCreate && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNewVariete}>+ Créer une variété</button>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  : filtered.map(v => {
                      const isArchived = v.statutVariete === 'ARCHIVEE'
                      const st = STATUT_CONFIG[v.statutVariete] ?? { label: v.statutVariete, cls: 'badge-gray' }
                      return (
                        <tr key={v.id} style={{ opacity: isArchived ? 0.55 : 1 }}>
                          <td>
                            <span className="td-mono" style={{ fontWeight: 700, textDecoration: isArchived ? 'line-through' : 'none' }}>
                              {v.codeVariete}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v.nomVariete}</span>
                            {v.origine && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{v.origine}</div>}
                            {isArchived && v.commentaireArchivage && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 3, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                <MessageSquare size={10} style={{ marginTop: 1, flexShrink: 0 }} />
                                {v.commentaireArchivage}
                              </div>
                            )}
                          </td>
                          <td>
                            {v.espece ? (
                              <button className="species-code" style={{ cursor: 'pointer', border: 'none' }} title={`Filtrer par ${v.espece.nomCommun}`} onClick={() => setSelectedSpeciesId(v.espece.id)}>
                                {v.espece.codeEspece}
                              </button>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td>
                            {v.cycleJours
                              ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.cycleJours} j</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                          {canEdit && (
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {!isArchived && (
                                  <>
                                    <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => openEdit(v)} title="Modifier le statut">
                                      <Edit2 size={12} />
                                    </button>
                                    {canArchive && (
                                      <button
                                        className="btn btn-ghost"
                                        style={{ height: 26, padding: '0 8px', color: 'var(--gold-dark)' }}
                                        onClick={() => { setArchiveTarget(v); setArchiveComment('') }}
                                        title="Archiver cette variété"
                                      >
                                        <Archive size={12} />
                                      </button>
                                    )}
                                  </>
                                )}
                                {isArchived && canArchive && (
                                  <button
                                    className="btn btn-ghost"
                                    style={{ height: 26, padding: '0 8px', color: 'var(--red-600)' }}
                                    onClick={() => { setDeleteTarget(v); setDeleteComment('') }}
                                    title="Supprimer définitivement"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modal Espèce ── */}
      {showEspeceForm && (
        <Modal
          title="Nouvelle Espèce"
          subtitle="Ajouter une nouvelle espèce au catalogue semencier"
          onClose={() => setShowEspeceForm(false)}
          size="sm"
        >
          <form onSubmit={submitEspece}>
            <Field label="Code espèce" required hint="3 lettres majuscules — ex : MIL, RIZ, ARA">
              <FormInput
                value={especeForm.codeEspece}
                onChange={e => setEspeceForm(f => ({ ...f, codeEspece: e.target.value.toUpperCase() }))}
                placeholder="MIL"
                maxLength={10}
                required
              />
            </Field>
            <Field label="Nom commun" required>
              <FormInput
                value={especeForm.nomCommun}
                onChange={e => setEspeceForm(f => ({ ...f, nomCommun: e.target.value }))}
                placeholder="Mil"
                required
              />
            </Field>
            <Field label="Nom scientifique">
              <FormInput
                value={especeForm.nomScientifique}
                onChange={e => setEspeceForm(f => ({ ...f, nomScientifique: e.target.value }))}
                placeholder="Pennisetum glaucum"
              />
            </Field>
            <FormActions onCancel={() => setShowEspeceForm(false)} loading={saving} submitLabel="Créer l'espèce" />
          </form>
        </Modal>
      )}

      {/* ── Modal Variété ── */}
      {showVarieteForm && (
        <Modal
          title={editVariete ? `Modifier — ${editVariete.codeVariete}` : 'Nouvelle Variété'}
          subtitle={editVariete ? 'Modifier le statut de la variété' : 'Enregistrer une nouvelle variété certifiée'}
          onClose={() => { setShowVarieteForm(false); setEditVariete(null) }}
        >
          <form onSubmit={submitVariete}>
            {!editVariete && (
              <>
                <FormRow>
                  <Field label="Code variété" required hint="ex : MIL-SOUNA3">
                    <FormInput
                      value={varieteForm.codeVariete}
                      onChange={e => setVarieteForm(f => ({ ...f, codeVariete: e.target.value.toUpperCase() }))}
                      placeholder="MIL-SOUNA3"
                      required
                    />
                  </Field>
                  <Field label="Nom variété" required>
                    <FormInput
                      value={varieteForm.nomVariete}
                      onChange={e => setVarieteForm(f => ({ ...f, nomVariete: e.target.value }))}
                      placeholder="Souna III"
                      required
                    />
                  </Field>
                </FormRow>
                <Field label="Espèce" required>
                  <FormSelect
                    value={varieteForm.idEspece}
                    onChange={e => setVarieteForm(f => ({ ...f, idEspece: e.target.value }))}
                    required
                  >
                    <option value="">— Sélectionner une espèce —</option>
                    {species.map(s => (
                      <option key={s.id} value={s.id}>{s.codeEspece} — {s.nomCommun}</option>
                    ))}
                  </FormSelect>
                </Field>
                <FormRow>
                  <Field label="Origine">
                    <FormInput
                      value={varieteForm.origine}
                      onChange={e => setVarieteForm(f => ({ ...f, origine: e.target.value }))}
                      placeholder="ISRA-CNRA Bambey"
                    />
                  </Field>
                  <Field label="Sélectionneur principal">
                    <FormInput
                      value={varieteForm.selectionneurPrincipal}
                      onChange={e => setVarieteForm(f => ({ ...f, selectionneurPrincipal: e.target.value }))}
                      placeholder="Équipe sélection ISRA"
                    />
                  </Field>
                </FormRow>
                <FormRow>
                  <Field label="Année de création">
                    <FormInput
                      type="number"
                      value={varieteForm.anneeCreation}
                      onChange={e => setVarieteForm(f => ({ ...f, anneeCreation: e.target.value }))}
                      placeholder="1985"
                      min="1900" max="2030"
                    />
                  </Field>
                  <Field label="Cycle (jours)">
                    <FormInput
                      type="number"
                      value={varieteForm.cycleJours}
                      onChange={e => setVarieteForm(f => ({ ...f, cycleJours: e.target.value }))}
                      placeholder="90"
                      min="1" max="365"
                    />
                  </Field>
                </FormRow>
              </>
            )}
            <Field label="Statut" required>
              <FormSelect
                value={varieteForm.statutVariete}
                onChange={e => setVarieteForm(f => ({ ...f, statutVariete: e.target.value }))}
              >
                <option value="DIFFUSEE">Diffusée</option>
                <option value="EN_TEST">En test</option>
                <option value="RETIREE">Retirée</option>
              </FormSelect>
            </Field>
            <FormActions
              onCancel={() => { setShowVarieteForm(false); setEditVariete(null) }}
              loading={saving}
              submitLabel={editVariete ? 'Mettre à jour' : 'Créer la variété'}
            />
          </form>
        </Modal>
      )}

      {/* ── Modal Archivage ── */}
      {archiveTarget && (
        <Modal
          title="Archiver la variété"
          subtitle={`${archiveTarget.codeVariete} — ${archiveTarget.nomVariete}`}
          onClose={() => { setArchiveTarget(null); setArchiveComment('') }}
          size="sm"
        >
          {/* Bandeau d'avertissement */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--gold-light)', border: '1px solid #fde68a', marginBottom: 20 }}>
            <AlertTriangle size={16} color="var(--gold-dark)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--gold-dark)', lineHeight: 1.5 }}>
              <strong>Archivage = suppression traçable.</strong> La variété ne sera plus visible dans le catalogue actif, mais son historique est conservé.
            </div>
          </div>

          <form onSubmit={submitArchive}>
            <Field
              label="Motif d'archivage"
              required
              hint="Obligatoire — ex : variété obsolète, remplacée par une nouvelle sélection"
            >
              <textarea
                value={archiveComment}
                onChange={e => setArchiveComment(e.target.value)}
                placeholder="Expliquez pourquoi cette variété est archivée…"
                required
                style={{
                  width: '100%', minHeight: 90, padding: '9px 12px',
                  border: '1px solid var(--border-strong)', borderRadius: 6,
                  fontSize: 13, fontFamily: 'Outfit, sans-serif',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                  lineHeight: 1.55,
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--border-focus)' }}
                onBlur={e =>  { e.target.style.borderColor = 'var(--border-strong)' }}
              />
            </Field>
            <FormActions
              onCancel={() => { setArchiveTarget(null); setArchiveComment('') }}
              loading={archiving}
              submitLabel="Confirmer l'archivage"
              submitClassName="btn-warning"
            />
          </form>
        </Modal>
      )}

      {/* ── Modal Suppression définitive ── */}
      {deleteTarget && (
        <Modal
          title="Suppression définitive"
          subtitle={`${deleteTarget.codeVariete} — ${deleteTarget.nomVariete}`}
          onClose={() => { setDeleteTarget(null); setDeleteComment('') }}
          size="sm"
        >
          {/* Bandeau danger */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--red-50)', border: '1px solid #fecaca', marginBottom: 20 }}>
            <AlertTriangle size={16} color="var(--red-600)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--red-600)', lineHeight: 1.5 }}>
              <strong>Action irréversible.</strong> Cette variété archivée sera supprimée définitivement de la base de données. Cette action ne peut pas être annulée.
            </div>
          </div>

          {/* Rappel du motif d'archivage */}
          {deleteTarget.commentaireArchivage && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Motif d'archivage
              </div>
              <div style={{ fontStyle: 'italic' }}>{deleteTarget.commentaireArchivage}</div>
              {deleteTarget.archivePar && (
                <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                  Archivé par <strong>{deleteTarget.archivePar}</strong>
                </div>
              )}
            </div>
          )}

          <form onSubmit={submitDelete}>
            <Field
              label="Confirmez en tapant la raison de suppression"
              required
              hint="Ce commentaire sera enregistré dans le journal d'audit avant suppression"
            >
              <textarea
                value={deleteComment}
                onChange={e => setDeleteComment(e.target.value)}
                placeholder="Raison de la suppression définitive…"
                required
                style={{
                  width: '100%', minHeight: 80, padding: '9px 12px',
                  border: '1px solid #fecaca', borderRadius: 6,
                  fontSize: 13, fontFamily: 'Outfit, sans-serif',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                  lineHeight: 1.55,
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--red-500)' }}
                onBlur={e =>  { e.target.style.borderColor = '#fecaca' }}
              />
            </Field>
            <FormActions
              onCancel={() => { setDeleteTarget(null); setDeleteComment('') }}
              loading={deleting}
              submitLabel="Supprimer définitivement"
              submitClassName="btn-danger"
            />
          </form>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
