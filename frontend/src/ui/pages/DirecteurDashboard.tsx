import { useState } from 'react'
import { Printer } from 'lucide-react'
import { GlobalAnalytics }    from './GlobalAnalytics'
import { CampagneComparison } from './CampagneComparison'

interface Props { roleKey?: string }

const LABELS = {
  fr: {
    badge:      'Directeur CNRA',
    title:      'Vue d\'ensemble nationale',
    sub:        'Tableau de bord décisionnel — chaîne semencière ISRA/CNRA G0→R2',
    toggleEN:   'Switch to English',
    exportPdf:  'Exporter PDF',
    printTitle: 'Vue d\'ensemble nationale — Chaîne semencière ISRA/CNRA',
    printSub:   'Tableau de bord décisionnel · Toutes générations G0 → R2',
    printDate:  'Exporté le',
    printBy:    'Institut Sénégalais de Recherches Agricoles — CNRA Bambey',
  },
  en: {
    badge:      'CNRA Director',
    title:      'National Overview',
    sub:        'Decision Dashboard — ISRA/CNRA Seed Chain G0→R2',
    toggleFR:   'Passer en français',
    exportPdf:  'Export PDF',
    printTitle: 'National Overview — ISRA/CNRA Seed Chain',
    printSub:   'Decision Dashboard · All generations G0 → R2',
    printDate:  'Exported on',
    printBy:    'Senegalese Institute of Agricultural Research — CNRA Bambey',
  },
}

function fmtDate(lang: 'fr' | 'en') {
  return new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function DirecteurDashboard({ roleKey = 'seed-directeur' }: Props) {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const L = LABELS[lang]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── CSS impression ── */}
      <style>{`
        @media print {
          .sidebar,
          .topbar,
          footer,
          .session-warning-banner,
          .no-print { display: none !important; }

          .main { padding: 0 !important; }
          .page-content { padding: 0 !important; overflow: visible !important; }

          .print-header-directeur { display: block !important; }

          @page {
            margin: 15mm 18mm;
            size: A4 portrait;
          }

          body { font-size: 11pt; color: #111; }

          h2 { font-size: 16pt !important; }
        }
      `}</style>

      {/* ── En-tête uniquement visible à l'impression ── */}
      <div className="print-header-directeur" style={{ display: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#555', marginBottom: 3 }}>
              {L.printBy}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{L.printTitle}</div>
            <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{L.printSub}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9, color: '#888' }}>
            <div style={{ fontWeight: 600 }}>Sen Jiwu v0.1</div>
            <div>{L.printDate} {fmtDate(lang)}</div>
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: '2px solid #1d4ed8', marginBottom: 16 }} />
      </div>

      {/* ── En-tête décisionnel (écran) ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '0 0 18px', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: '#1d4ed8',
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 99, padding: '2px 10px',
            display: 'inline-block', marginBottom: 10,
          }}>
            {L.badge}
          </span>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
            letterSpacing: '-0.02em', color: 'var(--text-primary)',
            lineHeight: 1.2, marginBottom: 5,
          }}>
            {L.title}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {lang === 'fr' ? (L as typeof LABELS.fr).sub : (L as typeof LABELS.en).sub}
          </p>
        </div>

        {/* Boutons d'action */}
        <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* Export PDF */}
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #d1d5db', background: '#f9fafb',
              fontSize: 11.5, fontWeight: 600, color: '#374151',
            }}
            title={L.exportPdf}
          >
            <Printer size={13} />
            {L.exportPdf}
          </button>

          {/* Toggle FR/EN */}
          <button
            onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #bfdbfe', background: '#eff6ff',
              fontSize: 11.5, fontWeight: 700, color: '#1d4ed8',
            }}
            title={lang === 'fr' ? 'Switch to English for international presentations' : 'Passer en français'}
          >
            <span style={{ fontSize: 14 }}>{lang === 'fr' ? '🇬🇧' : '🇫🇷'}</span>
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>
      </div>

      {/* Analytics opérationnel */}
      <GlobalAnalytics roleKey={roleKey} />

      {/* Comparaison inter-campagnes */}
      <CampagneComparison lang={lang} />
    </div>
  )
}
