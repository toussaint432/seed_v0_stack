/**
 * Génération PDF — Facture de Transfert de Semences
 * Format officiel ISRA/CNRA — Bambey
 * Utilisée pour : Sélectionneur→UPSemCL (G1) et UPSemCL→Multiplicateurs (G3)
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* ── Types ─────────────────────────────────────────────────────────── */
export interface FactureData {
  transfertId:         number
  codeTransfert:       string
  // Vendeur (expéditeur)
  vendeurUsername:     string
  vendeurNom:          string
  vendeurRole:         string
  vendeurAdresse?:     string
  // Acheteur (destinataire)
  acheteurUsername:    string
  acheteurNom:         string
  acheteurRole:        string
  acheteurAdresse?:    string
  // Semence
  codeLot:             string
  nomVariete:          string
  nomEspece:           string
  generationCode:      string
  quantiteKg:          number
  unite:               string
  campagne?:           string
  // Financier
  prixUnitaireKg:      number   // FCFA / kg
  tvaPercent:          number   // 0 ou 18
  // Dates
  dateFacture:         string
  dateEcheance?:       string
  // Optionnel
  conditions?:         string
  observations?:       string
}

export interface FactureResult {
  numeroFacture: string
  montantHT:     number
  montantTVA:    number
  montantTTC:    number
}

/* ── Numérotation officielle ──────────────────────────────────────── */
export function generateNumeroFacture(transfertId: number): string {
  const year = new Date().getFullYear()
  const seq  = String(transfertId).padStart(3, '0')
  return `FAC-00 ${seq}/ISRA/CNRA/${year}`
}

/* ── Formatage ────────────────────────────────────────────────────── */
function fmtDate(d: string | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return d }
}

function fmtFcfa(n: number): string {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

/* ── Couleurs ─────────────────────────────────────────────────────── */
const GREEN:  [number, number, number] = [27,  94,  32]
const BLUE:   [number, number, number] = [13,  71, 161]
const DARK:   [number, number, number] = [33,  33,  33]
const MUTED:  [number, number, number] = [100, 100, 100]
const GRAY:   [number, number, number] = [180, 180, 180]
const BG_GRN: [number, number, number] = [240, 253, 244]
const BG_BLU: [number, number, number] = [235, 245, 255]
const RED:    [number, number, number] = [185,  28,  28]

/* ── Générateur ───────────────────────────────────────────────────── */
export function generateFacture(data: FactureData): FactureResult {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W  = 210
  const ML = 18
  const MR = 18
  const TW = W - ML - MR
  let   Y  = 14

  // Calculs financiers
  const montantHT  = data.quantiteKg * data.prixUnitaireKg
  const montantTVA = data.tvaPercent > 0 ? Math.round(montantHT * data.tvaPercent / 100) : 0
  const montantTTC = montantHT + montantTVA
  const numeroFacture = generateNumeroFacture(data.transfertId)

  /* ══════════════════════════════════════════════════════════════════
     EN-TÊTE OFFICIEL ISRA/CNRA
  ══════════════════════════════════════════════════════════════════ */
  // Gauche — institution
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
  doc.text("MINISTERE DE L'AGRICULTURE,", ML, Y + 8.5)
  doc.text('DE LA SOUVERAINETE ALIMENTAIRE', ML, Y + 12)
  doc.text("ET DE L'ELEVAGE", ML, Y + 15.5)

  doc.setDrawColor(...GRAY)
  doc.line(ML, Y + 17, ML + 60, Y + 17)

  doc.text('INSTITUT SENEGALAIS DE', ML, Y + 20.5)
  doc.text('RECHERCHES AGRICOLES', ML, Y + 24)

  doc.setDrawColor(...GRAY)
  doc.line(ML, Y + 25.5, ML + 60, Y + 25.5)

  // Logo ISRA
  doc.setFillColor(...GREEN)
  doc.roundedRect(ML + 15, Y + 27, 24, 11, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('ISRA', ML + 27, Y + 34, { align: 'center' })
  doc.setTextColor(...DARK)

  // CNRA Bambey
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('CENTRE NATIONAL DE RECHERCHES AGRONOMIQUES', ML, Y + 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.setTextColor(...MUTED)
  doc.text('B.P. 53 – Bambey  ·  Tél. : (221) 33 973 60 50  ·  cnrabambey@isra.sn', ML, Y + 46)
  doc.setTextColor(...DARK)

  // Droite — numéro facture + date
  const RX = ML + TW
  doc.setFillColor(252, 241, 241)
  doc.setDrawColor(...RED)
  doc.setLineWidth(0.5)
  doc.roundedRect(RX - 70, Y, 70, 18, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...RED)
  doc.text('FACTURE', RX - 35, Y + 7, { align: 'center' })
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  doc.text(numeroFacture, RX - 35, Y + 13, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  doc.text(`Date : ${fmtDate(data.dateFacture)}`, RX, Y + 24, { align: 'right' })
  if (data.dateEcheance) {
    doc.text(`Échéance : ${fmtDate(data.dateEcheance)}`, RX, Y + 30, { align: 'right' })
  }
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text(`Réf. transfert : ${data.codeTransfert}`, RX, Y + 36, { align: 'right' })
  doc.setTextColor(...DARK)

  Y += 52

  /* ══════════════════════════════════════════════════════════════════
     TITRE
  ══════════════════════════════════════════════════════════════════ */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...RED)
  const titre = 'FACTURE DE CESSION DE SEMENCES'
  doc.text(titre, W / 2, Y, { align: 'center' })
  const tW = doc.getTextWidth(titre)
  doc.setDrawColor(...RED)
  doc.setLineWidth(0.6)
  doc.line(W / 2 - tW / 2, Y + 1.5, W / 2 + tW / 2, Y + 1.5)
  doc.setTextColor(...DARK)

  Y += 10

  /* ══════════════════════════════════════════════════════════════════
     VENDEUR | ACHETEUR
  ══════════════════════════════════════════════════════════════════ */
  const colW = (TW - 6) / 2

  // Vendeur
  doc.setFillColor(...BG_GRN)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.4)
  doc.roundedRect(ML, Y, colW, 36, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text('VENDEUR', ML + 3, Y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  doc.text(`Structure : ${data.vendeurNom || data.vendeurUsername}`, ML + 3, Y + 14)
  doc.text(`Rôle : ${data.vendeurRole}`, ML + 3, Y + 20)
  doc.text(`Username : ${data.vendeurUsername}`, ML + 3, Y + 26)
  if (data.vendeurAdresse) {
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(data.vendeurAdresse, ML + 3, Y + 32)
    doc.setTextColor(...DARK)
  }

  // Acheteur
  const dX = ML + colW + 6
  doc.setFillColor(...BG_BLU)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.4)
  doc.roundedRect(dX, Y, colW, 36, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BLUE)
  doc.text('ACHETEUR', dX + 3, Y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  doc.text(`Structure : ${data.acheteurNom || data.acheteurUsername}`, dX + 3, Y + 14)
  doc.text(`Rôle : ${data.acheteurRole}`, dX + 3, Y + 20)
  doc.text(`Username : ${data.acheteurUsername}`, dX + 3, Y + 26)
  if (data.acheteurAdresse) {
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(data.acheteurAdresse, dX + 3, Y + 32)
    doc.setTextColor(...DARK)
  }

  Y += 42

  /* ══════════════════════════════════════════════════════════════════
     OBJET
  ══════════════════════════════════════════════════════════════════ */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Objet : ', ML, Y)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Cession de semences certifiées ${data.generationCode} — ${data.nomEspece} var. ${data.nomVariete}` +
    (data.campagne ? ` — Campagne ${data.campagne}` : ''),
    ML + 18, Y
  )
  Y += 10

  /* ══════════════════════════════════════════════════════════════════
     TABLEAU LIGNES
  ══════════════════════════════════════════════════════════════════ */
  autoTable(doc, {
    startY: Y,
    head: [['Désignation', 'Variété', 'Génération', 'Quantité', 'Prix unit. (FCFA/kg)', 'Montant HT (FCFA)']],
    body: [
      [
        `Semence de ${data.nomEspece}`,
        data.nomVariete,
        data.generationCode,
        `${data.quantiteKg.toLocaleString('fr-FR')} ${data.unite}`,
        data.prixUnitaireKg.toLocaleString('fr-FR'),
        montantHT.toLocaleString('fr-FR'),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: RED,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    bodyStyles: { fontSize: 8.5, cellPadding: 4 },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: ML, right: MR },
  })

  Y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  /* ══════════════════════════════════════════════════════════════════
     RÉCAPITULATIF FINANCIER (droite)
  ══════════════════════════════════════════════════════════════════ */
  const recapW = 80
  const recapX = ML + TW - recapW

  const rows: [string, string, boolean][] = [
    ['Total HT',                      fmtFcfa(montantHT),  false],
    [`TVA (${data.tvaPercent} %)`,    fmtFcfa(montantTVA), false],
    ['TOTAL TTC',                     fmtFcfa(montantTTC), true],
  ]

  let ry = Y
  rows.forEach(([label, value, bold]) => {
    if (bold) {
      doc.setFillColor(...RED)
      doc.rect(recapX, ry, recapW, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setFillColor(250, 248, 248)
      doc.rect(recapX, ry, recapW, 8, 'F')
      doc.setDrawColor(...GRAY)
      doc.setLineWidth(0.2)
      doc.rect(recapX, ry, recapW, 8, 'S')
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'normal')
    }
    doc.setFontSize(8)
    doc.text(label, recapX + 4, ry + 5.5)
    doc.text(value, recapX + recapW - 4, ry + 5.5, { align: 'right' })
    doc.setTextColor(...DARK)
    ry += 8
  })

  // Mention en lettres
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...RED)
  doc.text(`Arrêtée à la somme de : ${montantTTC.toLocaleString('fr-FR')} FCFA TTC`, ML, ry + 2)
  doc.setTextColor(...DARK)

  Y = ry + 12

  /* ══════════════════════════════════════════════════════════════════
     TRAÇABILITÉ LOT
  ══════════════════════════════════════════════════════════════════ */
  doc.setFillColor(...BG_GRN)
  doc.setDrawColor(187, 247, 208)
  doc.setLineWidth(0.3)
  doc.roundedRect(ML, Y, TW, 18, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREEN)
  doc.text('TRAÇABILITÉ', ML + 3, Y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...DARK)
  const c1 = ML + 35
  const c2 = ML + TW / 2 + 10
  doc.text(`Code lot : ${data.codeLot}`, c1, Y + 6)
  doc.text(`Réf. transfert : ${data.codeTransfert}`, c2, Y + 6)
  doc.text(`Génération : ${data.generationCode}`, c1, Y + 13)
  if (data.campagne) doc.text(`Campagne : ${data.campagne}`, c2, Y + 13)

  Y += 24

  /* ══════════════════════════════════════════════════════════════════
     CONDITIONS & OBSERVATIONS
  ══════════════════════════════════════════════════════════════════ */
  const conditions = data.conditions || 'Paiement à 30 jours — Chèque ou virement bancaire à l\'ordre de ISRA/CNRA'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Conditions de paiement : ', ML, Y)
  doc.setFont('helvetica', 'normal')
  doc.text(conditions, ML + 46, Y)
  Y += 6

  if (data.observations) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(`Observations : ${data.observations}`, ML, Y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    Y += 6
  }

  Y += 4

  /* ══════════════════════════════════════════════════════════════════
     SIGNATURES
  ══════════════════════════════════════════════════════════════════ */
  const sigW = (TW - 8) / 2
  const sigH = 40

  // Établi par (vendeur)
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.4)
  doc.roundedRect(ML, Y, sigW, sigH, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREEN)
  doc.text('LE VENDEUR', ML + sigW / 2, Y + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text(`Nom : ${data.vendeurNom || data.vendeurUsername}`, ML + 3, Y + 13)
  doc.text(`Rôle : ${data.vendeurRole}`, ML + 3, Y + 18)
  doc.text('Signature & Cachet :', ML + 3, Y + 28)
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.25)
  doc.circle(ML + sigW - 12, Y + 33, 5, 'S')
  doc.setFontSize(5)
  doc.setTextColor(190, 190, 190)
  doc.text('CACHET', ML + sigW - 12, Y + 33.7, { align: 'center' })

  // Bon pour accord (acheteur)
  const s2X = ML + sigW + 8
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.4)
  doc.roundedRect(s2X, Y, sigW, sigH, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BLUE)
  doc.text("BON POUR ACCORD — L'ACHETEUR", s2X + sigW / 2, Y + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...DARK)
  doc.text(`Nom : ${data.acheteurNom || data.acheteurUsername}`, s2X + 3, Y + 13)
  doc.text(`Rôle : ${data.acheteurRole}`, s2X + 3, Y + 18)
  doc.text('Signature & Cachet :', s2X + 3, Y + 28)
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.25)
  doc.circle(s2X + sigW - 12, Y + 33, 5, 'S')
  doc.setFontSize(5)
  doc.setTextColor(190, 190, 190)
  doc.text('CACHET', s2X + sigW - 12, Y + 33.7, { align: 'center' })

  Y += sigH + 10

  /* ══════════════════════════════════════════════════════════════════
     PIED DE PAGE
  ══════════════════════════════════════════════════════════════════ */
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.3)
  doc.line(ML, Y - 4, ML + TW, Y - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...MUTED)
  doc.text('ISRA/CNRA Bambey — TEL: 33 973 60 50 — cnrabambey@isra.sn', W / 2, Y, { align: 'center' })
  const genStr = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  doc.text(
    `Document généré par la Plateforme Semencière ISRA/CNRA — ${genStr}`,
    W / 2, Y + 4.5, { align: 'center' }
  )

  /* ── Sauvegarde ── */
  doc.save(`FACT-${data.codeTransfert}.pdf`)

  return { numeroFacture, montantHT, montantTVA, montantTTC }
}
