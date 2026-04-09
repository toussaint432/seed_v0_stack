import React, { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, Leaf, Package, BarChart3,
  Users as UsersIcon, CircleUser, Bell, Search, Menu, LogOut, ChevronRight,
  Activity, Warehouse, ShoppingCart, ArrowRightLeft, Shield,
  Calendar, MapPin, Building2, Workflow, Server, Store, MessageCircle,
  Sun, Moon, Monitor, X,
} from 'lucide-react'
import { initKeycloak, keycloak } from '../lib/keycloak'
import { Varieties }      from './pages/Varieties'
import { Lots }           from './pages/Lots'
import { Stocks }         from './pages/Stocks'
import { Orders }         from './pages/Orders'
import { Dashboard }      from './pages/Dashboard'
import { Certifications } from './pages/Certifications'
import { Transfers }      from './pages/Transfers'
import { Campagnes }      from './pages/Campagnes'
import { Sites }          from './pages/Sites'
import { Organisations }  from './pages/Organisations'
import { Programs }       from './pages/Programs'
import { Profile }          from './pages/Profile'
import { Users }            from './pages/Users'
import { CataloguePublic }  from './pages/CataloguePublic'
import { Messages }          from './pages/Messages'

type Page =
  | 'dashboard' | 'varieties' | 'lots' | 'stocks' | 'orders'
  | 'certifications' | 'transfers' | 'campagnes' | 'sites'
  | 'organisations' | 'programs' | 'profile' | 'users' | 'catalogue'
  | 'messages'

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
type NavItem = { id: Page; label: string; icon: React.ElementType; badge?: string }

function getNavSections(roleKey: string): NavSection[] {
  // Éléments communs
  const dashboard:      NavItem = { id: 'dashboard',      label: 'Tableau de bord',        icon: LayoutDashboard }
  const varieties:      NavItem = { id: 'varieties',      label: 'Variétés & Espèces',     icon: Leaf }
  const lots:           NavItem = { id: 'lots',           label: 'Lots semenciers',         icon: Package }
  const stocks:         NavItem = { id: 'stocks',         label: 'Stock',                   icon: Warehouse }
  const orders:         NavItem = { id: 'orders',         label: 'Commandes',               icon: ShoppingCart }
  const certifications: NavItem = { id: 'certifications', label: 'Qualité & Certif.',       icon: Shield }
  const transfers:      NavItem = { id: 'transfers',      label: 'Transferts',              icon: ArrowRightLeft }
  const programs:       NavItem = { id: 'programs',       label: 'Programmes',              icon: Workflow }
  const campagnes:      NavItem = { id: 'campagnes',      label: 'Campagnes',               icon: Calendar }
  const sites:          NavItem = { id: 'sites',          label: 'Sites',                   icon: MapPin }
  const organisations:  NavItem = { id: 'organisations',  label: 'Organisations',           icon: Building2 }

  const users:          NavItem = { id: 'users',          label: 'Utilisateurs',            icon: UsersIcon }

  switch (roleKey) {
    case 'seed-admin':
      return [
        { section: 'Général', items: [dashboard] },
        { section: 'Catalogue', items: [varieties, { ...lots, label: 'Lots & Générations' }] },
        { section: 'Production', items: [programs, certifications, transfers] },
        { section: 'Logistique', items: [stocks, orders] },
        { section: 'Référentiels', items: [campagnes, sites, organisations] },
        { section: 'Administration', items: [users] },
      ]

    case 'seed-selector':
      return [
        { section: 'Général', items: [dashboard] },
        { section: 'Recherche', items: [varieties, { ...lots, label: 'Lots G0/G1' }] },
        { section: 'Transferts', items: [transfers, certifications] },
        { section: 'Communication', items: [{ id: 'messages' as Page, label: 'Messages', icon: MessageCircle }] },
      ]

    case 'seed-upsemcl':
      return [
        { section: 'Général', items: [dashboard] },
        { section: 'Multiplication', items: [{ ...lots, label: 'Lots G1→G3' }, programs] },
        { section: 'Gestion', items: [stocks, certifications, transfers] },
        { section: 'Communication', items: [{ id: 'messages' as Page, label: 'Messages', icon: MessageCircle }] },
      ]

    case 'seed-multiplicator':
      return [
        { section: 'Général', items: [dashboard] },
        { section: 'Production', items: [{ ...lots, label: 'Lots G3→R2' }, programs] },
        { section: 'Gestion', items: [stocks, certifications, orders] },
        { section: 'Communication', items: [{ id: 'messages' as Page, label: 'Messages', icon: MessageCircle }] },
      ]

    case 'seed-quotataire':
      return [
        { section: 'Général',   items: [dashboard] },
        { section: 'Catalogue', items: [{ id: 'catalogue' as Page, label: 'Catalogue R1/R2', icon: Store }] },
        { section: 'Commandes', items: [orders, { id: 'messages' as Page, label: 'Messages', icon: MessageCircle }] },
        { section: 'Réceptions', items: [{ ...lots, label: 'Semences R2 reçues' }] },
      ]

    default:
      return [
        { section: 'Navigation', items: [dashboard, varieties, lots, stocks, orders] },
      ]
  }
}

const pageTitle: Record<Page, { title: string; sub: string }> = {
  dashboard:      { title: 'Tableau de bord',           sub: "Vue d'ensemble de la campagne" },
  varieties:      { title: 'Variétés & Espèces',        sub: 'Catalogue des semences certifiées' },
  lots:           { title: 'Lots de semences',           sub: 'Suivi des générations G0 → R2' },
  stocks:         { title: 'Inventaire stock',           sub: 'Disponibilité par site de stockage' },
  orders:         { title: 'Commandes',                  sub: 'Suivi et gestion des commandes' },
  certifications: { title: 'Qualité & Certifications',   sub: 'Contrôles qualité et certification des lots' },
  transfers:      { title: 'Transferts',                 sub: 'Transferts inter-organisations de semences' },
  campagnes:      { title: 'Campagnes agricoles',        sub: 'Gestion des campagnes de production' },
  sites:          { title: 'Sites',                      sub: 'Sites de stockage et production' },
  organisations:  { title: 'Organisations',              sub: 'Acteurs de la chaîne semencière' },
  programs:       { title: 'Programmes de multiplication', sub: 'Planification et suivi des multiplications' },
  profile:        { title: 'Mon profil',                   sub: 'Informations et paramètres de votre compte' },
  users:          { title: 'Gestion des utilisateurs',     sub: 'Comptes et rôles de la plateforme' },
  catalogue:      { title: 'Catalogue des semences',       sub: 'Stocks R1/R2 disponibles chez les multiplicateurs' },
  messages:       { title: 'Messagerie',                   sub: 'Conversations directes avec vos partenaires' },
}

const roleDescriptions: Record<string, string> = {
  'seed-admin':         'Supervision globale — accès complet à toute la plateforme',
  'seed-selector':      'Gestion des variétés · création des lots G0 / G1 · transfert vers UPSemCL',
  'seed-upsemcl':        'Réception G1 → multiplication G1→G3 → transfert G3 aux multiplicateurs',
  'seed-multiplicator': 'Réception G3 → production G4→R1→R2 pour commercialisation',
  'seed-quotataire':    'Consultation du catalogue et passation de commandes de semences R2',
}

/* ── Monitoring links for admin ── */
const adminTools = [
  { href: 'http://localhost:19090/targets', icon: Activity,   label: 'Prometheus', badge: 'Live' },
  { href: 'http://localhost:13000',          icon: BarChart3,  label: 'Grafana' },
  { href: 'http://localhost:18085',          icon: Server,     label: 'Kafka UI' },
]

export function App() {
  const [ready,     setReady]     = useState(false)
  const [page,      setPage]      = useState<Page>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [unread,    setUnread]    = useState(0)
  const unreadTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [theme,     setTheme]     = useState<'system' | 'light' | 'dark'>(() => (localStorage.getItem('seed-theme') as any) || 'system')
  const [notifOpen, setNotifOpen] = useState(false)
  const [cmdOpen,   setCmdOpen]   = useState(false)
  const [cmdQuery,  setCmdQuery]  = useState('')
  const [cmdIdx,    setCmdIdx]    = useState(0)
  const notifRef  = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => { initKeycloak().then(() => setReady(true)) }, [])

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
    if (!cmdOpen && !notifOpen) return
    const handler = (e: MouseEvent) => {
      if (cmdOpen   && searchRef.current && !searchRef.current.contains(e.target as Node))
        { setCmdOpen(false); setCmdQuery('') }
      if (notifOpen && notifRef.current  && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [cmdOpen, notifOpen])

  // Polling badge non-lus (toutes les 30s, démarré après login)
  useEffect(() => {
    if (!ready) return
    async function fetchUnread() {
      try {
        const { api } = await import('../lib/api')
        const { endpoints } = await import('../lib/endpoints')
        const r = await api.get(endpoints.chatUnread)
        setUnread(r.data?.count || 0)
      } catch { /* ignoré */ }
    }
    fetchUnread()
    unreadTimer.current = setInterval(fetchUnread, 30_000)
    return () => { if (unreadTimer.current) clearInterval(unreadTimer.current) }
  }, [ready])

  if (!ready) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">
          <Leaf size={24} color="#fff" />
        </div>
        <div className="loading-text">Connexion en cours…</div>
      </div>
    )
  }

  const user        = getUserInfo()
  const navSections = getNavSections(user.roleKey)
  const allNavItems = navSections.flatMap(s => s.items)
  const validPage: Page = (page === 'profile' || allNavItems.find(n => n.id === page)) ? page : (allNavItems[0]?.id || 'dashboard')

  // Palette de commandes — pages filtrées
  const profileItem: NavItem = { id: 'profile', label: 'Mon profil', icon: CircleUser }
  const paletteItems: NavItem[] = [...allNavItems, profileItem]
  const cmdResults = cmdQuery.trim()
    ? paletteItems.filter(n =>
        n.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
        pageTitle[n.id]?.sub?.toLowerCase().includes(cmdQuery.toLowerCase())
      )
    : paletteItems

  function goPage(id: Page) { setPage(id); setCmdOpen(false); setCmdQuery('') }

  // Icône & libellé du bouton thème
  const THEME_CYCLE: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark']
  const nextTheme = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % 3]
  const ThemeIcon  = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const themeTitle = theme === 'light' ? 'Mode clair — cliquez pour mode nuit' : theme === 'dark' ? 'Mode nuit — cliquez pour mode auto' : 'Mode auto — cliquez pour mode clair'

  // Notifications simulées (messages non-lus + alertes plateforme)
  const notifications: Array<{ id: number; type: 'message' | 'transfer' | 'system'; title: string; sub: string; time: string; read: boolean }> = [
    ...(unread > 0 ? [{ id: 1, type: 'message' as const, title: `${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}`, sub: 'Messagerie plateforme', time: 'maintenant', read: false }] : []),
    { id: 2, type: 'transfer' as const, title: 'Transfert en attente de validation', sub: 'Un lot G3 attend votre approbation', time: 'il y a 2h', read: false },
    { id: 3, type: 'system' as const, title: 'Plateforme SEED opérationnelle', sub: 'Tous les services sont actifs', time: 'il y a 5h', read: true },
  ]
  const unreadNotif = notifications.filter(n => !n.read).length

  return (
    <>
    <div className="layout">

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <Leaf size={18} color="#fff" />
          </div>
          <div className="sidebar-logo-text">
            <h1>Seed Platform</h1>
            <p>ISRA · CNRA</p>
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
                  onClick={() => setPage(id)}
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon"><Icon size={16} /></span>
                  <span className="nav-label">{label}</span>
                  {badge && <span className="nav-badge">{badge}</span>}
                  {id === 'messages' && unread > 0 && <span className="nav-badge">{unread}</span>}
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

          <div className="nav-section-label">Compte</div>
          <button
            className={`nav-item ${validPage === 'profile' ? 'active' : ''}`}
            onClick={() => setPage('profile')}
            title={collapsed ? 'Mon profil' : undefined}
          >
            <span className="nav-icon"><CircleUser size={16} /></span>
            <span className="nav-label">Mon profil</span>
          </button>
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="user-card">
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
            <button
              className="logout-btn"
              title="Déconnexion"
              onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
            >
              <LogOut size={14} />
            </button>
          </div>
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
              <span>{pageTitle[validPage].title}</span>
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
                      <div key={n.id} className={`notif-item ${n.read ? 'notif-item--read' : ''}`}>
                        <div className={`notif-item-dot notif-item-dot--${n.type}`} />
                        <div className="notif-item-body">
                          <div className="notif-item-title">{n.title}</div>
                          <div className="notif-item-sub">{n.sub}</div>
                        </div>
                        <div className="notif-item-time">{n.time}</div>
                      </div>
                    ))}
                  </div>
                  <button className="notif-panel-footer" onClick={() => { setPage('messages'); setNotifOpen(false) }}>
                    Voir tous les messages
                  </button>
                </div>
              )}
            </div>

            {/* Avatar cliquable → profil */}
            <button
              onClick={() => setPage('profile')}
              title={`${user.name} — Mon profil`}
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none',
                background: `linear-gradient(135deg, ${user.roleColor}, #0c1f15)`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                boxShadow: '0 0 0 2px var(--border)',
                overflow: 'hidden',
              }}
            >
              {(() => {
                const storedPhoto = (window as any).__profilePhoto ||
                  localStorage.getItem(`seed-avatar-${(keycloak.tokenParsed as any)?.sub}`)
                return storedPhoto
                  ? <img src={storedPhoto} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : user.initials
              })()}
            </button>
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
        <main className="page-content" key={validPage}>
          {validPage === 'dashboard'      && <Dashboard      roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} />}
          {validPage === 'varieties'      && <Varieties      roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} />}
          {validPage === 'lots'           && <Lots           roleKey={user.roleKey} userSpecialisation={user.userSpecialisation} />}
          {validPage === 'stocks'         && <Stocks         roleKey={user.roleKey} />}
          {validPage === 'orders'         && <Orders         roleKey={user.roleKey} />}
          {validPage === 'certifications' && <Certifications roleKey={user.roleKey} />}
          {validPage === 'transfers'      && <Transfers      roleKey={user.roleKey} />}
          {validPage === 'campagnes'      && <Campagnes      roleKey={user.roleKey} />}
          {validPage === 'sites'          && <Sites          roleKey={user.roleKey} />}
          {validPage === 'organisations'  && <Organisations  roleKey={user.roleKey} />}
          {validPage === 'programs'       && <Programs       roleKey={user.roleKey} />}
          {validPage === 'profile'        && <Profile        roleKey={user.roleKey} />}
          {validPage === 'users'          && <Users          roleKey={user.roleKey} />}
          {validPage === 'catalogue'      && <CataloguePublic roleKey={user.roleKey} token={keycloak.token || ''} onContacter={() => setPage('messages')} />}
          {validPage === 'messages'       && <Messages roleKey={user.roleKey} username={user.name} />}
        </main>
      </div>
    </div>

    </>
  )
}
