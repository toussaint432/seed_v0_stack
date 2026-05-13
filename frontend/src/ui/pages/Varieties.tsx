import React, { useEffect, useState } from 'react'
import {
  Leaf, Sprout, CheckCircle2, Plus, Search, X,
  RefreshCw, Edit2, FlaskConical, ChevronRight,
  Archive, Trash2, AlertTriangle, Eye, EyeOff, MessageSquare, MapPin,
  RotateCcw, Clock, User, TrendingUp, Wheat, LucideIcon,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string; userSpecialisation?: string | null }

const STATUT_CONFIG: Record<string, { label: string; cls: string }> = {
  DIFFUSEE: { label: 'Diffusée',  cls: 'badge-green' },
  EN_TEST:  { label: 'En test',   cls: 'badge-gold'  },
  RETIREE:  { label: 'Retirée',   cls: 'badge-red'   },
  ARCHIVEE: { label: 'Archivée',  cls: 'badge-gray'  },
}

const ESPECE_ICONS: Record<string, LucideIcon> = {
  default: Leaf,
  MIL: Wheat, SORGHO: Wheat, MAIS: Wheat, RIZ: Sprout,
  ARACHIDE: Sprout, NIEBE: Sprout, COWPEA: Sprout,
}

export function Varieties({ roleKey, userSpecialisation }: Props) {
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

  const [archiveTarget,  setArchiveTarget]  = useState<any>(null)
  const [archiveComment, setArchiveComment] = useState('')
  const [archiving,      setArchiving]      = useState(false)

  const [deleteTarget,  setDeleteTarget]  = useState<any>(null)
  const [deleteComment, setDeleteComment] = useState('')
  const [deleting,      setDeleting]      = useState(false)

  const [showArchived, setShowArchived] = useState(false)
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | null>(null)
  const [sortField, setSortField] = useState<string>('nomVariete')
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('asc')

  const [desarchiveTarget, setDesarchiveTarget] = useState<any>(null)
  const [desarchiving,     setDesarchiving]     = useState(false)

  const [allZones,      setAllZones]      = useState<any[]>([])
  const [zonesTarget,   setZonesTarget]   = useState<any>(null)
  const [zonesRows,     setZonesRows]     = useState<{ idZone: string; niveauAdaptation: string }[]>([])
  const [savingZones,   setSavingZones]   = useState(false)

  const [especeForm, setEspeceForm] = useState({
    codeEspece: '', nomCommun: '', nomScientifique: '',
  })
  const [varieteForm, setVarieteForm] = useState({
    codeVariete: '', nomVariete: '', idEspece: '', origine: '',
    selectionneurPrincipal: '', anneeCreation: '', cycleMin: '', cycleMax: '',
    statutVariete: 'DIFFUSEE',
    pedigree: '', typeGrain: '', rendementMin: '', rendementMax: '',
  })

  const isAdminOrSelector = ['seed-admin', 'seed-selector'].includes(roleKey)

  function canEdit(codeEspece?: string): boolean {
    if (roleKey === 'seed-admin') return true
    if (roleKey === 'seed-selector') {
      if (!userSpecialisation) return true
      if (!codeEspece) return false
      return codeEspece.toUpperCase() === userSpecialisation.toUpperCase()
    }
    return false
  }

  const canCreate  = isAdminOrSelector
  const canArchive = isAdminOrSelector

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

  const selectedSpecies  = species.find(s => s.id === selectedSpeciesId) ?? null
  const selectedVariety  = varieties.find(v => v.id === selectedVarietyId) ?? null

  const kpiBase = selectedSpecies
    ? varieties.filter(v => v.espece?.id === selectedSpecies.id)
    : varieties
  const kpiActive   = kpiBase.filter(v => v.statutVariete !== 'ARCHIVEE').length
  const kpiDiffusee = kpiBase.filter(v => v.statutVariete === 'DIFFUSEE').length
  const kpiEnTest   = kpiBase.filter(v => v.statutVariete === 'EN_TEST').length
  const kpiArchived = kpiBase.filter(v => v.statutVariete === 'ARCHIVEE').length

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

  const archivedCount = varieties.filter(v => v.statutVariete === 'ARCHIVEE').length

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    let av: any, bv: any
    switch (sortField) {
      case 'codeVariete':  av = a.codeVariete ?? '';  bv = b.codeVariete ?? '';  break
      case 'espece':       av = a.espece?.nomCommun ?? ''; bv = b.espece?.nomCommun ?? ''; break
      case 'cycleMin':     av = a.cycleMin ?? 0;  bv = b.cycleMin ?? 0;  break
      case 'rendementMin': av = a.rendementMin ?? 0; bv = b.rendementMin ?? 0; break
      case 'statutVariete': av = a.statutVariete ?? ''; bv = b.statutVariete ?? ''; break
      default:             av = a.nomVariete ?? '';  bv = b.nomVariete ?? ''
    }
    const cmp = typeof av === 'number' ? av - bv : av.localeCompare(bv, 'fr')
    return sortDir === 'asc' ? cmp : -cmp
  })

  function varietyCountForSpecies(s: any) {
    return varieties.filter(v => v.espece?.id === s.id && v.statutVariete !== 'ARCHIVEE').length
  }

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

  async function submitDesarchive() {
    if (!desarchiveTarget) return
    setDesarchiving(true)
    try {
      await api.patch(endpoints.varietyStatut(desarchiveTarget.id), { statut: 'DIFFUSEE' })
      setToast({ msg: `Variété "${desarchiveTarget.nomVariete}" désarchivée`, type: 'success' })
      setDesarchiveTarget(null)
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors du désarchivage', type: 'error' })
    } finally { setDesarchiving(false) }
  }

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

  async function submitVariete(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editVariete) {
        await api.put(endpoints.varietyById(editVariete.id), {
          nomVariete:             varieteForm.nomVariete,
          espece:                 { id: Number(varieteForm.idEspece) },
          origine:                varieteForm.origine               || null,
          selectionneurPrincipal: varieteForm.selectionneurPrincipal || null,
          anneeCreation:          varieteForm.anneeCreation  ? Number(varieteForm.anneeCreation)  : null,
          cycleMin:               varieteForm.cycleMin       ? Number(varieteForm.cycleMin)       : null,
          cycleMax:               varieteForm.cycleMax       ? Number(varieteForm.cycleMax)       : null,
          statutVariete:          varieteForm.statutVariete,
          pedigree:               varieteForm.pedigree       || null,
          typeGrain:              varieteForm.typeGrain      || null,
          rendementMin:           varieteForm.rendementMin   ? Number(varieteForm.rendementMin)   : null,
          rendementMax:           varieteForm.rendementMax   ? Number(varieteForm.rendementMax)   : null,
        })
        setToast({ msg: 'Variété mise à jour', type: 'success' })
      } else {
        await api.post(endpoints.varieties, {
          codeVariete:            varieteForm.codeVariete,
          nomVariete:             varieteForm.nomVariete,
          espece:                 { id: Number(varieteForm.idEspece) },
          origine:                varieteForm.origine               || undefined,
          selectionneurPrincipal: varieteForm.selectionneurPrincipal || undefined,
          anneeCreation:          varieteForm.anneeCreation  ? Number(varieteForm.anneeCreation)  : undefined,
          cycleMin:               varieteForm.cycleMin       ? Number(varieteForm.cycleMin)       : undefined,
          cycleMax:               varieteForm.cycleMax       ? Number(varieteForm.cycleMax)       : undefined,
          statutVariete:          varieteForm.statutVariete,
          pedigree:               varieteForm.pedigree       || undefined,
          typeGrain:              varieteForm.typeGrain      || undefined,
          rendementMin:           varieteForm.rendementMin   ? Number(varieteForm.rendementMin)   : undefined,
          rendementMax:           varieteForm.rendementMax   ? Number(varieteForm.rendementMax)   : undefined,
        })
        setToast({ msg: `Variété "${varieteForm.nomVariete}" créée`, type: 'success' })
      }
      setShowVarieteForm(false)
      setEditVariete(null)
      setVarieteForm({ codeVariete: '', nomVariete: '', idEspece: '', origine: '', selectionneurPrincipal: '', anneeCreation: '', cycleMin: '', cycleMax: '', statutVariete: 'DIFFUSEE', pedigree: '', typeGrain: '', rendementMin: '', rendementMax: '' })
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
      cycleMin: v.cycleMin?.toString() || '',
      cycleMax: v.cycleMax?.toString() || '',
      statutVariete: v.statutVariete || 'DIFFUSEE',
      pedigree: v.pedigree || '',
      typeGrain: v.typeGrain || '',
      rendementMin: v.rendementMin?.toString() || '',
      rendementMax: v.rendementMax?.toString() || '',
    })
    setShowVarieteForm(true)
  }

  function openNewVariete() {
    setEditVariete(null)
    setVarieteForm({
      codeVariete: '', nomVariete: '',
      idEspece: selectedSpeciesId?.toString() || '',
      origine: '', selectionneurPrincipal: '', anneeCreation: '', cycleMin: '', cycleMax: '',
      statutVariete: 'DIFFUSEE',
      pedigree: '', typeGrain: '', rendementMin: '', rendementMax: '',
    })
    setShowVarieteForm(true)
  }

  async function openZones(v: any) {
    setZonesTarget(v)
    setZonesRows([])
    const [zonesRes, assignedRes] = await Promise.allSettled([
      api.get(endpoints.zones),
      api.get(endpoints.varietyZones(v.id)),
    ])
    if (zonesRes.status === 'fulfilled')   setAllZones(zonesRes.value.data)
    if (assignedRes.status === 'fulfilled') {
      const assigned: any[] = assignedRes.value.data
      setZonesRows(assigned.map((z: any) => ({
        idZone: String(z.zone?.id ?? z.idZone ?? ''),
        niveauAdaptation: z.niveauAdaptation ?? 'OPTIMAL',
      })))
    }
  }

  async function saveZones(e: React.FormEvent) {
    e.preventDefault()
    if (!zonesTarget) return
    setSavingZones(true)
    try {
      const payload = zonesRows
        .filter(r => r.idZone)
        .map(r => ({ idZone: Number(r.idZone), niveauAdaptation: r.niveauAdaptation }))
      await api.put(endpoints.varietyZones(zonesTarget.id), payload)
      setToast({ msg: `Zones mises à jour pour ${zonesTarget.nomVariete}`, type: 'success' })
      setZonesTarget(null)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la sauvegarde', type: 'error' })
    } finally { setSavingZones(false) }
  }

  /* ── Render ── */
  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Bandeau contexte rôle sélectionneur ── */}
      {roleKey === 'seed-selector' && userSpecialisation && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 18 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FlaskConical size={14} color="#fff" />
          </div>
          <div>
            <span style={{ fontSize: 13, color: '#1e3a8a', fontWeight: 600 }}>Sélectionneur</span>
            <span style={{ fontSize: 13, color: '#3b82f6', marginLeft: 8 }}>
              Spécialisation : <strong>{userSpecialisation}</strong>
            </span>
          </div>
          <span style={{ fontSize: 11.5, color: '#64748b', marginLeft: 'auto' }}>
            Modification autorisée pour les variétés de votre espèce uniquement
          </span>
        </div>
      )}

      {/* ── KPI Cards — 3 niveaux : variété > espèce > global ── */}
      {selectedVariety ? (

        /* Niveau 3 : variété sélectionnée */
        <div style={{ marginBottom: 22 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--green-50)', border: '1px solid var(--green-200)',
            borderRadius: 10, padding: '8px 14px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--green-700)' }}>
              <Sprout size={14} />
              <strong>{selectedVariety.codeVariete}</strong>
              <span style={{ color: 'var(--green-600)' }}>{selectedVariety.nomVariete}</span>
              {selectedSpecies && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', borderLeft: '1px solid var(--green-200)', paddingLeft: 8 }}>
                  {selectedSpecies.nomCommun}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {selectedSpecies && (
                <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-muted)', gap: 5, height: 28 }}
                  onClick={() => setSelectedVarietyId(null)}>
                  <Leaf size={12} /> Vue espèce
                </button>
              )}
              <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-muted)', gap: 5, height: 28 }}
                onClick={() => { setSelectedVarietyId(null); setSelectedSpeciesId(null) }}>
                <X size={12} /> Vue globale
              </button>
            </div>
          </div>
          <div className="stats-grid">
            {/* Espèce */}
            <div className="stat-card" style={{ borderLeft: '3px solid var(--green-500)', position: 'relative' }}>
              <div className="stat-icon green"><Leaf size={18} /></div>
              <div className="stat-body">
                <div className="stat-value" style={{ fontSize: 20, fontWeight: 800 }}>{selectedVariety.espece?.codeEspece ?? '—'}</div>
                <div className="stat-label">{selectedVariety.espece?.nomCommun ?? 'Espèce'}</div>
              </div>
            </div>
            {/* Statut */}
            <div className="stat-card" style={{ borderLeft: `3px solid ${selectedVariety.statutVariete === 'DIFFUSEE' ? 'var(--green-500)' : selectedVariety.statutVariete === 'EN_TEST' ? 'var(--gold)' : 'var(--text-muted)'}` }}>
              <div className="stat-icon" style={{
                background: selectedVariety.statutVariete === 'DIFFUSEE' ? 'var(--green-100)' :
                            selectedVariety.statutVariete === 'EN_TEST'  ? 'var(--gold-light)' : 'var(--surface-3)',
                color:      selectedVariety.statutVariete === 'DIFFUSEE' ? 'var(--green-700)'  :
                            selectedVariety.statutVariete === 'EN_TEST'  ? 'var(--gold-dark)'  : 'var(--text-muted)',
              }}><CheckCircle2 size={18} /></div>
              <div className="stat-body">
                <div className="stat-value" style={{ fontSize: 17, fontWeight: 700 }}>
                  {STATUT_CONFIG[selectedVariety.statutVariete]?.label ?? selectedVariety.statutVariete}
                </div>
                <div className="stat-label">Statut actuel</div>
              </div>
            </div>
            {/* Cycle */}
            <div className="stat-card" style={{ borderLeft: '3px solid var(--gold)' }}>
              <div className="stat-icon gold"><Clock size={18} /></div>
              <div className="stat-body">
                <div className="stat-value" style={{ fontSize: 20, fontWeight: 800 }}>
                  {selectedVariety.cycleMin != null && selectedVariety.cycleMax != null
                    ? (selectedVariety.cycleMin === selectedVariety.cycleMax
                        ? `${selectedVariety.cycleMin} j`
                        : `${selectedVariety.cycleMin}–${selectedVariety.cycleMax} j`)
                    : '—'}
                </div>
                <div className="stat-label">Cycle végétatif</div>
              </div>
            </div>
            {/* Rendement */}
            <div className="stat-card" style={{ borderLeft: '3px solid var(--green-500)' }}>
              <div className="stat-icon green"><TrendingUp size={18} /></div>
              <div className="stat-body">
                <div className="stat-value" style={{ fontSize: 20, fontWeight: 800 }}>
                  {selectedVariety.rendementMin != null && selectedVariety.rendementMax != null
                    ? (selectedVariety.rendementMin === selectedVariety.rendementMax
                        ? `${selectedVariety.rendementMin} t/ha`
                        : `${selectedVariety.rendementMin}–${selectedVariety.rendementMax} t/ha`)
                    : '—'}
                </div>
                <div className="stat-label">Rendement potentiel</div>
              </div>
            </div>
            {/* Sélectionneur */}
            {selectedVariety.selectionneurPrincipal && (
              <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
                <div className="stat-icon" style={{ background: 'var(--violet-50)', color: 'var(--violet-600)' }}>
                  <User size={18} />
                </div>
                <div className="stat-body">
                  <div className="stat-value" style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedVariety.selectionneurPrincipal}
                  </div>
                  <div className="stat-label">Sélectionneur principal</div>
                </div>
              </div>
            )}
          </div>
        </div>

      ) : selectedSpecies ? (

        /* Niveau 2 : espèce sélectionnée */
        <div style={{ marginBottom: 22 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 10, padding: '8px 14px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gold-dark)' }}>
              <Leaf size={14} />
              <strong>{selectedSpecies.codeEspece}</strong>
              <span style={{ color: '#92400e' }}>{selectedSpecies.nomCommun}</span>
              {selectedSpecies.nomScientifique && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', borderLeft: '1px solid #fde68a', paddingLeft: 8 }}>
                  {selectedSpecies.nomScientifique}
                </span>
              )}
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-muted)', gap: 5, height: 28 }}
              onClick={() => setSelectedSpeciesId(null)}>
              <X size={12} /> Vue globale
            </button>
          </div>
          <div className="stats-grid">
            <div className="stat-card" style={{ borderLeft: '3px solid var(--gold)' }}>
              <div className="stat-icon gold"><Sprout size={18} /></div>
              <div className="stat-body">
                <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{loading ? '…' : kpiActive}</div>
                <div className="stat-label">Variétés actives</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--green-500)' }}>
              <div className="stat-icon green"><CheckCircle2 size={18} /></div>
              <div className="stat-body">
                <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{loading ? '…' : kpiDiffusee}</div>
                <div className="stat-label">Diffusées</div>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid var(--gold)' }}>
              <div className="stat-icon gold"><FlaskConical size={18} /></div>
              <div className="stat-body">
                <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{loading ? '…' : kpiEnTest}</div>
                <div className="stat-label">En test</div>
              </div>
            </div>
            {kpiArchived > 0 && (
              <div className="stat-card" style={{ opacity: 0.7, borderLeft: '3px solid var(--text-muted)' }}>
                <div className="stat-icon" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}><Archive size={18} /></div>
                <div className="stat-body">
                  <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{kpiArchived}</div>
                  <div className="stat-label">Archivées</div>
                </div>
              </div>
            )}
          </div>
        </div>

      ) : (

        /* Niveau 1 : vue globale */
        <div className="stats-grid" style={{ marginBottom: 22 }}>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--green-500)' }}>
            <div className="stat-icon green"><Leaf size={18} /></div>
            <div className="stat-body">
              <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{loading ? '…' : species.length}</div>
              <div className="stat-label">Espèces</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--gold)' }}>
            <div className="stat-icon gold"><Sprout size={18} /></div>
            <div className="stat-body">
              <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{loading ? '…' : kpiActive}</div>
              <div className="stat-label">Variétés actives</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--green-500)' }}>
            <div className="stat-icon green"><CheckCircle2 size={18} /></div>
            <div className="stat-body">
              <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{loading ? '…' : kpiDiffusee}</div>
              <div className="stat-label">Diffusées</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--gold)' }}>
            <div className="stat-icon gold"><FlaskConical size={18} /></div>
            <div className="stat-body">
              <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{loading ? '…' : kpiEnTest}</div>
              <div className="stat-label">En test</div>
            </div>
          </div>
          {kpiArchived > 0 && (
            <div className="stat-card" style={{ opacity: 0.7, borderLeft: '3px solid var(--text-muted)' }}>
              <div className="stat-icon" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}><Archive size={18} /></div>
              <div className="stat-body">
                <div className="stat-value" style={{ fontSize: 30, fontWeight: 800 }}>{kpiArchived}</div>
                <div className="stat-label">Archivées</div>
              </div>
            </div>
          )}
        </div>
      )}

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
            {/* Toutes les espèces */}
            <button
              className="species-filter-item"
              data-active={selectedSpeciesId === null}
              onClick={() => { setSelectedSpeciesId(null); setSelectedVarietyId(null); setSearch('') }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 7, background: selectedSpeciesId === null ? '#16a34a' : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedSpeciesId === null ? '#fff' : 'var(--green-600)', flexShrink: 0 }}>
                <Leaf size={14} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Toutes les espèces</div>
              </div>
              <span style={{ fontSize: 11, color: selectedSpeciesId === null ? 'var(--green-700)' : 'var(--text-muted)', background: selectedSpeciesId === null ? 'var(--green-100)' : 'var(--surface-3)', padding: '2px 8px', borderRadius: 99, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {varieties.length}
              </span>
              {selectedSpeciesId === null && <ChevronRight size={12} color="var(--green-600)" />}
            </button>

            {/* Séparateur */}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 10px 4px' }}>
              Espèces
            </div>

            {/* Liste des espèces */}
            {loading
              ? [0, 1, 2, 3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 4 }} />
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
                  const Icon     = ESPECE_ICONS[s.codeEspece] ?? ESPECE_ICONS.default
                  const count    = varietyCountForSpecies(s)
                  const isActive = selectedSpeciesId === s.id
                  const isMySpec = roleKey === 'seed-selector' && userSpecialisation?.toUpperCase() === s.codeEspece?.toUpperCase()
                  return (
                    <button
                      key={s.id}
                      className="species-filter-item"
                      data-active={isActive}
                      onClick={() => { setSelectedSpeciesId(isActive ? null : s.id); setSelectedVarietyId(null) }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                        background: isActive ? '#16a34a' : isMySpec ? '#eff6ff' : 'var(--surface-3)',
                        color:      isActive ? '#fff'    : isMySpec ? '#1d4ed8' : 'var(--green-600)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={14} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: isMySpec ? 700 : 500,
                          color: isMySpec ? '#1e3a8a' : 'var(--text-primary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          {s.nomCommun}
                          {isMySpec && <span style={{ fontSize: 9.5, color: '#3b82f6', fontWeight: 700, background: '#dbeafe', padding: '1px 5px', borderRadius: 4 }}>Votre spéc.</span>}
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
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {selectedSpecies && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--green-50)', border: '1px solid var(--green-200)', borderRadius: 99, padding: '3px 10px 3px 7px', fontSize: 12, color: 'var(--green-700)', flexShrink: 0 }}>
                {React.createElement(ESPECE_ICONS[selectedSpecies.codeEspece] ?? ESPECE_ICONS.default, { size: 11 })}
                <span style={{ fontWeight: 700 }}>{selectedSpecies.codeEspece}</span>
                <span style={{ fontWeight: 400 }}>{selectedSpecies.nomCommun}</span>
                <button onClick={() => { setSelectedSpeciesId(null); setSelectedVarietyId(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginLeft: 2, color: 'var(--green-700)' }}>
                  <X size={12} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, minWidth: 200 }}>
              <Search size={13} color="var(--text-placeholder)" />
              <input
                placeholder={selectedSpecies ? `Rechercher dans ${selectedSpecies.nomCommun}…` : 'Code, nom, espèce…'}
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13, fontFamily: 'Outfit, sans-serif' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Toggle archivées */}
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

          {/* Tableau */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {[
                    { field: 'codeVariete',   label: 'Code',        paddingLeft: 20 as number | undefined },
                    { field: 'nomVariete',    label: 'Nom variété', paddingLeft: undefined },
                    { field: 'espece',        label: 'Espèce',      paddingLeft: undefined },
                    { field: 'cycleMin',      label: 'Cycle',       paddingLeft: undefined },
                    { field: 'rendementMin',  label: 'Rendement',   paddingLeft: undefined },
                    { field: 'statutVariete', label: 'Statut',      paddingLeft: undefined },
                  ].map(col => {
                    const active = sortField === col.field
                    const Icon   = active && sortDir === 'desc' ? ChevronDown : ChevronUp
                    return (
                      <th
                        key={col.field}
                        style={{ paddingLeft: col.paddingLeft, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => toggleSort(col.field)}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {col.label}
                          <Icon size={11} style={{ opacity: active ? 1 : 0.3, flexShrink: 0 }} />
                        </span>
                      </th>
                    )
                  })}
                  {isAdminOrSelector && <th style={{ width: 96, textAlign: 'right', paddingRight: 18 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [0, 1, 2, 3, 4].map(i => (
                      <tr key={i}>
                        <td colSpan={isAdminOrSelector ? 7 : 6}>
                          <div className="skeleton" style={{ height: 14, borderRadius: 4 }} />
                        </td>
                      </tr>
                    ))
                  : sorted.length === 0
                  ? (
                      <tr>
                        <td colSpan={isAdminOrSelector ? 7 : 6}>
                          <div className="empty-state" style={{ padding: '48px 0' }}>
                            <div className="empty-icon"><Sprout size={20} /></div>
                            <div className="empty-title">
                              {search ? 'Aucune variété correspondante'
                                : selectedSpecies ? `Aucune variété pour ${selectedSpecies.nomCommun}`
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
                  : sorted.map(v => {
                      const isArchived = v.statutVariete === 'ARCHIVEE'
                      const st         = STATUT_CONFIG[v.statutVariete] ?? { label: v.statutVariete, cls: 'badge-gray' }
                      const allowed    = canEdit(v.espece?.codeEspece)
                      const dTitle     = `Non autorisé — spécialisation : ${userSpecialisation ?? 'N/A'}`
                      const dStyle     = !allowed ? { opacity: 0.35, cursor: 'not-allowed' as const } : {}
                      const isSelected = selectedVarietyId === v.id
                      return (
                        <tr
                          key={v.id}
                          style={{
                            opacity:    isArchived ? 0.5 : 1,
                            cursor:     'pointer',
                            background: isSelected ? 'var(--green-50)' : undefined,
                            boxShadow:  isSelected ? 'inset 3px 0 0 var(--green-500)' : undefined,
                            transition: 'background 0.15s, box-shadow 0.15s',
                          }}
                          onClick={() => setSelectedVarietyId(isSelected ? null : v.id)}
                          title={isSelected ? 'Désélectionner' : 'Voir les détails'}
                        >
                          {/* Code variété */}
                          <td style={{ paddingLeft: 20 }}>
                            <code style={{
                              background:   isSelected ? 'var(--green-100)' : 'var(--surface-2)',
                              color:        isSelected ? 'var(--green-700)' : 'var(--text-secondary)',
                              border:       '1px solid',
                              borderColor:  isSelected ? 'var(--green-200)' : 'var(--border)',
                              borderRadius: 5, padding: '2px 7px',
                              fontSize: 11.5, fontFamily: 'DM Mono, monospace',
                              fontWeight: 700, letterSpacing: '0.03em',
                              textDecoration: isArchived ? 'line-through' : 'none',
                            }}>
                              {v.codeVariete}
                            </code>
                          </td>

                          {/* Nom variété */}
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13.5 }}>{v.nomVariete}</div>
                            {v.origine && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{v.origine}</div>
                            )}
                            {v.typeGrain && (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', marginTop: 4,
                                fontSize: 10.5, fontWeight: 500,
                                padding: '1px 7px', borderRadius: 4,
                                background: 'var(--surface-2)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                              }}>
                                {v.typeGrain}
                              </div>
                            )}
                            {isArchived && v.commentaireArchivage && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                <MessageSquare size={10} style={{ marginTop: 1, flexShrink: 0 }} />
                                {v.commentaireArchivage}
                              </div>
                            )}
                          </td>

                          {/* Espèce */}
                          <td>
                            {v.espece ? (
                              <button
                                className="species-code"
                                style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                                title={`Filtrer par ${v.espece.nomCommun}`}
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedSpeciesId(v.espece.id); setSelectedVarietyId(null) }}
                              >
                                {React.createElement(ESPECE_ICONS[v.espece.codeEspece] ?? ESPECE_ICONS.default, { size: 10 })}
                                {v.espece.codeEspece}
                              </button>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>

                          {/* Cycle */}
                          <td>
                            {v.cycleMin != null && v.cycleMax != null
                              ? <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                                  {v.cycleMin === v.cycleMax ? `${v.cycleMin} j` : `${v.cycleMin}–${v.cycleMax} j`}
                                </span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>

                          {/* Rendement */}
                          <td>
                            {v.rendementMin != null && v.rendementMax != null
                              ? <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  {v.rendementMin === v.rendementMax
                                    ? `${v.rendementMin} t/ha`
                                    : `${v.rendementMin}–${v.rendementMax} t/ha`}
                                </span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>

                          {/* Statut */}
                          <td><span className={`badge ${st.cls}`}>{st.label}</span></td>

                          {/* Actions */}
                          {isAdminOrSelector && (
                            <td onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ paddingRight: 12 }}>
                              <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                {!isArchived && (
                                  <>
                                    <button
                                      className="btn btn-ghost"
                                      style={{ width: 30, height: 30, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', ...dStyle }}
                                      onClick={() => { if (allowed) openEdit(v) }}
                                      title={allowed ? 'Modifier' : dTitle}
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      className="btn btn-ghost"
                                      style={{ width: 30, height: 30, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: allowed ? 'var(--primary)' : undefined, ...dStyle }}
                                      onClick={() => { if (allowed) openZones(v) }}
                                      title={allowed ? 'Zones agro-écologiques' : dTitle}
                                    >
                                      <MapPin size={13} />
                                    </button>
                                    <button
                                      className="btn btn-ghost"
                                      style={{ width: 30, height: 30, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: allowed ? 'var(--gold-dark)' : undefined, ...dStyle }}
                                      onClick={() => { if (allowed) { setArchiveTarget(v); setArchiveComment('') } }}
                                      title={allowed ? 'Archiver' : dTitle}
                                    >
                                      <Archive size={13} />
                                    </button>
                                  </>
                                )}
                                {isArchived && allowed && (
                                  <>
                                    <button
                                      className="btn btn-ghost"
                                      style={{ width: 30, height: 30, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green-700)' }}
                                      onClick={() => setDesarchiveTarget(v)}
                                      title="Désarchiver"
                                    >
                                      <RotateCcw size={13} />
                                    </button>
                                    <button
                                      className="btn btn-ghost"
                                      style={{ width: 30, height: 30, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-600)' }}
                                      onClick={() => { setDeleteTarget(v); setDeleteComment('') }}
                                      title="Supprimer définitivement"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
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

          {/* Pied de tableau */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {filtered.length} variété{filtered.length > 1 ? 's' : ''}
                {search && ` · "${search}"`}
                {selectedSpecies && ` · ${selectedSpecies.nomCommun}`}
              </span>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
                {filtered.filter(v => v.statutVariete === 'DIFFUSEE').length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green-700)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green-500)' }} />
                    {filtered.filter(v => v.statutVariete === 'DIFFUSEE').length} diffusée{filtered.filter(v => v.statutVariete === 'DIFFUSEE').length > 1 ? 's' : ''}
                  </span>
                )}
                {filtered.filter(v => v.statutVariete === 'EN_TEST').length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gold-dark)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />
                    {filtered.filter(v => v.statutVariete === 'EN_TEST').length} en test
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals — inchangées ── */}

      {showEspeceForm && (
        <Modal title="Nouvelle Espèce" subtitle="Ajouter une nouvelle espèce au catalogue semencier" onClose={() => setShowEspeceForm(false)} size="sm">
          <form onSubmit={submitEspece}>
            <Field label="Code espèce" required hint="3 lettres majuscules — ex : MIL, RIZ, ARA">
              <FormInput value={especeForm.codeEspece} onChange={e => setEspeceForm(f => ({ ...f, codeEspece: e.target.value.toUpperCase() }))} placeholder="MIL" maxLength={10} required />
            </Field>
            <Field label="Nom commun" required>
              <FormInput value={especeForm.nomCommun} onChange={e => setEspeceForm(f => ({ ...f, nomCommun: e.target.value }))} placeholder="Mil" required />
            </Field>
            <Field label="Nom scientifique">
              <FormInput value={especeForm.nomScientifique} onChange={e => setEspeceForm(f => ({ ...f, nomScientifique: e.target.value }))} placeholder="Pennisetum glaucum" />
            </Field>
            <FormActions onCancel={() => setShowEspeceForm(false)} loading={saving} submitLabel="Créer l'espèce" />
          </form>
        </Modal>
      )}

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
                    <FormInput value={varieteForm.codeVariete} onChange={e => setVarieteForm(f => ({ ...f, codeVariete: e.target.value.toUpperCase() }))} placeholder="MIL-SOUNA3" required />
                  </Field>
                  <Field label="Nom variété" required>
                    <FormInput value={varieteForm.nomVariete} onChange={e => setVarieteForm(f => ({ ...f, nomVariete: e.target.value }))} placeholder="Souna III" required />
                  </Field>
                </FormRow>
                <Field label="Espèce" required>
                  <FormSelect value={varieteForm.idEspece} onChange={e => setVarieteForm(f => ({ ...f, idEspece: e.target.value }))} required>
                    <option value="">— Sélectionner une espèce —</option>
                    {species.map(s => <option key={s.id} value={s.id}>{s.codeEspece} — {s.nomCommun}</option>)}
                  </FormSelect>
                </Field>
                <FormRow>
                  <Field label="Origine">
                    <FormInput value={varieteForm.origine} onChange={e => setVarieteForm(f => ({ ...f, origine: e.target.value }))} placeholder="ISRA-CNRA Bambey" />
                  </Field>
                  <Field label="Sélectionneur principal">
                    <FormInput value={varieteForm.selectionneurPrincipal} onChange={e => setVarieteForm(f => ({ ...f, selectionneurPrincipal: e.target.value }))} placeholder="Équipe sélection ISRA" />
                  </Field>
                </FormRow>
                <FormRow>
                  <Field label="Année d'obtention">
                    <FormInput type="number" value={varieteForm.anneeCreation} onChange={e => setVarieteForm(f => ({ ...f, anneeCreation: e.target.value }))} placeholder="1985" min="1900" max="2030" />
                  </Field>
                  <Field label="Cycle min (j)">
                    <FormInput type="number" value={varieteForm.cycleMin} onChange={e => setVarieteForm(f => ({ ...f, cycleMin: e.target.value }))} placeholder="85" min="1" max="365" />
                  </Field>
                  <Field label="Cycle max (j)">
                    <FormInput type="number" value={varieteForm.cycleMax} onChange={e => setVarieteForm(f => ({ ...f, cycleMax: e.target.value }))} placeholder="95" min="1" max="365" />
                  </Field>
                </FormRow>
                <Field label="Pedigree" hint="Généalogie génétique — ex : 55-437 × CE 181-22">
                  <FormInput value={varieteForm.pedigree} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVarieteForm(f => ({ ...f, pedigree: e.target.value }))} placeholder="Sélection ISRA-CNRA Bambey" />
                </Field>
                <FormRow>
                  <Field label="Type de grain" hint="ex : Virginia (Bold), Grain perlé (Blanc)">
                    <FormInput value={varieteForm.typeGrain} onChange={e => setVarieteForm(f => ({ ...f, typeGrain: e.target.value }))} placeholder="Virginia (Bold)" />
                  </Field>
                  <Field label="Rendement min (t/ha)">
                    <FormInput type="number" value={varieteForm.rendementMin} onChange={e => setVarieteForm(f => ({ ...f, rendementMin: e.target.value }))} placeholder="2.5" min="0" step="0.1" />
                  </Field>
                  <Field label="Rendement max (t/ha)">
                    <FormInput type="number" value={varieteForm.rendementMax} onChange={e => setVarieteForm(f => ({ ...f, rendementMax: e.target.value }))} placeholder="3.5" min="0" step="0.1" />
                  </Field>
                </FormRow>
              </>
            )}
            <Field label="Statut" required>
              <FormSelect value={varieteForm.statutVariete} onChange={e => setVarieteForm(f => ({ ...f, statutVariete: e.target.value }))}>
                <option value="DIFFUSEE">Diffusée</option>
                <option value="EN_TEST">En test</option>
                <option value="RETIREE">Retirée</option>
              </FormSelect>
            </Field>
            <FormActions onCancel={() => { setShowVarieteForm(false); setEditVariete(null) }} loading={saving} submitLabel={editVariete ? 'Mettre à jour' : 'Créer la variété'} />
          </form>
        </Modal>
      )}

      {archiveTarget && (
        <Modal title="Archiver la variété" subtitle={`${archiveTarget.codeVariete} — ${archiveTarget.nomVariete}`} onClose={() => { setArchiveTarget(null); setArchiveComment('') }} size="sm">
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--gold-light)', border: '1px solid #fde68a', marginBottom: 20 }}>
            <AlertTriangle size={16} color="var(--gold-dark)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--gold-dark)', lineHeight: 1.5 }}>
              <strong>Archivage = suppression traçable.</strong> La variété ne sera plus visible dans le catalogue actif, mais son historique est conservé.
            </div>
          </div>
          <form onSubmit={submitArchive}>
            <Field label="Motif d'archivage" required hint="Obligatoire — ex : variété obsolète, remplacée par une nouvelle sélection">
              <textarea value={archiveComment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setArchiveComment(e.target.value)} placeholder="Expliquez pourquoi cette variété est archivée…" required
                style={{ width: '100%', minHeight: 90, padding: '9px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-focus)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
              />
            </Field>
            <FormActions onCancel={() => { setArchiveTarget(null); setArchiveComment('') }} loading={archiving} submitLabel="Confirmer l'archivage" submitClassName="btn-warning" />
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Suppression définitive" subtitle={`${deleteTarget.codeVariete} — ${deleteTarget.nomVariete}`} onClose={() => { setDeleteTarget(null); setDeleteComment('') }} size="sm">
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--red-50)', border: '1px solid #fecaca', marginBottom: 20 }}>
            <AlertTriangle size={16} color="var(--red-600)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--red-600)', lineHeight: 1.5 }}>
              <strong>Action irréversible.</strong> Cette variété archivée sera supprimée définitivement de la base de données.
            </div>
          </div>
          {deleteTarget.commentaireArchivage && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Motif d'archivage</div>
              <div style={{ fontStyle: 'italic' }}>{deleteTarget.commentaireArchivage}</div>
              {deleteTarget.archivePar && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>Archivé par <strong>{deleteTarget.archivePar}</strong></div>}
            </div>
          )}
          <form onSubmit={submitDelete}>
            <Field label="Confirmez en tapant la raison de suppression" required hint="Ce commentaire sera enregistré dans le journal d'audit avant suppression">
              <textarea value={deleteComment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeleteComment(e.target.value)} placeholder="Raison de la suppression définitive…" required
                style={{ width: '100%', minHeight: 80, padding: '9px 12px', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--red-500)' }}
                onBlur={e =>  { e.currentTarget.style.borderColor = '#fecaca' }}
              />
            </Field>
            <FormActions onCancel={() => { setDeleteTarget(null); setDeleteComment('') }} loading={deleting} submitLabel="Supprimer définitivement" submitClassName="btn-danger" />
          </form>
        </Modal>
      )}

      {desarchiveTarget && (
        <Modal title="Désarchiver la variété" subtitle={`${desarchiveTarget.codeVariete} — ${desarchiveTarget.nomVariete}`} onClose={() => setDesarchiveTarget(null)} size="sm">
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--green-50)', border: '1px solid var(--green-200)', marginBottom: 20 }}>
            <RotateCcw size={16} color="var(--green-700)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--green-700)', lineHeight: 1.5 }}>
              La variété sera remise au statut <strong>Diffusée</strong> et redeviendra visible dans le catalogue actif.
            </div>
          </div>
          {desarchiveTarget.commentaireArchivage && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>Motif d'archivage</div>
              <div style={{ fontStyle: 'italic' }}>{desarchiveTarget.commentaireArchivage}</div>
            </div>
          )}
          <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); submitDesarchive() }}>
            <FormActions onCancel={() => setDesarchiveTarget(null)} loading={desarchiving} submitLabel="Confirmer le désarchivage" />
          </form>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {zonesTarget && (
        <Modal title="Zones recommandées" subtitle={`${zonesTarget.codeVariete} — ${zonesTarget.nomVariete}`} onClose={() => setZonesTarget(null)}>
          <form onSubmit={saveZones}>
            <div className="zone-section">
              <div className="zone-section-title">
                <MapPin size={14} /> Zones agro-écologiques du Sénégal
              </div>
              <div className="zone-assignment-list">
                {zonesRows.map((row, i) => (
                  <div key={i} className="zone-assignment-row">
                    <select value={row.idZone} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setZonesRows(rows => rows.map((r, j) => j === i ? { ...r, idZone: e.target.value } : r))} style={{ flex: 2 }}>
                      <option value="">— Zone —</option>
                      {allZones.map(z => <option key={z.id} value={z.id}>{z.code} — {z.nom}</option>)}
                    </select>
                    <select value={row.niveauAdaptation} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setZonesRows(rows => rows.map((r, j) => j === i ? { ...r, niveauAdaptation: e.target.value } : r))} style={{ flex: 1 }}>
                      <option value="OPTIMAL">Optimal</option>
                      <option value="ACCEPTABLE">Acceptable</option>
                      <option value="MARGINALE">Marginale</option>
                    </select>
                    <button type="button" className="zone-remove-btn" onClick={() => setZonesRows(rows => rows.filter((_, j) => j !== i))} title="Retirer cette zone">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="zone-add-btn" style={{ marginTop: 10 }} onClick={() => setZonesRows(rows => [...rows, { idZone: '', niveauAdaptation: 'OPTIMAL' }])}>+ Ajouter une zone</button>
            </div>
            <FormActions onCancel={() => setZonesTarget(null)} loading={savingZones} submitLabel="Enregistrer les zones" />
          </form>
        </Modal>
      )}
    </div>
  )
}
