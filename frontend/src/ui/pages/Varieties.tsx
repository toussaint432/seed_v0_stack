import React, { useEffect, useRef, useState } from 'react'
import {
  Leaf, Sprout, CheckCircle2, Plus, Search, X,
  RefreshCw, Edit2, FlaskConical, ChevronRight,
  Archive, Trash2, AlertTriangle, Eye, EyeOff, MessageSquare, MapPin,
  RotateCcw, Clock, User, TrendingUp, Wheat, LucideIcon,
  ChevronUp, ChevronDown, FileText, Upload, Download, History,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeVariete, extractList } from '../../lib/normalizers'
import { downloadXlsx } from '../../lib/exportUtils'
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

const ESPECE_COLORS: Record<string, string> = {
  ARACHIDE: '#b45309', ARA: '#b45309',   // ambre    — couleur naturelle arachide
  BLE: '#0891b2',      BLED: '#0891b2',  // cyan     — grain pâle, ciel ouvert
  FONIO: '#65a30d',    FON: '#65a30d',   // lime     — végétal, culture locale
  MAIS: '#eab308',     MAI: '#eab308',   // jaune    — couleur du maïs
  MIL: '#dc2626',                        // rouge    — signal fort, distinctif
  NIEBE: '#1d4ed8',    NIE: '#1d4ed8',   // bleu     — légumineuse
  RIZ: '#0f766e',                        // teal     — aquatique
  SESAME: '#9333ea',   SES: '#9333ea',   // violet   — distinctif
  SORGHO: '#be185d',   SOR: '#be185d',   // rose     — très distinct de tout
}
function especeColor(code?: string): string {
  if (!code) return 'var(--green-600)'
  return ESPECE_COLORS[code.toUpperCase()] ?? 'var(--green-600)'
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
  const [codeAutoFilled,  setCodeAutoFilled]  = useState(true)
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

  const [filterStatut,   setFilterStatut]   = useState<string>('')
  const [moreMenuId,     setMoreMenuId]     = useState<number | null>(null)
  const [hoverEspeceId,  setHoverEspeceId]  = useState<number | null>(null)
  const [hoveredRowId,   setHoveredRowId]   = useState<number | null>(null)

  const [allZones,      setAllZones]      = useState<any[]>([])
  const [zonesTarget,   setZonesTarget]   = useState<any>(null)
  const [zonesRows,     setZonesRows]     = useState<{ idZone: string; niveauAdaptation: string }[]>([])
  const [savingZones,   setSavingZones]   = useState(false)
  const [zonesReadOnly, setZonesReadOnly] = useState(false)

  type PdfUploadCtx  = { type: 'fiche' | 'itineraire'; id: number; name: string; codeEspece?: string }
  type PdfViewerState = { url: string; title: string; downloadName: string; ctx?: PdfUploadCtx }

  const [pdfViewerModal, setPdfViewerModal] = useState<PdfViewerState | null>(null)
  const [pdfUploadModal, setPdfUploadModal] = useState<PdfUploadCtx | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [dragOver,       setDragOver]       = useState(false)
  const [pdfBlobMeta,    setPdfBlobMeta]    = useState<{ url: string; isImage: boolean } | null>(null)
  const [pdfBlobLoading, setPdfBlobLoading] = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deletingDoc,    setDeletingDoc]    = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [historiqueTarget,  setHistoriqueTarget]  = useState<any>(null)
  const [historiqueData,    setHistoriqueData]    = useState<any[]>([])
  const [loadingHistorique, setLoadingHistorique] = useState(false)

  async function openHistorique(v: any) {
    setHistoriqueTarget(v)
    setHistoriqueData([])
    setLoadingHistorique(true)
    try {
      const res = await api.get(endpoints.varietyHistorique(v.id))
      setHistoriqueData(res.data)
    } catch { setHistoriqueData([]) }
    finally { setLoadingHistorique(false) }
  }

  const [especeHistoriqueTarget,  setEspeceHistoriqueTarget]  = useState<any>(null)
  const [especeHistoriqueData,    setEspeceHistoriqueData]    = useState<any[]>([])
  const [loadingEspeceHistorique, setLoadingEspeceHistorique] = useState(false)

  async function openEspeceHistorique(s: any) {
    setEspeceHistoriqueTarget(s)
    setEspeceHistoriqueData([])
    setLoadingEspeceHistorique(true)
    try {
      const res = await api.get(endpoints.especeHistorique(s.id))
      setEspeceHistoriqueData(res.data)
    } catch { setEspeceHistoriqueData([]) }
    finally { setLoadingEspeceHistorique(false) }
  }

  useEffect(() => {
    if (!pdfViewerModal) {
      if (pdfBlobMeta) { URL.revokeObjectURL(pdfBlobMeta.url); setPdfBlobMeta(null) }
      return
    }
    setConfirmDelete(false)
    setPdfBlobLoading(true)
    setPdfBlobMeta(null)
    api.get(pdfViewerModal.url, { responseType: 'blob' })
      .then(res => {
        const blob    = new Blob([res.data], { type: res.data.type || 'application/octet-stream' })
        const isImage = (res.data.type as string)?.startsWith('image/') ?? false
        setPdfBlobMeta({ url: URL.createObjectURL(blob), isImage })
      })
      .catch(() => setToast({ msg: 'Impossible de charger le document', type: 'error' }))
      .finally(() => setPdfBlobLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfViewerModal?.url])

  useEffect(() => {
    if (moreMenuId === null) return
    const close = () => setMoreMenuId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [moreMenuId])

  const [especeForm, setEspeceForm] = useState({
    codeEspece: '', nomCommun: '', nomScientifique: '',
  })
  const [varieteForm, setVarieteForm] = useState({
    codeVariete: '', nomVariete: '', idEspece: '', origine: '',
    selectionneurPrincipal: '', anneeCreation: '', cycleMin: '', cycleMax: '',
    statutVariete: 'DIFFUSEE',
    pedigree: '', typeGrain: '', rendementMin: '', rendementMax: '',
    anneeHomologation: '', natureGenetique: '', numeroSelection: '',
    vocationCulturale: '', photosensibilite: '', synonyme: '',
  })

  const isAdmin           = roleKey === 'seed-admin'
  const isSelector        = roleKey === 'seed-selector'
  const isAdminOrSelector = isAdmin || isSelector

  function generateVarieteCode(idEspece: string, nomVariete: string): string {
    if (!idEspece || !nomVariete.trim()) return ''
    const esp = species.find(s => String(s.id) === idEspece)
    if (!esp) return ''
    const prefix = (esp.codeEspece ?? '').substring(0, 3).toUpperCase()
    let s = nomVariete.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    s = s.replace(/\bVIII\b/gi, '8').replace(/\bVII\b/gi, '7').replace(/\bVI\b/gi, '6')
         .replace(/\bIX\b/gi, '9').replace(/\bIV\b/gi, '4')
         .replace(/\bIII\b/gi, '3').replace(/\bII\b/gi, '2')
    return `${prefix}-${s.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
  }

  function canEdit(codeEspece?: string): boolean {
    if (isAdmin) return true
    if (isSelector) {
      if (!userSpecialisation || !codeEspece) return false
      return codeEspece.toUpperCase() === userSpecialisation.toUpperCase()
    }
    return false
  }

  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    Promise.allSettled([
      api.get(endpoints.species),
      api.get(endpoints.varieties),
    ]).then(([s, v]) => {
      const rawSpecies: any[] = s.status === 'fulfilled' ? s.value.data : []
      setSpecies([...rawSpecies].sort((a, b) =>
        (a.nomCommun ?? '').localeCompare(b.nomCommun ?? '', 'fr', { sensitivity: 'base' })
      ))
      setVarieties(extractList(v.status === 'fulfilled' ? v.value.data : null).map(normalizeVariete))
    }).finally(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => { fetchData() }, [])

  // Auto-sélectionner l'espèce de spécialisation dès que les espèces sont chargées
  useEffect(() => {
    if (!isSelector || !userSpecialisation || !species.length || selectedSpeciesId !== null) return
    const match = species.find(s => s.codeEspece?.toUpperCase() === userSpecialisation.toUpperCase())
    if (match) setSelectedSpeciesId(match.id)
  }, [species, isSelector, userSpecialisation])

  const selectedSpecies  = species.find(s => s.id === selectedSpeciesId) ?? null
  const selectedVariety  = varieties.find(v => v.id === selectedVarietyId) ?? null

  const canCreateEspece  = isAdmin
  const canCreateVariete = isAdmin || canEdit(selectedSpecies?.codeEspece)
  const canArchive       = isAdminOrSelector

  const kpiBase = selectedSpecies
    ? varieties.filter(v => v.espece?.id === selectedSpecies.id)
    : varieties
  const kpiActive   = kpiBase.filter(v => v.statutVariete !== 'ARCHIVEE').length
  const kpiDiffusee = kpiBase.filter(v => v.statutVariete === 'DIFFUSEE').length
  const kpiEnTest   = kpiBase.filter(v => v.statutVariete === 'EN_TEST').length
  const kpiRetiree  = kpiBase.filter(v => v.statutVariete === 'RETIREE').length
  const kpiArchived = kpiBase.filter(v => v.statutVariete === 'ARCHIVEE').length

  const filtered = varieties.filter(v => {
    const isArchived   = v.statutVariete === 'ARCHIVEE'
    if (isArchived && !showArchived) return false
    if (filterStatut && v.statutVariete !== filterStatut) return false
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

  function speciesStats(s: any) {
    const all    = varieties.filter(v => v.espece?.id === s.id && v.statutVariete !== 'ARCHIVEE')
    const diff   = all.filter(v => v.statutVariete === 'DIFFUSEE').length
    const enTest = all.filter(v => v.statutVariete === 'EN_TEST').length
    return { total: all.length, diff, enTest }
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
          codeVariete:            editVariete.codeVariete,          // immuable, requis par @Valid
          nomVariete:             varieteForm.nomVariete,
          espece:                 { id: Number(editVariete.espece?.id) }, // immuable
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
          anneeHomologation:      varieteForm.anneeHomologation ? Number(varieteForm.anneeHomologation) : null,
          natureGenetique:        varieteForm.natureGenetique   || null,
          numeroSelection:        varieteForm.numeroSelection   || null,
          vocationCulturale:      varieteForm.vocationCulturale || null,
          photosensibilite:       varieteForm.photosensibilite  || null,
          synonyme:               varieteForm.synonyme          || null,
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
          anneeHomologation:      varieteForm.anneeHomologation ? Number(varieteForm.anneeHomologation) : undefined,
          natureGenetique:        varieteForm.natureGenetique   || undefined,
          numeroSelection:        varieteForm.numeroSelection   || undefined,
          vocationCulturale:      varieteForm.vocationCulturale || undefined,
          photosensibilite:       varieteForm.photosensibilite  || undefined,
          synonyme:               varieteForm.synonyme          || undefined,
        })
        setToast({ msg: `Variété "${varieteForm.nomVariete}" créée`, type: 'success' })
      }
      setShowVarieteForm(false)
      setEditVariete(null)
      setVarieteForm({ codeVariete: '', nomVariete: '', idEspece: '', origine: '', selectionneurPrincipal: '', anneeCreation: '', cycleMin: '', cycleMax: '', statutVariete: 'DIFFUSEE', pedigree: '', typeGrain: '', rendementMin: '', rendementMax: '', anneeHomologation: '', natureGenetique: '', numeroSelection: '', vocationCulturale: '', photosensibilite: '', synonyme: '' })
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
      anneeHomologation: v.anneeHomologation?.toString() || '',
      natureGenetique: v.natureGenetique || '',
      numeroSelection: v.numeroSelection || '',
      vocationCulturale: v.vocationCulturale || '',
      photosensibilite: v.photosensibilite || '',
      synonyme: v.synonyme || '',
    })
    setShowVarieteForm(true)
  }

  function openNewVariete() {
    setEditVariete(null)
    setCodeAutoFilled(true)
    setVarieteForm({
      codeVariete: '', nomVariete: '',
      idEspece: selectedSpeciesId?.toString() || '',
      origine: '', selectionneurPrincipal: '', anneeCreation: '', cycleMin: '', cycleMax: '',
      statutVariete: 'DIFFUSEE',
      pedigree: '', typeGrain: '', rendementMin: '', rendementMax: '',
      anneeHomologation: '', natureGenetique: '', numeroSelection: '',
      vocationCulturale: '', photosensibilite: '', synonyme: '',
    })
    setShowVarieteForm(true)
  }

  async function openZones(v: any, readOnly = false) {
    setZonesTarget(v)
    setZonesReadOnly(readOnly)
    setZonesRows([])
    const [zonesRes, assignedRes] = await Promise.allSettled([
      api.get(endpoints.zones),
      api.get(endpoints.varietyZones(v.id)),
    ])
    if (zonesRes.status === 'fulfilled')   setAllZones(zonesRes.value.data)
    if (assignedRes.status === 'fulfilled') {
      const assigned: any[] = assignedRes.value.data
      setZonesRows(assigned.map((z: any) => ({
        idZone: String(z.zone?.id ?? z.id?.idZone ?? ''),
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

  async function deleteDocument() {
    if (!pdfViewerModal?.ctx) return
    const { type, id } = pdfViewerModal.ctx
    setDeletingDoc(true)
    try {
      const url = type === 'fiche' ? endpoints.varietyFicheUrl(id) : endpoints.especeItineraireUrl(id)
      await api.delete(url)
      setToast({ msg: 'Document supprimé avec succès', type: 'success' })
      setPdfViewerModal(null)
      setConfirmDelete(false)
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la suppression', type: 'error' })
    } finally { setDeletingDoc(false) }
  }

  async function uploadPdf(file: File) {
    if (!pdfUploadModal) return
    const validExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif']
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    const nameLC = file.name.toLowerCase()
    if (!validTypes.includes(file.type) && !validExts.some(e => nameLC.endsWith(e))) {
      setToast({ msg: 'Formats acceptés : PDF, JPG, PNG, WEBP, GIF', type: 'error' }); return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const url = pdfUploadModal.type === 'fiche'
        ? endpoints.varietyFicheUpload(pdfUploadModal.id)
        : endpoints.especeItineraireUpload(pdfUploadModal.id)
      await api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setToast({ msg: `PDF "${file.name}" uploadé avec succès`, type: 'success' })
      setPdfUploadModal(null)
      fetchData(true)
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de l\'upload PDF', type: 'error' })
    } finally { setUploading(false) }
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
      {selectedSpecies ? (

        /* Niveau 2 : espèce sélectionnée */
        <div style={{ marginBottom: 20 }}>
          {/* Breadcrumb neutre */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 14px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              {React.createElement(ESPECE_ICONS[selectedSpecies.codeEspece] ?? ESPECE_ICONS.default, { size: 14, color: especeColor(selectedSpecies.codeEspece) })}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 4 }}>{selectedSpecies.codeEspece}</code>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSpecies.nomCommun}</span>
              {selectedSpecies.nomScientifique && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
                  {selectedSpecies.nomScientifique}
                </span>
              )}
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--text-muted)', gap: 5, height: 28 }}
              onClick={() => setSelectedSpeciesId(null)}>
              <X size={12} /> Vue globale
            </button>
          </div>

          {/* KPI cards neutres — même design que niveau 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiArchived > 0 ? 4 : 3}, 1fr)`, gap: 12, marginBottom: 12 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                <Sprout size={18} />
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{loading ? '…' : kpiActive}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>variétés actives</div>
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                <CheckCircle2 size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{loading ? '…' : kpiDiffusee}</div>
                  {!loading && kpiActive > 0 && (
                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '1px 6px', borderRadius: 5 }}>{Math.round((kpiDiffusee / kpiActive) * 100)}%</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>diffusées</div>
              </div>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                <FlaskConical size={18} />
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{loading ? '…' : kpiEnTest}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>en évaluation</div>
              </div>
            </div>

            {kpiArchived > 0 && (
              <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.7 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <Archive size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em', color: 'var(--text-muted)', lineHeight: 1.1 }}>{kpiArchived}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>archivées</div>
                </div>
              </div>
            )}
          </div>

          {/* Jauge circulaire — taux de diffusion */}
          {kpiActive > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 16px', boxShadow: 'var(--shadow-xs)', display: 'flex', alignItems: 'center', gap: 16 }}>
              {(() => {
                const gaugePct = kpiDiffusee / kpiActive
                const gaugeColor = gaugePct >= 0.8 ? '#16a34a' : gaugePct >= 0.6 ? '#d97706' : '#dc2626'
                const arcLen = 150.8
                const offset = arcLen * (1 - gaugePct)
                return (
                  <svg width="72" height="72" viewBox="0 0 80 80" style={{ display: 'block', flexShrink: 0 }}>
                    <path d="M 17.4 62.6 A 32 32 0 1 1 62.6 62.6"
                      fill="none" stroke="var(--surface-3)" strokeWidth="7" strokeLinecap="round" />
                    <path d="M 17.4 62.6 A 32 32 0 1 1 62.6 62.6"
                      fill="none" stroke={gaugeColor} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={arcLen} strokeDashoffset={offset}
                      style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s' }}
                    />
                    <text x="40" y="35" textAnchor="middle" dominantBaseline="central"
                      fontSize="15" fontWeight="800" fill="var(--text-primary)"
                      style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.5px' }}>
                      {`${Math.round(gaugePct * 100)}%`}
                    </text>
                    <text x="40" y="50" textAnchor="middle" dominantBaseline="central"
                      fontSize="8" fill="var(--text-muted)"
                      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.07em' }}>
                      DIFFUSION
                    </text>
                  </svg>
                )
              })()}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Taux de diffusion</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {kpiDiffusee > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a', display: 'inline-block', flexShrink: 0 }} />
                      {kpiDiffusee} diffusée{kpiDiffusee > 1 ? 's' : ''} / {kpiActive} actives
                    </span>
                  )}
                  {kpiEnTest > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#7c3aed', display: 'inline-block', flexShrink: 0 }} />
                      {kpiEnTest} en évaluation
                    </span>
                  )}
                  {kpiRetiree > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#dc2626', display: 'inline-block', flexShrink: 0 }} />
                      {kpiRetiree} retirée{kpiRetiree > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      ) : (

        /* Niveau 1 : vue globale */
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

            {/* Espèces cultivées */}
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: '18px 20px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 10 }}>Espèces cultivées</div>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 8 }}>{loading ? '…' : species.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>espèces enregistrées au catalogue</div>
            </div>

            {/* Variétés actives */}
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: '18px 20px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 10 }}>Variétés actives</div>
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1, marginBottom: 8 }}>{loading ? '…' : kpiActive}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>toutes espèces confondues</div>
            </div>

            {/* Taux de diffusion — jauge circulaire */}
            <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: '18px 20px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              {(() => {
                const gaugePct = kpiActive > 0 ? kpiDiffusee / kpiActive : 0
                const gaugeColor = gaugePct >= 0.8 ? '#16a34a' : gaugePct >= 0.6 ? '#d97706' : '#dc2626'
                const arcLen = 150.8
                const offset = arcLen * (1 - gaugePct)
                return (
                  <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: 'block', flexShrink: 0 }}>
                    <path d="M 17.4 62.6 A 32 32 0 1 1 62.6 62.6"
                      fill="none" stroke="var(--surface-3)" strokeWidth="7" strokeLinecap="round" />
                    <path d="M 17.4 62.6 A 32 32 0 1 1 62.6 62.6"
                      fill="none" stroke={gaugeColor} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={arcLen} strokeDashoffset={offset}
                      style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s' }}
                    />
                    <text x="40" y="35" textAnchor="middle" dominantBaseline="central"
                      fontSize="15" fontWeight="800" fill="var(--text-primary)"
                      style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.5px' }}>
                      {loading ? '…' : `${Math.round(gaugePct * 100)}%`}
                    </text>
                    <text x="40" y="50" textAnchor="middle" dominantBaseline="central"
                      fontSize="8" fill="var(--text-muted)"
                      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.07em' }}>
                      DIFFUSION
                    </text>
                  </svg>
                )
              })()}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 8 }}>Taux de diffusion</div>
                {!loading && kpiActive > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a', display: 'inline-block', flexShrink: 0 }} />
                      {kpiDiffusee} diffusée{kpiDiffusee > 1 ? 's' : ''}
                    </span>
                    {kpiEnTest > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#7c3aed', display: 'inline-block', flexShrink: 0 }} />
                        {kpiEnTest} en évaluation
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
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
              {canCreateEspece && (
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
                    {canCreateEspece && (
                      <button className="btn btn-primary" style={{ marginTop: 10, fontSize: 11 }} onClick={() => setShowEspeceForm(true)}>
                        + Créer
                      </button>
                    )}
                  </div>
                )
              : species.map(s => {
                  const Icon     = ESPECE_ICONS[s.codeEspece] ?? ESPECE_ICONS.default
                  const st       = speciesStats(s)
                  const isActive = selectedSpeciesId === s.id
                  const isMySpec = roleKey === 'seed-selector' && userSpecialisation?.toUpperCase() === s.codeEspece?.toUpperCase()
                  const hasItineraire = !!s.itineraireTechPath
                  return (
                    <div
                      key={s.id}
                      className="species-filter-item"
                      data-active={isActive}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedSpeciesId(isActive ? null : s.id); setSelectedVarietyId(null) }}
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedSpeciesId(isActive ? null : s.id); setSelectedVarietyId(null) } }}
                      onMouseEnter={() => setHoverEspeceId(s.id)}
                      onMouseLeave={() => setHoverEspeceId(null)}
                      style={{ cursor: 'pointer', '--espece-color': especeColor(s.codeEspece), '--espece-active-bg': `${especeColor(s.codeEspece)}1a` } as any}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                        background: isActive
                          ? especeColor(s.codeEspece)
                          : isMySpec ? '#eff6ff' : 'var(--surface-3)',
                        color: isActive ? '#fff' : isMySpec ? '#1d4ed8' : especeColor(s.codeEspece),
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
                        {st.total > 0 && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, display: 'flex', gap: 5 }}>
                            {st.diff > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>{st.diff} diff.</span>}
                            {st.enTest > 0 && <span style={{ color: '#7c3aed', fontWeight: 600 }}>{st.enTest} test</span>}
                          </div>
                        )}
                      </div>
                      {/* Bouton historique admin — traçabilité espèce */}
                      {isAdmin && (
                        <button
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEspeceHistorique(s) }}
                          title="Historique des actions admin sur cette espèce"
                          style={{
                            width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                            background: 'transparent', border: '1px solid transparent',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-muted)', transition: 'opacity 0.15s',
                            opacity: hoverEspeceId === s.id ? 1 : 0,
                            pointerEvents: hoverEspeceId === s.id ? 'auto' : 'none',
                          }}
                        >
                          <History size={11} />
                        </button>
                      )}
                      {/* Bouton itinéraire technique */}
                      <button
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          if (hasItineraire) {
                            setPdfViewerModal({ url: endpoints.especeItineraireUrl(s.id), title: `Itinéraire technique — ${s.nomCommun}`, downloadName: `itineraire-${s.codeEspece}.pdf`, ctx: { type: 'itineraire', id: s.id, name: s.nomCommun, codeEspece: s.codeEspece } })
                          } else if (isAdmin || (isSelector && isMySpec)) {
                            setPdfUploadModal({ type: 'itineraire', id: s.id, name: s.nomCommun })
                          }
                        }}
                        title={hasItineraire ? `Voir l'itinéraire technique de ${s.nomCommun}` : isAdmin ? `Uploader l'itinéraire technique` : isSelector && isMySpec ? `Uploader l'itinéraire de votre spécialisation` : 'Aucun itinéraire technique disponible'}
                        style={{
                          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                          background: hasItineraire ? '#eff6ff' : 'transparent',
                          border: hasItineraire ? '1px solid #bfdbfe' : '1px solid transparent',
                          cursor: hasItineraire || isAdmin || (isSelector && isMySpec) ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: hasItineraire ? '#2563eb' : 'var(--text-muted)',
                          transition: 'opacity 0.15s',
                          opacity: hoverEspeceId === s.id ? 1 : hasItineraire ? 0.6 : 0,
                          pointerEvents: hoverEspeceId === s.id || hasItineraire ? 'auto' : 'none',
                        }}
                      >
                        {hasItineraire ? <FileText size={11} /> : isAdmin || (isSelector && isMySpec) ? <Upload size={11} /> : <FileText size={11} style={{ opacity: 0.25 }} />}
                      </button>
                      <span style={{
                        fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                        color: isActive ? especeColor(s.codeEspece) : 'var(--text-muted)',
                        background: isActive ? `${especeColor(s.codeEspece)}18` : 'var(--surface-3)',
                        padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                      }}>
                        {st.total}
                      </span>
                      {isActive && <ChevronRight size={12} color={especeColor(s.codeEspece)} style={{ flexShrink: 0 }} />}
                    </div>
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {filtered.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ gap: 5, fontSize: 12, height: 30 }}
                  onClick={() => {
                    const date = new Date().toISOString().slice(0, 10)
                    const slug = selectedSpecies?.codeEspece ?? 'catalogue'

                    const catalogueRows = filtered.map(v => [
                      v.codeVariete ?? '', v.nomVariete ?? '',
                      v.espece?.nomCommun ?? v.espece?.codeEspece ?? '',
                      v.statutVariete ?? '', v.origine ?? '', v.typeGrain ?? '',
                      v.cycleMin ?? '', v.cycleMax ?? '',
                      v.rendementMin ?? '', v.rendementMax ?? '',
                      v.anneeCreation ?? '', v.anneeHomologation ?? '',
                      v.selectionneurPrincipal ?? '', v.natureGenetique ?? '', v.vocationCulturale ?? '',
                    ])

                    const especeMap: Record<string, { nom: string; nb: number; cycleMin: number[]; cycleMax: number[]; rendMin: number[]; rendMax: number[] }> = {}
                    filtered.forEach(v => {
                      const code = v.espece?.codeEspece ?? 'Inconnu'
                      if (!especeMap[code]) especeMap[code] = { nom: v.espece?.nomCommun ?? code, nb: 0, cycleMin: [], cycleMax: [], rendMin: [], rendMax: [] }
                      especeMap[code].nb++
                      if (v.cycleMin)      especeMap[code].cycleMin.push(Number(v.cycleMin))
                      if (v.cycleMax)      especeMap[code].cycleMax.push(Number(v.cycleMax))
                      if (v.rendementMin)  especeMap[code].rendMin.push(Number(v.rendementMin))
                      if (v.rendementMax)  especeMap[code].rendMax.push(Number(v.rendementMax))
                    })
                    const avg = (arr: number[]) => arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : ''
                    const especeRows = Object.values(especeMap)
                      .sort((a, b) => b.nb - a.nb)
                      .map(e => [e.nom, e.nb, avg(e.cycleMin), avg(e.cycleMax), avg(e.rendMin), avg(e.rendMax)])

                    downloadXlsx(`senjiw-varietes-${slug}-${date}`, [
                      { name: 'Catalogue',  headers: ['Code', 'Nom variété', 'Espèce', 'Statut', 'Origine', 'Type grain', 'Cycle min (j)', 'Cycle max (j)', 'Rendement min (t/ha)', 'Rendement max (t/ha)', 'Année création', 'Année homologation', 'Sélectionneur', 'Nature génétique', 'Vocation culturale'], rows: catalogueRows },
                      { name: 'Par espèce', headers: ['Espèce', 'Nb variétés', 'Cycle min moy. (j)', 'Cycle max moy. (j)', 'Rendement min moy. (t/ha)', 'Rendement max moy. (t/ha)'], rows: especeRows },
                    ])
                  }}
                >
                  <Download size={13} /> Export .xls
                </button>
              )}
              {canCreateVariete && (
                <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={openNewVariete}>
                  <Plus size={12} /> Nouvelle variété
                </button>
              )}
            </div>
          </div>

          {/* Barre de recherche + chip espèce active */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {selectedSpecies && (() => {
                const ec = especeColor(selectedSpecies.codeEspece)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: `${ec}12`, border: `1px solid ${ec}40`, borderRadius: 99, padding: '3px 10px 3px 7px', fontSize: 12, color: ec, flexShrink: 0 }}>
                    {React.createElement(ESPECE_ICONS[selectedSpecies.codeEspece] ?? ESPECE_ICONS.default, { size: 11 })}
                    <span style={{ fontWeight: 700 }}>{selectedSpecies.codeEspece}</span>
                    <span style={{ fontWeight: 400, opacity: 0.85 }}>{selectedSpecies.nomCommun}</span>
                    <button onClick={() => { setSelectedSpeciesId(null); setSelectedVarietyId(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginLeft: 2, color: ec }}>
                      <X size={12} />
                    </button>
                  </div>
                )
              })()}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, minWidth: 200 }}>
                <Search size={13} color="var(--text-placeholder)" />
                <input
                  placeholder={selectedSpecies ? `Rechercher dans ${selectedSpecies.nomCommun}…` : 'Code, nom, espèce…'}
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13, fontFamily: 'var(--font-sans)' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
            {/* Filtre rapide par statut */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { value: '',         label: 'Toutes',    dot: undefined,  count: kpiActive + (showArchived ? kpiArchived : 0) },
                { value: 'DIFFUSEE', label: 'Diffusées', dot: '#16a34a',  count: kpiDiffusee },
                { value: 'EN_TEST',  label: 'En test',   dot: '#7c3aed',  count: kpiEnTest },
                { value: 'RETIREE',  label: 'Retirées',  dot: '#dc2626',  count: kpiRetiree },
              ].map(chip => (
                <button
                  key={chip.value}
                  onClick={() => setFilterStatut(f => f === chip.value ? '' : chip.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
                    border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
                    background: filterStatut === chip.value ? 'var(--text-primary)' : 'var(--surface)',
                    borderColor: filterStatut === chip.value ? 'var(--text-primary)' : 'var(--border)',
                    color: filterStatut === chip.value ? 'var(--surface)' : 'var(--text-secondary)',
                  }}
                >
                  {chip.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: filterStatut === chip.value ? 'var(--surface)' : chip.dot, display: 'inline-block' }} />}
                  {chip.label}
                  <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>({chip.count})</span>
                </button>
              ))}
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
                    ...(!selectedSpecies ? [{ field: 'espece', label: 'Espèce', paddingLeft: undefined as number | undefined }] : []),
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
                  <th style={{ width: 120, textAlign: 'right', paddingRight: 18 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [0, 1, 2, 3, 4].map(i => (
                      <tr key={i}>
                        <td colSpan={selectedSpecies ? 4 : 5}>
                          <div className="skeleton" style={{ height: 14, borderRadius: 4 }} />
                        </td>
                      </tr>
                    ))
                  : sorted.length === 0
                  ? (
                      <tr>
                        <td colSpan={selectedSpecies ? 4 : 5}>
                          <div className="empty-state" style={{ padding: '48px 0' }}>
                            <div className="empty-icon"><Sprout size={20} /></div>
                            <div className="empty-title">
                              {search ? 'Aucune variété correspondante'
                                : selectedSpecies ? `Aucune variété pour ${selectedSpecies.nomCommun}`
                                : 'Aucune variété enregistrée'}
                            </div>
                            <div className="empty-sub" style={{ marginTop: 4 }}>
                              {search && <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 6 }} onClick={() => setSearch('')}><X size={11} /> Effacer la recherche</button>}
                              {!search && canCreateVariete && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openNewVariete}>+ Créer une variété</button>}
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
                      const statusBorderColor = selectedSpecies
                        ? especeColor(selectedSpecies.codeEspece)
                        : v.statutVariete === 'DIFFUSEE' ? '#16a34a'
                        : v.statutVariete === 'EN_TEST' ? '#7c3aed'
                        : v.statutVariete === 'ARCHIVEE' ? '#9ca3af' : 'transparent'
                      return (
                        <tr
                          key={v.id}
                          style={{
                            opacity:    isArchived ? 0.5 : 1,
                            cursor:     'pointer',
                            background: isSelected ? 'var(--green-50)' : undefined,
                            boxShadow:  isSelected
                              ? 'inset 3px 0 0 var(--green-500)'
                              : `inset 3px 0 0 ${statusBorderColor}`,
                            transition: 'background 0.15s, box-shadow 0.15s',
                          }}
                          onClick={() => setSelectedVarietyId(isSelected ? null : v.id)}
                          onMouseEnter={() => setHoveredRowId(v.id)}
                          onMouseLeave={() => setHoveredRowId(null)}
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
                              fontSize: 11.5, fontFamily: 'var(--font-mono)',
                              fontWeight: 700, letterSpacing: '0.03em',
                              textDecoration: isArchived ? 'line-through' : 'none',
                            }}>
                              {v.codeVariete}
                            </code>
                          </td>

                          {/* Nom variété */}
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13.5 }}>{v.nomVariete}</div>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                              {v.origine && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.origine}</span>}
                              {v.typeGrain && (
                                <>
                                  {v.origine && <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.4 }}>·</span>}
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.typeGrain}</span>
                                </>
                              )}
                              {(v.cycleMin != null || v.rendementMin != null) && (
                                <>
                                  {(v.origine || v.typeGrain) && <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.4 }}>·</span>}
                                  <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                    {v.cycleMin != null ? (v.cycleMin === v.cycleMax ? `${v.cycleMin}j` : `${v.cycleMin}–${v.cycleMax}j`) : ''}
                                    {v.cycleMin != null && v.rendementMin != null ? ' · ' : ''}
                                    {v.rendementMin != null ? (v.rendementMin === v.rendementMax ? `${v.rendementMin} t/ha` : `${v.rendementMin}–${v.rendementMax} t/ha`) : ''}
                                  </span>
                                </>
                              )}
                            </div>
                            {isArchived && v.commentaireArchivage && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                <MessageSquare size={10} style={{ marginTop: 1, flexShrink: 0 }} />
                                {v.commentaireArchivage}
                              </div>
                            )}
                          </td>

                          {/* Espèce */}
                          {!selectedSpecies && (
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
                          )}

                          {/* Statut */}
                          <td><span className={`badge ${st.cls}`}>{st.label}</span></td>

                          {/* Actions */}
                          <td onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ paddingRight: 12 }}>
                            <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', alignItems: 'center' }}>
                              {/* Modifier — bouton principal visible */}
                              {isAdminOrSelector && !isArchived && (
                                <button
                                  className="btn btn-ghost"
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', ...dStyle }}
                                  onClick={() => { if (allowed) openEdit(v) }}
                                  title={allowed ? 'Modifier' : dTitle}
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {/* Archiver — bouton secondaire visible */}
                              {isAdminOrSelector && !isArchived && (
                                <button
                                  className="btn btn-ghost"
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: allowed ? 'var(--gold-dark)' : undefined, ...dStyle }}
                                  onClick={() => { if (allowed) { setArchiveTarget(v); setArchiveComment('') } }}
                                  title={allowed ? 'Archiver' : dTitle}
                                >
                                  <Archive size={13} />
                                </button>
                              )}
                              {/* Désarchiver + Supprimer pour variétés archivées */}
                              {isAdminOrSelector && isArchived && allowed && (
                                <>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green-700)' }}
                                    onClick={() => setDesarchiveTarget(v)}
                                    title="Désarchiver"
                                  >
                                    <RotateCcw size={13} />
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-600)' }}
                                    onClick={() => { setDeleteTarget(v); setDeleteComment('') }}
                                    title="Supprimer définitivement"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                              {/* Actions secondaires — au survol */}
                              <div style={{ display: 'flex', gap: 2, opacity: hoveredRowId === v.id ? 1 : 0, pointerEvents: hoveredRowId === v.id ? 'auto' : 'none', transition: 'opacity 0.15s' }}>
                                {v.ficheVarietalePath ? (
                                  <button
                                    className="btn btn-ghost"
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}
                                    onClick={() => setPdfViewerModal({ url: endpoints.varietyFicheUrl(v.id), title: `Fiche variétale — ${v.nomVariete}`, downloadName: `fiche-${v.codeVariete}`, ctx: { type: 'fiche', id: v.id, name: `${v.codeVariete} — ${v.nomVariete}`, codeEspece: v.espece?.codeEspece } })}
                                    title="Fiche variétale"
                                  >
                                    <FileText size={13} />
                                  </button>
                                ) : isAdminOrSelector && !isArchived && allowed ? (
                                  <button
                                    className="btn btn-ghost"
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                                    onClick={() => setPdfUploadModal({ type: 'fiche', id: v.id, name: `${v.codeVariete} — ${v.nomVariete}` })}
                                    title="Uploader fiche PDF"
                                  >
                                    <Upload size={13} />
                                  </button>
                                ) : null}
                                {isAdminOrSelector && (
                                  <button
                                    className="btn btn-ghost"
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                                    onClick={() => openHistorique(v)}
                                    title="Historique"
                                  >
                                    <History size={13} />
                                  </button>
                                )}
                                {!isArchived && (
                                  <button
                                    className="btn btn-ghost"
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                                    onClick={() => openZones(v, !allowed)}
                                    title="Zones agro-écologiques"
                                  >
                                    <MapPin size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
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
            {/* En-tête identité — code (immuable) + espèce (immuable) */}
            {editVariete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: 18 }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 5 }}>{editVariete.codeVariete}</code>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>·</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{editVariete.espece?.codeEspece} — {editVariete.espece?.nomCommun}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 5 }}>Code et espèce immuables</span>
              </div>
            ) : (
              <Field label="Nom variété" required>
                <FormInput
                  value={varieteForm.nomVariete}
                  onChange={e => {
                    const nom = e.target.value
                    setVarieteForm(f => ({
                      ...f, nomVariete: nom,
                      ...(codeAutoFilled ? { codeVariete: generateVarieteCode(f.idEspece, nom) } : {})
                    }))
                  }}
                  placeholder="Souna III"
                  required
                  autoFocus
                />
              </Field>
            )}

            {/* Espèce — verrouillée pour le sélectionneur, sélectionnable pour les autres */}
            {!editVariete && (
              <Field label="Espèce" required>
                {isSelector && userSpecialisation ? (() => {
                  const mySpec = species.find(s => s.codeEspece?.toUpperCase() === userSpecialisation.toUpperCase())
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-3)', padding: '1px 6px', borderRadius: 4 }}>
                        {userSpecialisation.toUpperCase()}
                      </code>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{mySpec?.nomCommun ?? userSpecialisation}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>Votre spécialisation</span>
                    </div>
                  )
                })() : (
                  <FormSelect
                    value={varieteForm.idEspece}
                    onChange={e => {
                      const idE = e.target.value
                      setVarieteForm(f => ({
                        ...f, idEspece: idE,
                        ...(codeAutoFilled ? { codeVariete: generateVarieteCode(idE, f.nomVariete) } : {})
                      }))
                    }}
                    required>
                    <option value="">— Sélectionner une espèce —</option>
                    {species.map(s => <option key={s.id} value={s.id}>{s.codeEspece} — {s.nomCommun}</option>)}
                  </FormSelect>
                )}
              </Field>
            )}

            {/* Code variété — masqué jusqu'à la génération, puis lecture seule déverrouillable */}
            {!editVariete && varieteForm.codeVariete && (
              <Field label="Code variété" required>
                {codeAutoFilled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {varieteForm.codeVariete}
                    </code>
                    <button
                      type="button"
                      onClick={() => setCodeAutoFilled(false)}
                      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
                    >
                      <Edit2 size={11} /> Modifier
                    </button>
                  </div>
                ) : (
                  <FormInput
                    value={varieteForm.codeVariete}
                    onChange={e => setVarieteForm(f => ({ ...f, codeVariete: e.target.value.toUpperCase() }))}
                    placeholder="MIL-SOUNA3"
                    required
                    autoFocus
                  />
                )}
              </Field>
            )}

            {/* Nom variété — affiché séparément en mode édition */}
            {editVariete && (
              <Field label="Nom variété" required>
                <FormInput value={varieteForm.nomVariete} onChange={e => setVarieteForm(f => ({ ...f, nomVariete: e.target.value }))} placeholder="Souna III" required />
              </Field>
            )}

            <Field label="Statut" required>
              <FormSelect value={varieteForm.statutVariete} onChange={e => setVarieteForm(f => ({ ...f, statutVariete: e.target.value }))}>
                <option value="DIFFUSEE">Diffusée</option>
                <option value="EN_TEST">En test</option>
                <option value="RETIREE">Retirée</option>
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

            {/* ── Identification officielle ISRA/CNRA ────────── */}
            <div style={{ marginTop: 18, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Identification officielle</span>
            </div>
            <FormRow>
              <Field label="Année d'homologation" hint="Inscription au catalogue national">
                <FormInput type="number" value={varieteForm.anneeHomologation} onChange={e => setVarieteForm(f => ({ ...f, anneeHomologation: e.target.value }))} placeholder="1975" min="1900" max="2030" />
              </Field>
              <Field label="N° de sélection" hint="Référence interne ISRA (ex : IS 9830)">
                <FormInput value={varieteForm.numeroSelection} onChange={e => setVarieteForm(f => ({ ...f, numeroSelection: e.target.value }))} placeholder="IS 9830" />
              </Field>
              <Field label="Synonyme(s)" hint="Autre(s) nom(s) connu(s)">
                <FormInput value={varieteForm.synonyme} onChange={e => setVarieteForm(f => ({ ...f, synonyme: e.target.value }))} placeholder="73-BS" />
              </Field>
            </FormRow>

            {/* ── Agronomie ─────────────────────────────────── */}
            <div style={{ marginTop: 14, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Agronomie</span>
            </div>
            <FormRow>
              <Field label="Nature génétique" hint="ex : Lignée pure, OPV, Hybride F1">
                <FormInput value={varieteForm.natureGenetique} onChange={e => setVarieteForm(f => ({ ...f, natureGenetique: e.target.value }))} placeholder="Lignée pure" />
              </Field>
              <Field label="Photosensibilité" hint="Réponse à la durée du jour">
                <FormSelect value={varieteForm.photosensibilite} onChange={e => setVarieteForm(f => ({ ...f, photosensibilite: e.target.value }))}>
                  <option value="">— Non renseigné —</option>
                  <option value="Neutre">Neutre</option>
                  <option value="Sensible">Sensible</option>
                  <option value="Peu sensible">Peu sensible</option>
                </FormSelect>
              </Field>
            </FormRow>
            <Field label="Vocation culturale" hint="Systèmes de culture cibles (pluvial, irrigué, bas-fonds…)">
              <FormInput value={varieteForm.vocationCulturale} onChange={e => setVarieteForm(f => ({ ...f, vocationCulturale: e.target.value }))} placeholder="Pluvial / Bas-fonds" />
            </Field>

            {editVariete && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--border)', marginTop: 4 }}>
                <History size={13} color="var(--text-muted)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chaque modification sera tracée avec votre identifiant et la date.</span>
              </div>
            )}

            <FormActions onCancel={() => { setShowVarieteForm(false); setEditVariete(null) }} loading={saving} submitLabel={editVariete ? 'Enregistrer les modifications' : 'Créer la variété'} />
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
                style={{ width: '100%', minHeight: 90, padding: '9px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
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
                style={{ width: '100%', minHeight: 80, padding: '9px 12px', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55 }}
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
        <Modal
          title={zonesReadOnly ? 'Zones recommandées' : 'Zones recommandées — Édition'}
          subtitle={`${zonesTarget.codeVariete} — ${zonesTarget.nomVariete}`}
          onClose={() => setZonesTarget(null)}
        >
          {zonesReadOnly ? (
            <div className="zone-section">
              <div className="zone-section-title">
                <MapPin size={14} /> Zones agro-écologiques du Sénégal
              </div>
              {zonesRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)' }}>
                  <MapPin size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>Aucune zone renseignée pour cette variété.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 0' }}>
                  {zonesRows.map((row, i) => {
                    const zone = allZones.find(z => String(z.id) === String(row.idZone))
                    const niveauColors: Record<string, { bg: string; color: string; border: string; label: string }> = {
                      OPTIMAL:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'Optimal' },
                      ACCEPTABLE: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Acceptable' },
                      MARGINALE:  { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3', label: 'Marginale' },
                    }
                    const style = niveauColors[row.niveauAdaptation] ?? niveauColors.OPTIMAL
                    return (
                      <div key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 99,
                        background: style.bg, color: style.color,
                        border: `1px solid ${style.border}`,
                        fontSize: 12.5, fontWeight: 600,
                      }}>
                        <MapPin size={11} />
                        {zone ? `${zone.code} — ${zone.nom}` : `Zone ${row.idZone}`}
                        <span style={{
                          fontSize: 10.5, fontWeight: 500, opacity: 0.8,
                          borderLeft: `1px solid ${style.border}`, paddingLeft: 6, marginLeft: 2,
                        }}>
                          {style.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setZonesTarget(null)}>Fermer</button>
              </div>
            </div>
          ) : (
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
          )}
        </Modal>
      )}

      {/* ── Modal historique des modifications ── */}
      {historiqueTarget && (
        <Modal
          title={`Historique — ${historiqueTarget.codeVariete}`}
          subtitle={`${historiqueTarget.nomVariete} · modifications traçées`}
          onClose={() => { setHistoriqueTarget(null); setHistoriqueData([]) }}
        >
          {loadingHistorique ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #bfdbfe', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : historiqueData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <History size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
              <div style={{ fontSize: 13 }}>Aucune modification enregistrée pour cette variété.</div>
              <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>Les modifications futures seront tracées ici.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Date', 'Champ modifié', 'Ancienne valeur', 'Nouvelle valeur', 'Par'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historiqueData.map((h: any, i: number) => (
                    <tr key={h.id ?? i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(h.dateModification).toLocaleString('fr-SN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{h.champ}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted)', maxWidth: 180 }}>
                        {h.ancienneValeur
                          ? <span style={{ background: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{h.ancienneValeur}</span>
                          : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 12px', maxWidth: 180 }}>
                        <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{h.nouvelleValeur ?? '—'}</span>
                      </td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 99 }}>
                          <User size={10} />
                          {h.modifiePar}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                {historiqueData.length} entrée{historiqueData.length > 1 ? 's' : ''} · du plus récent au plus ancien
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Modal historique admin espèce ── */}
      {especeHistoriqueTarget && (
        <Modal
          title={`Audit — ${especeHistoriqueTarget.codeEspece}`}
          subtitle={`${especeHistoriqueTarget.nomCommun} · actions administrateur tracées`}
          onClose={() => { setEspeceHistoriqueTarget(null); setEspeceHistoriqueData([]) }}
        >
          {loadingEspeceHistorique ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #bfdbfe', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : especeHistoriqueData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <History size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
              <div style={{ fontSize: 13 }}>Aucune action enregistrée pour cette espèce.</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Les créations et modifications futures seront tracées ici.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Date', 'Action', 'Champ', 'Ancienne valeur', 'Nouvelle valeur', 'Par'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {especeHistoriqueData.map((h: any, i: number) => (
                    <tr key={h.id ?? i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(h.dateModification).toLocaleString('fr-SN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                          background: h.action === 'CREATION' ? '#f0fdf4' : h.action === 'SUPPRESSION' ? '#fef2f2' : '#eff6ff',
                          color:      h.action === 'CREATION' ? '#16a34a' : h.action === 'SUPPRESSION' ? '#dc2626' : '#2563eb',
                        }}>{h.action}</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{h.champ ?? '—'}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-muted)', maxWidth: 160 }}>
                        {h.ancienneValeur
                          ? <span style={{ background: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{h.ancienneValeur}</span>
                          : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 12px', maxWidth: 160 }}>
                        <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{h.nouvelleValeur ?? '—'}</span>
                      </td>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 99 }}>
                          <User size={10} />
                          {h.modifiePar}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                {especeHistoriqueData.length} entrée{especeHistoriqueData.length > 1 ? 's' : ''} · du plus récent au plus ancien
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Modal visionneur PDF ── */}
      {pdfViewerModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setPdfViewerModal(null)}
        >
          <div
            style={{
              background: 'var(--surface)', borderRadius: 16,
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
              width: '100%', maxWidth: 900,
              maxHeight: '92vh',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={16} color="#2563eb" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdfViewerModal.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>Document PDF — lecture en ligne</div>
              </div>
              <button
                onClick={() => setPdfViewerModal(null)}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}
                title="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Corps du document */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#f1f5f9' }}>
              {pdfBlobLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f1f5f9' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #bfdbfe', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement du document…</span>
                </div>
              )}
              {pdfBlobMeta && (
                pdfBlobMeta.isImage
                  ? <div style={{ width: '100%', minHeight: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>
                      <img src={pdfBlobMeta.url} alt={pdfViewerModal.title} style={{ maxWidth: '100%', maxHeight: 560, objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                    </div>
                  : <iframe src={pdfBlobMeta.url} title={pdfViewerModal.title} style={{ width: '100%', height: '100%', minHeight: 520, border: 'none', display: 'block' }} />
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lecture seule dans votre navigateur.</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Boutons gestion — admin ou sélectionneur de la bonne spécialisation */}
                {pdfViewerModal.ctx && (isAdmin || canEdit(pdfViewerModal.ctx.codeEspece)) && (
                  confirmDelete ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                      <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Supprimer définitivement ?</span>
                      <button
                        onClick={deleteDocument}
                        disabled={deletingDoc}
                        style={{ padding: '4px 12px', borderRadius: 6, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: deletingDoc ? 'default' : 'pointer', opacity: deletingDoc ? 0.7 : 1 }}
                      >
                        {deletingDoc ? '…' : 'Confirmer'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => { const ctx = pdfViewerModal.ctx!; setPdfViewerModal(null); setPdfUploadModal(ctx) }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                      >
                        <Upload size={13} /> Remplacer
                      </button>
                      <button
                        onClick={() => setConfirmDelete(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                      >
                        <Trash2 size={13} /> Supprimer
                      </button>
                    </>
                  )
                )}
                {/* Télécharger */}
                {pdfBlobMeta && (
                  <a
                    href={pdfBlobMeta.url}
                    download={pdfViewerModal.downloadName}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
                  >
                    <Download size={14} /> Télécharger
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-in drawer — détail variété ── */}
      {selectedVariety && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.08)' }}
          onClick={() => setSelectedVarietyId(null)}
        />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0,
        height: '100vh', width: 460,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.10)',
        transform: selectedVariety ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 301,
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {selectedVariety && (
          <>
            {/* Header sticky */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 1,
              background: 'var(--surface)', borderBottom: '1px solid var(--border)',
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {selectedVariety.espece && React.createElement(ESPECE_ICONS[selectedVariety.espece.codeEspece] ?? ESPECE_ICONS.default, { size: 14, color: especeColor(selectedVariety.espece.codeEspece) })}
                <code style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }}>{selectedVariety.codeVariete}</code>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedVariety.nomVariete}</span>
              </div>
              <button className="btn btn-ghost" style={{ width: 30, height: 30, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                onClick={() => setSelectedVarietyId(null)} title="Fermer">
                <X size={16} />
              </button>
            </div>

            {/* Barre d'actions */}
            {(() => {
              const drawerArchived = selectedVariety.statutVariete === 'ARCHIVEE'
              const drawerAllowed  = canEdit(selectedVariety.espece?.codeEspece)
              const drawerDTitle   = `Non autorisé — spécialisation : ${userSpecialisation ?? 'N/A'}`
              return (
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {isAdminOrSelector && !drawerArchived && (
                    <button
                      className="btn btn-ghost"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, height: 30, ...(!drawerAllowed ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                      onClick={() => { if (drawerAllowed) openEdit(selectedVariety) }}
                      title={drawerAllowed ? 'Modifier' : drawerDTitle}
                    >
                      <Edit2 size={12} /> Modifier
                    </button>
                  )}
                  {isAdminOrSelector && !drawerArchived && (
                    <button
                      className="btn btn-ghost"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, height: 30, color: drawerAllowed ? 'var(--gold-dark)' : undefined, ...(!drawerAllowed ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                      onClick={() => { if (drawerAllowed) { setArchiveTarget(selectedVariety); setArchiveComment('') } }}
                      title={drawerAllowed ? 'Archiver' : drawerDTitle}
                    >
                      <Archive size={12} /> Archiver
                    </button>
                  )}
                  {isAdminOrSelector && drawerArchived && drawerAllowed && (
                    <>
                      <button
                        className="btn btn-ghost"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, height: 30, color: 'var(--green-700)' }}
                        onClick={() => setDesarchiveTarget(selectedVariety)}
                        title="Désarchiver"
                      >
                        <RotateCcw size={12} /> Désarchiver
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, height: 30, color: 'var(--red-600)' }}
                        onClick={() => { setDeleteTarget(selectedVariety); setDeleteComment('') }}
                        title="Supprimer définitivement"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </>
                  )}
                  {isAdminOrSelector && (
                    <button
                      className="btn btn-ghost"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, height: 30 }}
                      onClick={() => openHistorique(selectedVariety)}
                      title="Historique des modifications"
                    >
                      <History size={12} /> Historique
                    </button>
                  )}
                  {!drawerArchived && (
                    <button
                      className="btn btn-ghost"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, height: 30 }}
                      onClick={() => openZones(selectedVariety, !drawerAllowed)}
                      title="Zones agro-écologiques"
                    >
                      <MapPin size={12} /> Zones agro-éco
                    </button>
                  )}
                </div>
              )
            })()}

            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* KPIs 2×2 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {/* Espèce */}
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: selectedVariety.espece ? `${especeColor(selectedVariety.espece.codeEspece)}18` : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedVariety.espece ? especeColor(selectedVariety.espece.codeEspece) : 'var(--text-secondary)', flexShrink: 0 }}>
                    {selectedVariety.espece ? React.createElement(ESPECE_ICONS[selectedVariety.espece.codeEspece] ?? ESPECE_ICONS.default, { size: 16 }) : <Leaf size={16} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{selectedVariety.espece?.codeEspece ?? '—'}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedVariety.espece?.nomCommun ?? 'Espèce'}</div>
                  </div>
                </div>
                {/* Statut */}
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <div style={{ marginBottom: 4 }}><span className={`badge ${STATUT_CONFIG[selectedVariety.statutVariete]?.cls ?? 'badge-gray'}`}>{STATUT_CONFIG[selectedVariety.statutVariete]?.label ?? selectedVariety.statutVariete}</span></div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Statut actuel</div>
                  </div>
                </div>
                {/* Cycle */}
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    <Clock size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                      {selectedVariety.cycleMin != null && selectedVariety.cycleMax != null
                        ? (selectedVariety.cycleMin === selectedVariety.cycleMax ? `${selectedVariety.cycleMin} j` : `${selectedVariety.cycleMin}–${selectedVariety.cycleMax} j`)
                        : '—'}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Cycle végétatif</div>
                  </div>
                </div>
                {/* Rendement */}
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                      {selectedVariety.rendementMin != null && selectedVariety.rendementMax != null
                        ? (selectedVariety.rendementMin === selectedVariety.rendementMax ? `${selectedVariety.rendementMin} t/ha` : `${selectedVariety.rendementMin}–${selectedVariety.rendementMax} t/ha`)
                        : '—'}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Rendement potentiel</div>
                  </div>
                </div>
              </div>

              {/* Identification officielle */}
              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <User size={12} color="var(--green-600)" />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Identification officielle</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                  {selectedVariety.selectionneurPrincipal && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Sélectionneur principal</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedVariety.selectionneurPrincipal}</div>
                    </div>
                  )}
                  {selectedVariety.anneeCreation && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Année d'obtention</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{selectedVariety.anneeCreation}</div>
                    </div>
                  )}
                  {selectedVariety.anneeHomologation && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Homologation</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{selectedVariety.anneeHomologation}</div>
                    </div>
                  )}
                  {selectedVariety.numeroSelection && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>N° de sélection</div>
                      <code style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>{selectedVariety.numeroSelection}</code>
                    </div>
                  )}
                  {selectedVariety.synonyme && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Synonyme(s)</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{selectedVariety.synonyme}</div>
                    </div>
                  )}
                  {selectedVariety.origine && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Origine</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedVariety.origine}</div>
                    </div>
                  )}
                  {selectedVariety.pedigree && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Pedigree</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>{selectedVariety.pedigree}</div>
                    </div>
                  )}
                  {!selectedVariety.selectionneurPrincipal && !selectedVariety.anneeCreation && !selectedVariety.anneeHomologation && !selectedVariety.numeroSelection && !selectedVariety.synonyme && !selectedVariety.origine && !selectedVariety.pedigree && (
                    <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: 11.5, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>Aucune donnée d'identification renseignée</div>
                  )}
                </div>
              </div>

              {/* Agronomie */}
              <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <FlaskConical size={12} color="var(--green-600)" />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Agronomie</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedVariety.natureGenetique && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Nature génétique</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedVariety.natureGenetique}</div>
                    </div>
                  )}
                  {selectedVariety.photosensibilite && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Photosensibilité</div>
                      <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 600, padding: '2px 9px', borderRadius: 5, background: selectedVariety.photosensibilite === 'Sensible' ? '#fef3c7' : selectedVariety.photosensibilite === 'Peu sensible' ? '#f0fdf4' : 'var(--surface-2)', color: selectedVariety.photosensibilite === 'Sensible' ? '#92400e' : selectedVariety.photosensibilite === 'Peu sensible' ? '#166534' : 'var(--text-secondary)', border: '1px solid', borderColor: selectedVariety.photosensibilite === 'Sensible' ? '#fcd34d' : selectedVariety.photosensibilite === 'Peu sensible' ? '#bbf7d0' : 'var(--border)' }}>{selectedVariety.photosensibilite}</span>
                    </div>
                  )}
                  {selectedVariety.typeGrain && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Type de grain</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedVariety.typeGrain}</div>
                    </div>
                  )}
                  {selectedVariety.vocationCulturale && (
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Vocation culturale</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedVariety.vocationCulturale}</div>
                    </div>
                  )}
                  {!selectedVariety.natureGenetique && !selectedVariety.photosensibilite && !selectedVariety.typeGrain && !selectedVariety.vocationCulturale && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 11.5, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>Aucune donnée agronomique renseignée</div>
                  )}
                </div>
              </div>

              {/* Documents */}
              {selectedVariety.ficheVarietalePath && (
                <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={13} color="var(--text-secondary)" />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Documents</span>
                  <button
                    className="btn btn-ghost"
                    style={{ height: 28, padding: '0 10px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', fontWeight: 600 }}
                    onClick={() => setPdfViewerModal({ url: endpoints.varietyFicheUrl(selectedVariety.id), title: `Fiche variétale — ${selectedVariety.nomVariete}`, downloadName: `fiche-${selectedVariety.codeVariete}`, ctx: { type: 'fiche', id: selectedVariety.id, name: `${selectedVariety.codeVariete} — ${selectedVariety.nomVariete}`, codeEspece: selectedVariety.espece?.codeEspece } })}
                  >
                    <FileText size={12} /> Fiche variétale
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal upload PDF ── */}
      {pdfUploadModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => { if (!uploading) setPdfUploadModal(null) }}
        >
          <div
            style={{
              background: 'var(--surface)', borderRadius: 16,
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
              width: '100%', maxWidth: 480,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Upload size={16} color="#16a34a" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {pdfUploadModal.type === 'fiche' ? 'Fiche variétale' : 'Itinéraire technique'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{pdfUploadModal.name}</div>
              </div>
              {!uploading && (
                <button
                  onClick={() => setPdfUploadModal(null)}
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: 24 }}>
              {/* Info contextuelle */}
              <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 20 }}>
                <FileText size={15} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.55 }}>
                  {pdfUploadModal.type === 'fiche'
                    ? 'La fiche variétale décrit les caractéristiques agronomiques de cette variété spécifique.'
                    : 'L\'itinéraire technique s\'applique à toutes les variétés de cette espèce.'}
                  {' '}Le fichier PDF remplacera toute version précédente.
                </div>
              </div>

              {/* Zone de dépôt */}
              <div
                style={{
                  border: `2px dashed ${dragOver ? '#2563eb' : 'var(--border-strong)'}`,
                  borderRadius: 12,
                  background: dragOver ? '#eff6ff' : 'var(--surface-2)',
                  padding: '32px 24px',
                  textAlign: 'center',
                  cursor: uploading ? 'default' : 'pointer',
                  transition: 'all 0.18s',
                }}
                onClick={() => { if (!uploading) fileInputRef.current?.click() }}
                onDragOver={(e: React.DragEvent) => { e.preventDefault(); if (!uploading) setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e: React.DragEvent) => {
                  e.preventDefault(); setDragOver(false)
                  if (uploading) return
                  const file = e.dataTransfer.files?.[0]
                  if (file) uploadPdf(file)
                }}
              >
                {uploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #bfdbfe', borderTopColor: '#2563eb', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Upload en cours…</div>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: dragOver ? '#dbeafe' : 'var(--surface-3)', border: `1px solid ${dragOver ? '#93c5fd' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', transition: 'all 0.18s' }}>
                      <Upload size={20} color={dragOver ? '#2563eb' : 'var(--text-secondary)'} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: dragOver ? '#1d4ed8' : 'var(--text-primary)', marginBottom: 6 }}>
                      Glissez votre fichier ici
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      ou <span style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>cliquez pour parcourir</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, display: 'inline-block' }}>
                      PDF, JPG, PNG, WEBP · Taille max : 30 Mo
                    </div>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0]
                  if (file) { uploadPdf(file); e.target.value = '' }
                }}
              />
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => { if (!uploading) setPdfUploadModal(null) }}
                disabled={uploading}
                style={{ fontSize: 13 }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
