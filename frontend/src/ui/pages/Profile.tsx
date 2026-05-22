import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  User, Mail, Shield, Calendar, LogOut, Key,
  Camera, Edit3, Check, X, Lock, Eye, EyeOff, RefreshCw, Trash2,
  Clock, Globe, Bell,
} from 'lucide-react'
import { keycloak } from '../../lib/keycloak'
import { Modal, Field, FormInput, FormRow, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

const KEYCLOAK_BASE = 'http://localhost:18080'
const REALM         = 'seed-v0'

const ROLE_INFO: Record<string, { label: string; color: string; bg: string; description: string; icon: string }> = {
  'seed-admin':         { label: 'Administrateur ISRA', color: '#7c3aed', bg: '#f5f3ff', description: 'Supervision globale — accès complet à toute la plateforme', icon: '◆' },
  'seed-selector':      { label: 'Sélectionneur',       color: '#0369a1', bg: '#eff6ff', description: 'Gestion des variétés · création des lots G0/G1 · transfert vers UPSemCL', icon: '⬡' },
  'seed-upsemcl':       { label: 'UPSemCL',             color: '#0f766e', bg: '#f0fdfa', description: 'Réception G1 → multiplication G1→G3 → transfert G3 aux multiplicateurs', icon: '●' },
  'seed-multiplicator': { label: 'Multiplicateur',      color: '#15803d', bg: '#f0fdf4', description: 'Réception G3 → production G4→R1→R2 pour commercialisation', icon: '▲' },
  'seed-quotataire':    { label: 'Quotataire / OP',     color: '#b45309', bg: '#fffbeb', description: 'Consultation du catalogue et passation de commandes de semences R2', icon: '■' },
}

export function Profile({ roleKey }: Props) {
  const token = keycloak.tokenParsed as any
  if (!token) return null

  const userId   = token.sub as string
  const username = token.preferred_username || '—'
  const role     = ROLE_INFO[roleKey]
  const accent   = role?.color || '#16a34a'

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

  function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setToast({ msg: 'Image trop lourde (max 2 Mo)', type: 'error' }); return }
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

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${KEYCLOAK_BASE}/realms/${REALM}/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keycloak.token}` },
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

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    if (pwdForm.newPwd !== pwdForm.confirm) { setToast({ msg: 'Les mots de passe ne correspondent pas', type: 'error' }); return }
    if (pwdForm.newPwd.length < 8) { setToast({ msg: 'Minimum 8 caractères requis', type: 'error' }); return }
    setPwdSaving(true)
    try {
      const res = await fetch(`${KEYCLOAK_BASE}/realms/${REALM}/account/credentials/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keycloak.token}` },
        body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.newPwd, confirmation: pwdForm.confirm }),
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
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ═══════════════ HERO CARD ═══════════════ */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>

        {/* Bannière dégradée */}
        <div style={{
          height: 170,
          background: role
            ? `linear-gradient(135deg, ${role.color} 0%, ${role.color}cc 35%, #0c1520 100%)`
            : 'linear-gradient(135deg, #1b4332 0%, #0c1520 100%)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Motifs géométriques */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          {/* Cercles décoratifs */}
          <div style={{ position: 'absolute', top: -50, right: -30, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', top: 30, right: 140, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: '38%', width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
          {/* Bande dégradée bas — contraste derrière identité overlap */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, background: `linear-gradient(to bottom, transparent 0%, ${role?.color ?? '#1b4332'}66 35%, rgba(0,0,0,0.72) 100%)`, pointerEvents: 'none' }} />
          {/* Watermark */}
          <div style={{ position: 'absolute', left: 28, bottom: 14, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Mono, monospace', userSelect: 'none', zIndex: 1 }}>
            SEN JIW · ISRA · SÉNÉGAL
          </div>
          {/* Boutons top-right */}
          <div style={{ position: 'absolute', top: 16, right: 20, display: 'flex', gap: 8 }}>
            {!editing && (
              <button className="btn" onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', height: 34, fontSize: 12.5 }}>
                <Edit3 size={13} /> Modifier le profil
              </button>
            )}
            <button className="btn" style={{ background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', height: 34, fontSize: 12.5 }}
              onClick={() => keycloak.logout({ redirectUri: window.location.origin })}>
              <LogOut size={13} /> Déconnexion
            </button>
          </div>
        </div>

        {/* Corps hero */}
        <div style={{ padding: '0 32px 26px' }}>
          {/* Avatar + identité */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, marginTop: -56 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 108, height: 108, borderRadius: '50%',
                background: role ? `linear-gradient(145deg, ${role.color}, ${role.color}99)` : 'linear-gradient(145deg, #374151, #1f2937)',
                border: '4px solid white',
                outline: `3px solid ${accent}`,
                boxShadow: `0 6px 20px rgba(0,0,0,0.25), 0 0 0 6px ${accent}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 800, color: '#fff',
                overflow: 'hidden', userSelect: 'none', letterSpacing: '-0.02em',
              }}>
                {photoUrl
                  ? <img src={photoUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials
                }
              </div>
              <button onClick={() => fileRef.current?.click()} title="Changer la photo"
                style={{ position: 'absolute', bottom: 4, right: 2, width: 28, height: 28, borderRadius: '50%', background: accent, border: '2.5px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                <Camera size={12} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </div>

            {/* Nom + rôle */}
            <div style={{ paddingBottom: 6, flex: 1, minWidth: 0 }}>
              {role && (
                <div style={{ marginBottom: 7 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: accent, color: '#fff', borderRadius: 99,
                    padding: '3px 12px', fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    boxShadow: `0 2px 10px ${accent}44`,
                  }}>
                    <Shield size={9} /> {role.label}
                  </span>
                </div>
              )}
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, fontFamily: 'Fraunces, serif', textShadow: '0 1px 6px rgba(0,0,0,0.45)' }}>
                {displayName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.92)', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: 6, padding: '3px 10px', fontFamily: 'DM Mono, monospace', backdropFilter: 'blur(6px)' }}>
                  <User size={10} /> {username}
                </span>
                {token.email && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
                    <Mail size={10} /> {token.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bandeau description rôle */}
          {role && (
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, background: `${accent}0d`, border: `1px solid ${accent}28`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: '10px 16px' }}>
              <Shield size={14} color={accent} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{role.description}</span>
            </div>
          )}

          {/* Gestion photo */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {photoUrl
                ? <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border)' }}>
                    <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-2)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} style={{ color: 'var(--text-muted)' }} />
                  </div>
              }
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Photo de profil</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {photoUrl ? 'Visible par vos contacts' : 'Aucune photo — initiales affichées'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} style={{ fontSize: 12, height: 32 }}>
                <Camera size={12} /> {photoUrl ? 'Modifier' : 'Ajouter une photo'}
              </button>
              {photoUrl && (
                <button type="button" className="btn btn-secondary" onClick={deletePhoto} style={{ fontSize: 12, height: 32, color: '#dc2626', borderColor: '#fca5a5' }}>
                  <Trash2 size={12} /> Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ FORMULAIRE ÉDITION / INFO CARDS ═══════════════ */}
      {editing ? (
        <div className="card" style={{ marginBottom: 18, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Edit3 size={13} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Modifier les informations</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Les modifications sont appliquées via Keycloak</div>
            </div>
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
              <button type="button" className="btn btn-ghost" onClick={cancelEdit}><X size={13} /> Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: accent, borderColor: accent }}>
                {saving
                  ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Enregistrement…</>
                  : <><Check size={13} /> Enregistrer</>
                }
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>

          {/* Informations personnelles */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <SectionTitle icon={<User size={12} />} color={accent}>Informations personnelles</SectionTitle>
            <InfoRow label="Prénom"            value={token.given_name  || '—'} icon={<User size={12} />}     accent={accent} />
            <InfoRow label="Nom"               value={token.family_name || '—'} icon={<User size={12} />}     accent={accent} />
            <InfoRow label="Nom d'utilisateur" value={username}                  icon={<User size={12} />} accent={accent} mono />
            <InfoRow label="Email"             value={token.email || '—'}        icon={<Mail size={12} />}     accent={accent} last />
          </div>

          {/* Accès & Session */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <SectionTitle icon={<Shield size={12} />} color={accent}>Accès &amp; Session</SectionTitle>
            <InfoRow
              label="Rôle"
              value={role?.label || roleKey || 'Non assigné'}
              icon={<Shield size={12} />}
              accent={accent}
              valueStyle={{ color: accent, fontWeight: 700 }}
            />
            <InfoRow label="Connecté depuis" value={issuedAt}  icon={<Clock size={12} />}    accent={accent} />
            <InfoRow label="Session expire"  value={expiresAt} icon={<Calendar size={12} />} accent={accent} />
            <InfoRow label="Realm"           value="seed-v0"   icon={<Globe size={12} />}    accent={accent} mono last />
          </div>
        </div>
      )}

      {/* ═══════════════ SÉCURITÉ ═══════════════ */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <SectionTitle icon={<Lock size={12} />} color={accent}>Sécurité</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Mot de passe */}
          <div style={{ padding: '16px 18px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}14`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Key size={17} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 3 }}>Mot de passe</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>Modifier votre mot de passe de connexion</div>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => setShowPwd(true)} style={{ fontSize: 12, height: 32, marginTop: 2 }}>
              <Lock size={12} /> Modifier le mot de passe
            </button>
          </div>

          {/* Session */}
          <div style={{ padding: '16px 18px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}14`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bell size={17} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 3 }}>Session active</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Expire le <strong style={{ color: 'var(--text-secondary)' }}>{expiresAt}</strong>
                </div>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => keycloak.updateToken(300).catch(() => keycloak.login())} style={{ fontSize: 12, height: 32, marginTop: 2 }}>
              <RefreshCw size={12} /> Renouveler la session
            </button>
          </div>
        </div>
      </div>

      {/* Modal mot de passe */}
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
                <FormInput type={showCurrent ? 'text' : 'password'} value={pwdForm.current} onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} placeholder="••••••••" required style={{ paddingRight: 40 }} />
                <EyeToggle show={showCurrent} onToggle={() => setShowCurrent(s => !s)} />
              </div>
            </Field>
            <Field label="Nouveau mot de passe" required hint="Minimum 8 caractères">
              <div style={{ position: 'relative' }}>
                <FormInput type={showNew ? 'text' : 'password'} value={pwdForm.newPwd} onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))} placeholder="••••••••" required style={{ paddingRight: 40 }} />
                <EyeToggle show={showNew} onToggle={() => setShowNew(s => !s)} />
              </div>
              {pwdForm.newPwd.length > 0 && pwdForm.newPwd.length < 8 && (
                <p style={{ fontSize: 11, color: 'var(--red-600)', marginTop: 4 }}>Trop court — minimum 8 caractères</p>
              )}
            </Field>
            <Field label="Confirmer le nouveau mot de passe" required>
              <div style={{ position: 'relative' }}>
                <FormInput type={showConfirm ? 'text' : 'password'} value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} placeholder="••••••••" required style={{ paddingRight: 40 }} />
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(s => !s)} />
              </div>
              {pwdForm.confirm && pwdForm.newPwd !== pwdForm.confirm && (
                <p style={{ fontSize: 11, color: 'var(--red-600)', marginTop: 4 }}>Les mots de passe ne correspondent pas</p>
              )}
            </Field>
            <FormActions onCancel={() => { setShowPwd(false); setPwdForm({ current: '', newPwd: '', confirm: '' }) }} loading={pwdSaving} submitLabel="Changer le mot de passe" />
          </form>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/* ── Sub-components ── */
function SectionTitle({ icon, children, color }: { icon: ReactNode; children: ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
      <div style={{ width: 22, height: 22, borderRadius: 5, background: color ? `${color}18` : 'var(--surface-3)', color: color || 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {children}
      </span>
    </div>
  )
}

function InfoRow({
  label, value, icon, mono, accent, last, valueStyle,
}: {
  label: string; value: string; icon?: ReactNode
  mono?: boolean; accent?: string; last?: boolean; valueStyle?: { [k: string]: string | number }
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && (
          <div style={{ width: 22, height: 22, borderRadius: 5, background: accent ? `${accent}12` : 'var(--surface-3)', color: accent || 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
        fontFamily: mono ? 'DM Mono, monospace' : undefined,
        ...valueStyle,
      }}>
        {value}
      </span>
    </div>
  )
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
      {show ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  )
}
