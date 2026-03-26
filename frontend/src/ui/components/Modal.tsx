import React from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ title, subtitle, onClose, children, size = 'md' }: Props) {
  const widths = { sm: 480, md: 600, lg: 780 }
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 12, width: '100%', maxWidth: widths[size],
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/* ── Form helpers ── */
export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}{required && <span style={{ color: 'var(--red-500)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

export function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} style={{
      width: '100%', height: 36, padding: '0 11px',
      border: '1px solid var(--border-strong)', borderRadius: 6,
      fontSize: 13, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)',
      background: 'white', outline: 'none', boxSizing: 'border-box',
      ...props.style,
    }}
    onFocus={e => e.currentTarget.style.borderColor = 'var(--green-600)'}
    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
    />
  )
}

export function FormSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{
      width: '100%', height: 36, padding: '0 11px',
      border: '1px solid var(--border-strong)', borderRadius: 6,
      fontSize: 13, fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)',
      background: 'white', outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
      ...props.style,
    }}>
      {children}
    </select>
  )
}

export function FormRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

export function FormActions({
  onCancel, loading,
  submitLabel = 'Enregistrer',
  submitClassName = 'btn-primary',
}: {
  onCancel: () => void
  loading?: boolean
  submitLabel?: string
  submitClassName?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
      <button type="submit" className={`btn ${submitClassName}`} disabled={loading}>
        {loading ? 'Enregistrement…' : submitLabel}
      </button>
    </div>
  )
}

export function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [])
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 3000,
      background: type === 'success' ? '#166534' : '#dc2626',
      color: 'white', padding: '12px 18px', borderRadius: 8,
      fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)', animation: 'slideUp 0.2s ease',
    }}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', marginLeft: 8, fontSize: 16 }}>×</button>
      <style>{`@keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}
