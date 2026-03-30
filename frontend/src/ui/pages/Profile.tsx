import React, { useRef, useState } from 'react'
import {
  User, Mail, Shield, Calendar, LogOut, Key,
  Camera, Edit3, Check, X, Lock, Eye, EyeOff, RefreshCw, Trash2,
} from 'lucide-react'
import { keycloak } from '../../lib/keycloak'
import { Modal, Field, FormInput, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

const KEYCLOAK_BASE = 'http://localhost:18080'
const REALM         = 'seed-v0'

const ROLE_INFO: Record<string, { label: string; color: string; description: string }> = {
  'seed-admin':         { label: 'Administrateur ISRA', color: '#7c3aed', description: 'Supervision globale — accès complet à toute la plateforme' },
  'seed-selector':      { label: 'Sélectionneur',       color: '#0369a1', description: 'Gestion des variétés · création des lots G0/G1 · transfert vers UPSemCL' },
  'seed-upseml':        { label: 'UPSemCL',             color: '#0f766e', description: 'Réception G1 → multiplication G1→G3 → transfert G3 aux multiplicateurs' },
  'seed-multiplicator': { label: 'Multiplicateur',      color: '#15803d', description: 'Réception G3 → production G4→R1→R2 pour commercialisation' },
  'seed-quotataire':    { label: 'Quotataire / OP',     color: '#b45309', description: 'Consultation du catalogue et passation de commandes de semences R2' },
}

export function Profile({ roleKey }: Props) {
  const token = keycloak.tokenParsed as any
  if (!token) return null

  const userId   = token.sub as string
  const username = token.preferred_username || '—'
  const role     = ROLE_INFO[roleKey]

  /* ── State ── */
  const [editing,    setEditing]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [showPwd,    setShowPwd]    = useState(false)
  const [pwdSaving,  setPwdSaving]  = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [firstName, setFirstName] = useState(token.given_name  || '')
  const [lastName,  setLastName]  = useState(token.family_name || '')
  const [email,     setEmail]     = useState(token.email       || '')

  const [pwdForm,       setPwdForm]       = useState({ current: '', newPwd: '', confirm: '' })
  const [showCurrent,   setShowCurrent]   = useState(false)
  const [showNew,       setShowNew]       = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)

  const [photoUrl, setPhotoUrl] = useState<string | null>(
    localStorage.getItem(`seed-avatar-${userId}`)
  )
  const fileRef = useRef<HTMLInputElement>(null)

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || username
  const initials    = ((firstName || username).charAt(0) + (lastName || '').charAt(0)).toUpperCase().slice(0, 2) || 'U'
  const issuedAt    = token.iat ? new Date(token.iat * 1000).toLocaleString('fr-FR') : '—'
  const expiresAt   = token.exp ? new Date(token.exp * 1000).toLocaleString('fr-FR') : '—'

  /* ── Handlers ── */
  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setToast({ msg: 'Image trop lourde (max 2 Mo)', type: 'error' }); return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      localStorage.setItem(`seed-avatar-${userId}`, url)
      setPhotoUrl(url)
      setToast({ msg: 'Photo de profil mise à jour', type: 'success' })
    }
    reader.readAsDataURL(file)
  }

  function deletePhoto() {
    localStorage.removeItem(`seed-avatar-${userId}`)
    setPhotoUrl(null)
    setToast({ msg: 'Photo de profil supprimée', type: 'success' })
  }

  function cancelEdit() {
    setFirstName(token.given_name  || '')
    setLastName (token.family_name || '')
    setEmail    (token.email       || '')
    setEditing(false)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${KEYCLOAK_BASE}/realms/${REALM}/account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keycloak.token}`,
        },
        body: JSON.stringify({ firstName, lastName, email, username }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.errorMessage || 'Erreur lors de la mise à jour')
      }
      await keycloak.updateToken(-1)
      setToast({ msg: 'Profil mis à jour avec succès', type: 'success' })
      setEditing(false)
    } catch (err: any) {
      setToast({ msg: err.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwdForm.newPwd !== pwdForm.confirm) {
      setToast({ msg: 'Les mots de passe ne correspondent pas', type: 'error' }); return
    }
    if (pwdForm.newPwd.length < 8) {
      setToast({ msg: 'Minimum 8 caractères requis', type: 'error' }); return
    }
    setPwdSaving(true)
    try {
      const res = await fetch(`${KEYCLOAK_BASE}/realms/${REALM}/account/credentials/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keycloak.token}`,
        },
        body: JSON.stringify({
          currentPassword: pwdForm.current,
          newPassword:     pwdForm.newPwd,
          confirmation:    pwdForm.confirm,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.errorMessage || 'Mot de passe actuel incorrect')
      }
      setToast({ msg: 'Mot de passe modifié — reconnexion dans 2 s', type: 'success' })
      setShowPwd(false)
      setPwdForm({ current: '', newPwd: '', confirm: '' })
      setTimeout(() => keycloak.logout({ redirectUri: window.location.origin }), 2000)
    } catch (err: any) {
      setToast({ msg: err.message || 'Erreur', type: 'error' })
    } finally { setPwdSaving(false) }
  }

  /* ── Render ── */
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Hero ── */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>

        {/* Bannière */}
        <div style={{
          height: 110,
          background: role
            ? `linear-gradient(135deg, ${role.color}ee 0%, #0c1f15 100%)`
            : 'linear-gradient(135deg, #1e3a2f, #0c1f15)',
          position: 'relative',
        }}>
          {/* Motif décoratif */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.07,
            backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {/* Boutons en haut à droite */}
          <div style={{ position: 'absolute', top: 14, right: 20, display: 'flex', gap: 8 }}>
            {!editing && (
              <button className="btn btn-secondary" onClick={() => setEditing(true)}
                style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                <Edit3 size={13} /> Modifier le profil
              </button>
            )}
            <button className="btn btn-secondary"
              style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff', backdropFilter: 'blur(4px)' }}
              onClick={() => keycloak.logout({ redirectUri: window.location.origin })}>
              <LogOut size={13} /> Déconnexion
            </button>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding: '0 28px 24px' }}>

          {/* Ligne avatar + identité */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: -46 }}>

            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: role
                  ? `linear-gradient(135deg, ${role.color}, #0c1f15)`
                  : 'linear-gradient(135deg, #6b7280, #374151)',
                border: '4px solid var(--surface)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 700, color: '#fff',
                overflow: 'hidden', userSelect: 'none',
              }}>
                {photoUrl
                  ? <img src={photoUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials
                }
              </div>
              <button onClick={() => fileRef.current?.click()} title="Changer la photo" style={{
                position: 'absolute', bottom: 3, right: 3,
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--green-600)', border: '3px solid var(--surface)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
              }}>
                <Camera size={12} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </div>

            {/* Nom + identité */}
            <div style={{ paddingBottom: 6, flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {displayName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: 'var(--text-muted)',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '2px 8px', fontFamily: 'DM Mono, monospace',
                }}>
                  <User size={11} /> {username}
                </span>
                {token.email && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    <Mail size={11} /> {token.email}
                  </span>
                )}
              </div>
              {role && (
                <span style={{
                  display: 'inline-block', marginTop: 8,
                  background: role.color, color: '#fff',
                  borderRadius: 20, padding: '3px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                  boxShadow: `0 2px 8px ${role.color}55`,
                }}>
                  {role.label}
                </span>
              )}
            </div>
          </div>

          {/* Description du rôle */}
          {role && (
            <div style={{
              marginTop: 16,
              background: `${role.color}0d`, border: `1px solid ${role.color}28`,
              borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)',
            }}>
              {role.description}
            </div>
          )}

          {/* ── Gestion photo — toujours visible ── */}
          <div style={{
            marginTop: 16, paddingTop: 14,
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {photoUrl
                ? <div style={{
                    width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                    border: '2px solid var(--border)',
                  }}>
                    <img src={photoUrl} alt="miniature" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                : <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--surface-2)', border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <User size={15} style={{ color: 'var(--text-muted)' }} />
                  </div>
              }
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Photo de profil</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {photoUrl ? 'Visible par vos contacts' : 'Aucune photo — initiales affichées'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 12 }}>
                <Camera size={13} /> {photoUrl ? 'Modifier' : 'Ajouter une photo'}
              </button>
              {photoUrl && (
                <button type="button" className="btn btn-secondary"
                  onClick={deletePhoto}
                  style={{ fontSize: 12, color: '#dc2626', borderColor: '#fca5a5' }}>
                  <Trash2 size={13} /> Supprimer
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Formulaire d'édition ── */}
      {editing ? (
        <div className="card" style={{ marginBottom: 20, padding: '24px 28px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>
            Modifier les informations personnelles
          </div>
          <form onSubmit={saveProfile}>
            <FormRow>
              <Field label="Prénom" required>
                <FormInput value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Mamadou" required />
              </Field>
              <Field label="Nom" required>
                <FormInput value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Diallo" required />
              </Field>
            </FormRow>
            <Field label="Adresse email">
              <FormInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="m.diallo@isra.sn" />
            </Field>
            <FormRow>
              <Field label="Nom d'utilisateur" hint="Non modifiable">
                <FormInput value={username} disabled style={{ opacity: 0.55, cursor: 'not-allowed', background: 'var(--surface-2)' }} />
              </Field>
              <Field label="Rôle plateforme" hint="Géré par l'administrateur">
                <FormInput value={role?.label || roleKey} disabled style={{ opacity: 0.55, cursor: 'not-allowed', background: 'var(--surface-2)' }} />
              </Field>
            </FormRow>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                <X size={13} /> Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving
                  ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Enregistrement…</>
                  : <><Check size={13} /> Enregistrer</>
                }
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ── Affichage lecture ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div className="card" style={{ padding: '20px 24px' }}>
            <SectionTitle icon={<User size={13} />}>Informations personnelles</SectionTitle>
            <InfoRow label="Prénom"           value={token.given_name  || '—'} />
            <InfoRow label="Nom"              value={token.family_name || '—'} />
            <InfoRow label="Nom d'utilisateur" value={username} mono />
            <InfoRow label="Email"            value={token.email || '—'} icon={<Mail size={12} />} />
          </div>
          <div className="card" style={{ padding: '20px 24px' }}>
            <SectionTitle icon={<Shield size={13} />}>Accès & Session</SectionTitle>
            <InfoRow label="Rôle"            value={role?.label || roleKey || 'Non assigné'} icon={<Shield size={12} />} />
            <InfoRow label="Connecté depuis" value={issuedAt}  icon={<Calendar size={12} />} />
            <InfoRow label="Session expire"  value={expiresAt} icon={<Calendar size={12} />} />
            <InfoRow label="Realm"           value="seed-v0"   mono />
          </div>
        </div>
      )}

      {/* ── Sécurité ── */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <SectionTitle icon={<Lock size={13} />}>Sécurité</SectionTitle>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Mot de passe</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Changer votre mot de passe de connexion</div>
          </div>
          <button className="btn btn-secondary" onClick={() => setShowPwd(true)}>
            <Lock size={13} /> Modifier le mot de passe
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Session active</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Expire le {expiresAt}</div>
          </div>
          <button className="btn btn-secondary" onClick={() => keycloak.updateToken(300).catch(() => keycloak.login())}>
            <RefreshCw size={13} /> Renouveler la session
          </button>
        </div>
      </div>

      {/* ── Modal mot de passe ── */}
      {showPwd && (
        <Modal
          title="Modifier le mot de passe"
          subtitle="Minimum 8 caractères. Vous serez déconnecté après le changement."
          onClose={() => { setShowPwd(false); setPwdForm({ current: '', newPwd: '', confirm: '' }) }}
          size="sm"
        >
          <form onSubmit={changePassword}>
            <Field label="Mot de passe actuel" required>
              <div style={{ position: 'relative' }}>
                <FormInput
                  type={showCurrent ? 'text' : 'password'}
                  value={pwdForm.current}
                  onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: 40 }}
                />
                <EyeToggle show={showCurrent} onToggle={() => setShowCurrent(s => !s)} />
              </div>
            </Field>

            <Field label="Nouveau mot de passe" required hint="Minimum 8 caractères">
              <div style={{ position: 'relative' }}>
                <FormInput
                  type={showNew ? 'text' : 'password'}
                  value={pwdForm.newPwd}
                  onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: 40 }}
                />
                <EyeToggle show={showNew} onToggle={() => setShowNew(s => !s)} />
              </div>
              {pwdForm.newPwd.length > 0 && pwdForm.newPwd.length < 8 && (
                <p style={{ fontSize: 11, color: 'var(--red-600)', marginTop: 4 }}>Trop court — minimum 8 caractères</p>
              )}
            </Field>

            <Field label="Confirmer le nouveau mot de passe" required>
              <div style={{ position: 'relative' }}>
                <FormInput
                  type={showConfirm ? 'text' : 'password'}
                  value={pwdForm.confirm}
                  onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: 40 }}
                />
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(s => !s)} />
              </div>
              {pwdForm.confirm && pwdForm.newPwd !== pwdForm.confirm && (
                <p style={{ fontSize: 11, color: 'var(--red-600)', marginTop: 4 }}>Les mots de passe ne correspondent pas</p>
              )}
            </Field>

            <FormActions
              onCancel={() => { setShowPwd(false); setPwdForm({ current: '', newPwd: '', confirm: '' }) }}
              loading={pwdSaving}
              submitLabel="Changer le mot de passe"
            />
          </form>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ── Sub-components ── */
function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {icon} {children}
    </div>
  )
}

function InfoRow({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
        display: 'flex', alignItems: 'center', gap: 5,
        fontFamily: mono ? 'DM Mono, monospace' : undefined,
      }}>
        {icon}{value}
      </span>
    </div>
  )
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
        display: 'flex', padding: 2,
      }}
    >
      {show ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  )
}
