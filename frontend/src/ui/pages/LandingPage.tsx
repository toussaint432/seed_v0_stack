import { useState, useEffect, useRef } from 'react'
import type { ReactNode, MouseEvent } from 'react'
import { keycloak } from '../../lib/keycloak'

/* ── Design tokens ─────────────────────────────────────────────────────── */
const T = {
  green:       '#00693e',
  greenDeep:   '#00393d',
  greenSoft:   '#e8f1ec',
  greenBright: '#01b400',
  greenLeaf:   '#048a14',
  gold:        '#e8b04b',
  goldDeep:    '#c08a2a',
  terra:       '#c44536',
  ink:         '#131814',
  paper:       '#fafaf7',
  paper2:      '#f3f1ea',
  line:        '#e2dfd3',
  muted:       '#6e6f6a',
  display:     "'Bricolage Grotesque', system-ui, sans-serif",
  body:        "'Manrope', system-ui, sans-serif",
  mono:        "'JetBrains Mono', ui-monospace, monospace",
}

/* ── Traductions i18n ──────────────────────────────────────────────────── */
type Lang = 'fr' | 'en'
const I18N: Record<Lang, Record<string, string>> = {
  fr: {
    navMission: 'Mission',
    navApercu: 'Aperçu',
    navActeurs: 'Acteurs',
    navPipeline: 'Pipeline',
    navHowto: 'Fonctionnement',
    navFAQ: 'FAQ',
    login: 'Se connecter',
    heroEyebrow: 'Plateforme nationale',
    heroTitle1: 'La filière semencière',
    heroTitle2: 'nationale, numérisée.',
    heroDesc: "Sen Jiwu centralise la traçabilité de chaque lot du G0 génétique jusqu'au R2 commercial — certification intégrée, gestion des stocks et pilotage en temps réel.",
    heroCTA: 'Accéder à la plateforme',
    heroDemo: 'Voir la démo',
    trustLabel: 'Soutenu par',
    featTitle: "Tout ce qu'il faut pour piloter la filière",
    featDesc: 'Cinq rôles, un seul système — chaque acteur dispose des outils adaptés à sa mission.',
    f1t: 'Traçabilité G0 → R2', f1d: "Suivi générationnel complet de chaque lot, de la sélection variétale jusqu'à la commercialisation.",
    f2t: 'Certification intégrée', f2d: 'Gestion des contrôles qualité, soumission aux organismes certificateurs et alertes automatiques.',
    f3t: 'Gestion des stocks', f3d: 'Inventaire multi-sites avec alertes de seuil, couverture de la demande et prévisions de récolte.',
    f4t: 'Commandes & livraisons', f4d: 'Flux complet de passation de commandes entre quotataires et multiplicateurs, avec suivi des livraisons.',
    f5t: 'Analyse & décision', f5d: 'Tableaux de bord par rôle, indicateurs clés de campagne et rapports PDF exportables.',
    f6t: 'Messagerie intégrée', f6d: 'Communication directe entre acteurs de la chaîne semencière sans quitter la plateforme.',
    statsLabel: 'La filière en chiffres',
    s1n: '5', s1l: 'Rôles acteurs',
    s2n: '6', s2l: 'Générations tracées',
    s3n: '100%', s3l: 'Données certifiées',
    s4n: '4', s4l: 'Microservices',
    pipeTitle: 'De la génétique au champ',
    pipeDesc: 'Chaque lot est unique, horodaté et certifié à chaque passage de génération.',
    rolesTitle: 'Un rôle pour chaque acteur',
    rolesDesc: "La plateforme s'adapte à chaque profil — chacun voit uniquement ce qui le concerne.",
    r1t: 'Sélectionneur', r1d: 'Gère les variétés et crée les lots G0/G1 de pré-base.',
    r2t: 'UPSemCL', r2d: 'Réceptionne les G1 et pilote la multiplication vers G3.',
    r3t: 'Multiplicateur', r3d: 'Produit les lots G4→R2 pour la commercialisation.',
    r4t: 'Quotataire', r4d: 'Consulte le catalogue et passe commande de semences R2.',
    r5t: 'Administrateur', r5d: 'Supervision globale, gestion des utilisateurs et monitoring.',
    howtoTitle: 'Comment ça marche ?',
    howtoDesc: "En quatre étapes simples, de la demande d'accès à la traçabilité complète de votre production semencière.",
    ht1Title: 'Demandez vos accès',
    ht1Desc: "Contactez l'équipe Sen Jiwu — opérée par l'ISRA — pour obtenir un compte adapté à votre rôle dans la filière semencière nationale.",
    ht2Title: 'Connexion sécurisée',
    ht2Desc: 'Authentifiez-vous via OAuth 2.0 / PKCE. Chaque identifiant est unique, chiffré et associé à un rôle précis.',
    ht3Title: 'Votre espace personnalisé',
    ht3Desc: 'Accédez à un tableau de bord sur mesure selon votre profil : sélectionneur, multiplicateur ou quotataire.',
    ht4Title: 'Tracez et certifiez',
    ht4Desc: 'Gérez vos lots G0→R2, soumettez aux organismes certificateurs et générez vos rapports de campagne.',
    ctaTitle: 'Prêt à rejoindre la plateforme ?',
    ctaDesc: "Contactez l'équipe Sen Jiwu pour obtenir vos accès et commencer à tracer votre production semencière.",
    ctaBtn: 'Demander un accès',
    faqTitle: 'Questions fréquentes',
    q1: 'Qui peut utiliser Sen Jiwu ?', a1: 'Tout acteur accrédité de la filière semencière nationale : sélectionneurs ISRA/CNRA, structures de multiplication (UPSemCL), multiplicateurs agréés et quotataires/OP.',
    q2: 'Les données sont-elles sécurisées ?', a2: "Oui. L'authentification est gérée par Keycloak avec PKCE OAuth2. Chaque utilisateur n'accède qu'aux données correspondant à son rôle.",
    q3: 'Comment obtenir un compte ?', a3: "Les comptes sont créés par l'équipe Sen Jiwu, en lien avec la Direction Technique ISRA. Contactez-nous pour soumettre une demande d'accès.",
    q4: 'La plateforme fonctionne-t-elle hors-ligne ?', a4: "La version actuelle est en ligne. Une version mobile allégée avec synchronisation est prévue dans une prochaine itération.",
    footerTagline: "Système d'information national de la filière semencière du Sénégal.",
    footerLinks1: 'Plateforme', footerLinks2: 'Légal', footerLinks3: 'Support',
    fl1: 'Tableau de bord', fl2: 'Lots & générations', fl3: 'Stocks & commandes',
    fl4: 'Politique de confidentialité', fl5: "Conditions d'utilisation",
    fl6: 'Documentation', fl7: 'Contact technique',
    copyright: '© 2026 Sen Jiwu — République du Sénégal. Tous droits réservés.',
    loginOverlayText: 'Ouverture de la session sécurisée…',
  },
  en: {
    navMission: 'Mission',
    navApercu: 'Preview',
    navActeurs: 'Actors',
    navPipeline: 'Pipeline',
    navHowto: 'How it works',
    navFAQ: 'FAQ',
    login: 'Sign in',
    heroEyebrow: 'National platform',
    heroTitle1: 'The national seed',
    heroTitle2: 'industry, digitalized.',
    heroDesc: 'Sen Jiwu centralises traceability of every lot from genetic G0 to commercial R2 — integrated certification, stock management and real-time monitoring.',
    heroCTA: 'Access the platform',
    heroDemo: 'Watch demo',
    trustLabel: 'Supported by',
    featTitle: 'Everything needed to manage the seed industry',
    featDesc: 'Five roles, one system — every actor has the tools suited to their mission.',
    f1t: 'Traceability G0 → R2', f1d: 'Full generational tracking of every lot, from varietal selection to commercialisation.',
    f2t: 'Integrated certification', f2d: 'Quality control management, submission to certifying bodies and automatic alerts.',
    f3t: 'Stock management', f3d: 'Multi-site inventory with threshold alerts, demand coverage and harvest forecasts.',
    f4t: 'Orders & deliveries', f4d: 'Complete order flow between quotataires and multipliers, with delivery tracking.',
    f5t: 'Analysis & decisions', f5d: 'Role-based dashboards, key campaign indicators and exportable PDF reports.',
    f6t: 'Integrated messaging', f6d: 'Direct communication between seed chain actors without leaving the platform.',
    statsLabel: 'The industry in figures',
    s1n: '5', s1l: 'Actor roles',
    s2n: '7', s2l: 'Traced generations',
    s3n: '100%', s3l: 'Certified data',
    s4n: '4', s4l: 'Microservices',
    pipeTitle: 'From genetics to the field',
    pipeDesc: 'Each lot is unique, timestamped and certified at every generation step.',
    rolesTitle: 'A role for every actor',
    rolesDesc: 'The platform adapts to each profile — everyone sees only what concerns them.',
    r1t: 'Plant Breeder', r1d: 'Manages varieties and creates G0/G1 pre-base lots.',
    r2t: 'UPSemCL', r2d: 'Receives G1 lots and manages multiplication to G3.',
    r3t: 'Multiplier', r3d: 'Produces G4→R2 lots for commercialisation.',
    r4t: 'Quotataire', r4d: 'Browses the catalogue and places R2 seed orders.',
    r5t: 'Administrator', r5d: 'Global oversight, user management and monitoring.',
    howtoTitle: 'How does it work?',
    howtoDesc: 'In four simple steps, from access request to full traceability of your seed production.',
    ht1Title: 'Request access',
    ht1Desc: 'Contact the Sen Jiwu team — operated by ISRA — to get an account adapted to your role in the national seed industry.',
    ht2Title: 'Secure sign-in',
    ht2Desc: 'Authenticate via OAuth 2.0 / PKCE. Every credential is unique, encrypted and tied to a specific role.',
    ht3Title: 'Your personalised space',
    ht3Desc: 'Access a tailored dashboard based on your profile: breeder, multiplier or quotataire.',
    ht4Title: 'Trace and certify',
    ht4Desc: 'Manage your G0→R2 lots, submit to certifying bodies and generate your campaign reports.',
    ctaTitle: 'Ready to join the platform?',
    ctaDesc: 'Contact the Sen Jiwu team to get your credentials and start tracing your seed production.',
    ctaBtn: 'Request access',
    faqTitle: 'Frequently asked questions',
    q1: 'Who can use Sen Jiwu?', a1: 'Any accredited actor of the national seed industry: ISRA/CNRA breeders, multiplication structures (UPSemCL), approved multipliers and quotataires/POs.',
    q2: 'Is data secure?', a2: 'Yes. Authentication is managed by Keycloak with PKCE OAuth2. Each user only accesses data corresponding to their role.',
    q3: 'How to get an account?', a3: 'Accounts are created by the Sen Jiwu team, in coordination with the ISRA Technical Department. Contact us to submit an access request.',
    q4: 'Does the platform work offline?', a4: 'The current version is online. A lightweight mobile version with synchronisation is planned for a future iteration.',
    footerTagline: 'National information system for the Senegalese seed industry.',
    footerLinks1: 'Platform', footerLinks2: 'Legal', footerLinks3: 'Support',
    fl1: 'Dashboard', fl2: 'Lots & generations', fl3: 'Stocks & orders',
    fl4: 'Privacy policy', fl5: 'Terms of use',
    fl6: 'Documentation', fl7: 'Technical contact',
    copyright: '© 2026 Sen Jiwu — Republic of Senegal. All rights reserved.',
    loginOverlayText: 'Opening secure session…',
  },
}

/* ── Générations pipeline ──────────────────────────────────────────────── */
const GENS = [
  { code: 'G0', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', label: 'Génétique' },
  { code: 'G1', color: '#0369a1', bg: 'rgba(3,105,161,0.12)',   label: 'Pré-base' },
  { code: 'G2', color: '#0f766e', bg: 'rgba(15,118,110,0.12)',  label: 'Base' },
  { code: 'G3', color: '#15803d', bg: 'rgba(21,128,61,0.12)',   label: 'Certif. C1' },
  { code: 'G4', color: '#b45309', bg: 'rgba(180,83,9,0.12)',    label: 'Certif. C2' },
  { code: 'R1', color: '#c2410c', bg: 'rgba(194,65,12,0.12)',   label: 'Commerciale R1' },
  { code: 'R2', color: '#c44536', bg: 'rgba(196,69,54,0.12)',   label: 'Commerciale R2' },
]

/* ── CountUp hook ──────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1600, active = false) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [active, target, duration])
  return val
}

/* ══════════════════════════════════════════════════════════════════════════
   Composant principal
   ══════════════════════════════════════════════════════════════════════════ */
export function LandingPage() {
  const [lang, setLang] = useState<Lang>('fr')
  const [scrolled, setScrolled] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const t = I18N[lang]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  const handleLogin = () => {
    setLoggingIn(true)
    setTimeout(() => keycloak.login(), 650)
  }

  /* ── Styles utilitaires inline ── */
  const S = {
    container: {
      maxWidth: 1380,
      margin: '0 auto',
      padding: '0 28px',
    },
    section: {
      padding: '110px 28px',
    },
    eyebrow: {
      fontFamily: T.mono,
      fontSize: 11,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.14em',
      color: T.green,
      marginBottom: 14,
      display: 'block',
    },
    sectionTitle: {
      fontFamily: T.display,
      fontWeight: 600,
      fontSize: 'clamp(32px, 4vw, 54px)',
      lineHeight: 1.05,
      letterSpacing: '-0.03em',
      color: T.ink,
      marginBottom: 16,
    },
    sectionDesc: {
      fontSize: 17,
      color: T.muted,
      lineHeight: 1.65,
      maxWidth: 560,
    },
  }

  return (
    <div style={{ fontFamily: T.body, background: T.paper, color: T.ink, overflowX: 'hidden' }}>

      {/* ══ KEYFRAMES ═════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes lp-spin { to { transform: rotate(360deg) } }
        @keyframes lp-overlay-in {
          from { opacity: 0; transform: scale(1.02) }
          to   { opacity: 1; transform: scale(1) }
        }
        @keyframes lp-logo-float {
          0%, 100% { transform: translateY(0) }
          50%       { transform: translateY(-6px) }
        }
        @keyframes lp-dot-pulse {
          0%, 80%, 100% { transform: scale(0); opacity: 0.4 }
          40%            { transform: scale(1);   opacity: 1   }
        }
        @keyframes lp-step-in {
          from { opacity: 0; transform: translateY(16px) }
          to   { opacity: 1; transform: none }
        }
      `}</style>

      {/* ══ LOGIN OVERLAY ═════════════════════════════════════════════════ */}
      {loggingIn && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: `linear-gradient(135deg, ${T.greenDeep} 0%, #00502e 50%, ${T.greenDeep} 100%)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
          animation: 'lp-overlay-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          {/* Grain texture */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '180px',
          }} />
          {/* Halos */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(circle at 30% 30%, rgba(232,176,75,0.12), transparent 55%),
                         radial-gradient(circle at 70% 70%, rgba(0,105,62,0.3), transparent 55%)`,
          }} />

          {/* Logo */}
          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: 'rgba(255,255,255,0.95)',
              display: 'grid', placeItems: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              animation: 'lp-logo-float 2.5s ease-in-out infinite',
            }}>
              <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
            </div>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 26, color: '#fff', letterSpacing: '-0.025em', marginBottom: 6 }}>
              Sen Jiwu
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Filière semencière nationale
            </div>
          </div>

          {/* Loader dots */}
          <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 2 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%', background: T.gold,
                animation: `lp-dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>

          {/* Security badge */}
          <div style={{
            position: 'relative', zIndex: 2,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 999,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L10 3v4c0 2-4 4-4 4S2 9 2 7V3L6 1Z" stroke="rgba(255,255,255,0.6)" strokeWidth="1" fill="rgba(255,255,255,0.06)"/>
            </svg>
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em' }}>
              {t.loginOverlayText}
            </span>
          </div>
        </div>
      )}

      {/* ══ HEADER ════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: scrolled ? 'rgba(250,250,247,0.92)' : 'rgba(250,250,247,0.85)',
        backdropFilter: 'saturate(160%) blur(16px)',
        WebkitBackdropFilter: 'saturate(160%) blur(16px)',
        borderBottom: `1px solid ${scrolled ? T.line : 'transparent'}`,
        transition: 'border-color 0.3s, background 0.3s',
      }}>
        <div style={{ ...S.container, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 36 }}>

          {/* Logo */}
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: T.ink }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: `1.5px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
            </div>
            <strong style={{ fontFamily: T.display, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>
              Sen Jiwu
            </strong>
          </a>

          {/* Nav principale */}
          <nav style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
            {([
              [t.navMission,  '#mission'],
              [t.navApercu,   '#apercu'],
              [t.navActeurs,  '#acteurs'],
              [t.navPipeline, '#pipeline'],
              [t.navHowto,    '#howto'],
              [t.navFAQ,      '#faq'],
            ] as [string, string][]).map(([label, href]) => (
              <a key={href} href={href} style={{
                textDecoration: 'none', color: T.ink, fontSize: 14, fontWeight: 500,
                padding: '9px 14px', borderRadius: 8, transition: 'all 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = T.greenSoft)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Switch langue */}
            <div style={{ display: 'flex', background: T.paper2, borderRadius: 8, padding: 3 }}>
              {(['fr', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  background: lang === l ? '#fff' : 'transparent',
                  border: 'none', padding: '6px 10px', cursor: 'pointer',
                  color: lang === l ? T.ink : T.muted,
                  borderRadius: 6, fontFamily: T.mono, fontSize: 11, fontWeight: 500,
                  boxShadow: lang === l ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Bouton connexion */}
            <button onClick={handleLogin} disabled={loggingIn} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10,
              background: loggingIn ? T.greenDeep : T.green,
              color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: loggingIn ? 'default' : 'pointer',
              fontFamily: T.body,
              boxShadow: '0 1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 0.2s',
              opacity: loggingIn ? 0.7 : 1,
            }}
              onMouseEnter={e => { if (!loggingIn) { (e.currentTarget as HTMLButtonElement).style.background = T.greenDeep; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = loggingIn ? T.greenDeep : T.green; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
            >
              {loggingIn ? (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'lp-spin 0.7s linear infinite' }} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M6 2H3a1 1 0 00-1 1v8a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {t.login}
            </button>
          </div>
        </div>
      </header>

      {/* ══ HERO ══════════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden', background: T.paper }}>
        {/* Halos */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(60% 50% at 15% 15%, rgba(0,105,62,0.09), transparent 60%),
                       radial-gradient(50% 40% at 90% 30%, rgba(232,176,75,0.16), transparent 60%),
                       radial-gradient(40% 30% at 50% 100%, rgba(196,69,54,0.07), transparent 60%)`,
        }} />
        {/* Grille */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(rgba(0,105,62,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,105,62,0.035) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }} />

        <div style={{ ...S.container, padding: '72px 28px 100px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>

            {/* Texte */}
            <div>
              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '6px 12px 6px 6px', background: '#fff',
                border: `1px solid ${T.line}`, borderRadius: 999,
                fontSize: 12.5, fontWeight: 500, color: T.muted,
                marginBottom: 28, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}>
                <span style={{
                  background: T.green, color: '#fff', padding: '3px 10px',
                  borderRadius: 999, fontFamily: T.mono, fontSize: 10,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>v0</span>
                {t.heroEyebrow}
              </div>

              {/* Titre */}
              <h1 style={{
                fontFamily: T.display, fontWeight: 600,
                fontSize: 'clamp(40px, 5.5vw, 78px)',
                lineHeight: 1, letterSpacing: '-0.035em',
                color: T.ink, marginBottom: 26,
              }}>
                {t.heroTitle1}<br />
                <span style={{
                  background: `linear-gradient(120deg, ${T.green} 30%, ${T.goldDeep})`,
                  WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  color: 'transparent', fontStyle: 'italic',
                }}>
                  {t.heroTitle2}
                </span>
              </h1>

              <p style={{ fontSize: 18, color: T.muted, maxWidth: 520, marginBottom: 36, lineHeight: 1.6 }}>
                {t.heroDesc}
              </p>

              {/* CTA */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
                <button onClick={handleLogin} disabled={loggingIn} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '13px 24px', borderRadius: 12,
                  background: T.green, color: '#fff', border: 'none',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: T.body,
                  boxShadow: `0 1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.1)`,
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.greenDeep; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 20px rgba(0,105,62,0.28)` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.green; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 1px 0 rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.1)` }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {t.heroCTA}
                </button>
                <a href="#mission" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '13px 22px', borderRadius: 12,
                  color: T.ink, border: `1px solid ${T.line}`, background: 'transparent',
                  fontSize: 15, fontWeight: 500, textDecoration: 'none', fontFamily: T.body,
                  transition: 'all 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.paper2)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {t.heroDemo}
                </a>
              </div>

              {/* Trust logos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, paddingTop: 28, borderTop: `1px solid ${T.line}` }}>
                <span style={{ fontFamily: T.mono, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.muted }}>
                  {t.trustLabel}
                </span>
                <div style={{ display: 'flex', gap: 20, fontFamily: T.display, fontWeight: 600, fontSize: 14, color: T.muted, opacity: 0.7 }}>
                  <span>ISRA</span>
                  <span>CNRA</span>
                  <span>FNRAA</span>
                </div>
              </div>
            </div>

            {/* Dashboard preview */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DashboardPreview />
            </div>

          </div>
        </div>
      </section>

      {/* ══ APERÇU ════════════════════════════════════════════════════════ */}
      <section id="apercu" style={{ padding: '90px 28px', background: T.paper2 }}>
        <div style={S.container}>
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 48px' }}>
            <span style={S.eyebrow}>Aperçu de la plateforme</span>
            <h2 style={S.sectionTitle}>La plateforme en action</h2>
            <p style={{ ...S.sectionDesc, margin: '0 auto' }}>
              Explorez les modules clés — de la traçabilité des lots à la messagerie intégrée.
            </p>
          </div>
          <PlatformPreview />
        </div>
      </section>

      {/* ══ FEATURES ══════════════════════════════════════════════════════ */}
      <section id="mission" style={{ ...S.section, background: '#fff' }}>
        <div style={{ ...S.container }}>
          <div style={{ maxWidth: 700, marginBottom: 64 }}>
            <span style={S.eyebrow}>Mission</span>
            <h2 style={S.sectionTitle}>{t.featTitle}</h2>
            <p style={S.sectionDesc}>{t.featDesc}</p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
          }}>
            {[
              { title: t.f1t, desc: t.f1d, icon: '🌿', color: T.green },
              { title: t.f2t, desc: t.f2d, icon: '✅', color: '#0369a1' },
              { title: t.f3t, desc: t.f3d, icon: '📦', color: T.goldDeep },
              { title: t.f4t, desc: t.f4d, icon: '🛒', color: '#7c3aed' },
              { title: t.f5t, desc: t.f5d, icon: '📊', color: T.greenDeep },
              { title: t.f6t, desc: t.f6d, icon: '💬', color: T.terra },
            ].map((feat) => (
              <FeatureCard key={feat.title} {...feat} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ STATS ═════════════════════════════════════════════════════════ */}
      <section ref={statsRef} style={{ ...S.section, background: T.green, color: '#fff' }}>
        <div style={{ ...S.container, textAlign: 'center' }}>
          <span style={{ ...S.eyebrow, color: 'rgba(255,255,255,0.6)' }}>{t.statsLabel}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, marginTop: 48 }}>
            {[
              { n: 5, suffix: '', label: t.s1l },
              { n: 7, suffix: '', label: t.s2l },
              { n: 100, suffix: '%', label: t.s3l },
              { n: 4, suffix: '', label: t.s4l },
            ].map((s, i) => (
              <StatCard key={i} {...s} active={statsVisible} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ PIPELINE ══════════════════════════════════════════════════════ */}
      <section id="pipeline" style={{ ...S.section }}>
        <div style={{ ...S.container }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 64px' }}>
            <span style={S.eyebrow}>Pipeline</span>
            <h2 style={S.sectionTitle}>{t.pipeTitle}</h2>
            <p style={{ ...S.sectionDesc, margin: '0 auto' }}>{t.pipeDesc}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
            {GENS.map((gen, i) => (
              <div key={gen.code} style={{ display: 'flex', alignItems: 'center' }}>
                <GenCard gen={gen} />
                {i < GENS.length - 1 && (
                  <div style={{ padding: '0 8px', color: T.line }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ROLES ═════════════════════════════════════════════════════════ */}
      <section id="acteurs" style={{ ...S.section, background: '#fff' }}>
        <div style={{ ...S.container }}>
          <div style={{ maxWidth: 640, marginBottom: 64 }}>
            <span style={S.eyebrow}>Acteurs</span>
            <h2 style={S.sectionTitle}>{t.rolesTitle}</h2>
            <p style={S.sectionDesc}>{t.rolesDesc}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20 }}>
            {[
              { title: t.r1t, desc: t.r1d, color: '#0369a1', icon: '🔬', gens: 'G0 / G1' },
              { title: t.r2t, desc: t.r2d, color: '#0f766e', icon: '🏗️', gens: 'G1 → G3' },
              { title: t.r3t, desc: t.r3d, color: '#15803d', icon: '🌾', gens: 'G3 → R2' },
              { title: t.r4t, desc: t.r4d, color: T.goldDeep, icon: '🛒', gens: 'R2' },
              { title: t.r5t, desc: t.r5d, color: '#7c3aed', icon: '⚙️', gens: 'Global' },
            ].map((role) => (
              <RoleCard key={role.title} {...role} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ COMMENT ÇA MARCHE ═════════════════════════════════════════════ */}
      <section id="howto" style={{ ...S.section, background: T.paper }}>
        <div style={{ ...S.container }}>

          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 72px' }}>
            <span style={S.eyebrow}>Fonctionnement</span>
            <h2 style={S.sectionTitle}>{t.howtoTitle}</h2>
            <p style={{ ...S.sectionDesc, margin: '0 auto' }}>{t.howtoDesc}</p>
          </div>

          {/* Steps grid */}
          <div style={{ position: 'relative' }}>

            {/* Connector line (desktop) */}
            <div style={{
              position: 'absolute', top: 44, left: 'calc(12.5% + 44px)', right: 'calc(12.5% + 44px)',
              height: 2,
              backgroundImage: `repeating-linear-gradient(90deg, ${T.line} 0, ${T.line} 8px, transparent 8px, transparent 18px)`,
              pointerEvents: 'none',
            }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, position: 'relative', zIndex: 2 }}>
              {([
                {
                  n: '01', title: t.ht1Title, desc: t.ht1Desc,
                  color: '#0369a1', icon: (
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M11 2a4 4 0 100 8 4 4 0 000-8zM3 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                  ),
                },
                {
                  n: '02', title: t.ht2Title, desc: t.ht2Desc,
                  color: T.greenDeep, icon: (
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <rect x="3" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.7"/>
                      <path d="M7 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                      <circle cx="11" cy="15" r="1.5" fill="currentColor"/>
                    </svg>
                  ),
                },
                {
                  n: '03', title: t.ht3Title, desc: t.ht3Desc,
                  color: T.green, icon: (
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <rect x="2" y="3" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/>
                      <path d="M7 7h8M7 11h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                      <path d="M7 19h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                  ),
                },
                {
                  n: '04', title: t.ht4Title, desc: t.ht4Desc,
                  color: T.goldDeep, icon: (
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path d="M3 17L8 12L12 16L19 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ),
                },
              ] as { n: string; title: string; desc: string; color: string; icon: ReactNode }[]).map((step, i) => (
                <HowToStep key={step.n} step={step} delay={i * 80} />
              ))}
            </div>
          </div>

          {/* CTA inline */}
          <div style={{ textAlign: 'center', marginTop: 64 }}>
            <button onClick={handleLogin} disabled={loggingIn} style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 28px', borderRadius: 12,
              background: T.green, color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: T.body,
              boxShadow: '0 4px 16px rgba(0,105,62,0.22)',
              transition: 'all 0.2s',
            }}
              onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = T.greenDeep; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,105,62,0.3)' }}
              onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = T.green; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,105,62,0.22)' }}
            >
              {t.heroCTA}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

        </div>
      </section>

      {/* ══ CTA ═══════════════════════════════════════════════════════════ */}
      <section style={{ padding: '80px 28px' }}>
        <div style={{ ...S.container }}>
          <div style={{
            background: T.ink, color: '#fff', borderRadius: 24,
            padding: '64px 56px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(circle at 80% 20%, rgba(0,105,62,0.45), transparent 50%),
                           radial-gradient(circle at 20% 100%, rgba(232,176,75,0.18), transparent 50%)`,
            }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: 'clamp(28px, 3vw, 42px)', lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 16 }}>
                {t.ctaTitle}
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.68)', fontSize: 16, marginBottom: 28, lineHeight: 1.65 }}>
                {t.ctaDesc}
              </p>
              <button onClick={handleLogin} disabled={loggingIn} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '13px 24px', borderRadius: 12,
                background: T.gold, color: T.greenDeep,
                border: 'none', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: T.body, transition: 'all 0.2s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.goldDeep; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.gold; (e.currentTarget as HTMLButtonElement).style.color = T.greenDeep }}
              >
                {t.ctaBtn}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            {/* Mockup stat card (droite) */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center' }}>
              <MiniDashCard />
            </div>
          </div>
        </div>
      </section>

      {/* ══ FAQ ═══════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ ...S.section, background: '#fff' }}>
        <div style={{ ...S.container }}>
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 56px' }}>
            <span style={S.eyebrow}>FAQ</span>
            <h2 style={S.sectionTitle}>{t.faqTitle}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
            {([
              [t.q1, t.a1], [t.q2, t.a2], [t.q3, t.a3], [t.q4, t.a4],
            ] as [string, string][]).map(([q, a], i) => (
              <FAQItem key={i} q={q} a={a} open={openFAQ === i} onToggle={() => setOpenFAQ(openFAQ === i ? null : i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════ */}
      <footer style={{ background: T.ink, color: 'rgba(255,255,255,0.65)', padding: '64px 28px 28px' }}>
        <div style={{ ...S.container }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', marginBottom: 18 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(255,255,255,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                  <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
                </div>
                <strong style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: '-0.02em' }}>Sen Jiwu</strong>
              </a>
              <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 300 }}>{t.footerTagline}</p>
              {/* Partenaires */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 12 }}>Partenaires</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ height: 34, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 22, width: 'auto', objectFit: 'contain' }} />
                  </div>
                  <div style={{ height: 34, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <img src="/logo-isra.png" alt="ISRA" style={{ height: 22, filter: 'brightness(0) invert(1)', opacity: 0.75 }} />
                  </div>
                </div>
              </div>
            </div>
            {/* Links */}
            {[
              [t.footerLinks1, [t.fl1, t.fl2, t.fl3]],
              [t.footerLinks2, [t.fl4, t.fl5]],
              [t.footerLinks3, [t.fl6, t.fl7]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <h4 style={{ fontFamily: T.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 18 }}>
                  {title as string}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(links as string[]).map(l => (
                    <a key={l} href="#" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 14, transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                    >
                      {l}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.03em' }}>{t.copyright}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {GENS.map(g => (
                <span key={g.code} style={{ fontFamily: T.mono, fontSize: 9.5, padding: '3px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
                  {g.code}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}

/* ── Sous-composants ───────────────────────────────────────────────────── */

function FeatureCard({ title, desc, icon, color }: { title: string; desc: string; icon: string; color: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        padding: '28px 26px', background: hovered ? '#fff' : T.paper,
        border: `1px solid ${hovered ? color + '40' : T.line}`,
        borderRadius: 16, cursor: 'default',
        transition: 'all 0.25s',
        boxShadow: hovered ? `0 8px 24px rgba(0,0,0,0.06)` : 'none',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: color + '15', display: 'grid', placeItems: 'center',
        fontSize: 20, marginBottom: 18,
        border: `1px solid ${color}20`,
      }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: 17, color: T.ink, marginBottom: 10, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.65 }}>{desc}</p>
    </div>
  )
}

function StatCard({ n, suffix, label, active }: { n: number; suffix: string; label: string; active: boolean }) {
  const val = useCountUp(n, 1400, active)
  return (
    <div>
      <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(40px, 4.5vw, 62px)', lineHeight: 1, letterSpacing: '-0.04em', color: '#fff', marginBottom: 10 }}>
        {val}{suffix}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)' }}>
        {label}
      </div>
    </div>
  )
}

function GenCard({ gen }: { gen: typeof GENS[0] }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        padding: '22px 16px', borderRadius: 16, cursor: 'default',
        background: hovered ? '#fff' : T.paper,
        border: `1.5px solid ${hovered ? gen.color + '50' : T.line}`,
        minWidth: 90,
        transition: 'all 0.22s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 8px 24px rgba(0,0,0,0.07)` : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        fontFamily: T.mono, fontWeight: 600, fontSize: 15,
        color: gen.color, background: gen.bg, padding: '6px 12px',
        borderRadius: 8, border: `1px solid ${gen.color}25`,
        display: 'block',
      }}>
        {gen.code}
      </span>
      <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.3 }}>
        {gen.label}
      </span>
    </div>
  )
}

function RoleCard({ title, desc, color, icon, gens }: { title: string; desc: string; color: string; icon: string; gens: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        padding: '26px 22px', background: hovered ? '#fff' : T.paper,
        border: `1.5px solid ${hovered ? color + '40' : T.line}`,
        borderRadius: 16, cursor: 'default',
        transition: 'all 0.25s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 10px 28px rgba(0,0,0,0.07)` : 'none',
        borderTop: `3px solid ${color}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 24, marginBottom: 14 }}>{icon}</div>
      <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: 16, color: T.ink, marginBottom: 8, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 16 }}>{desc}</p>
      <span style={{
        fontFamily: T.mono, fontSize: 10, color: color,
        background: color + '12', padding: '4px 8px', borderRadius: 6,
        border: `1px solid ${color}25`,
      }}>
        {gens}
      </span>
    </div>
  )
}

function HowToStep({ step, delay }: {
  step: { n: string; title: string; desc: string; color: string; icon: ReactNode }
  delay: number
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: '32px 24px',
        background: hovered ? '#fff' : 'transparent',
        border: `1px solid ${hovered ? step.color + '30' : 'transparent'}`,
        borderRadius: 20,
        transition: 'all 0.28s',
        boxShadow: hovered ? `0 8px 28px rgba(0,0,0,0.06)` : 'none',
        transform: hovered ? 'translateY(-4px)' : 'none',
        animation: `lp-step-in 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Number + icon circle */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: step.color + '10',
          border: `2px solid ${step.color}25`,
          display: 'grid', placeItems: 'center',
          color: step.color,
          transition: 'all 0.28s',
          ...(hovered ? { background: step.color + '18', borderColor: step.color + '45' } : {}),
        }}>
          {step.icon}
        </div>
        {/* Step number badge */}
        <div style={{
          position: 'absolute', bottom: -4, right: -4,
          width: 26, height: 26, borderRadius: '50%',
          background: hovered ? step.color : T.paper2,
          border: `2px solid ${hovered ? step.color : T.line}`,
          color: hovered ? '#fff' : step.color,
          fontFamily: T.mono, fontWeight: 700, fontSize: 10,
          display: 'grid', placeItems: 'center',
          transition: 'all 0.28s',
        }}>
          {step.n}
        </div>
      </div>

      <h3 style={{
        fontFamily: T.display, fontWeight: 600, fontSize: 17,
        color: T.ink, marginBottom: 12, letterSpacing: '-0.01em',
        lineHeight: 1.2,
      }}>
        {step.title}
      </h3>
      <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.7, maxWidth: 220 }}>
        {step.desc}
      </p>
    </div>
  )
}

function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: '#fff', border: `1px solid ${open ? T.green + '40' : T.line}`,
        borderRadius: 14, padding: '22px 24px', cursor: 'pointer',
        transition: 'all 0.22s',
        boxShadow: open ? `0 4px 16px rgba(0,105,62,0.07)` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 16, color: T.ink, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
          {q}
        </span>
        <span style={{
          width: 28, height: 28, borderRadius: '50%',
          background: open ? T.green : T.greenSoft,
          color: open ? '#fff' : T.greenDeep,
          display: 'grid', placeItems: 'center', flexShrink: 0,
          fontSize: 16, fontWeight: 700,
          transition: 'all 0.25s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}>
          +
        </span>
      </div>
      <div style={{
        maxHeight: open ? 300 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s ease, padding 0.35s ease',
        paddingTop: open ? 14 : 0,
        color: T.muted, fontSize: 14, lineHeight: 1.7,
      }}>
        {a}
      </div>
    </div>
  )
}

/* ── Platform preview (tabbed full-app mockup) ───────────────────────── */

const PREVIEW_TABS = [
  { label: 'Tableau de bord', path: 'dashboard' },
  { label: 'Lots semenciers', path: 'lots' },
  { label: 'Stocks',          path: 'stocks' },
  { label: 'Commandes',       path: 'orders' },
  { label: 'Messagerie',      path: 'messages' },
]

const SIDEBAR_NAV = [
  { section: 'Général',    items: ['Tableau de bord'] },
  { section: 'Catalogue',  items: ['Variétés & Espèces', 'Lots semenciers'] },
  { section: 'Logistique', items: ['Stock', 'Commandes'] },
  { section: 'Compte',     items: ['Messages', 'Mon profil'] },
]

const TAB_ACTIVE_ITEM: Record<number, string> = {
  0: 'Tableau de bord',
  1: 'Lots semenciers',
  2: 'Stock',
  3: 'Commandes',
  4: 'Messages',
}

// Micro SVG icons for sidebar
function SvgDash()  { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="7" y="1" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="7" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><rect x="7" y="7" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.3"/></svg> }
function SvgLeaf()  { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 11c1-3 3-6 9-9-3 6-6 8-9 9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg> }
function SvgPkg()   { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1.5" y="3.5" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 6h10M5 3.5V2M8 3.5V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function SvgBox()   { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4.5l4.5-3 4.5 3v4l-4.5 3-4.5-3v-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6.5 1.5v10M2 4.5l4.5 3 4.5-3" stroke="currentColor" strokeWidth="1.3"/></svg> }
function SvgCart()  { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 1.5h1.5l1.5 6h6l1-4H4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="5.5" cy="10.5" r="1" stroke="currentColor" strokeWidth="1.2"/><circle cx="9.5" cy="10.5" r="1" stroke="currentColor" strokeWidth="1.2"/></svg> }
function SvgMsg()   { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M11 7.5a1.5 1.5 0 01-1.5 1.5H4L2 11V3a1.5 1.5 0 011.5-1.5h6A1.5 1.5 0 0111 3v4.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg> }
function SvgUser()  { return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 11c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }

const ITEM_ICON: Record<string, () => JSX.Element> = {
  'Tableau de bord': SvgDash,
  'Variétés & Espèces': SvgLeaf,
  'Lots semenciers': SvgPkg,
  'Stock': SvgBox,
  'Commandes': SvgCart,
  'Messages': SvgMsg,
  'Mon profil': SvgUser,
}

function PlatformPreview() {
  const [tab, setTab] = useState(0)

  return (
    <div>
      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
        {PREVIEW_TABS.map((pt, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
            fontWeight: 500, fontSize: 13.5, fontFamily: T.body,
            border: `1.5px solid ${tab === i ? T.green : T.line}`,
            background: tab === i ? T.green : '#fff',
            color: tab === i ? '#fff' : T.ink,
            transition: 'all 0.18s',
            boxShadow: tab === i ? '0 4px 12px rgba(0,105,62,0.2)' : 'none',
          }}>
            {pt.label}
          </button>
        ))}
      </div>

      {/* Browser frame */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        border: `1px solid ${T.line}`,
        boxShadow: '0 32px 80px -24px rgba(0,61,36,0.18), 0 8px 24px rgba(0,0,0,0.04)',
        background: '#fff',
      }}>
        {/* Browser chrome */}
        <div style={{
          height: 42, background: T.paper2, borderBottom: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
        }}>
          {['#ef4444', '#f59e0b', '#22c55e'].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
          ))}
          <div style={{
            flex: 1, maxWidth: 340, margin: '0 auto',
            height: 24, background: '#fff', borderRadius: 6,
            border: `1px solid ${T.line}`,
            display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="2" stroke={T.muted} strokeWidth="1"/>
              <path d="M3 5h4M5 3v4" stroke={T.muted} strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>
              localhost:5173/{PREVIEW_TABS[tab].path}
            </span>
          </div>
        </div>

        {/* App layout */}
        <div style={{ display: 'flex', height: 520, overflow: 'hidden' }}>

          {/* Sidebar */}
          <div style={{
            width: 176, background: T.greenDeep, flexShrink: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Logo */}
            <div style={{
              padding: '14px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, background: '#fff',
                display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0,
              }}>
                <img src="/SENJIWU.png" alt="" style={{ height: 20, width: 'auto' }} />
              </div>
              <div>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1 }}>Sen Jiwu</div>
                <div style={{ fontFamily: T.mono, fontSize: 8, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filière semencière</div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
              {SIDEBAR_NAV.map(({ section, items }) => (
                <div key={section}>
                  <div style={{ fontFamily: T.mono, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', padding: '8px 12px 4px' }}>
                    {section}
                  </div>
                  {items.map(item => {
                    const active = TAB_ACTIVE_ITEM[tab] === item
                    const Icon = ITEM_ICON[item] || SvgDash
                    return (
                      <div key={item} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px', margin: '1px 6px', borderRadius: 7,
                        background: active ? T.green : 'transparent',
                        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                        fontSize: 12, fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                      }}>
                        <Icon />
                        <span style={{ fontFamily: T.body }}>{item}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </nav>

            {/* User footer */}
            <div style={{
              padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #0c1f15)',
                display: 'grid', placeItems: 'center',
                color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
              }}>AD</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontFamily: T.body, fontSize: 11, color: '#fff', fontWeight: 500, lineHeight: 1.2 }}>Admin ISRA</div>
                <div style={{ fontFamily: T.mono, fontSize: 8.5, color: 'rgba(255,255,255,0.35)' }}>Administrateur</div>
              </div>
            </div>
          </div>

          {/* Main area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Topbar */}
            <div style={{
              height: 48, background: '#fff', borderBottom: `1px solid ${T.line}`,
              display: 'flex', alignItems: 'center', padding: '0 20px',
              justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <span style={{ color: T.muted }}>CNRA</span>
                <span style={{ color: T.line }}>›</span>
                <span style={{ color: T.ink, fontWeight: 500 }}>{PREVIEW_TABS[tab].label}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: T.greenSoft, border: `1px solid ${T.line}` }} />
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #0c1f15)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 9.5, fontWeight: 700 }}>AD</div>
              </div>
            </div>

            {/* Role banner */}
            <div style={{
              height: 32, background: 'rgba(124,58,237,0.05)', borderBottom: '1px solid rgba(124,58,237,0.1)',
              display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0,
            }}>
              <span style={{ background: '#7c3aed', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Administrateur ISRA</span>
              <span style={{ fontSize: 11, color: T.muted }}>Supervision globale — accès complet à toute la plateforme</span>
            </div>

            {/* Page content */}
            <div style={{ flex: 1, overflowY: 'auto', background: T.paper, padding: '18px 20px' }}>
              {tab === 0 && <MockDashboard />}
              {tab === 1 && <MockLots />}
              {tab === 2 && <MockStocks />}
              {tab === 3 && <MockCommandes />}
              {tab === 4 && <MockMessagerie />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Mock content for each tab ────────────────────────────────── */

function MockKpi({ val, label, sub, color }: { val: string; label: string; sub: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: `1px solid ${T.line}` }}>
      <div style={{ fontFamily: T.mono, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 24, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{val}</div>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function GenBadge({ code }: { code: string }) {
  const g = GENS.find(g => g.code === code) || GENS[0]
  return (
    <span style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 600, color: g.color, background: g.bg, padding: '3px 7px', borderRadius: 5, border: `1px solid ${g.color}20` }}>
      {code}
    </span>
  )
}

function StatusBadge({ status }: { status: 'Certifié' | 'En cours' | 'En attente' | 'Livré' | 'Alerte' }) {
  const map: Record<string, { bg: string; color: string }> = {
    'Certifié':   { bg: 'rgba(0,105,62,0.1)',   color: T.green },
    'En cours':   { bg: 'rgba(180,83,9,0.1)',    color: '#b45309' },
    'En attente': { bg: 'rgba(3,105,161,0.1)',   color: '#0369a1' },
    'Livré':      { bg: 'rgba(124,58,237,0.1)',  color: '#7c3aed' },
    'Alerte':     { bg: 'rgba(196,69,54,0.1)',   color: T.terra },
  }
  const s = map[status] || map['En cours']
  return (
    <span style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 600, color: s.color, background: s.bg, padding: '3px 8px', borderRadius: 5 }}>
      {status}
    </span>
  )
}

function MockTable({ cols, rows }: { cols: string[]; rows: (string | JSX.Element)[][] }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${T.line}`, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols.map(() => '1fr').join(' '), borderBottom: `1px solid ${T.line}`, padding: '8px 14px' }}>
        {cols.map(c => (
          <span key={c} style={{ fontFamily: T.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted }}>{c}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols.map(() => '1fr').join(' '), padding: '9px 14px', borderBottom: i < rows.length - 1 ? `1px solid ${T.line}` : 'none', alignItems: 'center' }}>
          {row.map((cell, j) => (
            <div key={j} style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink }}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function MockDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MockKpi val="142" label="Lots actifs"    sub="↑ 12 ce mois"         color={T.green} />
        <MockKpi val="89.3 t" label="Stock total" sub="4 espèces"             color="#0369a1" />
        <MockKpi val="7"   label="Commandes"      sub="3 en attente"          color={T.goldDeep} />
        <MockKpi val="12"  label="En certification" sub="soumis cette semaine" color="#7c3aed" />
      </div>
      {/* Chart */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: `1px solid ${T.line}` }}>
        <div style={{ fontFamily: T.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted, marginBottom: 12 }}>Stock par génération (tonnes)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
          {[
            { code: 'G0', h: 22, qty: '3.1 t' }, { code: 'G1', h: 48, qty: '12 t' },
            { code: 'G2', h: 62, qty: '18 t' }, { code: 'G3', h: 80, qty: '24 t' },
            { code: 'G4', h: 55, qty: '16 t' }, { code: 'R1', h: 38, qty: '10 t' },
            { code: 'R2', h: 26, qty: '6.2 t' },
          ].map(b => {
            const g = GENS.find(g => g.code === b.code)!
            return (
              <div key={b.code} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: T.mono, fontSize: 8, color: T.muted }}>{b.qty}</span>
                <div style={{ width: '100%', height: b.h, background: g.color + 'cc', borderRadius: '4px 4px 0 0', minHeight: 6 }} />
                <span style={{ fontFamily: T.mono, fontSize: 9, color: g.color, fontWeight: 600 }}>{b.code}</span>
              </div>
            )
          })}
        </div>
      </div>
      {/* Recent lots */}
      <MockTable
        cols={['Référence', 'Espèce', 'Génération', 'Quantité', 'Statut']}
        rows={[
          ['LOT-2025-0142', 'Mil Souna', <GenBadge code="G2" />, '12 000 kg', <StatusBadge status="Certifié" />],
          ['LOT-2025-0141', 'Arachide Fleur 11', <GenBadge code="R1" />, '8 500 kg', <StatusBadge status="En cours" />],
          ['LOT-2025-0140', 'Sorgho Fadda', <GenBadge code="G3" />, '6 000 kg', <StatusBadge status="En attente" />],
        ]}
      />
    </div>
  )
}

function MockLots() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 34, background: '#fff', borderRadius: 8, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="3.5" stroke={T.muted} strokeWidth="1.3"/><path d="M8 8l2.5 2.5" stroke={T.muted} strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span style={{ fontFamily: T.body, fontSize: 12, color: T.muted }}>Rechercher un lot…</span>
        </div>
        {['G0/G1', 'G2/G3', 'R1/R2'].map(f => (
          <div key={f} style={{ padding: '6px 12px', borderRadius: 7, background: T.paper2, border: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 10, color: T.muted }}>
            {f}
          </div>
        ))}
        <div style={{ padding: '7px 14px', borderRadius: 8, background: T.green, color: '#fff', fontFamily: T.body, fontSize: 12, fontWeight: 600 }}>
          + Nouveau lot
        </div>
      </div>

      <MockTable
        cols={['Référence', 'Espèce', 'Variété', 'Génération', 'Campagne', 'Quantité', 'Statut']}
        rows={[
          ['LOT-2025-0142', 'Mil', 'Souna 3',    <GenBadge code="G2" />, '2025-2026', '12 000 kg', <StatusBadge status="Certifié" />],
          ['LOT-2025-0141', 'Arachide', 'Fleur 11', <GenBadge code="R1" />, '2025-2026', '8 500 kg', <StatusBadge status="En cours" />],
          ['LOT-2025-0140', 'Sorgho', 'Fadda',    <GenBadge code="G3" />, '2025-2026', '6 000 kg', <StatusBadge status="En attente" />],
          ['LOT-2025-0139', 'Niébé', 'Mouride',   <GenBadge code="G1" />, '2025-2026', '4 200 kg', <StatusBadge status="Certifié" />],
          ['LOT-2025-0138', 'Maïs', 'Hybrid 1',   <GenBadge code="R2" />, '2025-2026', '20 000 kg', <StatusBadge status="Livré" />],
        ]}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>Affichage 1–5 sur 142 lots</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['1', '2', '3', '…', '29'].map((p, i) => (
            <div key={p} style={{ width: 26, height: 26, borderRadius: 6, background: i === 0 ? T.green : '#fff', border: `1px solid ${i === 0 ? T.green : T.line}`, color: i === 0 ? '#fff' : T.ink, display: 'grid', placeItems: 'center', fontFamily: T.mono, fontSize: 10 }}>{p}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockStocks() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MockKpi val="89.3 t"  label="Stock total"     sub="toutes espèces"    color={T.green} />
        <MockKpi val="5"       label="Espèces tracées" sub="en inventaire"     color="#0369a1" />
        <MockKpi val="8"       label="Sites actifs"    sub="ISRA / partenaires" color={T.goldDeep} />
        <MockKpi val="2"       label="Alertes seuil"   sub="↓ sous le minimum" color={T.terra} />
      </div>

      <MockTable
        cols={['Site de stockage', 'Espèce', 'Variété', 'Génération', 'Qté disponible', 'Statut']}
        rows={[
          ['Bambey — CNRA', 'Mil', 'Souna 3', <GenBadge code="G2" />, '12 000 kg', <StatusBadge status="Certifié" />],
          ['Thiès — UPS', 'Arachide', 'Fleur 11', <GenBadge code="R1" />, '8 500 kg', <StatusBadge status="En cours" />],
          ['Kaolack — Mult.', 'Sorgho', 'Fadda', <GenBadge code="G3" />, '6 000 kg', <StatusBadge status="En attente" />],
          ['Saint-Louis — SAED', 'Niébé', 'Mouride', <GenBadge code="G1" />, '3 200 kg', <StatusBadge status="Alerte" />],
        ]}
      />

      {/* Progress bars per site */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: `1px solid ${T.line}` }}>
        <div style={{ fontFamily: T.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted, marginBottom: 12 }}>Couverture par site</div>
        {[
          { site: 'Bambey — CNRA', pct: 82, color: T.green },
          { site: 'Thiès — UPS', pct: 65, color: T.goldDeep },
          { site: 'Kaolack — Mult.', pct: 47, color: '#0369a1' },
          { site: 'Saint-Louis — SAED', pct: 18, color: T.terra },
        ].map(s => (
          <div key={s.site} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: T.ink }}>{s.site}</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, color: s.color }}>{s.pct}%</span>
            </div>
            <div style={{ height: 5, background: T.line, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MockCommandes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${T.line}`, paddingBottom: 0 }}>
        {[
          { label: 'Toutes', count: 31, active: true },
          { label: 'En attente', count: 7, active: false },
          { label: 'Validées', count: 19, active: false },
          { label: 'Livrées', count: 5, active: false },
        ].map(tab => (
          <div key={tab.label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', cursor: 'pointer', borderBottom: tab.active ? `2px solid ${T.green}` : '2px solid transparent',
            fontFamily: T.body, fontSize: 12.5, fontWeight: tab.active ? 600 : 400,
            color: tab.active ? T.green : T.muted,
          }}>
            {tab.label}
            <span style={{ fontFamily: T.mono, fontSize: 9.5, background: tab.active ? T.green : T.paper2, color: tab.active ? '#fff' : T.muted, padding: '1px 6px', borderRadius: 4 }}>
              {tab.count}
            </span>
          </div>
        ))}
      </div>

      <MockTable
        cols={['Référence', 'Variété', 'Quantité', 'Partenaire', 'Date', 'Statut']}
        rows={[
          ['CMD-2026-0031', 'Mil Souna 3 — G3', '5 000 kg', 'Coopérative Saloum', '03/08/2026', <StatusBadge status="En attente" />],
          ['CMD-2026-0030', 'Arachide Fleur 11 — R1', '8 000 kg', 'GIE Thiès Sud', '01/08/2026', <StatusBadge status="Certifié" />],
          ['CMD-2026-0029', 'Sorgho Fadda — G2', '3 200 kg', 'SAED Saint-Louis', '29/07/2026', <StatusBadge status="En cours" />],
          ['CMD-2026-0028', 'Niébé Mouride — R2', '12 000 kg', 'OP Casamance', '27/07/2026', <StatusBadge status="Livré" />],
          ['CMD-2026-0027', 'Maïs Hybrid 1 — R1', '6 500 kg', 'Mult. Louga', '24/07/2026', <StatusBadge status="Livré" />],
        ]}
      />
    </div>
  )
}

function MockMessagerie() {
  const msgs = [
    { from: 'Moussa Diallo', role: 'Multiplicateur', last: 'Lot G3 disponible pour transfert', time: '14:32', unread: 2 },
    { from: 'Fatou Ndiaye', role: 'UPSemCL', last: 'Certification validée pour LOT-0141', time: '11:05', unread: 0 },
    { from: 'Ibrahima Fall', role: 'Quotataire', last: 'Commande de 5 000 kg de Mil', time: 'Hier', unread: 1 },
  ]
  const bubbles = [
    { mine: false, text: 'Bonjour, le lot LOT-2025-0142 est prêt pour certification.', time: '14:28' },
    { mine: true,  text: 'Merci Moussa. Les documents ont bien été reçus. Je lance la procédure de contrôle.', time: '14:30' },
    { mine: false, text: 'Parfait. La quantité disponible est de 12 000 kg — génération G2 certifiée.', time: '14:32' },
    { mine: true,  text: "D'accord, je valide le transfert vers Bambey CNRA.", time: '14:35' },
  ]

  return (
    <div style={{ display: 'flex', height: 340, background: '#fff', borderRadius: 10, border: `1px solid ${T.line}`, overflow: 'hidden' }}>
      {/* Conversation list */}
      <div style={{ width: 220, borderRight: `1px solid ${T.line}`, flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.line}` }}>
          <div style={{ height: 28, background: T.paper, borderRadius: 6, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="4.5" cy="4.5" r="3" stroke={T.muted} strokeWidth="1.2"/><path d="M7 7l2 2" stroke={T.muted} strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span style={{ fontFamily: T.body, fontSize: 11, color: T.muted }}>Rechercher…</span>
          </div>
        </div>
        {msgs.map((m, i) => (
          <div key={i} style={{
            padding: '10px 12px', borderBottom: `1px solid ${T.line}`,
            background: i === 0 ? T.greenSoft : '#fff',
            cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
              <span style={{ fontFamily: T.body, fontSize: 12, fontWeight: 600, color: T.ink }}>{m.from}</span>
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>{m.time}</span>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.green, marginBottom: 3 }}>{m.role}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: T.body, fontSize: 10.5, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{m.last}</span>
              {m.unread > 0 && (
                <span style={{ background: T.green, color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'grid', placeItems: 'center', fontSize: 8.5, fontWeight: 700, flexShrink: 0 }}>{m.unread}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Chat header */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #15803d, #0c1f15)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>MD</div>
          <div>
            <div style={{ fontFamily: T.body, fontSize: 13, fontWeight: 600, color: T.ink }}>Moussa Diallo</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.green }}>Multiplicateur</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bubbles.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: b.mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%', padding: '8px 12px', borderRadius: b.mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: b.mine ? T.green : '#fff',
                border: b.mine ? 'none' : `1px solid ${T.line}`,
                color: b.mine ? '#fff' : T.ink,
                fontSize: 11.5, fontFamily: T.body, lineHeight: 1.5,
              }}>
                {b.text}
                <div style={{ fontFamily: T.mono, fontSize: 8.5, marginTop: 4, color: b.mine ? 'rgba(255,255,255,0.55)' : T.muted, textAlign: 'right' }}>
                  {b.time}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.line}`, display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 32, background: T.paper, borderRadius: 8, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
            <span style={{ fontFamily: T.body, fontSize: 11.5, color: T.muted }}>Écrire un message…</span>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.green, display: 'grid', placeItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Dashboard 3D mockup (Hero) ──────────────────────────────────────── */
function DashboardPreview() {
  return (
    <div style={{
      background: '#fff', borderRadius: 18, border: `1px solid ${T.line}`,
      boxShadow: `0 30px 60px -20px rgba(0,61,36,0.14), 0 8px 20px rgba(0,0,0,0.04)`,
      overflow: 'hidden', width: '100%', maxWidth: 480,
      transform: 'perspective(1200px) rotateY(-3deg) rotateX(2deg)',
      transition: 'transform 0.5s',
    }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'perspective(1200px) rotateY(-1deg) rotateX(0deg)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'perspective(1200px) rotateY(-3deg) rotateX(2deg)')}
    >
      {/* Barre titres */}
      <div style={{ height: 36, background: T.paper2, borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px' }}>
        {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        <div style={{ flex: 1, background: T.line, borderRadius: 4, height: 18, marginLeft: 8 }} />
      </div>

      {/* Sidebar + Content */}
      <div style={{ display: 'flex', height: 280 }}>
        {/* Sidebar */}
        <div style={{ width: 56, background: T.greenDeep, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[T.green, 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)'].map((bg, i) => (
            <div key={i} style={{ width: '100%', height: 28, borderRadius: 6, background: bg }} />
          ))}
        </div>
        {/* Content */}
        <div style={{ flex: 1, padding: '14px 16px', background: T.paper, overflowY: 'hidden' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Lots actifs', val: '142', color: T.green },
              { label: 'En stock', val: '38 t', color: '#0369a1' },
              { label: 'Cmdes', val: '7', color: T.goldDeep },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: `1px solid ${T.line}` }}>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: k.color, letterSpacing: '-0.02em' }}>{k.val}</div>
                <div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k.label}</div>
              </div>
            ))}
          </div>
          {/* Barre chart */}
          <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: `1px solid ${T.line}`, marginBottom: 10 }}>
            <div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Stock par génération</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
              {[
                { h: 30, c: '#7c3aed' }, { h: 45, c: '#0369a1' }, { h: 38, c: '#0f766e' },
                { h: 60, c: '#15803d' }, { h: 52, c: T.goldDeep }, { h: 20, c: T.terra },
              ].map((b, i) => (
                <div key={i} style={{ flex: 1, height: b.h, background: b.c + 'cc', borderRadius: '3px 3px 0 0' }} />
              ))}
            </div>
          </div>
          {/* Tableau mini */}
          <div style={{ background: '#fff', borderRadius: 8, border: `1px solid ${T.line}`, overflow: 'hidden' }}>
            {[
              { esp: 'Mil', gen: 'G2', qty: '12 t', st: T.green },
              { esp: 'Arachide', gen: 'R1', qty: '8.5 t', st: T.goldDeep },
              { esp: 'Sorgho', gen: 'G3', qty: '6 t', st: '#0369a1' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < 2 ? `1px solid ${T.line}` : 'none' }}>
                <span style={{ fontFamily: T.mono, fontSize: 8.5, color: row.st, background: row.st + '15', padding: '2px 5px', borderRadius: 4 }}>{row.gen}</span>
                <span style={{ flex: 1, fontFamily: T.body, fontSize: 9, color: T.ink }}>{row.esp}</span>
                <span style={{ fontFamily: T.mono, fontSize: 8.5, color: T.muted }}>{row.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Mini stat card (CTA section) ───────────────────────────────────── */
function MiniDashCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
      padding: '24px', width: '100%', maxWidth: 320, color: '#fff',
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
        Campagne 2025-2026
      </div>
      {[
        { label: 'Lots certifiés', val: '98', unit: '/142', pct: 69, color: T.greenBright },
        { label: 'Stock couvert', val: '87', unit: '%', pct: 87, color: T.gold },
        { label: 'Commandes livrées', val: '24', unit: '/31', pct: 77, color: '#60a5fa' },
      ].map(item => (
        <div key={item.label} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12.5 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.label}</span>
            <span style={{ fontFamily: T.mono, fontWeight: 600 }}>{item.val}<span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10.5 }}>{item.unit}</span></span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
