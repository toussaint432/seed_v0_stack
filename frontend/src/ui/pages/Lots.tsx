import React, { useEffect, useRef, useState } from 'react'
import { Package, Plus, ArrowRightLeft, GitBranch, RefreshCw, X, ChevronRight, Eye, Building2, Download, FileText, Store, Layers, ShoppingCart, CheckCircle2, Bell, Check, XCircle, Search, BadgeCheck, Upload, Trash2, ShieldCheck, ShieldX } from 'lucide-react'
import { keycloak } from '../../lib/keycloak'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { generateTransferDoc, generateNumero, type TransferDocData, type LotPdfData, type PartiePdf } from '../../lib/pdf/generateTransferDoc'

interface Props { roleKey: string; userSpecialisation?: string | null }
// Chaîne stricte G0→G1→G2→G3→G4→R1→R2
const NEXT_GEN: Record<string, string> = { G0:'G1', G1:'G2', G2:'G3', G3:'G4', G4:'R1', R1:'R2' }

function suggestChildCode(parentCode: string, parentGen: string, childGen: string): string {
  const base = parentCode.startsWith(parentGen + '-')
    ? childGen + parentCode.slice(parentGen.length)
    : childGen + '-' + parentCode
  return base + '-01'
}

const GEN_COLORS: Record<string, string> = { G0: 'badge-blue', G1: 'badge-green', G2: 'badge-gold', G3: 'badge-gray', G4: 'badge-gold', R1: 'badge-blue', R2: 'badge-green' }
const GEN_HEX: Record<string, string> = { G0: '#6366f1', G1: '#0ea5e9', G2: '#22c55e', G3: '#f59e0b', G4: '#c2410c', R1: '#ec4899', R2: '#14b8a6' }
const GEN_BG: Record<string, string> = { G0: '#eff6ff', G1: '#f0fdf4', G2: '#fef9ed', G3: '#f9fafb', G4: '#fff7ed', R1: '#eff6ff', R2: '#f0fdf4' }
const GEN_BORDER: Record<string, string> = { G0: '#bfdbfe', G1: '#bbf7d0', G2: '#fde68a', G3: '#e5e7eb', G4: '#fed7aa', R1: '#bfdbfe', R2: '#bbf7d0' }
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

/* ══════════════════════════════════════════════════════════════
   MODAL CERTIFICAT — Visualisation / Upload / Remplacement / Suppression
   Même UX que la fiche variétale : blob URL + drag-drop
   ══════════════════════════════════════════════════════════════ */
function CertificatLotModal({ lot, canManage, onClose, onUpdate }: {
  lot: any
  canManage: boolean
  onClose: () => void
  onUpdate: (updatedLot: any) => void
}) {
  const [blobUrl, setBlobUrl]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [certToast, setCertToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!lot.certificatPath) return
    setLoading(true)
    api.get(endpoints.lotCertificatUrl(lot.id), { responseType: 'blob' })
      .then(r => setBlobUrl(URL.createObjectURL(r.data)))
      .catch(() => setCertToast({ msg: 'Impossible de charger le certificat', type: 'error' }))
      .finally(() => setLoading(false))
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [lot.id, lot.certificatPath])

  async function doUpload(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await api.post(endpoints.lotCertificatUpload(lot.id), form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onUpdate(r.data)
      setCertToast({ msg: 'Certificat enregistré', type: 'success' })
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      const r2 = await api.get(endpoints.lotCertificatUrl(lot.id), { responseType: 'blob' })
      setBlobUrl(URL.createObjectURL(r2.data))
    } catch (err: any) {
      setCertToast({ msg: err?.response?.data?.message || 'Erreur lors de l\'upload', type: 'error' })
    } finally { setUploading(false) }
  }

  async function doDelete() {
    if (!confirm('Supprimer définitivement ce certificat ?')) return
    setUploading(true)
    try {
      await api.delete(endpoints.lotCertificatDelete(lot.id))
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      setBlobUrl(null)
      onUpdate({ ...lot, certificatPath: null })
      setCertToast({ msg: 'Certificat supprimé', type: 'success' })
    } catch (err: any) {
      setCertToast({ msg: err?.response?.data?.message || 'Erreur lors de la suppression', type: 'error' })
    } finally { setUploading(false) }
  }

  function doDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    const ext = lot.certificatPath?.split('.').pop() || 'pdf'
    a.download = `certificat-${lot.codeLot}.${ext}`
    a.click()
  }

  const isPdf = lot.certificatPath?.toLowerCase().endsWith('.pdf')

  return (
    <Modal
      title={`Certificat — ${lot.codeLot}`}
      subtitle="Certification officielle du lot semencier"
      onClose={onClose}
      size="lg"
    >
      {certToast && <Toast message={certToast.msg} type={certToast.type} onClose={() => setCertToast(null)} />}

      {/* Chargement */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <RefreshCw size={28} style={{ color: 'var(--green-600)', animation: 'spin 0.9s linear infinite' }} />
        </div>
      )}

      {/* Visionneuse */}
      {!loading && blobUrl && (
        <div>
          {isPdf
            ? <iframe src={blobUrl} title="Certificat" style={{ width: '100%', height: 480, border: 'none', borderRadius: 8, background: '#f5f5f5' }} />
            : <img src={blobUrl} alt="Certificat" style={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 8, background: '#f5f5f5' }} />
          }
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={doDownload} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Download size={13} /> Télécharger
            </button>
            {canManage && (
              <>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Upload size={13} /> Remplacer
                  <input
                    type="file" hidden
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f) }}
                  />
                </label>
                <button
                  className="btn btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: 5 }}
                  onClick={doDelete}
                  disabled={uploading}
                >
                  <Trash2 size={13} /> Supprimer
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Zone d'upload (pas de certificat) */}
      {!loading && !blobUrl && canManage && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) doUpload(f) }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--green-500,#22c55e)' : 'var(--border)'}`,
            borderRadius: 10, padding: '44px 24px', textAlign: 'center',
            background: dragOver ? 'var(--green-50,#f0fdf4)' : 'var(--surface-2)',
            transition: 'all 0.15s', cursor: uploading ? 'wait' : 'pointer',
          }}
        >
          <input
            ref={fileRef} type="file" hidden
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
            onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f) }}
          />
          <BadgeCheck size={36} style={{ color: uploading ? 'var(--text-muted)' : 'var(--green-600,#16a34a)', marginBottom: 14 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {uploading ? 'Envoi en cours…' : 'Déposer le certificat ici'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            PDF, JPG, PNG, WEBP — cliquez ou glissez-déposez
          </div>
        </div>
      )}

      {/* Pas de certificat + lecture seule */}
      {!loading && !blobUrl && !canManage && (
        <div style={{ textAlign: 'center', padding: '44px 24px', color: 'var(--text-muted)' }}>
          <BadgeCheck size={36} style={{ marginBottom: 14, opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>Aucun certificat disponible pour ce lot.</div>
        </div>
      )}
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════
   GRAPHIQUE HORIZONTAL — Production par variété × génération
   ══════════════════════════════════════════════════════════════ */
interface HorizDatum { label: string; gens: Record<string, number> }

function MesLotsHorizChart({ data, gens }: { data: HorizDatum[]; gens: string[] }) {
  const [tip, setTip] = useState<{ label: string; gens: Record<string,number>; x: number; y: number } | null>(null)

  if (data.length === 0) return null

  const maxTotal = Math.max(...data.map(d => gens.reduce((s, g) => s + (d.gens[g] ?? 0), 0)), 1)
  const fmtK = (v: number) => v >= 1_000_000 ? (v/1_000_000).toFixed(1)+'M' : v >= 1_000 ? (v/1_000).toFixed(0)+'k' : String(v)
  const ROW_H = 36, LABEL_W = 120, BAR_W = 420, PAD = 16, H = data.length * ROW_H + PAD * 2
  const W = LABEL_W + BAR_W + 80

  return (
    <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', position: 'relative' }}
      onMouseLeave={() => setTip(null)}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        Production par variété
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 200, overflow: 'visible' }}>
        <defs>
          {gens.map(g => (
            <linearGradient key={g} id={`hz-${g}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={GEN_HEX[g] ?? '#6b7280'} stopOpacity={0.85} />
              <stop offset="100%" stopColor={GEN_HEX[g] ?? '#6b7280'} stopOpacity={0.45} />
            </linearGradient>
          ))}
        </defs>

        {data.map((d, i) => {
          const y0     = PAD + i * ROW_H
          const total  = gens.reduce((s, g) => s + (d.gens[g] ?? 0), 0)
          const isHov  = tip?.label === d.label
          let curX = LABEL_W + 8

          return (
            <g key={i}
              onMouseEnter={e => {
                const svg  = (e.currentTarget as SVGElement).closest('svg')!
                const rect = svg.getBoundingClientRect()
                const pct  = (e.clientX - rect.left) / rect.width
                const svgX = pct * W
                setTip({ label: d.label, gens: d.gens, x: svgX, y: y0 })
              }}
              style={{ cursor: 'pointer' }}>
              {/* Hover strip */}
              <rect x={0} y={y0} width={W} height={ROW_H - 2} rx={4} fill={isHov ? 'var(--surface-2)' : 'transparent'} />
              {/* Variety label */}
              <text x={LABEL_W - 6} y={y0 + ROW_H / 2 + 4} fontSize={10.5} fill="var(--text-primary)"
                textAnchor="end" fontWeight={isHov ? 700 : 500}>
                {d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}
              </text>
              {/* Stacked horizontal bars */}
              {gens.map(g => {
                const qty = d.gens[g] ?? 0
                if (qty <= 0) return null
                const bw = (qty / maxTotal) * BAR_W
                const bx = curX
                curX += bw
                const barY = y0 + 10
                const barH = ROW_H - 22
                return (
                  <g key={g}>
                    <rect x={bx} y={barY} width={bw} height={barH} rx={3}
                      fill={`url(#hz-${g})`}
                      opacity={tip && !isHov ? 0.3 : 1}
                      style={{ transition: 'opacity 0.12s' }} />
                  </g>
                )
              })}
              {/* Total label at right */}
              <text x={LABEL_W + 8 + (total / maxTotal) * BAR_W + 6} y={y0 + ROW_H / 2 + 4}
                fontSize={9.5} fill="var(--text-muted)" fontWeight={600}
                opacity={tip && !isHov ? 0.3 : 1}>
                {fmtK(total)} kg
              </text>
            </g>
          )
        })}
      </svg>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {gens.map(g => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: GEN_HEX[g] ?? '#6b7280' }} />
            {g}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tip && (
        <div style={{
          position: 'absolute',
          left: `${Math.min(Math.max(tip.x / (LABEL_W + BAR_W + 80) * 100, 10), 80)}%`,
          top: `${tip.y / (data.length * ROW_H + PAD * 2) * 100}%`,
          transform: 'translate(-50%, calc(-100% - 8px))',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12,
          pointerEvents: 'none', zIndex: 60,
          boxShadow: '0 6px 20px rgba(0,0,0,0.16)', whiteSpace: 'nowrap', minWidth: 150,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{tip.label}</div>
          {gens.filter(g => (tip.gens[g] ?? 0) > 0).map(g => (
            <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: GEN_HEX[g] ?? '#6b7280', flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--text-muted)' }}>{g}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', paddingLeft: 8 }}>
                {(tip.gens[g] ?? 0).toLocaleString('fr-FR')} kg
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 5, paddingTop: 4, fontWeight: 700, fontSize: 11, display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
            <span>Total</span>
            <span>{gens.reduce((s, g) => s + (tip.gens[g] ?? 0), 0).toLocaleString('fr-FR')} kg</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE MULTIPLICATEUR — Catalogue G3 + Mes Lots isolés
   ══════════════════════════════════════════════════════════════ */
function VueLotsMultiplicateur({ setToast }: { setToast: (t: { msg: string; type: 'success'|'error' }) => void }) {
  const [onglet, setOnglet]           = useState<'catalogue'|'meslots'>('catalogue')
  const [catalogueG3, setCatalogueG3] = useState<any[]>([])
  const [mesLots, setMesLots]         = useState<any[]>([])
  const [monStock, setMonStock]       = useState<any[]>([])
  const [varieties, setVarieties]     = useState<any[]>([])
  const [upsemclOrgId, setUpsemclOrgId] = useState<number | null>(null)
  const [loadingCat, setLoadingCat]   = useState(true)
  const [loadingMes, setLoadingMes]   = useState(true)
  const [showCommande, setShowCommande] = useState(false)
  const [commandeLot, setCommandeLot] = useState<any>(null)
  const [cmdForm, setCmdForm]         = useState({ quantite: '', unite: 'kg', observations: '' })
  const [saving, setSaving]           = useState(false)
  const [lineageChain, setLineageChain]   = useState<any[] | null>(null)
  const [lineageLotCode, setLineageLotCode] = useState('')
  const [searchCat, setSearchCat]     = useState('')
  const [searchMes, setSearchMes]       = useState('')
  const [filterGenMes, setFilterGenMes]     = useState('')
  const [filterStatutMes, setFilterStatutMes] = useState('')
  const [filterCampagneMes, setFilterCampagneMes] = useState('')
  // Transferts G3 EN_ATTENTE reçus par l'UPSemCL — en attente d'acceptation
  const [transfertsRecus, setTransfertsRecus] = useState<any[]>([])

  // ── Certificat lot ────────────────────────────────────────
  const [certLotMult, setCertLotMult] = useState<any | null>(null)

  // ── Gestion lots multiplicateur ────────────────────────────
  const [showNewLot, setShowNewLot]     = useState(false)
  const [showChildLot, setShowChildLot] = useState(false)
  const [parentLot, setParentLot]       = useState<any>(null)
  const [sites, setSites]               = useState<any[]>([])
  const MULT_NEW_FORM_INIT = {
    codeLot: '', idVariete: '', generationCode: 'G3',
    campagne: new Date().getFullYear().toString(),
    dateProduction: '', quantiteNette: '', unite: 'kg',
    tauxGermination: '', puretePhysique: '',
    superficieHa: '', productionBruteKg: '', cycle: 'C', niveauSemence: ''
  }
  const [newLotForm, setNewLotForm] = useState(MULT_NEW_FORM_INIT)
  const MULT_CHILD_FORM_INIT = {
    codeLot: '', generationCode: 'R1',
    campagne: new Date().getFullYear().toString(),
    dateProduction: '', quantiteNette: '', unite: 'kg',
    tauxGermination: '', puretePhysique: '',
    quantiteSemenceSrcKg: '', superficieHa: '', productionBruteKg: '',
    cycle: 'C', niveauSemence: '', siteCode: ''
  }
  const [childForm, setChildForm] = useState(MULT_CHILD_FORM_INIT)

  async function fetchAll() {
    setLoadingCat(true); setLoadingMes(true)
    api.get(endpoints.sites).then(r => setSites(r.data)).catch(() => {})
    const [catRes, mesRes, stockRes, varRes, orgRes, trRecus] = await Promise.allSettled([
      api.get(endpoints.lotsCatalogueG3),
      api.get(endpoints.lotsMesLots),
      api.get(endpoints.stockMonStock),
      api.get(endpoints.varieties),
      api.get(endpoints.organisations),
      // Transferts G3 EN_ATTENTE destinés au multiplicateur connecté
      api.get(endpoints.transfertsRecus),
    ])
    setCatalogueG3(catRes.status === 'fulfilled' ? catRes.value.data : [])
    setLoadingCat(false)
    // Tri: lots propres par createdAt DESC, lots reçus par transfert remontés selon leur stock
    const rawLots: any[] = mesRes.status === 'fulfilled' ? mesRes.value.data : []
    const rawStock: any[] = stockRes.status === 'fulfilled' ? stockRes.value.data : []
    const stockDateByLot: Record<number, string> = {}
    rawStock.forEach((st: any) => {
      const lid = st.idLot ?? st.lot?.id
      if (!lid) return
      if (!stockDateByLot[lid] || st.createdAt > stockDateByLot[lid]) stockDateByLot[lid] = st.createdAt
    })
    rawLots.sort((a, b) => {
      const da = stockDateByLot[a.id] ?? a.createdAt ?? ''
      const db = stockDateByLot[b.id] ?? b.createdAt ?? ''
      return da > db ? -1 : da < db ? 1 : 0
    })
    setMesLots(rawLots)
    setMonStock(rawStock)
    setLoadingMes(false)
    setVarieties(varRes.status === 'fulfilled' ? varRes.value.data : [])
    setTransfertsRecus(trRecus.status === 'fulfilled' ? trRecus.value.data : [])
    if (orgRes.status === 'fulfilled') {
      const upsemcl = orgRes.value.data.find((o: any) =>
        o.typeOrganisation?.toUpperCase() === 'UPSEMCL' && o.active !== false
      )
      setUpsemclOrgId(upsemcl?.id ?? null)
    }
  }

  // Accepter un transfert G3 entrant — le lot apparaît ensuite dans Mes Lots
  async function accepterTransfert(id: number, code: string) {
    try {
      await api.put(endpoints.transfertAccepter(id))
      setToast({ msg: `Transfert ${code} accepté — le lot G3 est maintenant dans vos lots`, type: 'success' })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de l\'acceptation', type: 'error' })
    }
  }

  // Refuser un transfert entrant
  async function refuserTransfert(id: number, code: string) {
    try {
      await api.put(endpoints.transfertRefuser(id), { motif: 'Refusé par le multiplicateur' })
      setToast({ msg: `Transfert ${code} refusé`, type: 'success' })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors du refus', type: 'error' })
    }
  }

  useEffect(() => { fetchAll() }, [])

  const varietyMap: Record<number, any> = Object.fromEntries(varieties.map(v => [v.id, v]))

  async function submitNewLot(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const selectedVariety = varieties.find((v: any) => v.id === Number(newLotForm.idVariete))
      await api.post(endpoints.lots, {
        codeLot: newLotForm.codeLot,
        idVariete: Number(newLotForm.idVariete),
        generation: { id: GEN_IDS[newLotForm.generationCode] },
        campagne: newLotForm.campagne,
        dateProduction: newLotForm.dateProduction || undefined,
        quantiteNette: Number(newLotForm.quantiteNette),
        unite: newLotForm.unite,
        tauxGermination: newLotForm.tauxGermination ? Number(newLotForm.tauxGermination) : undefined,
        puretePhysique: newLotForm.puretePhysique ? Number(newLotForm.puretePhysique) : undefined,
        superficieHa: newLotForm.superficieHa ? Number(newLotForm.superficieHa) : null,
        productionBruteKg: newLotForm.productionBruteKg ? Number(newLotForm.productionBruteKg) : null,
        cycle: newLotForm.cycle || null,
        niveauSemence: newLotForm.niveauSemence || null,
        codeEspece: selectedVariety?.espece?.codeEspece ?? null,
      })
      setToast({ msg: `Lot ${newLotForm.codeLot} enregistré`, type: 'success' })
      setShowNewLot(false); setNewLotForm(MULT_NEW_FORM_INIT); fetchAll()
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message
        || (status === 409 ? `Code lot déjà utilisé — modifiez le code (ex : -02, -03…)` : 'Erreur lors de la création du lot')
      setToast({ msg, type: 'error' })
    } finally { setSaving(false) }
  }

  async function submitChildLot(e: React.FormEvent) {
    e.preventDefault(); if (!parentLot) return; setSaving(true)
    try {
      await api.post(endpoints.lotChild(parentLot.id), {
        codeLot: childForm.codeLot,
        idVariete: parentLot.idVariete,
        generationCode: childForm.generationCode,
        campagne: childForm.campagne,
        dateProduction: childForm.dateProduction || undefined,
        quantiteNette: Number(childForm.quantiteNette),
        unite: childForm.unite,
        tauxGermination: childForm.tauxGermination ? Number(childForm.tauxGermination) : undefined,
        puretePhysique: childForm.puretePhysique ? Number(childForm.puretePhysique) : undefined,
        codeEspece: parentLot.codeEspece ?? null,
        quantiteSemenceSrcKg: childForm.quantiteSemenceSrcKg ? Number(childForm.quantiteSemenceSrcKg) : undefined,
        superficieHa: childForm.superficieHa ? Number(childForm.superficieHa) : undefined,
        productionBruteKg: childForm.productionBruteKg ? Number(childForm.productionBruteKg) : undefined,
        cycle: childForm.cycle || undefined,
        niveauSemence: childForm.niveauSemence || undefined,
        siteCode: childForm.siteCode || undefined,
      })
      setToast({ msg: `Lot ${childForm.codeLot} créé (${childForm.generationCode})${childForm.siteCode ? ' · stock synchronisé' : ''}`, type: 'success' })
      setShowChildLot(false); setChildForm(MULT_CHILD_FORM_INIT); fetchAll()
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message || err?.response?.data?.detail
        || (status === 409 ? `Code lot déjà utilisé — modifiez le suffixe (ex : -02, -03…)` : status === 400 ? 'Données invalides — vérifiez les champs.' : 'Erreur création lot enfant')
      setToast({ msg, type: 'error' })
    } finally { setSaving(false) }
  }

  // Catalogue G3 filtré par recherche
  const catFiltered = catalogueG3.filter(l => {
    if (!searchCat) return true
    const v = varietyMap[l.idVariete]
    const term = searchCat.toLowerCase()
    return l.codeLot?.toLowerCase().includes(term)
        || v?.nomVariete?.toLowerCase().includes(term)
        || v?.codeVariete?.toLowerCase().includes(term)
  })

  // KPIs mes lots
  const mesLotsG3    = mesLots.filter(l => l.generation?.codeGeneration === 'G3').length
  const mesLotsG4    = mesLots.filter(l => l.generation?.codeGeneration === 'G4').length
  const mesLotsR1    = mesLots.filter(l => l.generation?.codeGeneration === 'R1').length
  const mesLotsR2    = mesLots.filter(l => l.generation?.codeGeneration === 'R2').length
  const mesLotsR1R2  = mesLotsR1 + mesLotsR2
  const stockTotal   = monStock.reduce((s: number, st: any) => s + Number(st.quantiteDisponible || 0), 0)

  const ML_GENS = ['G3', 'G4', 'R1', 'R2']

  // Map: lot id → liste de stocks disponibles
  const stockByLotId: Record<number, { qty: number; site: string }[]> = {}
  monStock.forEach((st: any) => {
    const lid = st.idLot ?? st.lot?.id
    if (!lid) return
    if (!stockByLotId[lid]) stockByLotId[lid] = []
    stockByLotId[lid].push({ qty: Number(st.quantiteDisponible || 0), site: st.site?.nomSite || st.site?.codeSite || '' })
  })

  // Org ID du multiplicateur lui-même, dérivé de ses propres lots G4/R1/R2
  // (ces générations sont TOUJOURS produites par le multiplicateur, jamais reçues de l'extérieur)
  // Permet de détecter les lots reçus sans dépendre de l'endpoint organisations.
  const multOwnOrgId: number | null =
    mesLots.find(l =>
      ['G4','R1','R2'].includes(l.generation?.codeGeneration ?? '') && l.idOrgProducteur != null
    )?.idOrgProducteur ?? null

  // Retourne true si le lot a été produit par une org externe (reçu par transfert)
  const isExternalLot = (lot: any): boolean =>
    multOwnOrgId != null && lot.idOrgProducteur != null && lot.idOrgProducteur !== multOwnOrgId

  const mesLotsFiltered = mesLots.filter(l => {
    if (filterGenMes    && l.generation?.codeGeneration !== filterGenMes) return false
    if (filterStatutMes && l.statutLot !== filterStatutMes) return false
    if (filterCampagneMes && (l.campagne ?? '—') !== filterCampagneMes) return false
    if (!searchMes) return true
    const v = varietyMap[l.idVariete]
    const term = searchMes.toLowerCase()
    return l.codeLot?.toLowerCase().includes(term)
        || v?.nomVariete?.toLowerCase().includes(term)
        || l.generation?.codeGeneration?.toLowerCase().includes(term)
  })

  const mesLotsStatuts  = [...new Set(mesLots.map(l => l.statutLot).filter(Boolean))].sort() as string[]
  const mesLotsCampagnes = [...new Set(mesLots.map(l => l.campagne ?? '—').filter(Boolean))].sort().reverse() as string[]
  const hasActiveFilter = !!(filterGenMes || filterStatutMes || filterCampagneMes || searchMes)
  function resetAllFilters() { setFilterGenMes(''); setFilterStatutMes(''); setFilterCampagneMes(''); setSearchMes('') }

  // Données graphique : production/réception par variété × génération
  const lotsChartData = (() => {
    const agg: Record<string, Record<string, number>> = {}
    mesLots.forEach(l => {
      const vname = varietyMap[l.idVariete]?.nomVariete ?? ('Var#' + l.idVariete)
      const gen   = l.generation?.codeGeneration ?? '?'
      const isUpsemcl = isExternalLot(l)
      const qty   = isUpsemcl
        ? (stockByLotId[l.id] ?? []).reduce((a, x) => a + x.qty, 0)
        : Number(l.quantiteNette || 0)
      if (!agg[vname]) agg[vname] = {}
      agg[vname][gen] = (agg[vname][gen] ?? 0) + qty
    })
    return Object.entries(agg)
      .map(([label, gens]) => ({ label, gens }))
      .sort((a, b) => {
        const tA = ML_GENS.reduce((s, g) => s + (a.gens[g] ?? 0), 0)
        const tB = ML_GENS.reduce((s, g) => s + (b.gens[g] ?? 0), 0)
        return tB - tA
      })
  })()
  const lotsChartGens = ML_GENS.filter(g => lotsChartData.some(d => (d.gens[g] ?? 0) > 0))

  const NIVEAU_SEMENCE_MULT = [
    '3 Semences de base G3',
    '3b Semences certifiées G4',
    '4 Semences Certifiés R1',
    '5 Semences Certifiés R2',
  ]

  const childGenOptions = (gen: string) => {
    if (gen === 'G3') return ['G4']
    if (gen === 'G4') return ['R1']
    if (gen === 'R1') return ['R2']
    return []
  }

  // Afficher traçabilité
  async function showLineage(lot: any) {
    try {
      const r = await api.get(endpoints.lotLineage(lot.id))
      setLineageChain(r.data); setLineageLotCode(lot.codeLot)
    } catch {
      setLineageChain([{ lotId: lot.id, codeLot: lot.codeLot, generation: lot.generation?.codeGeneration,
        dateProduction: lot.dateProduction, quantiteNette: lot.quantiteNette, unite: lot.unite,
        tauxGermination: lot.tauxGermination, puretePhysique: lot.puretePhysique, statutLot: lot.statutLot }])
      setLineageLotCode(lot.codeLot)
    }
  }

  // Commander un lot G3 (passer une demande à l'UPSemCL)
  async function submitCommande(e: React.FormEvent) {
    e.preventDefault(); if (!commandeLot) return; setSaving(true)
    try {
      const code = 'CMD-G3-' + Date.now().toString(36).toUpperCase()
      await api.post(endpoints.orders, {
        codeCommande: code,
        client: commandeLot.responsableNom || 'Multiplicateur',
        idOrganisationFournisseur: upsemclOrgId,
        observations: cmdForm.observations || `Demande G3 — lot ${commandeLot.codeLot}`,
        lignes: [{
          idVariete:   commandeLot.idVariete,
          idGeneration: 4, // G3
          quantite:    Number(cmdForm.quantite),
          unite:       cmdForm.unite,
        }],
      })
      setToast({ msg: `Demande ${code} soumise à l'UPSemCL`, type: 'success' })
      setShowCommande(false); setCmdForm({ quantite: '', unite: 'kg', observations: '' })
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la demande', type: 'error' })
    } finally { setSaving(false) }
  }

  const tabBtn = (key: 'catalogue'|'meslots', icon: React.ReactNode, label: string, count?: number) => (
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
      {lineageChain && <LineageModal chain={lineageChain} codeLot={lineageLotCode} onClose={() => setLineageChain(null)} />}
      {certLotMult && (
        <CertificatLotModal
          lot={certLotMult}
          canManage={true}
          onClose={() => setCertLotMult(null)}
          onUpdate={updated => {
            setMesLots(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))
            setCertLotMult((prev: any) => prev ? { ...prev, ...updated } : prev)
          }}
        />
      )}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Store size={18} /></div>
          <div className="stat-body"><div className="stat-value">{loadingCat ? '…' : catalogueG3.length}</div><div className="stat-label">Lots G3 disponibles</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Layers size={18} /></div>
          <div className="stat-body"><div className="stat-value">{loadingMes ? '…' : mesLotsG3 + mesLotsG4}</div><div className="stat-label">Mes lots G3 / G4</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold"><Package size={18} /></div>
          <div className="stat-body"><div className="stat-value">{loadingMes ? '…' : mesLotsR1}</div><div className="stat-label">Mes lots R1</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={18} /></div>
          <div className="stat-body"><div className="stat-value">{loadingMes ? '…' : mesLotsR2}</div><div className="stat-label">Mes lots R2 (vente)</div></div>
        </div>
      </div>

      {/* Onglets — badge orange si transferts en attente */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 0, background: 'var(--surface-2)', borderRadius: '10px 10px 0 0', padding: '0 16px' }}>
        {tabBtn('catalogue', <Store size={14} />, 'Catalogue G3', catFiltered.length)}
        <button
          onClick={() => setOnglet('meslots')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
            borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: onglet === 'meslots' ? 'var(--surface)' : 'transparent',
            color:      onglet === 'meslots' ? 'var(--green-700)' : 'var(--text-muted)',
            borderBottom: onglet === 'meslots' ? '2px solid var(--green-600)' : '2px solid transparent',
            transition: 'all .15s', position: 'relative',
          }}
        >
          <Layers size={14} />
          Mes Lots
          <span style={{ background: onglet === 'meslots' ? 'var(--green-100)' : 'var(--surface-2)', color: onglet === 'meslots' ? 'var(--green-700)' : 'var(--text-muted)', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{mesLots.length}</span>
          {/* Badge notification rouge si transferts en attente */}
          {transfertsRecus.length > 0 && (
            <span style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {transfertsRecus.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Onglet Catalogue G3 ───────────────────────────────── */}
      {onglet === 'catalogue' && (
        <div className="card" style={{ borderRadius: '0 0 var(--radius) var(--radius)', borderTop: 'none' }}>
          <div className="card-header">
            <span className="card-title"><span className="card-title-icon"><Store size={15} /></span>Lots G3 disponibles à l'UPSemCL</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', height: 32 }}>
                <Package size={12} color="var(--text-muted)" />
                <input value={searchCat} onChange={e => setSearchCat(e.target.value)} placeholder="Rechercher variété, code lot…" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'Outfit, sans-serif', width: 180 }} />
                {searchCat && <button onClick={() => setSearchCat('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} /></button>}
              </div>
              <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
            </div>
          </div>

          <div style={{ padding: '10px 22px 6px', fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={13} />
            Sélectionnez un lot G3 et cliquez sur <strong style={{ color: 'var(--green-700)' }}>Commander</strong> pour soumettre une demande à l'UPSemCL.
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code Lot</th>
                  <th>Variété</th>
                  <th>Génération</th>
                  <th>Date production</th>
                  <th>Quantité disponible</th>
                  <th>Germination</th>
                  <th>Pureté</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingCat
                  ? [0,1,2,3].map(i => <tr key={i}><td colSpan={9}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                  : catFiltered.length === 0
                    ? <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon"><Store size={20} /></div><div className="empty-title">{searchCat ? 'Aucun résultat' : 'Aucun lot G3 disponible pour le moment'}</div></div></td></tr>
                    : catFiltered.map(l => {
                        const v = varietyMap[l.idVariete]
                        return (
                          <tr key={l.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span className="td-mono" style={{ fontWeight: 700 }}>{l.codeLot}</span>
                                {l.certificatPath
                                  ? <ShieldCheck size={13} title="Lot certifié" style={{ color: '#16a34a', flexShrink: 0 }} />
                                  : <ShieldX size={13} title="Lot non certifié" style={{ color: '#dc2626', flexShrink: 0 }} />
                                }
                              </div>
                            </td>
                            <td>
                              {v ? (
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{v.nomVariete}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.codeVariete}</div>
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)' }}>#{l.idVariete}</span>}
                            </td>
                            <td><span className="badge badge-gold">G3</span></td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.dateProduction || '—'}</td>
                            <td><span style={{ fontWeight: 700, fontSize: 13 }}>{Number(l.quantiteNette).toLocaleString('fr-FR')}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.unite}</span></td>
                            <td>
                              {l.tauxGermination != null
                                ? <span style={{ fontWeight: 600, color: Number(l.tauxGermination) >= 95 ? 'var(--green-700)' : 'var(--amber-600)' }}>{l.tauxGermination}%</span>
                                : '—'}
                            </td>
                            <td>
                              {l.puretePhysique != null
                                ? <span style={{ fontWeight: 600, color: Number(l.puretePhysique) >= 98 ? 'var(--green-700)' : 'var(--amber-600)' }}>{l.puretePhysique}%</span>
                                : '—'}
                            </td>
                            <td>
                              {(() => {
                                const stListBadge = stockByLotId[l.id] ?? []
                                const stTotalBadge = stListBadge.reduce((s, x) => s + x.qty, 0)
                                const isRecu = isExternalLot(l) && stTotalBadge > 0
                                return (
                                  <span className={`badge ${isRecu || l.statutLot === 'DISPONIBLE' ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: 11 }}>
                                    {isRecu ? 'REÇU' : l.statutLot}
                                  </span>
                                )
                              })()}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost" style={{ width: 30, height: 30, padding: 0, borderRadius: 6 }} title="Traçabilité" onClick={() => showLineage(l)}><Eye size={13} /></button>
                                {l.statutLot === 'DISPONIBLE' && (
                                  <button
                                    className="btn btn-primary"
                                    style={{ height: 30, padding: '0 10px', fontSize: 11, gap: 4 }}
                                    title="Commander ce lot G3"
                                    onClick={() => { setCommandeLot(l); setCmdForm({ quantite: '', unite: 'kg', observations: '' }); setShowCommande(true) }}
                                  >
                                    <ShoppingCart size={12} /> Commander
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Onglet Mes Lots ───────────────────────────────────── */}
      {onglet === 'meslots' && (
        <div className="card" style={{ borderRadius: '0 0 var(--radius) var(--radius)', borderTop: 'none' }}>
          <div className="card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span className="card-title"><span className="card-title-icon"><Layers size={15} /></span>Mes Lots — G3/G4 reçus · R1/R2 produits <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{mesLots.length}</span></span>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', height: 32 }}>
                  <Search size={12} color="var(--text-muted)" />
                  <input value={searchMes} onChange={e => setSearchMes(e.target.value)} placeholder="Code lot, variété, génération…" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'Outfit, sans-serif', width: 180 }} />
                  {searchMes && <button onClick={() => setSearchMes('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} /></button>}
                </div>
                <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => { setNewLotForm(MULT_NEW_FORM_INIT); setShowNewLot(true) }}><Plus size={13} /> Nouveau lot</button>
                <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
              </div>
            </div>
            {/* ── Barre de filtres dynamique ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Ligne 1 : Génération + Statut */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>Gén.</span>
                {ML_GENS.map(gen => {
                  const count = mesLots.filter(l => l.generation?.codeGeneration === gen).length
                  if (count === 0) return null
                  const active = filterGenMes === gen
                  const hex = GEN_HEX[gen] ?? '#6b7280'
                  return (
                    <button key={gen} onClick={() => setFilterGenMes(active ? '' : gen)} style={{
                      padding: '3px 10px', borderRadius: 20, border: '1.5px solid',
                      borderColor: active ? hex : 'var(--border)',
                      background: active ? hex + '22' : 'var(--surface)',
                      color: active ? hex : 'var(--text-muted)',
                      fontSize: 11.5, fontWeight: active ? 700 : 400, cursor: 'pointer',
                      transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? hex : 'var(--text-muted)', display: 'inline-block', flexShrink: 0 }} />
                      {gen} <span style={{ opacity: 0.6, fontSize: 10.5 }}>({count})</span>
                    </button>
                  )
                })}

                <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

                {/* Statut chips */}
                {(() => {
                  const STATUT_HEX: Record<string, string> = {
                    DISPONIBLE: '#16a34a', CERTIFIE: '#0ea5e9', EN_PRODUCTION: '#f59e0b',
                    EN_COURS_CERT: '#6366f1', TRANSFERE: '#0284c7', DECLASS: '#d97706',
                    EPUISE: '#9ca3af', RETIRE: '#ef4444', PERDU: '#dc2626',
                  }
                  return mesLotsStatuts.map(s => {
                    const count = mesLots.filter(l => l.statutLot === s).length
                    const active = filterStatutMes === s
                    const hex = STATUT_HEX[s] ?? '#6b7280'
                    return (
                      <button key={s} onClick={() => setFilterStatutMes(active ? '' : s)} style={{
                        padding: '3px 10px', borderRadius: 20, border: '1.5px solid',
                        borderColor: active ? hex : 'var(--border)',
                        background: active ? hex + '18' : 'var(--surface)',
                        color: active ? hex : 'var(--text-muted)',
                        fontSize: 11.5, fontWeight: active ? 700 : 400, cursor: 'pointer',
                        transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? hex : 'var(--text-muted)', flexShrink: 0, display: 'inline-block' }} />
                        {s} <span style={{ opacity: 0.6, fontSize: 10.5 }}>({count})</span>
                      </button>
                    )
                  })
                })()}
              </div>

              {/* Ligne 2 : Campagne select + résultat + reset */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>Campagne</span>
                <select
                  value={filterCampagneMes}
                  onChange={e => setFilterCampagneMes(e.target.value)}
                  style={{
                    height: 28, padding: '0 8px', fontSize: 12, borderRadius: 6,
                    border: filterCampagneMes ? '1.5px solid var(--green-600)' : '1px solid var(--border)',
                    background: filterCampagneMes ? 'var(--green-50,#f0fdf4)' : 'var(--surface)',
                    color: filterCampagneMes ? 'var(--green-700)' : 'var(--text-muted)',
                    cursor: 'pointer', outline: 'none', fontFamily: 'Outfit, sans-serif', fontWeight: filterCampagneMes ? 700 : 400,
                  }}
                >
                  <option value="">Toutes les campagnes</option>
                  {mesLotsCampagnes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{mesLotsFiltered.length}</span>
                  /{mesLots.length} lot{mesLots.length > 1 ? 's' : ''}
                  {hasActiveFilter && <span style={{ color: 'var(--green-700)', marginLeft: 4 }}>filtrés</span>}
                </span>

                {hasActiveFilter && (
                  <button onClick={resetAllFilters} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20, border: '1px solid #fca5a5',
                    background: '#fef2f2', color: '#dc2626',
                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <X size={10} /> Réinitialiser
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Transferts G3 en attente d'acceptation ──────────── */}
          {transfertsRecus.length > 0 && (
            <div style={{ margin: '0 0 0 0', borderBottom: '1px solid var(--border)', background: '#fef3c7', padding: '12px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Bell size={14} color="#d97706" />
                <span style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
                  {transfertsRecus.length} transfert{transfertsRecus.length > 1 ? 's' : ''} G3 en attente — acceptez pour réceptionner les lots
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transfertsRecus.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', flexWrap: 'wrap' }}>
                    <span className="badge badge-gold" style={{ fontSize: 11 }}>{t.generationTransferee}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>{t.codeTransfert}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lot #{t.idLot}</span>
                    <span style={{ fontSize: 12 }}>
                      <strong>{t.quantite != null ? Number(t.quantite).toLocaleString('fr-FR') : '—'} kg</strong>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>de <strong>{t.usernameEmetteur}</strong></span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>demandé le {t.dateDemande || '—'}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {/* Accepter → le lot G3 rejoint Mes Lots */}
                      <button
                        className="btn btn-primary"
                        style={{ height: 28, padding: '0 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => accepterTransfert(t.id, t.codeTransfert)}
                      >
                        <Check size={12} /> Accepter
                      </button>
                      {/* Refuser */}
                      <button
                        className="btn btn-secondary"
                        style={{ height: 28, padding: '0 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => refuserTransfert(t.id, t.codeTransfert)}
                      >
                        <XCircle size={12} /> Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats par génération + graphe production */}
          {mesLots.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              {/* KPI row: one card per generation */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                {ML_GENS.map(gen => {
                  const lotsGen  = mesLots.filter(l => l.generation?.codeGeneration === gen)
                  if (lotsGen.length === 0) return null
                  const lotIds   = new Set(lotsGen.map(l => l.id))
                  const stockKg  = monStock.filter((st: any) => lotIds.has(st.idLot ?? st.lot?.id)).reduce((s: number, st: any) => s + Number(st.quantiteDisponible || 0), 0)
                  // For G3/G4 received from UPSemCL use stock as primary qty; for produced lots use quantiteNette
                  const prodKg   = lotsGen.reduce((s, l) => {
                    const isUpsemcl = isExternalLot(l)
                    if (isUpsemcl) return s + (stockByLotId[l.id] ?? []).reduce((a, x) => a + x.qty, 0)
                    return s + Number(l.quantiteNette || 0)
                  }, 0)
                  const allUpsemcl = lotsGen.every(l => isExternalLot(l))
                  const hex      = GEN_HEX[gen] ?? '#6b7280'
                  const fmtQty   = (v: number) => v >= 1000 ? (v/1000).toFixed(0)+'k' : String(v)
                  return (
                    <div key={gen} onClick={() => setFilterGenMes(filterGenMes === gen ? '' : gen)}
                      style={{
                        flex: '1 1 120px', padding: '12px 16px', cursor: 'pointer',
                        background: filterGenMes === gen ? hex + '0e' : 'transparent',
                        borderRight: '1px solid var(--border)',
                        transition: 'background 0.12s',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: hex, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: hex }}>{gen}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>{lotsGen.length} lot{lotsGen.length>1?'s':''}</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                        {fmtQty(prodKg)} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{allUpsemcl ? 'kg reçus' : 'kg prod.'}</span>
                      </div>
                      {stockKg > 0 && !allUpsemcl && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--green-700)', fontWeight: 600 }}>
                          {fmtQty(stockKg)} kg stock
                        </div>
                      )}
                      {/* mini progress bar */}
                      {prodKg > 0 && (
                        <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: allUpsemcl ? '100%' : `${Math.min(100, stockKg/prodKg*100)}%`, background: hex, borderRadius: 2, transition: 'width 0.4s' }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Graphe horizontal : production par variété, couleur par génération */}
              {lotsChartData.length > 0 && lotsChartGens.length > 0 && (
                <MesLotsHorizChart data={lotsChartData} gens={lotsChartGens} />
              )}
            </div>
          )}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code Lot</th>
                  <th>Variété</th>
                  <th>Génération</th>
                  <th>Lot parent</th>
                  <th>Campagne</th>
                  <th>Enregistré le</th>
                  <th>Quantité reçue / produite</th>
                  <th>Localisation stock</th>
                  <th>Germination</th>
                  <th>Pureté</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingMes
                  ? [0,1,2,3].map(i => <tr key={i}><td colSpan={12}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                  : mesLots.length === 0
                    ? (
                      <tr><td colSpan={12}>
                        <div className="empty-state">
                          <div className="empty-icon"><Layers size={20} /></div>
                          <div className="empty-title">Aucun lot enregistré pour votre organisation</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Commandez un lot G3 dans l'onglet Catalogue, ou cliquez <strong>Nouveau lot</strong> pour enregistrer directement</div>
                          <button className="btn btn-primary" style={{ marginTop: 12, height: 32, fontSize: 12 }} onClick={() => { setNewLotForm(MULT_NEW_FORM_INIT); setShowNewLot(true) }}><Plus size={13} /> Nouveau lot G3 / G4 / R1 / R2</button>
                        </div>
                      </td></tr>
                    )
                    : mesLotsFiltered.map(l => {
                        const v = varietyMap[l.idVariete]
                        const gen = l.generation?.codeGeneration || '?'
                        const canChild = childGenOptions(gen).length > 0 && !['EPUISE','RETIRE','PERDU'].includes(l.statutLot)
                        const STATUT_BADGE: Record<string, string> = {
                          DISPONIBLE: 'badge-green', CERTIFIE: 'badge-green',
                          TRANSFERE: 'badge-blue', EN_COURS_CERT: 'badge-blue',
                          DECLASS: 'badge-gold', EN_PRODUCTION: 'badge-gold',
                        }
                        return (
                          <tr key={l.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span className="td-mono" style={{ fontWeight: 700 }}>{l.codeLot}</span>
                                {l.certificatPath && (
                                  <ShieldCheck size={13} title="Lot certifié" style={{ color: '#16a34a', flexShrink: 0 }} />
                                )}
                              </div>
                            </td>
                            <td>
                              {v ? (
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{v.nomVariete}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.codeVariete}</div>
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)' }}>#{l.idVariete}</span>}
                            </td>
                            <td><span className={`badge ${GEN_COLORS[gen] || 'badge-gray'}`}>{gen}</span></td>
                            <td>{l.lotParent?.codeLot ? <span className="td-mono" style={{ fontSize: 11 }}>{l.lotParent.codeLot}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {l.campagne || '—'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {l.createdAt ? (
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {new Date(l.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {new Date(l.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td>
                              {(() => {
                                const stList = stockByLotId[l.id] ?? []
                                const stTotal = stList.reduce((s, x) => s + x.qty, 0)
                                const isUpsemclLot = isExternalLot(l)
                                if (isUpsemclLot && stTotal > 0) {
                                  return (
                                    <div>
                                      <span style={{ fontWeight: 700, color: 'var(--green-700)', fontSize: 13 }}>{stTotal.toLocaleString('fr-FR')}</span>
                                      {' '}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>kg reçus</span>
                                      {l.quantiteNette != null && Number(l.quantiteNette) > 0 && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                          lot source : {Number(l.quantiteNette).toLocaleString('fr-FR')} kg restants
                                        </div>
                                      )}
                                    </div>
                                  )
                                }
                                return (
                                  <div>
                                    <span style={{ fontWeight: 700 }}>{l.quantiteNette != null ? Number(l.quantiteNette).toLocaleString('fr-FR') : '—'}</span>
                                    {' '}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.unite}</span>
                                    {isUpsemclLot && l.quantiteNette != null && (
                                      <div style={{ fontSize: 10, color: '#d97706', marginTop: 1 }}>lot UPSemCL — vérifier réception</div>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                            <td>
                              {(() => {
                                const stList = stockByLotId[l.id] ?? []
                                const stTotal = stList.reduce((s, x) => s + x.qty, 0)
                                const isUpsemclLot = isExternalLot(l)
                                if (stTotal <= 0) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                                if (isUpsemclLot) {
                                  // qty already shown in Quantité column — show site(s) only
                                  return (
                                    <div>
                                      {stList.map((st, idx) => st.site ? (
                                        <div key={idx} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: idx > 0 ? 2 : 0 }}>{st.site}</div>
                                      ) : null)}
                                    </div>
                                  )
                                }
                                return (
                                  <div>
                                    <span style={{ fontWeight: 700, color: 'var(--green-700)', fontSize: 13 }}>{stTotal.toLocaleString('fr-FR')}</span>
                                    {' '}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>kg</span>
                                    {stList.length > 0 && stList[0].site && (
                                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{stList[0].site}</div>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                            <td>{l.tauxGermination != null ? <span style={{ fontWeight: 600, color: Number(l.tauxGermination) >= 95 ? 'var(--green-700)' : 'var(--amber-600)' }}>{l.tauxGermination}%</span> : '—'}</td>
                            <td>{l.puretePhysique != null ? <span style={{ fontWeight: 600, color: Number(l.puretePhysique) >= 98 ? 'var(--green-700)' : 'var(--amber-600)' }}>{l.puretePhysique}%</span> : '—'}</td>
                            <td><span className={`badge ${STATUT_BADGE[l.statutLot] || 'badge-gray'}`} style={{ fontSize: 11 }}>{l.statutLot}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-ghost" style={{ width: 30, height: 30, padding: 0, borderRadius: 6 }} title="Traçabilité généalogique" onClick={() => showLineage(l)}><Eye size={13} /></button>
                                {canChild && (
                                  <button
                                    className="btn btn-ghost"
                                    style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: 'var(--green-700)' }}
                                    title={`Créer lot ${childGenOptions(gen)[0]} depuis ce ${gen}`}
                                    onClick={() => {
                                      const nextGen = childGenOptions(gen)[0]
                                      setParentLot(l)
                                      setChildForm({
                                        ...MULT_CHILD_FORM_INIT,
                                        generationCode: nextGen,
                                        codeLot: suggestChildCode(l.codeLot || '', gen, nextGen),
                                        campagne: l.campagne || new Date().getFullYear().toString(),
                                      })
                                      setShowChildLot(true)
                                    }}
                                  ><GitBranch size={13} /></button>
                                )}
                                <button
                                  className="btn btn-ghost"
                                  style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: l.certificatPath ? '#16a34a' : '#dc2626' }}
                                  title={l.certificatPath ? 'Voir / gérer le certificat' : 'Joindre un certificat'}
                                  onClick={() => setCertLotMult(l)}
                                >{l.certificatPath ? <ShieldCheck size={13} /> : <ShieldX size={13} />}</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Nouveau lot (G3 / R1 / R2) ──────────────────── */}
      {showNewLot && (
        <Modal title="Nouveau Lot" subtitle="Enregistrer un lot G3, R1 ou R2 dans votre inventaire" onClose={() => setShowNewLot(false)} size="lg">
          <form onSubmit={submitNewLot}>
            <FormRow>
              <Field label="Code lot" required>
                <FormInput value={newLotForm.codeLot} onChange={e => setNewLotForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} placeholder="G3-MIL-SOUNA3-2026" required />
              </Field>
              <Field label="Génération" required>
                <FormSelect value={newLotForm.generationCode} onChange={e => setNewLotForm(f => ({ ...f, generationCode: e.target.value }))}>
                  <option value="G3">G3 — Certifiée C1</option>
                  <option value="G4">G4 — Certifiée C2</option>
                  <option value="R1">R1</option>
                  <option value="R2">R2</option>
                </FormSelect>
              </Field>
            </FormRow>
            <Field label="Variété" required>
              <FormSelect value={newLotForm.idVariete} onChange={e => setNewLotForm(f => ({ ...f, idVariete: e.target.value }))} required>
                <option value="">— Choisir une variété —</option>
                {varieties.map((v: any) => <option key={v.id} value={v.id}>{v.codeVariete} — {v.nomVariete}</option>)}
              </FormSelect>
            </Field>
            <FormRow>
              <Field label="Campagne" required>
                <FormInput value={newLotForm.campagne} onChange={e => setNewLotForm(f => ({ ...f, campagne: e.target.value }))} placeholder="2026" required />
              </Field>
              <Field label="Date de production">
                <FormInput type="date" value={newLotForm.dateProduction} onChange={e => setNewLotForm(f => ({ ...f, dateProduction: e.target.value }))} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Production conditionnée (kg)" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={newLotForm.quantiteNette} onChange={e => setNewLotForm(f => ({ ...f, quantiteNette: e.target.value }))} placeholder="500" min="0" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={newLotForm.unite} onChange={e => setNewLotForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                </div>
              </Field>
              <Field label="Cycle">
                <FormSelect value={newLotForm.cycle} onChange={e => setNewLotForm(f => ({ ...f, cycle: e.target.value }))}>
                  <option value="C">Court (C)</option><option value="L">Long (L)</option>
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Taux germination (%)">
                <FormInput type="number" value={newLotForm.tauxGermination} onChange={e => setNewLotForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="97.0" min="0" max="100" step="0.1" />
              </Field>
              <Field label="Pureté physique (%)">
                <FormInput type="number" value={newLotForm.puretePhysique} onChange={e => setNewLotForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Superficie plantée (ha)">
                <FormInput type="number" value={newLotForm.superficieHa} onChange={e => setNewLotForm(f => ({ ...f, superficieHa: e.target.value }))} placeholder="2.0" min="0" step="0.01" />
              </Field>
              <Field label="Production brute (kg)">
                <FormInput type="number" value={newLotForm.productionBruteKg} onChange={e => setNewLotForm(f => ({ ...f, productionBruteKg: e.target.value }))} placeholder="1200" min="0" step="0.01" />
              </Field>
            </FormRow>
            {newLotForm.superficieHa && newLotForm.productionBruteKg && Number(newLotForm.superficieHa) > 0 && (
              <div style={{ padding: '7px 12px', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 6, fontSize: 12.5, color: 'var(--green-800)', marginBottom: 12 }}>
                Rendement estimé : <strong>{(Number(newLotForm.productionBruteKg) / Number(newLotForm.superficieHa)).toFixed(2)} kg/ha</strong>
              </div>
            )}
            <Field label="Niveau semence">
              <FormSelect value={newLotForm.niveauSemence} onChange={e => setNewLotForm(f => ({ ...f, niveauSemence: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {NIVEAU_SEMENCE_MULT.map(n => <option key={n} value={n}>{n}</option>)}
              </FormSelect>
            </Field>
            <FormActions onCancel={() => setShowNewLot(false)} loading={saving} submitLabel="Enregistrer le lot" />
          </form>
        </Modal>
      )}

      {/* ── Modal Lot enfant (G3→G4, G4→R1, R1→R2) ─────────────── */}
      {showChildLot && parentLot && (
        <Modal
          title={`Créer un lot ${childForm.generationCode || 'enfant'}`}
          subtitle={`Lot parent : ${parentLot.codeLot} (${parentLot.generation?.codeGeneration}) → ${childForm.generationCode}`}
          onClose={() => setShowChildLot(false)}
          size="lg"
        >
          <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: 'var(--green-800)' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <div><strong>Parent :</strong> {parentLot.codeLot} <span style={{ color: 'var(--text-muted)' }}>({parentLot.generation?.codeGeneration})</span></div>
              <div><strong>Variété :</strong> {varietyMap[parentLot.idVariete]?.nomVariete ?? `#${parentLot.idVariete}`} — <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{varietyMap[parentLot.idVariete]?.codeVariete}</span></div>
              <div><strong>Espèce :</strong> {varietyMap[parentLot.idVariete]?.espece?.nomEspece ?? '—'}</div>
              {(() => {
                const stList = stockByLotId[parentLot.id] ?? []
                const stTotal = stList.reduce((s, x) => s + x.qty, 0)
                const isUpsemcl = isExternalLot(parentLot)
                return (
                  <div>
                    <strong>Disponible :</strong>{' '}
                    {isUpsemcl && stTotal > 0
                      ? <>{stTotal.toLocaleString('fr-FR')} {parentLot.unite} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(reçus de l'UPSemCL)</span></>
                      : <>{parentLot.quantiteNette != null ? Number(parentLot.quantiteNette).toLocaleString('fr-FR') : '—'} {parentLot.unite}</>
                    }
                  </div>
                )
              })()}
            </div>
          </div>
          <form onSubmit={submitChildLot}>
            <FormRow>
              <Field label="Code lot enfant" required>
                <FormInput value={childForm.codeLot} onChange={e => setChildForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} placeholder={`${childForm.generationCode}-MIL-SOUNA3-2026`} required />
              </Field>
              <Field label="Génération cible">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: GEN_BG[childForm.generationCode] ? '#c2410c' : 'var(--text-primary)' }}>{childForm.generationCode}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— déduite automatiquement du parent ({parentLot.generation?.codeGeneration})</span>
                  <input type="hidden" value={childForm.generationCode} />
                </div>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Campagne" required>
                <FormInput value={childForm.campagne} onChange={e => setChildForm(f => ({ ...f, campagne: e.target.value }))} placeholder="2026" required />
              </Field>
              <Field label="Date de production">
                <FormInput type="date" value={childForm.dateProduction} onChange={e => setChildForm(f => ({ ...f, dateProduction: e.target.value }))} />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Production conditionnée (kg)" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={childForm.quantiteNette} onChange={e => setChildForm(f => ({ ...f, quantiteNette: e.target.value }))} placeholder="1200" min="0" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={childForm.unite} onChange={e => setChildForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                </div>
              </Field>
              <Field label="Semences utilisées (kg)" hint={`max ${parentLot.quantiteNette != null ? Number(parentLot.quantiteNette).toLocaleString('fr-FR') : '?'} kg disponibles`}>
                <FormInput
                  type="number"
                  value={childForm.quantiteSemenceSrcKg}
                  onChange={e => setChildForm(f => ({ ...f, quantiteSemenceSrcKg: e.target.value }))}
                  placeholder="200"
                  min="0.01"
                  max={parentLot.quantiteNette != null ? String(parentLot.quantiteNette) : undefined}
                  step="0.01"
                />
                {parentLot.quantiteNette != null && childForm.quantiteSemenceSrcKg && Number(childForm.quantiteSemenceSrcKg) > 0 && (() => {
                  const used = Number(childForm.quantiteSemenceSrcKg)
                  const total = Number(parentLot.quantiteNette)
                  const pct = Math.min(100, (used / total) * 100)
                  const over = used > total
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4, color: over ? '#dc2626' : 'var(--text-muted)' }}>
                        <span>{used.toLocaleString('fr-FR')} kg utilisés</span>
                        <span style={{ color: over ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                          {over ? `Dépassement de ${(used - total).toLocaleString('fr-FR')} kg !` : `${(total - used).toLocaleString('fr-FR')} kg restants`}
                        </span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: over ? '#dc2626' : pct > 80 ? '#f59e0b' : '#16a34a', transition: 'width 0.2s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                        {pct.toFixed(1)} % du lot parent ({total.toLocaleString('fr-FR')} kg {parentLot.unite})
                      </div>
                    </div>
                  )
                })()}
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Taux germination (%)">
                <FormInput type="number" value={childForm.tauxGermination} onChange={e => setChildForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="97.0" min="0" max="100" step="0.1" />
              </Field>
              <Field label="Pureté physique (%)">
                <FormInput type="number" value={childForm.puretePhysique} onChange={e => setChildForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" />
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Superficie plantée (ha)">
                <FormInput type="number" value={childForm.superficieHa} onChange={e => setChildForm(f => ({ ...f, superficieHa: e.target.value }))} placeholder="2.0" min="0" step="0.01" />
              </Field>
              <Field label="Production brute (kg)">
                <FormInput type="number" value={childForm.productionBruteKg} onChange={e => setChildForm(f => ({ ...f, productionBruteKg: e.target.value }))} placeholder="1600" min="0" step="0.01" />
              </Field>
            </FormRow>
            {childForm.superficieHa && childForm.productionBruteKg && Number(childForm.superficieHa) > 0 && (
              <div style={{ padding: '7px 12px', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 6, fontSize: 12.5, color: 'var(--green-800)', marginBottom: 12 }}>
                Rendement estimé : <strong>{(Number(childForm.productionBruteKg) / Number(childForm.superficieHa)).toFixed(2)} kg/ha</strong>
              </div>
            )}
            <Field label="Niveau semence">
              <FormSelect value={childForm.niveauSemence} onChange={e => setChildForm(f => ({ ...f, niveauSemence: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {NIVEAU_SEMENCE_MULT.map(n => <option key={n} value={n}>{n}</option>)}
              </FormSelect>
            </Field>
            <Field label="Site de stockage" hint="Optionnel — enregistre automatiquement ce lot en stock">
              <FormSelect value={childForm.siteCode} onChange={e => setChildForm(f => ({ ...f, siteCode: e.target.value }))}>
                <option value="">— Sans enregistrement stock immédiat —</option>
                {sites.map((s: any) => <option key={s.codeSite} value={s.codeSite}>{s.codeSite} — {s.nomSite}</option>)}
              </FormSelect>
            </Field>
            <FormActions onCancel={() => setShowChildLot(false)} loading={saving} submitLabel={`Créer le lot ${childForm.generationCode}`} />
          </form>
        </Modal>
      )}

      {/* Modal commande G3 */}
      {showCommande && commandeLot && (() => {
        const v = varietyMap[commandeLot.idVariete]
        return (
          <Modal
            title="Commander ce Lot G3"
            subtitle={`${commandeLot.codeLot}${v ? ` — ${v.nomVariete}` : ''}`}
            onClose={() => setShowCommande(false)}
            size="sm"
          >
            <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: 'var(--green-800)' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <div><strong>Lot :</strong> {commandeLot.codeLot}</div>
                {v && <div><strong>Variété :</strong> {v.nomVariete} ({v.codeVariete})</div>}
                <div><strong>Disponible :</strong> {Number(commandeLot.quantiteNette).toLocaleString('fr-FR')} {commandeLot.unite}</div>
                <div><strong>Germination :</strong> {commandeLot.tauxGermination ?? '—'}% · <strong>Pureté :</strong> {commandeLot.puretePhysique ?? '—'}%</div>
              </div>
            </div>
            <form onSubmit={submitCommande}>
              <Field label="Quantité demandée" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput
                    type="number"
                    value={cmdForm.quantite}
                    onChange={e => setCmdForm(f => ({ ...f, quantite: e.target.value }))}
                    placeholder={`Max ${Number(commandeLot.quantiteNette).toLocaleString('fr-FR')}`}
                    min="1"
                    max={commandeLot.quantiteNette}
                    step="0.01"
                    required
                    style={{ flex: 1 }}
                  />
                  <FormSelect value={cmdForm.unite} onChange={e => setCmdForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}>
                    <option value="kg">kg</option>
                    <option value="t">t</option>
                  </FormSelect>
                </div>
              </Field>
              <Field label="Observations">
                <textarea
                  value={cmdForm.observations}
                  onChange={e => setCmdForm(f => ({ ...f, observations: e.target.value }))}
                  placeholder="Précisions sur la demande, délai souhaité…"
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }}
                />
              </Field>
              <FormActions onCancel={() => setShowCommande(false)} loading={saving} submitLabel="Soumettre la demande" />
            </form>
          </Modal>
        )
      })()}
    </div>
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
  const [sites, setSites] = useState<any[]>([])
  // Cache des Bordereaux générés (lotId → data PDF) pour re-téléchargement
  const [bordereauCache, setBordereauCache] = useState<Map<number, TransferDocData>>(new Map())
  const allowedGens = ROLE_GENERATIONS[roleKey] || ALL_GENS
  const canCreate   = ['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey)
  // Pour seed-upsemcl : toujours autorisé.
  // Pour seed-selector : autorisé uniquement si la spécialisation correspond à l'espèce du lot.
  function canTransferLot(lot: any): boolean {
    if (roleKey === 'seed-upsemcl') return true
    if (roleKey === 'seed-selector') {
      // Seuls les lots G1 sont transférables par le sélectionneur vers l'UPSemCL
      const gen = lot.generation?.codeGeneration
      if (gen !== 'G1') return false
      // Et uniquement les lots de sa spécialisation
      if (!userSpecialisation) return true
      const variety = varieties.find((v: any) => v.id === lot.idVariete)
      const codeEspece: string | undefined = variety?.espece?.codeEspece
      if (!codeEspece) return true   // espèce inconnue → on laisse passer
      return codeEspece.toUpperCase() === userSpecialisation.toUpperCase()
    }
    return false
  }
  const canChild    = ['seed-admin','seed-upsemcl','seed-multiplicator'].includes(roleKey)
  // Sélectionneur : uniquement G0→G1 sur ses propres lots
  function canChildForLot(lot: any): boolean {
    if (canChild) return true
    if (roleKey === 'seed-selector') return lot.generation?.codeGeneration === 'G0'
    return false
  }
  const canReception = roleKey === 'seed-quotataire'

  const NEW_LOT_INIT = { codeLot: '', idVariete: '', generationCode: 'G0', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '', statutLot: 'DISPONIBLE', superficieHa: '', productionBruteKg: '', cycle: 'C', niveauSemence: '', siteCode: '' }
  const [newLotForm, setNewLotForm] = useState(NEW_LOT_INIT)
  const [childForm, setChildForm] = useState({ codeLot: '', generationCode: '', campagne: new Date().getFullYear().toString(), dateProduction: '', quantiteNette: '', unite: 'kg', tauxGermination: '', puretePhysique: '', quantiteSemenceSrcKg: '', superficieHa: '', productionBruteKg: '', cycle: 'C', niveauSemence: '', siteCode: '' })
  const [transferForm, setTransferForm] = useState({ usernameDestinataire: '', roleDestinataire: '', quantite: '', observations: '' })
  const [membres, setMembres] = useState<any[]>([])
  // Indicateur de chargement des destinataires (rafraîchi à chaque ouverture du modal)
  const [membresLoading, setMembresLoading] = useState(false)
  const [search,         setSearch]          = useState('')
  const [genFilter,      setGenFilter]       = useState('')
  const [certLot,        setCertLot]         = useState<any | null>(null)
  const canManageCert = ['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey)

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
    api.get(endpoints.sites).then(r => setSites(r.data)).catch(() => {})
  }, [generation])

  // Filtre client-side supplémentaire par spécialisation pour seed-selector
  // (double sécurité : le backend filtre déjà via findForSelector)
  const displayLots = (roleKey === 'seed-selector' && userSpecialisation)
    ? lots.filter(l => {
        const v = (varieties as any[]).find((vv: any) => vv.id === l.idVariete)
        const ce: string | undefined = v?.espece?.codeEspece
        return !ce || ce.toUpperCase() === userSpecialisation.toUpperCase()
      })
    : lots

  const genCounts = displayLots.reduce((acc: Record<string, number>, l) => {
    const g = l.generation?.codeGeneration || 'N/A'; acc[g] = (acc[g] || 0) + 1; return acc
  }, {})

  interface GenStat { count: number; totalKg: number }
  const genStats: Record<string, GenStat> = displayLots.reduce((acc: Record<string, GenStat>, l) => {
    const g = l.generation?.codeGeneration || 'N/A'
    if (!acc[g]) acc[g] = { count: 0, totalKg: 0 }
    acc[g].count++; acc[g].totalKg += Number(l.quantiteNette || 0)
    return acc
  }, {})
  const totalKg = displayLots.reduce((s, l) => s + Number(l.quantiteNette || 0), 0)
  const fmtKg = (v: number) => v >= 1_000_000 ? (v/1_000_000).toFixed(1)+'M kg' : v >= 1_000 ? (v/1_000).toFixed(0)+'k kg' : v+' kg'
  const activeGens = allowedGens.filter(g => genStats[g])

  const varietyMap: Record<number, { codeVariete: string; nomVariete: string }> =
    Object.fromEntries(varieties.map(v => [v.id, v]))

  const displayLotsFiltered = displayLots.filter(l => {
    const matchGen = !genFilter || l.generation?.codeGeneration === genFilter
    const s = search.toLowerCase()
    const v = varietyMap[l.idVariete]
    const matchSearch = !s
      || l.codeLot?.toLowerCase().includes(s)
      || v?.nomVariete?.toLowerCase().includes(s)
      || (v as any)?.codeVariete?.toLowerCase().includes(s)
    return matchGen && matchSearch
  })

  async function submitNewLot(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const selectedVariety = (varieties as any[]).find(v => v.id === Number(newLotForm.idVariete))
      const url = newLotForm.siteCode
        ? `${endpoints.lots}?siteCode=${encodeURIComponent(newLotForm.siteCode)}`
        : endpoints.lots
      await api.post(url, {
        codeLot: newLotForm.codeLot, idVariete: Number(newLotForm.idVariete),
        generation: { id: GEN_IDS[newLotForm.generationCode] || 1 },
        campagne: newLotForm.campagne, dateProduction: newLotForm.dateProduction || undefined,
        quantiteNette: Number(newLotForm.quantiteNette), unite: newLotForm.unite,
        tauxGermination: Number(newLotForm.tauxGermination), puretePhysique: Number(newLotForm.puretePhysique),
        statutLot: newLotForm.statutLot,
        codeEspece: selectedVariety?.espece?.codeEspece ?? null,
        superficieHa: newLotForm.superficieHa ? Number(newLotForm.superficieHa) : null,
        productionBruteKg: newLotForm.productionBruteKg ? Number(newLotForm.productionBruteKg) : null,
        cycle: newLotForm.cycle || null,
        niveauSemence: newLotForm.niveauSemence || null,
      })
      setToast({ msg: `Lot ${newLotForm.codeLot} créé${newLotForm.siteCode ? ' · stock synchronisé automatiquement' : ''}`, type: 'success' })
      setShowNewLot(false)
      setNewLotForm(NEW_LOT_INIT)
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
        codeEspece: parentLot.codeEspece ?? null,
        quantiteSemenceSrcKg: childForm.quantiteSemenceSrcKg ? Number(childForm.quantiteSemenceSrcKg) : undefined,
        superficieHa: childForm.superficieHa ? Number(childForm.superficieHa) : undefined,
        productionBruteKg: childForm.productionBruteKg ? Number(childForm.productionBruteKg) : undefined,
        cycle: childForm.cycle || undefined,
        niveauSemence: childForm.niveauSemence || undefined,
        siteCode: childForm.siteCode || undefined,
      })
      setToast({ msg: `Lot enfant ${childForm.codeLot} créé${childForm.siteCode ? ' · stock synchronisé' : ''}`, type: 'success' })
      setShowChildLot(false); fetchLots()
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message || err?.response?.data?.detail
        || (status === 409 ? `Code lot déjà utilisé — modifiez le suffixe (ex : -02, -03…)` : status === 400 ? 'Données invalides — vérifiez les champs.' : 'Erreur création lot enfant')
      setToast({ msg, type: 'error' })
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

  /* ── Multiplicateur : vue dédiée avec isolation par org ── */
  if (roleKey === 'seed-multiplicator') {
    return (
      <div>
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <VueLotsMultiplicateur setToast={setToast} />
      </div>
    )
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {lineageChain && <LineageModal chain={lineageChain} codeLot={lineageLotCode} onClose={() => setLineageChain(null)} />}
      {certLot && (
        <CertificatLotModal
          lot={certLot}
          canManage={canManageCert}
          onClose={() => setCertLot(null)}
          onUpdate={updated => {
            setLots(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))
            setCertLot((prev: any) => prev ? { ...prev, ...updated } : prev)
          }}
        />
      )}

      {/* ── KPI dynamiques cliquables ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(activeGens.length + 1, 5)}, 1fr)`, gap: 12, marginBottom: 16 }}>
        {/* Total */}
        <div
          onClick={() => setGenFilter('')}
          style={{
            background: !genFilter ? 'var(--green-50,#f0fdf4)' : 'var(--surface)',
            border: `1px solid ${!genFilter ? '#86efac' : 'var(--border)'}`,
            borderRadius: 12, padding: '14px 16px 16px', cursor: 'pointer',
            transition: 'all .18s', boxShadow: 'var(--shadow-xs)',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 9, flexShrink: 0,
            background: 'var(--surface-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: !genFilter ? 'var(--green-700,#15803d)' : 'var(--text-secondary)',
            transition: 'color .18s',
          }}>
            <Package size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {loading ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>…</span> : displayLots.length}
            </div>
            <div style={{ fontSize: 11, color: !genFilter ? 'var(--green-700,#15803d)' : 'var(--text-muted)', fontWeight: !genFilter ? 700 : 500 }}>
              Total lots
            </div>
            {totalKg > 0 && (
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>{fmtKg(totalKg)}</div>
            )}
          </div>
          {!genFilter && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', flexShrink: 0, marginTop: 2, boxShadow: '0 0 0 3px #16a34a25' }} />}
        </div>

        {/* Par génération */}
        {activeGens.map(gen => {
          const stat = genStats[gen]!
          const hex  = GEN_HEX[gen] ?? '#6b7280'
          const isActive = genFilter === gen
          return (
            <div
              key={gen}
              onClick={() => setGenFilter(genFilter === gen ? '' : gen)}
              style={{
                background: isActive ? hex + '09' : 'var(--surface)',
                border: `1px solid ${isActive ? hex + '35' : 'var(--border)'}`,
                borderRadius: 12, padding: '14px 16px 16px', cursor: 'pointer',
                transition: 'all .18s', boxShadow: isActive ? `0 2px 10px ${hex}14` : 'var(--shadow-xs)',
                display: 'flex', flexDirection: 'column', gap: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className={`badge ${GEN_COLORS[gen] || 'badge-gray'}`} style={{ fontSize: 11 }}>{gen}</span>
                {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: hex, boxShadow: `0 0 0 3px ${hex}25` }} />}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                {stat.count}
              </div>
              <div style={{ fontSize: 11, color: isActive ? hex : 'var(--text-muted)', fontWeight: isActive ? 700 : 500 }}>
                lot{stat.count > 1 ? 's' : ''}
              </div>
              {stat.totalKg > 0 && (
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{fmtKg(stat.totalKg)}</div>
              )}
              {totalKg > 0 && (
                <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, stat.totalKg / totalKg * 100)}%`, background: hex, borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><Package size={15} /></span>Liste des Lots</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canCreate && <button className="btn btn-primary" onClick={() => setShowNewLot(true)}><Plus size={13} /> Nouveau lot</button>}
            <button className="btn btn-secondary btn-icon" onClick={fetchLots}><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="filters-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
          {/* Recherche texte */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: '1 1 220px', maxWidth: 320 }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              placeholder="Code lot, variété…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1, color: 'var(--text-primary)' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} /></button>}
          </div>
          {/* Chips génération */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {allowedGens.filter(g => genCounts[g] || roleKey === 'seed-admin').map(g => {
              const isActive = generation === g
              const hex = GEN_HEX[g] ?? '#6b7280'
              return (
                <button
                  key={g}
                  onClick={() => { setGeneration(generation === g ? '' : g); setGenFilter('') }}
                  style={{
                    height: 28, padding: '0 10px', borderRadius: 20, fontSize: 11.5,
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? hex : 'var(--surface-2)',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${isActive ? hex : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all .12s',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? 'rgba(255,255,255,0.7)' : hex, flexShrink: 0 }} />
                  {g}{genCounts[g] ? <span style={{ opacity: 0.65 }}> ({genCounts[g]})</span> : ''}
                </button>
              )
            })}
          </div>
          {/* Effacer filtres */}
          {(search || genFilter || generation) && (
            <button className="btn btn-ghost" style={{ fontSize: 12, height: 28 }} onClick={() => { setSearch(''); setGenFilter(''); setGeneration('') }}>
              <X size={11} /> Effacer
            </button>
          )}
          {/* Compteur */}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {displayLotsFiltered.length}{displayLotsFiltered.length !== displayLots.length ? `/${displayLots.length}` : ''} lot{displayLotsFiltered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Code Lot</th><th>Variété</th><th>Génération</th><th>Lot Parent</th><th>Quantité</th><th>Campagne</th><th>Enregistré le</th><th>Producteur</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? [0,1,2,3].map(i => <tr key={i}><td colSpan={10}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
               displayLotsFiltered.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state"><div className="empty-icon"><Package size={20} /></div><div className="empty-title">{search || genFilter ? 'Aucun lot pour ce filtre' : 'Aucun lot'}</div>{canCreate && !search && !genFilter && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowNewLot(true)}>+ Créer un lot</button>}</div></td></tr>
               ) : displayLotsFiltered.map(l => {
                const gen = l.generation?.codeGeneration || 'N/A'
                const createdAtStr = l.createdAt
                  ? new Date(l.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—'
                return (
                  <tr key={l.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="td-mono" style={{ fontWeight: 700 }}>{l.codeLot}</span>
                        {l.certificatPath && (
                          <ShieldCheck size={13} title="Lot certifié" style={{ color: '#16a34a', flexShrink: 0 }} />
                        )}
                      </div>
                    </td>
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
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace' }}>{createdAtStr}</td>
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
                        {canChildForLot(l) && NEXT_GEN[gen] && (
                          <button
                            className="btn btn-ghost"
                            style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: 'var(--green-700)' }}
                            title={`Créer lot ${NEXT_GEN[gen]} depuis ce ${gen}`}
                            onClick={() => {
                              const nextGen = NEXT_GEN[gen]
                              setParentLot(l)
                              setChildForm({
                                codeLot: suggestChildCode(l.codeLot || '', gen, nextGen),
                                generationCode: nextGen,
                                campagne: l.campagne || new Date().getFullYear().toString(),
                                dateProduction: '', quantiteNette: '', unite: 'kg',
                                tauxGermination: '', puretePhysique: '', quantiteSemenceSrcKg: '',
                                superficieHa: '', productionBruteKg: '', cycle: 'C', niveauSemence: '', siteCode: '',
                              })
                              setShowChildLot(true)
                            }}
                          >
                            <GitBranch size={13} />
                          </button>
                        )}
                        {canTransferLot(l) && l.statutLot !== 'TRANSFERE' && (
                          <button
                            className="btn btn-ghost"
                            style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: 'var(--green-700)' }}
                            title="Transférer un Lot"
                            onClick={() => {
                              setParentLot(l)
                              setTransferForm({ usernameDestinataire: '', roleDestinataire: '', quantite: '', observations: '' })
                              // Rafraîchir la liste des destinataires à chaque ouverture du modal
                              const targetRole = roleKey === 'seed-selector' ? 'seed-upsemcl' : 'seed-multiplicator'
                              setMembresLoading(true)
                              api.get(endpoints.membresByRole(targetRole))
                                .then(r => setMembres(r.data))
                                .catch(() => setMembres([]))
                                .finally(() => setMembresLoading(false))
                              setShowTransfer(true)
                            }}
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
                        <button
                          className="btn btn-ghost"
                          style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: l.certificatPath ? '#16a34a' : '#dc2626' }}
                          title={l.certificatPath ? 'Voir / gérer le certificat' : 'Joindre un certificat'}
                          onClick={() => setCertLot(l)}
                        >{l.certificatPath ? <ShieldCheck size={13} /> : <ShieldX size={13} />}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showNewLot && (() => {
        // Variétés filtrées par spécialisation pour le sélectionneur
        const formVarieties = (roleKey === 'seed-selector' && userSpecialisation)
          ? varieties.filter((v: any) => v.espece?.codeEspece?.toUpperCase() === userSpecialisation.toUpperCase())
          : varieties
        // Sites filtrés : stations de recherche ISRA pour le sélectionneur, tous sinon
        const formSites = roleKey === 'seed-selector'
          ? sites.filter((s: any) => s.typeSite === 'STATION_RECHERCHE')
          : sites
        return (
        <Modal title="Nouveau Lot Semencier" subtitle="Enregistrer un nouveau lot dans la chaîne semencière" onClose={() => setShowNewLot(false)}>
          <form onSubmit={submitNewLot}>
            <FormRow>
              <Field label="Code lot" required hint="Ex: G0-MIL-SOUNA3-2026"><FormInput value={newLotForm.codeLot} onChange={e => setNewLotForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} placeholder="G0-MIL-SOUNA3-2026" required /></Field>
              <Field label="Variété" required hint={roleKey === 'seed-selector' && userSpecialisation ? `Filtrées : ${userSpecialisation}` : undefined}>
                <FormSelect value={newLotForm.idVariete} onChange={e => setNewLotForm(f => ({ ...f, idVariete: e.target.value }))} required>
                  <option value="">-- Choisir une variété --</option>
                  {formVarieties.map((v: any) => <option key={v.id} value={v.id}>{v.codeVariete} — {v.nomVariete}</option>)}
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
              <Field label="Production conditionnée (kg)" required>
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
            <FormRow>
              <Field label="Cycle">
                <FormSelect value={newLotForm.cycle} onChange={e => setNewLotForm(f => ({ ...f, cycle: e.target.value }))}>
                  <option value="C">Court (C)</option>
                  <option value="L">Long (L)</option>
                </FormSelect>
              </Field>
              <Field label="Niveau semence">
                <FormSelect value={newLotForm.niveauSemence} onChange={e => setNewLotForm(f => ({ ...f, niveauSemence: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  <option value="0 Semences originelles G0">0 Semences originelles G0</option>
                  <option value="1 Semences de pré-base G1">1 Semences de pré-base G1</option>
                  <option value="2 Semences de base G2">2 Semences de base G2</option>
                  <option value="3 Semences de base G3">3 Semences de base G3</option>
                  <option value="4 Semences Certifiés R1">4 Semences Certifiés R1</option>
                  <option value="5 Semences Certifiés R2">5 Semences Certifiés R2</option>
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Superficie plantée (ha)"><FormInput type="number" value={newLotForm.superficieHa} onChange={e => setNewLotForm(f => ({ ...f, superficieHa: e.target.value }))} placeholder="2.5" min="0" step="0.01" /></Field>
              <Field label="Production brute (kg)"><FormInput type="number" value={newLotForm.productionBruteKg} onChange={e => setNewLotForm(f => ({ ...f, productionBruteKg: e.target.value }))} placeholder="1000" min="0" step="0.01" /></Field>
            </FormRow>
            {newLotForm.superficieHa && newLotForm.productionBruteKg && Number(newLotForm.superficieHa) > 0 && (
              <div style={{ padding: '8px 12px', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 6, fontSize: 12.5, color: 'var(--green-800)', marginBottom: 12 }}>
                Rendement estimé : <strong>{(Number(newLotForm.productionBruteKg) / Number(newLotForm.superficieHa)).toFixed(2)} kg/ha</strong>
              </div>
            )}
            <Field label="Statut">
              <FormSelect value={newLotForm.statutLot} onChange={e => setNewLotForm(f => ({ ...f, statutLot: e.target.value }))}>
                <option value="DISPONIBLE">Disponible</option>
                <option value="EN_PRODUCTION">En production</option>
                <option value="EN_COURS_CERT">En cours de certification</option>
                <option value="CERTIFIE">Certifiée</option>
                <option value="TRANSFERE">Transféré</option>
                <option value="EPUISE">Épuisé</option>
                <option value="DECLASS">Déclassée</option>
                <option value="SOUCHE">Souche</option>
                <option value="PERDU">Perdu</option>
                <option value="RETIRE">Retiré</option>
              </FormSelect>
            </Field>
            {(['seed-selector', 'seed-upsemcl'].includes(roleKey)) ? (
              <Field label="Site de stockage initial">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px',
                  background: 'var(--green-50)', border: '1px solid var(--green-200)', borderRadius: 6,
                  fontSize: 13, color: 'var(--green-800)', fontWeight: 600,
                }}>
                  {roleKey === 'seed-selector' ? 'CNRA-BAMBEY — CNRA Bambey' : 'UPSEMCL-SITE-BAMBEY — Site UPSemCL Bambey'}
                  <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--green-600)', marginLeft: 'auto' }}>Site fixe</span>
                </div>
              </Field>
            ) : (
              <Field label="Site de stockage initial" hint="Optionnel — enregistre directement la quantité en stock">
                <FormSelect value={newLotForm.siteCode} onChange={e => setNewLotForm(f => ({ ...f, siteCode: e.target.value }))}>
                  <option value="">— Sans enregistrement stock immédiat —</option>
                  {formSites.map((s: any) => <option key={s.codeSite} value={s.codeSite}>{s.codeSite} — {s.nomSite}</option>)}
                </FormSelect>
              </Field>
            )}
            <FormActions onCancel={() => setShowNewLot(false)} loading={saving} submitLabel="Créer le lot" />
          </form>
        </Modal>
        )
      })()}

      {showChildLot && parentLot && (
        <Modal
          title={`Créer un lot ${childForm.generationCode || 'enfant'}`}
          subtitle={`${parentLot.codeLot} (${parentLot.generation?.codeGeneration}) → ${childForm.generationCode}`}
          onClose={() => setShowChildLot(false)}
        >
          <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: 'var(--green-800)' }}>
            <div style={{ display: 'grid', gap: 3 }}>
              <div><strong>Parent :</strong> {parentLot.codeLot} <span style={{ color: 'var(--text-muted)' }}>({parentLot.generation?.codeGeneration})</span></div>
              <div><strong>Variété :</strong> {varietyMap[parentLot.idVariete]?.nomVariete ?? `#${parentLot.idVariete}`}</div>
              <div><strong>Disponible :</strong> {parentLot.quantiteNette != null ? Number(parentLot.quantiteNette).toLocaleString('fr-FR') : '—'} {parentLot.unite}</div>
            </div>
          </div>
          <form onSubmit={submitChildLot}>
            <FormRow>
              <Field label="Code du lot enfant" required>
                <FormInput value={childForm.codeLot} onChange={e => setChildForm(f => ({ ...f, codeLot: e.target.value.toUpperCase() }))} placeholder={`${childForm.generationCode}-MIL-SOUNA3-2026`} required />
              </Field>
              <Field label="Génération cible">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: GEN_COLORS[childForm.generationCode] ? 'var(--green-700)' : 'var(--text-primary)' }}>{childForm.generationCode}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— déduite du parent ({parentLot.generation?.codeGeneration})</span>
                </div>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Campagne" required><FormInput value={childForm.campagne} onChange={e => setChildForm(f => ({ ...f, campagne: e.target.value }))} placeholder="2026" required /></Field>
              <Field label="Date de production"><FormInput type="date" value={childForm.dateProduction} onChange={e => setChildForm(f => ({ ...f, dateProduction: e.target.value }))} /></Field>
            </FormRow>
            <FormRow>
              <Field label="Production conditionnée (kg)" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={childForm.quantiteNette} onChange={e => setChildForm(f => ({ ...f, quantiteNette: e.target.value }))} placeholder="500" min="0" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={childForm.unite} onChange={e => setChildForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}><option value="kg">kg</option><option value="t">t</option></FormSelect>
                </div>
              </Field>
              <Field label="Quantité semences utilisées (kg)" hint={roleKey === 'seed-selector' ? `Obligatoire — max ${Number(parentLot.quantiteNette).toLocaleString('fr-FR')} kg disponibles sur ${parentLot.codeLot}` : 'kg du lot parent plantés'} required={roleKey === 'seed-selector'}>
                <FormInput
                  type="number"
                  value={childForm.quantiteSemenceSrcKg}
                  onChange={e => setChildForm(f => ({ ...f, quantiteSemenceSrcKg: e.target.value }))}
                  placeholder="200"
                  min="0.01"
                  max={parentLot.quantiteNette != null ? String(parentLot.quantiteNette) : undefined}
                  step="0.01"
                  required={roleKey === 'seed-selector'}
                />
                {parentLot.quantiteNette != null && childForm.quantiteSemenceSrcKg && Number(childForm.quantiteSemenceSrcKg) > 0 && (() => {
                  const used = Number(childForm.quantiteSemenceSrcKg)
                  const total = Number(parentLot.quantiteNette)
                  const pct = Math.min(100, (used / total) * 100)
                  const over = used > total
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4, color: over ? '#dc2626' : 'var(--text-muted)' }}>
                        <span>{used.toLocaleString('fr-FR')} kg utilisés</span>
                        <span style={{ color: over ? '#dc2626' : '#15803d', fontWeight: 600 }}>
                          {over ? `Dépassement de ${(used - total).toLocaleString('fr-FR')} kg !` : `${(total - used).toLocaleString('fr-FR')} kg restants`}
                        </span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: over ? '#dc2626' : pct > 80 ? '#f59e0b' : '#16a34a', transition: 'width 0.2s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                        {pct.toFixed(1)} % du lot parent ({total.toLocaleString('fr-FR')} kg {parentLot.unite})
                      </div>
                    </div>
                  )
                })()}
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Taux germination (%)"><FormInput type="number" value={childForm.tauxGermination} onChange={e => setChildForm(f => ({ ...f, tauxGermination: e.target.value }))} placeholder="97.0" min="0" max="100" step="0.1" /></Field>
              <Field label="Pureté physique (%)"><FormInput type="number" value={childForm.puretePhysique} onChange={e => setChildForm(f => ({ ...f, puretePhysique: e.target.value }))} placeholder="98.5" min="0" max="100" step="0.1" /></Field>
            </FormRow>
            <FormRow>
              <Field label="Cycle">
                <FormSelect value={childForm.cycle} onChange={e => setChildForm(f => ({ ...f, cycle: e.target.value }))}>
                  <option value="C">Court (C)</option>
                  <option value="L">Long (L)</option>
                </FormSelect>
              </Field>
              <Field label="Niveau semence">
                <FormSelect value={childForm.niveauSemence} onChange={e => setChildForm(f => ({ ...f, niveauSemence: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  <option value="0 Semences originelles G0">0 Semences originelles G0</option>
                  <option value="1 Semences de pré-base G1">1 Semences de pré-base G1</option>
                  <option value="2 Semences de base G2">2 Semences de base G2</option>
                  <option value="3 Semences de base G3">3 Semences de base G3</option>
                  <option value="4 Semences Certifiés R1">4 Semences Certifiés R1</option>
                  <option value="5 Semences Certifiés R2">5 Semences Certifiés R2</option>
                </FormSelect>
              </Field>
            </FormRow>
            <FormRow>
              <Field label="Superficie plantée (ha)"><FormInput type="number" value={childForm.superficieHa} onChange={e => setChildForm(f => ({ ...f, superficieHa: e.target.value }))} placeholder="2.0" min="0" step="0.01" /></Field>
              <Field label="Production brute (kg)"><FormInput type="number" value={childForm.productionBruteKg} onChange={e => setChildForm(f => ({ ...f, productionBruteKg: e.target.value }))} placeholder="1600" min="0" step="0.01" /></Field>
            </FormRow>
            {childForm.superficieHa && childForm.productionBruteKg && Number(childForm.superficieHa) > 0 && (
              <div style={{ padding: '8px 12px', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 6, fontSize: 12.5, color: 'var(--green-800)', marginBottom: 12 }}>
                Rendement estimé : <strong>{(Number(childForm.productionBruteKg) / Number(childForm.superficieHa)).toFixed(2)} kg/ha</strong>
              </div>
            )}
            {(['seed-selector', 'seed-upsemcl'].includes(roleKey)) ? (
              <Field label="Site de stockage">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px',
                  background: 'var(--green-50)', border: '1px solid var(--green-200)', borderRadius: 6,
                  fontSize: 13, color: 'var(--green-800)', fontWeight: 600,
                }}>
                  {roleKey === 'seed-selector' ? 'CNRA-BAMBEY — CNRA Bambey' : 'UPSEMCL-SITE-BAMBEY — Site UPSemCL Bambey'}
                  <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--green-600)', marginLeft: 'auto' }}>Site fixe</span>
                </div>
              </Field>
            ) : (
              <Field label="Site de stockage" hint="Optionnel — crée ou incrémente automatiquement le stock à ce site">
                <FormSelect value={childForm.siteCode} onChange={e => setChildForm(f => ({ ...f, siteCode: e.target.value }))}>
                  <option value="">— Sans enregistrement stock immédiat —</option>
                  {sites.map((s: any) => <option key={s.codeSite} value={s.codeSite}>{s.codeSite} — {s.nomSite}</option>)}
                </FormSelect>
              </Field>
            )}
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
            <Field label="Site de réception" required hint="Site de stockage où les semences seront enregistrées">
              <FormSelect
                value={receptionForm.siteCode}
                onChange={e => setReceptionForm(f => ({ ...f, siteCode: e.target.value }))}
                required
              >
                <option value="">— Sélectionner un site —</option>
                {sites.map((s: any) => (
                  <option key={s.codeSite} value={s.codeSite}>
                    {s.nomSite} ({s.codeSite})
                    {s.region ? ` — ${s.region}` : ''}
                  </option>
                ))}
              </FormSelect>
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
        // Filtre par keycloakRole (nom correct du champ dans MembreOrganisation)
        const eligibles = membres.filter((m: any) => m.keycloakRole === destRole)
        return (
          <Modal title="Transférer un Lot" subtitle={`${parentLot.codeLot} — ${parentLot.generation?.codeGeneration || ''}`} onClose={() => setShowTransfer(false)} size="sm">
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e' }}>
              <strong>Flux autorisé :</strong> {roleKey === 'seed-selector' ? 'Sélectionneur → UPSemCL (G1 uniquement)' : 'UPSemCL → Multiplicateur (G2/G3)'}
            </div>
            <form onSubmit={submitTransfer}>
              <Field label="Destinataire" required hint={membresLoading ? 'Chargement en cours…' : `${eligibles.length} destinataire(s) disponible(s)`}>
                <FormSelect
                  value={transferForm.usernameDestinataire}
                  onChange={e => {
                    const m = eligibles.find((x: any) => x.keycloakUsername === e.target.value)
                    setTransferForm(f => ({ ...f, usernameDestinataire: e.target.value, roleDestinataire: m?.keycloakRole || destRole }))
                  }}
                  required
                  disabled={membresLoading}
                >
                  <option value="">
                    {membresLoading ? '⏳ Chargement des destinataires…' : '— Sélectionner un destinataire —'}
                  </option>
                  {!membresLoading && eligibles.length === 0 && (
                    <option disabled value="">Aucun multiplicateur enregistré dans la plateforme</option>
                  )}
                  {!membresLoading && eligibles.map((m: any) => (
                    <option key={m.id} value={m.keycloakUsername}>
                      {m.nomComplet || m.keycloakUsername} — {m.organisation?.nomOrganisation || ''}
                    </option>
                  ))}
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
