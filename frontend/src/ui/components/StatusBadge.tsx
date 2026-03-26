import React from 'react'
import { CheckCircle2, Clock, XCircle, AlertTriangle, Send, Package, Truck, Shield, Eye } from 'lucide-react'

/* ── Configuration centralisée des statuts ── */

interface StatusConfig {
  label: string
  bg: string
  color: string
  border: string
  icon?: React.ElementType
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Lots
  EN_PRODUCTION:  { label: 'En production',  bg: '#fef9ed', color: '#92660a', border: '#fde68a', icon: Clock },
  DISPONIBLE:     { label: 'Disponible',     bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
  TRANSFERE:      { label: 'Transféré',      bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: Send },
  EPUISE:         { label: 'Épuisé',         bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', icon: XCircle },

  // Commandes
  PENDING:        { label: 'En attente',     bg: '#fef9ed', color: '#92660a', border: '#fde68a', icon: Clock },
  EN_ATTENTE:     { label: 'En attente',     bg: '#fef9ed', color: '#92660a', border: '#fde68a', icon: Clock },
  CONFIRMED:      { label: 'Confirmée',      bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: CheckCircle2 },
  CONFIRMEE:      { label: 'Confirmée',      bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: CheckCircle2 },
  ALLOCATED:      { label: 'Allouée',        bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: Package },
  ALLOUEE:        { label: 'Allouée',        bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: Package },
  CANCELLED:      { label: 'Annulée',        bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: XCircle },
  ANNULEE:        { label: 'Annulée',        bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: XCircle },

  // Transferts
  DEMANDE:        { label: 'Demandé',        bg: '#fef9ed', color: '#92660a', border: '#fde68a', icon: Clock },
  VALIDE:         { label: 'Validé',         bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: CheckCircle2 },
  EXPEDIE:        { label: 'Expédié',        bg: '#faf5ff', color: '#6d28d9', border: '#e9d5ff', icon: Truck },
  RECEPTIONNE:    { label: 'Réceptionné',    bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
  ANNULE:         { label: 'Annulé',         bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: XCircle },

  // Certification
  EN_COURS:       { label: 'En cours',       bg: '#fef9ed', color: '#92660a', border: '#fde68a', icon: Clock },
  CERTIFIE:       { label: 'Certifié',       bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: Shield },
  REJETE:         { label: 'Rejeté',         bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: XCircle },
  EXPIRE:         { label: 'Expiré',         bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', icon: AlertTriangle },

  // Certification résultat
  CONFORME:       { label: 'Conforme',       bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
  NON_CONFORME:   { label: 'Non conforme',   bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: XCircle },

  // Programmes
  PLANIFIE:       { label: 'Planifié',       bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: Clock },
  TERMINE:        { label: 'Terminé',        bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },

  // Variétés
  DIFFUSEE:       { label: 'Diffusée',       bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
  EN_TEST:        { label: 'En test',        bg: '#fef9ed', color: '#92660a', border: '#fde68a', icon: Eye },
  RETIREE:        { label: 'Retirée',        bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: XCircle },

  // Campagnes
  OUVERTE:        { label: 'Ouverte',        bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
  FERMEE:         { label: 'Fermée',         bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', icon: XCircle },

  // Generic
  ACTIF:          { label: 'Actif',          bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
  INACTIF:        { label: 'Inactif',        bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: XCircle },
}

interface StatusBadgeProps {
  status: string | undefined | null
  showIcon?: boolean
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, showIcon = false, size = 'sm' }: StatusBadgeProps) {
  if (!status) return <span className="badge badge-gray">—</span>

  const cfg = STATUS_MAP[status.toUpperCase()] || STATUS_MAP[status]
  if (!cfg) {
    return <span className="badge badge-gray">{status}</span>
  }

  const Icon = cfg.icon
  const fontSize = size === 'sm' ? 11 : 12.5
  const padding = size === 'sm' ? '2px 8px' : '4px 12px'

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        borderRadius: 99,
        padding,
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {showIcon && Icon && <Icon size={size === 'sm' ? 10 : 12} />}
      {cfg.label}
    </span>
  )
}

/** Retourne le label d'un statut */
export function getStatusLabel(status: string): string {
  return STATUS_MAP[status]?.label || status
}

/** Retourne la config d'un statut */
export function getStatusConfig(status: string): StatusConfig | undefined {
  return STATUS_MAP[status]
}
