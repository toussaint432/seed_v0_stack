import React, { useEffect, useState } from 'react'
import { Package, Plus, ArrowRightLeft, GitBranch, RefreshCw, Filter, X, ChevronRight, Eye, Building2, Download, FileText } from 'lucide-react'
import { keycloak } from '../../lib/keycloak'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { generateTransferDoc, generateNumero, type TransferDocData, type LotPdfData, type PartiePdf } from '../../lib/pdf/generateTransferDoc'

interface Props { roleKey: string; userSpecialisation?: string | null }
const GEN_COLORS: Record<string, string> = { G0: 'badge-blue', G1: 'badge-green', G2: 'badge-gold', G3: 'badge-gray', G4: 'badge-gray', R1: 'badge-blue', R2: 'badge-green' }
const GEN_BG: Record<string, string> = { G0: '#eff6ff', G1: '#f0fdf4', G2: '#fef9ed', G3: '#f9fafb', G4: '#f9fafb', R1: '#eff6ff', R2: '#f0fdf4' }
const GEN_BORDER: Record<string, string> = { G0: '#bfdbfe', G1: '#bbf7d0', G2: '#fde68a', G3: '#e5e7eb', G4: '#e5e7eb', R1: '#bfdbfe', R2: '#bbf7d0' }
const ALL_GENS = ['G0','G1','G2','G3','G4','R1','R2']
const GEN_IDS: Record<string, number> = { G0: 1, G1: 2, G2: 3, G3: 4, G4: 5, R1: 6, R2: 7 }
const ROLE_GENERATIONS: Record<string, string[]> = { 'seed-admin': ALL_GENS, 'seed-selector': ['G0','G1'], 'seed-upsemcl': ['G1','G2','G3'], 'seed-multiplicator': ['G3','G4','R1','R2'], 'seed-quotataire': ['R2'] }

/* ── Couleurs nœud généalogie par rôle acteur ── */
const ROLE_NODE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  'seed-selector':      { bg: '#e8f5e9', border: '#1B5E20', label: 'Sélectionneur' },
  'seed-upsemcl':        { bg: '#e8f5e9', border: '#388E3C', label: 'UPSemCL' },
  'seed-multiplicator': { bg: '#f1f8e9', border: '#66BB6A', label: 'Multiplicateur' },
  'seed-admin':         { bg: '#f3e5f5', border: '#7c3aed', label: 'Admin' },
}


function LineageModal({ chain, codeLot, onClose }: { chain: any[]; codeLot: string; onClose: () => void }) {
  return (
    <Modal title={"Traçabilité : " + codeLot} subtitle={"Chaîne générationnelle : " + chain.length + " génération(s)"} onClose={onClose} size="lg">
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
        {chain.map((node, i) => {
          const gen = node.generation || '?'
          const isLast = i === chain.length - 1
          const roleColors = ROLE_NODE_COLORS[node.responsableRole] || { bg: '#f9fafb', border: '#e5e7eb', label: '' }
          return (
            <React.Fragment key={node.lotId || i}>
              <div style={{
                background: GEN_BG[gen] || '#f9fafb',
                border: `2px solid ${node.responsableRole ? roleColors.border : (GEN_BORDER[gen] || '#e5e7eb')}`,
                borderRadius: 10, padding: '14px 16px', minWidth: 170, flex: '0 0 auto',
                boxShadow: isLast ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span className={"badge " + (GEN_COLORS[gen] || 'badge-gray')} style={{ fontSize: 11 }}>{gen}</span>
                  {isLast && <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Actuel</span>}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, wordBreak: 'break-all' }}>{node.codeLot}</div>

                {/* Phase 1 : Informations acteur */}
                {node.responsableNom && (
                  <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: '6px 8px', marginBottom: 6, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={10} />
                      {node.responsableNom}
                    </div>
                    {node.responsableRole && (
                      <div style={{ fontSize: 10, color: roleColors.border, fontWeight: 600, marginTop: 2 }}>
                        {roleColors.label || node.responsableRole}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  {node.campagne && <div>Campagne: {node.campagne}</div>}
                  <div>Date: {node.dateProduction || 'N/A'}</div>
                  <div>Qté: {node.quantiteNette ? Number(node.quantiteNette).toLocaleString('fr-FR') : 'N/A'} {node.unite}</div>
                  <div>Germ: {node.tauxGermination != null ? node.tauxGermination + '%' : 'N/A'}</div>
                  <div>Pureté: {node.puretePhysique != null ? node.puretePhysique + '%' : 'N/A'}</div>
                </div>
              </div>
              {!isLast && <div style={{ display: 'flex', alignItems: 'center', padding: '0 3px', color: '#9ca3af', flexShrink: 0 }}><ChevronRight size={16} /></div>}
            </React.Fragment>
          )
        })}
      </div>
      <div style={{ marginTop: 20, padding: '14px 18px', background: '#f8faf8', borderRadius: 8, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Générations</div><div style={{ fontSize: 22, fontWeight: 700 }}>{chain.length}</div></div>
        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Lot origine</div><div style={{ fontSize: 12, fontWeight: 600 }}>{chain[0]?.codeLot}</div></div>
        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Germination finale</div><div style={{ fontSize: 22, fontWeight: 700 }}>{chain[chain.length - 1]?.tauxGermination ?? 'N/A'}%</div></div>
        {chain[0]?.responsableNom && (
          <div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Producteur initial</div><div style={{ fontSize: 12, fontWeight: 600 }}>{chain[0].responsableNom}</div></div>
        )}
      </div>

      {/* Légende */}
      <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-muted)' }}>
        {Object.entries(ROLE_NODE_COLORS).filter(([_, v]) => v.label).map(([_, v]) => (
          <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, border: `2px solid ${v.border}`, background: v.bg }} />
            <span>{v.label}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function Lots({ roleKey, userSpecialisation }: Props) {
  const [lots, setLots] = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [generation, setGeneration] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [lineageChain, setLineageChain] = useState<any[] | null>(null)
  const [lineageLotCode, setLineageLotCode] = useState('')
  const [lineageLoading, setLineageLoading] = useState<number|null>(null)
  const [showNewLot, setShowNewLot] = useState(false)
  const [showChildLot, setShowChildLot] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [parentLot, setParentLot] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [showReception, setShowReception] = useState(false)
  const [receptionForm, setReceptionForm] = useState({ siteCode: '', quantite: '', unite: 'kg', dateReception: '' })
  // Cache des Bordereaux générés (lotId → data PDF) pour re-téléchargement
  const [bordereauCache, setBordereauCache] = useState<Map<number, TransferDocData>>(new Map())
  const allowedGens = ROLE_GENERATIONS[roleKey] || ALL_GENS
  const canCreate   = ['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey)
  // Pour seed-upsemcl : toujours autorisé.
  // Pour seed-selector : autorisé uniquement si la spécialisation correspond à l'espèce du lot.
  function canTransferLot(lot: any): boolean {
    if (roleKey === 'seed-upsemcl') return true
    if (roleKey === 'seed-selector') {
      if (!userSpecialisation) return true
      const variety = varieties.find((v: any) => v.id === lot.idVariete)
      const codeEspece: string | undefined = variety?.espece?.codeEspece
      if (!codeEspece) return true   // espèce inconnue → on laisse passer
      return codeEspece.toUpperCase() === userSpecialisation.toUpperCase()
    }
    return false
  }
  const canChild    = ['seed-admin','seed-upsemcl','seed-multiplicator'].includes(roleKey)
  const canReception = roleKey === 'seed-quotataire'

  const [newLotForm, setNewLotForm] = useState({ codeLot: '', idVariete: '', generationCode: 'G0', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '', statutLot: 'DISPONIBLE' })
  const [childForm, setChildForm] = useState({ codeLot: '', generationCode: '', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '' })
  const [transferForm, setTransferForm] = useState({ usernameDestinataire: '', roleDestinataire: '', quantite: '', observations: '' })
  const [membres, setMembres] = useState<any[]>([])

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
    api.get(endpoints.membres).then(r => setMembres(r.data)).catch(() => {})
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
      setToast({ msg: "Lot " + newLotForm.codeLot + " créé avec succès", type: 'success' })
      setShowNewLot(false)
      setNewLotForm({ codeLot: '', idVariete: '', generationCode: 'G0', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '', statutLot: 'DISPONIBLE' })
      fetchLots()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la création', type: 'error' })
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
      setToast({ msg: "Lot enfant " + childForm.codeLot + " créé", type: 'success' })
      setShowChildLot(false); fetchLots()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  const ROLE_LABEL_MAP: Record<string, string> = {
    'seed-selector': 'Sélectionneur ISRA', 'seed-upsemcl': 'UPSem-CL',
    'seed-multiplicator': 'Multiplicateur', 'seed-quotataire': 'Quotataire / OP',
    'seed-admin': 'Administrateur ISRA',
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault(); if (!parentLot) return; setSaving(true)
    try {
      const resp = await api.post(endpoints.lotTransfer(parentLot.id), {
        usernameDestinataire: transferForm.usernameDestinataire,
        roleDestinataire: transferForm.roleDestinataire,
        quantite: transferForm.quantite ? Number(transferForm.quantite) : undefined,
        observations: transferForm.observations,
      })
      const savedTransfert = resp.data

      // Construire et mémoriser les données PDF
      const jwt   = keycloak.tokenParsed as Record<string, unknown>
      const fn    = (jwt?.given_name  as string) ?? ''
      const ln    = (jwt?.family_name as string) ?? ''
      const nom   = [fn, ln].filter(Boolean).join(' ') || (jwt?.preferred_username as string) || roleKey

      const variety   = varieties.find(v => v.id === parentLot.idVariete)
      const espece    = variety?.espece
      const lotPdf: LotPdfData = {
        codeLot:          parentLot.codeLot,
        nomVariete:       variety?.nomVariete ?? '—',
        nomEspece:        espece?.nomCommun ?? espece?.codeEspece ?? '—',
        generationCode:   parentLot.generation?.codeGeneration ?? '?',
        quantiteNette:    parentLot.quantiteNette,
        unite:            parentLot.unite ?? 'kg',
        tauxGermination:  parentLot.tauxGermination ?? undefined,
        puretePhysique:   parentLot.puretePhysique  ?? undefined,
        statutLot:        parentLot.statutLot,
        dateProduction:   parentLot.dateProduction   ?? undefined,
        campagne:         parentLot.campagne,
        lotParentCode:    parentLot.lotParent?.codeLot,
      }
      const expPdf: PartiePdf = {
        username:  (jwt?.preferred_username as string) ?? '',
        nom,
        roleKey,
        roleLabel: ROLE_LABEL_MAP[roleKey] ?? roleKey,
      }
      const destPdf: PartiePdf = {
        username:  transferForm.usernameDestinataire,
        nom:       transferForm.usernameDestinataire,
        roleKey:   transferForm.roleDestinataire,
        roleLabel: ROLE_LABEL_MAP[transferForm.roleDestinataire] ?? transferForm.roleDestinataire,
      }
      const docData: TransferDocData = {
        type:               'BORDEREAU',
        codeTransfert:      savedTransfert.codeTransfert ?? `TL-${parentLot.id}`,
        numero:             generateNumero(savedTransfert.id ?? parentLot.id),
        lot:                lotPdf,
        expediteur:         expPdf,
        destinataire:       destPdf,
        quantiteTransferee: transferForm.quantite ? Number(transferForm.quantite) : parentLot.quantiteNette,
        dateDemande:        new Date().toISOString().slice(0, 10),
        observations:       transferForm.observations || undefined,
      }

      // Mémoriser pour re-téléchargement + générer immédiatement
      setBordereauCache(prev => new Map(prev).set(parentLot.id, docData))
      generateTransferDoc(docData)

      setToast({ msg: `Lot ${parentLot.codeLot} transféré — Bordereau BL-${docData.codeTransfert}.pdf téléchargé`, type: 'success' })
      setShowTransfer(false); fetchLots()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur lors du transfert'
      setToast({ msg, type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitReception(e: React.FormEvent) {
    e.preventDefault(); if (!parentLot) return; setSaving(true)
    try {
      await api.post(endpoints.movements, {
        idLot: parentLot.id,
        type: 'IN',
        siteDestinationCode: receptionForm.siteCode,
        quantite: Number(receptionForm.quantite),
        unite: receptionForm.unite,
        reference: `RECEP-R2-${parentLot.codeLot}-${receptionForm.dateReception || new Date().toISOString().slice(0,10)}`,
      })
      setToast({ msg: `Réception de ${receptionForm.quantite} ${receptionForm.unite} enregistrée`, type: 'success' })
      setShowReception(false)
      setReceptionForm({ siteCode: '', quantite: '', unite: 'kg', dateReception: '' })
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la réception', type: 'error' })
    } finally { setSaving(false) }
  }

  /* Phase 1 : appel du endpoint /lineage enrichi avec noms d'acteurs */
  async function showLineage(lot: any) {
    setLineageLoading(lot.id)
    try {
      const r = await api.get(endpoints.lotLineage(lot.id))
      setLineageChain(r.data)
      setLineageLotCode(lot.codeLot)
    } catch {
      // Fallback : construire la chaîne depuis le lot avec lotParent
      const chain: any[] = []; let cur = lot
      while (cur) { chain.unshift(cur); cur = cur.lotParent }
      setLineageChain(chain.map(n => ({
        lotId: n.id, codeLot: n.codeLot,
        generation: n.generation?.codeGeneration, campagne: n.campagne,
        dateProduction: n.dateProduction, quantiteNette: n.quantiteNette,
        unite: n.unite, tauxGermination: n.tauxGermination,
        puretePhysique: n.puretePhysique, statutLot: n.statutLot,
        responsableNom: n.responsableNom, responsableRole: n.responsableRole,
      })))
      setLineageLotCode(lot.codeLot)
    }
    finally { setLineageLoading(null) }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {lineageChain && <LineageModal chain={lineageChain} codeLot={lineageLotCode} onClose={() => setLineageChain(null)} />}

      {roleKey === 'seed-admin' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 4 }}>Chaîne :</span>
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
            <label className="filter-label">Génération</label>
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
            <thead><tr><th>Code Lot</th><th>Variété</th><th>Génération</th><th>Lot Parent</th><th>Quantité</th><th>Campagne</th><th>Producteur</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? [0,1,2,3].map(i => <tr key={i}><td colSpan={9}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
               lots.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon"><Package size={20} /></div><div className="empty-title">Aucun lot</div>{canCreate && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowNewLot(true)}>+ Créer un lot</button>}</div></td></tr>
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
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td><span className={"badge " + (GEN_COLORS[gen] || 'badge-gray')}>{gen}</span></td>
                    <td>{l.lotParent?.codeLot ? <span className="td-mono" style={{ fontSize: 11 }}>{l.lotParent.codeLot}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td><span style={{ fontWeight: 600 }}>{Number(l.quantiteNette).toLocaleString('fr-FR')}</span><span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 12 }}>{l.unite}</span></td>
                    <td style={{ fontSize: 12 }}>{l.campagne || '—'}</td>
                    {/* Phase 1 : colonne Producteur */}
                    <td>
                      {l.responsableNom ? (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{l.responsableNom}</div>
                          {l.responsableRole && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ROLE_NODE_COLORS[l.responsableRole]?.label || l.responsableRole}</div>}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td><span className={"badge " + (l.statutLot === 'DISPONIBLE' ? 'badge-green' : l.statutLot === 'TRANSFERE' ? 'badge-blue' : 'badge-gray')} style={{ fontSize: 11 }}>{l.statutLot}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ width: 30, height: 30, padding: 0, borderRadius: 6 }}
                          title="Voir traçabilité"
                          onClick={() => showLineage(l)}
                        >
                          {lineageLoading === l.id
                            ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                            : <Eye size={13} />}
                        </button>
                        {canChild && (
                          <button
                            className="btn btn-ghost"
                            style={{ width: 30, height: 30, padding: 0, borderRadius: 6 }}
                            title="Créer un Lot Enfant"
                            onClick={() => { setParentLot(l); setChildForm({ codeLot: '', generationCode: '', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '' }); setShowChildLot(true) }}
                          >
                            <GitBranch size={13} />
                          </button>
                        )}
                        {canTransferLot(l) && l.statutLot !== 'TRANSFERE' && (
                          <button
                            className="btn btn-ghost"
                            style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: 'var(--green-700)' }}
                            title="Transférer un Lot"
                            onClick={() => { setParentLot(l); setTransferForm({ usernameDestinataire: '', roleDestinataire: '', quantite: '', observations: '' }); setShowTransfer(true) }}
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                        )}
                        {l.statutLot === 'TRANSFERE' && bordereauCache.has(l.id) && (
                          <button
                            className="btn btn-ghost"
                            style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: '#0369a1' }}
                            title="Re-télécharger le Bordereau de Livraison"
                            onClick={() => {
                              const cached = bordereauCache.get(l.id)
                              if (cached) generateTransferDoc(cached)
                            }}
                          >
                            <FileText size={13} />
                          </button>
                        )}
                        {canReception && gen === 'R2' && (
                          <button
                            className="btn btn-primary"
                            style={{ width: 30, height: 30, padding: 0, borderRadius: 6 }}
                            title="Réceptionner"
                            onClick={() => { setParentLot(l); setReceptionForm({ siteCode: '', quantite: '', unite: 'kg', dateReception: '' }); setShowReception(true) }}
                          >
                            <Download size={13} />
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
      </div>

      {showNewLot && (
        <Modal title="Nouveau Lot Semencier" subtitle="Enregistrer un nouveau lot dans la chaîne semencière" onClose={() => setShowNewLot(false)}>
          <form onSubmit={submitNewLot}>
            <FormRow>
              <Field label="Code lot" required hint="Ex: G0-MIL-SOUNA3-2026"><FormInput value={newLotForm.codeLot} onChange={e => setNewLotForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} placeholder="G0-MIL-SOUNA3-2026" required /></Field>
              <Field label="Variété" required>
                <FormSelect value={newLotForm.idVariete} onChange={e => setNewLotForm(f => ({ ...f, idVariete: e.target.value }))} required>
                  <option value="">-- Choisir une variété --</option>
                  {varieties.map(v => <option key={v.id} value={v.id}>{v.codeVariete} — {v.nomVariete}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Génération" required>
                <FormSelect value={newLotForm.generationCode} onChange={e => setNewLotForm(f => ({ ...f, generationCode: e.target.value }))} required>
                  {allowedGens.map(g => <option key={g} value={g}>{g}</option>)}
                </FormSelect>
              </Field>
              <Field label="Campagne" required><FormInput value={newLotForm.campagne} onChange={e => setNewLotForm(f => ({ ...f, campagne: e.target.value }))} placeholder="2026" required /></Field>
            </FormRow>
            <FormRow>
              <Field label="Date de production"><FormInput type="date" value={newLotForm.dateProduction} onChange={e => setNewLotForm(f => ({ ...f, dateProduction: e.target.value }))} /></Field>
              <Field label="Quantité nette" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={newLotForm.quantiteNette} onChange={e => setNewLotForm(f => ({ ...f, quantiteNette: e.target.value }))} placeholder="50" min="0" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={newLotForm.unite} onChange={e => setNewLotForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}><option value="kg">kg</option><option value="t">t</option><option value="g">g</option></FormSelect>
                </div>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Taux germination (%)" required><FormInput type="number" value={newLotForm.tauxGermination} onChange={e => setNewLotForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" required /></Field>
              <Field label="Pureté physique (%)" required><FormInput type="number" value={newLotForm.puretePhysique} onChange={e => setNewLotForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="99.5" min="0" max="100" step="0.1" required /></Field>
            </FormRow>
            <Field label="Statut">
              <FormSelect value={newLotForm.statutLot} onChange={e => setNewLotForm(f => ({ ...f, statutLot: e.target.value }))}>
                <option value="DISPONIBLE">DISPONIBLE</option><option value="EN_PRODUCTION">EN_PRODUCTION</option><option value="TRANSFERE">TRANSFERE</option><option value="EPUISE">EPUISE</option>
              </FormSelect>
            </Field>
            <FormActions onCancel={() => setShowNewLot(false)} loading={saving} submitLabel="Créer le lot" />
          </form>
        </Modal>
      )}

      {showChildLot && parentLot && (
        <Modal title="Créer un Lot Enfant" subtitle={"Lot parent : " + parentLot.codeLot + " — " + parentLot.generation?.codeGeneration} onClose={() => setShowChildLot(false)}>
          <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: 'var(--green-800)' }}>
            Ce lot sera lié au lot parent et aura la génération cible sélectionnée.
          </div>
          <form onSubmit={submitChildLot}>
            <FormRow>
              <Field label="Code du lot enfant" required><FormInput value={childForm.codeLot} onChange={e => setChildForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} placeholder="G1-MIL-SOUNA3-2026" required /></Field>
              <Field label="Génération cible" required>
                <FormSelect value={childForm.generationCode} onChange={e => setChildForm(f => ({ ...f, generationCode: e.target.value }))} required>
                  <option value="">-- Sélectionner --</option>
                  {ALL_GENS.map(g => <option key={g} value={g}>{g}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Campagne" required><FormInput value={childForm.campagne} onChange={e => setChildForm(f => ({ ...f, campagne: e.target.value }))} placeholder="2026" required /></Field>
              <Field label="Date de production"><FormInput type="date" value={childForm.dateProduction} onChange={e => setChildForm(f => ({ ...f, dateProduction: e.target.value }))} /></Field>
            </FormRow>
            <FormRow>
              <Field label="Quantité nette" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={childForm.quantiteNette} onChange={e => setChildForm(f => ({ ...f, quantiteNette: e.target.value }))} placeholder="500" min="0" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={childForm.unite} onChange={e => setChildForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                </div>
              </Field>
              <Field label="Taux germination (%)"><FormInput type="number" value={childForm.tauxGermination} onChange={e => setChildForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="97.0" min="0" max="100" step="0.1" /></Field>
            </FormRow>
            <Field label="Pureté physique (%)"><FormInput type="number" value={childForm.puretePhysique} onChange={e => setChildForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" /></Field>
            <FormActions onCancel={() => setShowChildLot(false)} loading={saving} submitLabel="Créer le lot enfant" />
          </form>
        </Modal>
      )}

      {showReception && parentLot && (
        <Modal
          title="Réceptionner des semences R2"
          subtitle={`Lot : ${parentLot.codeLot} — Enregistrer la réception dans votre stock`}
          onClose={() => setShowReception(false)}
          size="sm"
        >
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#166534' }}>
            Cette action enregistre l'arrivée physique des semences R2 achetées dans votre site de stockage.
          </div>
          <form onSubmit={submitReception}>
            <Field label="Site de réception" required hint="Code du site où vous stockez les semences">
              <FormInput
                value={receptionForm.siteCode}
                onChange={e => setReceptionForm(f => ({ ...f, siteCode: e.target.value.toUpperCase() }))}
                placeholder="Ex : DEPOT-DAKAR-01"
                required
              />
            </Field>
            <FormRow>
              <Field label="Quantité reçue" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput
                    type="number"
                    value={receptionForm.quantite}
                    onChange={e => setReceptionForm(f => ({ ...f, quantite: e.target.value }))}
                    placeholder="500"
                    min="0" step="0.01" required
                    style={{ flex: 1 }}
                  />
                  <FormSelect value={receptionForm.unite} onChange={e => setReceptionForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}>
                    <option value="kg">kg</option>
                    <option value="t">t</option>
                    <option value="g">g</option>
                  </FormSelect>
                </div>
              </Field>
              <Field label="Date de réception">
                <FormInput
                  type="date"
                  value={receptionForm.dateReception}
                  onChange={e => setReceptionForm(f => ({ ...f, dateReception: e.target.value }))}
                />
              </Field>
            </FormRow>
            <FormActions onCancel={() => setShowReception(false)} loading={saving} submitLabel="Confirmer la réception" />
          </form>
        </Modal>
      )}

      {showTransfer && parentLot && (() => {
        const destRole = roleKey === 'seed-selector' ? 'seed-upsemcl' : roleKey === 'seed-upsemcl' ? 'seed-multiplicator' : ''
        const eligibles = membres.filter((m: any) => m.roleDansOrg === destRole || m.roleKeycloak === destRole)
        return (
          <Modal title="Transférer un Lot" subtitle={`${parentLot.codeLot} — ${parentLot.generation?.codeGeneration || ''}`} onClose={() => setShowTransfer(false)} size="sm">
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e' }}>
              <strong>Flux autorisé :</strong> {roleKey === 'seed-selector' ? 'Sélectionneur → UPSemCL (G0/G1)' : 'UPSemCL → Multiplicateur (G2/G3)'}
            </div>
            <form onSubmit={submitTransfer}>
              <Field label="Destinataire" required hint={destRole ? `Rôle cible : ${destRole}` : 'Rôle non autorisé'}>
                <FormSelect
                  value={transferForm.usernameDestinataire}
                  onChange={e => {
                    const m = eligibles.find((x: any) => x.keycloakUsername === e.target.value)
                    setTransferForm(f => ({ ...f, usernameDestinataire: e.target.value, roleDestinataire: m?.roleDansOrg || destRole }))
                  }}
                  required
                >
                  <option value="">— Sélectionner un destinataire —</option>
                  {eligibles.length === 0
                    ? <option disabled value="">Aucun destinataire disponible</option>
                    : eligibles.map((m: any) => (
                      <option key={m.id} value={m.keycloakUsername}>{m.keycloakUsername} — {m.organisation?.nomOrganisation || ''}</option>
                    ))
                  }
                </FormSelect>
              </Field>
              <Field label="Quantité (kg)" hint="Optionnel">
                <FormInput type="number" value={transferForm.quantite} onChange={e => setTransferForm(f => ({ ...f, quantite: e.target.value }))} placeholder="500" min="0" step="0.01" />
              </Field>
              <Field label="Observations">
                <textarea value={transferForm.observations} onChange={e => setTransferForm(f => ({ ...f, observations: e.target.value }))} placeholder="Notes sur le transfert…" style={{ width: '100%', minHeight: 70, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </Field>
              <FormActions onCancel={() => setShowTransfer(false)} loading={saving} submitLabel="Envoyer le transfert" />
            </form>
          </Modal>
        )
      })()}
    </div>
  )
}
