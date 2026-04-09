/**
 * PendingDeliveries — Livraisons en attente de réception
 * Affiché dans le Dashboard de seed-upsemcl et seed-multiplicator
 */
import React, { useEffect, useState } from 'react'
import {
  Clock, Download, CheckCircle2, X, Package, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { keycloak } from '../../lib/keycloak'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import {
  generateTransferDoc, generateNumero,
  type TransferDocData, type LotPdfData, type PartiePdf,
} from '../../lib/pdf/generateTransferDoc'

/* ── Types ────────────────────────────────────────────────────── */
interface Props { roleKey: string }

interface Transfert {
  id:                   number
  codeTransfert:        string
  idLot:                number
  usernameEmetteur:     string
  roleEmetteur:         string
  usernameDestinataire: string
  roleDestinataire:     string
  generationTransferee: string
  quantite:             number | null
  statut:               string
  dateDemande:          string
  dateAcceptation:      string | null
  observations:         string | null
}

interface LotDetail {
  id:               number
  codeLot:          string
  idVariete:        number
  generation:       { codeGeneration: string }
  lotParent:        { codeLot: string } | null
  quantiteNette:    number
  unite:            string
  campagne:         string
  tauxGermination:  number | null
  puretePhysique:   number | null
  statutLot:        string
  dateProduction:   string | null
}

/* ── Constantes ───────────────────────────────────────────────── */
const ROLE_LABEL: Record<string, string> = {
  'seed-selector':      'Sélectionneur ISRA',
  'seed-upsemcl':       'UPSem-CL',
  'seed-multiplicator': 'Multiplicateur',
  'seed-quotataire':    'Quotataire / OP',
  'seed-admin':         'Administrateur ISRA',
}

const GEN_CLASS: Record<string, string> = {
  G1: 'badge-green', G2: 'badge-gold', G3: 'badge-gray',
  G4: 'badge-gray',  R1: 'badge-blue', R2: 'badge-green',
}

function isOld(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > 48 * 3600 * 1000
}

function getUserFromToken(): { nom: string; username: string } {
  const t   = keycloak.tokenParsed as Record<string, string> | undefined
  const fn  = t?.given_name  ?? ''
  const ln  = t?.family_name ?? ''
  const nom = [fn, ln].filter(Boolean).join(' ') || t?.preferred_username || 'Destinataire'
  return { nom, username: t?.preferred_username ?? '' }
}

/* ── Composant ────────────────────────────────────────────────── */
export function PendingDeliveries({ roleKey }: Props) {
  const [transferts,     setTransferts]     = useState<Transfert[]>([])
  const [loading,        setLoading]        = useState(true)
  const [confirmTarget,  setConfirmTarget]  = useState<{
    transfert: Transfert; lot: LotDetail; variety: Record<string, unknown> | null
  } | null>(null)
  const [confForm,       setConfForm]       = useState({ quantiteRecue: '', observations: '' })
  const [loadingConf,    setLoadingConf]    = useState<number | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [toast,          setToast]          = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [dlLoading,      setDlLoading]      = useState<number | null>(null)

  // Rôles destinataires uniquement
  if (!['seed-upsemcl', 'seed-multiplicator'].includes(roleKey)) return null

  async function fetchPending() {
    setLoading(true)
    try {
      const r = await api.get(endpoints.transfertsRecus)
      setTransferts(r.data ?? [])
    } catch { setTransferts([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPending() }, [roleKey])

  /* ─── Helpers pour construire le TransferDocData ─── */
  function buildLotPdf(lot: LotDetail, variety: Record<string, unknown> | null): LotPdfData {
    const esp = variety?.espece as Record<string, string> | undefined
    return {
      codeLot:          lot.codeLot,
      nomVariete:       (variety?.nomVariete as string) ?? '—',
      nomEspece:        esp?.nomCommun ?? esp?.codeEspece ?? '—',
      generationCode:   lot.generation.codeGeneration,
      quantiteNette:    lot.quantiteNette,
      unite:            lot.unite,
      tauxGermination:  lot.tauxGermination ?? undefined,
      puretePhysique:   lot.puretePhysique  ?? undefined,
      statutLot:        lot.statutLot,
      dateProduction:   lot.dateProduction  ?? undefined,
      campagne:         lot.campagne,
      lotParentCode:    lot.lotParent?.codeLot,
    }
  }

  function buildPartieExp(t: Transfert): PartiePdf {
    return {
      username:  t.usernameEmetteur,
      nom:       t.usernameEmetteur,
      roleKey:   t.roleEmetteur,
      roleLabel: ROLE_LABEL[t.roleEmetteur] ?? t.roleEmetteur,
    }
  }

  function buildPartieDest(t: Transfert): PartiePdf {
    return {
      username:  t.usernameDestinataire,
      nom:       t.usernameDestinataire,
      roleKey:   t.roleDestinataire,
      roleLabel: ROLE_LABEL[t.roleDestinataire] ?? t.roleDestinataire,
    }
  }

  /* ─── Télécharger le Bordereau depuis la liste ─── */
  async function downloadBordereau(t: Transfert) {
    setDlLoading(t.id)
    try {
      const [lotR, varR] = await Promise.allSettled([
        api.get(endpoints.lotById(t.idLot)),
        api.get(endpoints.varieties),
      ])
      if (lotR.status !== 'fulfilled') return
      const lot: LotDetail        = lotR.value.data
      const varieties: unknown[]  = varR.status === 'fulfilled' ? varR.value.data : []
      const variety               = (varieties as Array<Record<string, unknown>>)
                                      .find(v => v.id === lot.idVariete) ?? null

      const docData: TransferDocData = {
        type:               'BORDEREAU',
        codeTransfert:      t.codeTransfert,
        numero:             generateNumero(t.id),
        lot:                buildLotPdf(lot, variety),
        expediteur:         buildPartieExp(t),
        destinataire:       buildPartieDest(t),
        quantiteTransferee: t.quantite ?? lot.quantiteNette,
        dateDemande:        t.dateDemande,
        observations:       t.observations ?? undefined,
      }
      generateTransferDoc(docData)
    } finally { setDlLoading(null) }
  }

  /* ─── Ouvrir le modal de confirmation ─── */
  async function openConfirm(t: Transfert) {
    setLoadingConf(t.id)
    try {
      const [lotR, varR] = await Promise.allSettled([
        api.get(endpoints.lotById(t.idLot)),
        api.get(endpoints.varieties),
      ])
      if (lotR.status !== 'fulfilled') return
      const lot: LotDetail        = lotR.value.data
      const varieties: unknown[]  = varR.status === 'fulfilled' ? varR.value.data : []
      const variety               = (varieties as Array<Record<string, unknown>>)
                                      .find(v => v.id === lot.idVariete) ?? null
      setConfirmTarget({ transfert: t, lot, variety })
      setConfForm({
        quantiteRecue: String(t.quantite ?? lot.quantiteNette),
        observations:  '',
      })
    } finally { setLoadingConf(null) }
  }

  /* ─── Confirmer la réception + générer l'Accusé PDF ─── */
  async function confirmReception() {
    if (!confirmTarget) return
    setSaving(true)
    const { transfert, lot, variety } = confirmTarget
    const user = getUserFromToken()

    try {
      await api.put(endpoints.transfertAccepter(transfert.id), {})

      const qRecue = Number(confForm.quantiteRecue) || (transfert.quantite ?? lot.quantiteNette)
      const today  = new Date().toISOString().slice(0, 10)

      const docData: TransferDocData = {
        type:                  'ACCUSE_RECEPTION',
        codeTransfert:         transfert.codeTransfert,
        numero:                generateNumero(transfert.id),
        lot:                   buildLotPdf(lot, variety),
        expediteur:            buildPartieExp(transfert),
        destinataire:          buildPartieDest(transfert),
        quantiteTransferee:    transfert.quantite ?? lot.quantiteNette,
        dateDemande:           transfert.dateDemande,
        observations:          transfert.observations ?? undefined,
        dateAcceptation:       today,
        nomReceptionnaire:     user.nom,
        quantiteRecue:         qRecue,
        observationsReception: confForm.observations || undefined,
      }
      generateTransferDoc(docData)

      setToast({ msg: `Réception confirmée — Accusé de réception (AR-${transfert.codeTransfert}.pdf) téléchargé`, type: 'success' })
      setConfirmTarget(null)
      fetchPending()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de la confirmation'
      setToast({ msg, type: 'error' })
    } finally { setSaving(false) }
  }

  /* ── Affichage vide ── */
  if (!loading && transferts.length === 0) return null

  /* ════════════════════════════════════════════════════════════════
     RENDU
  ════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ marginTop: 20 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color:      toast.type === 'success' ? '#15803d' : '#b91c1c',
          border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 10, maxWidth: 420,
        }}>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Carte principale */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--gold-dark)' }}>
            <span className="card-title-icon" style={{ background: 'var(--gold-light)' }}>
              <Clock size={15} color="var(--gold-dark)" />
            </span>
            Livraisons en attente de réception
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {transferts.length > 0 && (
              <span style={{
                background: '#fef9ed', color: 'var(--gold-dark)',
                border: '1px solid #fde68a', borderRadius: 99,
                padding: '2px 10px', fontSize: 12, fontWeight: 700,
              }}>
                {transferts.length}
              </span>
            )}
            <button
              className="btn btn-ghost"
              style={{ width: 28, height: 28, padding: 0, borderRadius: 6 }}
              title="Actualiser"
              onClick={fetchPending}
            >
              <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1].map(i => (
              <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8 }} />
            ))}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Expéditeur</th>
                  <th>Lot</th>
                  <th>Génération</th>
                  <th>Quantité</th>
                  <th>Date envoi</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transferts.map(t => (
                  <tr key={t.id}>
                    <td>
                      <span className="td-mono" style={{ fontWeight: 700 }}>{t.codeTransfert}</span>
                      {isOld(t.dateDemande) && (
                        <span
                          title="Livraison en attente depuis plus de 48h"
                          style={{ marginLeft: 7, display: 'inline-flex', alignItems: 'center' }}
                        >
                          <AlertTriangle size={11} color="#dc2626" />
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.usernameEmetteur}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {ROLE_LABEL[t.roleEmetteur] ?? t.roleEmetteur}
                      </div>
                    </td>
                    <td>
                      <span className="td-mono" style={{ fontSize: 11 }}>Lot #{t.idLot}</span>
                    </td>
                    <td>
                      <span className={`badge ${GEN_CLASS[t.generationTransferee] ?? 'badge-gray'}`}>
                        {t.generationTransferee}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        {t.quantite != null ? t.quantite.toLocaleString('fr-FR') : '—'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 11 }}>kg</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {t.dateDemande
                        ? new Date(t.dateDemande).toLocaleDateString('fr-FR')
                        : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/* Télécharger le Bordereau */}
                        <button
                          className="btn btn-ghost"
                          style={{ width: 30, height: 30, padding: 0, borderRadius: 6 }}
                          title="Télécharger le Bordereau de Livraison"
                          disabled={dlLoading === t.id}
                          onClick={() => downloadBordereau(t)}
                        >
                          {dlLoading === t.id
                            ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                            : <Download size={13} />}
                        </button>
                        {/* Confirmer la réception */}
                        <button
                          className="btn btn-primary"
                          style={{ height: 30, fontSize: 11.5, padding: '0 10px', gap: 4, borderRadius: 6 }}
                          title="Confirmer la réception et générer l'Accusé"
                          disabled={loadingConf === t.id}
                          onClick={() => openConfirm(t)}
                        >
                          {loadingConf === t.id
                            ? <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                            : <CheckCircle2 size={11} />}
                          Réceptionner
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          MODAL DE CONFIRMATION
      ════════════════════════════════════════════════════════ */}
      {confirmTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            width: 500, maxWidth: '100%', padding: 24,
          }}>
            {/* En-tête modal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Package size={18} color="#15803d" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Confirmer la réception</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {confirmTarget.transfert.codeTransfert}
                </div>
              </div>
              <button
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setConfirmTarget(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Résumé lot */}
            <div style={{
              background: 'var(--surface-2)', borderRadius: 8,
              padding: '12px 14px', marginBottom: 16,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 14px', fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>Lot · </span>
                  <strong>{confirmTarget.lot.codeLot}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>Génération · </span>
                  <strong>{confirmTarget.lot.generation.codeGeneration}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>Variété · </span>
                  <strong>
                    {(confirmTarget.variety?.nomVariete as string) ?? '—'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>Expéditeur · </span>
                  <strong>{confirmTarget.transfert.usernameEmetteur}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>Qté attendue · </span>
                  <strong style={{ color: 'var(--green-700)' }}>
                    {(confirmTarget.transfert.quantite ?? confirmTarget.lot.quantiteNette)
                      .toLocaleString('fr-FR')}{' '}
                    {confirmTarget.lot.unite}
                  </strong>
                </div>
              </div>
            </div>

            {/* Formulaire */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Quantité effectivement reçue ({confirmTarget.lot.unite})
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={confForm.quantiteRecue}
                  onChange={e => setConfForm(f => ({ ...f, quantiteRecue: e.target.value }))}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  Observations / Écart constaté{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optionnel)</span>
                </label>
                <textarea
                  className="input"
                  style={{
                    width: '100%', minHeight: 64, resize: 'vertical',
                    fontFamily: 'Outfit, sans-serif', fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                  value={confForm.observations}
                  onChange={e => setConfForm(f => ({ ...f, observations: e.target.value }))}
                  placeholder="Tout conforme — aucun écart constaté…"
                />
              </div>
            </div>

            {/* Info + boutons */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 18,
              flexWrap: 'wrap',
            }}>
              <div style={{
                flex: 1, fontSize: 11.5, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5,
                minWidth: 200,
              }}>
                <Download size={11} />
                L'accusé de réception PDF sera généré automatiquement
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmTarget(null)}
                disabled={saving}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmReception}
                disabled={saving}
                style={{ gap: 5 }}
              >
                {saving
                  ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <CheckCircle2 size={12} />}
                Confirmer & Générer Accusé
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(1.5); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
