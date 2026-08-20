import React, { useEffect, useState, useMemo } from 'react'
import {
  Users as UsersIcon, Plus, RefreshCw, Search, X, Shield, User,
  AlertTriangle, Activity, Eye, AlertCircle, Info, Download,
} from 'lucide-react'
import { keycloak } from '../../lib/keycloak'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { downloadCsv } from '../../lib/exportUtils'

interface Props { roleKey: string }

const KEYCLOAK_ADMIN = 'http://localhost:18080'
const REALM = 'seed-v0'

const ROLES_PLATFORM = [
  { value: 'seed-admin',         label: 'Administrateur ISRA', color: '#7c3aed' },
  { value: 'seed-selector',      label: 'Sélectionneur',       color: '#0369a1' },
  { value: 'seed-upsemcl',       label: 'UPSemCL',             color: '#0f766e' },
  { value: 'seed-multiplicator', label: 'Multiplicateur',      color: '#15803d' },
  { value: 'seed-quotataire',    label: 'Quotataire / OP',     color: '#b45309' },
]

interface KcEvent {
  id?: string
  time: number
  clientId?: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  error?: string
  type: string
  details?: Record<string, string>
}

type EventStatus = 'success' | 'error' | 'info' | 'warning'
interface EventMeta { label: string; status: EventStatus }

const EVENT_META: Record<string, EventMeta> = {
  LOGIN:                  { label: 'Connexion réussie',               status: 'success' },
  LOGIN_ERROR:            { label: 'Tentative de connexion échouée',  status: 'error'   },
  LOGOUT:                 { label: 'Déconnexion',                     status: 'info'    },
  CODE_TO_TOKEN:          { label: 'Échange de token OAuth',          status: 'info'    },
  CODE_TO_TOKEN_ERROR:    { label: 'Erreur échange de token',         status: 'error'   },
  UPDATE_PASSWORD:        { label: 'Modification du mot de passe',    status: 'success' },
  UPDATE_PASSWORD_ERROR:  { label: 'Erreur modification mot de passe',status: 'error'   },
  UPDATE_PROFILE:         { label: 'Mise à jour du profil',           status: 'success' },
  REGISTER:               { label: 'Inscription',                     status: 'success' },
  SEND_RESET_PASSWORD:    { label: 'Réinitialisation mot de passe',   status: 'info'    },
  RESET_PASSWORD:         { label: 'Mot de passe réinitialisé',       status: 'success' },
  VERIFY_EMAIL:           { label: 'Email vérifié',                   status: 'success' },
  SEND_VERIFY_EMAIL:      { label: 'Email de vérification envoyé',    status: 'info'    },
  REVOKE_GRANT:           { label: "Révocation d'accès",              status: 'warning' },
  REFRESH_TOKEN:          { label: 'Renouvellement du token',         status: 'info'    },
  REFRESH_TOKEN_ERROR:    { label: 'Erreur renouvellement token',     status: 'error'   },
  INTROSPECT_TOKEN:       { label: 'Introspection de token',          status: 'info'    },
  INTROSPECT_TOKEN_ERROR: { label: 'Erreur introspection token',      status: 'error'   },
  TOKEN_EXCHANGE:         { label: 'Échange de token',                status: 'info'    },
  CLIENT_LOGIN:           { label: 'Connexion client',                status: 'info'    },
  DELETE_ACCOUNT:         { label: 'Suppression de compte',           status: 'error'   },
}

function getEventMeta(type: string): EventMeta {
  return EVENT_META[type] ?? { label: type.replace(/_/g, ' '), status: 'info' }
}

function getRoleColor(r: string) { return ROLES_PLATFORM.find(p => p.value === r)?.color ?? '#6b7280' }
function getRoleLabel(r: string) { return ROLES_PLATFORM.find(p => p.value === r)?.label ?? r }
function getPlatformRole(roles: string[]) {
  return ROLES_PLATFORM.map(r => r.value).find(r => roles.includes(r)) ?? ''
}

function formatDate(ms: number) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(ms))
}

const STATUS_STYLE: Record<EventStatus, { bg: string; fg: string; border: string }> = {
  success: { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  error:   { bg: '#fff1f2', fg: '#dc2626', border: '#fecaca' },
  info:    { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  warning: { bg: '#fffbeb', fg: '#92400e', border: '#fde68a' },
}

const STATUS_LABEL: Record<EventStatus, string> = {
  success: 'Succès', error: 'Échec', info: 'Info', warning: 'Avertissement',
}

function EventStatusBadge({ status }: { status: EventStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.fg, display: 'inline-block', flexShrink: 0 }} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function UserAvatar({ user, platformRole, size = 32 }: { user: any; platformRole: string; size?: number }) {
  const initials = user
    ? ((user.firstName?.charAt(0) ?? '') + (user.lastName?.charAt(0) ?? '')).toUpperCase() ||
      (user.username?.slice(0, 2) ?? '?').toUpperCase()
    : '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: platformRole
        ? `linear-gradient(135deg, ${getRoleColor(platformRole)}, #0c1f15)`
        : '#e5e7eb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700,
      color: platformRole ? '#fff' : '#6b7280',
    }}>{initials}</div>
  )
}

/* ── Section label ── */
function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
      {icon}{text}
    </div>
  )
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>
}

function DetailCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  )
}

export function Users({ roleKey }: Props) {
  const [users, setUsers]         = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({})
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [accessError, setAccessError] = useState(false)

  const [tab, setTab] = useState<'users' | 'journal'>('users')

  const [events, setEvents]               = useState<KcEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError]     = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<KcEvent | null>(null)
  const [eventSearch, setEventSearch]     = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')

  const [organisations, setOrganisations] = useState<any[]>([])
  const [especes,       setEspeces]       = useState<any[]>([])

  const [form, setForm] = useState({
    username: '', firstName: '', lastName: '', email: '',
    password: '', role: 'seed-selector', orgId: '', specialisation: '',
  })

  function adminHeaders() {
    return { Authorization: `Bearer ${keycloak.token}` }
  }

  async function fetchUsers() {
    setLoading(true)
    setAccessError(false)
    try {
      const res = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users?max=100`, { headers: adminHeaders() })
      if (res.status === 403) { setAccessError(true); setLoading(false); return }
      const data = await res.json()
      setUsers(data)
      const rolesMap: Record<string, string[]> = {}
      await Promise.all(data.map(async (u: any) => {
        try {
          const r = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users/${u.id}/role-mappings/realm`, { headers: adminHeaders() })
          const rd = await r.json()
          rolesMap[u.id] = Array.isArray(rd) ? rd.map((ro: any) => ro.name) : []
        } catch { rolesMap[u.id] = [] }
      }))
      setUserRoles(rolesMap)
    } catch { setAccessError(true) }
    finally { setLoading(false) }
  }

  async function fetchEvents() {
    setEventsLoading(true)
    setEventsError(false)
    try {
      const res = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/events?max=500`, { headers: adminHeaders() })
      if (!res.ok) { setEventsError(true); return }
      const data = await res.json()
      setEvents(Array.isArray(data) ? data.sort((a: KcEvent, b: KcEvent) => b.time - a.time) : [])
    } catch { setEventsError(true) }
    finally { setEventsLoading(false) }
  }

  useEffect(() => {
    if (roleKey === 'seed-admin') {
      fetchUsers()
      fetchEvents()
      api.get(endpoints.organisations).then(r => setOrganisations(r.data || [])).catch(() => {})
      api.get(endpoints.species).then(r => setEspeces(r.data || [])).catch(() => {})
    }
  }, [])

  const filtered = users.filter(u =>
    !search ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    u.lastName?.toLowerCase().includes(search.toLowerCase())
  )

  const now = Date.now()
  const last7d = now - 7 * 24 * 60 * 60 * 1000
  const connectionsWeek = events.filter(e => e.type === 'LOGIN' && e.time > last7d).length
  const errorsWeek      = events.filter(e => e.type === 'LOGIN_ERROR' && e.time > last7d).length

  const uniqueTypes = useMemo(() => [...new Set(events.map(e => e.type))].sort(), [events])

  const filteredEvents = useMemo(() => events.filter(e => {
    if (eventTypeFilter && e.type !== eventTypeFilter) return false
    if (!eventSearch) return true
    const u = users.find(x => x.id === e.userId)
    const nameStr = u
      ? `${u.firstName ?? ''} ${u.lastName ?? ''} ${u.username ?? ''}`.toLowerCase()
      : (e.details?.username ?? '').toLowerCase()
    return (
      nameStr.includes(eventSearch.toLowerCase()) ||
      (e.ipAddress ?? '').includes(eventSearch) ||
      getEventMeta(e.type).label.toLowerCase().includes(eventSearch.toLowerCase())
    )
  }), [events, eventSearch, eventTypeFilter, users])

  function getUserById(userId?: string) {
    if (!userId) return null
    return users.find(u => u.id === userId) ?? null
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      // 1. Créer l'utilisateur dans Keycloak
      const createRes = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users`, {
        method: 'POST',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username, firstName: form.firstName,
          lastName: form.lastName, email: form.email,
          enabled: true,
          credentials: [{ type: 'password', value: form.password, temporary: true }],
        }),
      })
      if (!createRes.ok) throw new Error(await createRes.text())
      const location = createRes.headers.get('Location') ?? ''
      const newUserId = location.split('/').pop()
      if (!newUserId) throw new Error('ID utilisateur introuvable')

      // 2. Assigner le rôle plateforme
      const rolesRes = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/roles/${form.role}`, { headers: adminHeaders() })
      if (!rolesRes.ok) throw new Error('Rôle introuvable')
      const roleObj = await rolesRes.json()
      await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users/${newUserId}/role-mappings/realm`, {
        method: 'POST',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify([roleObj]),
      })

      // 3. Lier l'utilisateur à son organisation (membre_organisation)
      const resolvedOrgId = resolveOrgId(form.role, form.orgId)
      if (resolvedOrgId) {
        const nomComplet = [form.firstName, form.lastName].filter(Boolean).join(' ') || form.username
        await api.post(endpoints.membres, {
          keycloakUsername: form.username,
          keycloakRole:     form.role,
          nomComplet,
          idOrganisation:   resolvedOrgId,
          roleDansOrg:      'MEMBRE',
          principal:        true,
          specialisation:   form.specialisation || null,
        })
      }

      setToast({ msg: `Utilisateur ${form.username} créé avec succès`, type: 'success' })
      setShowForm(false)
      setForm({ username: '', firstName: '', lastName: '', email: '', password: '', role: 'seed-selector', orgId: '', specialisation: '' })
      fetchUsers()
    } catch (err: any) {
      setToast({ msg: err?.message ?? 'Erreur lors de la création', type: 'error' })
    } finally { setSaving(false) }
  }

  function resolveOrgId(role: string, orgId: string): number | null {
    if (role === 'seed-selector' || role === 'seed-admin') {
      const isra = organisations.find(o => o.typeOrganisation === 'ISRA')
      return isra?.id ?? 1
    }
    return orgId ? Number(orgId) : null
  }

  async function toggleUserStatus(userId: string, currentlyEnabled: boolean) {
    try {
      await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users/${userId}`, {
        method: 'PUT',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentlyEnabled }),
      })
      setToast({ msg: `Utilisateur ${currentlyEnabled ? 'désactivé' : 'réactivé'}`, type: 'success' })
      fetchUsers()
    } catch {
      setToast({ msg: 'Erreur lors de la mise à jour', type: 'error' })
    }
  }

  if (roleKey !== 'seed-admin') return (
    <div className="empty-state" style={{ marginTop: 60 }}>
      <div className="empty-icon"><Shield size={24} /></div>
      <div className="empty-title">Accès restreint</div>
      <div className="empty-sub">La gestion des utilisateurs est réservée aux administrateurs</div>
    </div>
  )

  /* ── Tab button helper ── */
  const tabBtn = (id: 'users' | 'journal', label: string, count: number) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '10px 20px', fontSize: 13, fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        color: tab === id ? 'var(--green-600)' : 'var(--text-muted)',
        borderBottom: tab === id ? '2px solid var(--green-600)' : '2px solid transparent',
        marginBottom: -2,
        display: 'flex', alignItems: 'center', gap: 8, transition: 'color 0.15s',
      }}
    >
      {label}
      <span style={{
        background: tab === id ? 'var(--green-600)' : 'var(--border-strong)',
        color: tab === id ? '#fff' : 'var(--text-muted)',
        borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700,
      }}>
        {(tab === 'users' ? loading : eventsLoading) ? '…' : count}
      </span>
    </button>
  )

  /* ── Input search helper ── */
  const searchInput = (value: string, setter: (v: string) => void, placeholder: string, width = 220) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
      <Search size={13} color="var(--text-muted)" />
      <input
        placeholder={placeholder} value={value}
        onChange={e => setter(e.target.value)}
        style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'var(--font-sans)', width }}
      />
      {value && <button onClick={() => setter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
    </div>
  )

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── KPIs ──────────────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><UsersIcon size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : users.length}</div>
            <div className="stat-label">Utilisateurs total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><User size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : users.filter(u => u.enabled).length}</div>
            <div className="stat-label">Actifs</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold"><Activity size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{eventsLoading ? '…' : connectionsWeek}</div>
            <div className="stat-label">Connexions (7 jours)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertCircle size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{eventsLoading ? '…' : errorsWeek}</div>
            <div className="stat-label">Échecs connexion (7j)</div>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {tabBtn('users',   'Utilisateurs',       filtered.length)}
        {tabBtn('journal', "Journal d'activité", filteredEvents.length)}
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-secondary btn-icon"
          style={{ marginBottom: 8, marginRight: 2 }}
          onClick={() => { fetchUsers(); fetchEvents() }}
          title="Actualiser"
        ><RefreshCw size={13} /></button>
      </div>

      {/* ── Tab : Utilisateurs ───────────────────────────── */}
      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><UsersIcon size={15} /></span>
              Utilisateurs
              <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}</span>
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {filtered.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ gap: 5, fontSize: 12 }}
                  onClick={() => downloadCsv(
                    `utilisateurs-${new Date().toISOString().slice(0, 10)}`,
                    ['Prénom', 'Nom', 'Username', 'Email', 'Rôle plateforme', 'Statut'],
                    filtered.map(u => {
                      const roles        = userRoles[u.id] ?? []
                      const platformRole = getPlatformRole(roles)
                      return [
                        u.firstName ?? '',
                        u.lastName  ?? '',
                        u.username  ?? '',
                        u.email     ?? '',
                        platformRole ? getRoleLabel(platformRole) : '',
                        u.enabled ? 'Actif' : 'Inactif',
                      ]
                    })
                  )}
                >
                  <Download size={13} /> CSV
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Nouvel utilisateur</button>
            </div>
          </div>

          {accessError && (
            <div style={{ margin: '0 20px 16px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <AlertTriangle size={16} color="#b45309" />
              <span>
                <strong>Permission manquante :</strong> Le compte <em>seed-admin</em> n'a pas le droit <code>manage-users</code> dans Keycloak.
                Allez sur <strong>http://localhost:18080</strong> → Realm <em>seed-v0</em> → Users → <em>seed-admin</em> → Role Mappings → ajouter <strong>realm-admin</strong>.
              </span>
            </div>
          )}

          <div className="filters-bar">
            <div className="filter-group">
              <label className="filter-label">Recherche</label>
              {searchInput(search, setSearch, 'Nom, email, username…')}
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Utilisateur</th><th>Email</th><th>Rôle plateforme</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading
                  ? [0,1,2,3].map(i => <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                  : filtered.length === 0
                    ? (
                      <tr><td colSpan={5}>
                        <div className="empty-state">
                          <div className="empty-icon"><UsersIcon size={20} /></div>
                          <div className="empty-title">{accessError ? 'Accès refusé' : search ? 'Aucun résultat' : 'Aucun utilisateur'}</div>
                        </div>
                      </td></tr>
                    )
                    : filtered.map(u => {
                        const roles        = userRoles[u.id] ?? []
                        const platformRole = getPlatformRole(roles)
                        return (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <UserAvatar user={u} platformRole={platformRole} />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u.firstName} {u.lastName}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.username}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: 13 }}>{u.email || '—'}</td>
                            <td>
                              {platformRole
                                ? <span style={{ background: getRoleColor(platformRole), color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{getRoleLabel(platformRole)}</span>
                                : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                            </td>
                            <td>
                              <span style={{ fontSize: 11, fontWeight: 600, color: u.enabled ? 'var(--green-600)' : 'var(--red-600)' }}>
                                {u.enabled ? '● Actif' : '● Inactif'}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-ghost"
                                style={{ height: 26, padding: '0 10px', fontSize: 11, color: u.enabled ? 'var(--red-600)' : 'var(--green-600)' }}
                                onClick={() => toggleUserStatus(u.id, u.enabled)}
                              >
                                {u.enabled ? 'Désactiver' : 'Activer'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab : Journal d'activité ─────────────────────── */}
      {tab === 'journal' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><Activity size={15} /></span>
              Journal d'activité
              <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filteredEvents.length}</span>
            </span>
            <button className="btn btn-secondary btn-icon" onClick={fetchEvents} title="Actualiser"><RefreshCw size={13} /></button>
          </div>

          {eventsError && (
            <div style={{ margin: '0 20px 16px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <AlertTriangle size={16} color="#b45309" />
              <span>
                <strong>Journal non disponible :</strong> L'enregistrement des événements doit être activé dans Keycloak.
                Aller sur <strong>http://localhost:18080</strong> → Realm <em>seed-v0</em> → Events → User Events Settings → activer <strong>Save Events</strong>.
              </span>
            </div>
          )}

          <div className="filters-bar">
            <div className="filter-group">
              <label className="filter-label">Recherche</label>
              {searchInput(eventSearch, setEventSearch, 'Utilisateur, IP, action…')}
            </div>
            <div className="filter-group">
              <label className="filter-label">Type d'événement</label>
              <select
                value={eventTypeFilter}
                onChange={e => setEventTypeFilter(e.target.value)}
                style={{ height: 34, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', fontSize: 13, fontFamily: 'var(--font-sans)', padding: '0 11px', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <option value="">Tous les types</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{getEventMeta(t).label}</option>)}
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Résultat</th>
                  <th>Adresse IP</th>
                  <th>Date et heure</th>
                  <th style={{ width: 52, textAlign: 'center' }}>Détail</th>
                </tr>
              </thead>
              <tbody>
                {eventsLoading
                  ? [0,1,2,3,4].map(i => <tr key={i}><td colSpan={6}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
                  : filteredEvents.length === 0
                    ? (
                      <tr><td colSpan={6}>
                        <div className="empty-state">
                          <div className="empty-icon"><Activity size={20} /></div>
                          <div className="empty-title">{eventsError ? 'Journal non disponible' : 'Aucun événement'}</div>
                          {!eventsError && <div className="empty-sub">Activez l'enregistrement des événements dans Keycloak</div>}
                        </div>
                      </td></tr>
                    )
                    : filteredEvents.map((ev, i) => {
                        const meta         = getEventMeta(ev.type)
                        const u            = getUserById(ev.userId)
                        const platformRole = u ? getPlatformRole(userRoles[u.id] ?? []) : ''
                        const displayName  = u
                          ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`).trim() || u.username
                          : ev.details?.username ?? `uid:${ev.userId?.slice(0, 8) ?? '?'}`
                        return (
                          <tr key={ev.id ?? i}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <UserAvatar user={u} platformRole={platformRole} size={30} />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 12 }}>{displayName}</div>
                                  {u && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{u.username}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: 12 }}>{meta.label}</td>
                            <td><EventStatusBadge status={meta.status} /></td>
                            <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{ev.ipAddress ?? '—'}</td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(ev.time)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-ghost btn-icon"
                                style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Voir le détail"
                                onClick={() => setSelectedEvent(ev)}
                              ><Eye size={13} /></button>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal : Créer utilisateur ─────────────────────── */}
      {showForm && (
        <Modal title="Nouvel utilisateur" subtitle="Créer un compte sur la plateforme Sen Jiwu" onClose={() => setShowForm(false)} size="lg">
          <form onSubmit={submitCreate}>
            <FormRow>
              <Field label="Prénom" required><FormInput value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Mamadou" required /></Field>
              <Field label="Nom" required><FormInput value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Diallo" required /></Field>
            </FormRow>
            <FormRow>
              <Field label="Nom d'utilisateur" required hint="Unique, sans espace"><FormInput value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} placeholder="mamadou.diallo" required /></Field>
              <Field label="Email"><FormInput type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="m.diallo@isra.sn" /></Field>
            </FormRow>
            <FormRow>
              <Field label="Mot de passe temporaire" required hint="L'utilisateur devra le modifier dès la première connexion">
                <FormInput type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required />
              </Field>
              <Field label="Rôle plateforme" required>
                <FormSelect value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, orgId: '' }))}>
                  {ROLES_PLATFORM.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </FormSelect>
              </Field>
            </FormRow>

            {/* Organisation — obligatoire pour UPSemCL, Multiplicateur, Quotataire */}
            {['seed-upsemcl', 'seed-multiplicator', 'seed-quotataire'].includes(form.role) && (
              <Field label="Organisation" required hint="Organisation à laquelle appartient cet utilisateur">
                {(() => {
                  const typeFilter: Record<string, string[]> = {
                    'seed-upsemcl':       ['UPSEMCL'],
                    'seed-multiplicator': ['MULTIPLICATEUR', 'COOPERATIVE'],
                    'seed-quotataire':    ['AUTRE'],
                  }
                  const types = typeFilter[form.role] ?? []
                  const filtered = organisations.filter(o => types.includes(o.typeOrganisation) && o.active !== false)
                  return (
                    <select
                      value={form.orgId}
                      onChange={e => setForm(f => ({ ...f, orgId: e.target.value }))}
                      required
                      style={{
                        width: '100%', padding: '0 12px', height: 36, borderRadius: 6,
                        border: '1px solid var(--border-strong)', background: 'var(--surface)',
                        fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--text)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">— Sélectionner une organisation —</option>
                      {filtered.map((o: any) => (
                        <option key={o.id} value={o.id}>
                          {o.nomOrganisation ?? o.nom_organisation} ({o.codeOrganisation ?? o.code_organisation})
                        </option>
                      ))}
                    </select>
                  )
                })()}
              </Field>
            )}

            {(form.role === 'seed-selector' || form.role === 'seed-admin') && (
              <div style={{
                padding: '8px 14px', borderRadius: 8, marginBottom: 16,
                background: 'var(--blue-50)', border: '1px solid var(--blue-200)',
                fontSize: 12, color: 'var(--blue-700)',
              }}>
                Organisation automatique : <strong>ISRA CNRA Bambey</strong>
              </div>
            )}

            {/* Spécialisation — uniquement pour les sélectionneurs */}
            {form.role === 'seed-selector' && (
              <Field label="Spécialisation (espèce / spéculation)" hint="Espèce sur laquelle le sélectionneur travaille principalement">
                <select
                  value={form.specialisation}
                  onChange={e => setForm(f => ({ ...f, specialisation: e.target.value }))}
                  style={{
                    width: '100%', padding: '0 12px', height: 36, borderRadius: 6,
                    border: '1px solid var(--border-strong)', background: 'var(--surface)',
                    fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">— Sélectionner une espèce —</option>
                  {especes.map((esp: any) => (
                    <option key={esp.id} value={esp.nomCommun}>
                      {esp.nomCommun}{esp.nomScientifique ? ` — ${esp.nomScientifique}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <FormActions onCancel={() => setShowForm(false)} loading={saving} submitLabel="Créer l'utilisateur" />
          </form>
        </Modal>
      )}

      {/* ── Modal : Détail d'un événement ────────────────── */}
      {selectedEvent !== null && (() => {
        const ev           = selectedEvent
        const meta         = getEventMeta(ev.type)
        const u            = getUserById(ev.userId)
        const platformRole = u ? getPlatformRole(userRoles[u.id] ?? []) : ''
        const displayName  = u
          ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`).trim() || u.username
          : ev.details?.username ?? 'Utilisateur inconnu'

        return (
          <Modal
            title="Détails de l'action"
            subtitle={formatDate(ev.time)}
            onClose={() => setSelectedEvent(null)}
            size="md"
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {u && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, color: u.enabled ? 'var(--red-600)' : 'var(--green-600)' }}
                    onClick={() => { toggleUserStatus(u.id, u.enabled); setSelectedEvent(null) }}
                  >
                    {u.enabled ? 'Suspendre ce compte' : 'Réactiver ce compte'}
                  </button>
                )}
                <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setSelectedEvent(null)}>
                  Fermer
                </button>
              </div>
            }
          >
            {/* En-tête utilisateur */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <UserAvatar user={u} platformRole={platformRole} size={48} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{displayName}</div>
                {u?.email && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{u.email}</div>}
                {!u && ev.details?.username && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>@{ev.details.username}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Client</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{ev.clientId ?? '—'}</div>
              </div>
            </div>

            {/* Section Permissions */}
            <div style={{ marginTop: 20 }}>
              <SectionLabel icon={<Shield size={12} />} text="Permissions" />
              <DetailGrid>
                <DetailCell label="Rôle">
                  {platformRole
                    ? <span style={{ background: getRoleColor(platformRole), color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>{getRoleLabel(platformRole)}</span>
                    : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non défini</span>}
                </DetailCell>
                <DetailCell label="Statut du compte">
                  <span style={{ fontWeight: 600, fontSize: 12, color: u?.enabled !== false ? 'var(--green-600)' : 'var(--red-600)' }}>
                    {u?.enabled !== false ? '● Actif' : '● Inactif'}
                  </span>
                </DetailCell>
              </DetailGrid>
            </div>

            {/* Section Informations */}
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <SectionLabel icon={<Info size={12} />} text="Informations" />
              <DetailGrid>
                <DetailCell label="Adresse IP">
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{ev.ipAddress ?? '—'}</span>
                </DetailCell>
                <DetailCell label="Navigateur">
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>Non renseigné</span>
                </DetailCell>
                <DetailCell label="Dispositif">
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>Non renseigné</span>
                </DetailCell>
                <DetailCell label="Action">
                  <EventStatusBadge status={meta.status} />
                  <div style={{ fontSize: 12, marginTop: 5, color: 'var(--text-secondary)' }}>{meta.label}</div>
                </DetailCell>
              </DetailGrid>

              {ev.error && (
                <div style={{ marginTop: 16, background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Erreur retournée</div>
                  <code style={{ fontSize: 12, color: '#7f1d1d' }}>{ev.error}</code>
                </div>
              )}

              {ev.sessionId && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Session ID</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{ev.sessionId}</div>
                </div>
              )}

              {ev.details && Object.keys(ev.details).filter(k => !['username', 'auth_method', 'auth_type', 'redirect_uri', 'consent', 'code_id'].includes(k)).length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>Détails supplémentaires</div>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {Object.entries(ev.details)
                      .filter(([k]) => !['auth_method', 'auth_type', 'redirect_uri', 'consent', 'code_id'].includes(k))
                      .map(([k, v]) => (
                        <div key={k}><strong>{k}</strong>: {v}</div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
