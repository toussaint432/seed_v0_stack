import React, { useEffect, useState } from 'react'
import {
  Shield, Plus, RefreshCw, Search, X,
  CheckCircle2, Clock, FileText, Eye,
  FlaskConical, Upload
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Pagination } from '../components/Pagination'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface Props { roleKey: string }

const PAGE_SIZE = 10

const RESULT_OPTIONS = [
  { value: 'CONFORME', label: 'Conforme' },
  { value: 'NON_CONFORME', label: 'Non conforme' },
]

const CERT_RESULT_OPTIONS = [
  { value: 'CERTIFIE', label: 'Certifié' },
  { value: 'REJETE', label: 'Rejeté' },
  { value: 'EN_COURS', label: 'En cours' },
]

const CONTROL_TYPES = [
  { value: 'LABORATOIRE', label: 'Laboratoire' },
  { value: 'CHAMP', label: 'Champ' },
  { value: 'POST_RECOLTE', label: 'Post-récolte' },
  { value: 'PRE_CERTIFICATION', label: 'Pré-certification' },
]

export function Certifications({ roleKey }: Props) {
  const [activeTab, setActiveTab] = useState<'controls' | 'certifications'>('controls')
  const [controls, setControls] = useState<any[]>([])
  const [certifications, setCertifications] = useState<any[]>([])
  const [lots, setLots] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterResult, setFilterResult] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Forms
  const [showControlForm, setShowControlForm] = useState(false)
  const [showCertForm, setShowCertForm] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number; label: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const canCreate = ['seed-admin', 'seed-upseml'].includes(roleKey)
  const canCertify = ['seed-admin'].includes(roleKey)
  const [uploadingId, setUploadingId] = useState<number | null>(null)

  const [controlForm, setControlForm] = useState({
    idLot: '', typeControle: 'LABORATOIRE', dateControle: new Date().toISOString().split('T')[0],
    tauxGermination: '', tauxHumidite: '', puretePhysique: '', pureteSpecifique: '',
    conformiteVarietale: '', resultat: 'CONFORME', controleur: '', observations: '',
  })

  const [certForm, setCertForm] = useState({
    idLot: '', organismeCertificateur: 'DISEM/ISRA', numeroCertificat: '',
    dateDemande: new Date().toISOString().split('T')[0], dateInspection: '',
    dateCertification: '', resultatCertification: 'EN_COURS', motifRejet: '', dateExpiration: '',
  })

  async function fetchAll() {
    setLoading(true)
    const [ctrlRes, certRes, lotsRes] = await Promise.allSettled([
      api.get(endpoints.controls),
      api.get(endpoints.certifications),
      api.get(endpoints.lots),
    ])
    setControls(ctrlRes.status === 'fulfilled' ? ctrlRes.value.data : [])
    setCertifications(certRes.status === 'fulfilled' ? certRes.value.data : [])
    setLots(lotsRes.status === 'fulfilled' ? lotsRes.value.data : [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // ── Filtres ──
  const filteredControls = controls.filter(c => {
    const matchSearch = !search ||
      c.controleur?.toLowerCase().includes(search.toLowerCase()) ||
      c.typeControle?.toLowerCase().includes(search.toLowerCase()) ||
      String(c.idLot).includes(search)
    const matchResult = !filterResult || c.resultat === filterResult
    return matchSearch && matchResult
  })

  const filteredCerts = certifications.filter(c => {
    const matchSearch = !search ||
      c.numeroCertificat?.toLowerCase().includes(search.toLowerCase()) ||
      c.organismeCertificateur?.toLowerCase().includes(search.toLowerCase()) ||
      String(c.idLot).includes(search)
    const matchResult = !filterResult || c.resultatCertification === filterResult
    return matchSearch && matchResult
  })

  const activeItems = activeTab === 'controls' ? filteredControls : filteredCerts
  const pageItems = activeItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Stats
  const conformeCount = controls.filter(c => c.resultat === 'CONFORME').length
  const certifieCount = certifications.filter(c => c.resultatCertification === 'CERTIFIE').length
  const enCoursCount = certifications.filter(c => c.resultatCertification === 'EN_COURS').length

  // ── Submit ──
  async function submitControl(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.controls, {
        idLot: Number(controlForm.idLot),
        typeControle: controlForm.typeControle,
        dateControle: controlForm.dateControle,
        tauxGermination: controlForm.tauxGermination ? Number(controlForm.tauxGermination) : undefined,
        tauxHumidite: controlForm.tauxHumidite ? Number(controlForm.tauxHumidite) : undefined,
        puretePhysique: controlForm.puretePhysique ? Number(controlForm.puretePhysique) : undefined,
        pureteSpecifique: controlForm.pureteSpecifique ? Number(controlForm.pureteSpecifique) : undefined,
        conformiteVarietale: controlForm.conformiteVarietale || undefined,
        resultat: controlForm.resultat,
        controleur: controlForm.controleur || undefined,
        observations: controlForm.observations || undefined,
      })
      setToast({ msg: 'Contrôle qualité enregistré', type: 'success' })
      setShowControlForm(false)
      resetControlForm()
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la création du contrôle', type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitCert(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.certifications, {
        idLot: Number(certForm.idLot),
        organismeCertificateur: certForm.organismeCertificateur,
        numeroCertificat: certForm.numeroCertificat,
        dateDemande: certForm.dateDemande || undefined,
        dateInspection: certForm.dateInspection || undefined,
        dateCertification: certForm.dateCertification || undefined,
        resultatCertification: certForm.resultatCertification,
        motifRejet: certForm.motifRejet || undefined,
        dateExpiration: certForm.dateExpiration || undefined,
      })
      setToast({ msg: `Certification ${certForm.numeroCertificat} enregistrée`, type: 'success' })
      setShowCertForm(false)
      resetCertForm()
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la certification', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const url = deleteTarget.type === 'control'
        ? endpoints.controlById(deleteTarget.id)
        : endpoints.certificationById(deleteTarget.id)
      await api.delete(url)
      setToast({ msg: `${deleteTarget.label} supprimé`, type: 'success' })
      setDeleteTarget(null)
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur de suppression', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleUpload(certId: number, file: File) {
    setUploadingId(certId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await api.post(endpoints.certificationUpload(certId), formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setToast({ msg: 'Document uploadé avec succès', type: 'success' })
      fetchAll()
    } catch {
      setToast({ msg: "Erreur lors de l'upload du document", type: 'error' })
    } finally {
      setUploadingId(null)
    }
  }

  function resetControlForm() {
    setControlForm({
      idLot: '', typeControle: 'LABORATOIRE', dateControle: new Date().toISOString().split('T')[0],
      tauxGermination: '', tauxHumidite: '', puretePhysique: '', pureteSpecifique: '',
      conformiteVarietale: '', resultat: 'CONFORME', controleur: '', observations: '',
    })
  }

  function resetCertForm() {
    setCertForm({
      idLot: '', organismeCertificateur: 'DISEM/ISRA', numeroCertificat: '',
      dateDemande: new Date().toISOString().split('T')[0], dateInspection: '',
      dateCertification: '', resultatCertification: 'EN_COURS', motifRejet: '', dateExpiration: '',
    })
  }

  function getLotLabel(idLot: number): string {
    const lot = lots.find((l: any) => l.id === idLot)
    return lot ? lot.codeLot : `Lot #${idLot}`
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer cet enregistrement ?"
          message={`Vous êtes sur le point de supprimer "${deleteTarget.label}". Cette action est irréversible.`}
          confirmLabel="Supprimer"
          variant="danger"
          loading={saving}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><FlaskConical size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : controls.length}</div>
            <div className="stat-label">Contrôles qualité</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : conformeCount}</div>
            <div className="stat-label">Conformes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold"><Shield size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : certifieCount}</div>
            <div className="stat-label">Certifiés</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet"><Clock size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : enCoursCount}</div>
            <div className="stat-label">En cours</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)', borderRadius: '8px 8px 0 0',
        }}>
          {[
            { id: 'controls' as const, label: 'Contrôles qualité', icon: FlaskConical, count: controls.length },
            { id: 'certifications' as const, label: 'Certifications', icon: Shield, count: certifications.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setCurrentPage(1); setSearch(''); setFilterResult('') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', fontSize: 13, fontWeight: 600,
                background: activeTab === tab.id ? 'var(--surface)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--green-600)' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              <tab.icon size={14} />
              {tab.label}
              <span className="badge badge-gray" style={{ fontSize: 10 }}>{tab.count}</span>
            </button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16 }}>
            {canCreate && activeTab === 'controls' && (
              <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => setShowControlForm(true)}>
                <Plus size={12} /> Nouveau contrôle
              </button>
            )}
            {canCertify && activeTab === 'certifications' && (
              <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => setShowCertForm(true)}>
                <Plus size={12} /> Nouvelle certification
              </button>
            )}
            <button className="btn btn-secondary btn-icon" style={{ width: 32, height: 32 }} onClick={fetchAll}>
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                placeholder={activeTab === 'controls' ? 'Lot, type, contrôleur…' : 'N° certificat, organisme, lot…'}
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
                style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 220 }}
              />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">Résultat</label>
            <select
              className="input"
              value={filterResult}
              onChange={e => { setFilterResult(e.target.value); setCurrentPage(1) }}
              style={{ width: 150 }}
            >
              <option value="">Tous</option>
              {(activeTab === 'controls' ? RESULT_OPTIONS : CERT_RESULT_OPTIONS).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {(search || filterResult) && (
            <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterResult(''); setCurrentPage(1) }}>
              <X size={12} /> Effacer
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {activeItems.length} résultat{activeItems.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          {activeTab === 'controls' ? (
            <table>
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Germination</th>
                  <th>Humidité</th>
                  <th>Pureté</th>
                  <th>Résultat</th>
                  <th>Contrôleur</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [0, 1, 2, 3].map(i => (
                  <tr key={i}><td colSpan={9}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>
                )) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-icon"><FlaskConical size={20} /></div>
                        <div className="empty-title">{search ? 'Aucun résultat' : 'Aucun contrôle qualité'}</div>
                        <div className="empty-sub">Les contrôles enregistrés apparaîtront ici</div>
                        {canCreate && !search && (
                          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowControlForm(true)}>
                            + Nouveau contrôle
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : pageItems.map((c: any) => (
                  <tr key={c.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{getLotLabel(c.idLot)}</span></td>
                    <td><span className="badge badge-blue" style={{ fontSize: 11 }}>{c.typeControle}</span></td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {c.dateControle ? new Date(c.dateControle).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td><span style={{ fontWeight: 600 }}>{c.tauxGermination != null ? `${c.tauxGermination}%` : '—'}</span></td>
                    <td>{c.tauxHumidite != null ? `${c.tauxHumidite}%` : '—'}</td>
                    <td>{c.puretePhysique != null ? `${c.puretePhysique}%` : '—'}</td>
                    <td><StatusBadge status={c.resultat} showIcon /></td>
                    <td style={{ fontSize: 12.5 }}>{c.controleur || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                          onClick={() => setShowDetail(c)} title="Détail">
                          <Eye size={12} />
                        </button>
                        {canCreate && (
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--red-600)' }}
                            onClick={() => setDeleteTarget({ type: 'control', id: c.id, label: `Contrôle #${c.id}` })} title="Supprimer">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N° Certificat</th>
                  <th>Lot</th>
                  <th>Organisme</th>
                  <th>Demande</th>
                  <th>Certification</th>
                  <th>Expiration</th>
                  <th>Résultat</th>
                  <th>Document</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [0, 1, 2, 3].map(i => (
                  <tr key={i}><td colSpan={9}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>
                )) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-icon"><Shield size={20} /></div>
                        <div className="empty-title">{search ? 'Aucun résultat' : 'Aucune certification'}</div>
                        <div className="empty-sub">Les certifications apparaîtront ici</div>
                        {canCertify && !search && (
                          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowCertForm(true)}>
                            + Nouvelle certification
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : pageItems.map((c: any) => (
                  <tr key={c.id}>
                    <td><span className="td-mono" style={{ fontWeight: 700 }}>{c.numeroCertificat}</span></td>
                    <td><span className="td-mono">{getLotLabel(c.idLot)}</span></td>
                    <td style={{ fontWeight: 500, fontSize: 12.5 }}>{c.organismeCertificateur}</td>
                    <td style={{ fontSize: 12.5 }}>{c.dateDemande ? new Date(c.dateDemande).toLocaleDateString('fr-FR') : '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{c.dateCertification ? new Date(c.dateCertification).toLocaleDateString('fr-FR') : '—'}</td>
                    <td style={{ fontSize: 12.5 }}>
                      {c.dateExpiration ? (
                        <span style={{
                          color: new Date(c.dateExpiration) < new Date() ? 'var(--red-600)' : 'var(--text-secondary)',
                          fontWeight: new Date(c.dateExpiration) < new Date() ? 600 : 400,
                        }}>
                          {new Date(c.dateExpiration).toLocaleDateString('fr-FR')}
                          {new Date(c.dateExpiration) < new Date() && ' ⚠'}
                        </span>
                      ) : '—'}
                    </td>
                    <td><StatusBadge status={c.resultatCertification} showIcon /></td>
                    <td>
                      {c.nomDocument ? (
                        <a
                          href={endpoints.certificationDocument(c.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost"
                          style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--green-600)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title={c.nomDocument}
                        >
                          <FileText size={12} /> PDF
                        </a>
                      ) : canCertify ? (
                        <label style={{ cursor: 'pointer' }}>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            disabled={uploadingId === c.id}
                            onChange={e => { if (e.target.files?.[0]) handleUpload(c.id, e.target.files[0]) }}
                          />
                          <span
                            className="btn btn-ghost"
                            style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Uploader le certificat"
                          >
                            {uploadingId === c.id ? '…' : <Upload size={12} />}
                          </span>
                        </label>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                          onClick={() => setShowDetail(c)} title="Détail">
                          <Eye size={12} />
                        </button>
                        {canCertify && (
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--red-600)' }}
                            onClick={() => setDeleteTarget({ type: 'certification', id: c.id, label: c.numeroCertificat })} title="Supprimer">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={activeItems.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <Modal
          title={showDetail.numeroCertificat ? `Certification — ${showDetail.numeroCertificat}` : `Contrôle qualité #${showDetail.id}`}
          subtitle={`Lot : ${getLotLabel(showDetail.idLot)}`}
          onClose={() => setShowDetail(null)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {showDetail.typeControle && (
              <>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Type</div><div style={{ fontSize: 13, fontWeight: 500 }}>{showDetail.typeControle}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date contrôle</div><div style={{ fontSize: 13 }}>{showDetail.dateControle || '—'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Taux germination</div><div style={{ fontSize: 18, fontWeight: 700 }}>{showDetail.tauxGermination != null ? `${showDetail.tauxGermination}%` : '—'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Taux humidité</div><div style={{ fontSize: 18, fontWeight: 700 }}>{showDetail.tauxHumidite != null ? `${showDetail.tauxHumidite}%` : '—'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Pureté physique</div><div style={{ fontSize: 18, fontWeight: 700 }}>{showDetail.puretePhysique != null ? `${showDetail.puretePhysique}%` : '—'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Résultat</div><StatusBadge status={showDetail.resultat} showIcon size="md" /></div>
                <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Contrôleur</div><div style={{ fontSize: 13 }}>{showDetail.controleur || '—'}</div></div>
              </>
            )}
            {showDetail.numeroCertificat && (
              <>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Organisme</div><div style={{ fontSize: 13, fontWeight: 500 }}>{showDetail.organismeCertificateur}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Résultat</div><StatusBadge status={showDetail.resultatCertification} showIcon size="md" /></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date demande</div><div style={{ fontSize: 13 }}>{showDetail.dateDemande || '—'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date inspection</div><div style={{ fontSize: 13 }}>{showDetail.dateInspection || '—'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date certification</div><div style={{ fontSize: 13 }}>{showDetail.dateCertification || '—'}</div></div>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Expiration</div><div style={{ fontSize: 13 }}>{showDetail.dateExpiration || '—'}</div></div>
                {showDetail.motifRejet && (
                  <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: 4 }}>Motif de rejet</div>
                    <div style={{ fontSize: 13, color: '#dc2626' }}>{showDetail.motifRejet}</div>
                  </div>
                )}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Document certificat</div>
                  {showDetail.nomDocument ? (
                    <a
                      href={endpoints.certificationDocument(showDetail.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--green-600)', fontWeight: 500 }}
                    >
                      <FileText size={14} /> {showDetail.nomDocument}
                    </a>
                  ) : canCertify ? (
                    <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        disabled={uploadingId === showDetail.id}
                        onChange={e => { if (e.target.files?.[0]) { handleUpload(showDetail.id, e.target.files[0]); setShowDetail(null) } }}
                      />
                      <Upload size={14} /> {uploadingId === showDetail.id ? 'Upload en cours…' : 'Uploader le certificat (PDF/image)'}
                    </label>
                  ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun document</span>}
                </div>
              </>
            )}
            {showDetail.observations && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Observations</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{showDetail.observations}</div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* New Control Modal */}
      {showControlForm && (
        <Modal title="Nouveau Contrôle Qualité" subtitle="Enregistrer les résultats d'un contrôle sur un lot" onClose={() => setShowControlForm(false)} size="lg">
          <form onSubmit={submitControl}>
            <FormRow>
              <Field label="Lot" required hint="Sélectionnez le lot à contrôler">
                <FormSelect value={controlForm.idLot} onChange={e => setControlForm(f => ({ ...f, idLot: e.target.value }))} required>
                  <option value="">-- Sélectionner un lot --</option>
                  {lots.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.codeLot} — {l.generation?.codeGeneration || 'N/A'}</option>
                  ))}
                </FormSelect>
              </Field>
              <Field label="Type de contrôle" required>
                <FormSelect value={controlForm.typeControle} onChange={e => setControlForm(f => ({ ...f, typeControle: e.target.value }))}>
                  {CONTROL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Date du contrôle" required>
                <FormInput type="date" value={controlForm.dateControle} onChange={e => setControlForm(f => ({ ...f, dateControle: e.target.value }))} required />
              </Field>
              <Field label="Contrôleur">
                <FormInput value={controlForm.controleur} onChange={e => setControlForm(f => ({ ...f, controleur: e.target.value }))} placeholder="Nom du contrôleur" />
              </Field>
            </FormRow>

            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Résultats d'analyse</div>
              <FormRow>
                <Field label="Taux germination (%)">
                  <FormInput type="number" value={controlForm.tauxGermination} onChange={e => setControlForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" />
                </Field>
                <Field label="Taux humidité (%)">
                  <FormInput type="number" value={controlForm.tauxHumidite} onChange={e => setControlForm(f => ({ ...f, tauxHumidite: e.target.value }))} placeholder="12.0" min="0" max="100" step="0.1" />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Pureté physique (%)">
                  <FormInput type="number" value={controlForm.puretePhysique} onChange={e => setControlForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="99.5" min="0" max="100" step="0.1" />
                </Field>
                <Field label="Pureté spécifique (%)">
                  <FormInput type="number" value={controlForm.pureteSpecifique} onChange={e => setControlForm(f => ({ ...f, pureteSpecifique: e.target.value }))} placeholder="99.0" min="0" max="100" step="0.1" />
                </Field>
              </FormRow>
            </div>

            <FormRow>
              <Field label="Conformité variétale">
                <FormSelect value={controlForm.conformiteVarietale} onChange={e => setControlForm(f => ({ ...f, conformiteVarietale: e.target.value }))}>
                  <option value="">-- Non évalué --</option>
                  <option value="CONFORME">Conforme</option>
                  <option value="NON_CONFORME">Non conforme</option>
                </FormSelect>
              </Field>
              <Field label="Résultat global" required>
                <FormSelect value={controlForm.resultat} onChange={e => setControlForm(f => ({ ...f, resultat: e.target.value }))}>
                  {RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <Field label="Observations">
              <textarea
                value={controlForm.observations}
                onChange={e => setControlForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Notes supplémentaires…"
                style={{ width: '100%', minHeight: 70, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
            </Field>
            <FormActions onCancel={() => setShowControlForm(false)} loading={saving} submitLabel="Enregistrer le contrôle" />
          </form>
        </Modal>
      )}

      {/* New Certification Modal */}
      {showCertForm && (
        <Modal title="Nouvelle Certification" subtitle="Demande de certification officielle d'un lot" onClose={() => setShowCertForm(false)} size="lg">
          <form onSubmit={submitCert}>
            <FormRow>
              <Field label="Lot à certifier" required>
                <FormSelect value={certForm.idLot} onChange={e => setCertForm(f => ({ ...f, idLot: e.target.value }))} required>
                  <option value="">-- Sélectionner un lot --</option>
                  {lots.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.codeLot} — {l.generation?.codeGeneration || 'N/A'}</option>
                  ))}
                </FormSelect>
              </Field>
              <Field label="N° certificat" required hint="Ex: CERT-2026-MIL-001">
                <FormInput value={certForm.numeroCertificat} onChange={e => setCertForm(f => ({ ...f, numeroCertificat: e.target.value.toUpperCase() }))} placeholder="CERT-2026-MIL-001" required />
              </Field>
            </FormRow>
            <Field label="Organisme certificateur" required>
              <FormInput value={certForm.organismeCertificateur} onChange={e => setCertForm(f => ({ ...f, organismeCertificateur: e.target.value }))} placeholder="DISEM/ISRA" required />
            </Field>
            <FormRow>
              <Field label="Date de demande"><FormInput type="date" value={certForm.dateDemande} onChange={e => setCertForm(f => ({ ...f, dateDemande: e.target.value }))} /></Field>
              <Field label="Date d'inspection"><FormInput type="date" value={certForm.dateInspection} onChange={e => setCertForm(f => ({ ...f, dateInspection: e.target.value }))} /></Field>
            </FormRow>
            <FormRow>
              <Field label="Date de certification"><FormInput type="date" value={certForm.dateCertification} onChange={e => setCertForm(f => ({ ...f, dateCertification: e.target.value }))} /></Field>
              <Field label="Date d'expiration"><FormInput type="date" value={certForm.dateExpiration} onChange={e => setCertForm(f => ({ ...f, dateExpiration: e.target.value }))} /></Field>
            </FormRow>
            <Field label="Résultat" required>
              <FormSelect value={certForm.resultatCertification} onChange={e => setCertForm(f => ({ ...f, resultatCertification: e.target.value }))}>
                {CERT_RESULT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </FormSelect>
            </Field>
            {certForm.resultatCertification === 'REJETE' && (
              <Field label="Motif de rejet" required>
                <textarea
                  value={certForm.motifRejet}
                  onChange={e => setCertForm(f => ({ ...f, motifRejet: e.target.value }))}
                  placeholder="Motif détaillé du rejet…"
                  required
                  style={{ width: '100%', minHeight: 70, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </Field>
            )}
            <FormActions onCancel={() => setShowCertForm(false)} loading={saving} submitLabel="Enregistrer la certification" />
          </form>
        </Modal>
      )}
    </div>
  )
}
