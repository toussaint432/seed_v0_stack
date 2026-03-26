import React, { useEffect, useState } from 'react'
import { Package, Plus, ArrowRightLeft, GitBranch, RefreshCw, Filter, X, ChevronRight, Eye } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }
const GEN_COLORS: Record<string, string> = { G0: 'badge-blue', G1: 'badge-green', G2: 'badge-gold', G3: 'badge-gray', G4: 'badge-gray', R1: 'badge-blue', R2: 'badge-green' }
const GEN_BG: Record<string, string> = { G0: '#eff6ff', G1: '#f0fdf4', G2: '#fef9ed', G3: '#f9fafb', G4: '#f9fafb', R1: '#eff6ff', R2: '#f0fdf4' }
const GEN_BORDER: Record<string, string> = { G0: '#bfdbfe', G1: '#bbf7d0', G2: '#fde68a', G3: '#e5e7eb', G4: '#e5e7eb', R1: '#bfdbfe', R2: '#bbf7d0' }
const ALL_GENS = ['G0','G1','G2','G3','G4','R1','R2']
const GEN_IDS: Record<string, number> = { G0: 1, G1: 2, G2: 3, G3: 4, G4: 5, R1: 6, R2: 7 }
const ROLE_GENERATIONS: Record<string, string[]> = { 'seed-admin': ALL_GENS, 'seed-selector': ['G0','G1'], 'seed-upseml': ['G1','G2','G3'], 'seed-multiplicator': ['G3','G4','R1','R2'] }

function flattenLineage(lot: any): any[] {
  const chain: any[] = []; let cur = lot
  while (cur) { chain.unshift(cur); cur = cur.lotParent }
  return chain
}

function LineageModal({ lot, onClose }: { lot: any; onClose: () => void }) {
  const chain = flattenLineage(lot)
  return (
    <Modal title={"Tracabilite : " + lot.codeLot} subtitle={"Chaine generationnelle : " + chain.length + " generation(s)"} onClose={onClose} size="lg">
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
        {chain.map((node, i) => {
          const gen = node.generation?.codeGeneration || '?'; const isLast = i === chain.length - 1
          return (
            <React.Fragment key={node.id}>
              <div style={{ background: GEN_BG[gen] || '#f9fafb', border: "2px solid " + (GEN_BORDER[gen] || '#e5e7eb'), borderRadius: 10, padding: '14px 16px', minWidth: 148, flex: '0 0 auto', boxShadow: isLast ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span className={"badge " + (GEN_COLORS[gen] || 'badge-gray')} style={{ fontSize: 11 }}>{gen}</span>
                  {isLast && <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Actuel</span>}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-all' }}>{node.codeLot}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  <div>Date: {node.dateProduction || 'N/A'}</div>
                  <div>Qte: {node.quantiteNette ? Number(node.quantiteNette).toLocaleString('fr-FR') : 'N/A'} {node.unite}</div>
                  <div>Germ: {node.tauxGermination}%</div>
                  <div>Purete: {node.puretePhysique}%</div>
                </div>
              </div>
              {!isLast && <div style={{ display: 'flex', alignItems: 'center', padding: '0 3px', color: '#9ca3af', flexShrink: 0 }}><ChevronRight size={16} /></div>}
            </React.Fragment>
          )
        })}
      </div>
      <div style={{ marginTop: 20, padding: '14px 18px', background: '#f8faf8', borderRadius: 8, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Generations</div><div style={{ fontSize: 22, fontWeight: 700 }}>{chain.length}</div></div>
        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Lot origine</div><div style={{ fontSize: 12, fontWeight: 600 }}>{chain[0]?.codeLot}</div></div>
        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Germination finale</div><div style={{ fontSize: 22, fontWeight: 700 }}>{lot.tauxGermination}%</div></div>
      </div>
    </Modal>
  )
}

export function Lots({ roleKey }: Props) {
  const [lots, setLots] = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [generation, setGeneration] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [lineageLot, setLineageLot] = useState<any>(null)
  const [lineageLoading, setLineageLoading] = useState<number|null>(null)
  const [showNewLot, setShowNewLot] = useState(false)
  const [showChildLot, setShowChildLot] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [parentLot, setParentLot] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const allowedGens = ROLE_GENERATIONS[roleKey] || ALL_GENS
  const canCreate = ['seed-admin','seed-selector','seed-upseml','seed-multiplicator'].includes(roleKey)
  const canTransfer = ['seed-selector','seed-upseml'].includes(roleKey)
  const canChild = ['seed-admin','seed-upseml','seed-multiplicator'].includes(roleKey)

  const [newLotForm, setNewLotForm] = useState({ codeLot: '', idVariete: '', generationCode: 'G0', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '', statutLot: 'DISPONIBLE' })
  const [childForm, setChildForm] = useState({ codeLot: '', generationCode: '', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '' })
  const [transferForm, setTransferForm] = useState({ generationCible: '', observations: '' })

  async function fetchLots() {
    setLoading(true)
    const url = generation ? `${endpoints.lots}?generation=${generation}` : endpoints.lots
    api.get(url).then(r => {
      let data = r.data
      if (roleKey !== 'seed-admin') data = data.filter((l: any) => allowedGens.includes(l.generation?.codeGeneration))
      setLots(data)
    }).catch(() => setLots([])).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLots()
    api.get(endpoints.varieties).then(r => setVarieties(r.data)).catch(() => {})
  }, [generation])

  const genCounts = lots.reduce((acc: Record<string, number>, l) => {
    const g = l.generation?.codeGeneration || 'N/A'; acc[g] = (acc[g] || 0) + 1; return acc
  }, {})

  const varietyMap: Record<number, { codeVariete: string; nomVariete: string }> =
    Object.fromEntries(varieties.map(v => [v.id, v]))

  async function submitNewLot(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.lots, {
        codeLot: newLotForm.codeLot, idVariete: Number(newLotForm.idVariete),
        generation: { id: GEN_IDS[newLotForm.generationCode] || 1 },
        campagne: newLotForm.campagne, dateProduction: newLotForm.dateProduction || undefined,
        quantiteNette: Number(newLotForm.quantiteNette), unite: newLotForm.unite,
        tauxGermination: Number(newLotForm.tauxGermination), puretePhysique: Number(newLotForm.puretePhysique),
        statutLot: newLotForm.statutLot,
      })
      setToast({ msg: "Lot " + newLotForm.codeLot + " cree avec succes", type: 'success' })
      setShowNewLot(false)
      setNewLotForm({ codeLot: '', idVariete: '', generationCode: 'G0', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '', statutLot: 'DISPONIBLE' })
      fetchLots()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la creation', type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitChildLot(e: React.FormEvent) {
    e.preventDefault(); if (!parentLot) return; setSaving(true)
    try {
      await api.post(endpoints.lotChild(parentLot.id), {
        codeLot: childForm.codeLot, idVariete: parentLot.idVariete, generationCode: childForm.generationCode,
        campagne: childForm.campagne, dateProduction: childForm.dateProduction || undefined,
        quantiteNette: Number(childForm.quantiteNette), unite: childForm.unite,
        tauxGermination: childForm.tauxGermination ? Number(childForm.tauxGermination) : undefined,
        puretePhysique: childForm.puretePhysique ? Number(childForm.puretePhysique) : undefined,
      })
      setToast({ msg: "Lot enfant " + childForm.codeLot + " cree", type: 'success' })
      setShowChildLot(false); fetchLots()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault(); if (!parentLot) return; setSaving(true)
    try {
      await api.post(endpoints.lotTransfer(parentLot.id), { generationCible: transferForm.generationCible, observations: transferForm.observations })
      setToast({ msg: "Lot " + parentLot.codeLot + " transfere vers " + transferForm.generationCible, type: 'success' })
      setShowTransfer(false); fetchLots()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors du transfert', type: 'error' })
    } finally { setSaving(false) }
  }

  async function showLineage(lot: any) {
    setLineageLoading(lot.id)
    try { const r = await api.get(endpoints.lotById(lot.id)); setLineageLot(r.data) }
    catch { setLineageLot(lot) }
    finally { setLineageLoading(null) }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {lineageLot && <LineageModal lot={lineageLot} onClose={() => setLineageLot(null)} />}

      {roleKey === 'seed-admin' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 4 }}>Chaine :</span>
          {ALL_GENS.map((g, i, arr) => (
            <React.Fragment key={g}>
              <span className={"badge " + (GEN_COLORS[g] || 'badge-gray')} style={{ cursor: 'pointer' }} onClick={() => setGeneration(generation === g ? '' : g)}>
                {g} {genCounts[g] ? "(" + genCounts[g] + ")" : ''}
              </span>
              {i < arr.length - 1 && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>›</span>}
            </React.Fragment>
          ))}
          {generation && <button className="btn btn-ghost" style={{ height: 22, fontSize: 11, marginLeft: 6 }} onClick={() => setGeneration('')}><X size={10} /> Tout</button>}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon green"><Package size={18} /></div><div className="stat-body"><div className="stat-value">{lots.length}</div><div className="stat-label">Total lots</div></div></div>
        {Object.entries(genCounts).slice(0, 3).map(([gen, count]) => (
          <div className="stat-card" key={gen}><div className="stat-icon blue"><span style={{ fontSize: 14, fontWeight: 700 }}>{gen}</span></div><div className="stat-body"><div className="stat-value">{count as number}</div><div className="stat-label">Generation {gen}</div></div></div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><Package size={15} /></span>Liste des Lots</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canCreate && <button className="btn btn-primary" onClick={() => setShowNewLot(true)}><Plus size={13} /> Nouveau lot</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchLots}><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Generation</label>
            <select className="input" value={generation} onChange={e => setGeneration(e.target.value)} style={{ width: 140 }}>
              <option value="">Toutes</option>
              {allowedGens.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={fetchLots}><Filter size={12} /> Filtrer</button>
          {generation && <button className="btn btn-ghost" onClick={() => setGeneration('')}><X size={12} /> Effacer</button>}
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Code Lot</th><th>Variete</th><th>Generation</th><th>Lot Parent</th><th>Quantite</th><th>Campagne</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? [0,1,2,3].map(i => <tr key={i}><td colSpan={8}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
               lots.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><Package size={20} /></div><div className="empty-title">Aucun lot</div>{canCreate && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowNewLot(true)}>+ Creer un lot</button>}</div></td></tr>
               ) : lots.map(l => {
                const gen = l.generation?.codeGeneration || 'N/A'
                return (
                  <tr key={l.id}>
                    <td><span className="td-mono" style={{ fontWeight: 700 }}>{l.codeLot}</span></td>
                    <td>
                      {varietyMap[l.idVariete] ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{varietyMap[l.idVariete].nomVariete}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{varietyMap[l.idVariete].codeVariete}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td><span className={"badge " + (GEN_COLORS[gen] || 'badge-gray')}>{gen}</span></td>
                    <td>{l.lotParent?.codeLot ? <span className="td-mono" style={{ fontSize: 11 }}>{l.lotParent.codeLot}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td><span style={{ fontWeight: 600 }}>{Number(l.quantiteNette).toLocaleString('fr-FR')}</span><span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 12 }}>{l.unite}</span></td>
                    <td style={{ fontSize: 12 }}>{l.campagne || '—'}</td>
                    <td><span className={"badge " + (l.statutLot === 'DISPONIBLE' ? 'badge-green' : l.statutLot === 'TRANSFERE' ? 'badge-blue' : 'badge-gray')} style={{ fontSize: 11 }}>{l.statutLot}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => showLineage(l)} disabled={lineageLoading === l.id} title="Voir traçabilité">{lineageLoading === l.id ? <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Eye size={12} />}</button>
                        {canChild && <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} title="Lot enfant" onClick={() => { setParentLot(l); setChildForm({ codeLot: '', generationCode: '', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '' }); setShowChildLot(true) }}><GitBranch size={12} /></button>}
                        {canTransfer && <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} title="Transferer" onClick={() => { setParentLot(l); setTransferForm({ generationCible: '', observations: '' }); setShowTransfer(true) }}><ArrowRightLeft size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showNewLot && (
        <Modal title="Nouveau Lot Semencier" subtitle="Enregistrer un nouveau lot dans la chaine semenciere" onClose={() => setShowNewLot(false)}>
          <form onSubmit={submitNewLot}>
            <FormRow>
              <Field label="Code lot" required hint="Ex: G0-MIL-SOUNA3-2026"><FormInput value={newLotForm.codeLot} onChange={e => setNewLotForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} placeholder="G0-MIL-SOUNA3-2026" required /></Field>
              <Field label="Variete" required>
                <FormSelect value={newLotForm.idVariete} onChange={e => setNewLotForm(f => ({ ...f, idVariete: e.target.value }))} required>
                  <option value="">-- Choisir une variete --</option>
                  {varieties.map(v => <option key={v.id} value={v.id}>{v.codeVariete} — {v.nomVariete}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Generation" required>
                <FormSelect value={newLotForm.generationCode} onChange={e => setNewLotForm(f => ({ ...f, generationCode: e.target.value }))} required>
                  {allowedGens.map(g => <option key={g} value={g}>{g}</option>)}
                </FormSelect>
              </Field>
              <Field label="Campagne" required><FormInput value={newLotForm.campagne} onChange={e => setNewLotForm(f => ({ ...f, campagne: e.target.value }))} placeholder="2026" required /></Field>
            </FormRow>
            <FormRow>
              <Field label="Date de production"><FormInput type="date" value={newLotForm.dateProduction} onChange={e => setNewLotForm(f => ({ ...f, dateProduction: e.target.value }))} /></Field>
              <Field label="Quantite nette" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={newLotForm.quantiteNette} onChange={e => setNewLotForm(f => ({ ...f, quantiteNette: e.target.value }))} placeholder="50" min="0" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={newLotForm.unite} onChange={e => setNewLotForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}><option value="kg">kg</option><option value="t">t</option><option value="g">g</option></FormSelect>
                </div>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Taux germination (%)" required><FormInput type="number" value={newLotForm.tauxGermination} onChange={e => setNewLotForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" required /></Field>
              <Field label="Purete physique (%)" required><FormInput type="number" value={newLotForm.puretePhysique} onChange={e => setNewLotForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="99.5" min="0" max="100" step="0.1" required /></Field>
            </FormRow>
            <Field label="Statut">
              <FormSelect value={newLotForm.statutLot} onChange={e => setNewLotForm(f => ({ ...f, statutLot: e.target.value }))}>
                <option value="DISPONIBLE">DISPONIBLE</option><option value="EN_PRODUCTION">EN_PRODUCTION</option><option value="TRANSFERE">TRANSFERE</option><option value="EPUISE">EPUISE</option>
              </FormSelect>
            </Field>
            <FormActions onCancel={() => setShowNewLot(false)} loading={saving} submitLabel="Creer le lot" />
          </form>
        </Modal>
      )}

      {showChildLot && parentLot && (
        <Modal title="Creer un Lot Enfant" subtitle={"Lot parent : " + parentLot.codeLot + " — " + parentLot.generation?.codeGeneration} onClose={() => setShowChildLot(false)}>
          <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: 'var(--green-800)' }}>
            Ce lot sera lie au lot parent et aura la generation cible selectionnee.
          </div>
          <form onSubmit={submitChildLot}>
            <FormRow>
              <Field label="Code du lot enfant" required><FormInput value={childForm.codeLot} onChange={e => setChildForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} placeholder="G1-MIL-SOUNA3-2026" required /></Field>
              <Field label="Generation cible" required hint="G1, G2, G3, G4, R1, R2...">
                <FormSelect value={childForm.generationCode} onChange={e => setChildForm(f => ({ ...f, generationCode: e.target.value }))} required>
                  <option value="">-- Selectionner --</option>
                  {ALL_GENS.map(g => <option key={g} value={g}>{g}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Campagne" required><FormInput value={childForm.campagne} onChange={e => setChildForm(f => ({ ...f, campagne: e.target.value }))} placeholder="2026" required /></Field>
              <Field label="Date de production"><FormInput type="date" value={childForm.dateProduction} onChange={e => setChildForm(f => ({ ...f, dateProduction: e.target.value }))} /></Field>
            </FormRow>
            <FormRow>
              <Field label="Quantite nette" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={childForm.quantiteNette} onChange={e => setChildForm(f => ({ ...f, quantiteNette: e.target.value }))} placeholder="500" min="0" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={childForm.unite} onChange={e => setChildForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                </div>
              </Field>
              <Field label="Taux germination (%)"><FormInput type="number" value={childForm.tauxGermination} onChange={e => setChildForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="97.0" min="0" max="100" step="0.1" /></Field>
            </FormRow>
            <Field label="Purete physique (%)"><FormInput type="number" value={childForm.puretePhysique} onChange={e => setChildForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" /></Field>
            <FormActions onCancel={() => setShowChildLot(false)} loading={saving} submitLabel="Creer le lot enfant" />
          </form>
        </Modal>
      )}

      {showTransfer && parentLot && (
        <Modal title="Transferer un Lot" subtitle={"Transferer " + parentLot.codeLot + " vers la prochaine generation"} onClose={() => setShowTransfer(false)} size="sm">
          <div style={{ background: 'var(--amber-50)', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92660a' }}>
            Cette action changera le statut du lot en TRANSFERE.
          </div>
          <form onSubmit={submitTransfer}>
            <Field label="Generation cible" required hint="Vers quelle generation transferez-vous ?">
              <FormSelect value={transferForm.generationCible} onChange={e => setTransferForm(f => ({ ...f, generationCible: e.target.value }))} required>
                <option value="">-- Selectionner --</option>
                {ALL_GENS.map(g => <option key={g} value={g}>{g}</option>)}
              </FormSelect>
            </Field>
            <Field label="Observations">
              <textarea value={transferForm.observations} onChange={e => setTransferForm(f => ({ ...f, observations: e.target.value }))} placeholder="Notes sur le transfert..." style={{ width: '100%', minHeight: 80, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setShowTransfer(false)} loading={saving} submitLabel="Confirmer le transfert" />
          </form>
        </Modal>
      )}
    </div>
  )
}
