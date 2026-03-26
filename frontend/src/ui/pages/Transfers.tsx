import React, { useEffect, useState } from 'react'
import {
  ArrowRightLeft, Plus, RefreshCw, Search, X, Eye,
  Send, CheckCircle2, Truck, Package, Clock
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Pagination } from '../components/Pagination'

interface Props { roleKey: string }
const PAGE_SIZE = 10

/* ── Règles métier : générations autorisées et destination fixe par rôle ── */
const TRANSFER_RULES: Record<string, { allowedGens: string[]; source: string; destination: string; destRole: string }> = {
  'seed-selector':      { allowedGens: ['G1'],       source: 'ISRA/CNRA',      destination: 'UPSemCL',       destRole: 'UPSemCL' },
  'seed-upseml':        { allowedGens: ['G3'],        source: 'UPSemCL',        destination: 'Multiplicateur', destRole: 'Multiplicateur' },
  'seed-multiplicator': { allowedGens: ['R1', 'R2'],  source: 'Multiplicateur', destination: 'Quotataire/OP',  destRole: 'Quotataire/OP' },
}

const STATUT_TRANSFERT = [
  { value: 'DEMANDE', label: 'Demandé' },
  { value: 'VALIDE', label: 'Validé' },
  { value: 'EXPEDIE', label: 'Expédié' },
  { value: 'RECEPTIONNE', label: 'Réceptionné' },
  { value: 'ANNULE', label: 'Annulé' },
]

export function Transfers({ roleKey }: Props) {
  const [transfers, setTransfers] = useState<any[]>([])
  const [lots, setLots] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const canCreate = ['seed-admin', 'seed-selector', 'seed-upseml', 'seed-multiplicator'].includes(roleKey)
  const canValidate = ['seed-admin', 'seed-upseml'].includes(roleKey)
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

  async function fetchAll() {
    setLoading(true)
    const [tRes, lRes] = await Promise.allSettled([
      api.get(endpoints.transfers),
      api.get(endpoints.lots),
    ])
    setTransfers(tRes.status === 'fulfilled' ? tRes.value.data : [])
    setLots(lRes.status === 'fulfilled' ? lRes.value.data : [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = transfers.filter(t => {
    const matchSearch = !search ||
      t.codeTransfert?.toLowerCase().includes(search.toLowerCase()) ||
      String(t.idLot).includes(search)
    const matchStatus = !filterStatus || t.statutTransfert === filterStatus
    return matchSearch && matchStatus
  })

  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Stats
  const byStatus = transfers.reduce((acc: Record<string, number>, t: any) => {
    acc[t.statutTransfert] = (acc[t.statutTransfert] || 0) + 1; return acc
  }, {})

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.transfers, {
        codeTransfert: form.codeTransfert,
        idLot: Number(form.idLot),
        organisationSource: form.organisationSource || undefined,
        organisationDestination: form.organisationDestination || undefined,
        siteSource: form.siteSource || undefined,
        siteDestination: form.siteDestination || undefined,
        quantiteTransferee: Number(form.quantiteTransferee),
        dateDemande: form.dateDemande,
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

  async function updateStatus(id: number, newStatus: string) {
    try {
      await api.patch(endpoints.transferById(id), { statutTransfert: newStatus })
      setToast({ msg: `Transfert mis à jour : ${newStatus}`, type: 'success' })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur de mise à jour', type: 'error' })
    }
  }

  function getLotLabel(idLot: number): string {
    const lot = lots.find((l: any) => l.id === idLot)
    return lot ? lot.codeLot : `#${idLot}`
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><ArrowRightLeft size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : transfers.length}</div><div className="stat-label">Total transferts</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['DEMANDE'] || 0}</div><div className="stat-label">En attente</div></div></div>
        <div className="stat-card"><div className="stat-icon violet"><Truck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['EXPEDIE'] || 0}</div><div className="stat-label">En transit</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : byStatus['RECEPTIONNE'] || 0}</div><div className="stat-label">Réceptionnés</div></div></div>
      </div>

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
            {canCreate && <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Nouveau transfert</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Code transfert, lot…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 200 }} />
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
          {(search || filterStatus) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilterStatus(''); setCurrentPage(1) }}><X size={12} /> Effacer</button>}
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr><th>Code</th><th>Lot</th><th>Source → Destination</th><th>Quantité</th><th>Demande</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? [0, 1, 2, 3].map(i => <tr key={i}><td colSpan={7}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                pageItems.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon"><ArrowRightLeft size={20} /></div><div className="empty-title">{search || filterStatus ? 'Aucun résultat' : 'Aucun transfert'}</div>{canCreate && !search && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>+ Nouveau transfert</button>}</div></td></tr>
                ) : pageItems.map((t: any) => (
                  <tr key={t.id}>
                    <td><span className="td-mono" style={{ fontWeight: 700 }}>{t.codeTransfert}</span></td>
                    <td><span className="td-mono">{getLotLabel(t.idLot)}</span></td>
                    <td style={{ fontSize: 12.5 }}>
                      <span style={{ fontWeight: 500 }}>{t.organisationSource || t.siteSource || '—'}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                      <span style={{ fontWeight: 500 }}>{t.organisationDestination || t.siteDestination || '—'}</span>
                    </td>
                    <td><span style={{ fontWeight: 700 }}>{Number(t.quantiteTransferee).toLocaleString('fr-FR')}</span> <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>kg</span></td>
                    <td style={{ fontSize: 12.5 }}>{t.dateDemande ? new Date(t.dateDemande).toLocaleDateString('fr-FR') : '—'}</td>
                    <td><StatusBadge status={t.statutTransfert} showIcon /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11 }} onClick={() => setShowDetail(t)}><Eye size={12} /></button>
                        {canValidate && t.statutTransfert === 'DEMANDE' && (
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11, color: '#1d4ed8' }} onClick={() => updateStatus(t.id, 'VALIDE')} title="Valider"><CheckCircle2 size={12} /></button>
                        )}
                        {canValidate && t.statutTransfert === 'VALIDE' && (
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11, color: '#6d28d9' }} onClick={() => updateStatus(t.id, 'EXPEDIE')} title="Marquer expédié"><Truck size={12} /></button>
                        )}
                        {canValidate && t.statutTransfert === 'EXPEDIE' && (
                          <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11, color: '#15803d' }} onClick={() => updateStatus(t.id, 'RECEPTIONNE')} title="Confirmer réception"><Package size={12} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <Modal title={`Transfert — ${showDetail.codeTransfert}`} subtitle={`Lot : ${getLotLabel(showDetail.idLot)}`} onClose={() => setShowDetail(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Organisation source</div><div style={{ fontSize: 13, fontWeight: 500 }}>{showDetail.organisationSource || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Organisation destination</div><div style={{ fontSize: 13, fontWeight: 500 }}>{showDetail.organisationDestination || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Site source</div><div style={{ fontSize: 13 }}>{showDetail.siteSource || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Site destination</div><div style={{ fontSize: 13 }}>{showDetail.siteDestination || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Quantité transférée</div><div style={{ fontSize: 20, fontWeight: 700 }}>{Number(showDetail.quantiteTransferee).toLocaleString('fr-FR')} kg</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Statut</div><StatusBadge status={showDetail.statutTransfert} showIcon size="md" /></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date demande</div><div style={{ fontSize: 13 }}>{showDetail.dateDemande || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date validation</div><div style={{ fontSize: 13 }}>{showDetail.dateValidation || '—'}</div></div>
            <div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Date réception</div><div style={{ fontSize: 13 }}>{showDetail.dateReception || '—'}</div></div>
            {showDetail.observations && (
              <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Observations</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{showDetail.observations}</div></div>
            )}
          </div>
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
              <textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Notes…" style={{ width: '100%', minHeight: 70, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setShowForm(false)} loading={saving} submitLabel="Créer le transfert" />
          </form>
        </Modal>
      )}
    </div>
  )
}
