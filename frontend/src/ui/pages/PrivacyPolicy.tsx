import { useState } from 'react'
import { keycloak } from '../../lib/keycloak'
import { TL as T } from '../../lib/tokens'

const C = { vert: '#2d6a27', vertFonce: '#1e5220', vertBande: '#1a5e1f', gris: '#f5f6f4', grisBord: '#e4e4e0' } as const
type Lang = 'fr' | 'en'

const LAST_UPDATE = '19 septembre 2026'
const LAST_UPDATE_EN = 'September 19, 2026'

interface Section { title: string; content: string[] }

const SECTIONS: Record<Lang, Section[]> = {
  fr: [
    {
      title: '1. Responsable du traitement',
      content: [
        "Sen Jiwu est opéré par le Centre National de Recherches Agronomiques (CNRA) de Bambey, sous l'égide de l'Institut Sénégalais de Recherches Agricoles (ISRA). Pour toute question relative au traitement de vos données personnelles, contactez-nous à senjiwu1@gmail.com ou au +221 77 758 28 71.",
      ],
    },
    {
      title: '2. Données collectées',
      content: [
        "Nous collectons uniquement les données strictement nécessaires à la gestion de la filière semencière :",
        "• Informations d'identité : nom, prénom, nom d'utilisateur",
        "• Coordonnées professionnelles : email institutionnel, numéro de téléphone (optionnel)",
        "• Données d'appartenance : rôle dans la filière, organisation d'appartenance",
        "• Données d'activité : lots créés ou modifiés, commandes passées, transferts effectués, horodatage des actions (journal d'audit immuable)",
      ],
    },
    {
      title: '3. Finalité du traitement',
      content: [
        "Les données collectées ont pour seule finalité la gestion opérationnelle et la traçabilité de la chaîne semencière nationale, du noyau génétique G0 jusqu'à la semence commerciale R2. Elles ne sont utilisées à aucune fin commerciale, marketing ou statistique externe.",
      ],
    },
    {
      title: '4. Base légale',
      content: [
        "Le traitement de vos données est fondé sur l'exécution d'une mission d'intérêt public (gestion de la filière semencière nationale) et sur la loi sénégalaise n°2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel, ainsi que les textes subséquents relatifs à la Commission de Protection des Données Personnelles (CDP).",
      ],
    },
    {
      title: '5. Durée de conservation',
      content: [
        "• Données de compte actif : conservées pendant toute la durée de l'engagement professionnel de l'utilisateur dans la filière",
        "• Données d'audit trail : conservées pendant 5 ans après la dernière campagne agricole concernée, conformément aux exigences réglementaires de traçabilité semencière",
        "• En cas de clôture de compte : anonymisation des données dans un délai de 30 jours, sauf obligation légale de conservation plus longue",
      ],
    },
    {
      title: '6. Droits des utilisateurs',
      content: [
        "Conformément à la loi n°2008-12, vous disposez des droits suivants sur vos données personnelles :",
        "• Droit d'accès : obtenir une copie des données vous concernant détenues par Sen Jiwu",
        "• Droit de rectification : faire corriger toute information inexacte ou incomplète",
        "• Droit d'opposition : vous opposer au traitement de vos données dans les cas prévus par la loi",
        "• Droit à l'effacement : demander la suppression de votre compte et de vos données non soumises à obligation d'archivage",
        "Pour exercer ces droits, adressez votre demande à senjiwu1@gmail.com. Réponse garantie dans un délai de 30 jours ouvrables.",
      ],
    },
    {
      title: '7. Sécurité des données',
      content: [
        "La protection de vos données est assurée par des mesures techniques et organisationnelles adaptées :",
        "• Authentification centralisée utilisant un protocole OAuth2/OIDC (standard international)",
        "• Contrôle d'accès strict par rôle (RBAC) : chaque utilisateur accède uniquement à son périmètre de données, isolation appliquée côté serveur",
        "• Chiffrement de toutes les communications en transit (HTTPS)",
        "• Journal d'audit immuable de toutes les opérations sur les données certifiées",
      ],
    },
    {
      title: '8. Cookies et traceurs',
      content: [
        "Sen Jiwu n'utilise pas de cookies à des fins publicitaires ou de profilage comportemental. Les seuls traceurs présents sont des cookies techniques strictement fonctionnels, nécessaires au maintien de la session d'authentification. Ils ne collectent aucune donnée personnelle au-delà de l'identifiant de session et expirent à la fermeture du navigateur ou après une période d'inactivité.",
      ],
    },
    {
      title: '9. Absence de partage commercial',
      content: [
        "Vos données personnelles ne sont ni vendues, ni cédées, ni louées à des tiers commerciaux. Elles ne sont accessibles qu'aux agents CNRA/ISRA habilités dans le cadre de la supervision de la filière semencière nationale, et uniquement dans la stricte limite de leurs attributions.",
      ],
    },
    {
      title: '10. Contact et réclamations',
      content: [
        "Pour toute question, demande d'exercice de droits ou réclamation relative à la protection de vos données personnelles :",
        "• Email : senjiwu1@gmail.com",
        "• Téléphone : +221 77 758 28 71",
        "• Adresse : CNRA Bambey, Sénégal",
        "Vous pouvez également saisir la Commission de Protection des Données Personnelles (CDP) du Sénégal en cas de désaccord persistant avec nos réponses.",
      ],
    },
  ],
  en: [
    {
      title: '1. Data Controller',
      content: [
        "Sen Jiwu is operated by the National Centre for Agricultural Research (CNRA) of Bambey, under the authority of the Senegalese Institute of Agricultural Research (ISRA). For any question regarding the processing of your personal data, contact us at senjiwu1@gmail.com or +221 77 758 28 71.",
      ],
    },
    {
      title: '2. Data Collected',
      content: [
        "We collect only the data strictly necessary for the management of the seed chain:",
        "• Identity information: last name, first name, username",
        "• Professional contact: institutional email, phone number (optional)",
        "• Membership data: role in the seed chain, organisation",
        "• Activity data: lots created or modified, orders placed, transfers made, action timestamps (immutable audit log)",
      ],
    },
    {
      title: '3. Purpose of Processing',
      content: [
        "The data collected has the sole purpose of operational management and traceability of the national seed chain, from genetic core G0 to commercial seed R2. It is not used for any commercial, marketing or external statistical purpose.",
      ],
    },
    {
      title: '4. Legal Basis',
      content: [
        "The processing of your data is based on the performance of a public interest mission (management of the national seed chain) and on Senegalese Law No. 2008-12 of 25 January 2008 on the protection of personal data, as well as subsequent texts relating to the Personal Data Protection Commission (CDP).",
      ],
    },
    {
      title: '5. Retention Period',
      content: [
        "• Active account data: retained for the duration of the user's professional engagement in the seed chain",
        "• Audit trail data: retained for 5 years after the last relevant agricultural campaign, in compliance with seed traceability regulatory requirements",
        "• Upon account closure: data anonymisation within 30 days, unless a longer legal retention obligation applies",
      ],
    },
    {
      title: '6. User Rights',
      content: [
        "Under Law No. 2008-12, you have the following rights over your personal data:",
        "• Right of access: obtain a copy of the data held about you by Sen Jiwu",
        "• Right of rectification: correct any inaccurate or incomplete information",
        "• Right to object: object to the processing of your data in the cases provided for by law",
        "• Right to erasure: request deletion of your account and non-archived data",
        "To exercise these rights, send your request to senjiwu1@gmail.com. Response guaranteed within 30 working days.",
      ],
    },
    {
      title: '7. Data Security',
      content: [
        "Your data is protected by appropriate technical and organisational measures:",
        "• Centralised authentication using an OAuth2/OIDC protocol (international standard)",
        "• Strict role-based access control (RBAC): each user accesses only their data perimeter, isolation enforced server-side",
        "• Encryption of all communications in transit (HTTPS)",
        "• Immutable audit log of all operations on certified data",
      ],
    },
    {
      title: '8. Cookies and Trackers',
      content: [
        "Sen Jiwu does not use cookies for advertising or behavioural profiling purposes. The only trackers present are strictly functional technical cookies, necessary for maintaining the authentication session. They collect no personal data beyond the session identifier and expire when the browser is closed or after a period of inactivity.",
      ],
    },
    {
      title: '9. No Commercial Sharing',
      content: [
        "Your personal data is neither sold, transferred, nor rented to commercial third parties. It is only accessible to authorised CNRA/ISRA staff within the framework of national seed chain supervision, and strictly within the limits of their responsibilities.",
      ],
    },
    {
      title: '10. Contact and Complaints',
      content: [
        "For any question, rights request or complaint regarding the protection of your personal data:",
        "• Email: senjiwu1@gmail.com",
        "• Phone: +221 77 758 28 71",
        "• Address: CNRA Bambey, Senegal",
        "You may also contact the Senegalese Personal Data Protection Commission (CDP) if you disagree with our responses.",
      ],
    },
  ],
}

export function PrivacyPolicy() {
  const [lang, setLang]       = useState<Lang>('fr')
  const [loggingIn, setLoggingIn] = useState(false)
  const sections = SECTIONS[lang]

  const handleLogin = () => { setLoggingIn(true); setTimeout(() => keycloak.login(), 650) }

  return (
    <div style={{ fontFamily: T.body, background: '#fff', color: T.ink, overflowX: 'hidden' }}>
      <style>{`@keyframes pp-spin { to { transform: rotate(360deg) } }`}</style>

      {loggingIn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: `linear-gradient(135deg, ${C.vertFonce}, #004d20)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.95)', display: 'grid', placeItems: 'center' }}>
            <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 44, objectFit: 'contain' }} />
          </div>
          <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 22, color: '#fff' }}>Sen Jiwu</div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'pp-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* TOPBAR */}
      <div style={{ background: C.vertBande, color: 'rgba(255,255,255,0.80)', fontSize: 12.5, padding: '8px 28px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>senjiwu1@gmail.com · +221 77 758 28 71</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['fr', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ background: lang === l ? 'rgba(255,255,255,0.18)' : 'transparent', border: 'none', padding: '2px 8px', cursor: 'pointer', color: lang === l ? '#fff' : 'rgba(255,255,255,0.55)', borderRadius: 4, fontFamily: T.mono, fontSize: 10.5, fontWeight: 500 }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* NAVBAR */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: `1px solid ${C.grisBord}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', gap: 16, height: 58 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: C.gris, border: `1px solid ${C.grisBord}`, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 22, objectFit: 'contain' }} />
            </div>
            <strong style={{ fontFamily: T.display, fontWeight: 700, fontSize: 16, color: C.vertFonce, letterSpacing: '-0.02em' }}>Sen Jiwu</strong>
          </a>
          <div style={{ width: 1, height: 18, background: C.grisBord }} />
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: C.vert, background: `${C.vert}10`, padding: '3px 10px', borderRadius: 20, border: `1px solid ${C.vert}22`, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
            {lang === 'fr' ? 'Légal' : 'Legal'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{ textDecoration: 'none', color: T.muted, fontSize: 13.5, fontWeight: 500 }}>
              {lang === 'fr' ? '← Accueil' : '← Home'}
            </a>
            <button onClick={handleLogin} disabled={loggingIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 5, background: C.vert, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: loggingIn ? 'default' : 'pointer', fontFamily: T.body, opacity: loggingIn ? 0.7 : 1 }}>
              {lang === 'fr' ? 'Se connecter' : 'Sign in'}
            </button>
          </div>
        </div>
      </header>

      {/* HEADER DOCUMENT */}
      <div style={{ borderBottom: `1px solid ${C.grisBord}`, padding: '40px 28px 36px', background: C.gris }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <a href="/" style={{ fontSize: 12.5, color: T.muted, textDecoration: 'none' }}>{lang === 'fr' ? 'Accueil' : 'Home'}</a>
            <span style={{ color: '#ccc', fontSize: 12 }}>›</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>{lang === 'fr' ? 'Légal' : 'Legal'}</span>
            <span style={{ color: '#ccc', fontSize: 12 }}>›</span>
            <span style={{ fontSize: 12.5, color: C.vert, fontWeight: 500 }}>{lang === 'fr' ? 'Politique de confidentialité' : 'Privacy policy'}</span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(22px, 3vw, 36px)', color: C.vertFonce, letterSpacing: '-0.02em', marginBottom: 10 }}>
            {lang === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy'}
          </h1>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const }}>
            <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>{lang === 'fr' ? `Dernière mise à jour : ${LAST_UPDATE}` : `Last updated: ${LAST_UPDATE_EN}`}</span>
            <span style={{ fontFamily: T.mono, fontSize: 11.5, color: '#bbb' }}>·</span>
            <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>CNRA Bambey / ISRA Sénégal</span>
            <span style={{ fontFamily: T.mono, fontSize: 11.5, color: '#e57c00', background: 'rgba(229,124,0,0.08)', padding: '1px 8px', borderRadius: 3, border: '1px solid rgba(229,124,0,0.18)' }}>
              {lang === 'fr' ? 'Document provisoire — révision juridique à venir' : 'Provisional document — legal review pending'}
            </span>
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '56px 28px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 64, alignItems: 'start' }}>

          {/* Corps du document */}
          <div>
            <p style={{ fontSize: 15.5, color: T.muted, lineHeight: 1.8, marginBottom: 48, padding: '18px 20px', borderRadius: 8, background: `${C.vert}06`, borderLeft: `3px solid ${C.vert}` }}>
              {lang === 'fr'
                ? "Sen Jiwu s'engage à protéger la vie privée des utilisateurs de la plateforme. La présente politique décrit la nature des données collectées, les modalités de leur traitement et les droits dont vous disposez conformément à la législation sénégalaise."
                : "Sen Jiwu is committed to protecting the privacy of platform users. This policy describes the nature of the data collected, how it is processed, and the rights you have under Senegalese law."}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 40 }}>
              {sections.map((s, i) => (
                <div key={i} style={{ paddingBottom: 40, borderBottom: i < sections.length - 1 ? `1px solid ${C.grisBord}` : 'none' }}>
                  <h2 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, color: C.vertFonce, marginBottom: 16, letterSpacing: '-0.01em' }}>{s.title}</h2>
                  {s.content.map((para, j) => (
                    <p key={j} style={{ fontSize: 14.5, color: para.startsWith('•') ? T.ink : T.muted, lineHeight: 1.8, marginBottom: 8, paddingLeft: para.startsWith('•') ? 8 : 0 }}>
                      {para}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar sommaire */}
          <div style={{ position: 'sticky', top: 78, padding: '20px', background: C.gris, borderRadius: 8, border: `1px solid ${C.grisBord}` }}>
            <p style={{ fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: '#aaa', marginBottom: 14 }}>
              {lang === 'fr' ? 'Sommaire' : 'Contents'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {sections.map((s, i) => (
                <span key={i} style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, cursor: 'default' }}>{s.title}</span>
              ))}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.grisBord}` }}>
              <a href="/terms" style={{ fontSize: 12.5, color: C.vert, textDecoration: 'none', display: 'block', marginBottom: 8 }}>
                {lang === 'fr' ? "→ Conditions d'utilisation" : '→ Terms of use'}
              </a>
              <a href="/documentation" style={{ fontSize: 12.5, color: C.vert, textDecoration: 'none', display: 'block' }}>
                {lang === 'fr' ? '→ Documentation' : '→ Documentation'}
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ background: C.vertFonce, color: 'rgba(255,255,255,0.55)', padding: '36px 28px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.92)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 20, objectFit: 'contain' }} />
            </div>
            <span style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15, color: '#fff' }}>Sen Jiwu</span>
            <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 4px' }}>·</span>
            <span style={{ fontFamily: T.mono, fontSize: 11 }}>{lang === 'fr' ? 'CNRA Bambey / ISRA Sénégal' : 'CNRA Bambey / ISRA Senegal'}</span>
          </div>
          <p style={{ fontFamily: T.mono, fontSize: 10.5 }}>
            {lang === 'fr' ? '© 2026 Sen Jiwu — République du Sénégal. Tous droits réservés.' : '© 2026 Sen Jiwu — Republic of Senegal. All rights reserved.'}
          </p>
        </div>
      </footer>
    </div>
  )
}
