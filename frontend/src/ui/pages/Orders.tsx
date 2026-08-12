import React, { useEffect, useState, useMemo } from 'react'
import {
  ShoppingCart, RefreshCw, Plus, Settings2, Clock, XCircle, PackageCheck,
  Search, X, ChevronLeft, ChevronRight, CheckCircle2, Ban, Eye, Building2,
  TrendingUp, TrendingDown, BarChart2, Truck, Receipt, Zap,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeVariete, extractList } from '../../lib/normalizers'
import { Modal, Field, FormInput, FormSelect, FormActions, Toast } from '../components/Modal'

interface Props { roleKey: string }

// ─── Statuts ─────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  SOUMISE:        { label: 'Soumise',           bg: '#eff6ff', color: '#1d4ed8' },
  EN_NEGOCIATION: { label: 'En négociation',    bg: '#fefce8', color: '#92400e' },
  ACCORDEE:       { label: 'Accordée',          bg: '#f0fdf4', color: '#15803d' },
  EN_LIVRAISON:   { label: 'En livraison',      bg: '#f5f3ff', color: '#6d28d9' },
  LIVREE:         { label: 'Livrée',            bg: '#ecfdf5', color: '#065f46' },
  ANNULEE:        { label: 'Annulée',           bg: '#fef2f2', color: '#dc2626' },
  REJETEE:        { label: 'Rejetée',           bg: '#fef2f2', color: '#dc2626' },
  ACCEPTEE:       { label: 'Acceptée',          bg: '#f0fdf4', color: '#15803d' },
  EN_PREPARATION: { label: 'En préparation',    bg: '#f5f3ff', color: '#6d28d9' },
}
const PAGE_SIZE = 10
const PIPELINE_STEPS = [
  { key: 'SOUMISE',         label: 'Soumise'       },
  { key: 'EN_NEGOCIATION',  label: 'Négociation'   },
  { key: 'ACCORDEE',        label: 'Accordée'      },
  { key: 'EN_LIVRAISON',    label: 'En livraison'  },
  { key: 'LIVREE',          label: 'Livrée'        },
]
const PIPELINE_IDX: Record<string, number> = {
  SOUMISE: 0, EN_NEGOCIATION: 1, ACCORDEE: 2, EN_LIVRAISON: 3, LIVREE: 4,
  ACCEPTEE: 1, EN_PREPARATION: 2,
}
const TERMINAL = ['ANNULEE', 'REJETEE']
const NEXT_ACTIONS: Record<string, { statut: string; label: string; danger?: boolean }[]> = {
  SOUMISE:        [{ statut: 'ACCEPTEE',       label: 'Accepter'            }, { statut: 'REJETEE',  label: 'Rejeter',  danger: true }],
  ACCEPTEE:       [{ statut: 'EN_PREPARATION', label: 'Démarrer préparation'}, { statut: 'ANNULEE',  label: 'Annuler',  danger: true }],
  EN_PREPARATION: [{ statut: 'LIVREE',         label: 'Marquer livrée'     }, { statut: 'ANNULEE',  label: 'Annuler',  danger: true }],
}
const GENERATIONS_CMD = [
  { id: '1', label: 'G0 — Pré-base' }, { id: '2', label: 'G1 — Base' },
  { id: '3', label: 'G2 — R1' },       { id: '4', label: 'G3 — R2' },
  { id: '5', label: 'G4 — R3' },       { id: '6', label: 'R1' },
  { id: '7', label: 'R2 — Certifiée' },
]

/** Correspondance idGeneration (1–7) → libellé affiché dans les tableaux et modales */
const GEN_LABELS: Record<number, string> = {
  1: 'G0 — Pré-base', 2: 'G1 — Base', 3: 'G2', 4: 'G3', 5: 'G4', 6: 'R1', 7: 'R2 — Certifiée',
}

/** Formate un Instant ISO en "dd/MM/yyyy à HH:mm:ss" pour la piste d'audit. */
function fmtDatetime(value?: string | null): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return `${date} à ${time}`
  } catch { return value }
}

// KPI filter predicates
type KpiKey = 'pending' | 'accepted' | 'rejected' | 'delivered'
const KPI_FILTER: Record<KpiKey, (o: any) => boolean> = {
  pending:   o => o.statut === 'SOUMISE',
  accepted:  o => ['ACCEPTEE','EN_PREPARATION','EN_NEGOCIATION','ACCORDEE','EN_LIVRAISON'].includes(o.statut),
  rejected:  o => ['ANNULEE','REJETEE'].includes(o.statut),
  delivered: o => o.statut === 'LIVREE',
}

// ─── Types et constantes du graphe d'évolution ────────────────────────────────
type Periode  = '7J' | '4S' | '3M' | '6M' | '12M'
type SerieKey = 'LIVREE' | 'EN_COURS' | 'SOUMISE' | 'ANNULEE'

interface PointData extends Record<SerieKey, number> {
  label: string; sublabel: string; total: number
}

const SERIE_CFG: ReadonlyArray<{ key: SerieKey; label: string; couleur: string }> = [
  { key: 'LIVREE',   label: 'Livrées',        couleur: '#10b981' },
  { key: 'EN_COURS', label: 'En cours',        couleur: '#f59e0b' },
  { key: 'SOUMISE',  label: 'Soumises',        couleur: '#3b82f6' },
  { key: 'ANNULEE',  label: 'Annulées/Rejet.', couleur: '#ef4444' },
]

const SERIE_COULEUR: Record<SerieKey, string> = {
  LIVREE: '#10b981', EN_COURS: '#f59e0b', SOUMISE: '#3b82f6', ANNULEE: '#ef4444',
}

// Calcul des ticks de l'axe Y à intervalles lisibles
function calcTicksY(max: number): number[] {
  if (max <= 0) return [0, 1]
  const pas = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 60 ? 10 : max <= 120 ? 20 : 50
  const ticks: number[] = []
  for (let t = 0; t <= max; t += pas) ticks.push(t)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + pas)
  return ticks
}

// Construction d'un point de données à partir d'un tableau de commandes
function buildPointData(label: string, sublabel: string, cmds: any[]): PointData {
  const nb = (ss: string[]) => cmds.filter(o => ss.includes(o.statut)).length
  return {
    label, sublabel, total: cmds.length,
    SOUMISE:  nb(['SOUMISE']),
    EN_COURS: nb(['ACCEPTEE','EN_PREPARATION','EN_NEGOCIATION','ACCORDEE','EN_LIVRAISON']),
    LIVREE:   nb(['LIVREE']),
    ANNULEE:  nb(['ANNULEE', 'REJETEE']),
  }
}

// Agrégation des commandes selon la granularité temporelle choisie
function calcPeriode(orders: any[], periode: Periode): PointData[] {
  const now = new Date()

  // Granularité jour : 7 derniers jours glissants
  if (periode === '7J') {
    return Array.from({ length: 7 }, (_, i) => {
      const d0 = new Date(now); d0.setDate(now.getDate() - (6 - i)); d0.setHours(0, 0, 0, 0)
      const d1 = new Date(d0); d1.setHours(23, 59, 59, 999)
      return buildPointData(
        d0.toLocaleDateString('fr-FR', { weekday: 'short' }),
        d0.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        orders.filter(o => { if (!o.createdAt) return false; const t = new Date(o.createdAt); return t >= d0 && t <= d1 })
      )
    })
  }

  // Granularité semaine : 4 dernières semaines glissantes (lun–dim)
  if (periode === '4S') {
    return Array.from({ length: 4 }, (_, i) => {
      const fin   = new Date(now); fin.setDate(now.getDate() - i * 7); fin.setHours(23, 59, 59, 999)
      const debut = new Date(fin); debut.setDate(fin.getDate() - 6); debut.setHours(0, 0, 0, 0)
      return buildPointData(
        `S${4 - i}`,
        debut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        orders.filter(o => { if (!o.createdAt) return false; const t = new Date(o.createdAt); return t >= debut && t <= fin })
      )
    }).reverse()
  }

  // Granularité mois : 3M / 6M / 12M
  const nbMois = periode === '3M' ? 3 : periode === '6M' ? 6 : 12
  return Array.from({ length: nbMois }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (nbMois - 1 - i), 1)
    return buildPointData(
      d.toLocaleDateString('fr-FR', { month: 'short' }),
      d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      orders.filter(o => {
        if (!o.createdAt) return false
        const od = new Date(o.createdAt)
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth()
      })
    )
  })
}

// Mini indicateur statistique de synthèse
function StatMini({ label, value, couleur, icon }: {
  label: string; value: string | number; couleur?: string; icon?: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: couleur ?? 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, lineHeight: 1.2 }}>
        {icon}{value}
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </div>
    </div>
  )
}

// ─── Composants partagés ──────────────────────────────────────────────────────

function StatusBadge({ statut }: { statut: string }) {
  const cfg = STATUS_CFG[statut]
  return cfg
    ? <span className="badge" style={{ background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
    : <span className="badge badge-gray">{statut || '—'}</span>
}

// Carte KPI cliquable — accent en bordure haute (design épuré, sans barre latérale)
interface KpiProps {
  icon: React.ReactNode; value: number | string; label: string
  accent: string; active?: boolean; onClick?: () => void; loading?: boolean
}
function KpiCard({ icon, value, label, accent, active, onClick, loading }: KpiProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${accent}08` : 'var(--surface)',
        border: `1px solid ${active ? accent + '30' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '15px 18px 17px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .18s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: active ? `0 2px 10px ${accent}14` : 'var(--shadow-xs)',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--surface-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? accent : 'var(--text-secondary)', flexShrink: 0, marginTop: 2,
        transition: 'color .18s',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginBottom: 6 }}>
          {loading ? <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>…</span> : value}
        </div>
        <div style={{ fontSize: 11.5, color: active ? accent : 'var(--text-muted)', fontWeight: active ? 600 : 500 }}>
          {label}
        </div>
      </div>
      {active && (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0, marginTop: 4, boxShadow: `0 0 0 3px ${accent}25` }} />
      )}
    </div>
  )
}

// Graphe d'évolution avancé avec sélecteur de période et barres empilées par statut
function EvolutionChart({ orders }: { orders: any[] }) {
  const [periode, setPeriode] = useState<Periode>('6M')
  const [hovered, setHovered] = useState<number | null>(null)

  const data     = useMemo(() => calcPeriode(orders, periode), [orders, periode])
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const yTicks   = useMemo(() => calcTicksY(maxTotal), [maxTotal])

  // ── KPI de synthèse sur la période affichée ──
  const totalP = data.reduce((s, d) => s + d.total,   0)
  const totalL = data.reduce((s, d) => s + d.LIVREE,  0)
  const totalA = data.reduce((s, d) => s + d.ANNULEE, 0)
  const tauxL  = totalP > 0 ? Math.round(totalL / totalP * 100) : 0
  const tauxA  = totalP > 0 ? Math.round(totalA / totalP * 100) : 0
  // Tendance : 1re moitié vs 2e moitié de la période
  const mid   = Math.floor(data.length / 2)
  const avant = data.slice(0, mid).reduce((s, d) => s + d.total, 0)
  const apres = data.slice(mid).reduce((s, d)  => s + d.total,   0)
  const delta = avant > 0 ? Math.round((apres - avant) / avant * 100) : null

  // ── Dimensions SVG ──
  const W = 560, PL = 28, PR = 8, PB = 22, PT = 10, PH = 90
  const n    = data.length
  const GAP  = n > 8 ? 3 : 6
  const BARW = Math.max(Math.floor((W - PL - PR - GAP * (n - 1)) / n), 6)
  const yFor = (v: number) => PT + PH - Math.round((v / maxTotal) * PH)

  // Tooltip HTML : position en pourcentage de la largeur du SVG
  const hovData    = hovered !== null ? data[hovered] : null
  const tooltipPct = hovered !== null
    ? Math.min(Math.max((PL + hovered * (BARW + GAP) + BARW / 2) / W * 100, 12), 88)
    : 50

  // Ordre d'empilement bas → haut (annulées au fond, livrées au sommet)
  const ORDRE: SerieKey[] = ['ANNULEE', 'SOUMISE', 'EN_COURS', 'LIVREE']

  return (
    <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>

      {/* ── En-tête + sélecteur de période ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={15} color="var(--text-muted)" />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>
            Évolution des commandes
          </span>
        </div>
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', gap: 2 }}>
          {(['7J', '4S', '3M', '6M', '12M'] as Periode[]).map(p => (
            <button key={p} onClick={() => { setPeriode(p); setHovered(null) }}
              style={{
                padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700,
                background: periode === p ? '#16a34a' : 'transparent',
                color:      periode === p ? '#fff'    : 'var(--text-muted)',
                transition: 'all .12s',
              }}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* ── Indicateurs de synthèse ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
        <StatMini label="Total commandes"        value={totalP} />
        <StatMini label={`Livrées · ${tauxL}%`}  value={totalL} couleur="#10b981" icon={<Truck   size={11} />} />
        <StatMini label={`Annulées · ${tauxA}%`} value={totalA} couleur="#ef4444" icon={<XCircle size={11} />} />
        <StatMini
          label="Tendance période"
          value={delta !== null ? `${delta >= 0 ? '+' : ''}${delta}%` : '—'}
          couleur={delta === null ? undefined : delta >= 0 ? '#22c55e' : '#ef4444'}
          icon={delta !== null ? (delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />) : undefined}
        />
      </div>

      {/* ── Graphe SVG barres empilées ── */}
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${PT + PH + PB}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: 'visible', display: 'block' }}
        >
          {/* Axe Y : lignes de grille et labels */}
          {yTicks.filter(t => t <= maxTotal + 1).map(t => {
            const y = yFor(t)
            return (
              <g key={t}>
                <line x1={PL} y1={y} x2={W - PR} y2={y}
                  stroke={t === 0 ? 'var(--border-strong,#cbd5e1)' : 'var(--border,#e2e8f0)'}
                  strokeWidth={t === 0 ? 1 : 0.6}
                  strokeDasharray={t === 0 ? undefined : '3,3'} />
                <text x={PL - 4} y={y + 3.5} textAnchor="end" fontSize={8}
                  fill="var(--text-muted)" fontFamily="Outfit,sans-serif">{t}</text>
              </g>
            )
          })}

          {/* Barres empilées par statut */}
          {data.map((d, i) => {
            const bx    = PL + i * (BARW + GAP)
            const isHov = hovered === i
            let yBot    = PT + PH   // curseur de l'empilement (bas → haut)

            return (
              <g key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Fond de la barre */}
                <rect x={bx} y={PT} width={BARW} height={PH} rx={4}
                  fill="var(--surface-2,#f1f5f9)" opacity={isHov ? 0.9 : 0.55} />

                {/* Segments colorés par statut */}
                {ORDRE.map(key => {
                  const val = d[key]; if (!val) return null
                  const bh  = Math.max(Math.round((val / maxTotal) * PH), 2)
                  const by  = yBot - bh; yBot -= bh
                  return (
                    <rect key={key} x={bx} y={by} width={BARW} height={bh}
                      fill={SERIE_COULEUR[key]} opacity={isHov ? 1 : 0.84} rx={0} />
                  )
                })}

                {/* Total affiché au-dessus */}
                {d.total > 0 && (
                  <text x={bx + BARW / 2} y={yBot - 3} textAnchor="middle" fontSize={8}
                    fontWeight="700"
                    fill={isHov ? 'var(--text-primary)' : 'var(--text-muted)'}
                    fontFamily="Outfit,sans-serif">{d.total}</text>
                )}

                {/* Label axe X */}
                <text x={bx + BARW / 2} y={PT + PH + 14} textAnchor="middle" fontSize={8}
                  fontWeight={isHov ? '700' : '400'}
                  fill={isHov ? 'var(--text-primary)' : 'var(--text-muted)'}
                  fontFamily="Outfit,sans-serif">{d.label}</text>
              </g>
            )
          })}
        </svg>

        {/* Tooltip HTML absolu sur la barre survolée */}
        {hovData && (
          <div style={{
            position: 'absolute', top: 0, left: `${tooltipPct}%`,
            transform: 'translateX(-50%) translateY(-105%)',
            background: 'var(--surface)', border: '1px solid var(--border-strong)',
            borderRadius: 8, padding: '8px 11px', fontSize: 11,
            pointerEvents: 'none', zIndex: 20, minWidth: 150,
            boxShadow: '0 4px 16px rgba(0,0,0,.13)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 11.5, marginBottom: 6, paddingBottom: 5, borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              {hovData.sublabel || hovData.label}
              <span style={{ marginLeft: 6, color: '#16a34a', fontWeight: 800 }}>{hovData.total}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> cmd{hovData.total > 1 ? 's' : ''}</span>
            </div>
            {SERIE_CFG.filter(s => hovData[s.key] > 0).map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.couleur, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.couleur }}>{hovData[s.key]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Légende ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, justifyContent: 'center' }}>
        {SERIE_CFG.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: s.couleur, flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Pipeline progression statut
function StatusPipeline({ statut }: { statut: string }) {
  const isTerminal = TERMINAL.includes(statut)
  const idx = PIPELINE_IDX[statut] ?? (isTerminal ? -1 : -1)
  return (
    <div style={{ margin: '14px 0 18px', padding: '14px 12px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Progression de la commande</div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {PIPELINE_STEPS.flatMap((step, i) => {
          const done    = !isTerminal && idx > i
          const current = !isTerminal && idx === i
          return [
            <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, zIndex: 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: done ? 14 : 11, fontWeight: 700, background: done ? '#dcfce7' : current ? '#16a34a' : '#f1f5f9', color: done ? '#15803d' : current ? 'white' : '#94a3b8', border: `2px solid ${done ? '#86efac' : current ? '#16a34a' : '#e2e8f0'}`, transition: 'all .2s' }}>
                {done ? '✓' : current ? '●' : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: current ? 700 : 500, color: current ? '#15803d' : done ? '#16a34a' : '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>{step.label}</span>
            </div>,
            i < PIPELINE_STEPS.length - 1
              ? <div key={step.key + '-c'} style={{ flex: '0 0 12px', height: 2, background: done ? '#86efac' : '#e2e8f0', marginTop: 13 }} />
              : null,
          ].filter(Boolean)
        })}
      </div>
      {isTerminal && (
        <div style={{ marginTop: 10, padding: '7px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
          <XCircle size={13} /> {STATUS_CFG[statut]?.label ?? statut} — Commande clôturée
        </div>
      )}
    </div>
  )
}

// Tableau générique avec pagination + modal détail
interface OrderTableProps {
  orders: any[]; loading: boolean; emptyMsg: string
  orgs?: any[]; varieties?: any[]
  onUpdateStatus?: (id: number, statut: string) => Promise<void>
  /** Intercepte les commandes G3 SOUMISE → ouvre TraiterCommandeG3Modal */
  onValiderG3?: (cmd: any) => void
  extraColumns?: { head: string; cell: (o: any) => React.ReactNode }[]
}
function OrderTable({ orders, loading, emptyMsg, orgs = [], varieties = [], onUpdateStatus, onValiderG3, extraColumns = [] }: OrderTableProps) {
  const [page, setPage]     = useState(1)
  const [detail, setDetail] = useState<any>(null)
  const [actioning, setActioning] = useState(false)
  const total = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
  const slice = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const colCount = 5 + extraColumns.length + (onUpdateStatus ? 1 : 0) + 1

  const orgName = (id: number | null) => {
    if (!id) return '—'
    const f = orgs.find((o: any) => o.id === id)
    return f ? f.nomOrganisation : `#${id}`
  }
  const handleAction = async (statut: string) => {
    if (!detail || !onUpdateStatus) return
    setActioning(true)
    try { await onUpdateStatus(detail.id, statut); setDetail((d: any) => d ? { ...d, statut } : null) }
    finally { setActioning(false) }
  }
  const nextActions = detail ? (NEXT_ACTIONS[detail.statut] ?? []) : []

  return (
    <>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Code commande</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Fournisseur</th>
              {extraColumns.map(c => <th key={c.head}>{c.head}</th>)}
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [0,1,2,3].map(i => <tr key={i}><td colSpan={colCount}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>)
              : orders.length === 0
                ? <tr><td colSpan={colCount}><div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-icon"><ShoppingCart size={20} /></div><div className="empty-title">{emptyMsg}</div></div></td></tr>
                : slice.map(o => (
                  <tr key={o.id}>
                    <td><span className="td-mono" style={{ fontWeight: 600 }}>{o.codeCommande}</span></td>
                    <td style={{ fontWeight: 500 }}>{o.client || '—'}</td>
                    <td><StatusBadge statut={o.statut} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{orgName(o.idOrganisationFournisseur)}</td>
                    {extraColumns.map(c => <td key={c.head}>{c.cell(o)}</td>)}
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtDatetime(o.createdAt)}</td>
                    <td><button className="btn btn-ghost btn-icon" style={{ width: 30, height: 30 }} onClick={() => setDetail(o)}><Eye size={13} /></button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      {!loading && orders.length > PAGE_SIZE && (
        <div className="pagination">
          <span className="pagination-info">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, orders.length)} sur {orders.length}</span>
          <div className="pagination-btns">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}><ChevronLeft size={13} /></button>
            {Array.from({ length: Math.min(total,5) }, (_,i) => i+1).map(n => (
              <button key={n} className={"page-btn " + (page===n?'active':'')} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="page-btn" onClick={() => setPage(p => Math.min(total,p+1))} disabled={page===total}><ChevronRight size={13} /></button>
          </div>
        </div>
      )}

      {detail && (
        <Modal
          title={`Commande — ${detail.codeCommande}`}
          subtitle={`${detail.usernameAcheteur || '—'} · ${fmtDatetime(detail.createdAt)}`}
          onClose={() => setDetail(null)} size="md"
        >
          <StatusPipeline statut={detail.statut} />
          <div style={{ display: 'grid', gap: 8, fontSize: 13, marginBottom: 16 }}>
            {([
              ['Client',          detail.client || '—'],
              ['Fournisseur',     orgName(detail.idOrganisationFournisseur)],
              ['Org acheteur',    orgName(detail.idOrganisationAcheteur)],
              ['Soumise le',      fmtDatetime(detail.createdAt)],
              ['Observations',    detail.observations || '—'],
            ] as [string,string][]).map(([k,v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span style={{ minWidth: 120, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k}</span>
                <span style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
          {Array.isArray(detail.lignes) && detail.lignes.length > 0 && (() => {
            const hasProposee = detail.lignes.some((l: any) => l.quantiteProposee != null)
            const totalDemande = detail.lignes.reduce((s: number, l: any) => s + Number(l.quantiteDemandee || 0), 0)
            const totalValidee = hasProposee ? detail.lignes.reduce((s: number, l: any) => s + Number(l.quantiteProposee ?? l.quantiteDemandee ?? 0), 0) : null
            const hasDiff = totalValidee !== null && totalValidee !== totalDemande
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Lignes ({detail.lignes.length})
                  {hasDiff && (
                    <span style={{ fontSize: 10.5, fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 7px', textTransform: 'none', letterSpacing: 0 }}>
                      Demandé : {totalDemande} kg → Validé : {totalValidee} kg ({totalValidee! - totalDemande > 0 ? '+' : ''}{totalValidee! - totalDemande} kg)
                    </span>
                  )}
                </div>
                <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Variété</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Génération</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{hasProposee ? 'Demandée' : 'Quantité'}</th>
                      {hasProposee && <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Validée</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lignes.map((l: any, i: number) => {
                      const v = varieties.find((vv: any) => vv.id === l.idVariete)
                      const diff = hasProposee && l.quantiteProposee != null
                        ? Number(l.quantiteProposee) - Number(l.quantiteDemandee)
                        : null
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                            {v ? v.nomVariete : `Variété #${l.idVariete}`}
                            {v && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 5 }}>({v.codeVariete})</span>}
                          </td>
                          <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>
                            {GEN_LABELS[l.idGeneration] ?? `Gén. #${l.idGeneration}`}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: hasProposee ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                            {l.quantiteDemandee} {l.unite}
                          </td>
                          {hasProposee && (
                            <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                              {l.quantiteProposee != null ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <strong style={{ color: diff === 0 ? 'var(--text-primary)' : diff! < 0 ? '#b45309' : '#15803d' }}>
                                    {l.quantiteProposee} {l.unite}
                                  </strong>
                                  {diff !== 0 && (
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, borderRadius: 3, padding: '1px 5px',
                                      background: diff! < 0 ? '#fef3c7' : '#dcfce7',
                                      color: diff! < 0 ? '#92400e' : '#166534',
                                    }}>
                                      {diff! > 0 ? '+' : ''}{diff} kg
                                    </span>
                                  )}
                                </span>
                              ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })()}
          {onUpdateStatus && nextActions.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Action :</span>
              {nextActions.map(a => {
                /* Interception : commande G3 SOUMISE → "Préparer & Livrer" à la place de "Accepter" */
                const isG3Flow = a.statut === 'ACCEPTEE' && onValiderG3 != null &&
                  Array.isArray(detail?.lignes) &&
                  detail.lignes.some((l: any) => l.idGeneration === 4)
                if (isG3Flow) {
                  return (
                    <button
                      key="valider-g3"
                      className="btn btn-primary"
                      style={{ height: 32, fontSize: 12, background: 'linear-gradient(135deg, #16a34a, #059669)', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => { setDetail(null); onValiderG3!(detail) }}
                    >
                      <Zap size={12} /> Préparer &amp; Livrer
                    </button>
                  )
                }
                return (
                  <button
                    key={a.statut}
                    className={`btn ${a.danger ? 'btn-ghost' : 'btn-primary'}`}
                    style={a.danger ? { color: 'var(--red-600)', border: '1px solid #fecaca', height: 32, fontSize: 12 } : { height: 32, fontSize: 12 }}
                    onClick={() => handleAction(a.statut)}
                    disabled={actioning}
                  >
                    {a.danger ? <Ban size={12} /> : <CheckCircle2 size={12} />} {a.label}
                  </button>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VUE QUOTATAIRE
   ══════════════════════════════════════════════════════════════════════════════ */
function VueQuotataire({ setToast }: { setToast: any }) {
  const [orders,    setOrders]    = useState<any[]>([])
  const [orgs,      setOrgs]      = useState<any[]>([])
  const [varieties, setVarieties] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [kpiFilter, setKpiFilter] = useState<KpiKey | null>(null)
  const [search,    setSearch]    = useState('')

  const [form, setForm] = useState({
    idOrganisationFournisseur: '',
    observations: '',
    lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }],
  })

  async function fetchAll() {
    setLoading(true)
    const [ordRes, orgRes, varRes] = await Promise.allSettled([
      api.get(endpoints.ordersMesCommandes),
      api.get(endpoints.organisations),
      api.get(endpoints.varieties),
    ])
    setOrders(ordRes.status === 'fulfilled' ? extractList(ordRes.value.data) : [])
    if (orgRes.status === 'fulfilled')
      setOrgs(orgRes.value.data.filter((o: any) => o.typeOrganisation?.toLowerCase().includes('multiplic') && o.active !== false))
    if (varRes.status === 'fulfilled')
      setVarieties(extractList(varRes.value.data).map(normalizeVariete).filter((v: any) => v.statutVariete === 'DIFFUSEE'))
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  function addLigne()                             { setForm(f => ({ ...f, lignes: [...f.lignes, { idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] })) }
  function removeLigne(i: number)                 { setForm(f => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) })) }
  function updateLigne(i: number, k: string, v: string) { setForm(f => ({ ...f, lignes: f.lignes.map((l, j) => j === i ? { ...l, [k]: v } : l) })) }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      const code = 'CMD-' + Date.now().toString(36).toUpperCase()
      await api.post(endpoints.orders, {
        codeCommande: code, client: 'Commande portail',
        idOrganisationFournisseur: form.idOrganisationFournisseur ? Number(form.idOrganisationFournisseur) : null,
        observations: form.observations || null,
        lignes: form.lignes.map(l => ({ idVariete: Number(l.idVariete), idGeneration: Number(l.idGeneration), quantite: Number(l.quantite), unite: l.unite })),
      })
      setToast({ msg: `Commande ${code} soumise`, type: 'success' })
      setShowForm(false)
      setForm({ idOrganisationFournisseur: '', observations: '', lignes: [{ idVariete: '', idGeneration: '7', quantite: '', unite: 'kg' }] })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  const pending   = orders.filter(o => o.statut === 'SOUMISE').length
  const confirmed = orders.filter(o => o.statut === 'ACCEPTEE').length
  const cancelled = orders.filter(o => ['ANNULEE','REJETEE'].includes(o.statut)).length
  const delivered = orders.filter(o => o.statut === 'LIVREE').length

  const toggleKpi = (k: KpiKey) => setKpiFilter(kpiFilter === k ? null : k)

  const displayed = orders.filter(o => {
    const matchKpi    = !kpiFilter || KPI_FILTER[kpiFilter](o)
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    return matchKpi && matchSearch
  })

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard icon={<ShoppingCart size={20} />}  value={orders.length}  label="Mes commandes"  accent="#3b82f6" loading={loading} />
        <KpiCard icon={<Clock size={20} />}          value={pending}        label="En attente"     accent="#f59e0b" active={kpiFilter === 'pending'}   onClick={() => toggleKpi('pending')}   loading={loading} />
        <KpiCard icon={<PackageCheck size={20} />}   value={confirmed}      label="Confirmées"     accent="#22c55e" active={kpiFilter === 'accepted'}   onClick={() => toggleKpi('accepted')}  loading={loading} />
        <KpiCard icon={<Truck size={20} />}          value={delivered}      label="Livrées"        accent="#10b981" active={kpiFilter === 'delivered'}  onClick={() => toggleKpi('delivered')} loading={loading} />
      </div>

      {/* Graphe évolution */}
      {!loading && <EvolutionChart orders={orders} />}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Receipt size={15} /></span>
            Mes commandes
            {kpiFilter && (
              <span style={{ marginLeft: 8, fontSize: 11, background: '#3b82f620', color: '#1d4ed8', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                Filtre actif
              </span>
            )}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{displayed.length}{displayed.length !== orders.length && `/${orders.length}`}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={13} /> Nouvelle commande</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input placeholder="Code ou client…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer filtres</button>}
        </div>
        <OrderTable orders={displayed} loading={loading} emptyMsg="Aucune commande" orgs={orgs} varieties={varieties} />
      </div>

      {showForm && (
        <Modal title="Nouvelle Commande" subtitle="Soumettre une demande de semences certifiées" onClose={() => setShowForm(false)} size="lg">
          <form onSubmit={submitOrder}>
            <Field label="Organisation fournisseur" hint="Multiplicateur qui fournira les semences">
              <FormSelect value={form.idOrganisationFournisseur} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, idOrganisationFournisseur: e.target.value }))}>
                <option value="">— Choisir un fournisseur —</option>
                {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.nomOrganisation} ({o.region || o.localite || 'N/A'})</option>)}
              </FormSelect>
            </Field>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Lignes <span style={{ color: 'var(--red-500)' }}>*</span></label>
                <button type="button" className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={addLigne}><Plus size={11} /> Ajouter</button>
              </div>
              {form.lignes.map((ligne, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Ligne {i+1}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <Field label="Variété" required>
                      <FormSelect value={ligne.idVariete} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'idVariete',e.target.value)} required>
                        <option value="">— Variété —</option>
                        {Object.entries(
                          varieties.reduce((acc: Record<string,any[]>, v: any) => { const k = v.espece?.codeEspece||'Autre'; (acc[k]=acc[k]||[]).push(v); return acc }, {})
                        ).sort(([a],[b]) => a.localeCompare(b)).map(([esp, vs]) => (
                          <optgroup key={esp} label={esp}>
                            {(vs as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.nomVariete} ({v.codeVariete})</option>)}
                          </optgroup>
                        ))}
                      </FormSelect>
                    </Field>
                    <Field label="Génération" required>
                      <FormSelect value={ligne.idGeneration} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'idGeneration',e.target.value)}>
                        {GENERATIONS_CMD.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </FormSelect>
                    </Field>
                    <Field label="Quantité" required>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <FormInput type="number" value={ligne.quantite} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLigne(i,'quantite',e.target.value)} placeholder="500" min="1" required style={{ flex: 1 }} />
                        <FormSelect value={ligne.unite} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigne(i,'unite',e.target.value)} style={{ width: 70 }}>
                          <option value="kg">kg</option><option value="t">t</option>
                        </FormSelect>
                      </div>
                    </Field>
                    {form.lignes.length > 1 && (
                      <button type="button" onClick={() => removeLigne(i)} style={{ height: 36, width: 36, background: 'var(--red-50)', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: 'var(--red-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}><X size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Field label="Observations">
              <textarea value={form.observations} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Précisions sur la commande…" rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setShowForm(false)} loading={saving} submitLabel="Soumettre la commande" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VUE MULTIPLICATEUR
   ══════════════════════════════════════════════════════════════════════════════ */
function VueMultiplicateur({ setToast }: { setToast: any }) {
  const [onglet,        setOnglet]        = useState<'recues'|'demandes'>('recues')
  const [recues,        setRecues]        = useState<any[]>([])
  const [demandes,      setDemandes]      = useState<any[]>([])
  const [loadingR,      setLoadingR]      = useState(true)
  const [loadingD,      setLoadingD]      = useState(true)
  const [kpiFilter,     setKpiFilter]     = useState<KpiKey | null>(null)
  const [search,        setSearch]        = useState('')
  const [refusModal,    setRefusModal]    = useState<{ id: number; code: string } | null>(null)
  const [motif,         setMotif]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [actioning,     setActioning]     = useState<number | null>(null)
  const [varieties,     setVarieties]     = useState<any[]>([])
  const [orgs,          setOrgs]          = useState<any[]>([])
  const [showForm,      setShowForm]      = useState(false)
  const [formSaving,    setFormSaving]    = useState(false)
  const [voirPropModal, setVoirPropModal] = useState<any | null>(null)
  const [form, setForm] = useState({
    observations: '',
    lignes: [{ idVariete: '', quantite: '', unite: 'kg' }],
  })

  async function fetchAll() {
    setLoadingR(true); setLoadingD(true)
    const [rRes, dRes, varRes, orgRes] = await Promise.allSettled([
      api.get(endpoints.ordersATraiter),
      api.get(endpoints.ordersMesDemandesG3),
      api.get(endpoints.varieties),
      api.get(endpoints.organisations),
    ])
    setRecues(rRes.status === 'fulfilled' ? extractList(rRes.value.data) : [])
    setLoadingR(false)
    setDemandes(dRes.status === 'fulfilled' ? extractList(dRes.value.data) : [])
    setLoadingD(false)
    if (varRes.status === 'fulfilled') setVarieties(extractList(varRes.value.data).map(normalizeVariete))
    if (orgRes.status === 'fulfilled')
      setOrgs(orgRes.value.data.filter((o: any) => o.typeOrganisation?.toUpperCase().includes('UPSEMCL') && o.active !== false))
  }
  useEffect(() => { fetchAll() }, [])

  function addLigneM()    { setForm(f => ({ ...f, lignes: [...f.lignes, { idVariete: '', quantite: '', unite: 'kg' }] })) }
  function removeLigneM(i: number) { setForm(f => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) })) }
  function updateLigneM(i: number, k: string, v: string) { setForm(f => ({ ...f, lignes: f.lignes.map((l, j) => j === i ? { ...l, [k]: v } : l) })) }

  async function submitOrderM(e: React.FormEvent) {
    e.preventDefault(); setFormSaving(true)
    try {
      const code = 'CMD-G3-' + Date.now().toString(36).toUpperCase()
      /* Le fournisseur est l'UPSemCL — on prend le premier s'il y en a plusieurs */
      const idFournisseur = orgs.length > 0 ? orgs[0].id : null
      await api.post(endpoints.orders, {
        codeCommande: code,
        client: 'Demande multiplicateur',
        idOrganisationFournisseur: idFournisseur,
        observations: form.observations || null,
        /* Génération toujours G3 (idGeneration = 4) pour les multiplicateurs */
        lignes: form.lignes.map(l => ({
          idVariete:   Number(l.idVariete),
          idGeneration: 4,
          quantite:    Number(l.quantite),
          unite:       l.unite,
        })),
      })
      setToast({ msg: `Demande ${code} soumise à l'UPSemCL`, type: 'success' })
      setShowForm(false)
      setForm({ observations: '', lignes: [{ idVariete: '', quantite: '', unite: 'kg' }] })
      setOnglet('demandes')
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur lors de la soumission', type: 'error' })
    } finally { setFormSaving(false) }
  }

  async function confirmer(id: number) {
    setSaving(true)
    try { await api.put(endpoints.orderStatut(id), { statut: 'ACCEPTEE' }); setToast({ msg: 'Commande acceptée', type: 'success' }); fetchAll() }
    catch { setToast({ msg: 'Erreur lors de la confirmation', type: 'error' }) }
    finally { setSaving(false) }
  }
  async function refuser(e: React.FormEvent) {
    e.preventDefault(); if (!refusModal) return; setSaving(true)
    try {
      await api.put(endpoints.orderStatut(refusModal.id), { statut: 'ANNULEE', observations: motif })
      setToast({ msg: `Commande ${refusModal.code} annulée`, type: 'success' })
      setRefusModal(null); setMotif(''); fetchAll()
    } catch { setToast({ msg: 'Erreur', type: 'error' }) }
    finally { setSaving(false) }
  }

  async function accuserReception(id: number, code: string) {
    setActioning(id)
    try {
      await api.patch(endpoints.orderAccuserReception(id), {})
      setToast({ msg: `Réception accusée pour ${code} — semences créditées dans votre stock`, type: 'success' })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de l\'accusé de réception', type: 'error' })
    } finally { setActioning(null) }
  }

  const activeOrders = onglet === 'recues' ? recues : demandes
  const loading      = onglet === 'recues' ? loadingR : loadingD

  const pendingCount   = recues.filter(o => o.statut === 'SOUMISE').length
  const confirmedCount = recues.filter(o => ['ACCEPTEE','EN_NEGOCIATION','ACCORDEE','EN_PREPARATION'].includes(o.statut)).length
  const demandesTotal  = demandes.length
  const demandesAccept = demandes.filter(o => ['ACCEPTEE','EN_PREPARATION','EN_LIVRAISON','ACCORDEE','LIVREE'].includes(o.statut)).length

  const toggleKpi = (k: KpiKey) => { setKpiFilter(kpiFilter === k ? null : k); setSearch('') }

  const displayed = activeOrders.filter(o => {
    const matchKpi    = !kpiFilter || KPI_FILTER[kpiFilter](o)
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    return matchKpi && matchSearch
  })

  const tabBtn = (key: 'recues'|'demandes', icon: React.ReactNode, label: string, count: number) => (
    <button
      onClick={() => { setOnglet(key); setKpiFilter(null); setSearch('') }}
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: onglet === key ? 'var(--surface)' : 'transparent', color: onglet === key ? 'var(--green-700)' : 'var(--text-muted)', borderBottom: onglet === key ? '2px solid var(--green-600)' : '2px solid transparent', transition: 'all .15s' }}
    >
      {icon} {label}
      <span style={{ background: onglet === key ? 'var(--green-100)' : 'var(--surface-2)', color: onglet === key ? 'var(--green-700)' : 'var(--text-muted)', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{count}</span>
    </button>
  )

  return (
    <div>
      {/* KPI globaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard icon={<Building2 size={20} />}     value={recues.length}   label="Commandes reçues" accent="#3b82f6" loading={loadingR} />
        <KpiCard icon={<Clock size={20} />}          value={pendingCount}    label="À traiter"        accent="#f59e0b" active={kpiFilter === 'pending'}  onClick={() => toggleKpi('pending')}  loading={loadingR} />
        <KpiCard icon={<ShoppingCart size={20} />}   value={demandesTotal}   label="Mes demandes G3"  accent="#8b5cf6" loading={loadingD} />
        <KpiCard icon={<PackageCheck size={20} />}   value={demandesAccept}  label="Demandes acceptées" accent="#22c55e" active={kpiFilter === 'accepted'} onClick={() => toggleKpi('accepted')} loading={loadingD} />
      </div>

      {pendingCount > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '11px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#1e40af', fontWeight: 500 }}>
          <Clock size={15} />
          <strong>{pendingCount} commande{pendingCount > 1 ? 's' : ''}</strong> en attente de votre décision.
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: '10px 10px 0 0', padding: '0 16px' }}>
        {tabBtn('recues',   <Building2 size={14} />,    'Commandes reçues',  recues.length)}
        {tabBtn('demandes', <ShoppingCart size={14} />, 'Mes demandes G3',   demandes.length)}
      </div>

      <div className="card" style={{ borderRadius: '0 0 var(--radius) var(--radius)', borderTop: 'none' }}>
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon">{onglet === 'recues' ? <Building2 size={15} /> : <ShoppingCart size={15} />}</span>
            {onglet === 'recues' ? 'Commandes de mon organisation' : "Mes demandes G3 auprès de l'UPSemCL"}
            {kpiFilter && <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--surface-3)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 99, fontWeight: 600, border: '1px solid var(--border)' }}>Filtre actif</span>}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{displayed.length}{displayed.length !== activeOrders.length && `/${activeOrders.length}`}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onglet === 'demandes' && (
              <button className="btn btn-primary" style={{ fontSize: 12, height: 32, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowForm(true)}>
                <Plus size={13} /> Nouvelle demande G3
              </button>
            )}
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>

        {/* Graphe (contextualisé à l'onglet actif) */}
        {!loading && <div style={{ padding: '0 16px 0' }}><EvolutionChart orders={activeOrders} /></div>}

        {/* Barre de recherche */}
        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input placeholder="Code commande…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer</button>}
        </div>

        {/* Tableau commandes reçues */}
        {onglet === 'recues' && (
          <OrderTable
            orders={displayed}
            loading={loadingR}
            emptyMsg="Aucune commande reçue"
            varieties={varieties}
            extraColumns={[{
              head: 'Actions',
              cell: (o: any) => o.statut === 'SOUMISE' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px' }} onClick={() => confirmer(o.id)} disabled={saving}>
                    <CheckCircle2 size={11} /> Confirmer
                  </button>
                  <button className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 8px', color: 'var(--red-600)', border: '1px solid #fecaca' }} onClick={() => { setRefusModal({ id: o.id, code: o.codeCommande }); setMotif('') }} disabled={saving}>
                    <Ban size={11} />
                  </button>
                </div>
              ) : null,
            }]}
          />
        )}

        {/* Tableau mes demandes G3 */}
        {onglet === 'demandes' && (
          <OrderTable
            orders={displayed}
            loading={loadingD}
            emptyMsg="Aucune demande G3 — cliquez sur « Nouvelle demande G3 » pour en soumettre une"
            varieties={varieties}
            extraColumns={[{
              head: 'Action',
              cell: (o: any) => {
                if (o.statut === 'SOUMISE') {
                  return <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>En attente de proposition</span>
                }
                if (o.statut === 'EN_NEGOCIATION') {
                  return (
                    <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => setVoirPropModal(o)} disabled={actioning === o.id}>
                      <Eye size={11} /> Voir proposition
                    </button>
                  )
                }
                if (o.statut === 'ACCORDEE') {
                  return <span style={{ fontSize: 11, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={11} /> Accordée</span>
                }
                if (o.statut === 'EN_LIVRAISON') {
                  return (
                    <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => accuserReception(o.id, o.codeCommande)} disabled={actioning === o.id}>
                      {actioning === o.id ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <PackageCheck size={11} />}
                      Accuser réception
                    </button>
                  )
                }
                return null
              },
            }]}
          />
        )}
      </div>

      {showForm && (
        <Modal title="Nouvelle demande de semences G3" subtitle="Commander des lots G3 auprès de l'UPSemCL (CNRA)" onClose={() => setShowForm(false)} size="lg">
          <form onSubmit={submitOrderM}>
            {/* Fournisseur auto-sélectionné : UPSemCL */}
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PackageCheck size={14} />
              <span>Fournisseur : <strong>UPSemCL / CNRA</strong> — les lots G3 seront disponibles dans « Mes Lots » une fois la commande livrée.</span>
            </div>

            {/* Lignes de variétés */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Variétés demandées <span style={{ color: 'var(--red-500)' }}>*</span>
                </label>
                <button type="button" className="btn btn-secondary" style={{ height: 28, fontSize: 11 }} onClick={addLigneM}>
                  <Plus size={11} /> Ajouter une variété
                </button>
              </div>
              {form.lignes.map((ligne, i) => (
                <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Variété {i + 1}
                    <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 99, padding: '1px 8px', fontSize: 10.5, fontWeight: 700, marginLeft: 8 }}>G3</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'end' }}>
                    <Field label="Variété" required>
                      <FormSelect value={ligne.idVariete} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigneM(i, 'idVariete', e.target.value)} required>
                        <option value="">— Choisir une variété —</option>
                        {Object.entries(
                          varieties.filter((v: any) => v.statutVariete === 'DIFFUSEE').reduce((acc: Record<string, any[]>, v: any) => {
                            const k = v.espece?.codeEspece || 'Autre'; (acc[k] = acc[k] || []).push(v); return acc
                          }, {})
                        ).sort(([a], [b]) => a.localeCompare(b)).map(([esp, vs]) => (
                          <optgroup key={esp} label={esp}>
                            {(vs as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.nomVariete} ({v.codeVariete})</option>)}
                          </optgroup>
                        ))}
                      </FormSelect>
                    </Field>
                    <Field label="Quantité" required>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <FormInput type="number" value={ligne.quantite} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLigneM(i, 'quantite', e.target.value)} placeholder="500" min="1" required style={{ flex: 1 }} />
                        <FormSelect value={ligne.unite} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateLigneM(i, 'unite', e.target.value)} style={{ width: 70 }}>
                          <option value="kg">kg</option><option value="t">t</option>
                        </FormSelect>
                      </div>
                    </Field>
                    {form.lignes.length > 1 && (
                      <button type="button" onClick={() => removeLigneM(i)} style={{ height: 36, width: 36, background: 'var(--red-50)', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: 'var(--red-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Field label="Observations">
              <textarea
                value={form.observations}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Précisions sur la demande, délai souhaité…"
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }}
              />
            </Field>
            <FormActions onCancel={() => setShowForm(false)} loading={formSaving} submitLabel="Soumettre la demande G3" />
          </form>
        </Modal>
      )}

      {refusModal && (
        <Modal title="Annuler la commande" subtitle={`Commande ${refusModal.code}`} onClose={() => setRefusModal(null)} size="sm">
          <form onSubmit={refuser}>
            <Field label="Motif d'annulation" required hint="Visible par le demandeur">
              <textarea value={motif} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMotif(e.target.value)} placeholder="Stock insuffisant, variété indisponible…" rows={4} required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </Field>
            <FormActions onCancel={() => setRefusModal(null)} loading={saving} submitLabel="Confirmer l'annulation" />
          </form>
        </Modal>
      )}

      {voirPropModal && (
        <VoirPropositionModal
          commande={voirPropModal}
          varieties={varieties}
          onClose={() => setVoirPropModal(null)}
          onSuccess={fetchAll}
          setToast={setToast}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : PRÉPARER & LIVRER UNE COMMANDE G3
   Permet à l'agent UPSemCL de sélectionner le lot G3 à transférer
   et de valider la livraison directe en une seule action atomique.
   ══════════════════════════════════════════════════════════════════════════════ */
function TraiterCommandeG3Modal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any
  varieties: any[]
  onClose: () => void
  onSuccess: () => void
  setToast: (t: any) => void
}) {
  const [lotsG3,     setLotsG3]     = useState<any[]>([])
  const [loading,    setLoading]     = useState(true)
  const [saving,     setSaving]      = useState(false)
  /* Map idLigne → { idLot sélectionné, quantite à transférer } */
  const [selections, setSelections]  = useState<Record<number, { idLot: number | null; quantite: string }>>({})

  /* Lignes de la commande ayant la génération G3 (idGeneration = 4) */
  const lignesG3: any[] = (commande.lignes ?? []).filter((l: any) => l.idGeneration === 4)

  useEffect(() => {
    /* Initialiser les sélections avec la quantité demandée par défaut */
    const init: Record<number, { idLot: number | null; quantite: string }> = {}
    for (const l of lignesG3) init[l.id] = { idLot: null, quantite: String(l.quantiteDemandee ?? '') }
    setSelections(init)

    /* Charger tous les lots G3 disponibles depuis le catalogue */
    api.get(endpoints.lotsCatalogueG3)
      .then(r => setLotsG3(r.data))
      .catch(() => setLotsG3([]))
      .finally(() => setLoading(false))
  }, [])

  /** Retourne le nom de la variété pour affichage */
  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }

  /** Filtre les lots disponibles pour une variété donnée */
  function lotsForLigne(idVariete: number) {
    return lotsG3.filter((lot: any) => lot.idVariete === idVariete)
  }

  function setLot(idLigne: number, idLot: number) {
    setSelections(s => ({ ...s, [idLigne]: { ...s[idLigne], idLot } }))
  }
  function setQte(idLigne: number, quantite: string) {
    setSelections(s => ({ ...s, [idLigne]: { ...s[idLigne], quantite } }))
  }

  /* Le bouton Confirmer n'est actif que si chaque ligne G3 a un lot + une quantité valide */
  const isValid = lignesG3.every((l: any) => {
    const sel = selections[l.id]
    return sel && sel.idLot !== null && sel.quantite && Number(sel.quantite) > 0
  })

  async function submit() {
    if (!isValid) return
    setSaving(true)
    try {
      const allocations = lignesG3.map((l: any) => ({
        idLigne:  l.id,
        idLot:    selections[l.id].idLot,
        quantite: Number(selections[l.id].quantite),
      }))
      await api.post(endpoints.ordersValiderEtLivrer(commande.id), { allocations })
      setToast({ msg: `Commande ${commande.codeCommande} livrée — lot(s) G3 transféré(s)`, type: 'success' })
      onSuccess()
      onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de la livraison', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Préparer &amp; Livrer la commande"
      subtitle={`${commande.codeCommande} — Acheteur : ${commande.usernameAcheteur ?? '—'}`}
      onClose={onClose}
      size="lg"
    >
      {/* Bannière d'information */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1e40af', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Zap size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Sélectionnez le lot G3 à transférer et confirmez la quantité. La livraison sera enregistrée immédiatement : le multiplicateur recevra les semences dans <strong>Mes Lots</strong> et pourra créer des lots G4 → R1 → R2 pour la traçabilité.</span>
      </div>

      {/* Une section par ligne G3 de la commande */}
      {lignesG3.map((ligne: any) => {
        const lots = lotsForLigne(ligne.idVariete)
        const sel  = selections[ligne.id] ?? { idLot: null, quantite: '' }
        const lotSelectionne = lots.find((l: any) => l.id === sel.idLot)

        return (
          <div key={ligne.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface-2)' }}>
            {/* En-tête de la ligne */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{varNom(ligne.idVariete)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Génération G3 · Quantité demandée : <strong style={{ color: 'var(--text-primary)' }}>{ligne.quantiteDemandee} {ligne.unite}</strong>
                </div>
              </div>
              <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: 99, padding: '3px 11px', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>G3</span>
            </div>

            {/* Sélection du lot G3 disponible */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Lot G3 à affecter
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 44, borderRadius: 8 }} />
              ) : lots.length === 0 ? (
                <div style={{ padding: '11px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <XCircle size={14} /> Aucun lot G3 disponible pour cette variété.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {lots.map((lot: any) => (
                    <label
                      key={lot.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', border: `2px solid ${sel.idLot === lot.id ? '#16a34a' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer', background: sel.idLot === lot.id ? '#f0fdf4' : 'var(--surface)', transition: 'border-color .12s, background .12s' }}
                    >
                      <input
                        type="radio"
                        name={`lot-ligne-${ligne.id}`}
                        checked={sel.idLot === lot.id}
                        onChange={() => setLot(ligne.id, lot.id)}
                        style={{ accentColor: '#16a34a', width: 15, height: 15, cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{lot.codeLot}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 10 }}>
                          {lot.campagne ?? '—'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>{lot.quantiteNette} kg</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>disponible</div>
                      </div>
                      <span style={{ fontSize: 10.5, background: lot.statutLot === 'CERTIFIE' ? '#dcfce7' : '#eff6ff', color: lot.statutLot === 'CERTIFIE' ? '#15803d' : '#1d4ed8', borderRadius: 99, padding: '2px 9px', fontWeight: 600, flexShrink: 0 }}>
                        {lot.statutLot}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Quantité à transférer */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>
                Quantité à transférer ({ligne.unite})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number"
                  value={sel.quantite}
                  min={1}
                  max={lotSelectionne ? Math.min(Number(lotSelectionne.quantiteNette), ligne.quantiteDemandee) : ligne.quantiteDemandee}
                  onChange={e => setQte(ligne.id, e.target.value)}
                  disabled={sel.idLot === null}
                  style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 150, outline: 'none', background: sel.idLot === null ? 'var(--surface-2)' : 'var(--surface)', color: sel.idLot === null ? 'var(--text-muted)' : 'var(--text-primary)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  sur <strong>{ligne.quantiteDemandee}</strong> {ligne.unite} demandé{ligne.quantiteDemandee > 1 ? 's' : ''}
                  {lotSelectionne && (
                    <span style={{ color: '#15803d', marginLeft: 8 }}>· lot : {lotSelectionne.quantiteNette} kg dispo</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )
      })}

      {/* Boutons de validation */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
        <button
          className="btn btn-primary"
          style={{
            background: isValid && !saving ? 'linear-gradient(135deg, #16a34a, #059669)' : undefined,
            border: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
            opacity: !isValid ? 0.6 : 1,
          }}
          onClick={submit}
          disabled={!isValid || saving}
        >
          {saving
            ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Livraison en cours…</>
            : <><Zap size={13} /> Confirmer le transfert et livrer</>
          }
        </button>
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : PROPOSER une allocation (UPSemCL → Multiplicateur)
   ══════════════════════════════════════════════════════════════════════════════ */
function ProposeModal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void
}) {
  const [lotsG3,     setLotsG3]    = useState<any[]>([])
  const [loading,    setLoading]   = useState(true)
  const [saving,     setSaving]    = useState(false)
  const [selections, setSelections] = useState<Record<number, { idLot: number | null; quantite: string }>>({})

  const lignes: any[] = commande.lignes ?? []

  useEffect(() => {
    const init: Record<number, { idLot: number | null; quantite: string }> = {}
    for (const l of lignes) {
      init[l.id] = {
        idLot: l.idLotPropose ?? null,
        quantite: l.quantiteProposee != null ? String(l.quantiteProposee) : String(l.quantiteDemandee ?? ''),
      }
    }
    setSelections(init)
    api.get(endpoints.lotsCatalogueG3)
      .then(r => setLotsG3(r.data))
      .catch(() => setLotsG3([]))
      .finally(() => setLoading(false))
  }, [])

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }
  function lotsForLigne(idVariete: number) {
    return lotsG3.filter((lot: any) => lot.idVariete === idVariete)
  }

  const isValid = lignes.length > 0 && lignes.every((l: any) => {
    const sel = selections[l.id]
    return sel && sel.idLot !== null && sel.quantite && Number(sel.quantite) > 0
  })

  async function submit() {
    if (!isValid) return; setSaving(true)
    try {
      const propositions = lignes.map((l: any) => ({
        idLigne: l.id,
        idLot: selections[l.id].idLot,
        quantiteProposee: Number(selections[l.id].quantite),
      }))
      await api.patch(endpoints.orderProposer(commande.id), { propositions })
      setToast({ msg: `Proposition envoyée pour ${commande.codeCommande}`, type: 'success' })
      onSuccess(); onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de la proposition', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title="Proposer une allocation"
      subtitle={`${commande.codeCommande} — Acheteur : ${commande.usernameAcheteur ?? '—'}`}
      onClose={onClose} size="lg"
    >
      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Settings2 size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Sélectionnez le lot G3 disponible et proposez la quantité pour chaque variété. Le multiplicateur pourra <strong>accepter ou refuser</strong> votre proposition avant que vous déclenchiez le transfert physique.</span>
      </div>

      {lignes.map((ligne: any) => {
        const lots = lotsForLigne(ligne.idVariete)
        const sel  = selections[ligne.id] ?? { idLot: null, quantite: '' }
        const lotSel = lots.find((l: any) => l.id === sel.idLot)
        return (
          <div key={ligne.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{varNom(ligne.idVariete)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  {GEN_LABELS[ligne.idGeneration] ?? `Gén. ${ligne.idGeneration}`} · Demandé : <strong style={{ color: 'var(--text-primary)' }}>{ligne.quantiteDemandee} {ligne.unite}</strong>
                </div>
              </div>
              <span style={{ background: '#fefce8', color: '#92400e', borderRadius: 99, padding: '3px 11px', fontSize: 11.5, fontWeight: 700 }}>
                G3
              </span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Lot à proposer</div>
              {loading ? (
                <div className="skeleton" style={{ height: 44, borderRadius: 8 }} />
              ) : lots.length === 0 ? (
                <div style={{ padding: '11px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <XCircle size={14} /> Aucun lot G3 disponible pour cette variété.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {lots.map((lot: any) => (
                    <label key={lot.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', border: `2px solid ${sel.idLot === lot.id ? '#d97706' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer', background: sel.idLot === lot.id ? '#fefce8' : 'var(--surface)', transition: 'all .12s' }}>
                      <input type="radio" name={`lot-propose-${ligne.id}`} checked={sel.idLot === lot.id} onChange={() => setSelections(s => ({ ...s, [ligne.id]: { ...s[ligne.id], idLot: lot.id } }))} style={{ accentColor: '#d97706', width: 15, height: 15 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{lot.codeLot}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 10 }}>{lot.campagne ?? '—'}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>{lot.quantiteNette} kg</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>disponible</div>
                      </div>
                      <span style={{ fontSize: 10.5, background: lot.statutLot === 'CERTIFIE' ? '#dcfce7' : '#eff6ff', color: lot.statutLot === 'CERTIFIE' ? '#15803d' : '#1d4ed8', borderRadius: 99, padding: '2px 9px', fontWeight: 600 }}>
                        {lot.statutLot}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>
                Quantité proposée ({ligne.unite})
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number" value={sel.quantite} min={1}
                  max={lotSel ? lotSel.quantiteNette : undefined}
                  onChange={e => setSelections(s => ({ ...s, [ligne.id]: { ...s[ligne.id], quantite: e.target.value } }))}
                  disabled={sel.idLot === null}
                  style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'Outfit, sans-serif', width: 150, outline: 'none', background: sel.idLot === null ? 'var(--surface-2)' : 'var(--surface)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  sur <strong>{ligne.quantiteDemandee}</strong> {ligne.unite} demandé{ligne.quantiteDemandee > 1 ? 's' : ''}
                  {lotSel && <span style={{ color: '#15803d', marginLeft: 8 }}>· lot : {lotSel.quantiteNette} kg dispo</span>}
                </span>
              </div>
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
        <button
          className="btn btn-primary"
          style={{ background: isValid && !saving ? 'linear-gradient(135deg, #d97706, #b45309)' : undefined, border: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, opacity: !isValid ? 0.6 : 1 }}
          onClick={submit} disabled={!isValid || saving}
        >
          {saving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Envoi…</> : <><Settings2 size={13} /> Envoyer la proposition</>}
        </button>
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : VOIR PROPOSITION (Multiplicateur) — Accepter ou Refuser
   ══════════════════════════════════════════════════════════════════════════════ */
function VoirPropositionModal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void
}) {
  const [saving,    setSaving]    = useState(false)
  const [mesSites,  setMesSites]  = useState<any[]>([])
  const [siteCode,  setSiteCode]  = useState('')

  useEffect(() => {
    api.get(endpoints.sitesMesSites).then(r => {
      const sites = r.data ?? []
      setMesSites(sites)
      const principal = sites.find((s: any) => s.estPrincipal) ?? sites[0]
      if (principal) setSiteCode(principal.codeSite)
    }).catch(() => {})
  }, [])

  const lignes: any[] = (commande.lignes ?? []).filter((l: any) => l.quantiteProposee != null)

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }

  async function accepter() {
    if (!siteCode) {
      setToast({ msg: 'Veuillez choisir un site de réception', type: 'error' })
      return
    }
    setSaving(true)
    try {
      await api.patch(endpoints.orderAccepterProposition(commande.id), { siteCode })
      setToast({ msg: `Proposition acceptée — l'UPSemCL va déclencher le transfert`, type: 'success' })
      onSuccess(); onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  async function refuser() {
    setSaving(true)
    try {
      await api.patch(endpoints.orderRefuserProposition(commande.id), {})
      setToast({ msg: `Proposition refusée — la commande est retournée à SOUMISE`, type: 'success' })
      onSuccess(); onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title="Proposition de l'UPSemCL"
      subtitle={`Commande ${commande.codeCommande}`}
      onClose={onClose} size="md"
    >
      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Clock size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>L'UPSemCL a proposé les quantités ci-dessous. Vous pouvez <strong>accepter</strong> pour valider le transfert ou <strong>refuser</strong> pour négocier une nouvelle proposition via la messagerie.</span>
      </div>

      {lignes.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
          Aucune proposition enregistrée pour cette commande.
        </div>
      )}

      {lignes.map((ligne: any) => (
        <div key={ligne.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12, background: 'var(--surface-2)' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>{varNom(ligne.idVariete)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Quantité demandée</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{ligne.quantiteDemandee} {ligne.unite}</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Quantité proposée</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: ligne.quantiteProposee < ligne.quantiteDemandee ? '#dc2626' : '#15803d' }}>
                {ligne.quantiteProposee} {ligne.unite}
                {ligne.quantiteProposee < ligne.quantiteDemandee && (
                  <span style={{ fontSize: 10.5, background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '1px 6px', marginLeft: 6 }}>
                    -{(ligne.quantiteDemandee - ligne.quantiteProposee).toFixed(2)} kg
                  </span>
                )}
              </div>
            </div>
            {ligne.idLotPropose && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Lot proposé</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  #{ligne.idLotPropose}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Sélecteur site de réception */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Site de réception des semences
        </div>
        {mesSites.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Chargement des sites…</div>
        ) : (
          <select
            value={siteCode}
            onChange={e => setSiteCode(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)' }}
          >
            {mesSites.map((s: any) => (
              <option key={s.codeSite} value={s.codeSite}>
                {s.codeSite} — {s.nomSite}{s.estPrincipal ? ' ★' : ''}
              </option>
            ))}
          </select>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Le stock et les lots seront enregistrés sur ce site à réception.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 16 }}>
        <button className="btn btn-ghost" style={{ color: 'var(--red-600)', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 6 }} onClick={refuser} disabled={saving}>
          <Ban size={13} /> Refuser
        </button>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Fermer</button>
        <button
          className="btn btn-primary"
          style={{ background: siteCode ? 'linear-gradient(135deg, #16a34a, #059669)' : undefined, border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: !siteCode ? 0.6 : 1 }}
          onClick={accepter}
          disabled={saving || !siteCode}
        >
          {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />}
          Accepter la proposition
        </button>
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VUE UPSEMCL / SÉLECTIONNEUR
   ══════════════════════════════════════════════════════════════════════════════ */
function VueUpsemcl({ setToast, roleKey }: { setToast: any; roleKey: string }) {
  const [orders,            setOrders]            = useState<any[]>([])
  const [orgs,              setOrgs]              = useState<any[]>([])
  const [varieties,         setVarieties]         = useState<any[]>([])
  const [loading,           setLoading]           = useState(true)
  const [kpiFilter,         setKpiFilter]         = useState<KpiKey | null>(null)
  const [search,            setSearch]            = useState('')
  const [commandeATraiter,  setCommandeATraiter]  = useState<any | null>(null)
  const [commandeAProposer, setCommandeAProposer] = useState<any | null>(null)
  const [commandeTransfert, setCommandeTransfert] = useState<any | null>(null)
  const [actioning,         setActioning]         = useState<number | null>(null)
  const isUpsemcl = roleKey === 'seed-upsemcl'

  async function fetchAll() {
    setLoading(true)
    const [oRes, orgRes, varRes] = await Promise.allSettled([
      api.get(endpoints.ordersATraiter),
      api.get(endpoints.organisations),
      api.get(endpoints.varieties),
    ])
    setOrders(oRes.status === 'fulfilled' ? extractList(oRes.value.data) : [])
    setOrgs(orgRes.status === 'fulfilled' ? orgRes.value.data : [])
    if (varRes.status === 'fulfilled') setVarieties(extractList(varRes.value.data).map(normalizeVariete))
    setLoading(false)
  }
  async function handleUpdateStatus(id: number, statut: string) {
    await api.put(endpoints.orderStatut(id), { statut })
    setToast({ msg: `Commande → ${STATUS_CFG[statut]?.label ?? statut}`, type: 'success' })
    fetchAll()
  }
  function handleValiderG3(commande: any) { setCommandeATraiter(commande) }

  async function handleFaireTransfert(commande: any) {
    setActioning(commande.id)
    try {
      await api.post(endpoints.orderFaireTransfert(commande.id), {})
      setToast({ msg: `Transfert déclenché pour ${commande.codeCommande} — en attente d'accusé de réception`, type: 'success' })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors du transfert', type: 'error' })
    } finally { setActioning(null) }
  }

  useEffect(() => { fetchAll() }, [])

  const aTraiter   = orders.filter(o => o.statut === 'SOUMISE').length
  const enCours    = orders.filter(o => ['EN_NEGOCIATION','ACCORDEE','EN_LIVRAISON','ACCEPTEE','EN_PREPARATION'].includes(o.statut)).length
  const rejetees   = orders.filter(o => ['ANNULEE','REJETEE'].includes(o.statut)).length
  const livrees    = orders.filter(o => o.statut === 'LIVREE').length

  const toggleKpi = (k: KpiKey) => { setKpiFilter(kpiFilter === k ? null : k); setSearch('') }

  const displayed = orders.filter(o => {
    const matchKpi    = !kpiFilter || KPI_FILTER[kpiFilter](o)
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    return matchKpi && matchSearch
  })

  const extraColumnsUpsemcl = isUpsemcl ? [{
    head: 'Action',
    cell: (o: any) => {
      if (o.statut === 'SOUMISE') {
        const hasG3 = Array.isArray(o.lignes) && o.lignes.some((l: any) => l.idGeneration === 4)
        if (hasG3) {
          return (
            <div style={{ display: 'flex', gap: 5 }}>
              <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                onClick={() => setCommandeAProposer(o)} disabled={actioning === o.id}>
                <Settings2 size={11} /> Proposer
              </button>
              <button className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 8px', color: '#6d28d9', border: '1px solid #ddd6fe' }}
                title="Livraison directe (ancien flux)" onClick={() => handleValiderG3(o)} disabled={actioning === o.id}>
                <Zap size={11} />
              </button>
            </div>
          )
        }
        return (
          <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => setCommandeAProposer(o)} disabled={actioning === o.id}>
            <Settings2 size={11} /> Proposer
          </button>
        )
      }
      if (o.statut === 'EN_NEGOCIATION') {
        return <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={11} /> En attente multiplicateur</span>
      }
      if (o.statut === 'ACCORDEE') {
        return (
          <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #6d28d9, #4c1d95)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => handleFaireTransfert(o)} disabled={actioning === o.id}>
            {actioning === o.id ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Truck size={11} />}
            Faire le transfert
          </button>
        )
      }
      if (o.statut === 'EN_LIVRAISON') {
        return <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><Truck size={11} /> En livraison</span>
      }
      return null
    },
  }] : []

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard icon={<ShoppingCart size={20} />}  value={orders.length} label="Total reçues"  accent="#3b82f6" loading={loading} onClick={() => setKpiFilter(null)} />
        <KpiCard icon={<Clock size={20} />}          value={aTraiter}      label="À traiter"     accent="#f59e0b" active={kpiFilter === 'pending'}   onClick={() => toggleKpi('pending')}   loading={loading} />
        <KpiCard icon={<PackageCheck size={20} />}   value={enCours}       label="En cours"      accent="#22c55e" active={kpiFilter === 'accepted'}   onClick={() => toggleKpi('accepted')}  loading={loading} />
        <KpiCard icon={<XCircle size={20} />}        value={rejetees}      label="Rejetées"      accent="#ef4444" active={kpiFilter === 'rejected'}   onClick={() => toggleKpi('rejected')}  loading={loading} />
      </div>

      {aTraiter > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '11px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#1e40af', fontWeight: 500 }}>
          <Clock size={15} />
          <strong>{aTraiter} commande{aTraiter > 1 ? 's' : ''}</strong> en attente de proposition.
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, color: '#1d4ed8', border: '1px solid #bfdbfe' }} onClick={() => toggleKpi('pending')}>Voir</button>
        </div>
      )}

      {!loading && <EvolutionChart orders={orders} />}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Building2 size={15} /></span>
            {isUpsemcl ? 'Commandes des multiplicateurs' : 'Commandes reçues'}
            {kpiFilter && (
              <button className="btn btn-ghost" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', height: 22, color: 'var(--text-secondary)', border: '1px solid var(--border)' }} onClick={() => setKpiFilter(null)}>
                <X size={10} /> Filtre actif
              </button>
            )}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{displayed.length}{displayed.length !== orders.length && `/${orders.length}`}</span>
          </span>
          <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
        </div>

        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input placeholder="Code commande ou client…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer</button>}
        </div>

        <OrderTable
          orders={displayed}
          loading={loading}
          emptyMsg={kpiFilter ? 'Aucune commande pour ce filtre' : 'Aucune commande reçue'}
          orgs={orgs}
          varieties={varieties}
          onUpdateStatus={handleUpdateStatus}
          onValiderG3={isUpsemcl ? handleValiderG3 : undefined}
          extraColumns={extraColumnsUpsemcl}
        />
      </div>

      {!loading && livrees > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Truck size={13} /> <strong>{livrees}</strong> commande{livrees > 1 ? 's' : ''} livrée{livrees > 1 ? 's' : ''} ce cycle
        </div>
      )}

      {commandeATraiter && (
        <TraiterCommandeG3Modal commande={commandeATraiter} varieties={varieties} onClose={() => setCommandeATraiter(null)} onSuccess={fetchAll} setToast={setToast} />
      )}
      {commandeAProposer && (
        <ProposeModal commande={commandeAProposer} varieties={varieties} onClose={() => setCommandeAProposer(null)} onSuccess={fetchAll} setToast={setToast} />
      )}
      {commandeTransfert && (
        <ProposeModal commande={commandeTransfert} varieties={varieties} onClose={() => setCommandeTransfert(null)} onSuccess={fetchAll} setToast={setToast} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   VUE ADMIN
   ══════════════════════════════════════════════════════════════════════════════ */
function VueAdmin({ setToast }: { setToast: any }) {
  const [orders,    setOrders]    = useState<any[]>([])
  const [orgs,      setOrgs]      = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [kpiFilter, setKpiFilter] = useState<KpiKey | null>(null)
  const [search,    setSearch]    = useState('')
  const [showAlloc, setShowAlloc] = useState(false)
  const [allocForm, setAllocForm] = useState({ idLigne: '', idLot: '', quantite: '' })
  const [saving,    setSaving]    = useState(false)
  const [varieties, setVarieties] = useState<any[]>([])

  async function fetchOrders() {
    setLoading(true)
    const [oRes, orgRes, varRes] = await Promise.allSettled([
      api.get(endpoints.orders),
      api.get(endpoints.organisations),
      api.get(endpoints.varieties),
    ])
    setOrders(oRes.status === 'fulfilled' ? extractList(oRes.value.data) : [])
    setOrgs(orgRes.status === 'fulfilled' ? orgRes.value.data : [])
    if (varRes.status === 'fulfilled') setVarieties(extractList(varRes.value.data).map(normalizeVariete))
    setLoading(false)
  }
  async function handleUpdateStatus(id: number, statut: string) {
    await api.put(endpoints.orderStatut(id), { statut })
    setToast({ msg: `Commande → ${STATUS_CFG[statut]?.label ?? statut}`, type: 'success' })
    fetchOrders()
  }
  async function submitAlloc(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.orderAllocate, { idLigne: Number(allocForm.idLigne), idLot: Number(allocForm.idLot), quantite: Number(allocForm.quantite) })
      setToast({ msg: 'Allocation enregistrée', type: 'success' })
      setShowAlloc(false); setAllocForm({ idLigne: '', idLot: '', quantite: '' })
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message || 'Erreur allocation', type: 'error' })
    } finally { setSaving(false) }
  }
  useEffect(() => { fetchOrders() }, [])

  const pending   = orders.filter(o => o.statut === 'SOUMISE').length
  const accepted  = orders.filter(o => ['ACCEPTEE','EN_PREPARATION'].includes(o.statut)).length
  const rejected  = orders.filter(o => ['ANNULEE','REJETEE'].includes(o.statut)).length
  const delivered = orders.filter(o => o.statut === 'LIVREE').length

  const toggleKpi = (k: KpiKey) => { setKpiFilter(kpiFilter === k ? null : k); setSearch('') }

  const displayed = orders.filter(o => {
    const matchKpi    = !kpiFilter || KPI_FILTER[kpiFilter](o)
    const matchSearch = !search || o.codeCommande?.toLowerCase().includes(search.toLowerCase()) || o.client?.toLowerCase().includes(search.toLowerCase())
    return matchKpi && matchSearch
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        <KpiCard icon={<ShoppingCart size={20} />}  value={orders.length} label="Total commandes"  accent="#3b82f6" loading={loading} onClick={() => setKpiFilter(null)} />
        <KpiCard icon={<Clock size={20} />}          value={pending}       label="À traiter"        accent="#f59e0b" active={kpiFilter === 'pending'}   onClick={() => toggleKpi('pending')}   loading={loading} />
        <KpiCard icon={<PackageCheck size={20} />}   value={accepted}      label="En cours"         accent="#22c55e" active={kpiFilter === 'accepted'}   onClick={() => toggleKpi('accepted')}  loading={loading} />
        <KpiCard icon={<Truck size={20} />}          value={delivered}     label="Livrées"          accent="#10b981" active={kpiFilter === 'delivered'}  onClick={() => toggleKpi('delivered')} loading={loading} />
      </div>

      {!loading && <EvolutionChart orders={orders} />}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><ShoppingCart size={15} /></span>
            Toutes les commandes
            {kpiFilter && (
              <button className="btn btn-ghost" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', height: 22, color: 'var(--text-secondary)', border: '1px solid var(--border)' }} onClick={() => setKpiFilter(null)}>
                <X size={10} /> Filtre actif
              </button>
            )}
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{displayed.length}/{orders.length}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowAlloc(true)}><Settings2 size={13} /> Allouer</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchOrders}><RefreshCw size={13} /></button>
          </div>
        </div>

        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 360 }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              placeholder="Code commande ou client…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1 }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer</button>}
        </div>

        <OrderTable
          orders={displayed}
          loading={loading}
          emptyMsg={kpiFilter ? 'Aucune commande pour ce filtre' : 'Aucune commande'}
          orgs={orgs}
          varieties={varieties}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>

      {rejected > 0 && !loading && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <XCircle size={13} /> <strong>{rejected}</strong> commande{rejected > 1 ? 's' : ''} annulée{rejected > 1 ? 's' : ''} / rejetée{rejected > 1 ? 's' : ''}
          <button className="btn btn-ghost" style={{ fontSize: 11, marginLeft: 4 }} onClick={() => toggleKpi('rejected')}>Afficher</button>
        </div>
      )}

      {showAlloc && (
        <Modal title="Allouer un Lot" subtitle="Affecter un lot de semences à une ligne de commande" onClose={() => setShowAlloc(false)} size="sm">
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1d4ed8' }}>
            Trouvez l'ID de la ligne dans le détail de la commande (bouton Œil).
          </div>
          <form onSubmit={submitAlloc}>
            <Field label="ID ligne de commande" required><FormInput type="number" value={allocForm.idLigne} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, idLigne: e.target.value }))} placeholder="1" required /></Field>
            <Field label="ID du lot" required><FormInput type="number" value={allocForm.idLot} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, idLot: e.target.value }))} placeholder="22" required /></Field>
            <Field label="Quantité" required><FormInput type="number" value={allocForm.quantite} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAllocForm(f => ({ ...f, quantite: e.target.value }))} placeholder="1000" min="1" step="0.01" required /></Field>
            <FormActions onCancel={() => setShowAlloc(false)} loading={saving} submitLabel="Confirmer l'allocation" />
          </form>
        </Modal>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPOSANT RACINE — dispatch par rôle
   ══════════════════════════════════════════════════════════════════════════════ */
export function Orders({ roleKey }: Props) {
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {roleKey === 'seed-quotataire'
        ? <VueQuotataire setToast={setToast} />
        : roleKey === 'seed-multiplicator'
          ? <VueMultiplicateur setToast={setToast} />
          : roleKey === 'seed-upsemcl' || roleKey === 'seed-selector'
            ? <VueUpsemcl setToast={setToast} roleKey={roleKey} />
            : <VueAdmin setToast={setToast} />
      }
    </div>
  )
}
