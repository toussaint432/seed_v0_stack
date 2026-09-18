import React, { useEffect, useState } from 'react'
import {
  Workflow, Plus, RefreshCw, Search, X, Eye, Edit2, Trash2,
  MapPin, Clock, CheckCircle2, ChevronRight, ArrowRight, Sprout,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, extractList } from '../../lib/normalizers'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Pagination } from '../components/Pagination'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GEN_CHART_COLORS } from '../../lib/constants'
import { generateLotCode } from '../../lib/lotCode'

interface Props { roleKey: string; userSpecialisation?: string | null; username?: string }

const PAGE_SIZE = 10

const STATUT_OPTIONS = [
  { value: 'PLANIFIE',  label: 'Planifié'  },
  { value: 'EN_COURS',  label: 'En cours'  },
  { value: 'TERMINE',   label: 'Terminé'   },
  { value: 'SUSPENDU',  label: 'Suspendu'  },
  { value: 'ANNULE',    label: 'Annulé'    },
]

// Génération fils par rôle (lot source → génération produite)
const NEXT_GEN: Record<string, string> = {
  G0: 'G1', G1: 'G2', G2: 'G3', G3: 'G4', G4: 'R1', R1: 'R2',
}

// Générations de lots SOURCE que chaque rôle peut utiliser
const SOURCE_GENS: Record<string, string[]> = {
  'seed-selector':      ['G0'],
  'seed-upsemcl':       ['G1', 'G2'],
  'seed-multiplicator': ['G3', 'G4', 'R1'],
}

// Libellé rôle créateur
const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  'seed-selector':      { label: 'Sélectionneur', color: '#7c3aed' },
  'seed-upsemcl':       { label: 'UPSemCL',       color: '#0369a1' },
  'seed-multiplicator': { label: 'Multiplicateur', color: '#15803d' },
  'seed-admin':         { label: 'Admin',          color: '#64748b' },
}

const GEN_HEX = GEN_CHART_COLORS

function GenBadge({ gen }: { gen: string }) {
  const color = GEN_HEX[gen] ?? '#6b7280'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + '18', color, border: `1px solid ${color}40`,
    }}>
      {gen}
    </span>
  )
}

function RoleBadge({ role }: { role?: string }) {
  if (!role) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const r = ROLE_LABEL[role]
  if (!r) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{role}</span>
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
      background: r.color + '18', color: r.color, border: `1px solid ${r.color}30`,
    }}>
      {r.label}
    </span>
  )
}

function GenArrow({ src, dst }: { src: string; dst: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <GenBadge gen={src} />
      <ArrowRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <GenBadge gen={dst} />
    </div>
  )
}

// Suggère un code programme selon le rôle + génération cible + variété
function suggestCode(roleKey: string, genCible: string, varCode: string): string {
  const prefix = roleKey === 'seed-selector'      ? 'SEL'
               : roleKey === 'seed-upsemcl'       ? 'UPS'
               : roleKey === 'seed-multiplicator' ? 'MUL'
               : 'PRG'
  const yr = new Date().getFullYear()
  const slug = varCode ? `-${varCode.slice(0, 6).toUpperCase()}` : ''
  return `${prefix}${slug}-${genCible}-${yr}`
}

export function Programs({ roleKey, userSpecialisation, username }: Props) {
  const [programs,     setPrograms]     = useState<any[]>([])
  const [lots,         setLots]         = useState<any[]>([])
  const [varieties,    setVarieties]    = useState<any[]>([])
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterGenCible, setFilterGenCible] = useState('')
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [currentPage,  setCurrentPage]  = useState(1)
  const [showForm,     setShowForm]     = useState(false)
  const [showDetail,   setShowDetail]   = useState<any>(null)
  const [editItem,     setEditItem]     = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [saving,       setSaving]       = useState(false)
  const [campagnes,    setCampagnes]    = useState<any[]>([])
  // Modal "Enregistrer le lot résultat"
  const [showLotResultat,  setShowLotResultat]  = useState(false)
  const [lotResultatProg,  setLotResultatProg]  = useState<any>(null)
  const [lotResultatForm,  setLotResultatForm]  = useState({ codeLot: '', quantiteNette: '', tauxGermination: '', puretePhysique: '', dateProduction: '', campagne: '' })
  const [savingResultat,   setSavingResultat]   = useState(false)

  // Droits par rôle
  const isAdmin     = roleKey === 'seed-admin'
  const canCreate   = ['seed-selector', 'seed-upsemcl', 'seed-multiplicator'].includes(roleKey)
  const canEdit     = (p: any) => !isAdmin && p.usernameCreateur !== undefined
  const canDelete   = (p: any) => !isAdmin && p.usernameCreateur !== undefined

  const FORM_INIT = {
    codeProgramme: '', idLotSource: '', generationCible: '',
    multiplicateur: roleKey === 'seed-multiplicator' ? (username || '') : '',
    campagne: '',
    surfacePrevueHa: '', quantiteSemenceAllouee: '',
    dateAttribution: new Date().toISOString().split('T')[0],
    statutProgramme: 'PLANIFIE', observations: '',
  }
  const [form, setForm] = useState(FORM_INIT)

  async function fetchAll() {
    setLoading(true)
    const lotsUrl = roleKey === 'seed-multiplicator' ? endpoints.lotsMesLots : endpoints.lots
    const [pRes, lRes, vRes, campRes] = await Promise.allSettled([
      api.get(endpoints.programs),
      api.get(lotsUrl),
      api.get(endpoints.varieties),
      api.get(endpoints.campagnes),
    ])
    setPrograms(pRes.status === 'fulfilled' ? (pRes.value.data ?? []) : [])
    setLots(extractList(lRes.status === 'fulfilled' ? lRes.value.data : null).map(normalizeLot))
    setVarieties(extractList(vRes.status === 'fulfilled' ? vRes.value.data : null))
    if (campRes.status === 'fulfilled') {
      const list: any[] = campRes.value.data ?? []
      setCampagnes(list)
      const def = list.find((c: any) => c.statut === 'EN_COURS')?.codeCampagne ?? list[0]?.codeCampagne ?? ''
      setForm(f => ({ ...f, campagne: f.campagne || def }))
      setLotResultatForm(f => ({ ...f, campagne: f.campagne || def }))
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // ── Lots source filtrés selon le rôle ──────────────────────────
  const allowedSourceGens = SOURCE_GENS[roleKey] ?? []
  const lotsForRole = lots.filter(l => {
    const gen = l.generation?.codeGeneration
    if (!allowedSourceGens.includes(gen)) return false
    if (l.statutLot !== 'DISPONIBLE') return false
    // Sélectionneur : uniquement son espèce
    if (roleKey === 'seed-selector' && userSpecialisation) {
      const v = varieties.find((vv: any) => vv.id === l.idVariete) as any
      const ce: string | undefined = v?.espece?.codeEspece
      if (ce && ce.toUpperCase() !== userSpecialisation.toUpperCase()) return false
    }
    return true
  })

  // ── Génération cible déduite du lot source sélectionné ─────────
  const selectedLot = lots.find(l => l.id === Number(form.idLotSource))
  const genSource   = selectedLot?.generation?.codeGeneration ?? ''
  const genCibleAuto = genSource ? (NEXT_GEN[genSource] ?? '') : ''

  // Mise à jour auto de generationCible quand le lot change
  useEffect(() => {
    if (genCibleAuto) setForm(f => ({ ...f, generationCible: genCibleAuto }))
  }, [genCibleAuto])

  // ── Map variété pour enrichissement ────────────────────────────
  const varMap: Record<number, any> = Object.fromEntries(varieties.map((v: any) => [v.id, v]))

  function getLotLabel(id: number): string {
    const lot = lots.find((l: any) => l.id === id)
    if (!lot) return `#${id}`
    const v = varMap[lot.idVariete] as any
    return `${lot.codeLot} — ${v?.nomVariete ?? ''}  (${lot.generation?.codeGeneration ?? 'N/A'})`
  }

  function getLotShort(id: number): string {
    const lot = lots.find((l: any) => l.id === id)
    return lot ? lot.codeLot : `#${id}`
  }

  // ── Filtres ────────────────────────────────────────────────────
  const filtered = programs.filter(p => {
    const s = search.toLowerCase()
    const matchSearch = !s
      || p.codeProgramme?.toLowerCase().includes(s)
      || p.multiplicateur?.toLowerCase().includes(s)
    const matchStatus = !filterStatus   || p.statut        === filterStatus
    const matchGen    = !filterGenCible || p.generationCible === filterGenCible
    return matchSearch && matchStatus && matchGen
  })
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // ── Stats ──────────────────────────────────────────────────────
  const byStatus    = programs.reduce((acc: Record<string, number>, p: any) => { acc[p.statut] = (acc[p.statut] || 0) + 1; return acc }, {})
  const totalSurface = programs.reduce((sum, p) => sum + (parseFloat(p.superficieHa) || 0), 0)
  const gensCibles  = [...new Set(programs.map(p => p.generationCible).filter(Boolean))].sort() as string[]

  // ── Ouverture formulaire ───────────────────────────────────────
  function openCreate() {
    setEditItem(null)
    setForm(FORM_INIT)
    setShowForm(true)
  }

  function openEdit(p: any) {
    setEditItem(p)
    setForm({
      codeProgramme:         p.codeProgramme        ?? '',
      idLotSource:           p.idLot?.toString()    ?? '',
      generationCible:       p.generationCible      ?? '',
      multiplicateur:        p.multiplicateur        ?? '',
      campagne:              p.campagne              ?? '',
      surfacePrevueHa:       p.superficieHa?.toString() ?? '',
      quantiteSemenceAllouee: p.objectifKg?.toString()  ?? '',
      dateAttribution:       p.dateDebut             ?? new Date().toISOString().split('T')[0],
      statutProgramme:       p.statut                ?? 'PLANIFIE',
      observations:          p.observations          ?? '',
    })
    setShowForm(true)
  }

  // Suggestion de code au choix du lot source
  function handleLotChange(lotId: string) {
    setForm(f => {
      const lot = lots.find(l => l.id === Number(lotId))
      const gen = lot?.generation?.codeGeneration ?? ''
      const genC = NEXT_GEN[gen] ?? ''
      const v = varMap[lot?.idVariete] as any
      const code = suggestCode(roleKey, genC, v?.codeVariete ?? '')
      return { ...f, idLotSource: lotId, generationCible: genC, codeProgramme: f.codeProgramme || code }
    })
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const payload = {
        codeProgramme:    form.codeProgramme,
        idLot:            Number(form.idLotSource),
        generationCible:  form.generationCible,
        multiplicateur:   form.multiplicateur || undefined,
        campagne:         form.campagne       || undefined,
        superficieHa:     form.surfacePrevueHa         ? Number(form.surfacePrevueHa)         : undefined,
        objectifKg:       form.quantiteSemenceAllouee  ? Number(form.quantiteSemenceAllouee)  : undefined,
        dateDebut:        form.dateAttribution          || undefined,
        statut:           form.statutProgramme,
        observations:     form.observations            || undefined,
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

  // ── Lot résultat — enregistrer la récolte depuis un programme EN_COURS ────
  function openLotResultat(p: any) {
    const srcLot = lots.find(l => l.id === p.idLot)
    const v = srcLot ? varMap[srcLot.idVariete] as any : null
    const genCible = p.generationCible ?? ''
    const codeCampagne = p.campagne ?? ''
    const suggested = generateLotCode(genCible, v?.espece?.codeEspece ?? '', v?.nomVariete ?? '', codeCampagne, lots)
    setLotResultatProg(p)
    setLotResultatForm({ codeLot: suggested, quantiteNette: p.objectifKg?.toString() ?? '', tauxGermination: '', puretePhysique: '', dateProduction: new Date().toISOString().split('T')[0], campagne: codeCampagne })
    setShowLotResultat(true)
  }

  async function submitLotResultat(e: React.FormEvent) {
    e.preventDefault(); setSavingResultat(true)
    try {
      const srcLot = lots.find(l => l.id === lotResultatProg?.idLot)
      if (!srcLot) throw new Error('Lot source introuvable')
      const payload = {
        codeLot:       lotResultatForm.codeLot,
        idVariete:     srcLot.idVariete,
        generationCode: lotResultatProg.generationCible,
        campagne:       lotResultatForm.campagne,
        dateProduction: lotResultatForm.dateProduction || null,
        quantiteNette:  parseFloat(lotResultatForm.quantiteNette),
        unite:          'kg',
        tauxGermination: lotResultatForm.tauxGermination ? parseFloat(lotResultatForm.tauxGermination) : null,
        puretePhysique:  lotResultatForm.puretePhysique  ? parseFloat(lotResultatForm.puretePhysique)  : null,
      }
      await api.post(endpoints.lotChild(srcLot.id), payload)
      // Programme → TERMINE
      await api.put(endpoints.programById(lotResultatProg.id), { ...lotResultatProg, statut: 'TERMINE', idLot: lotResultatProg.idLot, generationCible: lotResultatProg.generationCible })
      setToast({ msg: `Lot ${lotResultatForm.codeLot} enregistré — programme clôturé`, type: 'success' })
      setShowLotResultat(false); setLotResultatProg(null); fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || err?.message || 'Erreur', type: 'error' })
    } finally { setSavingResultat(false) }
  }

  // ── Vue admin : bandeau d'information ─────────────────────────
  const adminInfo = isAdmin && (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', marginBottom: 12,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, fontSize: 12.5, color: 'var(--text-muted)',
    }}>
      <Eye size={14} style={{ flexShrink: 0 }} />
      Mode supervision — consultation uniquement. La planification est effectuée par les acteurs métier.
    </div>
  )

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer ce programme ?"
          message={`Le programme "${deleteTarget.codeProgramme}" sera supprimé.`}
          confirmLabel="Supprimer" variant="danger" loading={saving}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* KPI */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon violet"><Workflow size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : programs.length}</div><div className="stat-label">Programmes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['EN_COURS'] || 0}</div><div className="stat-label">En cours</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['TERMINE'] || 0}</div><div className="stat-label">Terminés</div></div></div>
        <div className="stat-card"><div className="stat-icon blue"><MapPin size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : totalSurface.toLocaleString('fr-FR')}</div><div className="stat-label">Surface totale (ha)</div></div></div>
      </div>

      {adminInfo}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Workflow size={15} /></span>
            Programmes de multiplication
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canCreate && (
              <button className="btn btn-primary" onClick={openCreate}><Plus size={13} /> Nouveau programme</button>
            )}
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>

        {/* Filtres */}
        <div className="filters-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: '1 1 200px', maxWidth: 280 }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              placeholder="Code, multiplicateur…"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'var(--font-sans)', flex: 1 }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>

          <select className="input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1) }} style={{ width: 130 }}>
            <option value="">Tous statuts</option>
            {STATUT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Chips génération cible — admin uniquement (vue globale) */}
          {isAdmin && gensCibles.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {['', ...gensCibles].map(g => {
                const active = filterGenCible === g
                const color  = g ? (GEN_HEX[g] ?? '#6b7280') : 'var(--green-600,#16a34a)'
                return (
                  <button
                    key={g || '__all'}
                    onClick={() => { setFilterGenCible(g); setCurrentPage(1) }}
                    style={{
                      height: 28, padding: '0 10px', borderRadius: 20, fontSize: 11.5,
                      fontWeight: active ? 700 : 400, cursor: 'pointer',
                      border: `1.5px solid ${active ? color : 'var(--border)'}`,
                      background: active ? color + '18' : 'var(--surface)',
                      color: active ? color : 'var(--text-muted)',
                      transition: 'all .12s',
                    }}
                  >
                    {g || 'Toutes'}
                  </button>
                )
              })}
            </div>
          )}

          {(search || filterStatus || filterGenCible) && (
            <button className="btn btn-ghost" style={{ fontSize: 12, height: 28 }} onClick={() => { setSearch(''); setFilterStatus(''); setFilterGenCible(''); setCurrentPage(1) }}>
              <X size={11} /> Effacer
            </button>
          )}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Lot source</th>
                <th>Multiplication</th>
                <th>Multiplicateur</th>
                <th>Campagne</th>
                <th>Surface (ha)</th>
                <th>Qté allouée</th>
                <th>Statut</th>
                {isAdmin && <th>Créé par</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0, 1, 2, 3].map(i => <tr key={i}><td colSpan={isAdmin ? 10 : 9}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                : pageItems.length === 0
                  ? (
                    <tr><td colSpan={isAdmin ? 10 : 9}>
                      <div className="empty-state">
                        <div className="empty-icon"><Workflow size={20} /></div>
                        <div className="empty-title">{search || filterStatus || filterGenCible ? 'Aucun résultat' : 'Aucun programme'}</div>
                        {canCreate && !search && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openCreate}>+ Nouveau programme</button>}
                      </div>
                    </td></tr>
                  )
                  : pageItems.map(p => {
                      const srcGen = p.idLot ? lots.find(l => l.id === p.idLot)?.generation?.codeGeneration : undefined
                      return (
                        <tr key={p.id}>
                          <td><span className="td-mono" style={{ fontWeight: 700 }}>{p.codeProgramme}</span></td>
                          <td>
                            {p.idLot ? (
                              <div>
                                <div className="td-mono" style={{ fontSize: 11, fontWeight: 600 }}>{getLotShort(p.idLot)}</div>
                                {srcGen && <div style={{ marginTop: 2 }}><GenBadge gen={srcGen} /></div>}
                              </div>
                            ) : '—'}
                          </td>
                          <td>
                            {srcGen && p.generationCible
                              ? <GenArrow src={srcGen} dst={p.generationCible} />
                              : p.generationCible ? <GenBadge gen={p.generationCible} /> : '—'
                            }
                          </td>
                          <td style={{ fontSize: 12.5, fontWeight: 500 }}>{p.multiplicateur || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.campagne || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{p.superficieHa ? Number(p.superficieHa).toLocaleString('fr-FR') : '—'}</td>
                          <td>
                            {p.objectifKg
                              ? <><span style={{ fontWeight: 600 }}>{Number(p.objectifKg).toLocaleString('fr-FR')}</span> <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>kg</span></>
                              : '—'}
                          </td>
                          <td><StatusBadge status={p.statut} showIcon /></td>
                          {isAdmin && <td><RoleBadge role={p.roleCreateur} /></td>}
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} title="Détail" onClick={() => setShowDetail(p)}><Eye size={12} /></button>
                              {canEdit(p) && <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} title="Modifier" onClick={() => openEdit(p)}><Edit2 size={12} /></button>}
                              {canEdit(p) && p.statut === 'EN_COURS' && (
                                <button
                                  className="btn btn-ghost"
                                  style={{ height: 26, padding: '0 8px', color: '#16a34a', fontWeight: 600, fontSize: 11, gap: 4, display: 'flex', alignItems: 'center' }}
                                  title="Enregistrer le lot résultat de récolte"
                                  onClick={() => openLotResultat(p)}
                                >
                                  <Sprout size={12} /> Résultat
                                </button>
                              )}
                              {canDelete(p) && <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', color: 'var(--red-600,#dc2626)' }} title="Supprimer" onClick={() => setDeleteTarget(p)}><Trash2 size={12} /></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      </div>

      {/* ── Modal détail ─────────────────────────────────────── */}
      {showDetail && (() => {
        const srcGen = showDetail.idLot ? lots.find((l: any) => l.id === showDetail.idLot)?.generation?.codeGeneration : undefined
        return (
          <Modal title={`Programme — ${showDetail.codeProgramme}`} subtitle="Détails du programme de multiplication" onClose={() => setShowDetail(null)} size="lg">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Lot source</div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{getLotShort(showDetail.idLot)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Multiplication</div>
                {srcGen && showDetail.generationCible
                  ? <GenArrow src={srcGen} dst={showDetail.generationCible} />
                  : <GenBadge gen={showDetail.generationCible || '?'} />}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Multiplicateur</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{showDetail.multiplicateur || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Campagne</div>
                <div style={{ fontSize: 13 }}>{showDetail.campagne || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Surface prévue</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{showDetail.superficieHa || '—'} <span style={{ fontSize: 13, fontWeight: 400 }}>ha</span></div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Objectif récolte</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{showDetail.objectifKg ? Number(showDetail.objectifKg).toLocaleString('fr-FR') : '—'} <span style={{ fontSize: 13, fontWeight: 400 }}>kg</span></div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date début</div>
                <div style={{ fontSize: 13 }}>{showDetail.dateDebut || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Statut</div>
                <StatusBadge status={showDetail.statut} showIcon size="md" />
              </div>
              {showDetail.roleCreateur && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Planifié par</div>
                  <RoleBadge role={showDetail.roleCreateur} />
                </div>
              )}
              {showDetail.observations && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Observations</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{showDetail.observations}</div>
                </div>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* ── Modal lot résultat de récolte ────────────────────── */}
      {showLotResultat && lotResultatProg && (() => {
        const srcLot = lots.find(l => l.id === lotResultatProg.idLot)
        const srcGen = srcLot?.generation?.codeGeneration ?? '?'
        const genCible = lotResultatProg.generationCible ?? '?'
        return (
          <Modal
            title="Enregistrer le lot résultat"
            subtitle={`Récolte du programme ${lotResultatProg.codeProgramme} · ${srcGen} → ${genCible}`}
            onClose={() => { setShowLotResultat(false); setLotResultatProg(null) }}
            size="lg"
          >
            {/* Résumé du programme */}
            <div style={{ display: 'flex', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, fontSize: 12.5, flexWrap: 'wrap' }}>
              <span>Lot source : <strong>{srcLot?.codeLot ?? '—'}</strong></span>
              <span>·</span>
              <span>Objectif : <strong>{lotResultatProg.objectifKg ? `${Number(lotResultatProg.objectifKg).toLocaleString('fr-FR')} kg` : '—'}</strong></span>
              <span>·</span>
              <span>Surface : <strong>{lotResultatProg.superficieHa ? `${lotResultatProg.superficieHa} ha` : '—'}</strong></span>
            </div>
            <form onSubmit={submitLotResultat}>
              <FormRow>
                <Field label="Code lot résultat" required hint="Code unique du lot produit">
                  <FormInput value={lotResultatForm.codeLot} onChange={e => setLotResultatForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} required />
                </Field>
                <Field label="Génération produite">
                  <div style={{ height: 36, display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
                    <GenBadge gen={srcGen} />
                    <ArrowRight size={12} style={{ margin: '0 8px', color: 'var(--text-muted)' }} />
                    <GenBadge gen={genCible} />
                  </div>
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Campagne" required>
                  <FormSelect value={lotResultatForm.campagne} onChange={e => setLotResultatForm(f => ({ ...f, campagne: e.target.value }))} required>
                    <option value="">— Choisir une campagne —</option>
                    {campagnes.map((c: any) => <option key={c.id} value={c.codeCampagne}>{c.libelle}</option>)}
                  </FormSelect>
                </Field>
                <Field label="Date de production">
                  <FormInput type="date" value={lotResultatForm.dateProduction} onChange={e => setLotResultatForm(f => ({ ...f, dateProduction: e.target.value }))} />
                </Field>
              </FormRow>
              <Field label="Production réelle conditionnée (kg)" required hint="Quantité effectivement récoltée et conditionnée">
                <FormInput type="number" value={lotResultatForm.quantiteNette} onChange={e => setLotResultatForm(f => ({ ...f, quantiteNette: e.target.value }))} placeholder="ex : 450" min="0" step="0.01" required />
              </Field>
              <FormRow>
                <Field label="Taux germination (%)">
                  <FormInput type="number" value={lotResultatForm.tauxGermination} onChange={e => setLotResultatForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" />
                </Field>
                <Field label="Pureté physique (%)">
                  <FormInput type="number" value={lotResultatForm.puretePhysique} onChange={e => setLotResultatForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="99.5" min="0" max="100" step="0.1" />
                </Field>
              </FormRow>
              <div style={{ padding: '10px 14px', background: 'var(--green-50,#f0fdf4)', border: '1px solid var(--green-200,#bbf7d0)', borderRadius: 8, fontSize: 12, color: 'var(--green-800,#166534)', marginBottom: 12 }}>
                Le lot résultat sera créé en <strong>DISPONIBLE</strong> et le programme passera automatiquement en <strong>TERMINE</strong>.
              </div>
              <FormActions onCancel={() => { setShowLotResultat(false); setLotResultatProg(null) }} loading={savingResultat} submitLabel="Enregistrer la récolte" />
            </form>
          </Modal>
        )
      })()}

      {/* ── Modal formulaire ─────────────────────────────────── */}
      {showForm && (
        <Modal
          title={editItem ? `Modifier — ${editItem.codeProgramme}` : 'Nouveau programme de multiplication'}
          subtitle={
            roleKey === 'seed-selector'      ? 'Planification G0 → G1 (semences génétiques)'
          : roleKey === 'seed-upsemcl'       ? 'Planification G1→G2 ou G2→G3'
          : roleKey === 'seed-multiplicator' ? 'Planification G3→G4, G4→R1 ou R1→R2'
          : 'Nouveau programme'
          }
          onClose={() => { setShowForm(false); setEditItem(null) }}
          size="lg"
        >
          <form onSubmit={submitForm}>
            {/* Lot source — filtré par rôle */}
            <Field label="Lot source" required>
              <FormSelect
                value={form.idLotSource}
                onChange={e => handleLotChange(e.target.value)}
                required
              >
                <option value="">— Sélectionner un lot source —</option>
                {lotsForRole.map((l: any) => {
                  const v = varMap[l.idVariete] as any
                  const gen = l.generation?.codeGeneration ?? '?'
                  return (
                    <option key={l.id} value={l.id}>
                      {l.codeLot} — {v?.nomVariete ?? ''} ({gen})
                    </option>
                  )
                })}
              </FormSelect>
              {lotsForRole.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Aucun lot disponible pour votre rôle ({allowedSourceGens.join(', ')}).
                </div>
              )}
            </Field>

            {/* Génération source → cible (lecture seule, déduite) */}
            {form.idLotSource && genCibleAuto && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16,
              }}>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ce lot produira la génération :</span>
                <GenArrow src={genSource} dst={genCibleAuto} />
              </div>
            )}

            <FormRow>
              <Field label="Code programme" required hint={`Ex: ${suggestCode(roleKey, genCibleAuto || 'G?', '')}`}>
                <FormInput
                  value={form.codeProgramme}
                  onChange={e => setForm(f => ({ ...f, codeProgramme: e.target.value.toUpperCase() }))}
                  placeholder={suggestCode(roleKey, genCibleAuto || 'G?', '')}
                  required
                  disabled={!!editItem}
                />
              </Field>
              <Field
                label="Multiplicateur"
                required={roleKey !== 'seed-multiplicator'}
                hint={roleKey === 'seed-multiplicator' ? 'Rempli automatiquement (vous êtes le multiplicateur)' : undefined}
              >
                <FormInput
                  value={form.multiplicateur}
                  onChange={e => setForm(f => ({ ...f, multiplicateur: e.target.value }))}
                  placeholder={roleKey === 'seed-multiplicator' ? username || 'Votre nom' : 'Nom ou organisation du multiplicateur'}
                  readOnly={roleKey === 'seed-multiplicator'}
                  style={roleKey === 'seed-multiplicator' ? { background: 'var(--surface-2)', color: 'var(--text-secondary)', cursor: 'default' } : undefined}
                />
              </Field>
            </FormRow>

            <FormRow>
              <Field label="Campagne">
                <FormSelect value={form.campagne} onChange={e => setForm(f => ({ ...f, campagne: e.target.value }))}>
                  <option value="">— Choisir une campagne —</option>
                  {campagnes.map((c: any) => <option key={c.id} value={c.codeCampagne}>{c.libelle}</option>)}
                </FormSelect>
              </Field>
              <Field label="Date d'attribution">
                <FormInput type="date" value={form.dateAttribution} onChange={e => setForm(f => ({ ...f, dateAttribution: e.target.value }))} />
              </Field>
            </FormRow>

            <FormRow>
              <Field label="Surface prévue (ha)">
                <FormInput type="number" value={form.surfacePrevueHa} onChange={e => setForm(f => ({ ...f, surfacePrevueHa: e.target.value }))} placeholder="10" min="0" step="0.001" />
              </Field>
              <Field label="Quantité semence allouée (kg)">
                <FormInput type="number" value={form.quantiteSemenceAllouee} onChange={e => setForm(f => ({ ...f, quantiteSemenceAllouee: e.target.value }))} placeholder="500" min="0" step="0.001" />
              </Field>
            </FormRow>

            {/* Statut uniquement en mode édition — à la création c'est toujours PLANIFIE */}
            {editItem && (
              <Field label="Statut">
                <FormSelect value={form.statutProgramme} onChange={e => setForm(f => ({ ...f, statutProgramme: e.target.value }))}>
                  {STATUT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </FormSelect>
              </Field>
            )}

            <Field label="Observations">
              <textarea
                value={form.observations}
                onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Notes complémentaires…"
                style={{ width: '100%', minHeight: 70, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: 'var(--surface)' }}
              />
            </Field>

            <FormActions
              onCancel={() => { setShowForm(false); setEditItem(null) }}
              loading={saving}
              submitLabel={editItem ? 'Mettre à jour' : 'Créer le programme'}
            />
          </form>
        </Modal>
      )}
    </div>
  )
}
