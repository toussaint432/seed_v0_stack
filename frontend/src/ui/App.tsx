import React, { useEffect, useRef, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Leaf, Package, BarChart2,
  Users as UsersIcon, CircleUser, Bell, Search, Menu, LogOut, ChevronRight,
  Activity, Warehouse, ShoppingCart, ArrowRightLeft, Shield,
  Calendar, MapPin, Workflow, Server, Store, MessageCircle,
  Sun, Moon, Monitor, X, FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { initKeycloak, keycloak } from '../lib/keycloak'
import { LandingPage }    from './pages/LandingPage'
import { Varieties }      from './pages/Varieties'
import { Lots }           from './pages/Lots'
import { Stocks }         from './pages/Stocks'
import { Orders }         from './pages/Orders'
import { Dashboard }      from './pages/Dashboard'
import { Transfers }      from './pages/Transfers'
import { Campagnes }      from './pages/Campagnes'
import { Sites }          from './pages/Sites'
import { MesSites }       from './pages/MesSites'
import { Programs }       from './pages/Programs'
import { Profile }          from './pages/Profile'
import { Users }            from './pages/Users'
import { CataloguePublic }  from './pages/CataloguePublic'
import { Messages }            from './pages/Messages'
import { Certifications }      from './pages/Certifications'
import { DirecteurDashboard }  from './pages/DirecteurDashboard'
import { Factures }             from './pages/Factures'
type Page =
  | 'dashboard' | 'varieties' | 'lots' | 'stocks' | 'orders'
  | 'certifications' | 'transfers' | 'campagnes' | 'sites'
  | 'mes-sites' | 'programs' | 'profile' | 'users' | 'catalogue'
  | 'messages' | 'directeur' | 'factures'

/* ── Auth helpers ── */
function getUserRoles(): string[] {
  const token = keycloak.tokenParsed as any
  return token?.realm_access?.roles || []
}

function getUserInfo() {
  const token = keycloak.tokenParsed as any
  if (!token) return { name: 'Utilisateur', role: 'Connecté', initials: 'U', roleKey: '', roleColor: '#6b7280', userSpecialisation: null as string | null }
  const name  = token.preferred_username || token.name || 'Utilisateur'
  const roles = getUserRoles()
  const roleMap: Record<string, { label: string; color: string }> = {
    'seed-admin':         { label: 'Administrateur ISRA', color: '#7c3aed' },
    'seed-directeur':     { label: 'Directeur CNRA',      color: '#1d4ed8' },
    'seed-selector':      { label: 'Sélectionneur',       color: '#0369a1' },
    'seed-upsemcl':        { label: 'UPSemCL',             color: '#0f766e' },
    'seed-multiplicator': { label: 'Multiplicateur',      color: '#15803d' },
    'seed-quotataire':    { label: 'Quotataire / OP',     color: '#b45309' },
  }
  const roleKey  = Object.keys(roleMap).find(r => roles.includes(r)) || ''
  const roleInfo = roleMap[roleKey] || { label: 'Utilisateur', color: '#6b7280' }
  const userSpecialisation: string | null = token.specialisation ?? null
  return { name, role: roleInfo.label, roleColor: roleInfo.color, initials: name.slice(0, 2).toUpperCase(), roleKey, userSpecialisation }
}

/* ── Nav config par rôle ── */
type NavSection = { section: string; items: NavItem[] }
type NavItem = { id: Page; label: string; icon: LucideIcon; badge?: string }

function getNavSections(roleKey: string): NavSection[] {
  // Éléments communs
  const dashboard:      NavItem = { id: 'dashboard',      label: 'Tableau de bord',        icon: LayoutDashboard }
  const varieties:      NavItem = { id: 'varieties',      label: 'Variétés & Espèces',     icon: Leaf }
  const lots:           NavItem = { id: 'lots',           label: 'Lots semenciers',         icon: Package }
  const stocks:         NavItem = { id: 'stocks',         label: 'Stock',                   icon: Warehouse }
  const orders:         NavItem = { id: 'orders',         label: 'Commandes',               icon: ShoppingCart }
  const certifications: NavItem = { id: 'certifications', label: 'Contrôle & Certif.',      icon: Shield }
  const transfers:      NavItem = { id: 'transfers',      label: 'Transferts',              icon: ArrowRightLeft }
  const programs:       NavItem = { id: 'programs',       label: 'Programmes',              icon: Workflow }
  const campagnes:      NavItem = { id: 'campagnes',      label: 'Campagnes',               icon: Calendar }
  const sites:          NavItem = { id: 'sites',          label: 'Sites',                   icon: MapPin }
  const mesSites:       NavItem = { id: 'mes-sites',      label: 'Mes Sites',               icon: MapPin }
  const factures:       NavItem = { id: 'factures',       label: 'Factures',                icon: FileText }

  const users:          NavItem = { id: 'users',          label: 'Utilisateurs',            icon: UsersIcon }
  switch (roleKey) {
    case 'seed-admin':
      return [
        { section: 'Général',        items: [dashboard] },
        { section: 'Catalogue',      items: [varieties, { ...lots, label: 'Lots & Générations' }] },
        { section: 'Production',     items: [programs, certifications, transfers] },
        { section: 'Logistique',     items: [stocks, orders, factures] },
        { section: 'Référentiels',   items: [campagnes, sites] },
        { section: 'Administration', items: [users] },
      ]

    case 'seed-selector':
      return [
        { section: 'Général',        items: [dashboard] },
        { section: 'Recherche',      items: [varieties, { ...lots, label: 'Lots G0/G1' }] },
        { section: 'Production',     items: [programs] },
        { section: 'Gestion',        items: [stocks, transfers] },
        { section: 'Communication',  items: [{ id: 'messages' as Page, label: 'Messages', icon: MessageCircle }] },
      ]

    case 'seed-upsemcl':
      return [
        { section: 'Général',        items: [dashboard] },
        { section: 'Référentiel',    items: [{ ...varieties, label: 'Variétés & Espèces' }] },
        { section: 'Multiplication', items: [{ ...lots, label: 'Lots G1→G3' }, programs] },
        { section: 'Gestion',        items: [stocks, certifications, transfers, orders, factures] },
        { section: 'Communication',  items: [{ id: 'messages' as Page, label: 'Messages', icon: MessageCircle }] },
      ]

    case 'seed-multiplicator':
      return [
        { section: 'Général',        items: [dashboard] },
        { section: 'Référentiel',    items: [{ ...varieties, label: 'Variétés & Espèces' }] },
        { section: 'Production',     items: [{ ...lots, label: 'Catalogue & Lots' }, programs] },
        { section: 'Logistique',     items: [stocks, certifications, transfers, orders, factures] },
        { section: 'Mes Données',    items: [mesSites] },
        { section: 'Communication',  items: [{ id: 'messages' as Page, label: 'Messages', icon: MessageCircle }] },
      ]

    case 'seed-quotataire':
      return [
        { section: 'Général',        items: [dashboard] },
        { section: 'Référentiel',    items: [{ ...varieties, label: 'Variétés & Espèces' }, { id: 'catalogue' as Page, label: 'Catalogue R1/R2', icon: Store }] },
        { section: 'Commandes',      items: [orders, factures, { id: 'messages' as Page, label: 'Messages', icon: MessageCircle }] },
        { section: 'Logistique',     items: [stocks, transfers, { ...lots, label: 'Semences reçues' }] },
        { section: 'Mes Données',    items: [mesSites] },
      ]

    case 'seed-directeur':
      return [
        { section: 'Décision', items: [
          { id: 'dashboard' as Page, label: 'Tableau de bord',     icon: LayoutDashboard },
          { id: 'lots'      as Page, label: 'Lots semenciers',    icon: Package },
          { id: 'varieties' as Page, label: 'Variétés & Espèces', icon: Leaf },
          { id: 'stocks'    as Page, label: 'Stocks',             icon: Warehouse },
        ]},
      ]

    default:
      return [
        { section: 'Navigation', items: [dashboard, varieties, lots, stocks, orders] },
      ]
  }
}

const pageTitle: Record<Page, { title: string; sub: string }> = {
  dashboard:      { title: 'Tableau de bord',             sub: "Vue d'ensemble de la campagne" },
  varieties:      { title: 'Variétés & Espèces',          sub: 'Catalogue des semences certifiées' },
  lots:           { title: 'Lots de semences',             sub: 'Suivi des générations G0 → R2' },
  stocks:         { title: 'Inventaire stock',             sub: 'Disponibilité par site de stockage' },
  orders:         { title: 'Commandes',                    sub: 'Suivi et gestion des commandes' },
  certifications: { title: 'Contrôle & Certification',     sub: 'Certification des lots multiplicateurs — validation UPSemCL/Admin' },
  transfers:      { title: 'Transferts',                   sub: 'Transferts inter-organisations de semences' },
  campagnes:      { title: 'Campagnes agricoles',          sub: 'Gestion des campagnes de production' },
  sites:          { title: 'Sites',                        sub: 'Sites de stockage et production — vue globale' },
  'mes-sites':    { title: 'Mes Sites',                    sub: 'Vos sites de stockage et de multiplication' },
  programs:       { title: 'Programmes de multiplication', sub: 'Planification et suivi des multiplications' },
  profile:        { title: 'Mon profil',                   sub: 'Informations et paramètres de votre compte' },
  users:          { title: 'Gestion des utilisateurs',     sub: 'Comptes et rôles de la plateforme' },
  catalogue:      { title: 'Catalogue des semences',       sub: 'Stocks R1/R2 disponibles chez les multiplicateurs' },
  messages:       { title: 'Messagerie',                   sub: 'Conversations directes avec vos partenaires' },
  directeur:      { title: 'Tableau de bord',               sub: 'Indicateurs décisionnels — chaîne semencière ISRA/CNRA' },
  factures:       { title: 'Factures',                      sub: 'Factures commerciales émises et reçues' },
}

const roleDescriptions: Record<string, string> = {
  'seed-admin':         'Supervision globale — accès complet à toute la plateforme',
  'seed-directeur':     'Tableau de bord décisionnel — vue d\'ensemble de la chaîne semencière CNRA',
  'seed-selector':      'Gestion des variétés · création des lots G0 / G1 · transfert vers UPSemCL',
  'seed-upsemcl':        'Réception G1 → multiplication G1→G3 → transfert G3 aux multiplicateurs',
  'seed-multiplicator': 'Réception G3 (depuis UPSemCL) → multiplication R1→R2 → transfert & facturation vers quotataires',
  'seed-quotataire':    'Consultation du catalogue et passation de commandes de semences R2',
}

/* ── Monitoring links for admin ── */
const adminTools = [
  { href: 'http://localhost:19090/targets', icon: Activity,   label: 'Prometheus', badge: 'Live' },
  { href: 'http://localhost:13000',          icon: BarChart2,  label: 'Grafana' },
  { href: 'http://localhost:18085',          icon: Server,     label: 'Kafka UI' },
]

export function App() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const [ready,     setReady]     = useState(false)
  // Vrai seulement quand l'URL contient le code OAuth2 (retour post-login KC).
  // Dans ce cas on affiche un loading le temps du token exchange (~200 ms).
  // Pour une visite normale (pas de code dans l'URL), on affiche
  // LandingPage immédiatement sans attendre l'init KC.
  const [isKcCallback] = useState(() => new URLSearchParams(window.location.search).has('code'))
  const [collapsed, setCollapsed] = useState(false)
  const [unread,        setUnread]        = useState(0)
  const [certifNotifs,  setCertifNotifs]  = useState<any[]>([])
  const [alertLots,       setAlertLots]       = useState(0)
  const [alertTransferts, setAlertTransferts] = useState(0)
  const [alertStock,      setAlertStock]      = useState(0)
  const [alertCommandes,  setAlertCommandes]  = useState(0)
  const unreadTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [theme,     setTheme]     = useState<'system' | 'light' | 'dark'>(() => (localStorage.getItem('seed-theme') as any) || 'system')
  const [sessionWarning, setSessionWarning] = useState(false)
  const [notifOpen,    setNotifOpen]    = useState(false)
  const [cmdOpen,      setCmdOpen]      = useState(false)
  const [cmdQuery,     setCmdQuery]     = useState('')
  const [cmdIdx,       setCmdIdx]       = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [logoutModal,  setLogoutModal]  = useState(false)
  const notifRef   = useRef<HTMLDivElement>(null)
  const searchRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initKeycloak()
      .then(() => {
        setReady(true)
        // Authentifié (post-login KC ou session existante) → dashboard directement.
        // La landing page ne s'affiche que pour les utilisateurs non authentifiés.
        if (keycloak.authenticated) {
          const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? []
          navigate('/dashboard')
        }
      })
      .catch(() => {
        setReady(true)
      })
  }, [])

  // ── Thème ──
  useEffect(() => {
    const root = document.documentElement
    const applyTheme = (t: 'light' | 'dark') => root.setAttribute('data-theme', t)

    localStorage.setItem('seed-theme', theme)
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      applyTheme(theme)
    }
  }, [theme])

  // ── Raccourcis clavier ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(true); setCmdQuery(''); setCmdIdx(0)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') { setCmdOpen(false); setNotifOpen(false); setCmdQuery('') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Fermer search ou notif si clic à l'extérieur ──
  useEffect(() => {
    if (!cmdOpen && !notifOpen && !userMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (cmdOpen      && searchRef.current   && !searchRef.current.contains(e.target as Node))
        { setCmdOpen(false); setCmdQuery('') }
      if (notifOpen    && notifRef.current    && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false)
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [cmdOpen, notifOpen, userMenuOpen])

  // Renouvellement proactif du token — invisible pour l'utilisateur
  useEffect(() => {
    if (!ready || !keycloak.authenticated) return
    const check = () => {
      const exp = (keycloak.tokenParsed as any)?.exp
      if (!exp) return
      const remaining = exp - Math.floor(Date.now() / 1000)
      if (remaining > 0 && remaining <= 120) {
        // Refresh proactif : résout ~100% des cas avant l'expiration visible
        keycloak.updateToken(120)
          .then(refreshed => { if (refreshed) setSessionWarning(false) })
          .catch(() => setSessionWarning(true))
        return
      }
      setSessionWarning(false)
    }
    check()
    const t = setInterval(check, 20_000)
    return () => clearInterval(t)
  }, [ready])

  // Polling badge non-lus + notifications certification (toutes les 30s)
  useEffect(() => {
    if (!ready || !keycloak.authenticated) return
    async function fetchUnread() {
      try {
        const { api } = await import('../lib/api')
        const { endpoints } = await import('../lib/endpoints')
        const r = await api.get(endpoints.chatUnread)
        setUnread(r.data?.count || 0)
      } catch { /* ignoré */ }
    }
    async function fetchCertifNotifs() {
      try {
        const { api } = await import('../lib/api')
        const { endpoints } = await import('../lib/endpoints')
        const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? []
        const role = roles.find((r: string) => r.startsWith('seed-')) ?? ''
        if (role === 'seed-multiplicator') {
          const r = await api.get(endpoints.lotsMultCertif)
          setCertifNotifs(r.data ?? [])
        } else if (role === 'seed-upsemcl' || role === 'seed-admin') {
          const r = await api.get(endpoints.lotsACertifier)
          setCertifNotifs(r.data ?? [])
        }
      } catch { /* ignoré */ }
    }
    async function fetchAlertCounts() {
      try {
        const { api } = await import('../lib/api')
        const { endpoints } = await import('../lib/endpoints')
        const [lots, transferts, stock, commandes] = await Promise.allSettled([
          api.get(endpoints.alertsCountLots),
          api.get(endpoints.alertsCountTransferts),
          api.get(endpoints.alertsCountStock),
          api.get(endpoints.alertsCountCommandes),
        ])
        if (lots.status       === 'fulfilled') setAlertLots(lots.value.data?.count       || 0)
        if (transferts.status === 'fulfilled') setAlertTransferts(transferts.value.data?.count || 0)
        if (stock.status      === 'fulfilled') setAlertStock(stock.value.data?.count      || 0)
        if (commandes.status  === 'fulfilled') setAlertCommandes(commandes.value.data?.count  || 0)
      } catch { /* ignoré */ }
    }
    fetchUnread()
    fetchCertifNotifs()
    fetchAlertCounts()
    unreadTimer.current = setInterval(() => {
      fetchUnread()
      fetchCertifNotifs()
      fetchAlertCounts()
    }, 30_000)
    return () => { if (unreadTimer.current) clearInterval(unreadTimer.current) }
  }, [ready])

  if (!ready) {
    // Pendant l'init Keycloak :
    // - Callback post-login (code OAuth2 dans l'URL) → spinner
    // - Visite directe sans code → landing page immédiatement (pas de redirection)
    if (isKcCallback) {
      return (
        <div className="loading-screen">
          <div className="loading-logo">
            <Leaf size={24} color="#fff" />
          </div>
          <div className="loading-text">Connexion en cours…</div>
        </div>
      )
    }
    return <LandingPage />
  }

  // Après init : non authentifié → landing page
  if (!keycloak.authenticated) {
    return <LandingPage />
  }

  const user        = getUserInfo()
  const navSections = getNavSections(user.roleKey)
  const allNavItems = navSections.flatMap(s => s.items)
  const rawPage = location.pathname.slice(1) as Page
  const validPage: Page = (rawPage === 'profile' || allNavItems.find(n => n.id === rawPage)) ? rawPage : (allNavItems[0]?.id || 'dashboard')

  // Palette de commandes — pages filtrées
  const profileItem: NavItem = { id: 'profile', label: 'Mon profil', icon: CircleUser }
  const paletteItems: NavItem[] = [...allNavItems, profileItem]
  const cmdResults = cmdQuery.trim()
    ? paletteItems.filter(n =>
        n.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
        pageTitle[n.id]?.sub?.toLowerCase().includes(cmdQuery.toLowerCase())
      )
    : paletteItems

  function goPage(id: Page) { navigate('/' + id); setCmdOpen(false); setCmdQuery('') }

  // Icône & libellé du bouton thème
  const THEME_CYCLE: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark']
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % 3]
  const ThemeIcon  = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const themeTitle = theme === 'light' ? 'Mode clair — cliquez pour mode nuit' : theme === 'dark' ? 'Mode nuit — cliquez pour mode auto' : 'Mode auto — cliquez pour mode clair'

  type NotifType = 'message' | 'transfer' | 'order' | 'lot' | 'certification' | 'system'
  type Notif = { id: number; type: NotifType; title: string; sub: string; time: string; read: boolean; href: string }

  const NOTIF_HREF: Record<NotifType, string> = {
    message:       '/messages',
    transfer:      '/transfers',
    order:         '/orders',
    lot:           '/lots',
    certification: '/certifications',
    system:        '/dashboard',
  }

  const roles: string[] = (keycloak.tokenParsed as any)?.realm_access?.roles ?? []
  const currentRole = roles.find((r: string) => r.startsWith('seed-')) ?? ''

  const certifNotifItems: Notif[] = (() => {
    if (currentRole === 'seed-multiplicator') {
      const rejetes  = certifNotifs.filter((l: any) => l.statutCertification === 'REJETE')
      const certifies = certifNotifs.filter((l: any) => l.statutCertification === 'CERTIFIE')
      const items: Notif[] = []
      if (rejetes.length > 0)
        items.push({ id: 100, type: 'certification', title: `${rejetes.length} lot${rejetes.length > 1 ? 's' : ''} rejeté${rejetes.length > 1 ? 's' : ''}`, sub: 'Corrections requises — voir Contrôle & Certif.', time: 'récent', read: false, href: NOTIF_HREF.certification })
      if (certifies.length > 0)
        items.push({ id: 101, type: 'certification', title: `${certifies.length} lot${certifies.length > 1 ? 's' : ''} certifié${certifies.length > 1 ? 's' : ''}`, sub: 'Validé par UPSemCL', time: 'récent', read: true, href: NOTIF_HREF.certification })
      return items
    }
    if (currentRole === 'seed-upsemcl' || currentRole === 'seed-admin') {
      if (certifNotifs.length === 0) return []
      return [{ id: 100, type: 'certification' as const, title: `${certifNotifs.length} lot${certifNotifs.length > 1 ? 's' : ''} en attente de certification`, sub: 'Certificats à valider — voir Contrôle & Certif.', time: 'maintenant', read: false, href: NOTIF_HREF.certification }]
    }
    return []
  })()

  const notifications: Notif[] = [
    ...(unread > 0 ? [{
      id: 1, type: 'message' as const,
      title: `${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}`,
      sub: 'Messagerie plateforme', time: 'maintenant', read: false,
      href: NOTIF_HREF.message,
    }] : []),
    ...certifNotifItems,
  ]
  const unreadNotif = notifications.filter(n => !n.read).length

  return (
    <>
    {sessionWarning && (
      <div className="session-warning-banner">
        <span>Votre session expire dans moins de 2 minutes.</span>
        <button
          onClick={async () => {
            try { await keycloak.updateToken(300); setSessionWarning(false) }
            catch { window.location.href = window.location.origin }
          }}
        >
          Renouveler
        </button>
        <button className="session-warning-close" onClick={() => setSessionWarning(false)}>✕</button>
      </div>
    )}
    <div className="layout">

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <img src="/SENJIWU.png" alt="Sen Jiwu" style={{ height: 26, width: 26, objectFit: 'contain' }} />
          </div>
          <div className="sidebar-logo-text">
            <h1>Sen Jiwu</h1>
            <p>Filière semencière</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navSections.map(({ section, items }) => (
            <React.Fragment key={section}>
              <div className="nav-section-label">{section}</div>
              {items.map(({ id, label, icon: Icon, badge }) => (
                <button
                  key={id}
                  className={`nav-item ${validPage === id ? 'active' : ''}`}
                  onClick={() => navigate('/' + id)}
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon"><Icon size={16} /></span>
                  <span className="nav-label">{label}</span>
                  {badge && <span className="nav-badge">{badge}</span>}
                  {id === 'messages'      && unread         > 0 && <span className="nav-badge">{unread}</span>}
                  {id === 'lots'          && alertLots       > 0 && <span className="nav-badge">{alertLots}</span>}
                  {id === 'transfers'     && alertTransferts > 0 && <span className="nav-badge">{alertTransferts}</span>}
                  {id === 'stocks'        && alertStock      > 0 && <span className="nav-badge">{alertStock}</span>}
                  {id === 'orders'        && alertCommandes  > 0 && <span className="nav-badge">{alertCommandes}</span>}
                  {id === 'certifications' && (() => {
                    const actionCount = user.roleKey === 'seed-upsemcl' || user.roleKey === 'seed-admin'
                      ? certifNotifs.length
                      : certifNotifs.filter((l: any) => l.statutCertification === 'REJETE').length
                    return actionCount > 0 ? <span className="nav-badge">{actionCount}</span> : null
                  })()}
                </button>
              ))}
            </React.Fragment>
          ))}

          {user.roleKey === 'seed-admin' && (
            <>
              <div className="nav-section-label">Monitoring</div>
              {adminTools.map(({ href, icon: Icon, label, badge }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-item"
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon"><Icon size={16} /></span>
                  <span className="nav-label">{label}</span>
                  {badge && <span className="nav-badge">{badge}</span>}
                </a>
              ))}
            </>
          )}

        </nav>

        {/* User footer */}
        <div className="sidebar-footer" ref={userMenuRef} style={{ position: 'relative' }}>
          {userMenuOpen && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 8, right: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              overflow: 'hidden', zIndex: 200,
            }}>
              <button
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                onClick={() => { navigate('/profile'); setUserMenuOpen(false) }}
              >
                <CircleUser size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                Mon profil
              </button>
              <div style={{ height: 1, background: 'var(--border)', margin: '0 10px' }} />
              <button
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#dc2626', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                onClick={() => { setUserMenuOpen(false); setLogoutModal(true) }}
              >
                <LogOut size={15} style={{ flexShrink: 0 }} />
                Se déconnecter
              </button>
            </div>
          )}
          <button
            className="user-card"
            style={{ width: '100%', cursor: 'pointer', background: userMenuOpen ? 'var(--bg-muted)' : undefined, border: 'none', textAlign: 'left' }}
            onClick={() => setUserMenuOpen(o => !o)}
            title={collapsed ? user.name : undefined}
          >
            <div
              className="user-avatar"
              style={{ background: `linear-gradient(135deg, ${user.roleColor}, #0c1f15)` }}
            >
              {user.initials}
            </div>
            {!collapsed && (
              <div className="user-meta">
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role}</div>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="topbar-collapse-btn"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
            >
              <Menu size={17} />
            </button>

            <nav className="topbar-breadcrumb">
              <span>CNRA</span>
              <ChevronRight size={13} />
              <span>
                {validPage === 'lots'
                  ? (allNavItems.find(i => i.id === 'lots')?.label ?? pageTitle[validPage].title)
                  : pageTitle[validPage].title}
              </span>
            </nav>
          </div>

          <div className="topbar-right">

            {/* ── Search inline (Cmd+K) ── */}
            <div className={`topbar-search-wrap ${cmdOpen ? 'topbar-search-wrap--open' : ''}`} ref={searchRef}>
              <div
                className={`topbar-search ${cmdOpen ? 'topbar-search--active' : ''}`}
                onClick={() => { setCmdOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
              >
                <Search size={13} color="var(--text-placeholder)" />
                {cmdOpen ? (
                  <input
                    ref={inputRef}
                    className="topbar-search-input"
                    placeholder="Rechercher une page…"
                    value={cmdQuery}
                    onChange={e => { setCmdQuery(e.target.value); setCmdIdx(0) }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx(i => Math.min(i + 1, cmdResults.length - 1)) }
                      if (e.key === 'ArrowUp')   { e.preventDefault(); setCmdIdx(i => Math.max(i - 1, 0)) }
                      if (e.key === 'Enter' && cmdResults[cmdIdx]) goPage(cmdResults[cmdIdx].id)
                    }}
                    autoComplete="off"
                  />
                ) : (
                  <>
                    <span className="topbar-search-label">Rechercher…</span>
                    <span className="topbar-search-kbd">⌘K</span>
                  </>
                )}
                {cmdOpen && cmdQuery && (
                  <button className="topbar-search-clear" onClick={e => { e.stopPropagation(); setCmdQuery('') }}>
                    <X size={12} />
                  </button>
                )}
              </div>

              {cmdOpen && (
                <div className="search-dropdown">
                  {cmdResults.length === 0 ? (
                    <div className="search-dropdown-empty">Aucune page trouvée pour « {cmdQuery} »</div>
                  ) : (
                    cmdResults.map((item, i) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.id}
                          className={`search-dropdown-item ${i === cmdIdx ? 'search-dropdown-item--active' : ''}`}
                          onMouseEnter={() => setCmdIdx(i)}
                          onClick={() => goPage(item.id)}
                        >
                          <span className="search-dropdown-icon"><Icon size={14} /></span>
                          <div className="search-dropdown-body">
                            <span className="search-dropdown-label">{item.label}</span>
                            <span className="search-dropdown-sub">{pageTitle[item.id]?.sub}</span>
                          </div>
                          {validPage === item.id && <span className="search-dropdown-current">actuelle</span>}
                        </button>
                      )
                    })
                  )}
                  <div className="search-dropdown-footer">
                    <span>↑↓ naviguer</span><span>↵ ouvrir</span><span>Esc fermer</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton thème */}
            <button
              className="topbar-icon-btn"
              data-active={theme !== 'system' ? 'true' : undefined}
              title={themeTitle}
              onClick={() => setTheme(nextTheme)}
            >
              <ThemeIcon size={15} />
            </button>

            {/* Cloche notifications */}
            <div className="notif-wrapper" ref={notifRef}>
              <button
                className="notif-btn"
                title="Notifications"
                onClick={() => setNotifOpen(o => !o)}
              >
                <Bell size={15} />
                {unreadNotif > 0 && <span className="notif-badge">{unreadNotif}</span>}
              </button>

              {notifOpen && (
                <div className="notif-panel">
                  <div className="notif-panel-header">
                    <span className="notif-panel-title">Notifications</span>
                    {unreadNotif > 0 && <span className="notif-panel-count">{unreadNotif} non lu{unreadNotif > 1 ? 's' : ''}</span>}
                  </div>
                  <div className="notif-panel-list">
                    {notifications.map(n => (
                      <button
                        key={n.id}
                        className={`notif-item notif-item--clickable ${n.read ? 'notif-item--read' : ''}`}
                        onClick={() => { navigate(n.href); setNotifOpen(false) }}
                        title={n.title}
                      >
                        <div className={`notif-item-dot notif-item-dot--${n.type}`} />
                        <div className="notif-item-body">
                          <div className="notif-item-title">{n.title}</div>
                          <div className="notif-item-sub">{n.sub}</div>
                        </div>
                        <div className="notif-item-time">{n.time}</div>
                      </button>
                    ))}
                  </div>
                  <button className="notif-panel-footer" onClick={() => { navigate('/dashboard'); setNotifOpen(false) }}>
                    Voir toutes les notifications
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Role banner */}
        {user.roleKey && (
          <div
            className="role-banner"
            style={{ background: `${user.roleColor}0d`, borderBottomColor: `${user.roleColor}22` }}
          >
            <span
              className="role-pill"
              style={{ background: user.roleColor }}
            >
              {user.role}
            </span>
            <span className="role-desc">{roleDescriptions[user.roleKey]}</span>
          </div>
        )}

        {/* Page */}
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"      element={<Dashboard      roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} />} />
            <Route path="/varieties"      element={<Varieties      roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} />} />
            <Route path="/lots"           element={<Lots           roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} />} />
            <Route path="/stocks"         element={<Stocks         roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} />} />
            <Route path="/orders"         element={<Orders         roleKey={user.roleKey} />} />
            <Route path="/certifications" element={<Certifications roleKey={user.roleKey} />} />
            <Route path="/transfers"      element={<Transfers      roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} />} />
            <Route path="/campagnes"      element={<Campagnes      roleKey={user.roleKey} />} />
            <Route path="/sites"          element={<Sites          roleKey={user.roleKey} />} />
            <Route path="/mes-sites"      element={<MesSites       roleKey={user.roleKey} />} />
            <Route path="/programs"       element={<Programs       roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} username={user.name} />} />
            <Route path="/profile"        element={<Profile        roleKey={user.roleKey} />} />
            <Route path="/users"          element={<Users          roleKey={user.roleKey} />} />
            <Route path="/catalogue"      element={<CataloguePublic roleKey={user.roleKey} token={keycloak.token || ''} onContacter={() => navigate('/messages')} />} />
            <Route path="/messages"       element={<Messages roleKey={user.roleKey} username={user.name} />} />
            <Route path="/factures"       element={<Factures roleKey={user.roleKey} />} />
            <Route path="/directeur"     element={currentRole === 'seed-directeur' || currentRole === 'seed-admin' ? <DirecteurDashboard /> : <Navigate to={`/${allNavItems[0]?.id || 'dashboard'}`} replace />} />
            <Route path="*"              element={<Navigate to={`/${allNavItems[0]?.id || 'dashboard'}`} replace />} />
          </Routes>
        </main>
      </div>
    </div>

    {/* ── Modal confirmation déconnexion ──────────────────────────── */}
    {logoutModal && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={() => setLogoutModal(false)}
      >
        <div
          style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '22px 24px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogOut size={18} style={{ color: '#dc2626' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Se déconnecter</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Votre session sera fermée</div>
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Voulez-vous vraiment vous déconnecter de <strong>Sen Jiwu</strong> ?
            </p>
          </div>
          <div style={{ padding: '0 24px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 13, minWidth: 90 }}
              onClick={() => setLogoutModal(false)}
            >
              Annuler
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 13, minWidth: 150, background: '#dc2626', borderColor: '#dc2626', gap: 7 }}
              onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
            >
              <LogOut size={13} /> Se déconnecter
            </button>
          </div>
        </div>
      </div>
    )}

    </>
  )
}
