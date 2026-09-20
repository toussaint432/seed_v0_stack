import { useState } from 'react'
import { GlobalAnalytics }       from './GlobalAnalytics'
import { CampagneComparison }    from './CampagneComparison'

interface Props { roleKey?: string }

const LABELS = {
  fr: {
    badge:    'Directeur CNRA',
    title:    'Vue d\'ensemble nationale',
    sub:      'Tableau de bord décisionnel — chaîne semencière ISRA/CNRA G0→R2',
    toggleEN: 'Switch to English',
  },
  en: {
    badge:    'CNRA Director',
    title:    'National Overview',
    sub:      'Decision Dashboard — ISRA/CNRA Seed Chain G0→R2',
    toggleFR: 'Passer en français',
  },
}

export function DirecteurDashboard({ roleKey = 'seed-directeur' }: Props) {
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const L = LABELS[lang]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* En-tête décisionnel */}
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

        {/* Toggle FR/EN */}
        <button
          onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid #bfdbfe', background: '#eff6ff',
            fontSize: 11.5, fontWeight: 700, color: '#1d4ed8',
            flexShrink: 0,
          }}
          title={lang === 'fr' ? 'Switch to English for international presentations' : 'Passer en français'}
        >
          <span style={{ fontSize: 14 }}>{lang === 'fr' ? '🇬🇧' : '🇫🇷'}</span>
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>
      </div>

      {/* Analytics opérationnel */}
      <GlobalAnalytics roleKey={roleKey} />

      {/* Comparaison inter-campagnes */}
      <CampagneComparison lang={lang} />
    </div>
  )
}
