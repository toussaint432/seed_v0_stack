import { useState, useEffect, useRef } from 'react'
import { keycloak } from '../../lib/keycloak'
import { TL as T } from '../../lib/tokens'

import cultivateurBg from '../images/LandingPageImages/cultivateur.jpg'
import stockChampBg  from '../images/LandingPageImages/stock-champ.jpg'
import arachideChamp from '../images/LandingPageImages/arachide_champ.jpg'
import arachideImg   from '../images/LandingPageImages/arachide-3.jpg'
import milImg        from '../images/LandingPageImages/sorgho_nature.jpg'
import sorghoImg     from '../images/LandingPageImages/Sorgho.jpg'
import rizImg        from '../images/LandingPageImages/riz.jpg'
import maisImg       from '../images/LandingPageImages/maïs_2.jpg'
import sesameImg     from '../images/LandingPageImages/Sésame.jpg'
import bleImg        from '../images/LandingPageImages/Blé_2.jpg'
import whatsappIcon  from '../images/LandingPageImages/whatsapp_logo_1.png'

/* ── Palette ISRA institutionnelle ──────────────────────────────────────── */
const C = {
  vert:        '#2d6a27',
  vertFonce:   '#1e5220',
  vertBande:   '#1a5e1f',
  gris:        '#f5f6f4',
  overlayDark: 'rgba(0,0,0,0.52)',
  overlayVert: 'rgba(26,80,30,0.82)',
} as const

/* ── i18n ────────────────────────────────────────────────────────────────── */
type Lang = 'fr' | 'en'

const I18N: Record<Lang, Record<string, string>> = {
  fr: {
    topPhone: '+221 77 758 28 71',
    topEmail: 'senjiwu1@gmail.com',
    topDoc: 'Documentation',
    navMission: 'Mission', navEspeces: 'Espèces', navPipeline: 'Pipeline',
    navActeurs: 'Acteurs', navHowto: 'Fonctionnement', navFAQ: 'FAQ',
    login: 'Se connecter',
    heroEyebrow: 'Plateforme nationale — ISRA / CNRA Bambey',
    heroTitle1: 'La chaîne semencière nationale,',
    heroTitle2: 'numérisée.',
    heroDesc: "Sen Jiwu centralise la traçabilité de chaque lot du G0 génétique jusqu'au R2 commercial — certification intégrée, stocks et pilotage en temps réel.",
    heroCTA: 'Accéder à la plateforme',
    heroScroll: 'En savoir plus',
    missionEyebrow: 'Notre mission',
    missionTitle: 'Assurer la qualité et la traçabilité des semences au Sénégal',
    missionP1: "Sen Jiwu est le système d'information national de la filière semencière. Il numérise l'ensemble de la chaîne — de la sélection variétale à la commercialisation — pour garantir la qualité et l'authenticité des semences certifiées.",
    missionP2: "La plateforme gère les lots générationnels (G0 → R2), la certification officielle, les stocks multi-sites, les commandes entre acteurs et le suivi de campagne agricole.",
    missionB1: 'Traçabilité générationnelle G0 → R2',
    missionB2: 'Certification officielle intégrée',
    missionB3: 'Gestion des stocks multi-sites',
    especesEyebrow: 'Catalogue',
    especesTitle: 'Nos espèces et variétés',
    especesDesc: "L'ensemble des espèces et variétés certifiées disponibles dans la chaîne semencière nationale — du G0 génétique au R2 commercial.",
    espArachide: 'Arachide', espArachideDesc: 'Variétés : 55-437, GH-119-20, Fleur 11, ISRA VB',
    espMil: 'Mil',           espMilDesc: 'Variétés : Souna III, Thialack 2, IBV8004',
    espSorgho: 'Sorgho',     espSorghoDesc: 'Variétés : CE145-66, Faourou, Grinkan',
    espRiz: 'Riz',           espRizDesc: 'Variétés : Sahel 108, Sahel 202, Jaya',
    espMais: 'Maïs',         espMaisDesc: 'Variétés : Nianga 1, EVDT 97, Jaune Précoce',
    espSesame: 'Sésame / Blé', espSesameDesc: 'Variétés : Niger White, Yandev 55',
    statsEyebrow: 'La filière en chiffres',
    s1l: 'Espèces certifiées', s2l: 'Générations tracées',
    s3l: 'Rôles acteurs',      s4l: 'Données certifiées',
    pipeEyebrow: 'Pipeline semencier',
    pipeTitle: 'De la génétique au champ',
    pipeDesc: 'Chaque lot est unique, horodaté et certifié à chaque passage de génération.',
    acteursEyebrow: 'Les acteurs',
    rolesTitle: 'Un rôle pour chaque acteur',
    rolesDesc: "La plateforme s'adapte à chaque profil — chacun voit uniquement ce qui le concerne.",
    r1t: 'Sélectionneur',   r1d: 'Gère les variétés et crée les lots G0 et G1 de pré-base, transférés à l\'UPSemCL.',
    r2t: 'UPSemCL',         r2d: 'Réceptionne les G1 et pilote la multiplication G2 et G3, puis vend les G3 aux multiplicateurs.',
    r3t: 'Multiplicateur',  r3d: 'Reçoit les lots G3 et produit les semences G4, R1 et R2 pour la commercialisation.',
    r4t: 'Quotataire',      r4d: 'Consulte le catalogue R2 certifié et passe commande auprès des multiplicateurs agréés.',
    r5t: 'Directeur CNRA',  r5d: 'Vue décisionnelle globale en lecture seule — pipeline G0→R2, KPIs et statistiques de certification.',
    r6t: 'Administrateur',  r6d: 'Supervision globale de la plateforme, gestion des comptes utilisateurs et des rôles.',
    howtoEyebrow: 'Fonctionnement',
    howtoTitle: 'Comment ça marche ?',
    howtoDesc: "En quatre étapes, de la demande d'accès à la traçabilité complète de votre production semencière.",
    ht1Title: 'Demandez vos accès',
    ht1Desc: "Contactez l'équipe Sen Jiwu — opérée par le CNRA/ISRA — pour obtenir un compte adapté à votre rôle dans la filière.",
    ht2Title: 'Connexion sécurisée',
    ht2Desc: "Connexion via un protocole d'authentification international certifié. Chaque identifiant est personnel et lié à un rôle précis dans la filière.",
    ht3Title: 'Votre espace personnalisé',
    ht3Desc: 'Accédez à un tableau de bord sur mesure selon votre profil : sélectionneur, UPSemCL, multiplicateur, quotataire ou directeur.',
    ht4Title: 'Tracez et certifiez',
    ht4Desc: 'Gérez vos lots G0→R2, certifiez vos productions directement dans la plateforme et générez vos rapports de campagne.',
    ctaTitle: 'Rejoignez la plateforme nationale',
    ctaDesc: "Contactez l'équipe Sen Jiwu pour obtenir vos accès et commencer à tracer votre production semencière dès la prochaine campagne.",
    ctaBtn: 'Demander un accès',
    faqTitle: 'Questions fréquentes',
    q1: 'Qui peut utiliser Sen Jiwu ?',
    a1: "Tout acteur accrédité de la filière semencière nationale : sélectionneurs ISRA/CNRA, l'UPSemCL Bambey, les multiplicateurs agréés, les quotataires et organisations de producteurs. L'accès est nominatif et attribué par l'équipe CNRA/ISRA.",
    q2: 'Comment obtenir un accès ?',
    a2: "Contactez l'équipe Sen Jiwu par email (senjiwu1@gmail.com) ou téléphone (+221 77 758 28 71). Après vérification de votre accréditation, un compte est créé avec le rôle correspondant à votre fonction dans la filière.",
    q3: 'Les données sont-elles sécurisées ?',
    a3: "Oui. L'accès est protégé par un protocole d'authentification international (OAuth2/OIDC). Chaque utilisateur accède uniquement aux données de son périmètre — l'isolation est appliquée côté serveur à chaque requête.",
    q4: 'Quelles espèces agricoles sont couvertes ?',
    a4: "Arachide, Mil, Sorgho, Riz, Maïs et Sésame. Le référentiel variétal est évolutif et peut intégrer de nouvelles espèces en lien avec les programmes de sélection ISRA.",
    q5: "Qu'est-ce que la traçabilité G0 → R2 ?",
    a5: "Chaque semence suit un parcours de 7 générations : du noyau génétique G0 (sélectionneur ISRA/CNRA) jusqu'à la semence commerciale R2 (producteurs). Chaque lot est lié à son lot parent et horodaté — garantissant une traçabilité complète de l'origine à la distribution.",
    q6: 'La plateforme est-elle accessible sur mobile ?',
    a6: "Oui, l'interface est responsive et fonctionne sur navigateur mobile. Une application mobile dédiée avec synchronisation hors-ligne est prévue dans une prochaine version.",
    footerTagline: "Système d'information national de la filière semencière du Sénégal.",
    footerLinks1: 'Plateforme', footerLinks2: 'Légal', footerLinks3: 'Support',
    fl1: 'Tableau de bord', fl2: 'Lots & générations', fl3: 'Stocks & commandes',
    fl4: 'Politique de confidentialité', fl5: "Conditions d'utilisation",
    fl6: 'Documentation', fl7: 'Contact technique',
    copyright: '© 2026 Sen Jiwu — République du Sénégal. Tous droits réservés.',
    loginOverlayText: 'Ouverture de la session sécurisée…',
    waBtn: 'Discuter sur WhatsApp',
  },
  en: {
    topPhone: '+221 77 758 28 71',
    topEmail: 'senjiwu1@gmail.com',
    topDoc: 'Documentation',
    navMission: 'Mission', navEspeces: 'Species', navPipeline: 'Pipeline',
    navActeurs: 'Actors', navHowto: 'How it works', navFAQ: 'FAQ',
    login: 'Sign in',
    heroEyebrow: 'National platform — ISRA / CNRA Bambey',
    heroTitle1: 'The national seed chain,',
    heroTitle2: 'digitalized.',
    heroDesc: 'Sen Jiwu centralises traceability of every lot from genetic G0 to commercial R2 — integrated certification, stock management and real-time monitoring.',
    heroCTA: 'Access the platform',
    heroScroll: 'Learn more',
    missionEyebrow: 'Our mission',
    missionTitle: 'Ensuring seed quality and traceability in Senegal',
    missionP1: "Sen Jiwu is the national information system for the seed industry, developed by ISRA and CNRA Bambey. It digitises the entire chain — from varietal selection to commercialisation — to guarantee the quality and authenticity of certified seeds.",
    missionP2: "The platform covers generational lot management (G0 → R2), official certification, multi-site stocks, orders between actors and agricultural campaign monitoring.",
    missionB1: 'Generational traceability G0 → R2',
    missionB2: 'Integrated official certification',
    missionB3: 'Multi-site stock management',
    especesEyebrow: 'Catalogue',
    especesTitle: 'Our species and varieties',
    especesDesc: "All certified species and varieties available in the national seed chain — from genetic G0 to commercial R2.",
    espArachide: 'Groundnut', espArachideDesc: 'Varieties: 55-437, GH-119-20, Fleur 11, ISRA VB',
    espMil: 'Millet',         espMilDesc: 'Varieties: Souna III, Thialack 2, IBV8004',
    espSorgho: 'Sorghum',     espSorghoDesc: 'Varieties: CE145-66, Faourou, Grinkan',
    espRiz: 'Rice',           espRizDesc: 'Varieties: Sahel 108, Sahel 202, Jaya',
    espMais: 'Maize',         espMaisDesc: 'Varieties: Nianga 1, EVDT 97, Early Yellow',
    espSesame: 'Sesame / Wheat', espSesameDesc: 'Varieties: Niger White, Yandev 55',
    statsEyebrow: 'The industry in figures',
    s1l: 'Certified species', s2l: 'Traced generations',
    s3l: 'Actor roles',       s4l: 'Certified data',
    pipeEyebrow: 'Seed pipeline',
    pipeTitle: 'From genetics to the field',
    pipeDesc: 'Each lot is unique, timestamped and certified at every generation step.',
    acteursEyebrow: 'Actors',
    rolesTitle: 'A role for every actor',
    rolesDesc: 'The platform adapts to each profile — everyone sees only what concerns them.',
    r1t: 'Plant Breeder',   r1d: 'Manages varieties and creates G0 and G1 pre-base lots, transferred to UPSemCL.',
    r2t: 'UPSemCL',         r2d: 'Receives G1 lots, manages G2 and G3 multiplication, then sells G3 to multipliers.',
    r3t: 'Multiplier',      r3d: 'Receives G3 lots and produces G4, R1 and R2 seeds for commercialisation.',
    r4t: 'Quotataire',      r4d: 'Browses the certified R2 catalogue and places orders with approved multipliers.',
    r5t: 'CNRA Director',   r5d: 'Read-only decision dashboard — full G0→R2 pipeline, KPIs and certification statistics.',
    r6t: 'Administrator',   r6d: 'Global platform supervision, user account management and role assignment.',
    howtoEyebrow: 'How it works',
    howtoTitle: 'How does it work?',
    howtoDesc: 'In four steps, from access request to full traceability of your seed production.',
    ht1Title: 'Request access',          ht1Desc: 'Contact the Sen Jiwu team — operated by CNRA/ISRA — to get an account adapted to your role in the national seed industry.',
    ht2Title: 'Secure sign-in',          ht2Desc: 'Sign in via an internationally certified authentication protocol. Each credential is personal and tied to a specific role in the seed chain.',
    ht3Title: 'Your personalised space', ht3Desc: 'Access a tailored dashboard based on your profile: breeder, UPSemCL, multiplier, quotataire or director.',
    ht4Title: 'Trace and certify',       ht4Desc: 'Manage your G0→R2 lots, certify your productions directly within the platform and generate your campaign reports.',
    ctaTitle: 'Join the national platform',
    ctaDesc: 'Contact the Sen Jiwu team to get your credentials and start tracing your seed production for the next campaign.',
    ctaBtn: 'Request access',
    faqTitle: 'Frequently asked questions',
    q1: 'Who can use Sen Jiwu?',
    a1: "Any accredited actor in the national seed chain: ISRA/CNRA breeders, UPSemCL Bambey, approved multipliers, quotataires and producer organisations. Access is personal and granted by the CNRA/ISRA team.",
    q2: 'How do I get access?',
    a2: "Contact the Sen Jiwu team by email (senjiwu1@gmail.com) or phone (+221 77 758 28 71). After verifying your accreditation, an account is created with the role matching your function in the seed chain.",
    q3: 'Is data secure?',
    a3: "Yes. Access is protected by an international authentication protocol (OAuth2/OIDC). Each user only accesses data within their scope — isolation is enforced server-side on every request.",
    q4: 'Which crop species are covered?',
    a4: "Groundnut, Millet, Sorghum, Rice, Maize and Sesame. The variety catalogue is scalable and can include new species in line with ISRA breeding programmes.",
    q5: 'What is G0 → R2 traceability?',
    a5: "Every seed follows a 7-generation journey: from the genetic core G0 (ISRA/CNRA breeder) to the commercial seed R2 (producers). Each lot is linked to its parent lot and timestamped — ensuring full traceability from origin to distribution.",
    q6: 'Is the platform accessible on mobile?',
    a6: "Yes, the interface is responsive and works on mobile browsers. A dedicated mobile application with offline synchronisation is planned for a future version.",
    footerTagline: 'National information system for the Senegalese seed industry.',
    footerLinks1: 'Platform', footerLinks2: 'Legal', footerLinks3: 'Support',
    fl1: 'Dashboard', fl2: 'Lots & generations', fl3: 'Stocks & orders',
    fl4: 'Privacy policy', fl5: 'Terms of use',
    fl6: 'Documentation', fl7: 'Technical contact',
    copyright: '© 2026 Sen Jiwu — Republic of Senegal. All rights reserved.',
    loginOverlayText: 'Opening secure session…',
    waBtn: 'Chat on WhatsApp',
  },
}

/* ── Pipeline générations ────────────────────────────────────────────────── */
const GENS = [
  { code: 'G0', color: '#7c3aed', bg: 'rgba(124,58,237,0.10)', label: 'Génétique' },
  { code: 'G1', color: '#0369a1', bg: 'rgba(3,105,161,0.10)',  label: 'Pré-base' },
  { code: 'G2', color: '#0f766e', bg: 'rgba(15,118,110,0.10)', label: 'Base' },
  { code: 'G3', color: '#15803d', bg: 'rgba(21,128,61,0.10)',  label: 'Certif. C1' },
  { code: 'G4', color: '#b45309', bg: 'rgba(180,83,9,0.10)',   label: 'Certif. C2' },
  { code: 'R1', color: '#c2410c', bg: 'rgba(194,65,12,0.10)',  label: 'Reproductrice' },
  { code: 'R2', color: '#c44536', bg: 'rgba(196,69,54,0.10)',  label: 'Commerciale' },
]

/* ── CountUp hook ────────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1500, active = false) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
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
  const [lang, setLang]           = useState<Lang>('fr')
  const [scrolled, setScrolled]   = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [openFAQ, setOpenFAQ]     = useState<number | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const t = I18N[lang]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 44)
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

  return (
    <div style={{ fontFamily: T.body, background: '#fff', color: T.ink, overflowX: 'hidden' }}>

      {/* ── KEYFRAMES ────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes lp-spin      { to { transform: rotate(360deg) } }
        @keyframes lp-overlay-in{ from { opacity:0;transform:scale(1.02) } to { opacity:1;transform:scale(1) } }
        @keyframes lp-logo-float{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-6px) } }
        @keyframes lp-dot-pulse { 0%,80%,100%{ transform:scale(0);opacity:.4 } 40%{ transform:scale(1);opacity:1 } }
        @keyframes lp-hero-fade { from{ opacity:0;transform:translateY(20px) } to{ opacity:1;transform:none } }
        .lp-nav-link:hover { color: ${C.vert} !important; }
        .lp-esp-card:hover .lp-esp-overlay { opacity: 1 !important; }
        .lp-esp-card:hover img { transform: scale(1.06); }
        .lp-role-card:hover { border-color: ${C.vert}55 !important; box-shadow: 0 6px 20px rgba(45,106,39,0.10) !important; transform: translateY(-3px); }
        .lp-faq-q:hover { color: ${C.vert} !important; }
        @media (max-width: 768px) {
          .lp-mission-grid { flex-direction: column !important; }
          .lp-esp-grid     { grid-template-columns: repeat(2,1fr) !important; }
          .lp-stats-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .lp-gens-wrap    { flex-wrap: wrap !important; justify-content: center !important; }
          .lp-roles-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .lp-steps-grid   { grid-template-columns: 1fr !important; }
          .lp-step-line    { display: none !important; }
          .lp-footer-grid  { grid-template-columns: 1fr !important; }
          .lp-nav-links    { display: none !important; }
        }
        @media (max-width: 480px) {
          .lp-esp-grid   { grid-template-columns: 1fr !important; }
          .lp-roles-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── LOGIN OVERLAY ─────────────────────────────────────────────────── */}
      {loggingIn && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: `linear-gradient(135deg, ${C.vertFonce} 0%, #004d20 50%, ${C.vertFonce} 100%)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
          animation: 'lp-overlay-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.04), transparent 55%)' }} />
          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.95)',
              display: 'grid', placeItems: 'center', margin: '0 auto 20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              animation: 'lp-logo-float 2.5s ease-in-out infinite',
            }}>
              <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
            </div>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 26, color: '#fff', letterSpacing: '-0.025em', marginBottom: 6 }}>Sen Jiwu</div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Filière semencière nationale</div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 2 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: `lp-dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <div style={{
            position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L10 3v4c0 2-4 4-4 4S2 9 2 7V3L6 1Z" stroke="rgba(255,255,255,0.6)" strokeWidth="1" fill="rgba(255,255,255,0.06)"/>
            </svg>
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em' }}>{t.loginOverlayText}</span>
          </div>
        </div>
      )}

      {/* ── TOPBAR VERTE ──────────────────────────────────────────────────── */}
      <div style={{ background: C.vertBande, color: 'rgba(255,255,255,0.85)', fontSize: 12.5, padding: '8px 28px' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="https://wa.me/221777582871" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1C3.24 1 1 3.24 1 6c0 .88.23 1.71.63 2.43L1 11l2.64-.61A5 5 0 006 11c2.76 0 5-2.24 5-5S8.76 1 6 1zm2.47 6.84c-.1.29-.6.55-.83.58-.21.03-.47.04-.76-.05a6.9 6.9 0 01-.69-.26C5.3 7.7 4.6 6.8 4.55 6.72c-.06-.08-.44-.59-.44-1.12 0-.53.28-.79.38-.9.1-.1.21-.13.28-.13h.2c.07 0 .16-.02.25.19l.32.78c.03.07.01.14-.03.2l-.12.14-.12.14c.05.08.22.35.46.56.31.27.57.36.65.4.08.04.13.03.18-.02l.27-.31c.06-.07.12-.06.2-.03l.77.36c.09.04.14.06.16.1.02.04 0 .27-.1.56z" fill="rgba(255,255,255,0.65)"/></svg>
              {t.topPhone}
            </a>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2.5" width="10" height="7" rx="1.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1"/><path d="M1 4l5 3.5L11 4" stroke="rgba(255,255,255,0.7)" strokeWidth="1" strokeLinecap="round"/></svg>
              {t.topEmail}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/documentation" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: 12 }}>{t.topDoc}</a>
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ display: 'flex', gap: 2 }}>
              {(['fr', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  background: lang === l ? 'rgba(255,255,255,0.18)' : 'transparent',
                  border: 'none', padding: '2px 8px', cursor: 'pointer',
                  color: lang === l ? '#fff' : 'rgba(255,255,255,0.6)',
                  borderRadius: 4, fontFamily: T.mono, fontSize: 10.5, fontWeight: 500,
                  transition: 'all 0.15s',
                }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff',
        borderBottom: `1px solid ${scrolled ? '#e0e0e0' : 'transparent'}`,
        boxShadow: scrolled ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 32, height: 64 }}>

          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: T.ink, flexShrink: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: C.gris, border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
            </div>
            <strong style={{ fontFamily: T.display, fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em', color: C.vertFonce }}>Sen Jiwu</strong>
          </a>

          <nav className="lp-nav-links" style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {([
              [t.navMission, '#mission'], [t.navEspeces, '#especes'],
              [t.navPipeline, '#pipeline'], [t.navActeurs, '#acteurs'],
              [t.navHowto, '#howto'], [t.navFAQ, '#faq'],
            ] as [string, string][]).map(([label, href]) => (
              <a key={href} href={href} className="lp-nav-link" style={{
                textDecoration: 'none', color: T.muted, fontSize: 13.5, fontWeight: 500,
                padding: '8px 13px', borderRadius: 6, transition: 'color 0.2s',
              }}>
                {label}
              </a>
            ))}
          </nav>

          <button onClick={handleLogin} disabled={loggingIn} style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 5,
            background: C.vert, color: '#fff', border: 'none',
            fontSize: 13.5, fontWeight: 600, cursor: loggingIn ? 'default' : 'pointer',
            fontFamily: T.body, transition: 'background 0.2s', opacity: loggingIn ? 0.7 : 1,
            flexShrink: 0,
          }}
            onMouseEnter={e => { if (!loggingIn) (e.currentTarget as HTMLButtonElement).style.background = C.vertFonce }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.vert }}
          >
            {loggingIn
              ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'lp-spin 0.7s linear infinite' }} />
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M6 2H3a1 1 0 00-1 1v8a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
            {t.login}
          </button>
        </div>
      </header>

      {/* ══ HERO — photo plein écran ══════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        backgroundImage: `url(${cultivateurBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: C.overlayDark }} />
        <div style={{
          position: 'relative', zIndex: 2, textAlign: 'center',
          maxWidth: 820, padding: '0 28px',
          animation: 'lp-hero-fade 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s both',
        }}>
          <p style={{
            fontFamily: T.mono, fontSize: 12, textTransform: 'uppercase',
            letterSpacing: '0.18em', color: 'rgba(255,255,255,0.70)',
            marginBottom: 20,
          }}>
            {t.heroEyebrow}
          </p>
          <h1 style={{
            fontFamily: T.display, fontWeight: 700,
            fontSize: 'clamp(36px, 5.5vw, 72px)',
            lineHeight: 1.08, letterSpacing: '-0.025em',
            color: '#fff', marginBottom: 28,
            textShadow: '0 2px 12px rgba(0,0,0,0.3)',
          }}>
            {t.heroTitle1}<br />
            <span style={{ color: '#a8d5a2' }}>{t.heroTitle2}</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.82)', lineHeight: 1.65, marginBottom: 40, maxWidth: 640, margin: '0 auto 40px' }}>
            {t.heroDesc}
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleLogin} disabled={loggingIn} style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '14px 30px', borderRadius: 5,
              background: C.vert, color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 600, cursor: loggingIn ? 'default' : 'pointer',
              fontFamily: T.body, transition: 'background 0.2s, transform 0.2s',
              letterSpacing: '0.01em',
            }}
              onMouseEnter={e => { if (!loggingIn) { (e.currentTarget as HTMLButtonElement).style.background = C.vertFonce; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)' } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.vert; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t.heroCTA}
            </button>
            <a href="#mission" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 26px', borderRadius: 5,
              color: '#fff', border: '1.5px solid rgba(255,255,255,0.45)',
              fontSize: 15, fontWeight: 500, textDecoration: 'none', fontFamily: T.body,
              transition: 'border-color 0.2s, background 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.7)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.45)' }}
            >
              {t.heroScroll}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 9l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </div>
        </div>
        {/* Partenaires — bas du hero */}
        <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 24px', borderRadius: 8, background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(8px)' }}>
            <span style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>Partenaires</span>
            <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.80)' }}>CNRA</span>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.80)' }}>UPSemCL Bambey</span>
          </div>
        </div>
      </section>

      {/* ══ MISSION ══════════════════════════════════════════════════════════ */}
      <section id="mission" style={{ background: '#fff', padding: '96px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="lp-mission-grid" style={{ display: 'flex', gap: 72, alignItems: 'center' }}>

            {/* Texte */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <SectionLabel text={t.missionEyebrow} />
              <h2 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(26px, 3.2vw, 42px)', lineHeight: 1.18, color: C.vertFonce, marginBottom: 24, letterSpacing: '-0.02em' }}>
                {t.missionTitle}
              </h2>
              <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.75, marginBottom: 18 }}>{t.missionP1}</p>
              <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.75, marginBottom: 32 }}>{t.missionP2}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[t.missionB1, t.missionB2, t.missionB3].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.vert, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8 9 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontSize: 14.5, color: T.ink, fontWeight: 500 }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo */}
            <div style={{ flexShrink: 0, width: '42%', maxWidth: 480 }}>
              <div style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.14)', aspectRatio: '4/3', position: 'relative' }}>
                <img src={arachideChamp} alt="Champ d'arachides CNRA Bambey" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.55))', padding: '32px 20px 18px' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em' }}>CNRA Bambey — Sénégal</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ ESPÈCES ═══════════════════════════════════════════════════════════ */}
      <section id="especes" style={{ background: C.gris, padding: '96px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <SectionLabel text={t.especesEyebrow} />
            <h2 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(26px, 3.2vw, 42px)', color: C.vertFonce, letterSpacing: '-0.02em', marginBottom: 16 }}>
              {t.especesTitle}
            </h2>
            <p style={{ fontSize: 16, color: T.muted, maxWidth: 560, margin: '0 auto', lineHeight: 1.65 }}>{t.especesDesc}</p>
          </div>
          <div className="lp-esp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { img: arachideImg, name: t.espArachide, desc: t.espArachideDesc },
              { img: milImg,      name: t.espMil,      desc: t.espMilDesc },
              { img: sorghoImg,   name: t.espSorgho,   desc: t.espSorghoDesc },
              { img: rizImg,      name: t.espRiz,      desc: t.espRizDesc },
              { img: maisImg,     name: t.espMais,     desc: t.espMaisDesc },
              { img: sesameImg,   name: t.espSesame,   desc: t.espSesameDesc },
            ].map(({ img, name, desc }) => (
              <EspeceCard key={name} img={img} name={name} desc={desc} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ STATS BANDEAU — photo + overlay ══════════════════════════════════ */}
      <section ref={statsRef} style={{
        position: 'relative',
        backgroundImage: `url(${stockChampBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        padding: '96px 28px',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: C.overlayVert }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <SectionLabel text={t.statsEyebrow} dark />
          <div className="lp-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 48, marginTop: 40 }}>
            {[
              { n: 6,   suffix: '',  label: t.s1l },
              { n: 7,   suffix: '',  label: t.s2l },
              { n: 6,   suffix: '',  label: t.s3l },
              { n: 100, suffix: '%', label: t.s4l },
            ].map((s, i) => (
              <StatBlock key={i} {...s} active={statsVisible} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ PIPELINE ═════════════════════════════════════════════════════════ */}
      <section id="pipeline" style={{ background: '#fff', padding: '96px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 64px' }}>
            <SectionLabel text={t.pipeEyebrow} />
            <h2 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(26px, 3.2vw, 42px)', color: C.vertFonce, letterSpacing: '-0.02em', marginBottom: 16 }}>
              {t.pipeTitle}
            </h2>
            <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.65 }}>{t.pipeDesc}</p>
          </div>
          <div className="lp-gens-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
            {GENS.map((gen, i) => (
              <div key={gen.code} style={{ display: 'flex', alignItems: 'center' }}>
                <GenCard gen={gen} />
                {i < GENS.length - 1 && (
                  <div style={{ padding: '0 6px', color: '#ccc' }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ACTEURS ══════════════════════════════════════════════════════════ */}
      <section id="acteurs" style={{ background: C.gris, padding: '96px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 56px' }}>
            <SectionLabel text={t.acteursEyebrow} />
            <h2 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(26px, 3.2vw, 42px)', color: C.vertFonce, letterSpacing: '-0.02em', marginBottom: 16 }}>
              {t.rolesTitle}
            </h2>
            <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.65 }}>{t.rolesDesc}</p>
          </div>
          <div className="lp-roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {[
              { title: t.r1t, desc: t.r1d, color: '#0369a1',  gens: 'G0 / G1',  icon: roleIconBreeder   },
              { title: t.r2t, desc: t.r2d, color: C.vertFonce, gens: 'G1 → G3',  icon: roleIconUpSemCL  },
              { title: t.r3t, desc: t.r3d, color: C.vert,      gens: 'G3 → R2',  icon: roleIconMult     },
              { title: t.r4t, desc: t.r4d, color: '#b45309',   gens: 'R2',        icon: roleIconQuot     },
              { title: t.r5t, desc: t.r5d, color: '#1d4ed8',   gens: 'Lecture',   icon: roleIconDirecteur},
              { title: t.r6t, desc: t.r6d, color: '#6b21a8',   gens: 'Global',    icon: roleIconAdmin    },
            ].map(role => (
              <div key={role.title} className="lp-role-card" style={{
                background: '#fff', borderRadius: 8, padding: '26px 20px',
                border: `1.5px solid #e8e8e8`,
                borderTop: `3px solid ${role.color}`,
                transition: 'all 0.22s', cursor: 'default',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: role.color + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: role.color }}>
                  {role.icon}
                </div>
                <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: 15, color: T.ink, marginBottom: 8 }}>{role.title}</h3>
                <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 14 }}>{role.desc}</p>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: role.color, background: role.color + '12', padding: '3px 8px', borderRadius: 4, border: `1px solid ${role.color}22` }}>
                  {role.gens}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FONCTIONNEMENT ═══════════════════════════════════════════════════ */}
      <section id="howto" style={{
        background: '#fff',
        padding: '96px 28px',
        backgroundImage: `url(${bleImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.93)' }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 72px' }}>
            <SectionLabel text={t.howtoEyebrow} />
            <h2 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(26px, 3.2vw, 42px)', color: C.vertFonce, letterSpacing: '-0.02em', marginBottom: 16 }}>
              {t.howtoTitle}
            </h2>
            <p style={{ fontSize: 16, color: T.muted, lineHeight: 1.65 }}>{t.howtoDesc}</p>
          </div>
          <div style={{ position: 'relative' }}>
            <div className="lp-step-line" style={{ position: 'absolute', top: 40, left: 'calc(12.5% + 40px)', right: 'calc(12.5% + 40px)', height: 2, backgroundImage: `repeating-linear-gradient(90deg,${C.vert}40 0,${C.vert}40 8px,transparent 8px,transparent 18px)`, pointerEvents: 'none' }} />
            <div className="lp-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32, position: 'relative', zIndex: 2 }}>
              {[
                { n: '01', title: t.ht1Title, desc: t.ht1Desc, color: '#0369a1', icon: stepIconUser   },
                { n: '02', title: t.ht2Title, desc: t.ht2Desc, color: C.vertFonce, icon: stepIconLock },
                { n: '03', title: t.ht3Title, desc: t.ht3Desc, color: C.vert,     icon: stepIconDash  },
                { n: '04', title: t.ht4Title, desc: t.ht4Desc, color: '#b45309',  icon: stepIconCert  },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '28px 20px' }}>
                  <div style={{ position: 'relative', marginBottom: 22 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: step.color + '12', border: `2px solid ${step.color}28`, display: 'grid', placeItems: 'center', color: step.color }}>
                      {step.icon}
                    </div>
                    <div style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: '50%', background: step.color, color: '#fff', fontFamily: T.mono, fontWeight: 700, fontSize: 9.5, display: 'grid', placeItems: 'center' }}>
                      {step.n}
                    </div>
                  </div>
                  <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: 16, color: T.ink, marginBottom: 10, lineHeight: 1.2 }}>{step.title}</h3>
                  <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.7, maxWidth: 210 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 56 }}>
            <button onClick={handleLogin} disabled={loggingIn} style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '13px 28px', borderRadius: 5,
              background: C.vert, color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 600, cursor: loggingIn ? 'default' : 'pointer',
              fontFamily: T.body, transition: 'background 0.2s, transform 0.2s',
            }}
              onMouseEnter={e => { if (!loggingIn) { (e.currentTarget as HTMLButtonElement).style.background = C.vertFonce; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)' } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.vert; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
            >
              {t.heroCTA}
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 7.5h9M8 4l3.5 3.5L8 11" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
      <section style={{ background: C.vert, padding: '96px 28px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <SectionLabel text="Contact" dark />
          <h2 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(26px, 3.5vw, 48px)', color: '#fff', letterSpacing: '-0.025em', marginBottom: 20, lineHeight: 1.12 }}>
            {t.ctaTitle}
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
            {t.ctaDesc}
          </p>
          <button onClick={handleLogin} disabled={loggingIn} style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '15px 34px', borderRadius: 5,
            background: '#fff', color: C.vertFonce, border: 'none',
            fontSize: 15, fontWeight: 700, cursor: loggingIn ? 'default' : 'pointer',
            fontFamily: T.body, transition: 'background 0.2s, transform 0.2s',
          }}
            onMouseEnter={e => { if (!loggingIn) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.88)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {t.ctaBtn}
          </button>
          <div style={{ marginTop: 14 }}>
            <a
              href="https://wa.me/221777582871"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '13px 28px', borderRadius: 5,
                background: 'rgba(255,255,255,0.12)', color: '#fff',
                border: '1.5px solid rgba(255,255,255,0.30)',
                fontSize: 14.5, fontWeight: 600, textDecoration: 'none',
                fontFamily: T.body, transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,0.20)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.55)' }}
              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.30)' }}
            >
              <img src={whatsappIcon} alt="WhatsApp" style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3 }} />
              {t.waBtn}
            </a>
          </div>
        </div>
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ background: '#fff', padding: '96px 28px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <SectionLabel text="FAQ" />
            <h2 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(26px, 3.2vw, 42px)', color: C.vertFonce, letterSpacing: '-0.02em' }}>
              {t.faqTitle}
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {([
              [t.q1, t.a1], [t.q2, t.a2], [t.q3, t.a3],
              [t.q4, t.a4], [t.q5, t.a5], [t.q6, t.a6],
            ] as [string, string][]).map(([q, a], i) => (
              <FAQItem key={i} q={q} a={a} open={openFAQ === i} onToggle={() => setOpenFAQ(openFAQ === i ? null : i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer style={{ background: C.vertFonce, color: 'rgba(255,255,255,0.65)', padding: '64px 28px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="lp-footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
            <div>
              <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 18 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 26, width: 'auto', objectFit: 'contain' }} />
                </div>
                <strong style={{ fontFamily: T.display, fontWeight: 700, fontSize: 17, color: '#fff', letterSpacing: '-0.02em' }}>Sen Jiwu</strong>
              </a>
              <p style={{ fontSize: 13.5, lineHeight: 1.75, maxWidth: 280, marginBottom: 24 }}>{t.footerTagline}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'CNRA', sub: 'Bambey', img: null as string | null },
                  { label: 'UPSemCL', sub: 'Bambey', img: null },
                ].map(p => (
                  <div key={p.label} style={{ height: 42, padding: '0 12px', borderRadius: 6, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    {p.img
                      ? <img src={p.img} alt={p.label} style={{ height: 20, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
                      : <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: 12, letterSpacing: '0.1em', color: '#fff' }}>{p.label}</span>
                    }
                    <span style={{ fontFamily: T.mono, fontSize: 7.5, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const }}>{p.sub}</span>
                  </div>
                ))}
              </div>
            </div>
            {[
              [t.footerLinks1, [t.fl1, t.fl2, t.fl3]],
              [t.footerLinks2, [t.fl4, t.fl5]],
              [t.footerLinks3, [t.fl6, t.fl7]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <h4 style={{ fontFamily: T.mono, fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.38)', marginBottom: 18 }}>
                  {title as string}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {(links as string[]).map(l => (
                    <a key={l} href={l === t.fl4 ? '/privacy-policy' : l === t.fl5 ? '/terms' : l === t.fl6 ? '/documentation' : '#'} style={{ color: 'rgba(255,255,255,0.52)', textDecoration: 'none', fontSize: 13.5, transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.52)')}
                    >{l}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: '0.03em' }}>{t.copyright}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {GENS.map(g => (
                <span key={g.code} style={{ fontFamily: T.mono, fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.30)' }}>{g.code}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Sous-composants
   ══════════════════════════════════════════════════════════════════════════ */

function SectionLabel({ text, dark = false }: { text: string; dark?: boolean }) {
  const line = dark ? 'rgba(255,255,255,0.22)' : `${C.vert}30`
  const txt  = dark ? 'rgba(255,255,255,0.68)' : C.vert
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
      <div style={{ flex: 1, height: 1, background: line }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: txt, textTransform: 'uppercase', letterSpacing: '0.15em', whiteSpace: 'nowrap' }}>
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: line }} />
    </div>
  )
}

function EspeceCard({ img, name, desc }: { img: string; name: string; desc: string }) {
  return (
    <div className="lp-esp-card" style={{ borderRadius: 8, overflow: 'hidden', position: 'relative', aspectRatio: '4/3', cursor: 'default' }}>
      <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease' }} />
      {/* Gradient permanent bas */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.70) 100%)' }} />
      {/* Overlay hover */}
      <div className="lp-esp-overlay" style={{ position: 'absolute', inset: 0, background: C.overlayVert, opacity: 0, transition: 'opacity 0.3s' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 18px', zIndex: 2 }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 18, color: '#fff', marginBottom: 4, letterSpacing: '-0.01em' }}>{name}</h3>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.04em', lineHeight: 1.4 }}>{desc}</p>
      </div>
    </div>
  )
}

function StatBlock({ n, suffix, label, active }: { n: number; suffix: string; label: string; active: boolean }) {
  const val = useCountUp(n, 1400, active)
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 'clamp(38px, 4.5vw, 58px)', lineHeight: 1, letterSpacing: '-0.04em', color: '#fff', marginBottom: 10 }}>
        {val}{suffix}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.60)' }}>
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
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '20px 14px', borderRadius: 10, cursor: 'default',
        background: hovered ? '#fff' : C.gris,
        border: `1.5px solid ${hovered ? gen.color + '55' : '#e0e0e0'}`,
        minWidth: 84,
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 8px 24px rgba(0,0,0,0.08)` : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14, color: gen.color, background: gen.bg, padding: '5px 10px', borderRadius: 6 }}>
        {gen.code}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'center', lineHeight: 1.3 }}>
        {gen.label}
      </span>
    </div>
  )
}

function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ border: `1px solid ${open ? C.vert + '55' : '#e8e8e8'}`, borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.2s', background: '#fff' }}>
      <button className="lp-faq-q" onClick={onToggle} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
        color: open ? C.vert : T.ink, textAlign: 'left', gap: 16, transition: 'color 0.2s',
      }}>
        <span>{q}</span>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, transition: 'transform 0.25s', transform: open ? 'rotate(45deg)' : 'none' }}>
          <path d="M9 4v10M4 9h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 20px 18px', fontSize: 14, color: T.muted, lineHeight: 1.75, borderTop: `1px solid ${C.vert}20` }}>
          {a}
        </div>
      )}
    </div>
  )
}

/* ── SVG icons (rôles) ────────────────────────────────────────────────────── */
const roleIconBreeder  = <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2a4 4 0 100 8 4 4 0 000-8zM3 18c0-3.8 3.1-7 7-7s7 3.2 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const roleIconUpSemCL  = <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="8" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M6 8V6a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="10" cy="13" r="1.5" fill="currentColor"/></svg>
const roleIconMult     = <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 16s1-5 7-5 7 5 7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M10 4C8 4 6 6 6 8s2 4 4 4 4-2 4-4-2-4-4-4z" stroke="currentColor" strokeWidth="1.6"/></svg>
const roleIconQuot     = <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 3h2l2.4 9.6a1 1 0 001 .4H15l2-7H7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8.5" cy="17" r="1.5" fill="currentColor"/><circle cx="14.5" cy="17" r="1.5" fill="currentColor"/></svg>
const roleIconAdmin      = <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M10 7v3l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const roleIconDirecteur  = <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 17V11M7 17V7M11 17V10M15 17V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M2 17h16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".35"/></svg>

/* ── SVG icons (étapes) ──────────────────────────────────────────────────── */
const stepIconUser = <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 2a4 4 0 100 8 4 4 0 000-8zM3 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
const stepIconLock = <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M7 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><circle cx="11" cy="15" r="1.5" fill="currentColor"/></svg>
const stepIconDash = <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="3" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M7 7h8M7 11h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M7 19h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
const stepIconCert = <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 17L8 12L12 16L19 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
