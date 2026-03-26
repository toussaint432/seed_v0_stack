import React from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const variantConfig = {
  danger:  { icon: Trash2,         bg: '#fef2f2', border: '#fecaca', color: '#dc2626', btnBg: '#dc2626' },
  warning: { icon: AlertTriangle,  bg: '#fef9ed', border: '#fde68a', color: '#92660a', btnBg: '#d97706' },
  info:    { icon: AlertTriangle,  bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', btnBg: '#2563eb' },
}

export function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cfg = variantConfig[variant]
  const Icon = cfg.icon

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-container"
        style={{ maxWidth: 420 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} color={cfg.color} />
            </div>
            <div>
              <div className="modal-title">{title}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '16px 24px 24px' }}>
          <p style={{
            fontSize: 13.5, color: 'var(--text-secondary)',
            lineHeight: 1.6, margin: 0,
          }}>
            {message}
          </p>
          {detail && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 8,
              fontSize: 12.5,
              color: cfg.color,
              fontWeight: 500,
            }}>
              {detail}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-2)',
          borderRadius: '0 0 12px 12px',
        }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className="btn"
            style={{
              background: cfg.btnBg,
              color: '#fff',
              border: 'none',
              opacity: loading ? 0.7 : 1,
            }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'En cours…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
