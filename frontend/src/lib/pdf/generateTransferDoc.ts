/**
 * Génération PDF — Bordereau de Livraison & Accusé de Réception
 * Conforme au format officiel ISRA/CNRA — Bambey
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* ── Types ─────────────────────────────────────────────────────── */
export type DocType = 'BORDEREAU' | 'ACCUSE_RECEPTION'

export interface LotPdfData {
  codeLot:           string
  nomVariete:        string
  nomEspece:         string
  generationCode:    string
  quantiteNette:     number
  unite:             string
  tauxGermination?:  number
  puretePhysique?:   number
  statutLot:         string
  dateProduction?:   string
  campagne?:         string
  lotParentCode?:    string
}

export interface PartiePdf {
  username:  string
  nom:       string
  roleKey:   string
  roleLabel: string
}

export interface TransferDocData {
  type:              DocType
  codeTransfert:     string
  numero:            string
  lot:               LotPdfData
  expediteur:        PartiePdf
  destinataire:      PartiePdf
  quantiteTransferee: number
  dateDemande:       string
  observations?:     string
  // Accusé de réception uniquement
  dateAcceptation?:      string
  nomReceptionnaire?:    string
  quantiteRecue?:        number
  observationsReception?: string
}

/* ── Constantes ─────────────────────────────────────────────────── */
const GREEN:  [number, number, number] = [27,  94,  32]
const BLUE:   [number, number, number] = [13,  71, 161]
const DARK:   [number, number, number] = [33,  33,  33]
const MUTED:  [number, number, number] = [100, 100, 100]
const GRAY:   [number, number, number] = [180, 180, 180]
const BG_GRN: [number, number, number] = [240, 253, 244]
const BG_BLU: [number, number, number] = [235, 245, 255]
const BG_GLD: [number, number, number] = [254, 249, 237]
const GLD:    [number, number, number] = [146, 102,  10]

/* ── Numérotation officielle ────────────────────────────────────── */
export function generateNumero(transfertId: number): string {
  const year = new Date().getFullYear()
  const seq  = String(transfertId).padStart(3, '0')
  return `N° 00 ${seq}/ISRA/CNRA/${year}`
}

/* ── Formatage date ─────────────────────────────────────────────── */
function fmtDate(d: string | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return d }
}

/* ── Générateur principal ───────────────────────────────────────── */
export function generateTransferDoc(data: TransferDocData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W  = 210
  const ML = 18
  const MR = 18
  const TW = W - ML - MR
  let   Y  = 14

  /* ════════════════════════════════════════════════════════════════
     EN-TÊTE OFFICIEL ISRA/CNRA
  ════════════════════════════════════════════════════════════════ */

  // Bloc institution gauche
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text('REPUBLIQUE DU SENEGAL', ML, Y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text('Un Peuple – Un But – Une Foi', ML, Y + 3.5)

  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.25)
  doc.line(ML, Y + 5.2, ML + 60, Y + 5.2)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...DARK)
  doc.text('MINISTERE DE L\'AGRICULTURE,', ML, Y + 8.5)
  doc.text('DE LA SOUVERAINETE ALIMENTAIRE', ML, Y + 12)
  doc.text('ET DE L\'ELEVAGE', ML, Y + 15.5)

  doc.setDrawColor(...GRAY)
  doc.line(ML, Y + 17, ML + 60, Y + 17)

  doc.text('INSTITUT SENEGALAIS DE', ML, Y + 20.5)
  doc.text('RECHERCHES AGRICOLES', ML, Y + 24)

  doc.setDrawColor(...GRAY)
  doc.line(ML, Y + 25.5, ML + 60, Y + 25.5)

  // Logo ISRA (rectangle vert avec texte)
  doc.setFillColor(...GREEN)
  doc.roundedRect(ML + 15, Y + 27, 24, 11, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('ISRA', ML + 27, Y + 34, { align: 'center' })
  doc.setTextColor(...DARK)

  // CNRA
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('CENTRE NATIONAL DE RECHERCHES AGRONOMIQUES', ML, Y + 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.setTextColor(...MUTED)
  doc.text('B.P. 53 – Bambey  ·  Tél. : (221) 33 973 60 50  ·  cnrabambey@isra.sn', ML, Y + 46)
  doc.setTextColor(...DARK)

  // Bloc droite : numéro + date
  const RX = ML + TW
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...BLUE)
  doc.text(data.numero, RX, Y + 4, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  doc.text(`Bambey, le ${fmtDate(data.dateDemande)}`, RX, Y + 12, { align: 'right' })

  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text(`Réf. : ${data.codeTransfert}`, RX, Y + 17, { align: 'right' })
  doc.setTextColor(...DARK)

  Y += 52

  /* ════════════════════════════════════════════════════════════════
     TITRE
  ════════════════════════════════════════════════════════════════ */
  const titre = data.type === 'BORDEREAU'
    ? 'BORDEREAU DE LIVRAISON'
    : 'ACCUSÉ DE RÉCEPTION'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...GREEN)
  doc.text(titre, W / 2, Y, { align: 'center' })

  const tW = doc.getTextWidth(titre)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.7)
  doc.line(W / 2 - tW / 2, Y + 1.8, W / 2 + tW / 2, Y + 1.8)
  doc.setTextColor(...DARK)

  Y += 10

  /* ════════════════════════════════════════════════════════════════
     DESTINATION
  ════════════════════════════════════════════════════════════════ */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Destination :', ML, Y)
  doc.setFont('helvetica', 'normal')
  doc.text(data.destinataire.roleLabel, ML + 30, Y)

  Y += 8

  /* ════════════════════════════════════════════════════════════════
     PARTIES : EXPÉDITEUR | DESTINATAIRE
  ════════════════════════════════════════════════════════════════ */
  const colW = (TW - 6) / 2

  // Expéditeur
  doc.setFillColor(248, 255, 248)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.4)
  doc.roundedRect(ML, Y, colW, 30, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREEN)
  doc.text('EXPÉDITEUR', ML + 3, Y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text(`Nom / Structure : ${data.expediteur.nom || data.expediteur.username}`, ML + 3, Y + 12)
  doc.text(`Rôle : ${data.expediteur.roleLabel}`, ML + 3, Y + 17)
  doc.text(`Date d'envoi : ${fmtDate(data.dateDemande)}`, ML + 3, Y + 22)
  doc.text(`Username : ${data.expediteur.username}`, ML + 3, Y + 27)

  // Destinataire
  const dX = ML + colW + 6
  doc.setFillColor(235, 245, 255)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.4)
  doc.roundedRect(dX, Y, colW, 30, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BLUE)
  doc.text('DESTINATAIRE', dX + 3, Y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text(`Structure : ${data.destinataire.roleLabel}`, dX + 3, Y + 12)
  doc.text(`Username : ${data.destinataire.username}`, dX + 3, Y + 17)
  if (data.type === 'ACCUSE_RECEPTION' && data.nomReceptionnaire) {
    doc.text(`Réceptionné par : ${data.nomReceptionnaire}`, dX + 3, Y + 22)
    doc.text(`Date réception : ${fmtDate(data.dateAcceptation)}`, dX + 3, Y + 27)
  }

  Y += 36

  /* ════════════════════════════════════════════════════════════════
     TABLEAU DES SEMENCES
  ════════════════════════════════════════════════════════════════ */
  const nbSacs = Math.ceil(data.quantiteTransferee / 50)

  autoTable(doc, {
    startY: Y,
    head: [['Désignation', 'Variété', 'Génération', 'Quantité (kg)', 'Nbre sacs', 'Observations']],
    body: [
      [
        `Semence de ${data.lot.nomEspece}`,
        `${data.lot.nomVariete}`,
        `${data.lot.generationCode}`,
        `${data.quantiteTransferee.toLocaleString('fr-FR')} ${data.lot.unite}`,
        String(nbSacs),
        data.lot.statutLot,
      ],
      ['', 'TOTAL', '', `${data.quantiteTransferee.toLocaleString('fr-FR')} ${data.lot.unite}`, String(nbSacs), ''],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: GREEN,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [250, 252, 250] },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'center' },
    },
    rowPageBreak: 'avoid',
    margin: { left: ML, right: MR },
  })

  Y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  /* ════════════════════════════════════════════════════════════════
     RÉSULTATS D'ANALYSE & TRAÇABILITÉ
  ════════════════════════════════════════════════════════════════ */
  doc.setFillColor(...BG_GRN)
  doc.setDrawColor(187, 247, 208)
  doc.setLineWidth(0.3)
  doc.roundedRect(ML, Y, TW, 30, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text("RÉSULTATS D'ANALYSE & TRAÇABILITÉ", ML + 3, Y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)

  const c1 = ML + 3
  const c2 = ML + TW / 2 + 5

  doc.text(`Code lot : ${data.lot.codeLot}`, c1, Y + 13)
  doc.text(`Taux germination : ${data.lot.tauxGermination ?? '—'} %`, c2, Y + 13)
  doc.text(`Lot parent : ${data.lot.lotParentCode || '—'}`, c1, Y + 19)
  doc.text(`Pureté physique : ${data.lot.puretePhysique ?? '—'} %`, c2, Y + 19)
  doc.text(`Campagne : ${data.lot.campagne || '—'}`, c1, Y + 25)
  doc.text(`Date production : ${data.lot.dateProduction ? fmtDate(data.lot.dateProduction) : '—'}`, c2, Y + 25)

  Y += 36

  /* ════════════════════════════════════════════════════════════════
     SECTION REÇU CONFORME (Accusé de réception seulement)
  ════════════════════════════════════════════════════════════════ */
  if (data.type === 'ACCUSE_RECEPTION') {
    doc.setFillColor(...BG_BLU)
    doc.setDrawColor(147, 197, 253)
    doc.setLineWidth(0.3)
    doc.roundedRect(ML, Y, TW, 30, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...BLUE)
    doc.text('REÇU CONFORME', ML + 3, Y + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...DARK)

    const qRecue = data.quantiteRecue ?? data.quantiteTransferee
    const ecart  = qRecue - data.quantiteTransferee

    doc.text(`Par : ${data.nomReceptionnaire || '—'}`, c1, Y + 13)
    doc.text(`Quantité reçue : ${qRecue.toLocaleString('fr-FR')} ${data.lot.unite}`, c2, Y + 13)
    doc.text(`Le : ${fmtDate(data.dateAcceptation)}`, c1, Y + 19)
    doc.text(`Écart constaté : ${ecart >= 0 ? '+' : ''}${ecart.toLocaleString('fr-FR')} ${data.lot.unite}`, c2, Y + 19)
    if (data.observationsReception) {
      doc.text(`Observations : ${data.observationsReception}`, c1, Y + 25)
    }

    Y += 36
  }

  // Observations transfert
  if (data.observations) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(`Observations : ${data.observations}`, ML, Y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    Y += 7
  }

  Y += 3

  /* ════════════════════════════════════════════════════════════════
     SIGNATURES — deux colonnes
  ════════════════════════════════════════════════════════════════ */
  const sigW = (TW - 8) / 2
  const sigH = 42

  // Signature expéditeur
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.4)
  doc.roundedRect(ML, Y, sigW, sigH, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREEN)
  doc.text(
    data.type === 'BORDEREAU' ? "L'EXPÉDITEUR" : "EXPÉDITEUR (certifie)",
    ML + sigW / 2, Y + 6, { align: 'center' }
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text(`Nom : ${data.expediteur.nom || data.expediteur.username}`, ML + 3, Y + 13)
  doc.text(`Date : ${fmtDate(data.dateDemande)}`, ML + 3, Y + 18)
  doc.setFontSize(7)
  doc.text('Signature :', ML + 3, Y + 27)
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.3)
  doc.line(ML + 22, Y + 27, ML + sigW - 4, Y + 27)
  // Cachet
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.25)
  doc.circle(ML + sigW - 12, Y + 35, 5, 'S')
  doc.setFontSize(5)
  doc.setTextColor(190, 190, 190)
  doc.text('CACHET', ML + sigW - 12, Y + 35.7, { align: 'center' })

  // Signature destinataire / directeur
  const s2X = ML + sigW + 8
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.4)
  doc.roundedRect(s2X, Y, sigW, sigH, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BLUE)
  const labelDest = data.type === 'BORDEREAU'
    ? 'LE DIRECTEUR / RESPONSABLE'
    : 'DESTINATAIRE (confirme)'
  doc.text(labelDest, s2X + sigW / 2, Y + 6, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  if (data.type === 'ACCUSE_RECEPTION') {
    doc.text(`Nom : ${data.nomReceptionnaire || '—'}`, s2X + 3, Y + 13)
    doc.text(`Reçu le : ${fmtDate(data.dateAcceptation)}`, s2X + 3, Y + 18)
  } else {
    doc.text('Nom : ________________________________', s2X + 3, Y + 13)
    doc.text('Date : ________________________________', s2X + 3, Y + 18)
  }
  doc.setFontSize(7)
  doc.text('Signature :', s2X + 3, Y + 27)
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.3)
  doc.line(s2X + 22, Y + 27, s2X + sigW - 4, Y + 27)
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.25)
  doc.circle(s2X + sigW - 12, Y + 35, 5, 'S')
  doc.setFontSize(5)
  doc.setTextColor(190, 190, 190)
  doc.text('CACHET', s2X + sigW - 12, Y + 35.7, { align: 'center' })

  Y += sigH + 8

  /* ════════════════════════════════════════════════════════════════
     BANDEAU STATUT
  ════════════════════════════════════════════════════════════════ */
  const isComplete = data.type === 'ACCUSE_RECEPTION'
  const statColor  = isComplete ? GREEN : GLD
  const statBg     = isComplete ? BG_GRN : BG_GLD
  const statTxt    = isComplete
    ? `TRANSFERT COMPLÉTÉ ✓  —  Réf. ${data.codeTransfert}`
    : 'EN ATTENTE DE RÉCEPTION'

  doc.setFillColor(...statBg)
  doc.setDrawColor(...statColor)
  doc.setLineWidth(0.5)
  doc.roundedRect(ML, Y, TW, 9, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...statColor)
  doc.text(`Statut : ${statTxt}`, W / 2, Y + 6, { align: 'center' })
  doc.setTextColor(...DARK)

  Y += 14

  /* ════════════════════════════════════════════════════════════════
     PIED DE PAGE
  ════════════════════════════════════════════════════════════════ */
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.3)
  doc.line(ML, Y - 4, ML + TW, Y - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text(
    'Bambey – TEL: 33 973 60 50 – E-mail : cnrabambey@isra.sn',
    W / 2, Y, { align: 'center' }
  )
  const genStr = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  doc.text(
    `Document généré par la Plateforme Semencière ISRA/CNRA — ${genStr}`,
    W / 2, Y + 4.5, { align: 'center' }
  )

  /* ── Sauvegarde ── */
  const prefix   = data.type === 'BORDEREAU' ? 'BL' : 'AR'
  const filename = `${prefix}-${data.codeTransfert}.pdf`
  doc.save(filename)
}
