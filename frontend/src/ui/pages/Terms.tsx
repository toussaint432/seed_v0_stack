import { useState } from 'react'
import { keycloak } from '../../lib/keycloak'
import { TL as T } from '../../lib/tokens'

const C = { vert: '#2d6a27', vertFonce: '#1e5220', vertBande: '#1a5e1f', gris: '#f5f6f4', grisBord: '#e4e4e0' } as const
type Lang = 'fr' | 'en'

const LAST_UPDATE    = '19 septembre 2026'
const LAST_UPDATE_EN = 'September 19, 2026'

interface Section { title: string; content: string[] }

const SECTIONS: Record<Lang, Section[]> = {
  fr: [
    {
      title: "1. Objet et champ d'application",
      content: [
        "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme Sen Jiwu, système d'information national de gestion de la chaîne semencière agricole, opéré par le Centre National de Recherches Agronomiques (CNRA) de Bambey sous l'égide de l'Institut Sénégalais de Recherches Agricoles (ISRA).",
        "Toute connexion à la plateforme, qu'elle soit directe ou via un système tiers autorisé, vaut acceptation intégrale et sans réserve des présentes CGU dans leur version en vigueur.",
      ],
    },
    {
      title: '2. Accès et compte utilisateur',
      content: [
        "L'accès à Sen Jiwu est strictement réservé aux acteurs accrédités de la filière semencière nationale : sélectionneurs ISRA/CNRA, structures de multiplication (UPSemCL), multiplicateurs agréés, quotataires et organisations de producteurs, ainsi que le personnel de direction et d'administration CNRA.",
        "Les comptes sont créés exclusivement par l'administrateur de la plateforme, sur accréditation formelle du CNRA/ISRA. Aucun auto-enregistrement n'est possible.",
        "Les identifiants de connexion sont strictement personnels, nominatifs et non transférables. Tout partage d'identifiants, toute connexion depuis un compte appartenant à un tiers, ou toute tentative de contournement du système d'authentification entraîne la suspension immédiate du compte concerné et peut faire l'objet de poursuites.",
      ],
    },
    {
      title: "3. Obligations de l'utilisateur",
      content: [
        "En accédant à Sen Jiwu, l'utilisateur s'engage à :",
        "• Utiliser la plateforme exclusivement dans le cadre de son activité professionnelle dans la filière semencière",
        "• Saisir des données exactes, complètes et conformes à la réalité des opérations réalisées",
        "• Ne pas tenter d'accéder aux données, lots, stocks ou commandes d'autres utilisateurs ou organisations",
        "• Signaler immédiatement à senjiwu1@gmail.com toute anomalie, erreur critique ou suspicion de compromission de compte",
        "• Ne pas introduire dans le système de données fausses, modifiées ou de nature à altérer l'intégrité de la traçabilité semencière nationale",
        "• Respecter la confidentialité des informations auxquelles son rôle lui donne accès",
      ],
    },
    {
      title: '4. Données et traçabilité',
      content: [
        "Toute saisie, modification ou action réalisée dans Sen Jiwu est automatiquement journalisée dans un audit trail immuable : horodatage UTC, identifiant de l'auteur, valeur avant et après modification.",
        "Ce journal constitue la preuve officielle et opposable des opérations semencières réalisées sur la plateforme. L'utilisateur est informé que ses actions l'engagent professionnellement et peuvent être produites comme éléments de preuve dans le cadre de contrôles ISRA ou de litiges relatifs à la certification semencière.",
        "Un lot confirmé est définitivement verrouillé et ne peut plus être modifié. Cette mesure garantit l'intégrité des données certifiées et est conforme aux exigences des organismes de certification agricole.",
      ],
    },
    {
      title: '5. Propriété intellectuelle',
      content: [
        "La plateforme Sen Jiwu, son interface, son architecture logicielle, ses algorithmes de traçabilité, ses modèles de données et l'ensemble des contenus générés par le système sont la propriété intellectuelle de l'ISRA / CNRA Sénégal.",
        "Toute reproduction, extraction, adaptation, modification ou réutilisation non expressément autorisée par écrit par l'ISRA/CNRA est interdite et passible de poursuites conformément à la législation sénégalaise sur la propriété intellectuelle et aux conventions internationales applicables.",
      ],
    },
    {
      title: '6. Disponibilité du service',
      content: [
        "Sen Jiwu vise une disponibilité maximale du service. Des interruptions planifiées (maintenance, mises à jour) peuvent survenir et sont communiquées aux utilisateurs via la messagerie interne de la plateforme avec un préavis minimum de 48 heures, sauf urgence technique.",
        "L'ISRA/CNRA ne saurait être tenu responsable des interruptions de service dues à des facteurs indépendants de sa volonté, notamment : coupures d'alimentation électrique, défaillances de fournisseur internet, actes de malveillance extérieure (cyberattaques), catastrophes naturelles ou tout autre cas de force majeure.",
      ],
    },
    {
      title: '7. Responsabilités',
      content: [
        "L'ISRA/CNRA met tout en œuvre pour assurer la fiabilité, la sécurité et l'exactitude des données traitées par la plateforme. Toutefois, la responsabilité de l'institution ne saurait être engagée pour :",
        "• Les erreurs de saisie ou omissions commises par les utilisateurs",
        "• Les décisions commerciales, agronomiques ou administratives prises sur la base des données affichées",
        "• Les pertes indirectes résultant d'une indisponibilité temporaire du service",
        "• Les conséquences d'une utilisation non conforme aux présentes CGU",
        "L'utilisateur est seul responsable de l'exactitude des données qu'il saisit et de l'usage qu'il fait des informations auxquelles il accède.",
      ],
    },
    {
      title: '8. Droit applicable et juridiction',
      content: [
        "Les présentes CGU sont régies et interprétées conformément au droit sénégalais, notamment la loi n°2008-08 sur les transactions électroniques et la loi n°2008-12 sur la protection des données personnelles.",
        "En cas de litige relatif à l'interprétation ou à l'exécution des présentes CGU, les parties s'engagent à rechercher une solution amiable dans un délai de 30 jours avant tout recours judiciaire. À défaut de résolution amiable, la juridiction compétente sera le Tribunal de Grande Instance de Dakar, Sénégal.",
      ],
    },
    {
      title: '9. Modifications des conditions',
      content: [
        "L'ISRA/CNRA se réserve le droit de modifier les présentes CGU à tout moment, notamment en cas d'évolution législative ou fonctionnelle de la plateforme.",
        "Les utilisateurs seront notifiés de toute modification substantielle lors de leur prochaine connexion, avec affichage des changements. La poursuite de l'utilisation de la plateforme après notification vaut acceptation des conditions révisées.",
        "La version en vigueur est toujours consultable sur cette page. Date de dernière mise à jour : " + LAST_UPDATE + ".",
      ],
    },
  ],
  en: [
    {
      title: '1. Purpose and Scope',
      content: [
        "These Terms of Use govern access to and use of the Sen Jiwu platform, the national information system for agricultural seed chain management, operated by the National Centre for Agricultural Research (CNRA) of Bambey under the authority of the Senegalese Institute of Agricultural Research (ISRA).",
        "Any connection to the platform, whether direct or via an authorised third-party system, constitutes full and unconditional acceptance of these Terms of Use in their current version.",
      ],
    },
    {
      title: '2. Access and User Account',
      content: [
        "Access to Sen Jiwu is strictly reserved for accredited actors in the national seed chain: ISRA/CNRA breeders, multiplication structures (UPSemCL), approved multipliers, quotataires and producer organisations, as well as CNRA management and administration staff.",
        "Accounts are created exclusively by the platform administrator, upon formal accreditation from CNRA/ISRA. No self-registration is possible.",
        "Login credentials are strictly personal, named and non-transferable. Any sharing of credentials, any connection from an account belonging to a third party, or any attempt to circumvent the authentication system will result in the immediate suspension of the account concerned and may be subject to legal proceedings.",
      ],
    },
    {
      title: '3. User Obligations',
      content: [
        "By accessing Sen Jiwu, the user agrees to:",
        "• Use the platform exclusively in the context of their professional activity in the seed chain",
        "• Enter data that is accurate, complete and consistent with the reality of operations carried out",
        "• Not attempt to access data, lots, stocks or orders belonging to other users or organisations",
        "• Immediately report to senjiwu1@gmail.com any anomaly, critical error or suspected account compromise",
        "• Not introduce false or altered data that could compromise the integrity of national seed traceability",
        "• Respect the confidentiality of information to which their role gives them access",
      ],
    },
    {
      title: '4. Data and Traceability',
      content: [
        "Any entry, modification or action performed in Sen Jiwu is automatically logged in an immutable audit trail: UTC timestamp, author identifier, value before and after modification.",
        "This log constitutes the official and enforceable evidence of seed operations carried out on the platform. Users are informed that their actions bind them professionally and may be produced as evidence in ISRA inspections or disputes relating to seed certification.",
        "A confirmed lot is permanently locked and can no longer be modified. This measure guarantees the integrity of certified data and complies with the requirements of agricultural certification bodies.",
      ],
    },
    {
      title: '5. Intellectual Property',
      content: [
        "The Sen Jiwu platform, its interface, software architecture, traceability algorithms, data models and all content generated by the system are the intellectual property of ISRA / CNRA Senegal.",
        "Any reproduction, extraction, adaptation, modification or reuse not expressly authorised in writing by ISRA/CNRA is prohibited and subject to prosecution under Senegalese intellectual property legislation and applicable international conventions.",
      ],
    },
    {
      title: '6. Service Availability',
      content: [
        "Sen Jiwu aims for maximum service availability. Planned interruptions (maintenance, updates) may occur and will be communicated to users via the platform's internal messaging system with a minimum of 48 hours' notice, except in cases of technical emergency.",
        "ISRA/CNRA cannot be held responsible for service interruptions due to factors beyond its control, including: power outages, internet provider failures, external malicious acts (cyberattacks), natural disasters or any other force majeure event.",
      ],
    },
    {
      title: '7. Liability',
      content: [
        "ISRA/CNRA makes every effort to ensure the reliability, security and accuracy of the data processed by the platform. However, the institution cannot be held liable for:",
        "• Data entry errors or omissions made by users",
        "• Commercial, agronomic or administrative decisions made on the basis of the data displayed",
        "• Indirect losses resulting from temporary service unavailability",
        "• Consequences of use that does not comply with these Terms of Use",
        "The user is solely responsible for the accuracy of the data they enter and for the use they make of the information they access.",
      ],
    },
    {
      title: '8. Applicable Law and Jurisdiction',
      content: [
        "These Terms of Use are governed by and interpreted in accordance with Senegalese law, in particular Law No. 2008-08 on electronic transactions and Law No. 2008-12 on the protection of personal data.",
        "In the event of a dispute relating to the interpretation or performance of these Terms of Use, the parties agree to seek an amicable solution within 30 days before any legal proceedings. Failing amicable resolution, the competent court will be the Tribunal de Grande Instance de Dakar, Senegal.",
      ],
    },
    {
      title: '9. Amendments',
      content: [
        "ISRA/CNRA reserves the right to amend these Terms of Use at any time, particularly in the event of legislative or functional changes to the platform.",
        "Users will be notified of any material change upon their next login, with the changes displayed. Continued use of the platform after notification constitutes acceptance of the revised terms.",
        "The current version is always available on this page. Last updated: " + LAST_UPDATE_EN + ".",
      ],
    },
  ],
}

export function Terms() {
  const [lang, setLang]       = useState<Lang>('fr')
  const [loggingIn, setLoggingIn] = useState(false)
  const sections = SECTIONS[lang]

  const handleLogin = () => { setLoggingIn(true); setTimeout(() => keycloak.login(), 650) }

  return (
    <div style={{ fontFamily: T.body, background: '#fff', color: T.ink, overflowX: 'hidden' }}>
      <style>{`@keyframes terms-spin { to { transform: rotate(360deg) } }`}</style>

      {loggingIn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: `linear-gradient(135deg, ${C.vertFonce}, #004d20)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.95)', display: 'grid', placeItems: 'center' }}>
            <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 44, objectFit: 'contain' }} />
          </div>
          <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 22, color: '#fff' }}>Sen Jiwu</div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'terms-spin 0.7s linear infinite' }} />
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
            <span style={{ fontSize: 12.5, color: C.vert, fontWeight: 500 }}>{lang === 'fr' ? "Conditions d'utilisation" : 'Terms of use'}</span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 700, fontSize: 'clamp(22px, 3vw, 36px)', color: C.vertFonce, letterSpacing: '-0.02em', marginBottom: 10 }}>
            {lang === 'fr' ? "Conditions Générales d'Utilisation" : 'Terms of Use'}
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
                ? "L'utilisation de Sen Jiwu implique l'acceptation des présentes conditions. Ces CGU définissent les droits et obligations de chaque utilisateur dans le cadre de la gestion nationale de la filière semencière du Sénégal."
                : "Use of Sen Jiwu implies acceptance of these terms. These Terms of Use define the rights and obligations of each user within the framework of national management of the Senegalese seed chain."}
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
              <a href="/privacy-policy" style={{ fontSize: 12.5, color: C.vert, textDecoration: 'none', display: 'block', marginBottom: 8 }}>
                {lang === 'fr' ? '→ Politique de confidentialité' : '→ Privacy policy'}
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
