const BOM = '﻿'

function escapeCsv(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r'))
    return `"${str.replace(/"/g, '""')}"`
  return str
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(',')),
  ]
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename.endsWith('.csv') ? filename : filename + '.csv')
}

// ── XLSX minimal sans dépendance externe ──────────────────────────────────────
// Format: XML SpreadsheetML (Office 2003) — ouvert par Excel, LibreOffice, Google Sheets

export interface XlsxSheet {
  name: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
}

export function downloadXlsx(filename: string, sheets: XlsxSheet[]): void {
  const workbook = buildSpreadsheetML(sheets)
  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  triggerDownload(blob, filename.endsWith('.xls') || filename.endsWith('.xlsx') ? filename : filename + '.xls')
}

function escapeXml(val: unknown): string {
  if (val == null) return ''
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildSpreadsheetML(sheets: XlsxSheet[]): string {
  const sheetsXml = sheets.map(sheet => {
    const headerRow = sheet.headers
      .map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
      .join('')

    const dataRows = sheet.rows.map(row => {
      const cells = row.map(val => {
        if (val == null || val === '') {
          return `<Cell><Data ss:Type="String"></Data></Cell>`
        }
        const isNum = typeof val === 'number' || (!isNaN(Number(val)) && String(val).trim() !== '')
        if (isNum) {
          return `<Cell><Data ss:Type="Number">${val}</Data></Cell>`
        }
        return `<Cell><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`
      }).join('')
      return `<Row>${cells}</Row>`
    }).join('')

    return `<Worksheet ss:Name="${escapeXml(sheet.name.slice(0, 31))}">
  <Table>
    <Row>${headerRow}</Row>
    ${dataRows}
  </Table>
</Worksheet>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${sheetsXml}
</Workbook>`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function formatDateForExport(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('fr-FR')
  } catch { return iso }
}
