import React, { useEffect, useRef, useState } from 'react'
import { Package, Plus, ArrowRightLeft, GitBranch, RefreshCw, X, ChevronRight, Eye, Building2, Download, FileText, Store, Layers, ShoppingCart, CheckCircle2, Bell, Check, XCircle, Search, BadgeCheck, Upload, Trash2, ShieldCheck, ShieldX, Shield, MessageCircle, Users } from 'lucide-react'
import { keycloak } from '../../lib/keycloak'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, normalizeVariete, normalizeStock, extractList } from '../../lib/normalizers'
import { fmtT } from '../../lib/fmt'
import { downloadXlsx, formatDateForExport } from '../../lib/exportUtils'
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

// ── Helpers certification (feu tricolore) ─────────────────────────
type StatutCert = 'SANS_CERTIFICAT' | 'EN_ATTENTE' | 'CERTIFIE' | 'REJETE'

function certShieldIcon(lot: any, size = 13) {
  const sc: StatutCert = lot.statutCertification || 'SANS_CERTIFICAT'
  if (sc === 'CERTIFIE')        return <ShieldCheck size={size} title="Lot certifié (approuvé)"              style={{ color: '#16a34a', flexShrink: 0 }} />
  if (sc === 'EN_ATTENTE')      return <Shield      size={size} title="Certificat en attente de validation"  style={{ color: '#EAB308', flexShrink: 0 }} />
  if (sc === 'REJETE')          return <ShieldX     size={size} title="Certificat rejeté"                    style={{ color: '#EF4444', flexShrink: 0 }} />
  /* SANS_CERTIFICAT */          return <Shield      size={size} title="Aucun certificat soumis"              style={{ color: '#EF4444', flexShrink: 0 }} />
}

function certButtonColor(lot: any): string {
  const sc: StatutCert = lot.statutCertification || 'SANS_CERTIFICAT'
  if (sc === 'CERTIFIE')   return '#16a34a'
  if (sc === 'EN_ATTENTE') return '#EAB308'
  if (sc === 'REJETE')     return '#EF4444'
  return '#EF4444'
}

function certButtonTitle(lot: any): string {
  const sc: StatutCert = lot.statutCertification || 'SANS_CERTIFICAT'
  if (sc === 'CERTIFIE')   return 'Voir le certificat (approuvé)'
  if (sc === 'EN_ATTENTE') return 'Certificat en attente de validation'
  if (sc === 'REJETE')     return 'Certificat rejeté — resoumettre un nouveau'
  return 'Joindre un certificat'
}

import { GEN_COLORS as GEN_COLORS_RICH, GEN_CHART_COLORS, ROLE_LABELS } from '../../lib/constants'
const GEN_COLORS: Record<string, string> = Object.fromEntries(Object.entries(GEN_COLORS_RICH).map(([k, v]) => [k, v.badge]))
const GEN_HEX    = GEN_CHART_COLORS
const GEN_BG: Record<string, string>     = Object.fromEntries(Object.entries(GEN_COLORS_RICH).map(([k, v]) => [k, v.bg]))
const GEN_BORDER: Record<string, string> = Object.fromEntries(Object.entries(GEN_COLORS_RICH).map(([k, v]) => [k, v.border]))
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
  const first = chain[0]
  const last  = chain[chain.length - 1]

  return (
    <Modal title={"Traçabilité : " + codeLot} subtitle={"Chaîne générationnelle : " + chain.length + " génération(s)"} onClose={onClose} size="lg">
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
        {chain.map((node, i) => {
          const gen        = node.generation || '?'
          const isLast     = i === chain.length - 1
          const roleColors = ROLE_NODE_COLORS[node.responsableRole] || { bg: '#f9fafb', border: '#e5e7eb', label: '' }
          const acteurNom  = node.responsableNom || node.nomOrganisation || null
          const hasRole    = !!node.responsableRole

          return (
            <React.Fragment key={node.lotId || i}>
              <div style={{
                background: GEN_BG[gen] || '#f9fafb',
                border: `2px solid ${hasRole ? roleColors.border : (GEN_BORDER[gen] || '#e5e7eb')}`,
                borderRadius: 10, padding: '14px 16px', minWidth: 180, flex: '0 0 auto',
                boxShadow: isLast ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* En-tête : génération + tag actuel */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span className={"badge " + (GEN_COLORS[gen] || 'badge-gray')} style={{ fontSize: 11 }}>{gen}</span>
                  {isLast && (
                    <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Actuel
                    </span>
                  )}
                </div>

                {/* Code lot */}
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, wordBreak: 'break-all', lineHeight: 1.3 }}>
                  {node.codeLot}
                </div>

                {/* Bloc acteur — toujours rendu, avec fallback "non renseigné" */}
                <div style={{
                  background: hasRole ? roleColors.bg : 'rgba(255,255,255,0.5)',
                  borderRadius: 6, padding: '7px 9px', marginBottom: 8,
                  border: `1px solid ${hasRole ? roleColors.border + '66' : 'rgba(0,0,0,0.07)'}`,
                  flex: 0,
                }}>
                  {acteurNom ? (
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: 4, lineHeight: 1.3 }}>
                      <Building2 size={10} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{acteurNom}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Acteur non renseigné
                    </div>
                  )}
                  {node.responsableRole && (
                    <div style={{ fontSize: 10, color: roleColors.border, fontWeight: 700, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {roleColors.label || node.responsableRole}
                    </div>
                  )}
                  {node.usernameCreateur && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      @{node.usernameCreateur}
                    </div>
                  )}
                </div>

                {/* Données techniques */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                  {node.campagne && <div>Campagne: {node.campagne}</div>}
                  <div>Date: {node.dateProduction || 'N/A'}</div>
                  <div>Qté: {node.quantiteNette ? Number(node.quantiteNette).toLocaleString('fr-FR') : 'N/A'} {node.unite}</div>
                  <div>Germ: {node.tauxGermination != null ? node.tauxGermination + '%' : 'N/A'}</div>
                  <div>Pureté: {node.puretePhysique != null ? node.puretePhysique + '%' : 'N/A'}</div>
                </div>
              </div>
              {!isLast && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 3px', color: '#9ca3af', flexShrink: 0 }}>
                  <ChevronRight size={16} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Récapitulatif */}
      <div style={{ marginTop: 20, padding: '14px 18px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Générations</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{chain.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Lot origine</div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{first?.codeLot}</div>
        </div>
        {(first?.responsableNom || first?.nomOrganisation) && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Sélectionneur</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{first?.responsableNom || first?.nomOrganisation}</div>
          </div>
        )}
        {last !== first && (last?.responsableNom || last?.nomOrganisation) && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Acteur final</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{last?.responsableNom || last?.nomOrganisation}</div>
            {last?.responsableRole && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {ROLE_NODE_COLORS[last.responsableRole]?.label || last.responsableRole}
              </div>
            )}
          </div>
        )}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Germination finale</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {last?.tauxGermination != null ? last.tauxGermination + '%' : 'N/A'}
          </div>
        </div>
      </div>

      {/* Légende rôles */}
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

/* ── Helpers slide-over panel ───────────────────────────────── */
function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
    </div>
  )
}
function PanelRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, minWidth: 120 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
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

function MesLotsHorizChart({ data, gens, title, onVarClick }: {
  data: HorizDatum[]
  gens: string[]
  title?: string
  onVarClick?: (varName: string) => void
}) {
  const [tip, setTip] = useState<{ label: string; gens: Record<string,number>; x: number; y: number } | null>(null)

  if (data.length === 0) return null

  const maxTotal = Math.max(...data.map(d => gens.reduce((s, g) => s + (d.gens[g] ?? 0), 0)), 1)
  const fmtK = (v: number) => fmtT(v)
  const ROW_H = 36, LABEL_W = 140, BAR_W = 420, PAD = 16, H = data.length * ROW_H + PAD * 2
  const W = LABEL_W + BAR_W + 80

  return (
    <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', position: 'relative' }}
      onMouseLeave={() => setTip(null)}>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          {title}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
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
              onClick={() => onVarClick?.(d.label)}
              style={{ cursor: onVarClick ? 'pointer' : 'default' }}>
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
                {fmtK(total)}
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
                {fmtT(tip.gens[g] ?? 0)}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 5, paddingTop: 4, fontWeight: 700, fontSize: 11, display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
            <span>Total</span>
            <span>{fmtT(gens.reduce((s, g) => s + (tip.gens[g] ?? 0), 0))}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CATALOGUE G1 — Lots sélectionneurs visibles par UPSemCL
   ══════════════════════════════════════════════════════════════ */
function CatalogueG1UPSemCL({ setToast }: { setToast: (t: { msg: string; type: 'success'|'error' }) => void }) {
  const [lots, setLots]           = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterEspece, setFilterEspece] = useState('')
  const [search, setSearch]       = useState('')
  const [contacting, setContacting] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [sentMap, setSentMap]     = useState<Record<number, boolean>>({})

  useEffect(() => {
    Promise.all([
      api.get(endpoints.lotsCatalogueG1),
      api.get(endpoints.varieties),
    ]).then(([lotsRes, varRes]) => {
      setLots(extractList(lotsRes.data))
      setVarieties(extractList(varRes.data))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const varietyMap: Record<number, any> = Object.fromEntries(varieties.map(v => [v.id, v]))

  const especesDisponibles = [...new Set(
    lots.map(l => (varietyMap[l.idVariete]?.espece?.nomCommun || varietyMap[l.idVariete]?.espece?.codeEspece || '') as string).filter(Boolean)
  )].sort()

  const lotsFiltered = lots.filter(l => {
    const esp = varietyMap[l.idVariete]?.espece?.nomCommun || varietyMap[l.idVariete]?.espece?.codeEspece || ''
    if (filterEspece && esp !== filterEspece) return false
    if (search) {
      const s = search.toLowerCase()
      const nom = varietyMap[l.idVariete]?.nomVariete ?? ''
      if (!l.codeLot?.toLowerCase().includes(s) && !nom.toLowerCase().includes(s) && !l.usernameCreateur?.toLowerCase().includes(s)) return false
    }
    return true
  })

  const totalKg = lotsFiltered.reduce((s, l) => s + (Number(l.quantiteNette) || 0), 0)

  async function contacter(lot: any) {
    if (contacting === lot.id) return
    if (!lot.usernameCreateur) {
      setToast({ msg: 'Impossible de contacter ce sélectionneur : identifiant introuvable sur ce lot.', type: 'error' })
      return
    }
    setContacting(lot.id)
    try {
      const convRes = await api.post(endpoints.chatConversations, { destinataireUsername: lot.usernameCreateur })
      const convId  = convRes.data.id
      const v      = varietyMap[lot.idVariete]
      const varNom = v?.nomVariete ?? '—'
      const qte    = Number(lot.quantiteNette).toLocaleString('fr-FR')
      const msg    = `Bonjour, votre lot G1 ${lot.codeLot} (variété : ${varNom}, ${qte} ${lot.unite || 'kg'}) est disponible. Merci de procéder au transfert vers l'UPSemCL dès que possible.`
      await api.post(endpoints.chatMessages(convId), { type: 'TEXT', contenu: msg })
      setSentMap(prev => ({ ...prev, [lot.id]: true }))
      const affichage = lot.responsableNom?.trim() || lot.usernameCreateur
      setToast({ msg: `Message envoyé à ${affichage}`, type: 'success' })
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.message
      const msg = status === 403
        ? `Canal non autorisé avec ${lot.usernameCreateur}`
        : status === 404
        ? `${lot.usernameCreateur} n'est pas encore enregistré comme membre de la plateforme`
        : detail || 'Erreur lors de la prise de contact'
      setToast({ msg, type: 'error' })
    } finally { setContacting(null) }
  }

  return (
    <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
      <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setCollapsed(c => !c)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className="card-title">
            <span className="card-title-icon"><Users size={15} /></span>
            Lots G1 disponibles — Sélectionneurs
          </span>
          {!loading && (
            <span style={{
              background: lotsFiltered.length > 0 ? 'var(--green-50,#f0fdf4)' : 'var(--surface-2)',
              color: lotsFiltered.length > 0 ? 'var(--green-700,#15803d)' : 'var(--text-muted)',
              border: `1px solid ${lotsFiltered.length > 0 ? '#86efac' : 'var(--border)'}`,
              borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700,
            }}>
              {lotsFiltered.length} lot{lotsFiltered.length !== 1 ? 's' : ''}
            </span>
          )}
          {collapsed && totalKg > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {fmtT(totalKg)}</span>
          )}
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform .2s', flexShrink: 0 }} />
      </div>

      {!collapsed && (
        <>
          {/* Bandeau contexte métier */}
          <div style={{ padding: '9px 20px', background: '#fffbeb', borderBottom: '1px solid #fef3c7', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Bell size={13} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.45 }}>
              Les sélectionneurs sont tenus de transférer leurs G1 vers l'UPSemCL sans attendre.
              Utilisez <strong>Contacter</strong> pour les relancer en cas de besoin.
            </span>
          </div>

          {/* Filtres espèce */}
          {especesDisponibles.length > 1 && (
            <div style={{ display: 'flex', gap: 6, padding: '8px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>Espèce</span>
              {(['', ...especesDisponibles] as string[]).map(esp => {
                const active = filterEspece === esp
                return (
                  <button key={esp || '__all'} onClick={() => setFilterEspece(esp)}
                    style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
                      border: `1.5px solid ${active ? 'var(--green-600,#16a34a)' : 'var(--border)'}`,
                      background: active ? 'var(--green-50,#f0fdf4)' : 'var(--surface)',
                      color: active ? 'var(--green-700,#15803d)' : 'var(--text-muted)',
                      fontWeight: active ? 700 : 400, transition: 'all 0.12s',
                    }}>
                    {esp || 'Toutes'}
                  </button>
                )
              })}
            </div>
          )}

          {/* Barre de recherche */}
          <div style={{ padding: '9px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface)' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par code lot, variété ou sélectionneur…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Contenu */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
              <RefreshCw size={22} style={{ color: 'var(--green-600)', animation: 'spin 0.9s linear infinite' }} />
            </div>
          ) : lotsFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '44px 24px', color: 'var(--text-muted)' }}>
              <Package size={36} style={{ marginBottom: 14, opacity: 0.25 }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {lots.length === 0 ? 'Aucun lot G1 disponible chez les sélectionneurs' : 'Aucun résultat pour ces filtres'}
              </div>
              <div style={{ fontSize: 12 }}>
                {lots.length === 0 ? 'Les sélectionneurs n\'ont pas encore de lots G1 DISPONIBLES.' : 'Modifiez la recherche ou le filtre espèce.'}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                    {['Sélectionneur', 'Espèce', 'Variété', 'Code lot', 'Quantité', 'Campagne', 'Date prod', ''].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Quantité' ? 'right' : 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lotsFiltered.map((lot, i) => {
                    const v    = varietyMap[lot.idVariete]
                    const esp  = v?.espece?.nomCommun || v?.espece?.codeEspece || '—'
                    const busy     = contacting === lot.id
                    const sent     = sentMap[lot.id]
                    const hasUser  = !!lot.usernameCreateur
                    const nomAff   = lot.usernameCreateur || lot.responsableNom?.trim() || '—'
                    const subAff   = lot.usernameCreateur && lot.responsableNom?.trim() && lot.responsableNom.trim() !== lot.usernameCreateur
                                       ? lot.responsableNom.trim() : null
                    const initiale = (nomAff[0] ?? '?').toUpperCase()
                    return (
                      <tr key={lot.id}
                        style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-2)', transition: 'background .12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-50,#f0fdf4)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--surface-2)')}
                      >
                        {/* Sélectionneur */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: hasUser ? 'var(--green-50,#f0fdf4)' : 'var(--surface-3)', border: `2px solid ${hasUser ? 'var(--green-200,#bbf7d0)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: hasUser ? 'var(--green-700,#15803d)' : 'var(--text-muted)', flexShrink: 0 }}>
                              {initiale}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{nomAff}</div>
                              {subAff && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{subAff}</div>}
                            </div>
                          </div>
                        </td>
                        {/* Espèce */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{esp}</span>
                        </td>
                        {/* Variété */}
                        <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {v?.nomVariete ?? '—'}
                          {v?.codeVariete && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 5 }}>({v.codeVariete})</span>}
                        </td>
                        {/* Code lot */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11.5, background: 'var(--surface-2)', padding: '2px 7px', borderRadius: 4, color: 'var(--text-primary)' }}>{lot.codeLot}</span>
                        </td>
                        {/* Quantité */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {Number(lot.quantiteNette).toLocaleString('fr-FR')}
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 3 }}>{lot.unite || 'kg'}</span>
                        </td>
                        {/* Campagne */}
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{lot.campagne ?? '—'}</td>
                        {/* Date prod */}
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{lot.dateProduction ?? '—'}</td>
                        {/* Action */}
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          {sent ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--green-700,#15803d)', fontWeight: 600 }}>
                              <Check size={13} /> Envoyé
                            </span>
                          ) : !hasUser ? (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }} title="Identifiant sélectionneur non disponible sur ce lot">
                              Non identifié
                            </span>
                          ) : (
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: 11.5, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                              onClick={() => contacter(lot)}
                              disabled={busy}
                              title={`Envoyer un message à ${nomAff}`}
                            >
                              {busy
                                ? <RefreshCw size={11} style={{ animation: 'spin 0.9s linear infinite' }} />
                                : <MessageCircle size={11} />
                              }
                              {busy ? 'Envoi…' : 'Contacter'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{lotsFiltered.length} lot{lotsFiltered.length !== 1 ? 's' : ''} affiché{lotsFiltered.length !== 1 ? 's' : ''}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total : {fmtT(totalKg)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   VUE MULTIPLICATEUR — Catalogue G3 + Mes Lots isolés
   ══════════════════════════════════════════════════════════════ */
type CartLotItem = {
  lotId: number; codeLot: string; idVariete: number
  nomVariete: string; codeVariete: string
  quantiteDispo: number; unite: string
  tauxGermination: number | null; puretePhysique: number | null
  quantite: number
}

function VueLotsMultiplicateur({ setToast }: { setToast: (t: { msg: string; type: 'success'|'error' }) => void }) {
  const [onglet, setOnglet]           = useState<'catalogue'|'meslots'>('catalogue')
  const [catalogueG3, setCatalogueG3] = useState<any[]>([])
  const [mesLots, setMesLots]         = useState<any[]>([])
  const [monStock, setMonStock]       = useState<any[]>([])
  const [varieties, setVarieties]     = useState<any[]>([])
  const [upsemclOrgId, setUpsemclOrgId] = useState<number | null>(null)
  const [loadingCat, setLoadingCat]   = useState(true)
  const [loadingMes, setLoadingMes]   = useState(true)
  const [cart, setCart]               = useState<CartLotItem[]>([])
  const [cartObs, setCartObs]         = useState('')
  const [cartAddLot, setCartAddLot]   = useState<any | null>(null)
  const [cartAddQty, setCartAddQty]   = useState('')
  const [cartAddUnite, setCartAddUnite] = useState('kg')
  const [showCartModal, setShowCartModal] = useState(false)
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
    setCatalogueG3(extractList(catRes.status === 'fulfilled' ? catRes.value.data : null).map(normalizeLot))
    setLoadingCat(false)
    // Tri: lots propres par createdAt DESC, lots reçus par transfert remontés selon leur stock
    const rawLots: any[] = extractList(mesRes.status === 'fulfilled' ? mesRes.value.data : null).map(normalizeLot)
    const rawStock: any[] = extractList(stockRes.status === 'fulfilled' ? stockRes.value.data : null).map(normalizeStock)
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
    setVarieties(extractList(varRes.status === 'fulfilled' ? varRes.value.data : null).map(normalizeVariete))
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

  // ── Panier multi-lots G3 ─────────────────────────────────────────────────
  const cartTotalKg = cart.reduce((s, i) => s + (i.unite === 't' ? i.quantite * 1000 : i.quantite), 0)
  function cartIncludes(lotId: number) { return cart.some(i => i.lotId === lotId) }
  function cartRemove(lotId: number) { setCart(c => c.filter(i => i.lotId !== lotId)) }
  function openCartAdd(lot: any) { setCartAddLot(lot); setCartAddQty(''); setCartAddUnite('kg'); setShowCartModal(true) }
  function cartAdd() {
    if (!cartAddLot) return
    const qty = Number(cartAddQty)
    if (!qty || qty <= 0) return
    const v = varietyMap[cartAddLot.idVariete]
    setCart(c => [...c.filter(i => i.lotId !== cartAddLot.id), {
      lotId: cartAddLot.id, codeLot: cartAddLot.codeLot, idVariete: cartAddLot.idVariete,
      nomVariete: v?.nomVariete ?? '', codeVariete: v?.codeVariete ?? '',
      quantiteDispo: Number(cartAddLot.quantiteNette), unite: cartAddUnite,
      tauxGermination: cartAddLot.tauxGermination ?? null, puretePhysique: cartAddLot.puretePhysique ?? null,
      quantite: qty,
    }])
    setShowCartModal(false)
  }
  async function submitCart(e: React.FormEvent) {
    e.preventDefault(); if (cart.length === 0) return; setSaving(true)
    try {
      const code = 'CMD-G3-' + Date.now().toString(36).toUpperCase()
      await api.post(endpoints.orders, {
        codeCommande: code, client: 'Multiplicateur',
        idOrganisationFournisseur: upsemclOrgId,
        observations: cartObs || `Demande multi-lots G3 — ${cart.length} lot(s)`,
        lignes: cart.map(item => ({ idVariete: item.idVariete, idGeneration: 4, quantite: item.quantite, unite: item.unite })),
      })
      setToast({ msg: `Commande ${code} soumise — ${cart.length} lot${cart.length > 1 ? 's' : ''} à l'UPSemCL`, type: 'success' })
      setCart([]); setCartObs(''); fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la commande', type: 'error' })
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
                <input value={searchCat} onChange={e => setSearchCat(e.target.value)} placeholder="Rechercher variété, code lot…" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'var(--font-sans)', width: 180 }} />
                {searchCat && <button onClick={() => setSearchCat('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} /></button>}
              </div>
              {catFiltered.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ gap: 5, fontSize: 12 }}
                  onClick={() => {
                    const date = new Date().toISOString().slice(0, 10)
                    const lotsRows = catFiltered.map(l => {
                      const v = varietyMap[l.idVariete]
                      const kg = Number(l.quantiteNette) || 0
                      return [l.codeLot ?? '', v?.nomVariete ?? '', v?.codeVariete ?? '', 'G3', formatDateForExport(l.dateProduction), kg, parseFloat((kg / 1000).toFixed(3)), l.tauxGermination ?? '', l.puretePhysique ?? '', l.statutLot ?? '']
                    })
                    const totalKg = catFiltered.reduce((s, l) => s + (Number(l.quantiteNette) || 0), 0)
                    lotsRows.push(['TOTAL', '', '', '', '', Math.round(totalKg), parseFloat((totalKg / 1000).toFixed(3)), '', '', ''])

                    const varMap2: Record<string, { nom: string; code: string; nb: number; kg: number; germ: number[]; purete: number[] }> = {}
                    catFiltered.forEach(l => {
                      const v = varietyMap[l.idVariete]; const code = v?.codeVariete ?? String(l.idVariete)
                      if (!varMap2[code]) varMap2[code] = { nom: v?.nomVariete ?? '', code, nb: 0, kg: 0, germ: [], purete: [] }
                      varMap2[code].nb++; varMap2[code].kg += Number(l.quantiteNette) || 0
                      if (l.tauxGermination != null) varMap2[code].germ.push(Number(l.tauxGermination))
                      if (l.puretePhysique  != null) varMap2[code].purete.push(Number(l.puretePhysique))
                    })
                    const varRows = Object.values(varMap2).sort((a, b) => b.kg - a.kg).map(e => [e.nom, e.code, e.nb, Math.round(e.kg), parseFloat((e.kg / 1000).toFixed(3)), e.germ.length ? parseFloat((e.germ.reduce((a, b) => a + b, 0) / e.germ.length).toFixed(1)) : '', e.purete.length ? parseFloat((e.purete.reduce((a, b) => a + b, 0) / e.purete.length).toFixed(1)) : ''])

                    downloadXlsx(`senjiw-catalogue-g3-${date}`, [
                      { name: 'Catalogue G3', headers: ['Code lot', 'Variété', 'Code variété', 'Génération', 'Date production', 'Quantité (kg)', 'Quantité (t)', 'Germination (%)', 'Pureté (%)', 'Statut'], rows: lotsRows },
                      { name: 'Par variété',  headers: ['Variété', 'Code variété', 'Nb lots', 'Total (kg)', 'Total (t)', 'Germination moy. (%)', 'Pureté moy. (%)'], rows: varRows },
                    ])
                  }}
                >
                  <Download size={13} /> Export .xls
                </button>
              )}
              <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
            </div>
          </div>

          <div style={{ padding: '10px 22px 6px', fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={13} />
            Sélectionnez un ou plusieurs lots G3, définissez les quantités souhaitées, puis soumettez votre commande groupée à l'UPSemCL.
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
                        const inCart = cartIncludes(l.id)
                        return (
                          <tr key={l.id} style={{ background: inCart ? 'var(--green-50,#f0fdf4)' : undefined, transition: 'background .15s' }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span className="td-mono" style={{ fontWeight: 700 }}>{l.codeLot}</span>
                                {certShieldIcon(l)}
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
                                  inCart ? (
                                    <button
                                      className="btn"
                                      style={{ height: 30, padding: '0 10px', fontSize: 11, gap: 4, display: 'flex', alignItems: 'center', color: '#15803d', border: '1.5px solid #86efac', background: '#f0fdf4', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                                      title="Retirer du panier"
                                      onClick={() => cartRemove(l.id)}
                                    >
                                      <CheckCircle2 size={12} /> Dans le panier <X size={10} style={{ marginLeft: 2, opacity: 0.6 }} />
                                    </button>
                                  ) : (
                                    <button
                                      className="btn btn-primary"
                                      style={{ height: 30, padding: '0 10px', fontSize: 11, gap: 4 }}
                                      title="Ajouter au panier"
                                      onClick={() => openCartAdd(l)}
                                    >
                                      <ShoppingCart size={12} /> Ajouter
                                    </button>
                                  )
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
                  <input value={searchMes} onChange={e => setSearchMes(e.target.value)} placeholder="Code lot, variété, génération…" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12.5, fontFamily: 'var(--font-sans)', width: 180 }} />
                  {searchMes && <button onClick={() => setSearchMes('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={12} /></button>}
                </div>
                {mesLotsFiltered.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ height: 32, fontSize: 12, gap: 5 }}
                    onClick={() => {
                      const date = new Date().toISOString().slice(0, 10)
                      const lotsRows = mesLotsFiltered.map((l: any) => {
                        const v = varietyMap[l.idVariete]; const kg = Number(l.quantiteNette) || 0
                        return [l.codeLot ?? '', v?.nomVariete ?? '', l.generation?.codeGeneration ?? '', l.campagne ?? '', formatDateForExport(l.dateProduction), kg, parseFloat((kg / 1000).toFixed(3)), l.tauxGermination ?? '', l.puretePhysique ?? '', l.statutLot ?? '', l.site?.codeSite ?? '']
                      })
                      const totalKg = mesLotsFiltered.reduce((s: number, l: any) => s + (Number(l.quantiteNette) || 0), 0)
                      lotsRows.push(['TOTAL', '', '', '', '', Math.round(totalKg), parseFloat((totalKg / 1000).toFixed(3)), '', '', '', ''])

                      const genMap: Record<string, { nb: number; kg: number }> = {}
                      mesLotsFiltered.forEach((l: any) => {
                        const g = l.generation?.codeGeneration ?? '?'
                        if (!genMap[g]) genMap[g] = { nb: 0, kg: 0 }
                        genMap[g].nb++; genMap[g].kg += Number(l.quantiteNette) || 0
                      })
                      const genRows = Object.entries(genMap).sort(([a], [b]) => a.localeCompare(b)).map(([g, e]) => [g, e.nb, Math.round(e.kg), parseFloat((e.kg / 1000).toFixed(3))])

                      const siteMap: Record<string, { nb: number; kg: number }> = {}
                      mesLotsFiltered.forEach((l: any) => {
                        const s = l.site?.codeSite ?? 'Non défini'
                        if (!siteMap[s]) siteMap[s] = { nb: 0, kg: 0 }
                        siteMap[s].nb++; siteMap[s].kg += Number(l.quantiteNette) || 0
                      })
                      const siteRows = Object.entries(siteMap).sort(([, a], [, b]) => b.kg - a.kg).map(([s, e]) => [s, e.nb, Math.round(e.kg), parseFloat((e.kg / 1000).toFixed(3))])

                      downloadXlsx(`senjiw-mes-lots-${date}`, [
                        { name: 'Mes lots',       headers: ['Code lot', 'Variété', 'Génération', 'Campagne', 'Date production', 'Quantité (kg)', 'Quantité (t)', 'Germination (%)', 'Pureté (%)', 'Statut', 'Site'], rows: lotsRows },
                        { name: 'Par génération', headers: ['Génération', 'Nb lots', 'Total (kg)', 'Total (t)'], rows: genRows },
                        { name: 'Par site',       headers: ['Site', 'Nb lots', 'Total (kg)', 'Total (t)'], rows: siteRows },
                      ])
                    }}
                  >
                    <Download size={13} /> Export .xls
                  </button>
                )}
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
                    cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)', fontWeight: filterCampagneMes ? 700 : 400,
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
                  const fmtQty   = (v: number) => fmtT(v)
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
                        {fmtQty(prodKg)} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{allUpsemcl ? 'reçus' : 'prod.'}</span>
                      </div>
                      {stockKg > 0 && !allUpsemcl && (
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--green-700)', fontWeight: 600 }}>
                          {fmtQty(stockKg)} stock
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
                                {certShieldIcon(l)}
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
                                  style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: certButtonColor(l) }}
                                  title={certButtonTitle(l)}
                                  onClick={() => setCertLotMult(l)}
                                >{certShieldIcon(l) ?? <Shield size={13} />}</button>
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

      {/* Modal ajout au panier */}
      {showCartModal && cartAddLot && (() => {
        const v = varietyMap[cartAddLot.idVariete]
        return (
          <Modal
            title="Ajouter au panier"
            subtitle={`${cartAddLot.codeLot}${v ? ` — ${v.nomVariete}` : ''}`}
            onClose={() => setShowCartModal(false)}
            size="sm"
          >
            <div style={{ background: 'var(--green-50,#f0fdf4)', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#14532d' }}>
              <div style={{ display: 'grid', gap: 3 }}>
                {v && <div><strong>Variété :</strong> {v.nomVariete} · <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v.codeVariete}</span></div>}
                <div><strong>Stock disponible :</strong> {Number(cartAddLot.quantiteNette).toLocaleString('fr-FR')} {cartAddLot.unite}</div>
                {cartAddLot.tauxGermination != null && <div><strong>Germination :</strong> {cartAddLot.tauxGermination}% · <strong>Pureté :</strong> {cartAddLot.puretePhysique ?? '—'}%</div>}
              </div>
            </div>
            <form onSubmit={e => { e.preventDefault(); cartAdd() }}>
              <Field label="Quantité souhaitée" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput
                    type="number"
                    value={cartAddQty}
                    onChange={e => setCartAddQty(e.target.value)}
                    placeholder={`Max ${Number(cartAddLot.quantiteNette).toLocaleString('fr-FR')}`}
                    min="1" max={cartAddLot.quantiteNette} step="0.01"
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <FormSelect value={cartAddUnite} onChange={e => setCartAddUnite(e.target.value)} style={{ width: 80 }}>
                    <option value="kg">kg</option>
                    <option value="t">t</option>
                  </FormSelect>
                </div>
              </Field>
              <FormActions onCancel={() => setShowCartModal(false)} loading={false} submitLabel="Ajouter au panier" />
            </form>
          </Modal>
        )
      })()}

      {/* Barre panier sticky */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', borderTop: '2px solid #16a34a',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'stretch', gap: 0,
        }}>
          {/* Résumé panier */}
          <div style={{ flex: 1, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={16} style={{ color: '#16a34a' }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                {cart.length} lot{cart.length > 1 ? 's' : ''} sélectionné{cart.length > 1 ? 's' : ''}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                · {cartTotalKg.toLocaleString('fr-FR')} kg
              </span>
            </div>
            {/* Chips des lots sélectionnés */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {cart.map(item => (
                <span key={item.lotId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 20, padding: '2px 8px 2px 10px', fontSize: 11.5, color: '#15803d', fontWeight: 600 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{item.codeLot}</span>
                  <span style={{ opacity: 0.7 }}>· {item.quantite.toLocaleString('fr-FR')} {item.unite}</span>
                  <button onClick={() => cartRemove(item.lotId)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#15803d', opacity: 0.6, marginLeft: 2 }}><X size={11} /></button>
                </span>
              ))}
            </div>
          </div>
          {/* Zone observations + bouton submit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <input
              value={cartObs}
              onChange={e => setCartObs(e.target.value)}
              placeholder="Observations (optionnel)"
              style={{ width: 220, height: 36, padding: '0 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', background: 'var(--surface)', color: 'var(--text-primary)' }}
            />
            <button
              className="btn btn-ghost"
              style={{ height: 36, padding: '0 12px', fontSize: 12, color: 'var(--text-muted)' }}
              onClick={() => setCart([])}
            >
              <X size={13} /> Vider
            </button>
            <button
              className="btn btn-primary"
              style={{ height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700, gap: 6 }}
              disabled={saving}
              onClick={e => { e.preventDefault(); submitCart(e as any) }}
            >
              <ShoppingCart size={14} />
              {saving ? 'Envoi…' : `Commander (${cart.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Lots({ roleKey, userSpecialisation }: Props) {
  const [lots, setLots] = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [generation, setGeneration] = useState('')
  const [loading, setLoading] = useState(true)
  const [lotStatsApi, setLotStatsApi] = useState<Record<string, { count: number; totalKg: number }>>({})
  const [statsLoading, setStatsLoading] = useState(true)
  const [stockAgrege, setStockAgrege] = useState<any[]>([])
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
  const [filterStatut,   setFilterStatut]   = useState('')
  const [certLot,        setCertLot]         = useState<any | null>(null)
  const canManageCert = ['seed-admin','seed-selector','seed-upsemcl','seed-multiplicator'].includes(roleKey)
  const [selectedLot,    setSelectedLot]    = useState<any | null>(null)
  const [chartCollapsed, setChartCollapsed] = useState(false)
  const [filterEspece,   setFilterEspece]   = useState('')

  async function fetchLots() {
    setLoading(true)
    // seed-upsemcl : endpoint non paginé pour charger G1+G2+G3 sans troncature à 20
    const url = roleKey === 'seed-upsemcl'
      ? endpoints.lotsMesLots
      : generation ? `${endpoints.lots}?generation=${generation}` : endpoints.lots
    api.get(url).then(r => {
      let data = extractList(r.data).map(normalizeLot)
      if (roleKey !== 'seed-admin') data = data.filter((l: any) => allowedGens.includes(l.generation?.codeGeneration))
      setLots(data)
    }).catch(() => setLots([])).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLots()
    api.get(endpoints.varieties).then(r => setVarieties(extractList(r.data).map(normalizeVariete))).catch(() => {})
    api.get(endpoints.membres).then(r => setMembres(r.data)).catch(() => {})
    api.get(endpoints.sites).then(r => setSites(r.data)).catch(() => {})
    if (roleKey === 'seed-upsemcl' || roleKey === 'seed-selector')
      api.get(endpoints.stocksAgrege).then(r => setStockAgrege(extractList(r.data))).catch(() => {})
  }, [generation])

  useEffect(() => {
    setStatsLoading(true)
    api.get(endpoints.lotsStats)
      .then(r => {
        const map: Record<string, { count: number; totalKg: number }> = {}
        ;(Array.isArray(r.data) ? r.data : []).forEach((s: any) => {
          map[s.codeGeneration] = { count: Number(s.nbLots ?? 0), totalKg: Number(s.totalKg ?? 0) }
        })
        setLotStatsApi(map)
      })
      .catch(() => setLotStatsApi({}))
      .finally(() => setStatsLoading(false))
  }, [])

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

  const fmtKg = (v: number) => fmtT(v)

  // UPSemCL et sélectionneur : count depuis leurs lots filtrés, tonnes depuis stockAgrege (stock physique).
  // Évite la divergence entre quantiteNette (historique production) et stock disponible réel.
  const useFilteredStats = roleKey === 'seed-upsemcl' || roleKey === 'seed-selector'
  const genStats: Record<string, { count: number; totalKg: number }> = (() => {
    if (!useFilteredStats) return lotStatsApi
    const acc: Record<string, { count: number; totalKg: number }> = {}
    displayLots.forEach(l => {
      const g = l.generation?.codeGeneration ?? 'N/A'
      if (!acc[g]) acc[g] = { count: 0, totalKg: 0 }
      acc[g].count++
    })
    stockAgrege.forEach((s: any) => {
      const g = s.codeGeneration ?? 'N/A'
      if (!acc[g]) acc[g] = { count: 0, totalKg: 0 }
      acc[g].totalKg += parseFloat(s.quantiteTotale) || 0
    })
    return acc
  })()
  const totalKg = Object.values(genStats).reduce((s, g) => s + g.totalKg, 0)
  const activeGens = useFilteredStats
    ? allowedGens.filter(g => (genStats[g]?.count ?? 0) > 0 || !lots.length)
    : allowedGens.filter(g => lotStatsApi[g] && lotStatsApi[g].count > 0)

  const varietyMap: Record<number, { codeVariete: string; nomVariete: string }> =
    Object.fromEntries(varieties.map(v => [v.id, v]))

  const especeByVarieteId: Record<number, string> = Object.fromEntries(
    varieties.map(v => [v.id, (v as any).espece?.nomCommun || (v as any).espece?.codeEspece || ''])
  )
  const especesDisponibles = [...new Set(
    displayLots.map(l => especeByVarieteId[l.idVariete]).filter(Boolean)
  )].sort() as string[]

  const chartHorizData: HorizDatum[] = Object.values(
    displayLots
      .filter(l => {
        if (filterEspece && especeByVarieteId[l.idVariete] !== filterEspece) return false
        if (genFilter    && l.generation?.codeGeneration !== genFilter)        return false
        return true
      })
      .reduce((acc: Record<string, HorizDatum>, l) => {
        const vName = (varietyMap[l.idVariete] as any)?.nomVariete ?? 'Inconnue'
        const gen   = l.generation?.codeGeneration ?? 'N/A'
        if (!acc[vName]) acc[vName] = { label: vName, gens: {} }
        acc[vName].gens[gen] = (acc[vName].gens[gen] ?? 0) + Number(l.quantiteNette || 0)
        return acc
      }, {})
  ).sort((a, b) => {
    const tA = activeGens.reduce((s, g) => s + (a.gens[g] ?? 0), 0)
    const tB = activeGens.reduce((s, g) => s + (b.gens[g] ?? 0), 0)
    return tB - tA
  })
  const chartActiveGens = activeGens.filter(g => chartHorizData.some(d => (d.gens[g] ?? 0) > 0))
  const chartTotalKg    = chartHorizData.reduce((s, d) => s + Object.values(d.gens).reduce((a, b) => a + b, 0), 0)
  const chartTitle      = roleKey === 'seed-upsemcl'
    ? 'Lots G1→G3 par variété'
    : roleKey === 'seed-admin'
    ? 'Répartition des volumes par variété'
    : 'Production par variété'

  const availableStatuts = [...new Set(displayLots.map(l => l.statutLot).filter(Boolean))].sort() as string[]

  const displayLotsFiltered = displayLots.filter(l => {
    const matchGen    = !genFilter    || l.generation?.codeGeneration === genFilter
    const matchStatut = !filterStatut || l.statutLot === filterStatut
    const s = search.toLowerCase()
    const v = varietyMap[l.idVariete]
    const matchSearch = !s
      || l.codeLot?.toLowerCase().includes(s)
      || v?.nomVariete?.toLowerCase().includes(s)
      || (v as any)?.codeVariete?.toLowerCase().includes(s)
    return matchGen && matchStatut && matchSearch
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

  const ROLE_LABEL_MAP = ROLE_LABELS

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
              {loading || statsLoading
                ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>…</span>
                : useFilteredStats
                  ? displayLots.length
                  : Object.values(lotStatsApi).reduce((s, g) => s + g.count, 0)}
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
          const stat = genStats[gen] ?? { count: 0, totalKg: 0 }
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
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', flex: 1 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, stat.totalKg / totalKg * 100)}%`, background: hex, borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 10, color: hex, fontWeight: 700, marginLeft: 6, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(stat.totalKg / totalKg * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {chartHorizData.length > 0 && (
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div
            className="card-header"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setChartCollapsed(c => !c)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span className="card-title"><span className="card-title-icon"><Layers size={15} /></span>{chartTitle}</span>
              {chartCollapsed && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                  {chartHorizData.length} variété{chartHorizData.length > 1 ? 's' : ''} · {fmtKg(chartTotalKg)}
                </span>
              )}
            </div>
            <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: chartCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform .2s', flexShrink: 0 }} />
          </div>
          {!chartCollapsed && especesDisponibles.length > 1 && (
            <div style={{ display: 'flex', gap: 6, padding: '8px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>Espèce</span>
              {(['', ...especesDisponibles] as string[]).map(esp => {
                const active = filterEspece === esp
                return (
                  <button
                    key={esp || '__all'}
                    onClick={e => { e.stopPropagation(); setFilterEspece(esp) }}
                    style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer',
                      border: `1.5px solid ${active ? 'var(--green-600,#16a34a)' : 'var(--border)'}`,
                      background: active ? 'var(--green-50,#f0fdf4)' : 'var(--surface)',
                      color: active ? 'var(--green-700,#15803d)' : 'var(--text-muted)',
                      fontWeight: active ? 700 : 400, transition: 'all 0.12s',
                    }}
                  >
                    {esp || 'Toutes'}
                  </button>
                )
              })}
            </div>
          )}
          {!chartCollapsed && (
            <MesLotsHorizChart
              data={chartHorizData}
              gens={chartActiveGens}
              onVarClick={name => { setSearch(name); setChartCollapsed(false) }}
            />
          )}
        </div>
      )}

      {roleKey === 'seed-upsemcl' && (
        <CatalogueG1UPSemCL setToast={setToast} />
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><Package size={15} /></span>{roleKey === 'seed-upsemcl' ? 'Mes Lots G1 · G2 · G3' : 'Liste des Lots'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {displayLotsFiltered.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ gap: 5, fontSize: 12 }}
                onClick={() => {
                  const date = new Date().toISOString().slice(0, 10)
                  const lotsRows = displayLotsFiltered.map(l => {
                    const v = varietyMap[l.idVariete]; const kg = Number(l.quantiteNette) || 0
                    return [l.codeLot ?? '', v?.nomVariete ?? '', v?.codeVariete ?? '', l.generation?.codeGeneration ?? '', l.campagne ?? '', formatDateForExport(l.dateProduction), kg, parseFloat((kg / 1000).toFixed(3)), l.tauxGermination ?? '', l.puretePhysique ?? '', l.statutLot ?? '', l.site?.codeSite ?? '']
                  })
                  const totalKg = displayLotsFiltered.reduce((s, l) => s + (Number(l.quantiteNette) || 0), 0)
                  lotsRows.push(['TOTAL', '', '', '', '', '', Math.round(totalKg), parseFloat((totalKg / 1000).toFixed(3)), '', '', '', ''])

                  const genMap: Record<string, { nb: number; kg: number }> = {}
                  displayLotsFiltered.forEach(l => {
                    const g = l.generation?.codeGeneration ?? '?'
                    if (!genMap[g]) genMap[g] = { nb: 0, kg: 0 }
                    genMap[g].nb++; genMap[g].kg += Number(l.quantiteNette) || 0
                  })
                  const genRows = Object.entries(genMap).sort(([a], [b]) => a.localeCompare(b)).map(([g, e]) => [g, e.nb, Math.round(e.kg), parseFloat((e.kg / 1000).toFixed(3))])

                  const varAgg: Record<string, { nom: string; code: string; nb: number; kg: number }> = {}
                  displayLotsFiltered.forEach(l => {
                    const v = varietyMap[l.idVariete]; const code = v?.codeVariete ?? String(l.idVariete)
                    if (!varAgg[code]) varAgg[code] = { nom: v?.nomVariete ?? '', code, nb: 0, kg: 0 }
                    varAgg[code].nb++; varAgg[code].kg += Number(l.quantiteNette) || 0
                  })
                  const varRows = Object.values(varAgg).sort((a, b) => b.kg - a.kg).map(e => [e.nom, e.code, e.nb, Math.round(e.kg), parseFloat((e.kg / 1000).toFixed(3))])

                  downloadXlsx(`senjiw-lots-${generation || 'tous'}-${date}`, [
                    { name: 'Lots',           headers: ['Code lot', 'Variété', 'Code variété', 'Génération', 'Campagne', 'Date production', 'Quantité (kg)', 'Quantité (t)', 'Germination (%)', 'Pureté (%)', 'Statut', 'Site'], rows: lotsRows },
                    { name: 'Par génération', headers: ['Génération', 'Nb lots', 'Total (kg)', 'Total (t)'], rows: genRows },
                    { name: 'Par variété',    headers: ['Variété', 'Code variété', 'Nb lots', 'Total (kg)', 'Total (t)'], rows: varRows },
                  ])
                }}
              >
                <Download size={13} /> Export .xls
              </button>
            )}
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
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'var(--font-sans)', flex: 1, color: 'var(--text-primary)' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={13} /></button>}
          </div>
          {/* Chips génération */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {allowedGens.filter(g => genCounts[g] || roleKey === 'seed-admin' || roleKey === 'seed-upsemcl').map(g => {
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
          {/* Filtre statut (UPSemCL et autres rôles) */}
          {availableStatuts.length > 1 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {availableStatuts.map(s => {
                const isActive = filterStatut === s
                const color = s === 'DISPONIBLE' ? '#16a34a' : s === 'TRANSFERE' ? '#0369a1' : '#6b7280'
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatut(filterStatut === s ? '' : s)}
                    style={{
                      height: 28, padding: '0 10px', borderRadius: 20, fontSize: 11, fontWeight: isActive ? 700 : 500,
                      background: isActive ? color + '18' : 'var(--surface-2)',
                      color: isActive ? color : 'var(--text-muted)',
                      border: `1px solid ${isActive ? color + '55' : 'var(--border)'}`,
                      cursor: 'pointer', transition: 'all .12s',
                    }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          )}
          {/* Effacer filtres */}
          {(search || genFilter || generation || filterEspece || filterStatut) && (
            <button className="btn btn-ghost" style={{ fontSize: 12, height: 28 }} onClick={() => { setSearch(''); setGenFilter(''); setGeneration(''); setFilterEspece(''); setFilterStatut('') }}>
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
            <thead>
              <tr>
                <th>Code Lot</th>
                <th>Variété</th>
                <th>Gén. / Statut</th>
                <th>Qualité</th>
                <th>Quantité</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [0,1,2,3].map(i => (
                <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>
              )) : displayLotsFiltered.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon"><Package size={20} /></div>
                    <div className="empty-title">{search || genFilter || filterStatut ? 'Aucun lot pour ce filtre' : 'Aucun lot'}</div>
                    {canCreate && !search && !genFilter && !filterStatut && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowNewLot(true)}>+ Créer un lot</button>}
                  </div>
                </td></tr>
              ) : displayLotsFiltered.map(l => {
                const gen = l.generation?.codeGeneration || 'N/A'
                const hex = GEN_HEX[gen] ?? '#6b7280'
                const v   = varietyMap[l.idVariete] as any
                const isSelected = selectedLot?.id === l.id
                return (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLot(l)}
                    style={{
                      boxShadow: `inset 3px 0 0 ${hex}`,
                      cursor: 'pointer',
                      background: isSelected ? hex + '08' : undefined,
                      transition: 'background .12s',
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className="td-mono" style={{ fontWeight: 700 }}>{l.codeLot}</span>
                        {certShieldIcon(l)}
                      </div>
                      {l.lotParent?.codeLot && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          ↑ {l.lotParent.codeLot}
                        </div>
                      )}
                    </td>
                    <td>
                      {v ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{v.nomVariete}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{v.codeVariete}</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <span className={`badge ${GEN_COLORS[gen] || 'badge-gray'}`} style={{ fontSize: 11 }}>{gen}</span>
                        <span className={`badge ${l.statutLot === 'DISPONIBLE' ? 'badge-green' : l.statutLot === 'TRANSFERE' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: 10 }}>{l.statutLot}</span>
                      </div>
                    </td>
                    <td>
                      {l.tauxGermination != null || l.puretePhysique != null ? (
                        <div style={{ minWidth: 88 }}>
                          {l.tauxGermination != null && (
                            <div style={{ marginBottom: 5 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Germ. {l.tauxGermination}%</div>
                              <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, Number(l.tauxGermination))}%`, background: Number(l.tauxGermination) >= 85 ? '#16a34a' : Number(l.tauxGermination) >= 70 ? '#EAB308' : '#EF4444', borderRadius: 2 }} />
                              </div>
                            </div>
                          )}
                          {l.puretePhysique != null && (
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Pureté {l.puretePhysique}%</div>
                              <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, Number(l.puretePhysique))}%`, background: Number(l.puretePhysique) >= 90 ? '#16a34a' : Number(l.puretePhysique) >= 75 ? '#EAB308' : '#EF4444', borderRadius: 2 }} />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                        {Number(l.quantiteNette).toLocaleString('fr-FR')} <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 400 }}>{l.unite}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {l.campagne}{l.site?.codeSite ? ` · ${l.site.codeSite}` : ''}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
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
                          style={{ width: 30, height: 30, padding: 0, borderRadius: 6, color: certButtonColor(l) }}
                          title={certButtonTitle(l)}
                          onClick={() => setCertLot(l)}
                        >{certShieldIcon(l) ?? <Shield size={13} />}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slide-over panel détail lot ───────────────────────────── */}
      {selectedLot && (() => {
        const l   = selectedLot
        const gen = l.generation?.codeGeneration || 'N/A'
        const hex = GEN_HEX[gen] ?? '#6b7280'
        const v   = varietyMap[l.idVariete] as any
        return (
          <>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            <div
              onClick={() => setSelectedLot(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.22)', zIndex: 999 }}
            />
            <div style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
              background: 'var(--surface)', borderLeft: '1px solid var(--border)',
              boxShadow: '-6px 0 32px rgba(0,0,0,0.13)',
              zIndex: 1000, display: 'flex', flexDirection: 'column',
              animation: 'slideInRight 0.22s ease-out',
            }}>
              {/* Header */}
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', background: hex + '09', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span className="td-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{l.codeLot}</span>
                    {l.responsableNom && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                        {ROLE_NODE_COLORS[l.responsableRole]?.label || l.responsableRole || ''} {l.responsableNom}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => setSelectedLot(null)}><X size={15} /></button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${GEN_COLORS[gen] || 'badge-gray'}`}>{gen}</span>
                  <span className={`badge ${l.statutLot === 'DISPONIBLE' ? 'badge-green' : l.statutLot === 'TRANSFERE' ? 'badge-blue' : 'badge-gray'}`}>{l.statutLot}</span>
                  <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                    {certShieldIcon(l, 12)} {(l.statutCertification || 'SANS_CERTIFICAT').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <PanelSection title="Identité">
                  <PanelRow label="Variété" value={v ? `${v.nomVariete}` : '—'} />
                  {v?.codeVariete && <PanelRow label="Code variété" value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v.codeVariete}</span>} />}
                  <PanelRow label="Génération" value={gen} />
                  <PanelRow label="Campagne" value={l.campagne || '—'} />
                  <PanelRow label="Lot parent" value={l.lotParent?.codeLot
                    ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.lotParent.codeLot}</span>
                    : '—'} />
                  <PanelRow label="Site" value={l.site?.nomSite || l.site?.codeSite || '—'} />
                </PanelSection>

                <PanelSection title="Production">
                  <PanelRow label="Date production" value={l.dateProduction ? new Date(l.dateProduction).toLocaleDateString('fr-FR') : '—'} />
                  <PanelRow label="Quantité nette" value={l.quantiteNette ? `${Number(l.quantiteNette).toLocaleString('fr-FR')} ${l.unite || 'kg'}` : '—'} />
                  {l.productionBruteKg && <PanelRow label="Production brute" value={`${Number(l.productionBruteKg).toLocaleString('fr-FR')} kg`} />}
                  {l.superficieHa && <PanelRow label="Superficie" value={`${l.superficieHa} ha`} />}
                  {l.cycle && <PanelRow label="Cycle" value={l.cycle} />}
                  {l.niveauSemence && <PanelRow label="Niveau semence" value={l.niveauSemence} />}
                </PanelSection>

                <PanelSection title="Qualité">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Taux de germination</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{l.tauxGermination != null ? `${l.tauxGermination}%` : '—'}</span>
                    </div>
                    {l.tauxGermination != null && (
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, Number(l.tauxGermination))}%`, background: Number(l.tauxGermination) >= 85 ? '#16a34a' : Number(l.tauxGermination) >= 70 ? '#EAB308' : '#EF4444', borderRadius: 3, transition: 'width 0.5s ease' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pureté physique</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{l.puretePhysique != null ? `${l.puretePhysique}%` : '—'}</span>
                    </div>
                    {l.puretePhysique != null && (
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, Number(l.puretePhysique))}%`, background: Number(l.puretePhysique) >= 90 ? '#16a34a' : Number(l.puretePhysique) >= 75 ? '#EAB308' : '#EF4444', borderRadius: 3, transition: 'width 0.5s ease' }} />
                      </div>
                    )}
                  </div>
                </PanelSection>

                <PanelSection title="Certification">
                  <PanelRow label="Statut" value={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {certShieldIcon(l, 13)} {(l.statutCertification || 'SANS_CERTIFICAT').replace(/_/g, ' ')}
                    </span>
                  } />
                  {l.certificatPath && <PanelRow label="Fichier" value="Disponible" />}
                </PanelSection>
              </div>

              {/* Footer actions */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-secondary" style={{ fontSize: 12, gap: 5, flex: '1 1 auto' }}
                  onClick={() => { setSelectedLot(null); showLineage(l) }}>
                  {lineageLoading === l.id ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Eye size={12} />}
                  Traçabilité
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 12, gap: 5, flex: '1 1 auto', color: certButtonColor(l) }}
                  onClick={() => { setSelectedLot(null); setCertLot(l) }}>
                  <Shield size={12} /> Certificat
                </button>
                {canChildForLot(l) && NEXT_GEN[gen] && (
                  <button className="btn btn-primary" style={{ fontSize: 12, gap: 5, flex: '1 1 auto' }}
                    onClick={() => {
                      const nextGen = NEXT_GEN[gen]
                      setSelectedLot(null); setParentLot(l)
                      setChildForm({
                        codeLot: suggestChildCode(l.codeLot || '', gen, nextGen),
                        generationCode: nextGen, campagne: l.campagne || new Date().getFullYear().toString(),
                        dateProduction: '', quantiteNette: '', unite: 'kg',
                        tauxGermination: '', puretePhysique: '', quantiteSemenceSrcKg: '',
                        superficieHa: '', productionBruteKg: '', cycle: 'C', niveauSemence: '', siteCode: '',
                      })
                      setShowChildLot(true)
                    }}>
                    <GitBranch size={12} /> Créer {NEXT_GEN[gen]}
                  </button>
                )}
                {canTransferLot(l) && l.statutLot !== 'TRANSFERE' && (
                  <button className="btn btn-secondary" style={{ fontSize: 12, gap: 5, flex: '1 1 auto' }}
                    onClick={() => {
                      setSelectedLot(null); setParentLot(l)
                      setTransferForm({ usernameDestinataire: '', roleDestinataire: '', quantite: '', observations: '' })
                      const targetRole = roleKey === 'seed-selector' ? 'seed-upsemcl' : 'seed-multiplicator'
                      setMembresLoading(true)
                      api.get(endpoints.membresByRole(targetRole))
                        .then(r => setMembres(r.data))
                        .catch(() => setMembres([]))
                        .finally(() => setMembresLoading(false))
                      setShowTransfer(true)
                    }}>
                    <ArrowRightLeft size={12} /> Transférer
                  </button>
                )}
                {l.statutLot === 'TRANSFERE' && bordereauCache.has(l.id) && (
                  <button className="btn btn-ghost" style={{ fontSize: 12, gap: 5, flex: '1 1 auto', color: '#0369a1' }}
                    onClick={() => { const cached = bordereauCache.get(l.id); if (cached) generateTransferDoc(cached) }}>
                    <FileText size={12} /> Bordereau
                  </button>
                )}
                {canReception && gen === 'R2' && (
                  <button className="btn btn-primary" style={{ fontSize: 12, gap: 5, flex: '1 1 auto' }}
                    onClick={() => { setSelectedLot(null); setParentLot(l); setReceptionForm({ siteCode: '', quantite: '', unite: 'kg', dateReception: '' }); setShowReception(true) }}>
                    <Download size={12} /> Réceptionner
                  </button>
                )}
              </div>
            </div>
          </>
        )
      })()}

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
                <textarea value={transferForm.observations} onChange={e => setTransferForm(f => ({ ...f, observations: e.target.value }))} placeholder="Notes sur le transfert…" style={{ width: '100%', minHeight: 70, padding: '8px 11px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </Field>
              <FormActions onCancel={() => setShowTransfer(false)} loading={saving} submitLabel="Envoyer le transfert" />
            </form>
          </Modal>
        )
      })()}
    </div>
  )
}
