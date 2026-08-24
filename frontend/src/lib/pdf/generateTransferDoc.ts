import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const ISRA_LOGO_B64 =
  'data:image/png;base64,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'

export type DocType = 'BORDEREAU' | 'ACCUSE_RECEPTION'

export interface LotPdfData {
  codeLot:          string
  nomVariete:       string
  nomEspece:        string
  generationCode:   string
  quantiteNette:    number
  unite:            string
  tauxGermination?: number
  puretePhysique?:  number
  statutLot:        string
  dateProduction?:  string
  campagne?:        string
  lotParentCode?:   string
}

export interface PartiePdf {
  username:  string
  nom:       string
  roleKey:   string
  roleLabel: string
}

export interface TransferDocData {
  type:               DocType
  codeTransfert:      string
  numero:             string
  lot:                LotPdfData
  expediteur:         PartiePdf
  destinataire:       PartiePdf
  quantiteTransferee: number
  dateDemande:        string
  observations?:      string
  dateAcceptation?:       string
  nomReceptionnaire?:     string
  quantiteRecue?:         number
  observationsReception?: string
}

const GREEN: [number, number, number] = [27,  94,  32]
const DARK:  [number, number, number] = [33,  33,  33]
const MUTED: [number, number, number] = [100, 100, 100]
const GRAY:  [number, number, number] = [180, 180, 180]

export function generateNumero(transfertId: number): string {
  const year = new Date().getFullYear()
  const seq  = String(transfertId).padStart(3, '0')
  return `N° 00${seq}/ISRA/CNRA/${year}`
}

function fmtDate(d?: string): string {
  try {
    const date = d ? new Date(d) : new Date()
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return d ?? new Date().toLocaleDateString('fr-FR')
  }
}

export function generateTransferDoc(data: TransferDocData): { blobUrl: string; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, ML = 18, MR = 18, TW = W - ML - MR
  let Y = 14

  /* ═══ EN-TÊTE OFFICIEL ISRA/CNRA ═══ */
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

  doc.addImage(ISRA_LOGO_B64, 'PNG', ML + 10, Y + 27, 26, 22)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...DARK)
  doc.text('CENTRE NATIONAL DE RECHERCHES AGRONOMIQUES', ML, Y + 52)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.setTextColor(...MUTED)
  doc.text('B.P. 53 – Bambey  ·  Tél. : (221) 33 973 60 50  ·  cnrabambey@isra.sn', ML, Y + 56)
  doc.setTextColor(...DARK)

  /* numéro + date — bloc droit */
  const RX = ML + TW
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...DARK)
  doc.text(data.numero, RX, Y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Bambey, le ${fmtDate(data.dateDemande)}`, RX, Y + 12, { align: 'right' })

  Y += 66

  /* ═══ TITRE ═══ */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...DARK)
  const titre = 'BORDEREAU DE LIVRAISON'
  doc.text(titre, W / 2, Y, { align: 'center' })
  const tW = doc.getTextWidth(titre)
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.5)
  doc.line(W / 2 - tW / 2, Y + 1.8, W / 2 + tW / 2, Y + 1.8)
  doc.setTextColor(...DARK)

  Y += 12

  /* ═══ DESTINATAIRE ═══ */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Destinataire : ', ML, Y)
  doc.setFont('helvetica', 'bold')
  doc.text(data.destinataire.nom || data.destinataire.roleLabel, ML + 32, Y)
  doc.setFont('helvetica', 'normal')

  Y += 12

  /* ═══ TABLEAU DES SEMENCES ═══ */
  autoTable(doc, {
    startY: Y,
    head: [['Désignation', 'Variété', 'Quantité (kg)', 'Observations']],
    body: [[
      data.lot.nomEspece || '—',
      data.lot.nomVariete || '—',
      `${data.quantiteTransferee.toLocaleString('fr-FR')} kg`,
      `Niveau ${data.lot.generationCode}`,
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: GREEN,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    bodyStyles: { fontSize: 9.5, cellPadding: 6 },
    columnStyles: {
      2: { halign: 'center' },
      3: { halign: 'center' },
    },
    margin: { left: ML, right: MR },
  })

  Y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  /* ═══ RÉFÉRENCE LOT ═══ */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  const refParts = [`Code lot : ${data.lot.codeLot}`]
  if (data.lot.campagne) refParts.push(`Campagne : ${data.lot.campagne}`)
  doc.text(refParts.join('   —   '), ML, Y)
  doc.setTextColor(...DARK)

  Y += 18

  /* ═══ SIGNATURES ═══ */
  const sigRightX = ML + TW - 72

  /* bloc gauche — Reçu conforme */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.text('Reçu conforme', ML, Y)
  Y += 7
  doc.text('Par :   ___________________________________________', ML, Y)
  Y += 7
  doc.text('Le :    ___________________________________________', ML, Y)
  Y += 9
  doc.text('Signature :', ML, Y)
  doc.setDrawColor(...DARK)
  doc.setLineWidth(0.3)
  doc.line(ML + 26, Y, ML + 82, Y)

  /* bloc droit — Directeur CNRA */
  const sigTopY = Y - 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Le Directeur du CNRA', sigRightX, sigTopY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Signature & Cachet :', sigRightX, sigTopY + 8)
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.2)
  doc.circle(sigRightX + 42, sigTopY + 18, 12, 'S')

  Y += 18

  /* ═══ PIED DE PAGE ═══ */
  doc.setDrawColor(...GRAY)
  doc.setLineWidth(0.5)
  doc.line(ML, Y + 4, ML + TW, Y + 4)
  Y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(
    'Bambey – TEL: 33 973 60 50 – E-mail : cnrabambey@isra.sn',
    W / 2, Y, { align: 'center' },
  )

  const filename = `BL-${data.codeTransfert}.pdf`
  const blob     = doc.output('blob')
  return { blobUrl: URL.createObjectURL(blob), filename }
}
