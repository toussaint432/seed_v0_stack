import React, { useEffect, useState } from 'react'
import {
  ArrowRightLeft, Plus, RefreshCw, Search, X, Eye,
  CheckCircle2, Truck, Clock, FileText, Download, Receipt,
  XCircle, ClipboardCheck
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, extractList } from '../../lib/normalizers'
import { downloadCsv, formatDateForExport } from '../../lib/exportUtils'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Pagination } from '../components/Pagination'
import { keycloak } from '../../lib/keycloak'
import { generateTransferDoc, generateNumero, TransferDocData, LotPdfData, PartiePdf } from '../../lib/pdf/generateTransferDoc'
import { generateFacture, FactureData, FactureResult } from '../../lib/pdf/generateFacture'

interface Props { roleKey: string; userSpecialisation?: string | null }
const PAGE_SIZE = 10

import { ROLE_LABELS_LONG as ROLE_LABELS } from '../../lib/constants'

/* ── Inférence du rôle depuis la génération ── */
function guessRoleFromGen(gen: string, side: 'emetteur' | 'dest'): string {
  if (gen === 'G0' || gen === 'G1') return side === 'emetteur' ? 'seed-selector'     : 'seed-upsemcl'
  if (gen === 'G3')                 return side === 'emetteur' ? 'seed-upsemcl'      : 'seed-multiplicator'
  if (gen === 'R1' || gen === 'R2') return side === 'emetteur' ? 'seed-multiplicator': 'seed-quotataire'
  return side === 'emetteur' ? 'seed-selector' : 'seed-upsemcl'
}

/* ── Règles métier : générations autorisées et destination fixe par rôle ── */
const TRANSFER_RULES: Record<string, { allowedGens: string[]; source: string; destination: string; destRole: string }> = {
  'seed-selector':      { allowedGens: ['G1'],       source: 'ISRA/CNRA',      destination: 'UPSemCL',       destRole: 'UPSemCL' },
  'seed-upsemcl':        { allowedGens: ['G3'],        source: 'UPSemCL',        destination: 'Multiplicateur', destRole: 'Multiplicateur' },
  'seed-multiplicator': { allowedGens: ['R1', 'R2'],  source: 'Multiplicateur', destination: 'Quotataire/OP',  destRole: 'Quotataire/OP' },
}

const STATUT_TRANSFERT = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'ACCEPTE', label: 'Accepté' },
  { value: 'REJETE', label: 'Refusé' },
  { value: 'ANNULE', label: 'Annulé' },
]

/** Formate un Instant (ISO string) en "dd/MM/yyyy à HH:mm:ss" pour la piste d'audit. */
function fmtDatetime(value?: string | null): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return `${date} à ${time}`
  } catch { return value }
}

export function Transfers({ roleKey, userSpecialisation }: Props) {
  const [transfers, setTransfers] = useState<any[]>([])
  const [lots, setLots] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [mesSites, setMesSites] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  // Modal acceptation — sélection du site de stockage du destinataire
  const [acceptModal, setAcceptModal] = useState<any>(null)
  const [acceptSiteCode, setAcceptSiteCode] = useState('')
  const [acceptSaving, setAcceptSaving] = useState(false)
  const [saving, setSaving] = useState(false)
  // blobUrl ouvert dans un onglet → pas besoin de state docViewer

  const canCreate = ['seed-admin', 'seed-selector', 'seed-upsemcl', 'seed-multiplicator'].includes(roleKey)
  const rule = TRANSFER_RULES[roleKey]

  // Lots filtrés selon les générations autorisées pour ce rôle
  const transferableLots = rule
    ? lots.filter((l: any) => l.statutLot === 'DISPONIBLE' && rule.allowedGens.includes(l.generation?.codeGeneration))
    : lots.filter((l: any) => l.statutLot === 'DISPONIBLE')

  const [form, setForm] = useState({
    codeTransfert: '', idLot: '',
    organisationSource: rule?.source || '',
    organisationDestination: rule?.destination || '',
    siteSource: '', siteDestination: '',
    quantiteTransferee: '', dateDemande: new Date().toISOString().split('T')[0],
    observations: '',
  })

  const isUpsemcl = roleKey === 'seed-upsemcl'
  const [filterDir, setFilterDir] = useState<'tous'|'recus'|'emis'>('tous')

  const [recus, setRecus] = useState<any[]>([])
  const [refusModal, setRefusModal] = useState<any>(null)
  const [motifRefus, setMotifRefus] = useState('')
  // État modale facture
  const [factureModal, setFactureModal] = useState<any>(null)
  const [facturePrix, setFacturePrix] = useState('')
  const [factureTva, setFactureTva] = useState('0')
  const [factureConditions, setFactureConditions] = useState('')

  // Rôles éligibles à générer/voir les factures de cession
  const canFacture = ['seed-selector', 'seed-upsemcl', 'seed-admin', 'seed-multiplicator'].includes(roleKey)

  async function fetchAll() {
    setLoading(true)
    const lotsUrl = roleKey === 'seed-multiplicator' ? endpoints.lotsMesLots : endpoints.lots
    const needsMesSites = ['seed-multiplicator', 'seed-quotataire'].includes(roleKey)
    const [tRes, lRes, rRes, sRes, msRes] = await Promise.allSettled([
      api.get(endpoints.transfertsLot),
      api.get(lotsUrl),
      api.get(endpoints.transfertsRecus),
      api.get(endpoints.sites),
      needsMesSites ? api.get(endpoints.sitesMesSites) : Promise.resolve({ data: [] }),
    ])
    setTransfers(tRes.status === 'fulfilled' ? tRes.value.data : [])
    setLots(extractList(lRes.status === 'fulfilled' ? lRes.value.data : null).map(normalizeLot))
    setRecus(rRes.status === 'fulfilled' ? rRes.value.data : [])
    setSites(sRes.status === 'fulfilled' ? sRes.value.data : [])
    setMesSites(msRes.status === 'fulfilled' ? msRes.value.data : [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = transfers.filter(t => {
    const matchSearch = !search ||
      t.codeTransfert?.toLowerCase().includes(search.toLowerCase()) ||
      t.usernameEmetteur?.toLowerCase().includes(search.toLowerCase()) ||
      t.usernameDestinataire?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || t.statut === filterStatus
    const matchDir = !isUpsemcl || filterDir === 'tous'
      || (filterDir === 'recus' && t.roleDestinataire === 'seed-upsemcl')
      || (filterDir === 'emis'  && t.roleEmetteur    === 'seed-upsemcl')
    if (roleKey === 'seed-selector' && userSpecialisation) {
      const lot = lots.find((l: any) => l.id === (t.idLot ?? t.lot?.id))
      const ce: string | undefined = lot?.codeEspece ?? lot?.variete?.espece?.codeEspece
      if (ce && ce.toUpperCase() !== userSpecialisation.toUpperCase()) return false
    }
    return matchSearch && matchStatus && matchDir
  })

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const byStatus = transfers.reduce((acc: Record<string, number>, t: any) => {
    acc[t.statut] = (acc[t.statut] || 0) + 1; return acc
  }, {})

  async function confirmerAcceptation() {
    if (!acceptModal) return
    setAcceptSaving(true)
    try {
      await api.put(endpoints.transfertAccepter(acceptModal.id), {
        siteCode: acceptSiteCode || undefined,
      })
      setToast({ msg: `Transfert ${acceptModal.codeTransfert} accepté${acceptSiteCode ? ' — stock crédité (FIFO)' : ''}`, type: 'success' })
      setAcceptModal(null)
      setAcceptSiteCode('')
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de l\'acceptation', type: 'error' })
    } finally { setAcceptSaving(false) }
  }

  async function refuser(e: React.FormEvent) {
    e.preventDefault()
    if (!refusModal) return
    setSaving(true)
    try {
      await api.put(endpoints.transfertRefuser(refusModal.id), { motif: motifRefus })
      setToast({ msg: 'Transfert refusé', type: 'success' })
      setRefusModal(null); setMotifRefus('')
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.transfers, {
        codeTransfert: form.codeTransfert,
        idLot: Number(form.idLot),
        organisationSource: form.organisationSource || undefined,
        organisationDestination: form.organisationDestination || undefined,
        quantite: Number(form.quantiteTransferee),
        dateTransfert: form.dateDemande,
        observations: form.observations || undefined,
      })
      setToast({ msg: `Transfert ${form.codeTransfert} créé`, type: 'success' })
      setShowForm(false)
      setForm({ codeTransfert: '', idLot: '', organisationSource: rule?.source || '', organisationDestination: rule?.destination || '', siteSource: '', siteDestination: '', quantiteTransferee: '', dateDemande: new Date().toISOString().split('T')[0], observations: '' })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors du transfert', type: 'error' })
    } finally { setSaving(false) }
  }

  function getLotLabel(idLot: number): string {
    const lot = lots.find((l: any) => l.id === idLot)
    return lot ? lot.codeLot : `#${idLot}`
  }

  function submitFacture(e: React.FormEvent) {
    e.preventDefault()
    const t = factureModal
    const lot = lots.find((l: any) => l.id === (t.idLot ?? t.lot?.id))
    const jwt = keycloak.tokenParsed as Record<string, unknown>
    const currentUser = (jwt?.preferred_username as string) || ''
    const gen = t.generationTransferee || lot?.generation?.codeGeneration || ''
    const emetteurRoleKey = t.roleEmetteur || guessRoleFromGen(gen, 'emetteur')
    const destRoleKey     = t.roleDestinataire || guessRoleFromGen(gen, 'dest')

    const data: FactureData = {
      transfertId:      t.id,
      codeTransfert:    t.codeTransfert,
      vendeurUsername:  t.usernameEmetteur || currentUser,
      vendeurNom:       t.usernameEmetteur || currentUser,
      vendeurRole:      ROLE_LABELS[emetteurRoleKey] || emetteurRoleKey,
      vendeurAdresse:   'ISRA/CNRA — Bambey, Sénégal',
      acheteurUsername: t.usernameDestinataire || '—',
      acheteurNom:      t.usernameDestinataire || '—',
      acheteurRole:     ROLE_LABELS[destRoleKey] || destRoleKey,
      codeLot:          lot?.codeLot || `LOT-${t.idLot}`,
      nomVariete:       lot?.variete?.nomVariete || lot?.nomVariete || 'N/D',
      nomEspece:        lot?.variete?.espece?.nomEspece || lot?.espece?.nomEspece || 'Semence',
      generationCode:   gen || '—',
      quantiteKg:       Number(t.quantite ?? lot?.quantiteNette ?? 0),
      unite:            lot?.unite || 'kg',
      campagne:         lot?.campagne,
      prixUnitaireKg:   parseFloat(facturePrix) || 0,
      tvaPercent:       parseFloat(factureTva) || 0,
      dateFacture:      new Date().toISOString().split('T')[0],
      conditions:       factureConditions || undefined,
      observations:     t.observations,
    }

    const result: FactureResult = generateFacture(data)
    setFactureModal(null)
    setFacturePrix('')
    setFactureTva('0')
    setFactureConditions('')
    window.open(result.blobUrl, '_blank')
    setToast({ msg: `Facture ${result.filename} ouverte dans un nouvel onglet`, type: 'success' })
  }

  function downloadDoc(t: any, type: 'BORDEREAU' | 'ACCUSE_RECEPTION') {
    const lot = lots.find((l: any) => l.id === (t.idLot ?? t.lot?.id))
    const jwt = keycloak.tokenParsed as Record<string, unknown>
    const currentUser = (jwt?.preferred_username as string) || ''

    const gen = t.generationTransferee || lot?.generation?.codeGeneration || ''
    const emetteurRoleKey = t.roleEmetteur || guessRoleFromGen(gen, 'emetteur')
    const destRoleKey     = t.roleDestinataire || guessRoleFromGen(gen, 'dest')

    const lotData: LotPdfData = {
      codeLot:          lot?.codeLot || `LOT-${t.idLot}`,
      nomVariete:       lot?.variete?.nomVariete || lot?.nomVariete || 'N/D',
      nomEspece:        lot?.variete?.espece?.nomEspece || lot?.espece?.nomEspece || 'Semence',
      generationCode:   gen || '—',
      quantiteNette:    Number(t.quantite ?? lot?.quantiteNette ?? 0),
      unite:            lot?.unite || 'kg',
      tauxGermination:  lot?.tauxGermination,
      puretePhysique:   lot?.puretePhysique,
      statutLot:        lot?.statutLot || 'TRANSFERE',
      dateProduction:   lot?.dateProduction,
      campagne:         lot?.campagne,
      lotParentCode:    lot?.lotParent?.codeLot,
    }

    const expediteur: PartiePdf = {
      username:  t.usernameEmetteur || '—',
      nom:       t.usernameEmetteur || '—',
      roleKey:   emetteurRoleKey,
      roleLabel: ROLE_LABELS[emetteurRoleKey] || emetteurRoleKey,
    }

    const destinataire: PartiePdf = {
      username:  t.usernameDestinataire || '—',
      nom:       t.usernameDestinataire || '—',
      roleKey:   destRoleKey,
      roleLabel: ROLE_LABELS[destRoleKey] || destRoleKey,
    }

    const docData: TransferDocData = {
      type,
      codeTransfert:      t.codeTransfert,
      numero:             generateNumero(t.id),
      lot:                lotData,
      expediteur,
      destinataire,
      quantiteTransferee: Number(t.quantite ?? 0),
      dateDemande:        t.dateDemande || new Date().toISOString().split('T')[0],
      observations:       t.observations,
      dateAcceptation:    type === 'ACCUSE_RECEPTION' ? (t.dateAcceptation || new Date().toISOString().split('T')[0]) : undefined,
      nomReceptionnaire:  type === 'ACCUSE_RECEPTION' ? currentUser : undefined,
      quantiteRecue:      type === 'ACCUSE_RECEPTION' ? Number(t.quantite ?? 0) : undefined,
    }

    const result = generateTransferDoc(docData)
    window.open(result.blobUrl, '_blank')
    setToast({ msg: `Document ouvert dans un nouvel onglet`, type: 'success' })
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><ArrowRightLeft size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : transfers.length}</div><div className="stat-label">Total transferts</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : (byStatus['EN_ATTENTE'] || byStatus['DEMANDE'] || 0)}</div><div className="stat-label">En attente</div></div></div>
        <div className="stat-card"><div className="stat-icon violet"><Truck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['ACCEPTE'] || 0}</div><div className="stat-label">Acceptés</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['REJETE'] || 0}</div><div className="stat-label">Refusés</div></div></div>
      </div>

      {/* Transferts à traiter — section urgente */}
      {recus.length > 0 && (
        <div className="card" style={{ border: '1px solid #fbbf24', background: '#fffbeb', marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title" style={{ color: '#92400e' }}>
              <span className="card-title-icon" style={{ background: '#fef3c7' }}><Clock size={15} color="#92400e" /></span>
              {recus.length} transfert{recus.length > 1 ? 's' : ''} en attente de votre réponse
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px 16px' }}>
            {recus.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', border: '1px solid #fde68a', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: 'var(--font-mono)' }}>{t.codeTransfert}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    De <strong>{t.usernameEmetteur}</strong> ({t.roleEmetteur}) · Lot #{t.idLot} · {t.generationTransferee}
                    {t.quantite && <> · {Number(t.quantite).toLocaleString('fr-FR')} kg</>}
                    {t.createdAt && <> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDatetime(t.createdAt)}</span></>}
                  </div>
                  {t.observations && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>{t.observations}</div>}
                </div>
                <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }}
                  onClick={() => {
                    const principal = mesSites.find((s: any) => s.estPrincipal) ?? mesSites[0]
                    setAcceptModal(t)
                    setAcceptSiteCode(principal?.codeSite ?? '')
                  }}>
                  <CheckCircle2 size={12} /> Accepter
                </button>
                <button className="btn btn-ghost" style={{ height: 30, fontSize: 12, color: '#ef4444', borderColor: '#fca5a5' }}
                  onClick={() => { setRefusModal(t); setMotifRefus('') }}>
                  Refuser
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow */}
      <div className="gen-pipeline">
        <div className="gen-pipeline-title"><ArrowRightLeft size={14} /> Flux de transfert semencier</div>
        <div className="gen-steps">
          {STATUT_TRANSFERT.filter(s => s.value !== 'ANNULE').map(s => (
            <div key={s.value} className="gen-step"
              style={{ cursor: 'pointer', opacity: filterStatus && filterStatus !== s.value ? 0.5 : 1 }}
              onClick={() => { setFilterStatus(filterStatus === s.value ? '' : s.value); setCurrentPage(1) }}>
              <div className="gen-step-code" style={{ background: filterStatus === s.value ? '#dcfce7' : '#f9fafb' }}>{s.label.charAt(0)}</div>
              <div className="gen-step-count">{byStatus[s.value] || 0}</div>
              <div className="gen-step-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><ArrowRightLeft size={15} /></span>
            Transferts <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {filtered.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ gap: 5, fontSize: 12 }}
                onClick={() => downloadCsv(
                  `transferts-${new Date().toISOString().slice(0, 10)}`,
                  ['Code transfert', 'Code lot', 'Génération', 'Émetteur', 'Organisation source', 'Destinataire', 'Organisation destination', 'Quantité', 'Statut', 'Date initiation'],
                  filtered.map((t: any) => [
                    t.codeTransfert ?? '',
                    getLotLabel(t.idLot),
                    t.generationTransferee ?? '',
                    t.usernameEmetteur ?? t.organisationSource ?? '',
                    t.organisationSource ?? '',
                    t.usernameDestinataire ?? t.organisationDestination ?? '',
                    t.organisationDestination ?? '',
                    Number(t.quantiteTransferee ?? t.quantite) || 0,
                    t.statut ?? t.statutTransfert ?? '',
                    formatDateForExport(t.createdAt),
                  ])
                )}
              ><Download size={13} /> CSV</button>
            )}
            {canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Nouveau transfert</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Code transfert, lot…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'var(--font-sans)', width: 200 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">Statut</label>
            <select className="input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1) }} style={{ width: 150 }}>
              <option value="">Tous</option>
              {STATUT_TRANSFERT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {isUpsemcl && (
            <div className="filter-group">
              <label className="filter-label">Direction</label>
              <div style={{ display: 'flex', gap: 3, background: 'var(--surface-2)', borderRadius: 7, padding: 3, border: '1px solid var(--border)' }}>
                {([['tous','Tous'],['recus','⬇ Reçus'],['emis','⬆ Émis']] as const).map(([k, l]) => (
                  <button key={k}
                    onClick={() => { setFilterDir(k); setCurrentPage(1) }}
                    style={{
                      padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600,
                      background: filterDir === k ? 'var(--green-600)' : 'transparent',
                      color:      filterDir === k ? '#fff' : 'var(--text-muted)',
                      transition: 'all .15s',
                    }}
                  >{l}</button>
                ))}
              </div>
            </div>
          )}
          {(search || filterStatus) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterStatus(''); setCurrentPage(1) }}><X size={12} /> Effacer</button>}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 130 }}>Code</th>
                <th style={{ maxWidth: 160 }}>Lot</th>
                <th>Émetteur → Destinataire</th>
                <th style={{ width: 90 }}>Génération</th>
                <th style={{ width: 150 }}>Initié le</th>
                <th style={{ width: 110 }}>Statut</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [0, 1, 2, 3].map(i => <tr key={i}><td colSpan={7}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                pageItems.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon"><ArrowRightLeft size={20} /></div><div className="empty-title">{search || filterStatus ? 'Aucun résultat' : 'Aucun transfert'}</div>{canCreate && !search && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>+ Nouveau transfert</button>}</div></td></tr>
                ) : pageItems.map((t: any) => {
                  const statut = t.statut || t.statutTransfert
                  const lotLabel = getLotLabel(t.idLot) || `#${t.idLot}`
                  const isActif = statut !== 'ANNULE' && statut !== 'REJETE'
                  return (
                    <tr key={t.id}>
                      {/* Code */}
                      <td><span className="td-mono" style={{ fontWeight: 700, fontSize: 12 }}>{t.codeTransfert}</span></td>
                      {/* Lot — tronqué si trop long */}
                      <td>
                        <span
                          className="td-mono"
                          title={lotLabel}
                          style={{ display: 'block', maxWidth: 155, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }}
                        >{lotLabel}</span>
                      </td>
                      {/* Émetteur → Destinataire */}
                      <td style={{ fontSize: 12.5 }}>
                        <span style={{ fontWeight: 600 }}>{t.usernameEmetteur || t.organisationSource || '—'}</span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 5px', fontWeight: 400 }}>→</span>
                        <span style={{ fontWeight: 600 }}>{t.usernameDestinataire || t.organisationDestination || '—'}</span>
                      </td>
                      {/* Génération */}
                      <td><span className="badge badge-generation">{t.generationTransferee || '—'}</span></td>
                      {/* Date */}
                      <td style={{ fontSize: 11, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{fmtDatetime(t.createdAt)}</td>
                      {/* Statut */}
                      <td><StatusBadge status={statut} showIcon /></td>
                      {/* Actions — organisées en deux groupes : workflow | documents */}
                      <td>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                          {/* Voir le détail — toujours visible */}
                          <button
                            className="btn btn-ghost"
                            style={{ height: 26, padding: '0 7px', fontSize: 11, color: 'var(--text-secondary)' }}
                            title="Voir le détail du transfert"
                            onClick={() => setShowDetail(t)}
                          ><Eye size={12} /></button>

                          {/* ── Workflow : Accepter / Refuser (EN_ATTENTE seulement) ── */}
                          {statut === 'EN_ATTENTE' && t.usernameDestinataire && (<>
                            <button
                              className="btn btn-ghost"
                              style={{ height: 26, padding: '0 7px', fontSize: 11, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                              title="Accepter ce transfert"
                              onClick={() => {
                                const principal = mesSites.find((s: any) => s.estPrincipal) ?? mesSites[0]
                                setAcceptModal(t)
                                setAcceptSiteCode(principal?.codeSite ?? '')
                              }}
                            ><CheckCircle2 size={12} /></button>
                            <button
                              className="btn btn-ghost"
                              style={{ height: 26, padding: '0 7px', fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}
                              title="Refuser ce transfert"
                              onClick={() => { setRefusModal(t); setMotifRefus('') }}
                            ><XCircle size={12} /></button>
                          </>)}

                          {/* Séparateur visuel si actions workflow + documents */}
                          {isActif && <span style={{ width: 1, height: 16, background: 'var(--border)', display: 'inline-block', margin: '0 1px' }} />}

                          {/* ── Documents ── */}
                          {isActif && (
                            <button
                              className="btn btn-ghost"
                              style={{ height: 26, padding: '0 7px', fontSize: 11, color: '#0369a1' }}
                              title="Bordereau de Livraison"
                              onClick={() => downloadDoc(t, 'BORDEREAU')}
                            ><FileText size={12} /></button>
                          )}
                          {statut === 'ACCEPTE' && (
                            <button
                              className="btn btn-ghost"
                              style={{ height: 26, padding: '0 7px', fontSize: 11, color: '#0f766e' }}
                              title="Accusé de Réception"
                              onClick={() => downloadDoc(t, 'ACCUSE_RECEPTION')}
                            ><ClipboardCheck size={12} /></button>
                          )}
                          {canFacture && isActif && (
                            <button
                              className="btn btn-ghost"
                              style={{ height: 26, padding: '0 7px', fontSize: 11, color: '#b45309' }}
                              title="Générer / Voir la Facture"
                              onClick={() => { setFactureModal(t); setFacturePrix(''); setFactureTva('0') }}
                            ><Receipt size={12} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <Modal
          title={`Transfert — ${showDetail.codeTransfert}`}
          subtitle={`Lot #${showDetail.idLot} · ${showDetail.generationTransferee || ''}`}
          onClose={() => setShowDetail(null)}
          >
          {/* Boutons PDF — toujours visibles en haut */}
          {(showDetail.statut || showDetail.statutTransfert) !== 'ANNULE' &&
           (showDetail.statut || showDetail.statutTransfert) !== 'REJETE' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: 140, justifyContent: 'center', gap: 8, border: '1.5px solid #bae6fd', background: '#f0f9ff' }}
                onClick={() => downloadDoc(showDetail, 'BORDEREAU')}
              >
                <FileText size={14} color="#0369a1" />
                <span style={{ color: '#0369a1', fontWeight: 600, fontSize: 12.5 }}>Bordereau de Livraison</span>
              </button>
              {(showDetail.statut || showDetail.statutTransfert) === 'ACCEPTE' && (
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, minWidth: 140, justifyContent: 'center', gap: 8, border: '1.5px solid #bbf7d0', background: '#f0fdf4' }}
                  onClick={() => downloadDoc(showDetail, 'ACCUSE_RECEPTION')}
                >
                  <Download size={14} color="#15803d" />
                  <span style={{ color: '#15803d', fontWeight: 600, fontSize: 12.5 }}>Accusé de Réception</span>
                </button>
              )}
              {canFacture && ['EN_ATTENTE','ACCEPTE'].includes(showDetail.statut || showDetail.statutTransfert) && (
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, minWidth: 140, justifyContent: 'center', gap: 8, border: '1.5px solid #fca5a5', background: '#fff5f5' }}
                  onClick={() => { setShowDetail(null); setFactureModal(showDetail); setFacturePrix(''); setFactureTva('0') }}
                >
                  <Receipt size={14} color="#b91c1c" />
                  <span style={{ color: '#b91c1c', fontWeight: 600, fontSize: 12.5 }}>Générer Facture</span>
                </button>
              )}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Émetteur</div><div style={{ fontSize: 13, fontWeight: 500 }}>{showDetail.usernameEmetteur || showDetail.organisationSource || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Destinataire</div><div style={{ fontSize: 13, fontWeight: 500 }}>{showDetail.usernameDestinataire || showDetail.organisationDestination || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Génération transférée</div><span className="badge badge-generation">{showDetail.generationTransferee || '—'}</span></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Quantité</div><div style={{ fontSize: 20, fontWeight: 700 }}>{showDetail.quantite ? Number(showDetail.quantite).toLocaleString('fr-FR') + ' kg' : '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Statut</div><StatusBadge status={showDetail.statut || showDetail.statutTransfert} showIcon size="md" /></div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Initié le</div>
              <div style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{fmtDatetime(showDetail.createdAt)}</div>
            </div>
            {showDetail.acceptedAt && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: 4 }}>Accepté le</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{fmtDatetime(showDetail.acceptedAt)}</div>
              </div>
            )}
            {showDetail.refusedAt && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: 4 }}>Refusé le</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{fmtDatetime(showDetail.refusedAt)}</div>
              </div>
            )}
            {showDetail.motifRefus && (
              <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: 4 }}>Motif de refus</div><div style={{ fontSize: 13, color: '#ef4444' }}>{showDetail.motifRefus}</div></div>
            )}
            {showDetail.observations && (
              <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Observations</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{showDetail.observations}</div></div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal Acceptation — sélection du site de stockage de réception */}
      {acceptModal && (
        <Modal
          title="Accepter le transfert"
          subtitle={`${acceptModal.codeTransfert} · Lot #${acceptModal.idLot} · ${acceptModal.generationTransferee} · ${Number(acceptModal.quantite || 0).toLocaleString('fr-FR')} kg`}
          onClose={() => { setAcceptModal(null); setAcceptSiteCode('') }}
          size="sm"
        >
          <form onSubmit={e => { e.preventDefault(); confirmerAcceptation() }}>
            <Field
              label="Site de réception du stock"
              hint={mesSites.length === 0
                ? 'Aucun site trouvé pour votre organisation. Créez un site dans « Mes Sites ».'
                : 'Les semences seront créditées dans ce site. Le site principal est présélectionné.'}
            >
              {mesSites.length > 0 ? (
                <FormSelect
                  value={acceptSiteCode}
                  onChange={v => setAcceptSiteCode(v)}
                  options={[
                    { value: '', label: '— Choisir un site —' },
                    ...mesSites.map((s: any) => ({
                      value: s.codeSite,
                      label: `${s.nomSite}${s.estPrincipal ? ' ★' : ''} (${s.codeSite})`,
                    })),
                  ]}
                />
              ) : (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: '#fffbeb', border: '1px solid #fbbf24',
                  fontSize: 12.5, color: '#92400e',
                }}>
                  Aucun site enregistré. Rendez-vous dans <strong>Mes Sites</strong> pour créer votre premier site de stockage.
                </div>
              )}
            </Field>

            {acceptSiteCode && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                fontSize: 12.5, color: '#166534', marginBottom: 12,
              }}>
                ✓ <strong>{Number(acceptModal.quantite || 0).toLocaleString('fr-FR')} kg</strong> seront crédités
                au site <strong>{mesSites.find((s: any) => s.codeSite === acceptSiteCode)?.nomSite ?? acceptSiteCode}</strong>.
              </div>
            )}

            <FormActions
              onCancel={() => { setAcceptModal(null); setAcceptSiteCode('') }}
              loading={acceptSaving}
              submitLabel="Confirmer l'acceptation"
            />
          </form>
        </Modal>
      )}

      {/* Modal Refus */}
      {refusModal && (
        <Modal title="Refuser le transfert" subtitle={refusModal.codeTransfert} onClose={() => setRefusModal(null)} size="sm">
          <form onSubmit={refuser}>
            <Field label="Motif du refus" required>
              <textarea
                value={motifRefus}
                onChange={e => setMotifRefus(e.target.value)}
                placeholder="Indiquer la raison du refus…"
                required
                style={{ width: '100%', minHeight: 80, padding: '9px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
            </Field>
            <FormActions onCancel={() => setRefusModal(null)} loading={saving} submitLabel="Confirmer le refus" submitClassName="btn-danger" />
          </form>
        </Modal>
      )}

      {/* Create Transfer Modal */}
      {showForm && (
        <Modal title="Nouveau Transfert" subtitle="Transférer un lot de semences entre organisations" onClose={() => setShowForm(false)} size="lg">
          <form onSubmit={submitTransfer}>
            <FormRow>
              <Field label="Code transfert" required hint="Ex: TRF-2026-001">
                <FormInput value={form.codeTransfert} onChange={e => setForm(f => ({ ...f, codeTransfert: e.target.value.toUpperCase() }))} placeholder="TRF-2026-001" required />
              </Field>
              <Field label="Lot" required hint={rule ? `Génération(s) autorisée(s) : ${rule.allowedGens.join(', ')}` : undefined}>
                <FormSelect value={form.idLot} onChange={e => setForm(f => ({ ...f, idLot: e.target.value }))} required>
                  <option value="">-- Sélectionner un lot --</option>
                  {transferableLots.length === 0
                    ? <option disabled value="">Aucun lot transférable disponible</option>
                    : transferableLots.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.codeLot} — {l.generation?.codeGeneration || 'N/A'} ({l.quantiteNette} {l.unite})</option>
                    ))
                  }
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Organisation source" required hint={rule ? 'Fixé par votre rôle' : undefined}>
                <FormInput
                  value={form.organisationSource}
                  onChange={e => setForm(f => ({ ...f, organisationSource: e.target.value }))}
                  placeholder="ISRA/CNRA"
                  required
                  readOnly={!!rule}
                  style={rule ? { background: 'var(--surface-2)', cursor: 'not-allowed', color: 'var(--text-secondary)' } : {}}
                />
              </Field>
              <Field label="Organisation destination" required hint={rule ? `Destinataire : ${rule.destRole}` : undefined}>
                <FormInput
                  value={form.organisationDestination}
                  onChange={e => setForm(f => ({ ...f, organisationDestination: e.target.value }))}
                  placeholder="UPSem Kaolack"
                  required
                  readOnly={!!rule}
                  style={rule ? { background: 'var(--surface-2)', cursor: 'not-allowed', color: 'var(--text-secondary)' } : {}}
                />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Site source"><FormInput value={form.siteSource} onChange={e => setForm(f => ({ ...f, siteSource: e.target.value }))} placeholder="MAG-BAMBEY" /></Field>
              <Field label="Site destination"><FormInput value={form.siteDestination} onChange={e => setForm(f => ({ ...f, siteDestination: e.target.value }))} placeholder="MAG-KAOLACK" /></Field>
            </FormRow>
            <FormRow>
              <Field label="Quantité (kg)" required>
                <FormInput type="number" value={form.quantiteTransferee} onChange={e => setForm(f => ({ ...f, quantiteTransferee: e.target.value }))} placeholder="500" min="0" step="0.01" required />
              </Field>
              <Field label="Date de demande" required>
                <FormInput type="date" value={form.dateDemande} onChange={e => setForm(f => ({ ...f, dateDemande: e.target.value }))} required />
              </Field>
            </FormRow>
            <Field label="Observations">
              <textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Notes…" style={{ width: '100%', minHeight: 70, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setShowForm(false)} loading={saving} submitLabel="Créer le transfert" />
          </form>
        </Modal>
      )}

      {/* Modale Facture — saisie du prix unitaire */}
      {factureModal && (
        <Modal
          title="Générer la Facture"
          subtitle={`Transfert ${factureModal.codeTransfert} · ${factureModal.generationTransferee || ''} · ${Number(factureModal.quantite || 0).toLocaleString('fr-FR')} kg`}
          onClose={() => setFactureModal(null)}
          size="sm"
        >
          {/* Récap vendeur / acheteur */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: 3 }}>Vendeur</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{factureModal.usernameEmetteur || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ROLE_LABELS[factureModal.roleEmetteur || guessRoleFromGen(factureModal.generationTransferee || '', 'emetteur')] || '—'}</div>
            </div>
            <div style={{ flex: 1, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 3 }}>Acheteur</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{factureModal.usernameDestinataire || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ROLE_LABELS[factureModal.roleDestinataire || guessRoleFromGen(factureModal.generationTransferee || '', 'dest')] || '—'}</div>
            </div>
          </div>

          <form onSubmit={submitFacture}>
            <FormRow>
              <Field label="Prix unitaire (FCFA / kg)" required hint="Ex : 350 pour G1, 150 pour G3">
                <FormInput
                  type="number"
                  value={facturePrix}
                  onChange={e => setFacturePrix(e.target.value)}
                  placeholder="350"
                  min="0"
                  step="1"
                  required
                  autoFocus
                />
              </Field>
              <Field label="TVA (%)" hint="0 si exonéré, 18 sinon">
                <FormSelect value={factureTva} onChange={e => setFactureTva(e.target.value)}>
                  <option value="0">Exonéré (0 %)</option>
                  <option value="18">TVA 18 %</option>
                </FormSelect>
              </Field>
            </FormRow>

            {/* Aperçu calcul */}
            {facturePrix && Number(facturePrix) > 0 && (
              <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', marginBottom: 8 }}>Aperçu facture</div>
                {(() => {
                  const ht  = Number(factureModal.quantite || 0) * Number(facturePrix)
                  const tva = Number(factureTva) > 0 ? Math.round(ht * Number(factureTva) / 100) : 0
                  const ttc = ht + tva
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Quantité</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{Number(factureModal.quantite || 0).toLocaleString('fr-FR')} kg</span>
                      <span style={{ color: 'var(--text-muted)' }}>Prix unitaire</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{Number(facturePrix).toLocaleString('fr-FR')} FCFA/kg</span>
                      <span style={{ color: 'var(--text-muted)' }}>Total HT</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{ht.toLocaleString('fr-FR')} FCFA</span>
                      {tva > 0 && <><span style={{ color: 'var(--text-muted)' }}>TVA {factureTva} %</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{tva.toLocaleString('fr-FR')} FCFA</span></>}
                      <span style={{ color: '#b91c1c', fontWeight: 700, borderTop: '1px solid #fca5a5', paddingTop: 4 }}>TOTAL TTC</span>
                      <span style={{ color: '#b91c1c', fontWeight: 700, textAlign: 'right', borderTop: '1px solid #fca5a5', paddingTop: 4 }}>{ttc.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )
                })()}
              </div>
            )}

            <Field label="Conditions de paiement" hint="Laisser vide pour la valeur par défaut">
              <FormInput
                value={factureConditions}
                onChange={e => setFactureConditions(e.target.value)}
                placeholder="Paiement à 30 jours — Virement ISRA/CNRA"
              />
            </Field>

            <FormActions onCancel={() => setFactureModal(null)} loading={false} submitLabel="Voir la Facture PDF" />
          </form>
        </Modal>
      )}

    </div>
  )
}
