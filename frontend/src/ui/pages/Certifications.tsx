import React, { useEffect, useState } from 'react'
import {
  Shield, ShieldCheck, ShieldX, ShieldAlert,
  RefreshCw, Search, X, Eye, FileText, Upload,
  CheckCircle2, Clock, AlertCircle, Ban, ExternalLink,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, Toast } from '../components/Modal'

interface Props { roleKey: string }

// ── Types ──────────────────────────────────────────────────────────
type StatutCert = 'SANS_CERTIFICAT' | 'EN_ATTENTE' | 'CERTIFIE' | 'REJETE'

interface Lot {
  id: number
  codeLot: string
  statutCertification: StatutCert
  certificatPath: string | null
  approbateurUsername: string | null
  dateApprobation: string | null
  motifRejetCert: string | null
  generation?: { codeGeneration: string }
  codeEspece?: string
  quantiteNette?: number
  unite?: string
  dateProduction?: string
  usernameCreateur?: string
  responsableNom?: string
}

// ── Palette feu tricolore ──────────────────────────────────────────
const STATUT_META: Record<StatutCert, {
  label: string; bg: string; color: string; border: string; Icon: React.ElementType
}> = {
  SANS_CERTIFICAT: { label: 'Sans certificat', bg: '#fef2f2', color: '#EF4444', border: '#fecaca', Icon: Ban },
  EN_ATTENTE:      { label: 'En attente',       bg: '#fefce8', color: '#CA8A04', border: '#fde047', Icon: Clock },
  CERTIFIE:        { label: 'Certifié',          bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', Icon: ShieldCheck },
  REJETE:          { label: 'Rejeté',            bg: '#fef2f2', color: '#EF4444', border: '#fecaca', Icon: ShieldX },
}

// ── Badge feu tricolore ────────────────────────────────────────────
function CertBadge({ statut, size = 'sm' }: { statut: StatutCert; size?: 'sm' | 'md' }) {
  const m  = STATUT_META[statut]
  const Icon = m.Icon
  const px = size === 'md' ? '10px 16px' : '4px 10px'
  const fs = size === 'md' ? 13 : 11
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: px, fontSize: fs, fontWeight: 700, borderRadius: 20,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      whiteSpace: 'nowrap',
    }}>
      <Icon size={size === 'md' ? 13 : 11} />
      {m.label}
    </span>
  )
}

// ── Indicateur feu tricolore (point coloré) ───────────────────────
function TrafficLight({ statut }: { statut: StatutCert }) {
  const colors: Record<StatutCert, string> = {
    SANS_CERTIFICAT: '#EF4444',
    EN_ATTENTE:      '#EAB308',
    CERTIFIE:        '#16a34a',
    REJETE:          '#EF4444',
  }
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: colors[statut], flexShrink: 0,
      boxShadow: `0 0 0 2px ${colors[statut]}33`,
    }} />
  )
}

// ── Retour UPSemCL — feedback affiché au multiplicateur ───────────
function RetourUPSemCL({ lot }: { lot: Lot }) {
  if (lot.statutCertification === 'EN_ATTENTE') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#EAB308', fontStyle: 'italic' }}>
        <Clock size={12} style={{ flexShrink: 0 }} />
        En cours d'examen…
      </div>
    )
  }
  if (lot.statutCertification === 'CERTIFIE' && lot.approbateurUsername) {
    return (
      <div style={{ fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 600 }}>
          <CheckCircle2 size={12} />
          {lot.approbateurUsername}
        </div>
        {lot.dateApprobation && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {new Date(lot.dateApprobation).toLocaleDateString('fr-FR')}
          </div>
        )}
      </div>
    )
  }
  if (lot.statutCertification === 'REJETE') {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', maxWidth: 230 }}>
        {lot.approbateurUsername && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', marginBottom: 3 }}>
            {lot.approbateurUsername}
            {lot.dateApprobation && ` · ${new Date(lot.dateApprobation).toLocaleDateString('fr-FR')}`}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#b91c1c', lineHeight: 1.4, overflow: 'hidden', maxHeight: '4.2em' }}>
          {lot.motifRejetCert || 'Certificat non conforme'}
        </div>
      </div>
    )
  }
  return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
}

const PAGE_SIZE = 12
const TABS: { id: StatutCert | 'TOUS'; label: string }[] = [
  { id: 'TOUS',            label: 'Tous' },
  { id: 'EN_ATTENTE',      label: 'En attente' },
  { id: 'CERTIFIE',        label: 'Certifiés' },
  { id: 'REJETE',          label: 'Rejetés' },
  { id: 'SANS_CERTIFICAT', label: 'Sans certificat' },
]

export function Certifications({ roleKey }: Props) {
  const isReviewer   = roleKey === 'seed-admin' || roleKey === 'seed-upsemcl'
  const isMultiplicator = roleKey === 'seed-multiplicator'

  const [lots,          setLots]          = useState<Lot[]>([])
  const [search,        setSearch]        = useState('')
  const [activeTab,     setActiveTab]     = useState<StatutCert | 'TOUS'>('TOUS')
  const [loading,       setLoading]       = useState(true)
  const [fetchError,    setFetchError]    = useState<string | null>(null)
  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [currentPage,   setCurrentPage]   = useState(1)
  const [uploadingId,   setUploadingId]   = useState<number | null>(null)
  const [openingId,     setOpeningId]     = useState<number | null>(null)
  const [detail,        setDetail]        = useState<Lot | null>(null)
  const [rejectTarget,  setRejectTarget]  = useState<Lot | null>(null)
  const [rejectMotif,   setRejectMotif]   = useState('')
  const [saving,        setSaving]        = useState(false)

  async function fetchLots() {
    setLoading(true)
    setFetchError(null)
    try {
      const url = isReviewer
        ? endpoints.lotsCertifiables
        : endpoints.lotsMultCertif
      const res = await api.get(url)
      const data: Lot[] = res.data || []
      setLots(data)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 500 || status === undefined) {
        setFetchError('Le service est en cours de démarrage ou la migration base de données est en cours. Réessayez dans quelques secondes.')
      } else if (status === 403) {
        setFetchError("Vous n'avez pas les droits pour accéder à cette ressource.")
      } else {
        setFetchError('Erreur lors du chargement des lots.')
      }
      setLots([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLots() }, [])

  // ── Stats KPI ──────────────────────────────────────────────────
  const statsCounts = {
    SANS_CERTIFICAT: lots.filter(l => l.statutCertification === 'SANS_CERTIFICAT').length,
    EN_ATTENTE:      lots.filter(l => l.statutCertification === 'EN_ATTENTE').length,
    CERTIFIE:        lots.filter(l => l.statutCertification === 'CERTIFIE').length,
    REJETE:          lots.filter(l => l.statutCertification === 'REJETE').length,
  }

  // ── Filtre + pagination ────────────────────────────────────────
  const filtered = lots.filter(l => {
    const matchTab = activeTab === 'TOUS' || l.statutCertification === activeTab
    const matchSearch = !search || [l.codeLot, l.codeEspece, l.responsableNom, l.usernameCreateur]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    return matchTab && matchSearch
  })
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function goTab(tab: StatutCert | 'TOUS') { setActiveTab(tab); setCurrentPage(1) }

  // ── Upload certificat (multiplicateur) ────────────────────────
  async function handleUpload(lot: Lot, file: File) {
    setUploadingId(lot.id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(endpoints.lotCertificatUpload(lot.id), fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setToast({ msg: `Certificat soumis pour ${lot.codeLot} — en attente de validation`, type: 'success' })
      fetchLots()
    } catch {
      setToast({ msg: "Erreur lors de l'envoi du certificat", type: 'error' })
    } finally {
      setUploadingId(null)
    }
  }

  // ── Approuver (UPSemCL / Admin) ───────────────────────────────
  async function handleApprouver(lot: Lot) {
    setSaving(true)
    try {
      await api.patch(endpoints.lotCertifier(lot.id))
      setToast({ msg: `Lot ${lot.codeLot} certifié avec succès`, type: 'success' })
      fetchLots()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la certification', type: 'error' })
    } finally { setSaving(false) }
  }

  // ── Rejeter (UPSemCL / Admin) ─────────────────────────────────
  async function handleRejeter() {
    if (!rejectTarget || !rejectMotif.trim()) return
    setSaving(true)
    try {
      await api.patch(endpoints.lotRejeterCert(rejectTarget.id), { motif: rejectMotif.trim() })
      setToast({ msg: `Certification de ${rejectTarget.codeLot} rejetée`, type: 'success' })
      setRejectTarget(null)
      setRejectMotif('')
      fetchLots()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors du rejet', type: 'error' })
    } finally { setSaving(false) }
  }

  async function openCertificat(lot: Lot) {
    setOpeningId(lot.id)
    try {
      const res = await api.get(endpoints.lotCertificatUrl(lot.id), { responseType: 'blob' })
      const ext = lot.certificatPath?.split('.').pop()?.toLowerCase() || 'pdf'
      const mime = ext === 'pdf' ? 'application/pdf'
        : ext === 'png' ? 'image/png'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg'
      const blob = new Blob([res.data], { type: mime })
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // révoquer après 2 min pour éviter les fuites mémoire
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch {
      setToast({ msg: 'Impossible d\'ouvrir le certificat', type: 'error' })
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Bannière lots rejetés (multiplicateur uniquement) ── */}
      {isMultiplicator && !loading && statsCounts.REJETE > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 10, padding: '12px 18px', marginBottom: 16,
          fontSize: 13, color: '#b91c1c',
        }}>
          <ShieldX size={16} color="#EF4444" style={{ flexShrink: 0 }} />
          <div>
            <strong>{statsCounts.REJETE} lot{statsCounts.REJETE > 1 ? 's' : ''}</strong>
            {statsCounts.REJETE > 1 ? ' ont été rejetés' : ' a été rejeté'} par l'UPSemCL.
            {' '}Consultez le motif dans le tableau et soumettez un certificat corrigé.
          </div>
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', height: 28, fontSize: 12, padding: '0 12px', borderColor: '#fecaca', color: '#EF4444', whiteSpace: 'nowrap' }}
            onClick={() => goTab('REJETE')}
          >
            Voir les rejetés
          </button>
        </div>
      )}

      {/* ── Bannière d'erreur service ── */}
      {fetchError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, padding: '12px 18px', marginBottom: 16,
          fontSize: 13, color: '#92400e',
        }}>
          <ShieldAlert size={16} color="#EAB308" style={{ flexShrink: 0 }} />
          <span>{fetchError}</span>
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 'auto', height: 28, fontSize: 12, padding: '0 12px' }}
            onClick={fetchLots}
          >
            <RefreshCw size={12} /> Réessayer
          </button>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {([
          { key: 'EN_ATTENTE',      icon: Clock,         label: 'En attente',       bgVar: '#fefce8', colorVar: '#CA8A04' },
          { key: 'CERTIFIE',        icon: ShieldCheck,   label: 'Certifiés',        bgVar: '#f0fdf4', colorVar: '#16a34a' },
          { key: 'REJETE',          icon: ShieldX,       label: 'Rejetés',          bgVar: '#fef2f2', colorVar: '#EF4444' },
          { key: 'SANS_CERTIFICAT', icon: AlertCircle,   label: 'Sans certificat',  bgVar: '#fef2f2', colorVar: '#EF4444' },
        ] as const).map(({ key, icon: Icon, label, bgVar, colorVar }) => (
          <button
            key={key}
            onClick={() => goTab(key as StatutCert)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: activeTab === key ? bgVar : 'var(--surface)',
              border: `1px solid ${activeTab === key ? STATUT_META[key as StatutCert].border : 'var(--border)'}`,
              borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
              transition: 'all 0.15s', textAlign: 'left', width: '100%',
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: bgVar, flexShrink: 0,
            }}>
              <Icon size={18} color={colorVar} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: colorVar, lineHeight: 1.1 }}>
                {loading ? '–' : statsCounts[key as StatutCert]}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
            </div>
            {key === 'EN_ATTENTE' && statsCounts.EN_ATTENTE > 0 && (
              <span style={{
                marginLeft: 'auto', minWidth: 22, height: 22, borderRadius: 11,
                background: '#CA8A04', color: '#fff', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 6px',
              }}>
                {statsCounts.EN_ATTENTE}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Card principale ── */}
      <div className="card">

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)', borderRadius: '8px 8px 0 0', overflowX: 'auto',
        }}>
          {TABS.map(tab => {
            const count = tab.id === 'TOUS' ? lots.length : statsCounts[tab.id as StatutCert]
            const active = activeTab === tab.id
            const m = tab.id !== 'TOUS' ? STATUT_META[tab.id as StatutCert] : null
            return (
              <button
                key={tab.id}
                onClick={() => goTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '11px 18px', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? (m ? m.color : 'var(--text-primary)') : 'var(--text-muted)',
                  border: 'none',
                  borderBottom: active
                    ? `2px solid ${m ? m.color : 'var(--green-600)'}`
                    : '2px solid transparent',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px',
                    background: active ? (m ? m.bg : 'var(--surface-2)') : 'var(--surface-2)',
                    color: active ? (m ? m.color : 'var(--text-secondary)') : 'var(--text-muted)',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${active && m ? m.border : 'var(--border)'}`,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {/* Refresh */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 12 }}>
            <button
              className="btn btn-secondary btn-icon"
              style={{ width: 30, height: 30 }}
              onClick={fetchLots}
              title="Actualiser"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              borderRadius: 6, padding: '0 11px', height: 34,
            }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                placeholder="Code lot, espèce, multiplicateur…"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                style={{
                  border: 'none', background: 'none', outline: 'none',
                  fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 240,
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {filtered.length} lot{filtered.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>Code lot</th>
                <th>Génération</th>
                <th>Espèce</th>
                {isReviewer ? <th>Multiplicateur</th> : <th>Retour UPSemCL</th>}
                <th>Quantité</th>
                <th>Statut certification</th>
                <th>Certificat</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [0,1,2,3,4].map(i => (
                  <tr key={i}>
                    <td colSpan={9}>
                      <div className="skeleton" style={{ height: 14, borderRadius: 4 }} />
                    </td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-icon"><Shield size={22} /></div>
                      <div className="empty-title">
                        {activeTab === 'EN_ATTENTE'
                          ? 'Aucun lot en attente de certification'
                          : activeTab === 'CERTIFIE'
                          ? 'Aucun lot certifié'
                          : 'Aucun lot trouvé'}
                      </div>
                      <div className="empty-sub">
                        {activeTab === 'EN_ATTENTE'
                          ? 'Les lots dont le multiplicateur a soumis un certificat apparaîtront ici.'
                          : 'Ajustez les filtres ou actualisez la liste.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : pageItems.map((lot) => {
                const meta = STATUT_META[lot.statutCertification]
                const gen  = lot.generation?.codeGeneration || '—'
                const canUpload = isMultiplicator &&
                  (lot.statutCertification === 'SANS_CERTIFICAT' || lot.statutCertification === 'REJETE')
                const canApprove = isReviewer && lot.statutCertification === 'EN_ATTENTE'
                const canReject  = isReviewer && lot.statutCertification === 'EN_ATTENTE'

                return (
                  <tr key={lot.id}>
                    <td>
                      <TrafficLight statut={lot.statutCertification} />
                    </td>
                    <td>
                      <span className="td-mono" style={{ fontWeight: 700 }}>{lot.codeLot}</span>
                    </td>
                    <td>
                      <span className="badge badge-blue" style={{ fontSize: 11 }}>{gen}</span>
                    </td>
                    <td style={{ fontSize: 12.5, fontWeight: 500 }}>
                      {lot.codeEspece || '—'}
                    </td>
                    {isReviewer ? (
                      <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        {lot.responsableNom || lot.usernameCreateur || '—'}
                      </td>
                    ) : (
                      <td style={{ verticalAlign: 'middle', paddingTop: 6, paddingBottom: 6 }}>
                        <RetourUPSemCL lot={lot} />
                      </td>
                    )}
                    <td style={{ fontSize: 12.5 }}>
                      {lot.quantiteNette != null
                        ? `${Number(lot.quantiteNette).toLocaleString('fr-FR')} ${lot.unite || 'kg'}`
                        : '—'}
                    </td>
                    <td>
                      <CertBadge statut={lot.statutCertification} />
                    </td>

                    {/* Colonne certificat */}
                    <td>
                      {lot.certificatPath ? (
                        <button
                          className="btn btn-ghost"
                          onClick={() => openCertificat(lot)}
                          disabled={openingId === lot.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11.5, color: 'var(--green-600)', fontWeight: 600,
                            height: 26, padding: '0 8px',
                          }}
                          title="Voir le certificat"
                        >
                          <FileText size={13} /> {openingId === lot.id ? '…' : 'Voir'}
                          {openingId !== lot.id && <ExternalLink size={10} />}
                        </button>
                      ) : canUpload ? (
                        <label style={{ cursor: 'pointer' }}>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            disabled={uploadingId === lot.id}
                            onChange={e => { if (e.target.files?.[0]) handleUpload(lot, e.target.files[0]) }}
                          />
                          <span
                            className="btn btn-ghost"
                            style={{
                              height: 26, padding: '0 9px', fontSize: 11,
                              color: lot.statutCertification === 'REJETE' ? '#EAB308' : 'var(--text-muted)',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              border: `1px solid ${lot.statutCertification === 'REJETE' ? '#fde68a' : 'var(--border)'}`,
                            }}
                            title={lot.statutCertification === 'REJETE' ? 'Soumettre un nouveau certificat' : 'Uploader le certificat'}
                          >
                            {uploadingId === lot.id ? '…' : <><Upload size={11} /> {lot.statutCertification === 'REJETE' ? 'Resoumettre' : 'Uploader'}</>}
                          </span>
                        </label>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                          title="Détail"
                          onClick={() => setDetail(lot)}
                        >
                          <Eye size={12} />
                        </button>

                        {canApprove && (
                          <button
                            className="btn btn-ghost"
                            disabled={saving}
                            onClick={() => handleApprouver(lot)}
                            style={{
                              height: 26, padding: '0 9px', fontSize: 11,
                              color: '#16a34a', border: '1px solid #bbf7d0',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                            title="Approuver la certification"
                          >
                            <CheckCircle2 size={12} /> Approuver
                          </button>
                        )}

                        {canReject && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => { setRejectTarget(lot); setRejectMotif('') }}
                            style={{
                              height: 26, padding: '0 9px', fontSize: 11,
                              color: '#EF4444', border: '1px solid #fecaca',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                            title="Rejeter la certification"
                          >
                            <ShieldX size={12} /> Rejeter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)',
          }}>
            <button
              className="btn btn-secondary"
              style={{ height: 28, padding: '0 10px', fontSize: 12 }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              ‹ Précédent
            </button>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-secondary"
              style={{ height: 28, padding: '0 10px', fontSize: 12 }}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Suivant ›
            </button>
          </div>
        )}
      </div>

      {/* ── Modal détail ── */}
      {detail && (
        <Modal
          title={`Lot ${detail.codeLot}`}
          subtitle={`Génération ${detail.generation?.codeGeneration || '?'} — ${detail.codeEspece || '?'}`}
          onClose={() => setDetail(null)}
        >
          {/* Statut feu tricolore */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
            padding: '14px 18px', borderRadius: 10,
            background: STATUT_META[detail.statutCertification].bg,
            border: `1px solid ${STATUT_META[detail.statutCertification].border}`,
          }}>
            <TrafficLight statut={detail.statutCertification} />
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                Statut certification
              </div>
              <CertBadge statut={detail.statutCertification} size="md" />
            </div>
            {detail.approbateurUsername && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Par</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{detail.approbateurUsername}</div>
                {detail.dateApprobation && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(detail.dateApprobation).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grille info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            {[
              { label: 'Code lot',      val: detail.codeLot },
              { label: 'Génération',    val: detail.generation?.codeGeneration },
              { label: 'Espèce',        val: detail.codeEspece },
              { label: 'Quantité',      val: detail.quantiteNette ? `${Number(detail.quantiteNette).toLocaleString('fr-FR')} ${detail.unite || 'kg'}` : undefined },
              { label: 'Date prod.',    val: detail.dateProduction },
              { label: 'Multiplicateur',val: detail.responsableNom || detail.usernameCreateur },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{val || '—'}</div>
              </div>
            ))}
          </div>

          {/* Motif de rejet */}
          {detail.motifRejetCert && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', marginBottom: 4 }}>
                Motif de rejet
              </div>
              <div style={{ fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>{detail.motifRejetCert}</div>
            </div>
          )}

          {/* Certificat */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Document certificat
            </div>
            {detail.certificatPath ? (
              <button
                className="btn btn-secondary"
                onClick={() => openCertificat(detail)}
                disabled={openingId === detail.id}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <FileText size={14} />
                {openingId === detail.id ? 'Chargement…' : 'Ouvrir le certificat'}
                {openingId !== detail.id && <ExternalLink size={12} />}
              </button>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun document uploadé</span>
            )}
          </div>

          {/* Actions depuis le modal (reviewer) */}
          {isReviewer && detail.statutCertification === 'EN_ATTENTE' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={async () => { await handleApprouver(detail); setDetail(null) }}
                style={{ flex: 1, gap: 6, background: '#16a34a', borderColor: '#16a34a' }}
              >
                <CheckCircle2 size={14} /> Approuver la certification
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setRejectTarget(detail); setDetail(null) }}
                style={{ flex: 1, gap: 6, color: '#EF4444', borderColor: '#fecaca' }}
              >
                <ShieldX size={14} /> Rejeter
              </button>
            </div>
          )}

          {/* Upload depuis le modal (multiplicateur) */}
          {isMultiplicator && (detail.statutCertification === 'SANS_CERTIFICAT' || detail.statutCertification === 'REJETE') && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  style={{ display: 'none' }}
                  disabled={uploadingId === detail.id}
                  onChange={e => {
                    if (e.target.files?.[0]) {
                      handleUpload(detail, e.target.files[0])
                      setDetail(null)
                    }
                  }}
                />
                <span className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Upload size={14} />
                  {uploadingId === detail.id ? 'Envoi en cours…' : 'Soumettre le certificat (PDF / image)'}
                </span>
              </label>
              {detail.statutCertification === 'REJETE' && (
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  Un nouveau document remplacera le précédent et remettra le lot en statut «&nbsp;En attente&nbsp;».
                </p>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── Modal rejet ── */}
      {rejectTarget && (
        <Modal
          title="Rejeter la certification"
          subtitle={`Lot ${rejectTarget.codeLot} — ${rejectTarget.generation?.codeGeneration || '?'} / ${rejectTarget.codeEspece || '?'}`}
          onClose={() => { setRejectTarget(null); setRejectMotif('') }}
        >
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13,
            color: '#b91c1c',
          }}>
            <ShieldAlert size={14} style={{ display: 'inline', marginRight: 6 }} />
            Le multiplicateur recevra un refus et devra soumettre un nouveau certificat.
          </div>
          <form onSubmit={e => { e.preventDefault(); handleRejeter() }}>
            <Field label="Motif de rejet *">
              <textarea
                value={rejectMotif}
                onChange={e => setRejectMotif(e.target.value)}
                placeholder="Expliquer pourquoi le certificat est refusé (non-conformité, document illisible, date expirée…)"
                required
                style={{
                  width: '100%', minHeight: 90, padding: '8px 11px',
                  border: '1px solid var(--border-strong)', borderRadius: 6,
                  fontSize: 13, fontFamily: 'Outfit, sans-serif',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setRejectTarget(null); setRejectMotif('') }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || !rejectMotif.trim()}
                style={{ background: '#EF4444', borderColor: '#EF4444' }}
              >
                {saving ? 'Enregistrement…' : 'Confirmer le rejet'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
