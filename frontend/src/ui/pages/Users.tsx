import React, { useEffect, useState } from 'react'
import { Users as UsersIcon, Plus, RefreshCw, Search, X, Shield, User, AlertTriangle } from 'lucide-react'
import { keycloak } from '../../lib/keycloak'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

const KEYCLOAK_ADMIN = 'http://localhost:18080'
const REALM = 'seed-v0'

const ROLES_PLATFORM = [
  { value: 'seed-admin',         label: 'Administrateur ISRA', color: '#7c3aed' },
  { value: 'seed-selector',      label: 'Sélectionneur',       color: '#0369a1' },
  { value: 'seed-upsemcl',        label: 'UPSemCL',             color: '#0f766e' },
  { value: 'seed-multiplicator', label: 'Multiplicateur',      color: '#15803d' },
  { value: 'seed-quotataire',    label: 'Quotataire / OP',     color: '#b45309' },
]

function getRoleColor(roleName: string) {
  return ROLES_PLATFORM.find(r => r.value === roleName)?.color || '#6b7280'
}

function getRoleLabel(roleName: string) {
  return ROLES_PLATFORM.find(r => r.value === roleName)?.label || roleName
}

function getPlatformRole(roles: string[]): string {
  return ROLES_PLATFORM.map(r => r.value).find(r => roles.includes(r)) || ''
}

export function Users({ roleKey }: Props) {
  const [users, setUsers] = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [accessError, setAccessError] = useState(false)

  const [form, setForm] = useState({
    username: '', firstName: '', lastName: '', email: '',
    password: '', role: 'seed-selector',
  })

  function adminHeaders() {
    return { Authorization: `Bearer ${keycloak.token}` }
  }

  async function fetchUsers() {
    setLoading(true)
    setAccessError(false)
    try {
      const res = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users?max=100`, {
        headers: adminHeaders(),
      })
      if (res.status === 403) { setAccessError(true); setLoading(false); return }
      const data = await res.json()
      setUsers(data)
      // Charger les rôles pour chaque utilisateur
      const rolesMap: Record<string, string[]> = {}
      await Promise.all(data.map(async (u: any) => {
        try {
          const r = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users/${u.id}/role-mappings/realm`, {
            headers: adminHeaders(),
          })
          const roleData = await r.json()
          rolesMap[u.id] = Array.isArray(roleData) ? roleData.map((ro: any) => ro.name) : []
        } catch { rolesMap[u.id] = [] }
      }))
      setUserRoles(rolesMap)
    } catch {
      setAccessError(true)
    } finally { setLoading(false) }
  }

  useEffect(() => { if (roleKey === 'seed-admin') fetchUsers() }, [])

  const filtered = users.filter(u =>
    !search ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    u.lastName?.toLowerCase().includes(search.toLowerCase())
  )

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      // 1. Créer l'utilisateur
      const createRes = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users`, {
        method: 'POST',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          enabled: true,
          credentials: [{ type: 'password', value: form.password, temporary: true }],
        }),
      })
      if (!createRes.ok) throw new Error(await createRes.text())

      // 2. Récupérer l'ID du nouvel utilisateur
      const location = createRes.headers.get('Location') || ''
      const newUserId = location.split('/').pop()
      if (!newUserId) throw new Error('ID utilisateur introuvable')

      // 3. Récupérer le rôle depuis Keycloak
      const rolesRes = await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/roles/${form.role}`, {
        headers: adminHeaders(),
      })
      if (!rolesRes.ok) throw new Error('Rôle introuvable')
      const roleObj = await rolesRes.json()

      // 4. Assigner le rôle
      await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users/${newUserId}/role-mappings/realm`, {
        method: 'POST',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify([roleObj]),
      })

      setToast({ msg: `Utilisateur ${form.username} créé avec succès (mot de passe temporaire)`, type: 'success' })
      setShowForm(false)
      setForm({ username: '', firstName: '', lastName: '', email: '', password: '', role: 'seed-selector' })
      fetchUsers()
    } catch (err: any) {
      setToast({ msg: err?.message || 'Erreur lors de la création', type: 'error' })
    } finally { setSaving(false) }
  }

  async function toggleUserStatus(userId: string, currentlyEnabled: boolean) {
    try {
      await fetch(`${KEYCLOAK_ADMIN}/admin/realms/${REALM}/users/${userId}`, {
        method: 'PUT',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentlyEnabled }),
      })
      setToast({ msg: `Utilisateur ${currentlyEnabled ? 'désactivé' : 'activé'}`, type: 'success' })
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

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon blue"><UsersIcon size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : users.length}</div><div className="stat-label">Utilisateurs total</div></div></div>
        <div className="stat-card"><div className="stat-icon green"><User size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : users.filter(u => u.enabled).length}</div><div className="stat-label">Actifs</div></div></div>
        <div className="stat-card"><div className="stat-icon gold"><Shield size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : ROLES_PLATFORM.length}</div><div className="stat-label">Rôles plateforme</div></div></div>
        <div className="stat-card"><div className="stat-icon red"><X size={18} /></div><div className="stat-body"><div className="stat-value">{loading ? '…' : users.filter(u => !u.enabled).length}</div><div className="stat-label">Désactivés</div></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title"><span className="card-title-icon"><UsersIcon size={15} /></span>
            Utilisateurs <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filtered.length}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Nouvel utilisateur</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchUsers}><RefreshCw size={13} /></button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34 }}>
              <Search size={13} color="var(--text-muted)" />
              <input placeholder="Nom, email, username…" value={search} onChange={e => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 220 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Utilisateur</th><th>Email</th><th>Rôle plateforme</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? [0,1,2,3].map(i => <tr key={i}><td colSpan={5}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>) :
                filtered.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><div className="empty-icon"><UsersIcon size={20} /></div><div className="empty-title">{accessError ? 'Accès refusé' : search ? 'Aucun résultat' : 'Aucun utilisateur'}</div></div></td></tr>
                ) : filtered.map(u => {
                  const roles = userRoles[u.id] || []
                  const platformRole = getPlatformRole(roles)
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: platformRole ? `linear-gradient(135deg, ${getRoleColor(platformRole)}, #0c1f15)` : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: platformRole ? '#fff' : '#6b7280', flexShrink: 0 }}>
                            {((u.firstName || u.username || '?').charAt(0) + (u.lastName || '').charAt(0)).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{u.firstName} {u.lastName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{u.email || '—'}</td>
                      <td>
                        {platformRole ? (
                          <span style={{ background: getRoleColor(platformRole), color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                            {getRoleLabel(platformRole)}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
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
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Création utilisateur */}
      {showForm && (
        <Modal title="Nouvel utilisateur" subtitle="Créer un compte sur la plateforme Seed" onClose={() => setShowForm(false)} size="lg">
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
              <Field label="Mot de passe temporaire" required hint="L'utilisateur devra le changer à la connexion">
                <FormInput type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required />
              </Field>
              <Field label="Rôle plateforme" required>
                <FormSelect value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES_PLATFORM.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </FormSelect>
              </Field>
            </FormRow>
            <FormActions onCancel={() => setShowForm(false)} loading={saving} submitLabel="Créer l'utilisateur" />
          </form>
        </Modal>
      )}
    </div>
  )
}
