import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard, Leaf, Package, BarChart3,
  Users as UsersIcon, CircleUser, Bell, Search, Menu, LogOut, ChevronRight,
  Activity, Warehouse, ShoppingCart, ArrowRightLeft, Shield,
  Calendar, MapPin, Building2, Workflow, Server
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
import { Profile }        from './pages/Profile'
import { Users }          from './pages/Users'

type Page =
  | 'dashboard' | 'varieties' | 'lots' | 'stocks' | 'orders'
  | 'certifications' | 'transfers' | 'campagnes' | 'sites'
  | 'organisations' | 'programs' | 'profile' | 'users'

/* ── Auth helpers ── */
function getUserRoles(): string[] {
  const token = keycloak.tokenParsed as any
  return token?.realm_access?.roles || []
}

function getUserInfo() {
  const token = keycloak.tokenParsed as any
  if (!token) return { name: 'Utilisateur', role: 'Connecté', initials: 'U', roleKey: '', roleColor: '#6b7280' }
  const name  = token.preferred_username || token.name || 'Utilisateur'
  const roles = getUserRoles()
  const roleMap: Record<string, { label: string; color: string }> = {
    'seed-admin':         { label: 'Administrateur ISRA', color: '#7c3aed' },
    'seed-selector':      { label: 'Sélectionneur',       color: '#0369a1' },
    'seed-upseml':        { label: 'UPSemCL',             color: '#0f766e' },
    'seed-multiplicator': { label: 'Multiplicateur',      color: '#15803d' },
    'seed-quotataire':    { label: 'Quotataire / OP',     color: '#b45309' },
  }
  const roleKey  = Object.keys(roleMap).find(r => roles.includes(r)) || ''
  const roleInfo = roleMap[roleKey] || { label: 'Utilisateur', color: '#6b7280' }
  return { name, role: roleInfo.label, roleColor: roleInfo.color, initials: name.slice(0, 2).toUpperCase(), roleKey }
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
      ]

    case 'seed-upseml':
      return [
        { section: 'Général', items: [dashboard] },
        { section: 'Multiplication', items: [{ ...lots, label: 'Lots G1→G3' }, programs] },
        { section: 'Gestion', items: [stocks, certifications, transfers] },
      ]

    case 'seed-multiplicator':
      return [
        { section: 'Général', items: [dashboard] },
        { section: 'Production', items: [{ ...lots, label: 'Lots G3→R2' }, programs] },
        { section: 'Gestion', items: [stocks, certifications] },
      ]

    case 'seed-quotataire':
      return [
        { section: 'Général', items: [dashboard] },
        { section: 'Catalogue', items: [{ ...varieties, label: 'Catalogue semences' }] },
        { section: 'Commandes', items: [orders] },
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
}

const roleDescriptions: Record<string, string> = {
  'seed-admin':         'Supervision globale — accès complet à toute la plateforme',
  'seed-selector':      'Gestion des variétés · création des lots G0 / G1 · transfert vers UPSemCL',
  'seed-upseml':        'Réception G1 → multiplication G1→G3 → transfert G3 aux multiplicateurs',
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
  const [search,    setSearch]    = useState('')

  useEffect(() => { initKeycloak().then(() => setReady(true)) }, [])

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

  return (
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
            <div className="topbar-search">
              <Search size={13} color="var(--text-placeholder)" />
              <input
                placeholder="Rechercher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="notif-btn" title="Notifications">
              <Bell size={15} />
              <span className="notif-dot" />
            </button>
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
          {validPage === 'dashboard'      && <Dashboard      roleKey={user.roleKey} />}
          {validPage === 'varieties'      && <Varieties      roleKey={user.roleKey} />}
          {validPage === 'lots'           && <Lots           roleKey={user.roleKey} />}
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
        </main>
      </div>
    </div>
  )
}
