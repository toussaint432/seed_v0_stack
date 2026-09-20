import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { keycloak } from '../../lib/keycloak'
import { TL as T } from '../../lib/tokens'

/* ── Palette ISRA (identique LandingPage) ───────────────────────────────── */
const C = {
  vert:      '#2d6a27',
  vertFonce: '#1e5220',
  vertBande: '#1a5e1f',
  gris:      '#f5f6f4',
  grisBord:  '#e4e4e0',
} as const

type Lang = 'fr' | 'en'

/* ── Sections de navigation ─────────────────────────────────────────────── */
const NAV = [
  { id: 'intro',        fr: 'Introduction',        en: 'Overview'         },
  { id: 'demarrage',    fr: 'Démarrage rapide',    en: 'Quick start'      },
  { id: 'pipeline',     fr: 'Pipeline G0 → R2',    en: 'Pipeline G0 → R2' },
  { id: 'roles',        fr: 'Guides par rôle',     en: 'Role guides'      },
  { id: 'modules',      fr: 'Modules',             en: 'Modules'          },
  { id: 'architecture', fr: 'Architecture',        en: 'Architecture'     },
  { id: 'glossaire',    fr: 'Glossaire',           en: 'Glossary'         },
  { id: 'academique',   fr: 'Contexte académique', en: 'Academic context' },
  { id: 'contact',      fr: 'Contact & Accès',     en: 'Contact & Access' },
] as const

type SectionId = typeof NAV[number]['id']

/* ── i18n interface ─────────────────────────────────────────────────────── */
const UI: Record<Lang, Record<string, string>> = {
  fr: {
    topPhone: '+221 77 758 28 71', topEmail: 'senjiwu1@gmail.com', topDoc: 'Documentation',
    login: 'Se connecter', backHome: '← Accueil', version: 'v1.0 — 2025-2026',
    badge: 'Documentation officielle',
    heroTitle: 'Documentation Sen Jiwu',
    heroSub: "Guide complet de la plateforme nationale de gestion de la chaîne semencière — CNRA / UPSemCL Bambey",
    searchPlaceholder: 'Rechercher dans la documentation…',
    onThisPage: 'Sur cette page',
    footerTagline: "Système d'information national de la filière semencière du Sénégal.",
    copyright: '© 2026 Sen Jiwu — République du Sénégal. Tous droits réservés.',
  },
  en: {
    topPhone: '+221 77 758 28 71', topEmail: 'senjiwu1@gmail.com', topDoc: 'Documentation',
    login: 'Sign in', backHome: '← Home', version: 'v1.0 — 2025-2026',
    badge: 'Official documentation',
    heroTitle: 'Sen Jiwu Documentation',
    heroSub: 'Complete guide to the national seed chain management platform — CNRA / UPSemCL Bambey',
    searchPlaceholder: 'Search in documentation…',
    onThisPage: 'On this page',
    footerTagline: 'National information system for the Senegalese seed industry.',
    copyright: '© 2026 Sen Jiwu — Republic of Senegal. All rights reserved.',
  },
}

/* ── Pipeline générations ────────────────────────────────────────────────── */
const GENS = [
  { code: 'G0', label: 'Génétique',   color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', actor: 'Sélectionneur' },
  { code: 'G1', label: 'Pré-base',    color: '#0369a1', bg: 'rgba(3,105,161,0.12)',  actor: 'Sélectionneur' },
  { code: 'G2', label: 'Base',        color: '#0f766e', bg: 'rgba(15,118,110,0.12)', actor: 'UPSemCL' },
  { code: 'G3', label: 'Certif. C1',  color: '#15803d', bg: 'rgba(21,128,61,0.12)',  actor: 'UPSemCL' },
  { code: 'G4', label: 'Certif. C2',  color: '#b45309', bg: 'rgba(180,83,9,0.12)',   actor: 'Multiplicateur' },
  { code: 'R1', label: 'Reproductrice', color: '#c2410c', bg: 'rgba(194,65,12,0.12)', actor: 'Multiplicateur' },
  { code: 'R2', label: 'Commerciale', color: '#c44536', bg: 'rgba(196,69,54,0.12)',  actor: 'Quotataire / OP' },
]

/* ══════════════════════════════════════════════════════════════════════════
   Composant principal
   ══════════════════════════════════════════════════════════════════════════ */
export function Documentation() {
  const [lang, setLang]             = useState<Lang>('fr')
  const [activeSection, setActive]  = useState<SectionId>('intro')
  const [loggingIn, setLoggingIn]   = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const u = UI[lang]

  /* IntersectionObserver — suivi section active */
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          )
          setActive(topmost.target.id as SectionId)
        }
      },
      { threshold: 0.25, rootMargin: '-60px 0px -60% 0px' }
    )
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) { sectionRefs.current[id] = el; obs.observe(el) }
    })
    return () => obs.disconnect()
  }, [])

  const handleLogin = () => {
    setLoggingIn(true)
    setTimeout(() => keycloak.login(), 650)
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setMobileNavOpen(false) }
  }

  return (
    <div style={{ fontFamily: T.body, background: '#fff', color: T.ink, overflowX: 'hidden' }}>
      <style>{`
        @keyframes doc-spin { to { transform: rotate(360deg) } }
        .doc-nav-link:hover { color: ${C.vert} !important; }
        .doc-side-link:hover { color: ${C.vert} !important; background: ${C.vert}0c !important; }
        .doc-side-link.active { color: ${C.vert} !important; background: ${C.vert}12 !important; border-left-color: ${C.vert} !important; font-weight: 600 !important; }
        .doc-mod-row:hover { background: ${C.gris} !important; }
        .doc-gloss-item:hover { border-color: ${C.vert}44 !important; }
        .doc-role-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.08) !important; transform: translateY(-2px); }
        @media (max-width: 900px) {
          .doc-layout { flex-direction: column !important; }
          .doc-sidebar { width: 100% !important; position: static !important; border-right: none !important; border-bottom: 1px solid ${C.grisBord} !important; padding: 12px 16px !important; }
          .doc-sidebar-nav { display: ${mobileNavOpen ? 'flex' : 'none'} !important; flex-direction: column !important; }
          .doc-mobile-toggle { display: flex !important; }
          .doc-content { padding: 40px 20px !important; }
          .doc-pipeline-scroll { overflow-x: auto !important; }
          .doc-roles-grid { grid-template-columns: 1fr 1fr !important; }
          .doc-footer-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 580px) {
          .doc-roles-grid { grid-template-columns: 1fr !important; }
        }
        .doc-mobile-toggle { display: none; }
      `}</style>

      {/* ── LOGIN OVERLAY ─────────────────────────────────────────────── */}
      {loggingIn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: `linear-gradient(135deg, ${C.vertFonce}, #004d20)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.95)', display: 'grid', placeItems: 'center' }}>
            <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
          </div>
          <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 22, color: '#fff' }}>Sen Jiwu</div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'doc-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* ── TOPBAR ────────────────────────────────────────────────────── */}
      <div style={{ background: C.vertBande, color: 'rgba(255,255,255,0.85)', fontSize: 12.5, padding: '8px 28px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2h7v8H2z" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinejoin="round"/><path d="M4 6a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0" fill="rgba(255,255,255,0.5)"/></svg>
              {u.topPhone}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1" y="2" width="9" height="7" rx="1" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/><path d="M1 3.5l4.5 3L10 3.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/></svg>
              {u.topEmail}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['fr', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  background: lang === l ? 'rgba(255,255,255,0.18)' : 'transparent',
                  border: 'none', padding: '2px 8px', cursor: 'pointer',
                  color: lang === l ? '#fff' : 'rgba(255,255,255,0.6)',
                  borderRadius: 4, fontFamily: T.mono, fontSize: 10.5, fontWeight: 500,
                }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── NAVBAR ────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: `1px solid ${C.grisBord}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 20, height: 60 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 7, background: C.gris, border: `1px solid ${C.grisBord}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 24, width: 'auto', objectFit: 'contain' }} />
            </div>
            <strong style={{ fontFamily: T.display, fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', color: C.vertFonce }}>Sen Jiwu</strong>
          </a>
          <div style={{ width: 1, height: 20, background: C.grisBord, margin: '0 4px' }} />
          <span style={{ fontFamily: T.mono, fontSize: 11, color: C.vert, background: `${C.vert}10`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${C.vert}25`, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
            {u.badge}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" className="doc-nav-link" style={{ textDecoration: 'none', color: T.muted, fontSize: 13.5, fontWeight: 500, transition: 'color 0.2s' }}>
              {u.backHome}
            </a>
            <button onClick={handleLogin} disabled={loggingIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 5, background: C.vert, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: loggingIn ? 'default' : 'pointer', fontFamily: T.body, opacity: loggingIn ? 0.7 : 1, flexShrink: 0 }}>
              {loggingIn
                ? <div style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'doc-spin 0.7s linear infinite' }} />
                : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 2H3a1 1 0 00-1 1v7a1 1 0 001 1h2M8 9l3-2.5L8 4M11 6.5H5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
              {u.login}
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, ${C.vertFonce} 0%, ${C.vert} 60%, #3a8c33 100%)`, padding: '52px 28px 48px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 840, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase' as const, letterSpacing: '0.15em' }}>CNRA / UPSemCL Bambey</span>
            <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.25)' }} />
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.1em' }}>{u.version}</span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(28px, 4vw, 44px)', color: '#fff', marginBottom: 16, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            {u.heroTitle}
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.80)', lineHeight: 1.65, maxWidth: 660 }}>{u.heroSub}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' as const }}>
            {NAV.slice(0, 4).map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)} style={{ padding: '6px 14px', borderRadius: 5, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', fontSize: 12.5, fontFamily: T.body, cursor: 'pointer', transition: 'background 0.2s', letterSpacing: '0.01em' }}>
                {lang === 'fr' ? s.fr : s.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── LAYOUT PRINCIPAL ──────────────────────────────────────────── */}
      <div className="doc-layout" style={{ display: 'flex', maxWidth: 1400, margin: '0 auto', minHeight: '70vh' }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <aside className="doc-sidebar" style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${C.grisBord}`, padding: '32px 0', position: 'sticky', top: 60, height: 'fit-content', maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
          <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#999' }}>{u.onThisPage}</span>
            <button className="doc-mobile-toggle" onClick={() => setMobileNavOpen(p => !p)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.muted, padding: '2px 6px' }}>
              {mobileNavOpen ? '✕' : '☰'}
            </button>
          </div>
          <nav className="doc-sidebar-nav" style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, padding: '0 12px' }}>
            {NAV.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)} className={`doc-side-link${activeSection === s.id ? ' active' : ''}`} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 6, border: 'none',
                borderLeft: '3px solid transparent',
                background: 'transparent', cursor: 'pointer',
                fontFamily: T.body, fontSize: 13.5, color: activeSection === s.id ? C.vert : T.muted,
                textAlign: 'left' as const, fontWeight: activeSection === s.id ? 600 : 400,
                transition: 'all 0.15s',
              }}>
                <span style={{ fontFamily: T.mono, fontSize: 9, color: activeSection === s.id ? C.vert : '#ccc', minWidth: 16 }}>
                  {String(NAV.findIndex(n => n.id === s.id) + 1).padStart(2, '0')}
                </span>
                {lang === 'fr' ? s.fr : s.en}
              </button>
            ))}
          </nav>
          <div style={{ margin: '24px 20px 0', padding: '16px', borderRadius: 8, background: `${C.vert}0c`, border: `1px solid ${C.vert}20` }}>
            <p style={{ fontFamily: T.mono, fontSize: 10.5, color: C.vert, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Accès rapide</p>
            <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 10 }}>Pour demander un compte ou signaler un problème :</p>
            <a href="mailto:senjiwu1@gmail.com" style={{ fontSize: 12, color: C.vert, textDecoration: 'none', fontWeight: 500 }}>senjiwu1@gmail.com</a>
          </div>
        </aside>

        {/* ── CONTENU ─────────────────────────────────────────────────── */}
        <main className="doc-content" style={{ flex: 1, padding: '56px 64px', minWidth: 0 }}>

          {/* ═══ 01 — INTRODUCTION ══════════════════════════════════════ */}
          <section id="intro" style={{ marginBottom: 80 }}>
            <DocLabel text="01 — Introduction" />
            <h2 style={H2}>À propos de Sen Jiwu</h2>
            <p style={P}>
              <strong style={{ color: T.ink }}>Sen Jiwu</strong> signifie <em>« Votre semence »</em> en wolof. C'est la plateforme nationale de gestion et de traçabilité de la chaîne semencière agricole, développée pour le <strong>Centre National de Recherches Agronomiques (CNRA) de Bambey</strong> et l'<strong>Unité de Production de Semences de Céréales et Légumineuses (UPSemCL)</strong>, sous l'égide de l'<strong>Institut Sénégalais de Recherches Agricoles (ISRA)</strong>.
            </p>
            <p style={P}>
              Avant Sen Jiwu, la gestion des semences reposait sur des registres papier et des fichiers Excel déconnectés — rendant impossible la traçabilité générationnelle des lots de G0 à R2, la coordination entre acteurs de la filière et la production de statistiques fiables. Sen Jiwu digitalise, centralise et sécurise l'intégralité de ce cycle.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 32 }}>
              {[
                { n: '7', label: 'Générations tracées', sub: 'G0 → G1 → G2 → G3 → G4 → R1 → R2' },
                { n: '6', label: 'Rôles acteurs', sub: 'Sélectionneur, UPSemCL, Multiplicateur, Quotataire, Directeur, Admin' },
                { n: '17', label: 'Modules fonctionnels', sub: 'De la variété à la livraison' },
              ].map(s => (
                <div key={s.label} style={{ padding: '20px 18px', borderRadius: 8, background: C.gris, border: `1px solid ${C.grisBord}` }}>
                  <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 32, color: C.vert, lineHeight: 1, marginBottom: 6 }}>{s.n}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.5 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ 02 — DÉMARRAGE RAPIDE ══════════════════════════════════ */}
          <section id="demarrage" style={{ marginBottom: 80 }}>
            <DocLabel text="02 — Démarrage rapide" />
            <h2 style={H2}>Comment accéder à la plateforme</h2>
            <p style={P}>L'accès à Sen Jiwu est réservé aux acteurs accrédités de la filière semencière. Les comptes sont créés par l'équipe de gestion, en lien avec la Direction Technique ISRA.</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16, marginTop: 28 }}>
              {[
                {
                  n: '1', title: 'Formuler une demande d\'accès',
                  desc: 'Contactez l\'équipe Sen Jiwu par email (senjiwu1@gmail.com) ou téléphone (+221 77 758 28 71) en précisant votre rôle dans la filière : sélectionneur, multiplicateur, quotataire, etc.',
                  color: '#0369a1',
                },
                {
                  n: '2', title: 'Réception de vos identifiants',
                  desc: 'L\'administrateur crée votre compte avec un rôle précis et un mot de passe temporaire. Vous recevrez vos identifiants par voie sécurisée. À la première connexion, le système vous demandera de définir un mot de passe personnel.',
                  color: C.vert,
                },
                {
                  n: '3', title: 'Connexion sécurisée',
                  desc: 'Depuis la page d\'accueil, cliquez sur « Se connecter ». L\'authentification est gérée par un protocole OAuth2/OIDC centralisé. Votre session est sécurisée et renouvelée automatiquement tant que vous êtes actif.',
                  color: C.vertFonce,
                },
                {
                  n: '4', title: 'Votre espace personnalisé',
                  desc: 'Une fois connecté, vous accédez uniquement aux modules correspondant à votre rôle. Chaque acteur voit exclusivement ses propres données — lots, stocks, commandes. L\'isolation est stricte et appliquée côté serveur.',
                  color: '#b45309',
                },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: 20, padding: '22px 24px', borderRadius: 8, background: '#fff', border: `1px solid ${C.grisBord}`, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: step.color, color: '#fff', fontFamily: T.display, fontWeight: 700, fontSize: 15, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{step.n}</div>
                  <div>
                    <h4 style={{ fontFamily: T.display, fontWeight: 600, fontSize: 15, color: T.ink, marginBottom: 6 }}>{step.title}</h4>
                    <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ 03 — PIPELINE G0→R2 ════════════════════════════════════ */}
          <section id="pipeline" style={{ marginBottom: 80 }}>
            <DocLabel text="03 — Pipeline semencier" />
            <h2 style={H2}>Pipeline générationnel G0 → R2</h2>
            <p style={P}>Chaque semence certifiée suit un parcours rigoureux de 7 générations. Chaque lot est unique, horodaté et lié à son lot parent — garantissant une traçabilité complète de l'origine génétique jusqu'au champ de production.</p>

            {/* Diagramme pipeline */}
            <div className="doc-pipeline-scroll" style={{ marginTop: 32, marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, minWidth: 720 }}>
                {GENS.map((g, i) => (
                  <div key={g.code} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 0 }}>
                      <div style={{ padding: '16px 12px', borderRadius: 8, background: g.bg, border: `2px solid ${g.color}30`, width: '100%', textAlign: 'center' as const }}>
                        <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 15, color: g.color, marginBottom: 4 }}>{g.code}</div>
                        <div style={{ fontSize: 11, color: T.ink, fontWeight: 500, lineHeight: 1.3 }}>{g.label}</div>
                      </div>
                      <div style={{ marginTop: 10, fontFamily: T.mono, fontSize: 9, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'center' as const, lineHeight: 1.4, maxWidth: 80 }}>{g.actor}</div>
                    </div>
                    {i < GENS.length - 1 && (
                      <div style={{ color: '#ccc', margin: '0 2px', marginBottom: 28, flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Classification officielle CEDEAO / CILSS */}
            <div style={{ marginTop: 32, marginBottom: 32, padding: '22px 24px 20px', borderRadius: 8, background: C.gris, border: `1px solid ${C.grisBord}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.vert, flexShrink: 0 }} />
                <span style={{ fontFamily: T.mono, fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.vert }}>
                  Classification officielle — Normes harmonisées CEDEAO / CILSS
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  {
                    level: 'Niveau 1', name: 'Matériel Parental', cat: 'Sélection',
                    color: '#7c3aed', gens: ['G0', 'G1'],
                    desc: "Noyau génétique de pureté absolue produit sous contrôle direct du sélectionneur ISRA/CNRA. G0 constitue le matériel de référence ; G1 est sa première multiplication, transférée à l'UPSemCL.",
                  },
                  {
                    level: 'Niveau 2', name: 'Semences de Fondation', cat: 'UPSemCL',
                    color: '#0f766e', gens: ['G2', 'G3'],
                    desc: "G2 (Base) est produite par l'UPSemCL à partir du G1 reçu. G3 (C1) est la catégorie pivot vendue aux multiplicateurs agréés pour démarrer la production à grande échelle.",
                  },
                  {
                    level: 'Niveau 3', name: 'Semences Certifiées', cat: 'Vulgarisation',
                    color: '#b45309', gens: ['G4', 'R1'],
                    desc: "G4 (C2) est produite par le multiplicateur à partir du G3 — elle augmente les volumes à moindre coût. R1 (Reproductrice) assure une génération supplémentaire lorsque les volumes C2 sont insuffisants.",
                  },
                  {
                    level: 'Niveau 4', name: 'Semence Commerciale', cat: 'Distribution',
                    color: '#c44536', gens: ['R2'],
                    desc: "Étape ultime de la filière. Distribuée aux producteurs finaux par les quotataires et OP. Le grain récolté à partir du R2 ne peut plus être labellisé comme semence certifiée ni servir de lot parent.",
                  },
                ].map(lv => (
                  <div key={lv.level} style={{ padding: '18px 16px', borderRadius: 8, background: '#fff', border: `1px solid ${lv.color}22`, borderTop: `3px solid ${lv.color}` }}>
                    <div style={{ fontFamily: T.mono, fontSize: 9.5, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: lv.color, marginBottom: 4 }}>{lv.level}</div>
                    <h4 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13.5, color: T.ink, marginBottom: 4, lineHeight: 1.3 }}>{lv.name}</h4>
                    <div style={{ fontFamily: T.mono, fontSize: 9.5, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12 }}>{lv.cat}</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' as const }}>
                      {lv.gens.map(g => (
                        <span key={g} style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: `${lv.color}12`, color: lv.color, border: `1px solid ${lv.color}22` }}>{g}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.65, margin: 0 }}>{lv.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
              <InfoBox title="Codification des lots" color={C.vert}>
                Chaque lot porte un code unique structuré : <code style={CODE}>{'{GEN}-{ESPECE}-{VARIETE}-{CAMPAGNE}-{NN}'}</code>. Exemple : <code style={CODE}>G3-ARA-FLEUR11-2024A-01</code>. Ce format garantit l'unicité et la lisibilité de chaque lot dans tout le système.
              </InfoBox>
              <InfoBox title="Lot de réception (REC)" color="#0369a1">
                À chaque livraison validée, un lot de réception est créé automatiquement pour l'organisation destinataire. Il apparaît immédiatement dans « Mes Lots » et dans le stock de l'acheteur, assurant la continuité de la traçabilité sans saisie manuelle.
              </InfoBox>
              <InfoBox title="Politique BROUILLON / CONFIRMÉ" color="#b45309">
                Un lot peut être modifié tant qu'il est en état BROUILLON. Une fois confirmé, il est verrouillé — garantissant l'intégrité des données certifiées. Un verrouillage automatique intervient après 30 jours d'inactivité.
              </InfoBox>
              <InfoBox title="Audit trail" color="#7c3aed">
                Toute modification d'un lot est journalisée : qui a modifié quoi, avant/après, à quelle heure. Cet historique est accessible depuis l'interface et constitue la preuve irréfutable pour les organismes de certification.
              </InfoBox>
            </div>
          </section>

          {/* ═══ 04 — GUIDES PAR RÔLE ═══════════════════════════════════ */}
          <section id="roles" style={{ marginBottom: 80 }}>
            <DocLabel text="04 — Guides par rôle" />
            <h2 style={H2}>Un espace adapté à chaque acteur</h2>
            <p style={P}>Sen Jiwu applique un contrôle d'accès strict par rôle. Chaque utilisateur voit uniquement les modules, les données et les actions correspondant à sa fonction dans la filière.</p>
            <div className="doc-roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 28 }}>
              {[
                {
                  role: 'Sélectionneur', key: 'seed-selector', color: '#0369a1',
                  gens: 'G0 / G1', institution: 'CNRA / ISRA',
                  desc: 'Crée et gère le référentiel variétal (espèces, variétés, zones agro-écologiques). Produit les lots G0 et G1 de pré-base. Initie les transferts vers l\'UPSemCL. Accède aux analytiques de production.',
                  actions: ['Créer / archiver des variétés', 'Créer des lots G0 et G1', 'Initier des transferts', 'Consulter les analytiques'],
                },
                {
                  role: 'UPSemCL', key: 'seed-upsemcl', color: C.vertFonce,
                  gens: 'G1 → G3', institution: 'UPSemCL Bambey',
                  desc: 'Réceptionne les lots G1 du sélectionneur. Gère la multiplication G2 et G3, les stocks, les programmes et les certifications. Vend les lots G3 aux multiplicateurs agréés.',
                  actions: ['Gérer les lots G2 / G3', 'Gérer le stock UPSemCL', 'Certifier les lots', 'Gérer les programmes', 'Ventes G3 aux multiplicateurs'],
                },
                {
                  role: 'Multiplicateur', key: 'seed-multiplicator', color: C.vert,
                  gens: 'G3 → R2', institution: 'Organisation agréée',
                  desc: 'Reçoit les lots G3 de l\'UPSemCL et produit les semences G4, R1 et R2. Gère ses propres sites de stockage, son stock et suit ses commandes. Vend les lots R2 aux quotataires et organisations de producteurs.',
                  actions: ['Gérer mes lots G4 / R1 / R2', 'Gérer mes sites de stockage', 'Suivre mon stock', 'Commandes G3 passées', 'Exprimer des besoins futurs'],
                },
                {
                  role: 'Quotataire / OP', key: 'seed-quotataire', color: '#b45309',
                  gens: 'R2', institution: 'OP / Distributeur',
                  desc: 'Consulte le catalogue des semences R2 certifiées disponibles (avec cartographie par zone agro-écologique). Passe des commandes directement auprès des multiplicateurs et suit leur livraison.',
                  actions: ['Consulter le catalogue R2', 'Passer des commandes R2', 'Suivre mes commandes', 'Accéder à la carte des stocks'],
                },
                {
                  role: 'Directeur CNRA', key: 'seed-directeur', color: '#1d4ed8',
                  gens: 'Vue globale', institution: 'CNRA Bambey',
                  desc: 'Accès en lecture seule à l\'ensemble de la chaîne. Dashboard décisionnel avec KPIs en temps réel, pipeline G0→R2, statistiques de certification, top variétés et matrice espèce × génération.',
                  actions: ['Dashboard décisionnel', 'Vue pipeline G0→R2', 'Statistiques certifications', 'Analyse par espèce et variété'],
                },
                {
                  role: 'Administrateur', key: 'seed-admin', color: '#7c3aed',
                  gens: 'Accès total', institution: 'ISRA / CNRA',
                  desc: 'Supervision globale de la plateforme. Gestion des comptes utilisateurs et des droits d\'accès. Accès à tous les modules, tous les lots, toutes les commandes et tous les stocks.',
                  actions: ['Gérer les utilisateurs', 'Superviser tous les modules', 'Accès aux analytiques globaux', 'Monitoring infrastructure'],
                },
              ].map(r => (
                <div key={r.role} className="doc-role-card" style={{ padding: '22px 18px', borderRadius: 8, border: `1.5px solid ${C.grisBord}`, borderTop: `3px solid ${r.color}`, background: '#fff', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <h3 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15, color: T.ink }}>{r.role}</h3>
                    <span style={{ fontFamily: T.mono, fontSize: 9.5, padding: '3px 8px', borderRadius: 4, background: `${r.color}12`, color: r.color, border: `1px solid ${r.color}20`, whiteSpace: 'nowrap' as const }}>{r.gens}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#888', fontFamily: T.mono, marginBottom: 12, letterSpacing: '0.03em' }}>{r.institution}</p>
                  <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.65, marginBottom: 14 }}>{r.desc}</p>
                  <div style={{ borderTop: `1px solid ${C.grisBord}`, paddingTop: 12 }}>
                    {r.actions.map(a => (
                      <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: T.muted }}>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ 05 — MODULES ═══════════════════════════════════════════ */}
          <section id="modules" style={{ marginBottom: 80 }}>
            <DocLabel text="05 — Modules de la plateforme" />
            <h2 style={H2}>Fonctionnalités disponibles</h2>
            <p style={P}>Sen Jiwu est organisé en modules fonctionnels indépendants, chacun couvrant un domaine métier précis de la filière semencière. L'accès à chaque module dépend du rôle de l'utilisateur connecté.</p>
            <div style={{ marginTop: 28, border: `1px solid ${C.grisBord}`, borderRadius: 8, overflow: 'hidden' }}>
              {[
                { mod: 'Tableau de bord',        icon: '📊', desc: 'KPIs en temps réel, pipeline générationnel G0→R2 visuel, lots récents, statuts des commandes et alertes actives.' },
                { mod: 'Catalogue public',        icon: '🗺️', desc: 'Vitrine des espèces et variétés certifiées accessible sans authentification. Inclut une carte interactive des zones agro-écologiques (ZAE) du Sénégal.' },
                { mod: 'Variétés & Espèces',      icon: '🌱', desc: 'Référentiel variétal ISRA complet avec archivage traçable : chaque modification est horodatée avec l\'auteur, la raison et les valeurs avant/après.' },
                { mod: 'Lots semenciers',         icon: '📦', desc: 'Cycle de vie complet G0→R2. Création de lot enfant depuis un lot parent, vue lineage (arbre d\'ascendance), génération de certificats PDF, audit trail.' },
                { mod: 'Stock',                   icon: '🏭', desc: 'Inventaire par site et par organisation. Mouvements entrée / sortie / transfert. Isolation stricte : chaque acteur voit uniquement son propre stock.' },
                { mod: 'Commandes',               icon: '🛒', desc: 'Passation de commandes G3 (UPSemCL → Multiplicateur) et R2 (Multiplicateur → Quotataire). Workflow complet : passation, confirmation, allocation, négociation, livraison, réception.' },
                { mod: 'Transferts',              icon: '🔄', desc: 'Transferts de lots entre organisations avec règles métier par génération. Création automatique du lot REC à l\'acceptation de la réception.' },
                { mod: 'Certifications',          icon: '✅', desc: 'Contrôles qualité terrain et laboratoire. Certification officielle avec upload de document PDF. Statuts : En attente / Certifié / Rejeté.' },
                { mod: 'Campagnes',               icon: '📅', desc: 'Gestion des campagnes agricoles (hivernale, contre-saison, irriguée). Les lots sont rattachés à une campagne pour le suivi annuel.' },
                { mod: 'Sites',                   icon: '📍', desc: 'Sites de stockage et fermes de production. Vue globale (admin/UPSemCL) ou vue personnelle (mes sites, pour les multiplicateurs).' },
                { mod: 'Programmes',              icon: '📋', desc: 'Programmes de multiplication : planification, assignation de variétés et de sites, suivi d\'avancement.' },
                { mod: 'Messagerie',              icon: '💬', desc: 'Messagerie interne entre acteurs de la chaîne. Échanges traçables dans le contexte d\'une commande ou d\'un transfert.' },
                { mod: 'Analytiques',             icon: '📈', desc: 'Tableaux de bord avancés par rôle : vue globale (admin), vue sélectionneur, vue décisionnelle directeur CNRA avec matrice espèce × génération.' },
                { mod: 'Expressions de besoins',  icon: '📝', desc: 'Module permettant aux multiplicateurs de déclarer leurs besoins en semences pour la campagne à venir. Agrégation et consultation par l\'UPSemCL.' },
                { mod: 'Gestion utilisateurs',    icon: '👥', desc: 'Interface administrateur pour créer, modifier et attribuer les rôles des comptes utilisateurs. Intégration directe avec le système d\'authentification.' },
                { mod: 'Profil',                  icon: '👤', desc: 'Informations du compte connecté, rôle actif, gestion du mot de passe et des préférences personnelles.' },
                { mod: 'Génération PDF',          icon: '📄', desc: 'Production de documents officiels : fiches variétales, itinéraires techniques, certificats de lot, bons de transfert et de réception, factures.' },
              ].map((m, i) => (
                <div key={m.mod} className="doc-mod-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px', borderTop: i === 0 ? 'none' : `1px solid ${C.grisBord}`, transition: 'background 0.15s' }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{m.icon}</span>
                  <div>
                    <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14, color: T.ink }}>{m.mod}</span>
                    <span style={{ fontSize: 13.5, color: T.muted, marginLeft: 10, lineHeight: 1.6 }}>{m.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ 06 — ARCHITECTURE ══════════════════════════════════════ */}
          <section id="architecture" style={{ marginBottom: 80 }}>
            <DocLabel text="06 — Architecture" />
            <h2 style={H2}>Principes d'architecture</h2>
            <p style={P}>Sen Jiwu est conçu selon une architecture modulaire orientée domaines métier. Chaque domaine est indépendant — ce qui permet de faire évoluer un composant sans impacter les autres, et d'absorber la croissance du volume de données sans restructuration.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 28 }}>
              {[
                { title: 'Quatre domaines métier indépendants', icon: '🧩', desc: 'La plateforme est organisée en quatre domaines fonctionnels distincts : le référentiel variétal, la gestion des lots, la gestion des stocks, et les commandes & livraisons. Cette séparation garantit qu\'une opération dans un domaine n\'en bloque pas un autre.' },
                { title: 'Authentification centralisée', icon: '🔐', desc: 'Tous les accès sont contrôlés par un système d\'authentification unique basé sur le protocole OAuth2/OIDC — standard international utilisé par les grandes institutions. Chaque identifiant est lié à un rôle métier précis, appliqué côté serveur à chaque requête.' },
                { title: 'Traçabilité par conception', icon: '🔍', desc: 'Le modèle de données intègre nativement la traçabilité : chaque lot référence son lot parent, chaque modification est journalisée, chaque document généré est horodaté et signé électroniquement. Aucune donnée certifiée n\'est modifiable sans trace.' },
                { title: 'Scalabilité et résilience', icon: '⚡', desc: 'Les opérations lourdes (création de lots REC, notifications inter-acteurs) sont traitées de façon asynchrone via un bus d\'événements — le système répond immédiatement à l\'utilisateur sans attendre la propagation. L\'architecture est conçue pour être répliquée si le volume d\'utilisateurs augmente.' },
                { title: 'Déploiement conteneurisé', icon: '🐳', desc: 'L\'ensemble de la plateforme est packagé dans des conteneurs légers et reproductibles. Le déploiement sur n\'importe quel serveur compatible (VPS, serveur physique ISRA/CNRA) se fait en une commande, garantissant un environnement identique entre développement et production.' },
                { title: 'Conformité et interopérabilité', icon: '🌐', desc: 'L\'architecture est conçue pour une interopérabilité future avec d\'autres systèmes d\'information agricoles régionaux. Les APIs respectent les standards REST et pourront être exposées à des partenaires externes sous contrôle d\'accès.' },
              ].map(a => (
                <div key={a.title} style={{ padding: '22px 20px', borderRadius: 8, border: `1px solid ${C.grisBord}`, background: '#fff' }}>
                  <div style={{ fontSize: 22, marginBottom: 12 }}>{a.icon}</div>
                  <h4 style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14.5, color: T.ink, marginBottom: 8, lineHeight: 1.3 }}>{a.title}</h4>
                  <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, margin: 0 }}>{a.desc}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: '18px 22px', borderRadius: 8, background: `${C.vert}08`, border: `1px solid ${C.vert}20` }}>
              <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.7, margin: 0 }}>
                <strong style={{ color: C.vert }}>Note de sécurité :</strong> Sen Jiwu applique le principe de <em>security by design</em> — la sécurité est intégrée à l'architecture dès la conception, non ajoutée après coup. Les détails d'implémentation interne ne sont pas exposés publiquement. Pour toute demande technique institutionnelle, contactez l'équipe via <a href="mailto:senjiwu1@gmail.com" style={{ color: C.vert }}>senjiwu1@gmail.com</a>.
              </p>
            </div>
          </section>

          {/* ═══ 07 — GLOSSAIRE ════════════════════════════════════════ */}
          <section id="glossaire" style={{ marginBottom: 80 }}>
            <DocLabel text="07 — Glossaire" />
            <h2 style={H2}>Termes clés</h2>
            <p style={P}>Vocabulaire de la filière semencière et des concepts techniques de la plateforme.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 28 }}>
              {[
                { term: 'G0', cat: 'Agro', def: 'Semence de noyau génétique — pureté maximale, produite exclusivement par les sélectionneurs ISRA/CNRA.' },
                { term: 'G1', cat: 'Agro', def: 'Semence de pré-base, produite par le sélectionneur à partir du G0. Transférée à l\'UPSemCL pour lancer la phase de multiplication.' },
                { term: 'G2', cat: 'Agro', def: 'Semence de base, produite par l\'UPSemCL à partir du G1 reçu. Première génération entièrement gérée par l\'UPSemCL avant la certification.' },
                { term: 'G3', cat: 'Agro', def: 'Semence certifiée C1, produite par l\'UPSemCL à partir du G2. C\'est le lot vendu aux multiplicateurs agréés pour démarrer la production commerciale.' },
                { term: 'G4', cat: 'Agro', def: 'Semence certifiée C2, produite par le multiplicateur à partir du G3 reçu. Première génération entièrement gérée par le multiplicateur avant de passer en R1/R2.' },
                { term: 'R1', cat: 'Agro', def: "Semence reproductrice, produite par le multiplicateur à partir du G4. Assure une génération supplémentaire de multiplication lorsque les volumes de G4 (C2) sont insuffisants pour répondre à la demande de la campagne." },
                { term: 'R2', cat: 'Agro', def: "Semence commerciale — étape ultime de la filière. Distribuée aux producteurs finaux par les quotataires et OP. Le grain récolté à partir du R2 est destiné à la consommation et ne peut plus être labellisé comme semence certifiée." },
                { term: 'ZAE', cat: 'Agro', def: 'Zone Agro-Écologique. Le Sénégal est divisé en zones ZAE selon le climat, le sol et les cultures adaptées.' },
                { term: 'DUS', cat: 'Agro', def: 'Distinction, Uniformité, Stabilité — critères de certification officielle d\'une variété végétale.' },
                { term: 'Taux de conditionnement', cat: 'Agro', def: 'Proportion de la récolte brute transformée en semence prête au stockage (norme ISRA : 70–85%).' },
                { term: 'Rendement parcellaire', cat: 'Agro', def: 'Production en kg par hectare de la parcelle de multiplication. Varie selon l\'espèce et les conditions climatiques.' },
                { term: 'UPSemCL', cat: 'Agro', def: 'Unité de Production de Semences de Céréales et Légumineuses — structure de multiplication basée à Bambey.' },
                { term: 'CNRA', cat: 'Agro', def: 'Centre National de Recherches Agronomiques de Bambey — institution de recherche et de production semencière au Sénégal.' },
                { term: 'ISRA', cat: 'Agro', def: 'Institut Sénégalais de Recherches Agricoles — tutelle nationale des activités de recherche et certification semencière.' },
                { term: 'Lot semencier', cat: 'Agro', def: 'Unité de production identifiée par un code unique, rattachée à une variété, une génération, un site et une campagne.' },
                { term: 'Lot parent / Lot enfant', cat: 'Système', def: 'Relation de traçabilité entre lots : un lot enfant est créé à partir d\'un lot parent, conservant la référence de l\'origine génétique.' },
                { term: 'Lot REC', cat: 'Système', def: 'Lot de réception créé automatiquement à la livraison. Il représente le lot côté acheteur et apparaît immédiatement dans son stock.' },
                { term: 'Audit trail', cat: 'Système', def: 'Journal immuable de toutes les modifications d\'un lot : champ modifié, valeur avant/après, auteur, horodatage UTC.' },
                { term: 'BROUILLON / CONFIRMÉ', cat: 'Système', def: 'Statut d\'édition d\'un lot. Un lot CONFIRMÉ est verrouillé et ne peut plus être modifié, garantissant l\'intégrité des données certifiées.' },
                { term: 'OAuth2 / OIDC', cat: 'Tech', def: 'Protocoles d\'authentification et d\'autorisation sécurisés — standard international utilisé par les grandes plateformes institutionnelles.' },
                { term: 'RBAC', cat: 'Tech', def: 'Contrôle d\'accès basé sur les rôles (Role-Based Access Control). Chaque utilisateur accède uniquement aux ressources de son rôle.' },
                { term: 'Microservice', cat: 'Tech', def: 'Module applicatif indépendant couvrant un domaine métier précis. Permet d\'évoluer ou de scaler un domaine sans impacter les autres.' },
                { term: 'Traçabilité numérique', cat: 'Tech', def: 'Capacité à retrouver l\'historique complet d\'un lot : origine génétique, acteurs impliqués, mouvements, certifications et modifications.' },
              ].map(g => (
                <div key={g.term} className="doc-gloss-item" style={{ padding: '14px 16px', borderRadius: 6, border: `1px solid ${C.grisBord}`, transition: 'border-color 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <code style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 13, color: g.cat === 'Tech' ? '#0369a1' : g.cat === 'Système' ? C.vert : '#b45309' }}>{g.term}</code>
                    <span style={{ fontFamily: T.mono, fontSize: 9.5, padding: '2px 6px', borderRadius: 3, background: g.cat === 'Tech' ? 'rgba(3,105,161,0.1)' : g.cat === 'Système' ? `${C.vert}12` : 'rgba(180,83,9,0.1)', color: g.cat === 'Tech' ? '#0369a1' : g.cat === 'Système' ? C.vert : '#b45309' }}>{g.cat}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.65, margin: 0 }}>{g.def}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ 08 — CONTEXTE ACADÉMIQUE ═══════════════════════════════ */}
          <section id="academique" style={{ marginBottom: 80 }}>
            <DocLabel text="08 — Contexte académique" />
            <h2 style={H2}>Cadre institutionnel et académique</h2>
            <p style={P}>Sen Jiwu a été développé dans le cadre d'un mémoire de fin d'études de <strong>Master 2 en Systèmes d'Information</strong> à l'Université Alioune Diop de Bambey (UADB), réalisé en stage au CNRA de Bambey. Le projet répond à des besoins réels de modernisation de la filière semencière nationale sénégalaise.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 }}>
              <div style={{ padding: '28px 24px', borderRadius: 8, border: `1.5px solid ${C.grisBord}`, background: '#fff' }}>
                <p style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#aaa', marginBottom: 16 }}>Réalisé par</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${C.vert}15`, border: `2px solid ${C.vert}25`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, color: C.vert }}>TG</span>
                  </div>
                  <div>
                    <h4 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: T.ink, marginBottom: 4 }}>Toussaint GOMIS</h4>
                    <p style={{ fontSize: 12.5, color: T.muted, margin: 0 }}>M2 Systèmes d'Information · UADB</p>
                    <a href="mailto:toussaint.gomis@uadb.edu.sn" style={{ fontSize: 12, color: C.vert, textDecoration: 'none' }}>toussaint.gomis@uadb.edu.sn</a>
                  </div>
                </div>
              </div>
              <div style={{ padding: '28px 24px', borderRadius: 8, border: `1.5px solid ${C.grisBord}`, background: '#fff' }}>
                <p style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#aaa', marginBottom: 16 }}>Encadrant terrain</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(3,105,161,0.10)', border: '2px solid rgba(3,105,161,0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: '#0369a1' }}>BB</span>
                  </div>
                  <div>
                    <h4 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: T.ink, marginBottom: 4 }}>M. Biram BITEYE</h4>
                    <p style={{ fontSize: 12.5, color: T.muted, margin: 0, lineHeight: 1.5 }}>Encadrant professionnel · CNRA Bambey / ISRA</p>
                    <a href="mailto:biram.biteye@isra.sn" style={{ fontSize: 12, color: '#0369a1', textDecoration: 'none' }}>biram.biteye@isra.sn</a>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <p style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#aaa', marginBottom: 14, padding: '0 0 0 0' }}>Encadreurs académiques — Université Alioune Diop de Bambey (UADB)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { initials: 'AK', name: 'Dr. Ahmad Khoureich KA', email: 'ahmadkhoureich.ka@uadb.edu.sn', color: '#7c3aed' },
                  { initials: 'AL', name: 'Dr. Alla LÔ', email: 'alla.lo@uadb.edu.sn', color: '#0f766e' },
                ].map(e => (
                  <div key={e.name} style={{ padding: '22px 20px', borderRadius: 8, border: `1.5px solid ${C.grisBord}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${e.color}12`, border: `2px solid ${e.color}22`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 14, color: e.color }}>{e.initials}</span>
                    </div>
                    <div>
                      <h4 style={{ fontFamily: T.display, fontWeight: 600, fontSize: 14.5, color: T.ink, marginBottom: 4 }}>{e.name}</h4>
                      <a href={`mailto:${e.email}`} style={{ fontSize: 12, color: e.color, textDecoration: 'none' }}>{e.email}</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 24, padding: '18px 22px', borderRadius: 8, background: C.gris, border: `1px solid ${C.grisBord}` }}>
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' as const }}>
                {[
                  { label: 'Institution', value: 'Université Alioune Diop de Bambey (UADB)' },
                  { label: 'Diplôme', value: 'Master 2 Systèmes d\'Information' },
                  { label: 'Cadre', value: 'Mémoire de fin d\'études · Stage CNRA Bambey' },
                  { label: 'Période', value: '2025 – 2026' },
                  { label: 'Méthodologie', value: 'Design Science Research · Kanban · Domain-Driven Design' },
                ].map(i => (
                  <div key={i.label}>
                    <p style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#aaa', marginBottom: 4 }}>{i.label}</p>
                    <p style={{ fontSize: 13.5, color: T.ink, fontWeight: 500, margin: 0 }}>{i.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ 09 — CONTACT ═══════════════════════════════════════════ */}
          <section id="contact" style={{ marginBottom: 40 }}>
            <DocLabel text="09 — Contact & Accès" />
            <h2 style={H2}>Nous contacter</h2>
            <p style={P}>Pour demander un accès à la plateforme, signaler un problème ou obtenir des informations sur le déploiement de Sen Jiwu dans votre organisation :</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 28 }}>
              <div style={{ padding: '28px 24px', borderRadius: 8, border: `1.5px solid ${C.grisBord}`, background: '#fff', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: `${C.vert}12`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="2" stroke={C.vert} strokeWidth="1.5"/><path d="M2 7l8 5 8-5" stroke={C.vert} strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <p style={{ fontFamily: T.mono, fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#aaa', marginBottom: 6 }}>Email plateforme</p>
                  <a href="mailto:senjiwu1@gmail.com" style={{ fontSize: 15.5, fontWeight: 600, color: C.vert, textDecoration: 'none', display: 'block', marginBottom: 6 }}>senjiwu1@gmail.com</a>
                  <p style={{ fontSize: 12.5, color: T.muted, margin: 0 }}>Demandes d'accès, questions fonctionnelles, signalement d'incidents</p>
                </div>
              </div>
              <div style={{ padding: '28px 24px', borderRadius: 8, border: `1.5px solid ${C.grisBord}`, background: '#fff', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(3,105,161,0.10)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 4a1 1 0 011-1h3l1.5 4-2 1a11 11 0 005 5l1-2 4 1.5V16a1 1 0 01-1 1C8 17 3 12 3 4z" stroke="#0369a1" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <p style={{ fontFamily: T.mono, fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#aaa', marginBottom: 6 }}>Téléphone</p>
                  <a href="tel:+22177758 2871" style={{ fontSize: 15.5, fontWeight: 600, color: '#0369a1', textDecoration: 'none', display: 'block', marginBottom: 6 }}>+221 77 758 28 71</a>
                  <p style={{ fontSize: 12.5, color: T.muted, margin: 0 }}>Support direct · CNRA Bambey · Sénégal</p>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16, padding: '20px 24px', borderRadius: 8, background: C.gris, border: `1px solid ${C.grisBord}`, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' as const }}>
              <div>
                <p style={{ fontFamily: T.mono, fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#aaa', marginBottom: 4 }}>Localisation</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: T.ink, margin: 0 }}>CNRA Bambey — Sénégal</p>
                <p style={{ fontSize: 12.5, color: T.muted, margin: '2px 0 0' }}>Université Alioune Diop de Bambey (UADB) · Institut Sénégalais de Recherches Agricoles (ISRA)</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button onClick={handleLogin} disabled={loggingIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 5, background: C.vert, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: loggingIn ? 'default' : 'pointer', fontFamily: T.body }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 4l3 3-3 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Accéder à la plateforme
                </button>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{ background: C.vertFonce, color: 'rgba(255,255,255,0.60)', padding: '48px 28px 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div className="doc-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 48, marginBottom: 36 }}>
            <div>
              <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.92)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                  <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 22, width: 'auto', objectFit: 'contain' }} />
                </div>
                <strong style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: '-0.02em' }}>Sen Jiwu</strong>
              </a>
              <p style={{ fontSize: 13, lineHeight: 1.75, maxWidth: 260 }}>{u.footerTagline}</p>
            </div>
            <div>
              <h4 style={{ fontFamily: T.mono, fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Documentation</h4>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {NAV.map(s => (
                  <button key={s.id} onClick={() => { scrollTo(s.id); window.scrollTo({ top: 0 }) }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.50)', fontSize: 13, textAlign: 'left' as const, fontFamily: T.body, transition: 'color 0.2s' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = 'rgba(255,255,255,0.50)')}>
                    {lang === 'fr' ? s.fr : s.en}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ fontFamily: T.mono, fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Partenaires</h4>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                {['CNRA Bambey', 'UPSemCL Bambey', 'ISRA Sénégal', 'UADB Bambey'].map(p => (
                  <span key={p} style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)' }}>{p}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 10 }}>
            <p style={{ fontFamily: T.mono, fontSize: 10.5 }}>{u.copyright}</p>
            <a href="/" style={{ fontFamily: T.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
              ← Retour à l'accueil
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Sous-composants
   ══════════════════════════════════════════════════════════════════════════ */

function DocLabel({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <div style={{ flex: 1, height: 1, background: `${C.vert}25` }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: C.vert, textTransform: 'uppercase' as const, letterSpacing: '0.15em', whiteSpace: 'nowrap' as const }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: `${C.vert}25` }} />
    </div>
  )
}

function InfoBox({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <div style={{ padding: '18px 20px', borderRadius: 8, border: `1px solid ${color}22`, background: `${color}05` }}>
      <h4 style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {title}
      </h4>
      <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, margin: 0 }}>{children}</p>
    </div>
  )
}

/* Styles partagés */
const H2 = {
  fontFamily: 'var(--font-sans)', fontWeight: 700,
  fontSize: 'clamp(22px, 2.8vw, 32px)', color: C.vertFonce,
  letterSpacing: '-0.02em', marginBottom: 18, lineHeight: 1.2,
} as const
const P = {
  fontSize: 15.5, color: T.muted, lineHeight: 1.8, marginBottom: 14,
} as const
const CODE = {
  fontFamily: 'var(--font-mono)', fontSize: 12, background: `${C.vert}10`,
  color: C.vert, padding: '2px 6px', borderRadius: 4,
} as const
