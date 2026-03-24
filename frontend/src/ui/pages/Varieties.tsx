import React, { useEffect, useState } from 'react'
import { Leaf, Sprout, CheckCircle2, XCircle, Plus, Search, X, RefreshCw, Edit2 } from 'lucide-react'
import { api } from '../../lib/api'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

export function Varieties({ roleKey }: Props) {
  const [species, setSpecies] = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [showEspeceForm, setShowEspeceForm] = useState(false)
  const [showVarieteForm, setShowVarieteForm] = useState(false)
  const [editVariete, setEditVariete] = useState<any>(null)
  const [especeForm, setEspeceForm] = useState({ codeEspece: '', nomCommun: '', nomScientifique: '' })
  const [varieteForm, setVarieteForm] = useState({
    codeVariete: '', nomVariete: '', idEspece: '', origine: '',
    selectionneurPrincipal: '', anneeCreation: '', cycleJours: '', statutVariete: 'DIFFUSEE'
  })
  const [saving, setSaving] = useState(false)

  const canCreate = ['seed-admin','seed-selector'].includes(roleKey)
  const canEdit   = ['seed-admin','seed-selector'].includes(roleKey)

  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    Promise.allSettled([
      api.get('http://localhost:18081/api/species'),
      api.get('http://localhost:18081/api/varieties'),
    ]).then(([s, v]) => {
      setSpecies(s.status === 'fulfilled' ? s.value.data : [])
      setVarieties(v.status === 'fulfilled' ? v.value.data : [])
    }).finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { fetchData() }, [])

  const filtered = varieties.filter(v =>
    !search ||
    v.nomVariete?.toLowerCase().includes(search.toLowerCase()) ||
    v.codeVariete?.toLowerCase().includes(search.toLowerCase()) ||
    v.espece?.codeEspece?.toLowerCase().includes(search.toLowerCase())
  )
  const activeCount = varieties.filter((v: any) => v.statutVariete === 'DIFFUSEE').length

  async function submitEspece(e: React.FormEvent) {
    e.preventDefault()
    if (!especeForm.codeEspece || !especeForm.nomCommun) return
    setSaving(true)
    try {
      await api.post('http://localhost:18081/api/species', especeForm)
      setToast({ msg: `Espece "${especeForm.nomCommun}" creee avec succes`, type: 'success' })
      setShowEspeceForm(false)
      setEspeceForm({ codeEspece: '', nomCommun: '', nomScientifique: '' })
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la creation', type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitVariete(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editVariete) {
        await api.patch(`http://localhost:18081/api/varieties/${editVariete.id}/statut`, { statut: varieteForm.statutVariete })
        setToast({ msg: 'Variete mise a jour', type: 'success' })
      } else {
        await api.post('http://localhost:18081/api/varieties', {
          codeVariete: varieteForm.codeVariete, nomVariete: varieteForm.nomVariete,
          idEspece: Number(varieteForm.idEspece), origine: varieteForm.origine || undefined,
          selectionneurPrincipal: varieteForm.selectionneurPrincipal || undefined,
          anneeCreation: varieteForm.anneeCreation ? Number(varieteForm.anneeCreation) : undefined,
          cycleJours: varieteForm.cycleJours ? Number(varieteForm.cycleJours) : undefined,
          statutVariete: varieteForm.statutVariete,
        })
        setToast({ msg: `Variete "${varieteForm.nomVariete}" creee`, type: 'success' })
      }
      setShowVarieteForm(false); setEditVariete(null)
      setVarieteForm({ codeVariete: '', nomVariete: '', idEspece: '', origine: '', selectionneurPrincipal: '', anneeCreation: '', cycleJours: '', statutVariete: 'DIFFUSEE' })
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  function openEdit(v: any) {
    setEditVariete(v)
    setVarieteForm({ codeVariete: v.codeVariete, nomVariete: v.nomVariete, idEspece: v.espece?.id?.toString() || '', origine: v.origine || '', selectionneurPrincipal: v.selectionneurPrincipal || '', anneeCreation: v.anneeCreation?.toString() || '', cycleJours: v.cycleJours?.toString() || '', statutVariete: v.statutVariete || 'DIFFUSEE' })
    setShowVarieteForm(true)
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon green"><Leaf size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : species.length}</div><div className="stat-label">Especes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Sprout size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : varieties.length}</div><div className="stat-label">Varietes</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : activeCount}</div><div className="stat-label">Diffusees</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : varieties.length - activeCount}</div><div className="stat-label">En test</div></div></div>
      </div>

      <div className="grid-2">
        {/* Especes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><span className="card-title-icon"><Leaf size={15} /></span>Especes <span className="badge badge-green" style={{ marginLeft: 6, fontSize: 11 }}>{species.length}</span></span>
            <div style={{ display: 'flex', gap: 8 }}>
              {canCreate && <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={() => setShowEspeceForm(true)}><Plus size={12} /> Nouvelle</button>}
              <button className="btn btn-secondary btn-icon" style={{ width: 30, height: 30 }} onClick={() => fetchData(true)} disabled={refreshing}><RefreshCw size={12} /></button>
            </div>
          </div>
          <div className="card-body" style={{ padding: '4px 20px 16px' }}>
            {loading ? [0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 6, marginBottom: 8 }} />) :
             species.length === 0 ? (
               <div className="empty-state" style={{ padding: '32px 0' }}>
                 <div className="empty-icon"><Leaf size={20} /></div>
                 <div className="empty-title">Aucune espece</div>
                 {canCreate && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowEspeceForm(true)}>+ Creer la premiere espece</button>}
               </div>
             ) : species.map(s => (
              <div key={s.id} className="species-item">
                <span className="species-code">{s.codeEspece}</span>
                <div style={{ flex: 1 }}>
                  <div className="species-name">{s.nomCommun}</div>
                  {s.nomScientifique && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{s.nomScientifique}</div>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 99 }}>
                  {varieties.filter(v => v.espece?.codeEspece === s.codeEspece).length} var.
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Varietes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><span className="card-title-icon"><Sprout size={15} /></span>Varietes <span className="badge badge-gold" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}/{varieties.length}</span></span>
            {canCreate && <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={() => { setEditVariete(null); setVarieteForm({ codeVariete: '', nomVariete: '', idEspece: '', origine: '', selectionneurPrincipal: '', anneeCreation: '', cycleJours: '', statutVariete: 'DIFFUSEE' }); setShowVarieteForm(true) }}><Plus size={12} /> Nouvelle</button>}
          </div>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Code, nom ou espece..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13, fontFamily: 'Outfit, sans-serif' }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Code</th><th>Nom variete</th><th>Espece</th><th>Statut</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {loading ? [0,1,2,3].map(i => <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                 filtered.length === 0 ? <tr><td colSpan={5}><div className="empty-state" style={{ padding: '32px 0' }}><div className="empty-icon"><Sprout size={20} /></div><div className="empty-title">{search ? 'Aucun resultat' : 'Aucune variete'}</div></div></td></tr> :
                 filtered.map(v => (
                  <tr key={v.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{v.codeVariete}</span></td>
                    <td style={{ fontWeight: 500 }}>{v.nomVariete}</td>
                    <td><span className="badge badge-green">{v.espece?.codeEspece || '—'}</span></td>
                    <td>
                      <span className={`badge ${v.statutVariete === 'DIFFUSEE' ? 'badge-green' : v.statutVariete === 'EN_TEST' ? 'badge-gold' : 'badge-red'}`}>
                        {v.statutVariete === 'DIFFUSEE' ? 'Diffusee' : v.statutVariete === 'EN_TEST' ? 'En test' : 'Retiree'}
                      </span>
                    </td>
                    {canEdit && <td><button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => openEdit(v)}><Edit2 size={12} /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Espece */}
      {showEspeceForm && (
        <Modal title="Nouvelle Espece" subtitle="Ajouter une nouvelle espece au catalogue" onClose={() => setShowEspeceForm(false)} size="sm">
          <form onSubmit={submitEspece}>
            <Field label="Code espece" required hint="3 lettres majuscules — ex: MIL, ARA"><FormInput value={especeForm.codeEspece} onChange={e => setEspeceForm(f => ({ ...f, codeEspece: e.target.value.toUpperCase() }))} placeholder="MIL" maxLength={10} required /></Field>
            <Field label="Nom commun" required><FormInput value={especeForm.nomCommun} onChange={e => setEspeceForm(f => ({ ...f, nomCommun: e.target.value }))} placeholder="Mil" required /></Field>
            <Field label="Nom scientifique"><FormInput value={especeForm.nomScientifique} onChange={e => setEspeceForm(f => ({ ...f, nomScientifique: e.target.value }))} placeholder="Pennisetum glaucum" /></Field>
            <FormActions onCancel={() => setShowEspeceForm(false)} loading={saving} submitLabel="Creer l'espece" />
          </form>
        </Modal>
      )}

      {/* Modal Variete */}
      {showVarieteForm && (
        <Modal title={editVariete ? `Modifier — ${editVariete.codeVariete}` : 'Nouvelle Variete'} subtitle={editVariete ? 'Modifier le statut de la variete' : 'Enregistrer une nouvelle variete certifiee'} onClose={() => { setShowVarieteForm(false); setEditVariete(null) }}>
          <form onSubmit={submitVariete}>
            {!editVariete && (
              <>
                <FormRow>
                  <Field label="Code variete" required hint="ex: MIL-SOUNA3"><FormInput value={varieteForm.codeVariete} onChange={e => setVarieteForm(f => ({ ...f, codeVariete: e.target.value.toUpperCase() }))} placeholder="MIL-SOUNA3" required /></Field>
                  <Field label="Nom variete" required><FormInput value={varieteForm.nomVariete} onChange={e => setVarieteForm(f => ({ ...f, nomVariete: e.target.value }))} placeholder="Souna III" required /></Field>
                </FormRow>
                <Field label="Espece" required>
                  <FormSelect value={varieteForm.idEspece} onChange={e => setVarieteForm(f => ({ ...f, idEspece: e.target.value }))} required>
                    <option value="">-- Selectionner une espece --</option>
                    {species.map(s => <option key={s.id} value={s.id}>{s.codeEspece} — {s.nomCommun}</option>)}
                  </FormSelect>
                </Field>
                <FormRow>
                  <Field label="Origine"><FormInput value={varieteForm.origine} onChange={e => setVarieteForm(f => ({ ...f, origine: e.target.value }))} placeholder="ISRA-CNRA Bambey" /></Field>
                  <Field label="Selectionneur principal"><FormInput value={varieteForm.selectionneurPrincipal} onChange={e => setVarieteForm(f => ({ ...f, selectionneurPrincipal: e.target.value }))} placeholder="Equipe selection ISRA" /></Field>
                </FormRow>
                <FormRow>
                  <Field label="Annee de creation"><FormInput type="number" value={varieteForm.anneeCreation} onChange={e => setVarieteForm(f => ({ ...f, anneeCreation: e.target.value }))} placeholder="1985" min="1900" max="2030" /></Field>
                  <Field label="Cycle (jours)"><FormInput type="number" value={varieteForm.cycleJours} onChange={e => setVarieteForm(f => ({ ...f, cycleJours: e.target.value }))} placeholder="90" min="1" max="365" /></Field>
                </FormRow>
              </>
            )}
            <Field label="Statut" required>
              <FormSelect value={varieteForm.statutVariete} onChange={e => setVarieteForm(f => ({ ...f, statutVariete: e.target.value }))}>
                <option value="DIFFUSEE">Diffusee</option>
                <option value="EN_TEST">En test</option>
                <option value="RETIREE">Retiree</option>
              </FormSelect>
            </Field>
            <FormActions onCancel={() => { setShowVarieteForm(false); setEditVariete(null) }} loading={saving} submitLabel={editVariete ? 'Mettre a jour' : 'Creer la variete'} />
          </form>
        </Modal>
      )}
    </div>
  )
}
