import React, { useEffect, useRef, useState } from 'react'
import { FileText, Download, CheckCircle, XCircle, Clock, Eye, X, AlertTriangle } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'

/* ── Types ── */
interface FactureLigneDto {
  id: number
  idLot: number
  codeLot?: string
  nomVariete?: string
  codeVariete?: string
  generation?: string
  campagne?: string
  quantite: number
  unite: string
  prixUnitaireHt: number
  tauxTva: number
  montantHt: number
  montantTtc: number
}

interface ArfDto {
  id: number
  usernameAcheteur: string
  statut: string
  observations?: string
  dateAccusee: string
}

interface FactureDto {
  id: number
  numeroFacture: string
  typeFacture: 'INSTITUTIONNELLE' | 'MULTIPLICATEUR'
  dateEmission: string
  statut: 'EMISE' | 'ACQUITTEE' | 'CONTESTEE'
  montantHt: number
  montantTva: number
  montantTtc: number
  usernameEmetteur?: string
  observations?: string
  lignes: FactureLigneDto[]
  accuseReception?: ArfDto
  commande?: {
    id: number
    idOrganisationFournisseur?: number
    idOrganisationAcheteur?: number
    usernameAcheteur?: string
  }
}

interface Props { roleKey: string }

const fmt = (n: number) => new Intl.NumberFormat('fr-SN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

/* ══════════════════════════════════════════════
   Template d'impression — INSTITUTIONNELLE
   ══════════════════════════════════════════════ */
function TemplateISRA({ facture, onClose }: { facture: FactureDto; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null)

  function imprimer() {
    const content = printRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>${facture.numeroFacture}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
        body { background: #fff; color: #111; font-size: 12px; padding: 20mm; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
        th { background: #1a3c5e; color: #fff; font-size: 11px; }
        .text-right { text-align: right; }
        .total-row td { font-weight: 700; background: #f0f4fa; }
        .sig-row { display: flex; gap: 40px; margin-top: 40px; }
        .sig-box { flex: 1; border-top: 1px solid #888; padding-top: 8px; font-size: 11px; }
      </style>
      </head><body>${content}</body></html>`)
    win.document.close()
    win.print()
  }

  const d = new Date(facture.dateEmission).toLocaleDateString('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 820, borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', marginBottom: 20 }}>

        {/* Actions bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#1a3c5e', color: '#fff' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Facture Officielle ISRA/CNRA — {facture.numeroFacture}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={imprimer} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1a3c5e', border: 'none', borderRadius: 6, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              <Download size={14} /> Imprimer / PDF
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '7px 10px', color: '#fff', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Document */}
        <div ref={printRef} style={{ padding: '32px 40px', color: '#111', fontSize: 12 }}>

          {/* En-tête */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1a3c5e', letterSpacing: -0.5 }}>ISRA / CNRA BAMBEY</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Institut Sénégalais de Recherches Agricoles</div>
              <div style={{ fontSize: 11, color: '#555' }}>Centre National de Recherche Agronomique — Bambey, Sénégal</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>UPSemCL — Unité de Production Semencière</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1a3c5e', letterSpacing: -1 }}>FACTURE</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{facture.numeroFacture}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Date : {d}</div>
              <div style={{ marginTop: 8, display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: facture.statut === 'ACQUITTEE' ? '#dcfce7' : facture.statut === 'CONTESTEE' ? '#fee2e2' : '#dbeafe', color: facture.statut === 'ACQUITTEE' ? '#166534' : facture.statut === 'CONTESTEE' ? '#991b1b' : '#1d4ed8' }}>
                {facture.statut}
              </div>
            </div>
          </div>

          {/* Séparateur */}
          <div style={{ borderTop: '3px solid #1a3c5e', marginBottom: 24 }} />

          {/* Émetteur / Destinataire */}
          <div style={{ display: 'flex', gap: 40, marginBottom: 28 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Émetteur</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1a3c5e' }}>ISRA / UPSemCL</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Centre National de Recherche Agronomique</div>
              <div style={{ fontSize: 11, color: '#444' }}>Bambey — Diourbel, Sénégal</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Émis par : {facture.usernameEmetteur || '—'}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Destinataire (Acheteur)</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{facture.commande?.usernameAcheteur || '—'}</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Multiplicateur accrédité ISRA/CNRA</div>
              {facture.commande?.id && (
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Commande n° {facture.commande.id}</div>
              )}
            </div>
          </div>

          {/* Tableau des lignes */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#1a3c5e', color: '#fff' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>Variété</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Gén.</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>Campagne</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Qté ({facture.lignes[0]?.unite || 'kg'})</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>P.U. HT (FCFA)</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>TVA %</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Montant HT</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {facture.lignes.map((l, i) => (
                <tr key={l.id} style={{ background: i % 2 ? '#f8faff' : '#fff' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e5e7eb' }}>
                    {l.nomVariete || '—'} {l.codeVariete ? `(${l.codeVariete})` : ''}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{l.generation || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{l.campagne || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.quantite)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.prixUnitaireHt)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{l.tauxTva} %</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.montantHt)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(l.montantTtc)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0f4fa' }}>
                <td colSpan={6} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', borderTop: '2px solid #1a3c5e' }}>Total HT</td>
                <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', borderTop: '2px solid #1a3c5e', fontVariantNumeric: 'tabular-nums' }}>{fmt(facture.montantHt)} FCFA</td>
              </tr>
              <tr style={{ background: '#f0f4fa' }}>
                <td colSpan={6} style={{ padding: '6px 10px', textAlign: 'right', color: '#555' }}>TVA</td>
                <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right', color: '#555', fontVariantNumeric: 'tabular-nums' }}>{fmt(facture.montantTva)} FCFA</td>
              </tr>
              <tr style={{ background: '#1a3c5e', color: '#fff' }}>
                <td colSpan={6} style={{ padding: '10px', fontWeight: 900, textAlign: 'right', fontSize: 13 }}>TOTAL TTC</td>
                <td colSpan={2} style={{ padding: '10px', fontWeight: 900, textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmt(facture.montantTtc)} FCFA</td>
              </tr>
            </tfoot>
          </table>

          {/* Observations */}
          {facture.observations && (
            <div style={{ marginBottom: 24, padding: '12px 16px', background: '#f8faff', borderLeft: '3px solid #1a3c5e', borderRadius: 4, fontSize: 11 }}>
              <strong>Observations :</strong> {facture.observations}
            </div>
          )}

          {/* ARF */}
          {facture.accuseReception && (
            <div style={{ marginBottom: 24, padding: '12px 16px', background: facture.accuseReception.statut === 'RECU' ? '#f0fdf4' : '#fef2f2', borderLeft: `3px solid ${facture.accuseReception.statut === 'RECU' ? '#16a34a' : '#dc2626'}`, borderRadius: 4, fontSize: 11 }}>
              <strong>Accusé de réception ({facture.accuseReception.statut}) :</strong> reçu le {new Date(facture.accuseReception.dateAccusee).toLocaleDateString('fr-SN')} par {facture.accuseReception.usernameAcheteur}
              {facture.accuseReception.observations && <div style={{ marginTop: 4, color: '#555' }}>{facture.accuseReception.observations}</div>}
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: 'flex', gap: 40, marginTop: 40 }}>
            <div style={{ flex: 1 }}>
              <div style={{ borderTop: '1px solid #888', paddingTop: 8, fontSize: 11, color: '#555' }}>
                <div style={{ fontWeight: 700, color: '#1a3c5e', marginBottom: 4 }}>L'Émetteur — ISRA/UPSemCL</div>
                <div style={{ height: 50 }} />
                <div>Nom & Signature</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ borderTop: '1px solid #888', paddingTop: 8, fontSize: 11, color: '#555' }}>
                <div style={{ fontWeight: 700, color: '#1a3c5e', marginBottom: 4 }}>L'Acheteur (Multiplicateur)</div>
                <div style={{ height: 50 }} />
                <div>Nom & Signature · Cachet</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Template d'impression — MULTIPLICATEUR
   ══════════════════════════════════════════════ */
function TemplateMultiplicateur({ facture, onClose }: { facture: FactureDto; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null)

  function imprimer() {
    const content = printRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>${facture.numeroFacture}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
        body { background: #fff; color: #111; font-size: 12px; padding: 20mm; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
        th { background: #15803d; color: #fff; font-size: 11px; }
        .text-right { text-align: right; }
        .total-row td { font-weight: 700; background: #f0fdf4; }
      </style>
      </head><body>${content}</body></html>`)
    win.document.close()
    win.print()
  }

  const d = new Date(facture.dateEmission).toLocaleDateString('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 820, borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', marginBottom: 20 }}>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#15803d', color: '#fff' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Facture Multiplicateur — {facture.numeroFacture}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={imprimer} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#15803d', border: 'none', borderRadius: 6, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              <Download size={14} /> Imprimer / PDF
            </button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: '7px 10px', color: '#fff', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Document */}
        <div ref={printRef} style={{ padding: '32px 40px', color: '#111', fontSize: 12 }}>

          {/* En-tête */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d' }}>FACTURE DE VENTE</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Semences R2 certifiées — Filière ISRA/CNRA</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Émis par : {facture.usernameEmetteur || '—'} (Multiplicateur accrédité)</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{facture.numeroFacture}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Date : {d}</div>
              <div style={{ marginTop: 8, display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: facture.statut === 'ACQUITTEE' ? '#dcfce7' : facture.statut === 'CONTESTEE' ? '#fee2e2' : '#dbeafe', color: facture.statut === 'ACQUITTEE' ? '#166534' : facture.statut === 'CONTESTEE' ? '#991b1b' : '#1d4ed8' }}>
                {facture.statut}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '3px solid #15803d', marginBottom: 20 }} />

          {/* Vendeur / Acheteur */}
          <div style={{ display: 'flex', gap: 40, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Vendeur (Multiplicateur)</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>{facture.usernameEmetteur || '—'}</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Multiplicateur accrédité ISRA/CNRA</div>
              <div style={{ fontSize: 11, color: '#444' }}>Sénégal</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Acheteur (Quotataire / OP)</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{facture.commande?.usernameAcheteur || '—'}</div>
              <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Organisation de producteurs</div>
              {facture.commande?.id && (
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Réf. commande #{facture.commande.id}</div>
              )}
            </div>
          </div>

          {/* Lignes */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#15803d', color: '#fff' }}>
                <th style={{ padding: '8px 10px' }}>Variété</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Gén.</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Campagne</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qté ({facture.lignes[0]?.unite || 'kg'})</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>P.U. HT</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>TVA %</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Montant HT</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {facture.lignes.map((l, i) => (
                <tr key={l.id} style={{ background: i % 2 ? '#f6fef9' : '#fff' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #e5e7eb' }}>{l.nomVariete || '—'} {l.codeVariete ? `(${l.codeVariete})` : ''}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{l.generation || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{l.campagne || '—'}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.quantite)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.prixUnitaireHt)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>{l.tauxTva} %</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.montantHt)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(l.montantTtc)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0fdf4' }}>
                <td colSpan={6} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', borderTop: '2px solid #15803d' }}>Total HT</td>
                <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', borderTop: '2px solid #15803d', fontVariantNumeric: 'tabular-nums' }}>{fmt(facture.montantHt)} FCFA</td>
              </tr>
              <tr style={{ background: '#f0fdf4' }}>
                <td colSpan={6} style={{ padding: '6px 10px', textAlign: 'right', color: '#555' }}>TVA</td>
                <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right', color: '#555', fontVariantNumeric: 'tabular-nums' }}>{fmt(facture.montantTva)} FCFA</td>
              </tr>
              <tr style={{ background: '#15803d', color: '#fff' }}>
                <td colSpan={6} style={{ padding: '10px', fontWeight: 900, textAlign: 'right', fontSize: 13 }}>TOTAL TTC</td>
                <td colSpan={2} style={{ padding: '10px', fontWeight: 900, textAlign: 'right', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{fmt(facture.montantTtc)} FCFA</td>
              </tr>
            </tfoot>
          </table>

          {facture.observations && (
            <div style={{ marginBottom: 20, padding: '10px 14px', background: '#f6fef9', borderLeft: '3px solid #15803d', borderRadius: 4, fontSize: 11 }}>
              <strong>Observations :</strong> {facture.observations}
            </div>
          )}

          {facture.accuseReception && (
            <div style={{ marginBottom: 20, padding: '10px 14px', background: facture.accuseReception.statut === 'RECU' ? '#f0fdf4' : '#fef2f2', borderLeft: `3px solid ${facture.accuseReception.statut === 'RECU' ? '#16a34a' : '#dc2626'}`, borderRadius: 4, fontSize: 11 }}>
              <strong>ARF ({facture.accuseReception.statut}) :</strong> le {new Date(facture.accuseReception.dateAccusee).toLocaleDateString('fr-SN')} par {facture.accuseReception.usernameAcheteur}
              {facture.accuseReception.observations && <div style={{ marginTop: 4, color: '#555' }}>{facture.accuseReception.observations}</div>}
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: 'flex', gap: 40, marginTop: 40 }}>
            <div style={{ flex: 1, borderTop: '1px solid #888', paddingTop: 8, fontSize: 11, color: '#555' }}>
              <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 4 }}>Le Vendeur (Multiplicateur)</div>
              <div style={{ height: 50 }} />
              <div>Nom & Signature · Cachet</div>
            </div>
            <div style={{ flex: 1, borderTop: '1px solid #888', paddingTop: 8, fontSize: 11, color: '#555' }}>
              <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 4 }}>L'Acheteur (Quotataire/OP)</div>
              <div style={{ height: 50 }} />
              <div>Nom & Signature · Cachet</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Modal ARF
   ══════════════════════════════════════════════ */
function ArfModal({ factureId, onClose, onSuccess }: { factureId: number; onClose: () => void; onSuccess: () => void }) {
  const [statut,       setStatut]       = useState<'RECU' | 'CONTESTE'>('RECU')
  const [observations, setObservations] = useState('')
  const [loading,      setLoading]      = useState(false)
  const [err,          setErr]          = useState('')

  async function submit() {
    setLoading(true); setErr('')
    try {
      await api.post(endpoints.factureAccuserReception(factureId), { statut, observations: observations || undefined })
      onSuccess()
      onClose()
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Erreur lors de l\'envoi de l\'accusé de réception')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Accusé de réception de facture</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>Confirmez-vous la réception de cette facture ?</div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              onClick={() => setStatut('RECU')}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${statut === 'RECU' ? '#16a34a' : 'var(--border)'}`, background: statut === 'RECU' ? '#f0fdf4' : 'transparent', color: statut === 'RECU' ? '#166534' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <CheckCircle size={15} /> Reçue — Conforme
            </button>
            <button
              onClick={() => setStatut('CONTESTE')}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${statut === 'CONTESTE' ? '#dc2626' : 'var(--border)'}`, background: statut === 'CONTESTE' ? '#fef2f2' : 'transparent', color: statut === 'CONTESTE' ? '#991b1b' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <XCircle size={15} /> Contestée
            </button>
          </div>

          <textarea
            value={observations}
            onChange={e => setObservations(e.target.value)}
            placeholder={statut === 'CONTESTE' ? 'Motif de contestation (requis)…' : 'Observations facultatives…'}
            style={{ width: '100%', height: 80, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted)', fontSize: 12, resize: 'vertical', color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />

          {err && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, color: '#991b1b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={13} /> {err}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onClose}>Annuler</button>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, background: statut === 'CONTESTE' ? '#dc2626' : '#16a34a', borderColor: statut === 'CONTESTE' ? '#dc2626' : '#16a34a' }}
            disabled={loading || (statut === 'CONTESTE' && !observations.trim())}
            onClick={submit}
          >
            {loading ? 'Envoi…' : statut === 'RECU' ? 'Confirmer réception' : 'Envoyer contestation'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════
   Statut badge
   ══════════════════════════════════════════════ */
function StatutBadge({ statut }: { statut: string }) {
  const cfg: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    EMISE:     { color: '#1d4ed8', bg: '#dbeafe', icon: <Clock size={11} />,        label: 'Émise' },
    ACQUITTEE: { color: '#166534', bg: '#dcfce7', icon: <CheckCircle size={11} />, label: 'Acquittée' },
    CONTESTEE: { color: '#991b1b', bg: '#fee2e2', icon: <XCircle size={11} />,     label: 'Contestée' },
  }
  const c = cfg[statut] ?? { color: '#555', bg: '#f3f4f6', icon: null, label: statut }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: c.color, background: c.bg }}>
      {c.icon} {c.label}
    </span>
  )
}

/* ══════════════════════════════════════════════
   Page principale
   ══════════════════════════════════════════════ */
export function Factures({ roleKey }: Props) {
  const [factures,    setFactures]    = useState<FactureDto[]>([])
  const [loading,     setLoading]     = useState(true)
  const [err,         setErr]         = useState('')
  const [selected,    setSelected]    = useState<FactureDto | null>(null)
  const [arfModal,    setArfModal]    = useState<number | null>(null)
  const [filterStatut,setFilterStatut] = useState<string>('TOUS')

  async function charger() {
    setLoading(true); setErr('')
    try {
      const r = await api.get(endpoints.factures, { params: { size: 100 } })
      const data = r.data?.content ?? r.data ?? []
      setFactures(data)
    } catch (e: any) {
      setErr('Impossible de charger les factures')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  const filtrees = filterStatut === 'TOUS' ? factures : factures.filter(f => f.statut === filterStatut)

  const canARF = roleKey === 'seed-multiplicator' || roleKey === 'seed-quotataire' || roleKey === 'seed-admin'
  const canGenerer = roleKey === 'seed-upsemcl' || roleKey === 'seed-multiplicator' || roleKey === 'seed-admin'

  return (
    <div style={{ padding: '0 24px 40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} style={{ color: '#0369a1' }} /> Factures
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {filtrees.length} facture{filtrees.length !== 1 ? 's' : ''} · Total : {fmt(filtrees.reduce((s, f) => s + f.montantTtc, 0))} FCFA TTC
          </p>
        </div>

        {/* Filtre statut */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['TOUS', 'EMISE', 'ACQUITTEE', 'CONTESTEE'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatut(s)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterStatut === s ? '#0369a1' : 'var(--border)'}`, background: filterStatut === s ? '#0369a1' : 'var(--surface)', color: filterStatut === s ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: filterStatut === s ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}
            >
              {s === 'TOUS' ? 'Toutes' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Erreur */}
      {err && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 20, fontSize: 13, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} /> {err}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>Chargement des factures…</div>
      )}

      {/* Tableau */}
      {!loading && filtrees.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <FileText size={40} style={{ opacity: 0.25, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Aucune facture</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            {filterStatut !== 'TOUS' ? 'Modifiez le filtre pour voir d\'autres factures.' : canGenerer ? 'Générez une facture depuis une commande livrée.' : 'Aucune facture disponible pour votre compte.'}
          </div>
        </div>
      )}

      {!loading && filtrees.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>N° Facture</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Type</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Date</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Montant HT</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Montant TTC</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Statut</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map(f => (
                <tr key={f.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{f.numeroFacture}</div>
                    {f.commande?.id && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Commande #{f.commande.id}</div>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: f.typeFacture === 'INSTITUTIONNELLE' ? '#dbeafe' : '#dcfce7', color: f.typeFacture === 'INSTITUTIONNELLE' ? '#1d4ed8' : '#166534' }}>
                      {f.typeFacture === 'INSTITUTIONNELLE' ? 'ISRA' : 'Multiplicateur'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-secondary)' }}>
                    {new Date(f.dateEmission).toLocaleDateString('fr-SN')}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                    {fmt(f.montantHt)} FCFA
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmt(f.montantTtc)} FCFA
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                    <StatutBadge statut={f.statut} />
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        title="Voir la facture"
                        onClick={() => setSelected(f)}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                      >
                        <Eye size={13} /> Voir
                      </button>
                      {canARF && f.statut === 'EMISE' && !f.accuseReception && (
                        <button
                          title="Accuser réception"
                          onClick={() => setArfModal(f.id)}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#166534', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}
                        >
                          <CheckCircle size={13} /> Accuser réc.
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Template modal */}
      {selected && selected.typeFacture === 'INSTITUTIONNELLE' && (
        <TemplateISRA facture={selected} onClose={() => setSelected(null)} />
      )}
      {selected && selected.typeFacture === 'MULTIPLICATEUR' && (
        <TemplateMultiplicateur facture={selected} onClose={() => setSelected(null)} />
      )}

      {/* ARF modal */}
      {arfModal !== null && (
        <ArfModal
          factureId={arfModal}
          onClose={() => setArfModal(null)}
          onSuccess={charger}
        />
      )}
    </div>
  )
}
