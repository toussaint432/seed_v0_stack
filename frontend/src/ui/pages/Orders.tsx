import React, { useEffect, useState } from 'react'
import {
  ShoppingCart, RefreshCw, Plus, Settings2, Clock, XCircle, PackageCheck,
  Search, X, ChevronLeft, ChevronRight, CheckCircle2, Ban, Eye, Building2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  SOUMISE:        { label: 'Soumise',        bg: '#eff6ff', color: '#1d4ed8' },
  ACCEPTEE:       { label: 'Acceptée',       bg: '#f0fdf4', color: '#15803d' },
  CONFIRMEE:      { label: 'Confirmée',      bg: '#f0fdf4', color: '#15803d' },
  EN_PREPARATION: { label: 'En préparation', bg: '#fef9ed', color: '#92660a' },
  LIVREE:         { label: 'Livrée',         bg: '#f0fdf4', color: '#166534' },
  ANNULEE:        { label: 'Annulée',        bg: '#fef2f2', color: '#dc2626' },
  REJETEE:        { label: 'Rejetée',        bg: '#fef2f2', color: '#dc2626' },
  ALLOUEE:        { label: 'Allouée',        bg: '#fdf4ff', color: '#7e22ce' },
  // alias anciens statuts
  PENDING:    { label: 'En attente', bg: '#fef9ed', color: '#92660a' },
  EN_ATTENTE: { label: 'En attente', bg: '#fef9ed', color: '#92660a' },
  CONFIRMED:  { label: 'Confirmée',  bg: '#f0fdf4', color: '#15803d' },
  ALLOCATED:  { label: 'Allouée',    bg: '#fdf4ff', color: '#7e22ce' },
  CANCELLED:  { label: 'Annulée',    bg: '#fef2f2', color: '#dc2626' },
}

const PAGE_SIZE = 10

// ── Pipeline de statuts : SOUMISE → ACCEPTEE → EN_PREPARATION → LIVREE ──
const PIPELINE_STEPS = [
  { key: 'SOUMISE',        label: 'Soumise' },
  { key: 'ACCEPTEE',       label: 'Acceptée' },
  { key: 'EN_PREPARATION', label: 'En préparation' },
  { key: 'LIVREE',         label: 'Livrée' },
]
const PIPELINE_IDX: Record<string, number> = {
  SOUMISE: 0, ACCEPTEE: 1, CONFIRMEE: 1, EN_PREPARATION: 2, LIVREE: 3,
}
const TERMINAL_STATUTS = ['ANNULEE', 'REJETEE', 'ANNULEE', 'CANCELLED']

function StatusBadge({ statut }: { statut: string }) {
  const cfg = STATUS_CFG[statut]
  return cfg
    ? <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
    : <span className="badge badge-gray">{statut || '—'}</span>
}

function StatusPipeline({ statut }: { statut: string }) {
  const isTerminal = TERMINAL_STATUTS.includes(statut)
  const currentIdx = PIPELINE_IDX[statut] ?? (isTerminal ? 0 : -1)

  return (
    <div style={{ margin: '16px 0 20px', padding: '16px 12px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
        Progression de la commande
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
        {PIPELINE_STEPS.flatMap((step, i) => {
          const isDone    = !isTerminal && currentIdx > i
          const isCurrent = !isTerminal && currentIdx === i
          const nodes = [
            <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isDone ? 14 : 12, fontWeight: 700,
                background: isDone ? '#dcfce7' : isCurrent ? '#16a34a' : '#f1f5f9',
                color:      isDone ? '#15803d' : isCurrent ? 'white'   : '#94a3b8',
                border: `2px solid ${isDone ? '#86efac' : isCurrent ? '#16a34a' : '#e2e8f0'}`,
                transition: 'all .2s',
              }}>
                {isDone ? '✓' : isCurrent ? '●' : i + 1}
              </div>
              <span style={{ fontSize: 10.5, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#15803d' : isDone ? '#16a34a' : '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
          ]
          if (i < PIPELINE_STEPS.length - 1) {
            nodes.push(
              <div key={step.key + '-conn'} style={{ flex: '0 0 16px', height: 2, background: isDone ? '#86efac' : '#e2e8f0', marginTop: 14, zIndex: 0 }} />
            )
          }
          return nodes
        })}
      </div>
      {isTerminal && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#dc2626', fontWeight: 600 }}>
          <XCircle size={14} />
          {STATUS_CFG[statut]?.label ?? statut} — Commande terminée sans livraison
        </div>
      )}
    </div>
  )
}

// ── Actions de progression disponibles selon le statut actuel ──
const NEXT_ACTIONS: Record<string, { statut: string; label: string; style?: string }[]> = {
  SOUMISE:        [{ statut: 'ACCEPTEE',       label: 'Accepter',          style: 'primary' }, { statut: 'REJETEE', label: 'Rejeter', style: 'danger' }],
  ACCEPTEE:       [{ statut: 'EN_PREPARATION', label: 'Démarrer préparation', style: 'primary' }, { statut: 'ANNULEE', label: 'Annuler', style: 'danger' }],
  CONFIRMEE:      [{ statut: 'EN_PREPARATION', label: 'Démarrer préparation', style: 'primary' }, { statut: 'ANNULEE', label: 'Annuler', style: 'danger' }],
  EN_PREPARATION: [{ statut: 'LIVREE',         label: 'Marquer livrée',    style: 'primary' }, { statut: 'ANNULEE', label: 'Annuler', style: 'danger' }],
}

interface OrderTableProps {
  orders: any[];
  loading: boolean;
  emptyMsg: string;
  orgs?: any[];
  onUpdateStatus?: (id: number, statut: string) => Promise<void>;
}

function OrderTable({ orders, loading, emptyMsg, orgs = [], onUpdateStatus }: OrderTableProps) {
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<any>(null)
  const [actioning, setActioning] = useState(false)
  const total = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
  const slice = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const orgName = (id: number | null) => {
    if (!id) return '—'
    const found = orgs.find((o: any) => o.id === id)
    return found ? found.nomOrganisation : `Org #${id}`
  }

  const handleAction = async (statut: string) => {
    if (!detail || !onUpdateStatus) return
    setActioning(true)
    try {
      await onUpdateStatus(detail.id, statut)
      setDetail((d: any) => d ? { ...d, statut } : null)
    } finally {
      setActioning(false)
    }
  }

  const nextActions = detail ? (NEXT_ACTIONS[detail.statut] ?? []) : []

  return (
    <>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Code commande</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Fournisseur</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [0,1,2,3].map(i => <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
              : orders.length === 0
                ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><ShoppingCart size={20} /></div><div className="empty-title">{emptyMsg}</div></div></td></tr>
                : slice.map(o => (
                  <tr key={o.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                    <td style={{ fontWeight: 500 }}>{o.client || '—'}</td>
                    <td><StatusBadge statut={o.statut} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{orgName(o.idOrganisationFournisseur)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                    <td><button className="btn btn-ghost btn-icon" onClick={() => setDetail(o)}><Eye size={13} /></button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {!loading && orders.length > PAGE_SIZE && (
        <div className="pagination">
          <span className="pagination-info">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, orders.length)} sur {orders.length}</span>
          <div className="pagination-btns">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></button>
            {Array.from({ length: Math.min(total,5) }, (_,i) => i+1).map(n => (
              <button key={n} className={"page-btn " + (page===n?'active':'')} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="page-btn" onClick={() => setPage(p => Math.min(total,p+1))} disabled={page===total}><ChevronRight size={13} /></button>
          </div>
        </div>
      )}

      {detail && (
        <Modal title={`Commande — ${detail.codeCommande}`} subtitle={`Acheteur : ${detail.usernameAcheteur || '—'} · ${detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('fr-FR') : ''}`} onClose={() => setDetail(null)} size="md">

          {/* Pipeline visuel */}
          <StatusPipeline statut={detail.statut} />

          {/* Métadonnées */}
          <div style={{ display: 'grid', gap: 8, fontSize: 13, marginBottom: 16 }}>
            {([
              ['Client',          detail.client || '—'],
              ['Fournisseur',     orgName(detail.idOrganisationFournisseur)],
              ['Org acheteur',    orgName(detail.idOrganisationAcheteur)],
              ['Observations',    detail.observations || '—'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span style={{ minWidth: 120, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</span>
                <span style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Lignes de commande */}
          {Array.isArray(detail.lignes) && detail.lignes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Lignes de commande ({detail.lignes.length})
              </div>
              <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Variété</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Génération</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lignes.map((l: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>Variété #{l.idVariete}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>Génération #{l.idGeneration}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{l.quantiteDemandee} {l.unite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions de progression (si handler disponible) */}
          {onUpdateStatus && nextActions.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', alignSelf: 'center', marginRight: 4 }}>Action :</span>
              {nextActions.map(action => (
                <button
                  key={action.statut}
                  className={`btn ${action.style === 'danger' ? 'btn-ghost' : 'btn-primary'}`}
                  style={action.style === 'danger' ? { color: 'var(--red-600)', border: '1px solid #fecaca', height: 32, fontSize: 12 } : { height: 32, fontSize: 12 }}
                  onClick={() => handleAction(action.statut)}
                  disabled={actioning}
                >
                  {action.style !== 'danger' ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE QUOTATAIRE — mes commandes + nouvelle commande
   ══════════════════════════════════════════════════════════════ */
// Générations disponibles pour une commande (G3/R2 = semences commerciales)
const GENERATIONS_CMD = [
  { id: '1', label: 'G0 — Pré-base' },
  { id: '2', label: 'G1 — Base' },
  { id: '3', label: 'G2 — R1' },
  { id: '4', label: 'G3 — R2' },
  { id: '5', label: 'G4 — R3' },
  { id: '6', label: 'R1' },
  { id: '7', label: 'R2 — Certifiée' },
]

function VueQuotataire({ setToast }: { setToast: any }) {
  const [orders, setOrders]       = useState<any[]>([])
  const [orgs, setOrgs]           = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)

  const [form, setForm] = useState({
    idOrganisationFournisseur: '',
    observations: '',
    lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }],
  })

  async function fetchAll() {
    setLoading(true)
    const [ordRes, orgRes, varRes] = await Promise.allSettled([
      api.get(endpoints.ordersMesCommandes),
      api.get(endpoints.organisations),
      api.get(endpoints.varieties),
    ])
    setOrders(ordRes.status === 'fulfilled' ? ordRes.value.data : [])
    if (orgRes.status === 'fulfilled') {
      setOrgs(orgRes.value.data.filter((o: any) =>
        o.typeOrganisation?.toLowerCase().includes('multiplic') && o.active !== false
      ))
    }
    if (varRes.status === 'fulfilled') {
      setVarieties(varRes.value.data.filter((v: any) => v.statutVariete === 'DIFFUSEE'))
    }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  function addLigne() {
    setForm(f => ({ ...f, lignes: [...f.lignes, { idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] }))
  }
  function removeLigne(i: number) {
    setForm(f => ({ ...f, lignes: f.lignes.filter((_, idx) => idx !== i) }))
  }
  function updateLigne(i: number, field: string, value: string) {
    setForm(f => ({ ...f, lignes: f.lignes.map((l, idx) => idx === i ? { ...l, [field]: value } : l) }))
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const code = 'CMD-' + Date.now().toString(36).toUpperCase()
      await api.post(endpoints.orders, {
        codeCommande: code,
        client: 'Commande portail',
        idOrganisationFournisseur: form.idOrganisationFournisseur ? Number(form.idOrganisationFournisseur) : null,
        observations: form.observations || null,
        lignes: form.lignes.map(l => ({
          idVariete: Number(l.idVariete),
          idGeneration: Number(l.idGeneration),
          quantite: Number(l.quantite),
          unite: l.unite,
        })),
      })
      setToast({ msg: `Commande ${code} soumise avec succès`, type: 'success' })
      setShowForm(false)
      setForm({ idOrganisationFournisseur: '', observations: '', lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la soumission', type: 'error' })
    } finally { setSaving(false) }
  }

  const soumises   = orders.filter(o => o.statut === 'SOUMISE').length
  const confirmees = orders.filter(o => o.statut === 'CONFIRMEE').length
  const annulees   = orders.filter(o => o.statut === 'ANNULEE').length

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><ShoppingCart size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : orders.length}</div><div className="stat-label">Mes commandes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : soumises}</div><div className="stat-label">En attente</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><PackageCheck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : confirmees}</div><div className="stat-label">Confirmées</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : annulees}</div><div className="stat-label">Annulées</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><ShoppingCart size={15} /></span>Mes commandes</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Nouvelle commande</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>
        <OrderTable orders={orders} loading={loading} emptyMsg="Aucune commande passée" orgs={orgs} />
      </div>

      {showForm && (
        <Modal title="Nouvelle Commande" subtitle="Soumettre une demande de semences certifiées" onClose={() => setShowForm(false)} size="lg">
          <form onSubmit={submitOrder}>
            <Field label="Organisation fournisseur" hint="Multiplicateur qui fournira les semences">
              <FormSelect value={form.idOrganisationFournisseur} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, idOrganisationFournisseur: e.target.value }))}>
                <option value="">— Choisir un fournisseur —</option>
                {orgs.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.nomOrganisation} ({o.region || o.localite || 'N/A'})</option>
                ))}
              </FormSelect>
            </Field>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lignes de commande <span style={{ color: 'var(--red-500)' }}>*</span></label>
                <button type="button" className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={addLigne}><Plus size={11} /> Ajouter</button>
              </div>
              {form.lignes.map((ligne, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Ligne {i+1}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <Field label="Variété" required>
                      <FormSelect value={ligne.idVariete} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'idVariete',e.target.value)} required>
                        <option value="">— Choisir une variété —</option>
                        {Object.entries(
                          varieties.reduce((acc: Record<string, any[]>, v: any) => {
                            const esp = v.espece?.codeEspece || 'Autre'
                            ;(acc[esp] = acc[esp] || []).push(v)
                            return acc
                          }, {})
                        ).sort(([a], [b]) => a.localeCompare(b)).map(([esp, vs]) => (
                          <optgroup key={esp} label={esp}>
                            {(vs as any[]).map((v: any) => (
                              <option key={v.id} value={v.id}>{v.nomVariete} ({v.codeVariete})</option>
                            ))}
                          </optgroup>
                        ))}
                      </FormSelect>
                    </Field>
                    <Field label="Génération" required>
                      <FormSelect value={ligne.idGeneration} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'idGeneration',e.target.value)}>
                        {GENERATIONS_CMD.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </FormSelect>
                    </Field>
                    <Field label="Quantité" required>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <FormInput type="number" value={ligne.quantite} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLigne(i,'quantite',e.target.value)} placeholder="500" min="1" required style={{ flex: 1 }} />
                        <FormSelect value={ligne.unite} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'unite',e.target.value)} style={{ width: 70 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                      </div>
                    </Field>
                    {form.lignes.length > 1 && (
                      <button type="button" onClick={() => removeLigne(i)} style={{ height: 36, width: 36, background: 'var(--red-50)', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: 'var(--red-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}><X size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Field label="Observations">
              <textarea value={form.observations} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Précisions sur la commande, urgence, qualité attendue..." rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setShowForm(false)} loading={saving} submitLabel="Soumettre la commande" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE MULTIPLICATEUR — 2 onglets :
     • Commandes reçues (quotataires → moi)
     • Mes demandes G3  (moi → UPSemCL)
   ══════════════════════════════════════════════════════════════ */
function VueMultiplicateur({ setToast }: { setToast: any }) {
  const [onglet, setOnglet]           = useState<'recues'|'demandes'>('recues')
  const [recues, setRecues]           = useState<any[]>([])
  const [demandes, setDemandes]       = useState<any[]>([])
  const [loadingR, setLoadingR]       = useState(true)
  const [loadingD, setLoadingD]       = useState(true)
  const [refusModal, setRefusModal]   = useState<{ id: number; code: string } | null>(null)
  const [motif, setMotif]             = useState('')
  const [saving, setSaving]           = useState(false)

  async function fetchAll() {
    setLoadingR(true); setLoadingD(true)
    const [rRes, dRes] = await Promise.allSettled([
      api.get(endpoints.ordersATraiter),
      api.get(endpoints.ordersMesDemandesG3),
    ])
    setRecues(rRes.status === 'fulfilled' ? rRes.value.data : [])
    setLoadingR(false)
    setDemandes(dRes.status === 'fulfilled' ? dRes.value.data : [])
    setLoadingD(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function confirmer(id: number) {
    setSaving(true)
    try {
      await api.put(endpoints.orderStatut(id), { statut: 'ACCEPTEE' })
      setToast({ msg: 'Commande acceptée', type: 'success' })
      fetchAll()
    } catch { setToast({ msg: 'Erreur lors de la confirmation', type: 'error' }) }
    finally { setSaving(false) }
  }

  async function refuser(e: React.FormEvent) {
    e.preventDefault()
    if (!refusModal) return
    setSaving(true)
    try {
      await api.put(endpoints.orderStatut(refusModal.id), { statut: 'ANNULEE', observations: motif })
      setToast({ msg: `Commande ${refusModal.code} annulée`, type: 'success' })
      setRefusModal(null); setMotif('')
      fetchAll()
    } catch { setToast({ msg: 'Erreur lors du refus', type: 'error' }) }
    finally { setSaving(false) }
  }

  const soumisesRecues  = recues.filter(o => o.statut === 'SOUMISE').length
  const confirmeesRecues = recues.filter(o => ['CONFIRMEE','ACCEPTEE'].includes(o.statut)).length
  const demandesEnCours  = demandes.filter(o => o.statut === 'SOUMISE').length
  const demandesAcceptees = demandes.filter(o => ['CONFIRMEE','ACCEPTEE','LIVREE'].includes(o.statut)).length

  const tabBtn = (key: 'recues'|'demandes', icon: React.ReactNode, label: string, count?: number) => (
    <button
      onClick={() => setOnglet(key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
        borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        background: onglet === key ? 'var(--surface)' : 'transparent',
        color:      onglet === key ? 'var(--green-700)' : 'var(--text-muted)',
        borderBottom: onglet === key ? '2px solid var(--green-600)' : '2px solid transparent',
        transition: 'all .15s',
      }}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span style={{ background: onglet === key ? 'var(--green-100)' : 'var(--surface-2)', color: onglet === key ? 'var(--green-700)' : 'var(--text-muted)', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{count}</span>
      )}
    </button>
  )

  return (
    <div>
      {/* KPIs globaux */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><Building2 size={18} /></div><div className="stat-body"><div className="stat-value">{loadingR ? '…' : recues.length}</div><div className="stat-label">Commandes reçues</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loadingR ? '…' : soumisesRecues}</div><div className="stat-label">À traiter</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><ShoppingCart size={18} /></div><div className="stat-body"><div className="stat-value">{loadingD ? '…' : demandes.length}</div><div className="stat-label">Mes demandes G3</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><PackageCheck size={18} /></div><div className="stat-body"><div className="stat-value">{loadingD ? '…' : demandesAcceptees}</div><div className="stat-label">Demandes acceptées</div></div></div>
      </div>

      {soumisesRecues > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#1d4ed8' }}>
          <Clock size={16} />
          <strong>{soumisesRecues} commande{soumisesRecues > 1 ? 's' : ''} en attente</strong> de votre décision.
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 0, background: 'var(--surface-2)', borderRadius: '10px 10px 0 0', padding: '0 16px' }}>
        {tabBtn('recues',   <Building2 size={14} />,    'Commandes reçues',  recues.length)}
        {tabBtn('demandes', <ShoppingCart size={14} />, 'Mes demandes G3',   demandes.length)}
      </div>

      {/* ── Onglet Commandes reçues ───────────────────────────── */}
      {onglet === 'recues' && (
        <div className="card" style={{ borderRadius: '0 0 var(--radius) var(--radius)', borderTop: 'none' }}>
          <div className="card-header">
            <span className="card-title"><span className="card-title-icon"><Building2 size={15} /></span>Commandes de mon organisation <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{recues.length}</span></span>
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>

          {!loadingR && confirmeesRecues > 0 && (
            <div style={{ padding: '8px 22px', background: 'var(--green-50)', borderBottom: '1px solid var(--green-100)', fontSize: 12.5, color: 'var(--green-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={13} /> <strong>{confirmeesRecues}</strong> commande{confirmeesRecues > 1 ? 's' : ''} confirmée{confirmeesRecues > 1 ? 's' : ''}
            </div>
          )}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Code</th><th>Client</th><th>Statut</th><th>Acheteur</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loadingR
                  ? [0,1,2].map(i => <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                  : recues.length === 0
                    ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><Building2 size={20} /></div><div className="empty-title">Aucune commande reçue</div></div></td></tr>
                    : recues.map(o => (
                      <tr key={o.id}>
                        <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                        <td style={{ fontWeight: 500 }}>{o.client || '—'}</td>
                        <td><StatusBadge statut={o.statut} /></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.usernameAcheteur || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                        <td>
                          {o.statut === 'SOUMISE' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px' }} onClick={() => confirmer(o.id)} disabled={saving}>
                                <CheckCircle2 size={12} /> Confirmer
                              </button>
                              <button className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 10px', color: 'var(--red-600)', border: '1px solid #fecaca' }} onClick={() => { setRefusModal({ id: o.id, code: o.codeCommande }); setMotif('') }} disabled={saving}>
                                <Ban size={12} /> Annuler
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Onglet Mes demandes G3 ────────────────────────────── */}
      {onglet === 'demandes' && (
        <div className="card" style={{ borderRadius: '0 0 var(--radius) var(--radius)', borderTop: 'none' }}>
          <div className="card-header">
            <span className="card-title"><span className="card-title-icon"><ShoppingCart size={15} /></span>Mes demandes G3 auprès de l'UPSemCL <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{demandes.length}</span></span>
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>

          {!loadingD && demandesEnCours > 0 && (
            <div style={{ padding: '8px 22px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', fontSize: 12.5, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} /> <strong>{demandesEnCours}</strong> demande{demandesEnCours > 1 ? 's' : ''} en attente de réponse de l'UPSemCL
            </div>
          )}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Code commande</th><th>Variété / Lot</th><th>Statut</th><th>Fournisseur</th><th>Date soumission</th><th>Observations</th></tr>
              </thead>
              <tbody>
                {loadingD
                  ? [0,1,2].map(i => <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                  : demandes.length === 0
                    ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><ShoppingCart size={20} /></div><div className="empty-title">Aucune demande G3 passée</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Rendez-vous dans la page Lots pour commander un lot G3 à l'UPSemCL</div></div></td></tr>
                    : demandes.map(o => (
                      <tr key={o.id}>
                        <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {o.lignes?.length > 0
                            ? `${o.lignes.length} ligne${o.lignes.length > 1 ? 's' : ''}`
                            : o.client || '—'}
                        </td>
                        <td><StatusBadge statut={o.statut} /></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {o.idOrganisationFournisseur ? `UPSemCL #${o.idOrganisationFournisseur}` : 'UPSemCL'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.observations || '—'}</span>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {refusModal && (
        <Modal title="Annuler la commande" subtitle={`Commande ${refusModal.code}`} onClose={() => setRefusModal(null)} size="sm">
          <form onSubmit={refuser}>
            <Field label="Motif d'annulation" required hint="Ce motif sera visible par le quotataire">
              <textarea value={motif} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMotif(e.target.value)} placeholder="Stock insuffisant, variété indisponible..." rows={4} required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setRefusModal(null)} loading={saving} submitLabel="Confirmer l'annulation" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE ADMIN / UPSEMCL — toutes les commandes + allocation
   ══════════════════════════════════════════════════════════════ */
function VueAdmin({ setToast }: { setToast: any }) {
  const [orders, setOrders]       = useState<any[]>([])
  const [orgs, setOrgs]           = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [showAlloc, setShowAlloc] = useState(false)
  const [allocForm, setAllocForm] = useState({ idLigne: '', idLot: '', quantite: '' })
  const [saving, setSaving]       = useState(false)

  async function fetchOrders() {
    setLoading(true)
    const [oRes, orgRes] = await Promise.allSettled([
      api.get(endpoints.orders),
      api.get(endpoints.organisations),
    ])
    setOrders(oRes.status === 'fulfilled' ? oRes.value.data : [])
    setOrgs(orgRes.status === 'fulfilled' ? orgRes.value.data : [])
    setLoading(false)
  }

  async function handleUpdateStatus(id: number, statut: string) {
    await api.put(endpoints.orderStatut(id), { statut })
    setToast({ msg: `Commande → ${statut}`, type: 'success' })
    fetchOrders()
  }

  useEffect(() => { fetchOrders() }, [])

  const statuses = [...new Set(orders.map((o: any) => o.statut).filter(Boolean))]
  const filtered = orders.filter(o => {
    const ms = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    const mf = !filterStatus || o.statut === filterStatus
    return ms && mf
  })

  async function submitAlloc(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.orderAllocate, { idLigne: Number(allocForm.idLigne), idLot: Number(allocForm.idLot), quantite: Number(allocForm.quantite) })
      setToast({ msg: 'Allocation enregistrée', type: 'success' })
      setShowAlloc(false); setAllocForm({ idLigne: '', idLot: '', quantite: '' })
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur allocation', type: 'error' })
    } finally { setSaving(false) }
  }

  const pending   = orders.filter(o => ['SOUMISE','PENDING','EN_ATTENTE'].includes(o.statut)).length
  const allocated = orders.filter(o => ['ALLOUEE','ALLOCATED'].includes(o.statut)).length
  const cancelled = orders.filter(o => ['ANNULEE','CANCELLED'].includes(o.statut)).length

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><ShoppingCart size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : orders.length}</div><div className="stat-label">Total commandes</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : pending}</div><div className="stat-label">En attente</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><PackageCheck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : allocated}</div><div className="stat-label">Allouées</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '...' : cancelled}</div><div className="stat-label">Annulées</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><ShoppingCart size={15} /></span>Toutes les commandes <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}/{orders.length}</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowAlloc(true)}><Settings2 size={13} /> Allouer</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchOrders}><RefreshCw size={13} /></button>
          </div>
        </div>

        {!loading && statuses.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button className={"gen-chain-btn " + (!filterStatus ? 'active' : '')} onClick={() => setFilter('')}>Tous ({orders.length})</button>
            {statuses.map(s => {
              const cfg = STATUS_CFG[s]; if (!cfg) return null
              return <button key={s} className={"gen-chain-btn " + (filterStatus===s?'active':'')} style={{ color: cfg.color }} onClick={() => setFilter(filterStatus===s ? '' : s)}>{cfg.label} ({orders.filter(o=>o.statut===s).length})</button>
            })}
          </div>
        )}

        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Code commande ou client..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 200 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
          {(search || filterStatus) && <button className="btn btn-ghost" onClick={() => { setSearch(''); setFilter('') }}><X size={12} /> Effacer</button>}
        </div>

        <OrderTable
          orders={filtered}
          loading={loading}
          emptyMsg="Aucune commande"
          orgs={orgs}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>

      {showAlloc && (
        <Modal title="Allouer un Lot à une Commande" subtitle="Affecter un lot de semences à une ligne de commande" onClose={() => setShowAlloc(false)} size="sm">
          <div style={{ background: 'var(--blue-50)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1d4ed8' }}>
            Trouvez l'ID de la ligne dans le détail de la commande.
          </div>
          <form onSubmit={submitAlloc}>
            <Field label="ID ligne de commande" required><FormInput type="number" value={allocForm.idLigne} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, idLigne: e.target.value }))} placeholder="1" required /></Field>
            <Field label="ID du lot" required><FormInput type="number" value={allocForm.idLot} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, idLot: e.target.value }))} placeholder="22" required /></Field>
            <Field label="Quantité à allouer" required><FormInput type="number" value={allocForm.quantite} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, quantite: e.target.value }))} placeholder="1000" min="1" step="0.01" required /></Field>
            <FormActions onCancel={() => setShowAlloc(false)} loading={saving} submitLabel="Confirmer l'allocation" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE UPSEMCL / SELECTEUR — commandes reçues à valider
   ══════════════════════════════════════════════════════════════ */
function VueUpsemcl({ setToast, roleKey }: { setToast: any; roleKey: string }) {
  const [recues, setRecues]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [refusModal, setRefusModal] = useState<{ id: number; code: string } | null>(null)
  const [motif, setMotif]     = useState('')

  const isUpsemcl = roleKey === 'seed-upsemcl'
  const label = isUpsemcl
    ? 'commandes des multiplicateurs'
    : 'commandes reçues'

  async function fetchAll() {
    setLoading(true)
    try {
      const r = await api.get(endpoints.ordersATraiter)
      setRecues(r.data ?? [])
    } catch { setRecues([]) }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function accepter(id: number) {
    setSaving(true)
    try {
      await api.put(endpoints.orderStatut(id), { statut: 'ACCEPTEE' })
      setToast({ msg: 'Commande acceptée', type: 'success' })
      fetchAll()
    } catch { setToast({ msg: "Erreur lors de l'acceptation", type: 'error' }) }
    finally { setSaving(false) }
  }

  async function refuser(e: React.FormEvent) {
    e.preventDefault()
    if (!refusModal) return
    setSaving(true)
    try {
      await api.put(endpoints.orderStatut(refusModal.id), { statut: 'ANNULEE', observations: motif })
      setToast({ msg: `Commande ${refusModal.code} annulée`, type: 'success' })
      setRefusModal(null); setMotif('')
      fetchAll()
    } catch { setToast({ msg: 'Erreur lors du refus', type: 'error' }) }
    finally { setSaving(false) }
  }

  const aTraiter   = recues.filter(o => o.statut === 'SOUMISE').length
  const acceptees  = recues.filter(o => ['ACCEPTEE','CONFIRMEE'].includes(o.statut)).length

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><Building2 size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : recues.length}</div><div className="stat-label">Total reçues</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Clock size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : aTraiter}</div><div className="stat-label">À traiter</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><PackageCheck size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : acceptees}</div><div className="stat-label">Acceptées</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><XCircle size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : recues.filter(o => ['ANNULEE','REJETEE'].includes(o.statut)).length}</div><div className="stat-label">Annulées</div></div></div>
      </div>

      {aTraiter > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#1d4ed8' }}>
          <Clock size={16} />
          <strong>{aTraiter} commande{aTraiter > 1 ? 's' : ''}</strong> en attente de votre décision.
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Building2 size={15} /></span>
            Mes {label}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{recues.length}</span>
          </span>
          <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Code</th><th>Client / Acheteur</th><th>Statut</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading
                ? [0,1,2].map(i => <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                : recues.length === 0
                  ? <tr><td colSpan={5}><div className="empty-state"><div className="empty-icon"><ShoppingCart size={20} /></div><div className="empty-title">Aucune commande reçue</div></div></td></tr>
                  : recues.map(o => (
                    <tr key={o.id}>
                      <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                      <td style={{ fontWeight: 500 }}>{o.usernameAcheteur || o.client || '—'}</td>
                      <td><StatusBadge statut={o.statut} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>
                        {o.statut === 'SOUMISE' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px' }} onClick={() => accepter(o.id)} disabled={saving}>
                              <CheckCircle2 size={12} /> Accepter
                            </button>
                            <button className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 10px', color: 'var(--red-600)', border: '1px solid #fecaca' }} onClick={() => { setRefusModal({ id: o.id, code: o.codeCommande }); setMotif('') }} disabled={saving}>
                              <Ban size={12} /> Annuler
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {refusModal && (
        <Modal title="Annuler la commande" subtitle={`Commande ${refusModal.code}`} onClose={() => setRefusModal(null)} size="sm">
          <form onSubmit={refuser}>
            <Field label="Motif d'annulation" required hint="Ce motif sera visible par le demandeur">
              <textarea value={motif} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMotif(e.target.value)} placeholder="Stock insuffisant, variété indisponible..." rows={4} required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setRefusModal(null)} loading={saving} submitLabel="Confirmer l'annulation" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL — dispatch par rôle
   ══════════════════════════════════════════════════════════════ */
export function Orders({ roleKey }: Props) {
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {roleKey === 'seed-quotataire'
        ? <VueQuotataire setToast={setToast} />
        : roleKey === 'seed-multiplicator'
          ? <VueMultiplicateur setToast={setToast} />
          : roleKey === 'seed-upsemcl' || roleKey === 'seed-selector'
            ? <VueUpsemcl setToast={setToast} roleKey={roleKey} />
            : <VueAdmin setToast={setToast} />
      }
    </div>
  )
}
