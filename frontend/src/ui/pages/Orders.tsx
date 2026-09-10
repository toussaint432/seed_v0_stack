import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, RefreshCw, Plus, Settings2, Clock, XCircle, PackageCheck,
  Search, X, ChevronLeft, ChevronRight, CheckCircle2, Ban, Eye, Building2,
  TrendingUp, TrendingDown, BarChart2, Truck, Receipt, Zap, Download,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeVariete, extractList } from '../../lib/normalizers'
import { downloadXlsx, formatDateForExport } from '../../lib/exportUtils'
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
  { id: '1', label: 'G0 — Génétique'   },
  { id: '2', label: 'G1 — Pré-base'    },
  { id: '3', label: 'G2 — Base'        },
  { id: '4', label: 'G3 — Certif. C1'  },
  { id: '5', label: 'G4 — Certif. C2'  },
  { id: '6', label: 'R1 — Certifié'    },
  { id: '7', label: 'R2 — Commercial'  },
]

/** Correspondance idGeneration (1–7) → libellé affiché dans les tableaux et modales */
const GEN_LABELS: Record<number, string> = {
  1: 'G0 — Génétique', 2: 'G1 — Pré-base', 3: 'G2 — Base',
  4: 'G3 — Certif. C1', 5: 'G4 — Certif. C2', 6: 'R1 — Certifié', 7: 'R2 — Commercial',
}
const GEN_SHORT: Record<number, string> = { 1: 'G0', 2: 'G1', 3: 'G2', 4: 'G3', 5: 'G4', 6: 'R1', 7: 'R2' }

function buildOrderXlsSheets(orders: any[], orgs: any[], varieties: any[]) {
  const orgMap = Object.fromEntries(orgs.map((o: any) => [o.id, o.nomOrganisation ?? `#${o.id}`]))
  const varMap = Object.fromEntries(varieties.map((v: any) => [v.id, v.nomVariete ?? '']))
  const toKg = (qty: number, unite?: string) => unite === 't' ? qty * 1000 : qty

  const commandeRows = orders.map(o => {
    const lignes: any[] = Array.isArray(o.lignes) ? o.lignes : []
    const kgD = lignes.reduce((s, l) => s + toKg(Number(l.quantiteDemandee) || 0, l.unite), 0)
    const hasA = lignes.some(l => l.quantiteProposee != null)
    const kgA = hasA ? lignes.reduce((s, l) => l.quantiteProposee != null ? s + toKg(Number(l.quantiteProposee), l.unite) : s, 0) : null
    return [
      o.codeCommande ?? '', o.client ?? '', orgMap[o.idOrganisationFournisseur] ?? '',
      STATUS_CFG[o.statut]?.label ?? o.statut ?? '', formatDateForExport(o.createdAt),
      lignes.length, Math.round(kgD), parseFloat((kgD / 1000).toFixed(3)),
      kgA !== null ? Math.round(kgA) : '', kgA !== null ? parseFloat((kgA / 1000).toFixed(3)) : '',
    ]
  })

  const ligneRows: (string | number)[][] = []
  for (const o of orders) {
    const fournisseur = orgMap[o.idOrganisationFournisseur] ?? ''
    const lignes: any[] = Array.isArray(o.lignes) ? o.lignes : []
    if (lignes.length === 0) {
      ligneRows.push([o.codeCommande ?? '', STATUS_CFG[o.statut]?.label ?? o.statut ?? '', '', '', '', '', '', '', fournisseur])
    } else {
      for (const l of lignes) {
        const kgD = toKg(Number(l.quantiteDemandee) || 0, l.unite)
        const kgA = l.quantiteProposee != null ? toKg(Number(l.quantiteProposee), l.unite) : null
        ligneRows.push([
          o.codeCommande ?? '', STATUS_CFG[o.statut]?.label ?? o.statut ?? '',
          varMap[l.idVariete] ?? '', GEN_LABELS[l.idGeneration] ?? `G${l.idGeneration}`,
          Math.round(kgD), parseFloat((kgD / 1000).toFixed(3)),
          kgA !== null ? Math.round(kgA) : '', kgA !== null ? parseFloat((kgA / 1000).toFixed(3)) : '',
          fournisseur,
        ])
      }
    }
  }

  const statutMap: Record<string, { nb: number; kg: number }> = {}
  for (const o of orders) {
    const s = STATUS_CFG[o.statut]?.label ?? o.statut ?? 'Inconnu'
    if (!statutMap[s]) statutMap[s] = { nb: 0, kg: 0 }
    statutMap[s].nb++
    const lignes: any[] = Array.isArray(o.lignes) ? o.lignes : []
    statutMap[s].kg += lignes.reduce((sum, l) => sum + toKg(Number(l.quantiteDemandee) || 0, l.unite), 0)
  }
  const statutRows = Object.entries(statutMap)
    .sort(([, a], [, b]) => b.nb - a.nb)
    .map(([s, e]) => [s, e.nb, Math.round(e.kg), parseFloat((e.kg / 1000).toFixed(3))])

  return [
    { name: 'Commandes',    headers: ['Code commande', 'Client', 'Fournisseur', 'Statut', 'Date', 'Nb lignes', 'Total demandé (kg)', 'Total demandé (t)', 'Total accordé (kg)', 'Total accordé (t)'], rows: commandeRows },
    { name: 'Lignes détail', headers: ['Code commande', 'Statut', 'Variété', 'Génération', 'Qté demandée (kg)', 'Qté demandée (t)', 'Qté accordée (kg)', 'Qté accordée (t)', 'Fournisseur'], rows: ligneRows },
    { name: 'Par statut',   headers: ['Statut', 'Nb commandes', 'Volume demandé (kg)', 'Volume demandé (t)'], rows: statutRows },
  ]
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
  label: string; sublabel: string; total: number; rawOrders: any[]
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
    label, sublabel, total: cmds.length, rawOrders: cmds,
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
function StatMini({ label, value, couleur, icon, sublabel }: {
  label: string; value: string | number; couleur?: string; icon?: React.ReactNode; sublabel?: string
}) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: couleur ?? 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, lineHeight: 1.2 }}>
        {icon}{value}
      </div>
      {sublabel && (
        <div style={{ fontSize: 10, color: couleur ?? 'var(--text-secondary)', marginTop: 2, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {sublabel}
        </div>
      )}
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
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
function EvolutionChart({ orders, varieties = [], orgs = [] }: { orders: any[]; varieties?: any[]; orgs?: any[] }) {
  const [periode, setPeriode] = useState<Periode>('6M')
  const [hovered, setHovered] = useState<number | null>(null)
  const [clicked, setClicked] = useState<number | null>(null)

  const data     = useMemo(() => calcPeriode(orders, periode), [orders, periode])
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const yTicks   = useMemo(() => calcTicksY(maxTotal), [maxTotal])

  // ── Helpers volumes ──
  const toKg = (qty: number, unite?: string) => unite === 't' ? qty * 1000 : qty
  const fmtKg = (kg: number) => kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${Math.round(kg)} kg`
  const sumKg = (cmds: any[]) => cmds.reduce((s, o) => {
    const lignes: any[] = Array.isArray(o.lignes) ? o.lignes : []
    return s + lignes.reduce((ls, l) => ls + toKg(Number(l.quantiteDemandee) || 0, l.unite), 0)
  }, 0)

  const varById = useMemo(() => Object.fromEntries(varieties.map((v: any) => [String(v.id), v])), [varieties])

  // ── KPI de synthèse sur la période affichée ──
  const allPeriodeOrders = useMemo(() => data.flatMap(d => d.rawOrders), [data])
  const totalP = data.reduce((s, d) => s + d.total,   0)
  const totalL = data.reduce((s, d) => s + d.LIVREE,  0)
  const totalA = data.reduce((s, d) => s + d.ANNULEE, 0)
  const tauxL  = totalP > 0 ? Math.round(totalL / totalP * 100) : 0
  const tauxA  = totalP > 0 ? Math.round(totalA / totalP * 100) : 0

  const totalKg   = useMemo(() => sumKg(allPeriodeOrders), [allPeriodeOrders])
  const livreeKg  = useMemo(() => sumKg(allPeriodeOrders.filter(o => o.statut === 'LIVREE')), [allPeriodeOrders])
  const annuleeKg = useMemo(() => sumKg(allPeriodeOrders.filter(o => ['ANNULEE','REJETEE'].includes(o.statut))), [allPeriodeOrders])

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
            <button key={p} onClick={() => { setPeriode(p); setHovered(null); setClicked(null) }}
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
        <StatMini label="Total commandes"        value={totalP} sublabel={totalKg > 0 ? fmtKg(totalKg) : undefined} />
        <StatMini label={`Livrées · ${tauxL}%`}  value={totalL} sublabel={livreeKg > 0 ? fmtKg(livreeKg) : undefined}  couleur="#10b981" icon={<Truck   size={11} />} />
        <StatMini label={`Annulées · ${tauxA}%`} value={totalA} sublabel={annuleeKg > 0 ? fmtKg(annuleeKg) : undefined} couleur="#ef4444" icon={<XCircle size={11} />} />
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
                  fill="var(--text-muted)" fontFamily="Plus Jakarta Sans, system-ui, sans-serif">{t}</text>
              </g>
            )
          })}

          {/* Barres empilées par statut */}
          {data.map((d, i) => {
            const bx      = PL + i * (BARW + GAP)
            const isHov   = hovered === i
            const isSel   = clicked === i
            let yBot      = PT + PH

            return (
              <g key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setClicked(clicked === i ? null : i)}
                style={{ cursor: 'pointer' }}
              >
                {/* Fond de la barre */}
                <rect x={bx} y={PT} width={BARW} height={PH} rx={4}
                  fill={isSel ? '#16a34a18' : 'var(--surface-2,#f1f5f9)'} opacity={isHov || isSel ? 0.95 : 0.55} />

                {/* Segments colorés par statut */}
                {ORDRE.map(key => {
                  const val = d[key]; if (!val) return null
                  const bh  = Math.max(Math.round((val / maxTotal) * PH), 2)
                  const by  = yBot - bh; yBot -= bh
                  return (
                    <rect key={key} x={bx} y={by} width={BARW} height={bh}
                      fill={SERIE_COULEUR[key]} opacity={isHov || isSel ? 1 : 0.84} rx={0} />
                  )
                })}

                {/* Indicateur de sélection (bord vert) */}
                {isSel && (
                  <rect x={bx} y={PT} width={BARW} height={PH} rx={4}
                    fill="none" stroke="#16a34a" strokeWidth={2} />
                )}

                {/* Total affiché au-dessus */}
                {d.total > 0 && (
                  <text x={bx + BARW / 2} y={yBot - 3} textAnchor="middle" fontSize={8}
                    fontWeight="700"
                    fill={isHov || isSel ? 'var(--text-primary)' : 'var(--text-muted)'}
                    fontFamily="Plus Jakarta Sans, system-ui, sans-serif">{d.total}</text>
                )}

                {/* Label axe X */}
                <text x={bx + BARW / 2} y={PT + PH + 14} textAnchor="middle" fontSize={8}
                  fontWeight={isHov || isSel ? '700' : '400'}
                  fill={isHov || isSel ? (isSel ? '#16a34a' : 'var(--text-primary)') : 'var(--text-muted)'}
                  fontFamily="Plus Jakarta Sans, system-ui, sans-serif">{d.label}</text>
              </g>
            )
          })}
        </svg>

        {/* Tooltip HTML absolu sur la barre survolée */}
        {hovData && clicked === null && (() => {
          const hovKg = sumKg(hovData.rawOrders)
          // Top 4 variétés·génération par volume demandé
          const vMap: Record<string, { nom: string; gen: string; kg: number }> = {}
          for (const o of hovData.rawOrders) {
            for (const l of (Array.isArray(o.lignes) ? o.lignes : [])) {
              const vId = String(l.idVariete)
              const gId = Number(l.idGeneration)
              const rowKey = `${vId}_${gId}`
              const v = varById[vId]
              const nom = v?.nomVariete ?? `#${l.idVariete}`
              const gen = GEN_SHORT[gId] ?? `G${gId}`
              vMap[rowKey] = { nom, gen, kg: (vMap[rowKey]?.kg ?? 0) + toKg(Number(l.quantiteDemandee) || 0, l.unite) }
            }
          }
          const topVars = Object.values(vMap).sort((a, b) => b.kg - a.kg).slice(0, 4)
          return (
            <div style={{
              position: 'absolute', top: 0, left: `${tooltipPct}%`,
              transform: 'translateX(-50%) translateY(-105%)',
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              borderRadius: 9, padding: '9px 12px', fontSize: 11,
              pointerEvents: 'none', zIndex: 20, minWidth: 190,
              boxShadow: '0 6px 20px rgba(0,0,0,.15)',
            }}>
              {/* En-tête : période + total */}
              <div style={{ fontWeight: 700, fontSize: 11.5, marginBottom: 6, paddingBottom: 5, borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span>{hovData.sublabel || hovData.label}</span>
                <span>
                  <span style={{ color: '#16a34a', fontWeight: 800 }}>{hovData.total}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 10 }}> cmd{hovData.total > 1 ? 's' : ''}</span>
                </span>
              </div>
              {/* Volume kg */}
              {hovKg > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, paddingBottom: 5, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Volume demandé</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtKg(hovKg)}</span>
                </div>
              )}
              {/* Statuts */}
              {SERIE_CFG.filter(s => hovData[s.key] > 0).map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: s.couleur, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: s.couleur }}>{hovData[s.key]}</span>
                </div>
              ))}
              {/* Top variétés */}
              {topVars.length > 0 && (
                <div style={{ marginTop: 6, paddingTop: 5, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Variétés</div>
                  {topVars.map((v, vi) => (
                    <div key={vi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', minWidth: 0 }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nom}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 4px', borderRadius: 3, flexShrink: 0,
                          background: v.gen === 'R2' ? '#8b5cf614' : v.gen === 'G3' ? '#f59e0b14' : '#3b82f614',
                          color:      v.gen === 'R2' ? '#7c3aed'   : v.gen === 'G3' ? '#d97706'   : '#2563eb',
                        }}>{v.gen}</span>
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 10.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtKg(v.kg)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Hint clic */}
              {hovData.total > 0 && (
                <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px solid var(--border)', fontSize: 9.5, color: '#16a34a', fontWeight: 600, textAlign: 'center' }}>
                  ↙ Cliquer pour le détail complet
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── Légende ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, justifyContent: 'center' }}>
        {SERIE_CFG.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: s.couleur, flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, background: '#16a34a0d', padding: '2px 7px', borderRadius: 4, border: '1px solid #16a34a25' }}>↙ Cliquer une barre · variétés + kg en détail</span>
      </div>

      {/* ── Panel de détail (barre cliquée) ── */}
      {clicked !== null && (() => {
        const pt = data[clicked]
        const orgMap = Object.fromEntries(orgs.map((o: any) => [String(o.id), o.nomOrganisation ?? `#${o.id}`]))

        type VarEntry = { nom: string; code: string; espece: string; gen: string; genFull: string; kgD: number; nbSoumise: number; nbEnCours: number; nbLivree: number; nbAnnulee: number }
        const byVar: Record<string, VarEntry> = {}

        for (const o of pt.rawOrders) {
          const lignes: any[] = Array.isArray(o.lignes) ? o.lignes : []
          const sKey: SerieKey = ['ANNULEE','REJETEE'].includes(o.statut) ? 'ANNULEE'
            : ['ACCEPTEE','EN_PREPARATION','EN_NEGOCIATION','ACCORDEE','EN_LIVRAISON'].includes(o.statut) ? 'EN_COURS'
            : o.statut === 'LIVREE' ? 'LIVREE' : 'SOUMISE'

          for (const l of lignes) {
            const vId = String(l.idVariete)
            const gId = Number(l.idGeneration)
            const rowKey = `${vId}_${gId}`
            const v = varById[vId]
            if (!byVar[rowKey]) byVar[rowKey] = {
              nom: v?.nomVariete ?? `Variété #${l.idVariete}`,
              code: v?.codeVariete ?? '—',
              espece: v?.espece?.codeEspece ?? v?.espece?.nomEspece ?? '—',
              gen: GEN_SHORT[gId] ?? `G${gId}`,
              genFull: GEN_LABELS[gId] ?? `Génération ${gId}`,
              kgD: 0, nbSoumise: 0, nbEnCours: 0, nbLivree: 0, nbAnnulee: 0,
            }
            byVar[rowKey].kgD += toKg(Number(l.quantiteDemandee) || 0, l.unite)
            if (sKey === 'SOUMISE')  byVar[rowKey].nbSoumise++
            if (sKey === 'EN_COURS') byVar[rowKey].nbEnCours++
            if (sKey === 'LIVREE')   byVar[rowKey].nbLivree++
            if (sKey === 'ANNULEE')  byVar[rowKey].nbAnnulee++
          }
        }

        const rows = Object.values(byVar).sort((a, b) => b.kgD - a.kgD)
        const totalKg = rows.reduce((s, r) => s + r.kgD, 0)
        const hasLignes = rows.length > 0
        const nbVarietesUniques = new Set(rows.map(r => r.code)).size
        const periodeLabel = (pt.sublabel || pt.label).replace(/\s+/g, '-').toLowerCase()

        function exportDetail() {
          // Feuille 1 — agrégat Variété × Génération
          const detailSheet = {
            name: `Détail ${pt.sublabel || pt.label}`.slice(0, 31),
            headers: ['Variété', 'Code variété', 'Espèce', 'Génération', 'Qté demandée (kg)', 'Qté demandée (t)', 'Livrées', 'En cours', 'Soumises', 'Annulées'],
            rows: rows.map(r => [
              r.nom, r.code, r.espece, r.genFull,
              Math.round(r.kgD), parseFloat((r.kgD / 1000).toFixed(3)),
              r.nbLivree || 0, r.nbEnCours || 0, r.nbSoumise || 0, r.nbAnnulee || 0,
            ]),
          }

          // Feuille 2 — commandes brutes de la période
          const cmdRows = pt.rawOrders.map((o: any) => {
            const lignes: any[] = Array.isArray(o.lignes) ? o.lignes : []
            const gens = [...new Set(lignes.map((l: any) => GEN_SHORT[Number(l.idGeneration)] ?? `G${l.idGeneration}`))].join(' / ')
            const kgTotal = lignes.reduce((s: number, l: any) => s + toKg(Number(l.quantiteDemandee) || 0, l.unite), 0)
            return [
              o.codeCommande ?? '',
              o.client ?? '',
              orgMap[String(o.idOrganisationFournisseur)] ?? `#${o.idOrganisationFournisseur}`,
              STATUS_CFG[o.statut]?.label ?? o.statut ?? '',
              formatDateForExport(o.createdAt),
              gens,
              Math.round(kgTotal),
              parseFloat((kgTotal / 1000).toFixed(3)),
            ]
          })
          const cmdSheet = {
            name: `Commandes ${pt.sublabel || pt.label}`.slice(0, 31),
            headers: ['Code commande', 'Client', 'Fournisseur', 'Statut', 'Date', 'Génération(s)', 'Qté totale (kg)', 'Qté totale (t)'],
            rows: cmdRows,
          }

          downloadXlsx(`senjiw-detail-${periodeLabel}-${new Date().toISOString().slice(0,10)}`, [detailSheet, cmdSheet])
        }

        return (
          <div style={{
            marginTop: 16, borderRadius: 10, border: '1.5px solid #16a34a40',
            background: 'var(--surface)', overflow: 'hidden',
          }}>
            {/* En-tête panel */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', background: '#16a34a0c', borderBottom: '1px solid #16a34a30',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 22, borderRadius: 2, background: '#16a34a', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '.01em' }}>
                    Détail — {pt.sublabel || pt.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                    {pt.total} commande{pt.total > 1 ? 's' : ''}
                    {hasLignes && ` · ${nbVarietesUniques} variété${nbVarietesUniques > 1 ? 's' : ''} · ${rows.length} ligne${rows.length > 1 ? 's' : ''} · ${totalKg >= 1000 ? `${(totalKg / 1000).toFixed(2)} t` : `${Math.round(totalKg)} kg`} demandés`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {pt.LIVREE   > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981', background: '#10b98112', padding: '2px 8px', borderRadius: 5 }}>{pt.LIVREE} livrée{pt.LIVREE > 1 ? 's' : ''}</span>}
                {pt.EN_COURS > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#f59e0b', background: '#f59e0b12', padding: '2px 8px', borderRadius: 5 }}>{pt.EN_COURS} en cours</span>}
                {pt.SOUMISE  > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#3b82f6', background: '#3b82f612', padding: '2px 8px', borderRadius: 5 }}>{pt.SOUMISE} soumise{pt.SOUMISE > 1 ? 's' : ''}</span>}
                {pt.ANNULEE  > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#ef4444', background: '#ef444412', padding: '2px 8px', borderRadius: 5 }}>{pt.ANNULEE} annulée{pt.ANNULEE > 1 ? 's' : ''}</span>}
                {hasLignes && (
                  <button onClick={exportDetail} className="btn btn-secondary" style={{
                    height: 28, fontSize: 11, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Download size={11} /> Export .xls
                  </button>
                )}
                <button onClick={() => setClicked(null)} style={{
                  marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 16, color: 'var(--text-muted)', lineHeight: 1, padding: '2px 4px', borderRadius: 4,
                }}>✕</button>
              </div>
            </div>

            {!hasLignes ? (
              <div style={{ padding: '18px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Aucune ligne de commande disponible pour cette période.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {[
                        { h: 'Variété',      right: false },
                        { h: 'Code',         right: false },
                        { h: 'Espèce',       right: false },
                        { h: 'Génération',   right: false },
                        { h: 'Qté demandée', right: true  },
                        { h: 'Livrées',      right: true  },
                        { h: 'En cours',     right: true  },
                        { h: 'Soumises',     right: true  },
                        { h: 'Annulées',     right: true  },
                      ].map(({ h, right }) => (
                        <th key={h} style={{
                          padding: '7px 12px', textAlign: right ? 'right' : 'left',
                          fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                          textTransform: 'uppercase', letterSpacing: '.05em',
                          background: 'var(--surface-2)', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid var(--border)', background: ri % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nom}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{r.code}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{r.espece}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: r.gen === 'R2' ? '#8b5cf614' : r.gen === 'G3' ? '#f59e0b14' : '#3b82f614',
                            color:      r.gen === 'R2' ? '#7c3aed'   : r.gen === 'G3' ? '#d97706'   : '#2563eb',
                            whiteSpace: 'nowrap',
                          }}>{r.genFull}</span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {r.kgD >= 1000 ? `${(r.kgD / 1000).toFixed(2)} t` : `${Math.round(r.kgD)} kg`}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: r.nbLivree  ? 700 : 400, color: r.nbLivree  ? '#10b981' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.nbLivree  || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: r.nbEnCours ? 700 : 400, color: r.nbEnCours ? '#f59e0b' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.nbEnCours || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: r.nbSoumise ? 700 : 400, color: r.nbSoumise ? '#3b82f6' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.nbSoumise || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: r.nbAnnulee ? 700 : 400, color: r.nbAnnulee ? '#ef4444' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.nbAnnulee || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                      <td colSpan={4} style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL · {rows.length} ligne{rows.length > 1 ? 's' : ''}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {totalKg >= 1000 ? `${(totalKg / 1000).toFixed(2)} t` : `${Math.round(totalKg)} kg`}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{pt.LIVREE  || '—'}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{pt.EN_COURS || '—'}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>{pt.SOUMISE  || '—'}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 800, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{pt.ANNULEE  || '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })()}
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
  membresMap?: Record<string, any>
  onUpdateStatus?: (id: number, statut: string) => Promise<void>
  /** Intercepte les commandes G3 SOUMISE → ouvre TraiterCommandeG3Modal */
  onValiderG3?: (cmd: any) => void
  extraColumns?: { head: string; cell: (o: any) => React.ReactNode }[]
}
function OrderTable({ orders, loading, emptyMsg, orgs = [], varieties = [], membresMap = {}, onUpdateStatus, onValiderG3, extraColumns = [] }: OrderTableProps) {
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
          subtitle={`${membresMap[detail.usernameAcheteur]?.nomComplet || detail.usernameAcheteur || '—'} · ${fmtDatetime(detail.createdAt)}`}
          onClose={() => setDetail(null)} size="md"
        >
          <StatusPipeline statut={detail.statut} />
          {detail.statut === 'REJETEE' && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', borderLeft: '4px solid #dc2626',
              borderRadius: 6, padding: '10px 14px', marginBottom: 12,
            }}>
              <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                Commande rejetée
              </div>
              <div style={{ fontSize: 13, color: '#7f1d1d' }}>
                {detail.observations || 'Aucun motif renseigné.'}
              </div>
            </div>
          )}
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
  const navigate = useNavigate()
  const [orders,       setOrders]       = useState<any[]>([])
  const [orgs,         setOrgs]         = useState<any[]>([])
  const [varieties,    setVarieties]    = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [kpiFilter,    setKpiFilter]    = useState<KpiKey | null>(null)
  const [search,       setSearch]       = useState('')
  const [decisionQuotModal,  setDecisionQuotModal]  = useState<any | null>(null)
  const [receptionR2Modal,   setReceptionR2Modal]   = useState<any | null>(null)
  const [actioning,          setActioning]           = useState<number | null>(null)

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

  async function accuserReceptionQ(id: number, code: string) {
    setActioning(id)
    try {
      await api.patch(endpoints.orderAccuserReception(id), {})
      setToast({ msg: `Réception accusée pour ${code} — semences créditées dans vos stocks`, type: 'success' })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de l\'accusé de réception', type: 'error' })
    } finally { setActioning(null) }
  }

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
      {!loading && <EvolutionChart orders={orders} varieties={varieties} orgs={orgs} />}

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
            {displayed.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ gap: 5, fontSize: 12 }}
                onClick={() => downloadXlsx(`senjiw-commandes-${new Date().toISOString().slice(0, 10)}`, buildOrderXlsSheets(displayed, orgs, varieties))}
              ><Download size={13} /> Export .xls</button>
            )}
            <button className="btn btn-primary" onClick={() => navigate('/catalogue')}><Plus size={13} /> Nouvelle commande</button>
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input placeholder="Code ou client…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'var(--font-sans)', flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer filtres</button>}
        </div>
        <OrderTable
          orders={displayed}
          loading={loading}
          emptyMsg="Aucune commande"
          orgs={orgs}
          varieties={varieties}
          extraColumns={[{
            head: 'Action',
            cell: (o: any) => {
              if (o.statut === 'EN_NEGOCIATION') {
                return (
                  <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => setDecisionQuotModal(o)} disabled={actioning === o.id}>
                    <CheckCircle2 size={11} /> Décider
                  </button>
                )
              }
              if (o.statut === 'ACCORDEE') {
                return <span style={{ fontSize: 11, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={11} /> En attente de transfert</span>
              }
              if (o.statut === 'EN_LIVRAISON') {
                return (
                  <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => setReceptionR2Modal(o)} disabled={actioning === o.id}>
                    <PackageCheck size={11} /> Confirmer réception
                  </button>
                )
              }
              return null
            },
          }]}
        />
      </div>

      {decisionQuotModal && (
        <DecisionQuotataireModal
          commande={decisionQuotModal}
          varieties={varieties}
          onClose={() => setDecisionQuotModal(null)}
          onSuccess={fetchAll}
          setToast={setToast}
        />
      )}

      {receptionR2Modal && (
        <ReceptionConfirmationModal
          commande={receptionR2Modal}
          varieties={varieties}
          onClose={() => setReceptionR2Modal(null)}
          onSuccess={fetchAll}
          setToast={setToast}
        />
      )}

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
                    <Field label="Génération">
                      <div style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6,
                        fontSize: 13, background: 'var(--surface-2)', color: 'var(--text-secondary)',
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#14b8a6', display: 'inline-block' }} />
                        R2 — Commercial
                      </div>
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
              <textarea value={form.observations} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, observations: e.target.value }))} placeholder="Précisions sur la commande…" rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
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
  const [voirPropModal,    setVoirPropModal]    = useState<any | null>(null)
  const [proposerRecuModal, setProposerRecuModal] = useState<any | null>(null)
  const [decisionMulModal,  setDecisionMulModal]  = useState<any | null>(null)
  const [receptionConfModal, setReceptionConfModal] = useState<any | null>(null)
  const [membresMap,       setMembresMap]       = useState<Record<string, any>>({})
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
    const recuesData   = rRes.status === 'fulfilled' ? extractList(rRes.value.data) : []
    const demandesData = dRes.status === 'fulfilled' ? extractList(dRes.value.data) : []
    setRecues(recuesData)
    setLoadingR(false)
    setDemandes(demandesData)
    setLoadingD(false)
    if (varRes.status === 'fulfilled') setVarieties(extractList(varRes.value.data).map(normalizeVariete))
    if (orgRes.status === 'fulfilled')
      setOrgs(orgRes.value.data.filter((o: any) => o.typeOrganisation?.toUpperCase().includes('UPSEMCL') && o.active !== false))

    /* Résolution des noms réels — usernames uniques dans les commandes */
    const usernames = new Set<string>()
    ;[...recuesData, ...demandesData].forEach((o: any) => {
      if (o.usernameAcheteur) usernames.add(o.usernameAcheteur)
    })
    const entries = await Promise.allSettled(
      [...usernames].map(u => api.get(endpoints.membreByUsername(u)).then(r => [u, r.data] as [string, any]))
    )
    const map: Record<string, any> = {}
    entries.forEach(r => { if (r.status === 'fulfilled') { const [u, m] = r.value; map[u] = m } })
    setMembresMap(map)
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
      await api.put(endpoints.orderStatut(refusModal.id), { statut: 'REJETEE', observations: motif })
      setToast({ msg: `Commande ${refusModal.code} rejetée`, type: 'success' })
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

  async function faireTransfertRecue(id: number, code: string) {
    setActioning(id)
    try {
      await api.post(endpoints.orderFaireTransfert(id), {})
      setToast({ msg: `Transfert déclenché pour ${code} — le quotataire peut maintenant accuser réception`, type: 'success' })
      fetchAll()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors du transfert', type: 'error' })
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
            {displayed.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ gap: 5, fontSize: 12, height: 32 }}
                onClick={() => downloadXlsx(`senjiw-commandes-${onglet}-${new Date().toISOString().slice(0, 10)}`, buildOrderXlsSheets(displayed, orgs, varieties))}
              ><Download size={13} /> Export .xls</button>
            )}
            {onglet === 'demandes' && (
              <button className="btn btn-primary" style={{ fontSize: 12, height: 32, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowForm(true)}>
                <Plus size={13} /> Nouvelle demande G3
              </button>
            )}
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>

        {/* Graphe (contextualisé à l'onglet actif) */}
        {!loading && <div style={{ padding: '0 16px 0' }}><EvolutionChart orders={activeOrders} varieties={varieties} orgs={orgs} /></div>}

        {/* Barre de recherche */}
        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input placeholder="Code commande…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'var(--font-sans)', flex: 1 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
          </div>
          {(search || kpiFilter) && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setSearch(''); setKpiFilter(null) }}><X size={11} /> Effacer</button>}
        </div>

        {/* Tableau commandes reçues (quotataires) */}
        {onglet === 'recues' && (
          <OrderTable
            orders={displayed}
            loading={loadingR}
            emptyMsg="Aucune commande reçue"
            varieties={varieties}
            membresMap={membresMap}
            extraColumns={[{
              head: 'Actions',
              cell: (o: any) => {
                if (o.statut === 'SOUMISE') {
                  return (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={() => setProposerRecuModal(o)} disabled={saving}>
                        <Settings2 size={11} /> Proposer
                      </button>
                      <button className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 8px', color: 'var(--red-600)', border: '1px solid #fecaca' }}
                        onClick={() => { setRefusModal({ id: o.id, code: o.codeCommande }); setMotif('') }} disabled={saving}>
                        <Ban size={11} />
                      </button>
                    </div>
                  )
                }
                if (o.statut === 'EN_NEGOCIATION') {
                  return <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600, fontStyle: 'italic' }}>En attente du quotataire</span>
                }
                if (o.statut === 'ACCORDEE') {
                  return (
                    <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #6d28d9, #4c1d95)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => faireTransfertRecue(o.id, o.codeCommande)} disabled={actioning === o.id}>
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
            membresMap={membresMap}
            extraColumns={[{
              head: 'Action',
              cell: (o: any) => {
                if (o.statut === 'SOUMISE') {
                  return <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>En attente de proposition</span>
                }
                if (o.statut === 'EN_NEGOCIATION') {
                  return (
                    <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => setDecisionMulModal(o)} disabled={actioning === o.id}>
                      <CheckCircle2 size={11} /> Décider
                    </button>
                  )
                }
                if (o.statut === 'ACCORDEE') {
                  return <span style={{ fontSize: 11, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={11} /> Accordée — en attente transfert</span>
                }
                if (o.statut === 'EN_LIVRAISON') {
                  return (
                    <button className="btn btn-primary" style={{ height: 28, fontSize: 11, padding: '0 10px', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', border: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => setReceptionConfModal(o)} disabled={actioning === o.id}>
                      <PackageCheck size={11} /> Confirmer réception
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
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }}
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
              <textarea value={motif} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMotif(e.target.value)} placeholder="Stock insuffisant, variété indisponible…" rows={4} required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
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

      {proposerRecuModal && (
        <PropositionR2Modal
          commande={proposerRecuModal}
          varieties={varieties}
          onClose={() => setProposerRecuModal(null)}
          onSuccess={fetchAll}
          setToast={setToast}
        />
      )}

      {decisionMulModal && (
        <DecisionMultiplicateurModal
          commande={decisionMulModal}
          varieties={varieties}
          onClose={() => setDecisionMulModal(null)}
          onSuccess={fetchAll}
          setToast={setToast}
        />
      )}

      {receptionConfModal && (
        <ReceptionConfirmationModal
          commande={receptionConfModal}
          varieties={varieties}
          onClose={() => setReceptionConfModal(null)}
          onSuccess={fetchAll}
          setToast={setToast}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : PRÉPARER & LIVRER UNE COMMANDE G3
   FIFO automatique : les lots les plus anciens sont affectés en premier.
   L'agent UPSemCL vérifie et peut ajuster les quantités avant de confirmer.
   ══════════════════════════════════════════════════════════════════════════════ */

interface FifoAlloc {
  idLigne: number
  idLot: number
  lotCode: string
  dateProd: string
  disponible: number
  quantite: number
}

/** Calcule l'affectation FIFO : lots triés par dateProduction ASC, remplis dans l'ordre. */
function computeFifo(lignesG3: any[], lotsG3: any[]): FifoAlloc[] {
  const result: FifoAlloc[] = []
  const avail = lotsG3
    .map(l => ({ ...l, remaining: Number(l.quantiteNette) }))
    .sort((a, b) => new Date(a.dateProduction ?? '9999-12-31').getTime() - new Date(b.dateProduction ?? '9999-12-31').getTime())

  for (const ligne of lignesG3) {
    let needed = Number(ligne.quantiteDemandee ?? 0)
    for (const lot of avail.filter(l => l.idVariete === ligne.idVariete)) {
      if (needed <= 0 || lot.remaining <= 0) continue
      const take = Math.min(lot.remaining, needed)
      result.push({
        idLigne: ligne.id, idLot: lot.id, lotCode: lot.codeLot,
        dateProd: lot.dateProduction ?? '—', disponible: Number(lot.quantiteNette), quantite: take,
      })
      lot.remaining -= take
      needed -= take
    }
  }
  return result
}

function TraiterCommandeG3Modal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any
  varieties: any[]
  onClose: () => void
  onSuccess: () => void
  setToast: (t: any) => void
}) {
  const [lotsG3,    setLotsG3]   = useState<any[]>([])
  const [loading,   setLoading]  = useState(true)
  const [saving,    setSaving]   = useState(false)
  const [allocs,    setAllocs]   = useState<FifoAlloc[]>([])

  const lignesG3: any[] = (commande.lignes ?? []).filter((l: any) => l.idGeneration === 4)

  useEffect(() => {
    api.get(endpoints.lotsCatalogueG3)
      .then(r => {
        const lots = r.data
        setLotsG3(lots)
        setAllocs(computeFifo(lignesG3, lots))
      })
      .catch(() => setLotsG3([]))
      .finally(() => setLoading(false))
  }, [])

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }

  function updateQte(idLigne: number, idLot: number, val: string) {
    setAllocs(a => a.map(r =>
      r.idLigne === idLigne && r.idLot === idLot ? { ...r, quantite: Math.max(0, Number(val) || 0) } : r
    ))
  }

  function allocsForLigne(idLigne: number) {
    return allocs.filter(a => a.idLigne === idLigne)
  }

  function isLigneCovered(ligne: any) {
    const total = allocsForLigne(ligne.id).reduce((s, a) => s + a.quantite, 0)
    return total >= Number(ligne.quantiteDemandee ?? 0)
  }

  const allCovered = lignesG3.length > 0 && lignesG3.every(isLigneCovered)
  const hasAllocs  = allocs.length > 0

  async function submit() {
    if (!allCovered) return
    setSaving(true)
    try {
      const allocations = allocs
        .filter(a => a.quantite > 0)
        .map(a => ({ idLigne: a.idLigne, idLot: a.idLot, quantite: a.quantite }))
      await api.post(endpoints.ordersValiderEtLivrer(commande.id), { allocations })
      setToast({ msg: `Commande ${commande.codeCommande} livrée — lots G3 transférés`, type: 'success' })
      onSuccess()
      onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de la livraison', type: 'error' })
    } finally {
      setSaving(false) }
  }

  return (
    <Modal
      title="Préparer &amp; Livrer la commande"
      subtitle={`${commande.codeCommande} — Acheteur : ${commande.usernameAcheteur ?? '—'}`}
      onClose={onClose}
      size="lg"
    >
      {/* Bannière FIFO */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1e40af', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Zap size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Affectation <strong>FIFO automatique</strong> — les lots les plus anciens sont utilisés en premier. Vérifiez les quantités et confirmez. Le multiplicateur recevra les semences dans <strong>Mes Lots</strong>.</span>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 100, borderRadius: 10, marginBottom: 14 }} />
      ) : (
        <>
          {lignesG3.map((ligne: any) => {
            const rows    = allocsForLigne(ligne.id)
            const totalAl = rows.reduce((s, a) => s + a.quantite, 0)
            const demanded = Number(ligne.quantiteDemandee ?? 0)
            const covered  = totalAl >= demanded
            const manque   = demanded - totalAl

            return (
              <div key={ligne.id} style={{ border: `1px solid ${covered ? '#bbf7d0' : '#fca5a5'}`, borderRadius: 10, padding: 16, marginBottom: 14, background: covered ? '#f0fdf4' : '#fef2f2' }}>
                {/* En-tête ligne */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{varNom(ligne.idVariete)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      G3 · Demandé : <strong style={{ color: 'var(--text-primary)' }}>{demanded} kg</strong>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: covered ? '#15803d' : '#dc2626', background: covered ? '#dcfce7' : '#fee2e2', borderRadius: 99, padding: '3px 11px', flexShrink: 0 }}>
                    {covered ? `${totalAl} / ${demanded} kg ✓` : `${totalAl} / ${demanded} kg — manque ${manque} kg`}
                  </span>
                </div>

                {rows.length === 0 ? (
                  <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12.5, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <XCircle size={13} /> Aucun lot G3 disponible pour cette variété — stock UPSemCL insuffisant.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                      Affectation FIFO
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {rows.map(row => (
                        <div key={row.idLot} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 700, fontSize: 12.5, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{row.lotCode}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                              {row.dateProd !== '—' ? new Date(row.dateProd).toLocaleDateString('fr-FR') : '—'}
                            </span>
                            <span style={{ fontSize: 11, color: '#15803d', marginLeft: 8 }}>· {row.disponible} kg dispo</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <input
                              type="number"
                              value={row.quantite}
                              min={0}
                              max={row.disponible}
                              onChange={e => updateQte(ligne.id, row.idLot, e.target.value)}
                              style={{ width: 90, padding: '5px 8px', border: '1px solid var(--border-strong)', borderRadius: 5, fontSize: 13, fontFamily: 'var(--font-sans)', textAlign: 'right', outline: 'none', background: 'var(--surface)', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}

          {!hasAllocs && !loading && (
            <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 9 }}>
              <XCircle size={15} /> Aucun lot G3 disponible — impossible de livrer cette commande.
            </div>
          )}
        </>
      )}

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
        <button
          className="btn btn-primary"
          style={{ background: allCovered && !saving ? 'linear-gradient(135deg,#16a34a,#059669)' : undefined, border: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, opacity: !allCovered ? 0.6 : 1 }}
          onClick={submit}
          disabled={!allCovered || saving}
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
   MODAL : PROPOSER une allocation (Multiplicateur → Quotataire)
   Charge les lots R1/R2 du multiplicateur (mes-lots) pour la sélection.
   ══════════════════════════════════════════════════════════════════════════════ */
function ProposeMulModal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void
}) {
  const [mesLots,    setMesLots]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
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
    api.get(endpoints.lotsMesLots)
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : (r.data?.content ?? [])
        setMesLots(all.filter((l: any) =>
          l.generationCode === 'R2' &&
          ['DISPONIBLE','CERTIFIE'].includes(l.statutLot) &&
          Number(l.quantiteNette) > 0
        ))
      })
      .catch(() => setMesLots([]))
      .finally(() => setLoading(false))
  }, [])

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }
  function lotsForLigne(idVariete: number) {
    return mesLots.filter((lot: any) => lot.idVariete === idVariete)
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
      setToast({ msg: `Proposition envoyée pour ${commande.codeCommande} — le quotataire va recevoir votre offre`, type: 'success' })
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
        <span>Sélectionnez le lot <strong>R2</strong> disponible et proposez la quantité. Le quotataire pourra <strong>accepter ou refuser</strong> votre proposition avant le transfert physique.</span>
      </div>

      {lignes.map((ligne: any) => {
        const lots  = lotsForLigne(ligne.idVariete)
        const sel   = selections[ligne.id] ?? { idLot: null, quantite: '' }
        const lotSel = lots.find((l: any) => l.id === sel.idLot)
        return (
          <div key={ligne.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{varNom(ligne.idVariete)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Demandé : <strong style={{ color: 'var(--text-primary)' }}>{ligne.quantiteDemandee} {ligne.unite}</strong>
                </div>
              </div>
              <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 99, padding: '3px 11px', fontSize: 11.5, fontWeight: 700 }}>R2</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Lot à proposer</div>
              {loading ? (
                <div className="skeleton" style={{ height: 44, borderRadius: 8 }} />
              ) : lots.length === 0 ? (
                <div style={{ padding: '11px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <XCircle size={14} /> Aucun lot R2 disponible pour cette variété.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {lots.map((lot: any) => (
                    <label key={lot.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', border: `2px solid ${sel.idLot === lot.id ? '#d97706' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer', background: sel.idLot === lot.id ? '#fefce8' : 'var(--surface)', transition: 'all .12s' }}>
                      <input type="radio" name={`lot-mul-${ligne.id}`} checked={sel.idLot === lot.id} onChange={() => setSelections(s => ({ ...s, [ligne.id]: { ...s[ligne.id], idLot: lot.id } }))} style={{ accentColor: '#d97706', width: 15, height: 15 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{lot.codeLot}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{lot.generationCode}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{lot.campagne ?? '—'}</span>
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
                  style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', width: 150, outline: 'none', background: sel.idLot === null ? 'var(--surface-2)' : 'var(--surface)' }}
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
                  style={{ padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', width: 150, outline: 'none', background: sel.idLot === null ? 'var(--surface-2)' : 'var(--surface)' }}
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
   MODAL : VOIR PROPOSITION — Accepter ou Refuser
   Utilisé par le multiplicateur (proposition UPSemCL) ET par le quotataire
   (proposition du multiplicateur). Le fournisseurLabel adapte le texte.
   ══════════════════════════════════════════════════════════════════════════════ */
function VoirPropositionModal({
  commande, varieties, onClose, onSuccess, setToast, fournisseurLabel,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void; fournisseurLabel?: string
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
      setToast({ msg: `Proposition acceptée — le fournisseur va déclencher le transfert`, type: 'success' })
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
      title={`Proposition de ${fournisseurLabel ?? "l'UPSemCL"}`}
      subtitle={`Commande ${commande.codeCommande}`}
      onClose={onClose} size="md"
    >
      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Clock size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>{fournisseurLabel ?? "L'UPSemCL"} a proposé les quantités ci-dessous. Vous pouvez <strong>accepter</strong> pour valider le transfert ou <strong>refuser</strong> pour négocier une nouvelle proposition via la messagerie.</span>
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
    const allOrders = oRes.status === 'fulfilled' ? extractList(oRes.value.data) : []
    // UPSemCL ne traite que les commandes G3 (idGeneration 4) venant des multiplicateurs
    setOrders(allOrders.filter((o: any) => Array.isArray(o.lignes) && o.lignes.some((l: any) => l.idGeneration === 4)))
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

      {!loading && <EvolutionChart orders={orders} varieties={varieties} orgs={orgs} />}

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
          <div style={{ display: 'flex', gap: 8 }}>
            {displayed.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ gap: 5, fontSize: 12 }}
                onClick={() => downloadXlsx(`senjiw-commandes-recues-${new Date().toISOString().slice(0, 10)}`, buildOrderXlsSheets(displayed, orgs, varieties))}
              ><Download size={13} /> Export .xls</button>
            )}
            <button className="btn btn-secondary btn-icon" onClick={fetchAll}><RefreshCw size={13} /></button>
          </div>
        </div>

        <div className="filters-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0 11px', height: 34, flex: 1, maxWidth: 340 }}>
            <Search size={13} color="var(--text-muted)" />
            <input placeholder="Code commande ou client…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'var(--font-sans)', flex: 1 }} />
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
        <PropositionFifoDssModal commande={commandeAProposer} varieties={varieties} onClose={() => setCommandeAProposer(null)} onSuccess={fetchAll} setToast={setToast} />
      )}
      {commandeTransfert && (
        <ProposeModal commande={commandeTransfert} varieties={varieties} onClose={() => setCommandeTransfert(null)} onSuccess={fetchAll} setToast={setToast} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : PROPOSITION FIFO-DSS (UPSemCL → Multiplicateur, nouveau flux G3)
   ══════════════════════════════════════════════════════════════════════════════ */
function PropositionFifoDssModal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void
}) {
  const lignes: any[] = (commande.lignes ?? []).filter((l: any) => l.idGeneration === 4)
  const [lotsParVariete, setLotsParVariete] = useState<Record<number, any[]>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [props, setProps] = useState<Record<number, {
    idLotSuggereFifo: number | null
    quantiteSuggere: string
    idLotSelectionne: number | null
    quantiteSelectionnee: string
    motifOverride: string
    overrideActif: boolean
  }>>({})

  useEffect(() => {
    const init: typeof props = {}
    for (const l of lignes) init[l.id] = { idLotSuggereFifo: null, quantiteSuggere: '', idLotSelectionne: null, quantiteSelectionnee: String(l.quantiteDemandee ?? ''), motifOverride: '', overrideActif: false }
    setProps(init)

    Promise.all(lignes.map(l =>
      api.get(endpoints.orderLotsG3Fifo(l.idVariete))
        .then(r => ({ idVariete: l.idVariete, lots: r.data }))
        .catch(() => ({ idVariete: l.idVariete, lots: [] }))
    )).then(results => {
      const map: Record<number, any[]> = {}
      for (const { idVariete, lots } of results) map[idVariete] = lots

      // Pré-sélectionner le 1er lot FIFO par ligne
      setProps(prev => {
        const next = { ...prev }
        for (const l of lignes) {
          const lots = map[l.idVariete] ?? []
          const premier = lots[0]
          if (premier) {
            next[l.id] = { ...next[l.id], idLotSuggereFifo: premier.id, quantiteSuggere: String(l.quantiteDemandee ?? ''), idLotSelectionne: premier.id, quantiteSelectionnee: String(l.quantiteDemandee ?? '') }
          }
        }
        return next
      })
      setLotsParVariete(map)
    }).finally(() => setLoading(false))
  }, [])

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }

  const isValid = lignes.every(l => {
    const p = props[l.id]
    if (!p || !p.idLotSelectionne || !p.quantiteSelectionnee || Number(p.quantiteSelectionnee) <= 0) return false
    if (p.overrideActif && p.idLotSelectionne !== p.idLotSuggereFifo && !p.motifOverride.trim()) return false
    return true
  })

  async function submit() {
    if (!isValid) return; setSaving(true)
    try {
      const propositions = lignes.map(l => {
        const p = props[l.id]
        return {
          idLigne:              l.id,
          idLotSuggereFifo:     p.idLotSuggereFifo,
          quantiteSuggere:      Number(p.quantiteSuggere) || null,
          idLotSelectionne:     p.idLotSelectionne,
          quantiteSelectionnee: Number(p.quantiteSelectionnee),
          motifOverride:        p.overrideActif && p.idLotSelectionne !== p.idLotSuggereFifo ? p.motifOverride : null,
        }
      })
      await api.post(endpoints.orderPropositionsG3(commande.id), { propositions })
      setToast({ msg: `Proposition FIFO envoyée pour ${commande.codeCommande} — le multiplicateur va décider ligne par ligne`, type: 'success' })
      onSuccess(); onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de la proposition', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Proposition FIFO-DSS" subtitle={`${commande.codeCommande} · ${commande.usernameAcheteur ?? '—'}`} onClose={onClose} size="lg">
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1e40af', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Zap size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Le système a présélectionné les lots les plus anciens (<strong>FIFO</strong>). Vous pouvez conserver ou remplacer chaque lot — un motif est obligatoire en cas de remplacement.</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0,1].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 10 }} />)}
        </div>
      ) : lignes.map((ligne: any) => {
        const lots = lotsParVariete[ligne.idVariete] ?? []
        const p = props[ligne.id] ?? { idLotSuggereFifo: null, quantiteSuggere: '', idLotSelectionne: null, quantiteSelectionnee: '', motifOverride: '', overrideActif: false }
        const lotSuggere = lots.find((l: any) => l.id === p.idLotSuggereFifo)
        const lotSelectionne = lots.find((l: any) => l.id === p.idLotSelectionne)
        const needsMotif = p.overrideActif && p.idLotSelectionne !== p.idLotSuggereFifo

        return (
          <div key={ligne.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{varNom(ligne.idVariete)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>G3 · Demandé : <strong style={{ color: 'var(--text-primary)' }}>{ligne.quantiteDemandee} {ligne.unite}</strong></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#d97706', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={p.overrideActif} onChange={e => setProps(prev => ({ ...prev, [ligne.id]: { ...prev[ligne.id], overrideActif: e.target.checked } }))} style={{ accentColor: '#d97706' }} />
                Remplacer le lot FIFO
              </label>
            </div>

            {/* Suggestion FIFO */}
            {lotSuggere && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={11} /> Suggestion FIFO
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span><strong style={{ fontFamily: 'monospace' }}>{lotSuggere.codeLot}</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>Campagne : {lotSuggere.campagne ?? '—'}</span>
                  <span style={{ color: '#15803d', fontWeight: 600 }}>{Number(lotSuggere.quantiteNette).toFixed(0)} kg disponibles</span>
                  {lotSuggere.tauxGermination && <span style={{ color: 'var(--text-muted)' }}>Germ. : {lotSuggere.tauxGermination}%</span>}
                  {lotSuggere.puretePhysique && <span style={{ color: 'var(--text-muted)' }}>Pureté : {lotSuggere.puretePhysique}%</span>}
                </div>
              </div>
            )}
            {lots.length === 0 && (
              <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12.5, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <XCircle size={13} /> Aucun lot G3 UPSEMCL disponible — cette ligne ne peut pas être proposée.
              </div>
            )}

            {/* Override — masqué si aucun lot dispo */}
            {p.overrideActif && lots.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>Lot de remplacement</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lots.map((lot: any) => {
                    const isSel = p.idLotSelectionne === lot.id
                    const isFifo = lot.id === p.idLotSuggereFifo
                    return (
                      <label key={lot.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: `2px solid ${isSel ? '#d97706' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: isSel ? '#fefce8' : 'var(--surface)', transition: 'all .12s' }}>
                        <input type="radio" name={`lot-fifo-${ligne.id}`} checked={isSel} onChange={() => setProps(prev => ({ ...prev, [ligne.id]: { ...prev[ligne.id], idLotSelectionne: lot.id } }))} style={{ accentColor: '#d97706', width: 14, height: 14 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 12.5, fontFamily: 'monospace' }}>{lot.codeLot}</span>
                          {isFifo && <span style={{ marginLeft: 7, fontSize: 10, background: '#eff6ff', color: '#1e40af', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>FIFO</span>}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Campagne {lot.campagne ?? '—'}</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#15803d', flexShrink: 0 }}>{Number(lot.quantiteNette).toFixed(0)} kg</span>
                        {lot.tauxGermination && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Germ. {lot.tauxGermination}%</span>}
                      </label>
                    )
                  })}
                </div>
                {needsMotif && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Motif de remplacement <span style={{ color: '#dc2626' }}>*</span></div>
                    <textarea
                      value={p.motifOverride}
                      onChange={e => setProps(prev => ({ ...prev, [ligne.id]: { ...prev[ligne.id], motifOverride: e.target.value } }))}
                      placeholder="Expliquez pourquoi ce lot n'est pas utilisé selon le classement FIFO…"
                      rows={2}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </div>
            )}

            {lots.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>Quantité proposée</div>
                <input
                  type="number" value={p.quantiteSelectionnee} min={1}
                  max={lotSelectionne ? Number(lotSelectionne.quantiteNette) : undefined}
                  onChange={e => setProps(prev => ({ ...prev, [ligne.id]: { ...prev[ligne.id], quantiteSelectionnee: e.target.value } }))}
                  style={{ padding: '6px 10px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', width: 130, outline: 'none', background: 'var(--surface)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ligne.unite} sur {ligne.quantiteDemandee} demandés{lotSelectionne ? ` · ${Number(lotSelectionne.quantiteNette).toFixed(0)} kg dispo` : ''}</span>
              </div>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {!isValid && !loading && (
          <span style={{ fontSize: 11.5, color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
            <XCircle size={13} /> Sélectionnez un lot pour chaque variété avant d'envoyer
          </span>
        )}
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button
            className="btn btn-primary"
            style={{ background: isValid && !saving ? 'linear-gradient(135deg, #1d4ed8, #1e40af)' : '#9ca3af', border: 'none', display: 'flex', alignItems: 'center', gap: 7, cursor: isValid ? 'pointer' : 'not-allowed' }}
            onClick={submit} disabled={!isValid || saving}
          >
            {saving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Envoi…</> : <><Zap size={13} /> Envoyer la proposition FIFO</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : DÉCISION MULTIPLICATEUR — per-line accept/refuse
   ══════════════════════════════════════════════════════════════════════════════ */
function DecisionMultiplicateurModal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void
}) {
  const lignesG3: any[] = (commande.lignes ?? []).filter((l: any) => l.idGeneration === 4)
  const [decisions, setDecisions] = useState<Record<number, { accepte: boolean }>>(() => {
    const init: Record<number, { accepte: boolean }> = {}
    for (const l of lignesG3) init[l.id] = { accepte: true }
    return init
  })
  const [siteCode,  setSiteCode]  = useState('')
  const [mesSites,  setMesSites]  = useState<any[]>([])
  const [lotsInfo,  setLotsInfo]  = useState<Record<number, any>>({})
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    api.get(endpoints.sitesMesSites).then(r => {
      const sites = Array.isArray(r.data) ? r.data : (r.data?.content ?? [])
      setMesSites(sites)
      const principal = sites.find((s: any) => s.estPrincipal)
      if (principal) setSiteCode(principal.codeSite)
    }).catch(() => {})

    // Charger les infos des lots proposés (qualité)
    const ids = lignesG3.map((l: any) => l.idLotPropose).filter(Boolean)
    Promise.all(ids.map(id => api.get(endpoints.lotById(id)).then(r => [id, r.data] as [number, any]).catch(() => null)))
      .then(results => {
        const map: Record<number, any> = {}
        results.forEach(r => { if (r) map[r[0]] = r[1] })
        setLotsInfo(map)
      })
  }, [])

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }

  const nbAcceptes = Object.values(decisions).filter(d => d.accepte).length

  async function submit() {
    setSaving(true)
    try {
      const decs = lignesG3.map(l => ({ idLigne: l.id, accepte: decisions[l.id]?.accepte ?? true }))
      await api.patch(endpoints.orderDecisionMultiplicateur(commande.id), { decisions: decs, siteDestinationCode: siteCode || null })
      const msg = nbAcceptes === 0 ? `Toutes les lignes refusées — commande renvoyée à l'UPSemCL` : `Décision envoyée : ${nbAcceptes} ligne${nbAcceptes > 1 ? 's' : ''} acceptée${nbAcceptes > 1 ? 's' : ''}`
      setToast({ msg, type: nbAcceptes > 0 ? 'success' : 'warning' })
      onSuccess(); onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Décision par variété" subtitle={`${commande.codeCommande} — Acceptez ou refusez chaque variété proposée`} onClose={onClose} size="lg">
      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Settings2 size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Vérifiez les détails de chaque lot proposé. <strong>Acceptez ou refusez</strong> ligne par ligne avant d'envoyer votre décision finale.</span>
      </div>

      {lignesG3.map((ligne: any) => {
        const lot = lotsInfo[ligne.idLotPropose]
        const dec = decisions[ligne.id] ?? { accepte: true }
        return (
          <div key={ligne.id} style={{ border: `2px solid ${dec.accepte ? '#bbf7d0' : '#fca5a5'}`, borderRadius: 10, padding: 16, marginBottom: 14, background: dec.accepte ? '#f0fdf4' : '#fef2f2', transition: 'all .15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{varNom(ligne.idVariete)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>G3 · Demandé : {ligne.quantiteDemandee} {ligne.unite}</div>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={() => setDecisions(d => ({ ...d, [ligne.id]: { accepte: true } }))}
                  style={{ padding: '5px 14px', borderRadius: 7, border: `2px solid ${dec.accepte ? '#16a34a' : 'var(--border)'}`, background: dec.accepte ? '#dcfce7' : 'var(--surface)', color: dec.accepte ? '#15803d' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all .12s' }}>
                  <CheckCircle2 size={13} /> Accepter
                </button>
                <button onClick={() => setDecisions(d => ({ ...d, [ligne.id]: { accepte: false } }))}
                  style={{ padding: '5px 14px', borderRadius: 7, border: `2px solid ${!dec.accepte ? '#dc2626' : 'var(--border)'}`, background: !dec.accepte ? '#fee2e2' : 'var(--surface)', color: !dec.accepte ? '#dc2626' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all .12s' }}>
                  <XCircle size={13} /> Refuser
                </button>
              </div>
            </div>

            {ligne.idLotPropose && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontFamily: 'monospace' }}>
                  {lot?.codeLot ?? `Lot #${ligne.idLotPropose}`}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--text-muted)' }}>
                  {lot?.campagne && <span>Campagne : <strong style={{ color: 'var(--text-primary)' }}>{lot.campagne}</strong></span>}
                  <span>Qté proposée : <strong style={{ color: '#15803d' }}>{ligne.quantiteProposee ?? ligne.quantiteDemandee} kg</strong></span>
                  {lot?.controleQualite?.tauxGermination && <span>Germination : <strong style={{ color: '#1d4ed8' }}>{lot.controleQualite.tauxGermination}%</strong></span>}
                  {lot?.controleQualite?.puretePhysique && <span>Pureté : <strong>{lot.controleQualite.puretePhysique}%</strong></span>}
                  {lot?.controleQualite?.tauxHumidite && <span>Humidité : <strong>{lot.controleQualite.tauxHumidite}%</strong></span>}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <Field label="Site de destination">
        <select value={siteCode} onChange={e => setSiteCode(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none' }}>
          <option value="">— Site par défaut —</option>
          {mesSites.map((s: any) => <option key={s.codeSite} value={s.codeSite}>{s.codeSite} — {s.nomSite}{s.estPrincipal ? ' ★' : ''}</option>)}
        </select>
      </Field>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
        <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #059669)', border: 'none', display: 'flex', alignItems: 'center', gap: 7 }} onClick={submit} disabled={saving}>
          {saving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Envoi…</> : <><CheckCircle2 size={13} /> Envoyer ma décision</>}
        </button>
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : CONFIRMATION DE RÉCEPTION (Multiplicateur)
   ══════════════════════════════════════════════════════════════════════════════ */
function ReceptionConfirmationModal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void
}) {
  const lignesAccordees: any[] = (commande.lignes ?? []).filter((l: any) => ['ACCORDEE','LIVREE'].includes(l.statutLigne) || l.idLotPropose)
  const [observations, setObservations] = useState('')
  const [avecEcart, setAvecEcart] = useState(false)
  const [ecarts, setEcarts] = useState<Array<{ idLotSource: number; quantiteTransferee: string; quantiteRecue: string; observations: string }>>(
    () => lignesAccordees.map(l => ({ idLotSource: l.idLotPropose, quantiteTransferee: String(l.quantiteProposee ?? 0), quantiteRecue: String(l.quantiteProposee ?? 0), observations: '' }))
  )
  const [saving, setSaving] = useState(false)

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }

  async function submit() {
    setSaving(true)
    try {
      const body = {
        observations: observations || null,
        ecarts: avecEcart ? ecarts.filter(e => e.idLotSource).map(e => ({
          idLotSource: e.idLotSource,
          quantiteTransferee: Number(e.quantiteTransferee),
          quantiteRecue: Number(e.quantiteRecue),
          observations: e.observations || null,
        })) : null,
      }
      await api.post(endpoints.orderConfirmerReception(commande.id), body)
      setToast({ msg: `Réception confirmée pour ${commande.codeCommande} — semences créditées dans votre stock`, type: 'success' })
      onSuccess(); onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de la confirmation', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Confirmer la réception" subtitle={`${commande.codeCommande} · Bordereau de Réception`} onClose={onClose} size="md">
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#15803d', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <PackageCheck size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>En confirmant, vous certifiez avoir physiquement reçu les semences. Les lots seront crédités dans votre stock.</span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Semences reçues</div>
        <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Variété</th>
            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Qté transférée</th>
          </tr></thead>
          <tbody>
            {lignesAccordees.map((l: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 10px', fontWeight: 500 }}>{varNom(l.idVariete)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#15803d' }}>{l.quantiteProposee ?? '—'} {l.unite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Field label="Observations">
        <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Conditions de réception, remarques…" rows={2} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer', marginBottom: 14, marginTop: 4 }}>
        <input type="checkbox" checked={avecEcart} onChange={e => setAvecEcart(e.target.checked)} style={{ accentColor: '#d97706', width: 15, height: 15 }} />
        Déclarer un écart de quantité
      </label>

      {avecEcart && lignesAccordees.map((l: any, i: number) => (
        <div key={i} style={{ border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 10, background: '#fefce8' }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 8 }}>{varNom(l.idVariete)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>Qté transférée (kg)</div>
              <input type="number" value={ecarts[i]?.quantiteTransferee} readOnly style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, width: '100%', background: 'var(--surface-2)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 5 }}>Qté réellement reçue (kg)</div>
              <input type="number" value={ecarts[i]?.quantiteRecue} onChange={e => setEcarts(prev => prev.map((ec, j) => j === i ? { ...ec, quantiteRecue: e.target.value } : ec))} style={{ padding: '6px 10px', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, width: '100%', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
        <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #059669)', border: 'none', display: 'flex', alignItems: 'center', gap: 7 }} onClick={submit} disabled={saving}>
          {saving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Confirmation…</> : <><PackageCheck size={13} /> Confirmer la réception</>}
        </button>
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : PROPOSER une allocation R2 avec prix (Multiplicateur → Quotataire)
   ══════════════════════════════════════════════════════════════════════════════ */
function PropositionR2Modal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void
}) {
  const [mesLots,    setMesLots]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [selections, setSelections] = useState<Record<number, { idLot: number | null; quantite: string; prix: string; tva: string }>>({})

  const lignes: any[] = commande.lignes ?? []

  useEffect(() => {
    const init: Record<number, { idLot: number | null; quantite: string; prix: string; tva: string }> = {}
    for (const l of lignes) {
      init[l.id] = {
        idLot: l.idLotPropose ?? null,
        quantite: l.quantiteProposee != null ? String(l.quantiteProposee) : String(l.quantiteDemandee ?? ''),
        prix: '', tva: '0',
      }
    }
    setSelections(init)
    api.get(endpoints.lotsMesLots)
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : (r.data?.content ?? [])
        setMesLots(all.filter((l: any) =>
          l.generationCode === 'R2' &&
          ['DISPONIBLE','CERTIFIE'].includes(l.statutLot) &&
          Number(l.quantiteNette) > 0
        ))
      })
      .catch(() => setMesLots([]))
      .finally(() => setLoading(false))
  }, [])

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }
  function lotsForLigne(idVariete: number) {
    return mesLots.filter((lot: any) => lot.idVariete === idVariete)
  }

  const isValid = lignes.length > 0 && lignes.every((l: any) => {
    const sel = selections[l.id]
    return sel && sel.idLot !== null && sel.quantite && Number(sel.quantite) > 0
      && sel.prix && Number(sel.prix) >= 0
  })

  async function submit() {
    if (!isValid) return; setSaving(true)
    try {
      const propositions = lignes.map((l: any) => ({
        idLigne: l.id,
        idLotSelectionne: selections[l.id].idLot,
        quantiteSelectionnee: Number(selections[l.id].quantite),
        prixUnitaireHt: Number(selections[l.id].prix),
        tauxTva: Number(selections[l.id].tva ?? 0),
      }))
      await api.post(endpoints.orderPropositionsR2(commande.id), { propositions })
      setToast({ msg: `Proposition R2 envoyée pour ${commande.codeCommande} — le quotataire va examiner votre offre`, type: 'success' })
      onSuccess(); onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur lors de la proposition R2', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <Modal
      title="Proposition R2 — Catalogue"
      subtitle={`${commande.codeCommande} · Acheteur : ${commande.nomCompletAcheteur ?? commande.usernameAcheteur ?? '—'}`}
      onClose={onClose} size="lg"
    >
      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Settings2 size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Sélectionnez votre lot <strong>R2</strong> disponible, indiquez la quantité et le <strong>prix unitaire HT</strong>. Le quotataire pourra accepter ou refuser avant le transfert physique.</span>
      </div>

      {lignes.map((ligne: any) => {
        const lots  = lotsForLigne(ligne.idVariete)
        const sel   = selections[ligne.id] ?? { idLot: null, quantite: '', prix: '', tva: '0' }
        const lotSel = lots.find((l: any) => l.id === sel.idLot)
        const montantHT = sel.prix && sel.quantite ? Number(sel.prix) * Number(sel.quantite) : null
        return (
          <div key={ligne.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{varNom(ligne.idVariete)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Demandé : <strong style={{ color: 'var(--text-primary)' }}>{ligne.quantiteDemandee} {ligne.unite}</strong>
                </div>
              </div>
              <span style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 99, padding: '3px 11px', fontSize: 11.5, fontWeight: 700 }}>R2</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Lot à proposer</div>
              {loading ? (
                <div className="skeleton" style={{ height: 44, borderRadius: 8 }} />
              ) : lots.length === 0 ? (
                <div style={{ padding: '11px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <XCircle size={14} /> Aucun lot R2 disponible pour cette variété.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {lots.map((lot: any) => (
                    <label key={lot.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', border: `2px solid ${sel.idLot === lot.id ? '#d97706' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer', background: sel.idLot === lot.id ? '#fefce8' : 'var(--surface)', transition: 'all .12s' }}>
                      <input type="radio" name={`lot-r2-${ligne.id}`} checked={sel.idLot === lot.id} onChange={() => setSelections(s => ({ ...s, [ligne.id]: { ...s[ligne.id], idLot: lot.id } }))} style={{ accentColor: '#d97706', width: 15, height: 15 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{lot.codeLot}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{lot.campagne ?? '—'}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>{lot.quantiteNette} kg</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>disponible</div>
                      </div>
                      <span style={{ fontSize: 10.5, background: '#dcfce7', color: '#15803d', borderRadius: 99, padding: '2px 9px', fontWeight: 600 }}>{lot.statutLot}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Quantité ({ligne.unite})</div>
                <input type="number" value={sel.quantite} min={1} max={lotSel ? lotSel.quantiteNette : undefined}
                  onChange={e => setSelections(s => ({ ...s, [ligne.id]: { ...s[ligne.id], quantite: e.target.value } }))}
                  disabled={sel.idLot === null}
                  placeholder={String(ligne.quantiteDemandee ?? '')}
                  style={{ padding: '8px 10px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, width: '100%', outline: 'none', background: sel.idLot === null ? 'var(--surface-2)' : 'var(--surface)', boxSizing: 'border-box' }}
                />
                {lotSel && <div style={{ fontSize: 10.5, color: '#15803d', marginTop: 3 }}>{lotSel.quantiteNette} kg dispo</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Prix unitaire HT (FCFA/kg) *</div>
                <input type="number" value={sel.prix} min={0} step="0.01"
                  onChange={e => setSelections(s => ({ ...s, [ligne.id]: { ...s[ligne.id], prix: e.target.value } }))}
                  disabled={sel.idLot === null}
                  placeholder="ex : 450"
                  style={{ padding: '8px 10px', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, width: '100%', outline: 'none', background: sel.idLot === null ? 'var(--surface-2)' : '#fefce8', boxSizing: 'border-box' }}
                />
                {montantHT !== null && <div style={{ fontSize: 10.5, color: '#d97706', marginTop: 3, fontWeight: 600 }}>Montant HT : {montantHT.toLocaleString('fr-SN')} FCFA</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>TVA (%)</div>
                <input type="number" value={sel.tva} min={0} max={30} step="0.5"
                  onChange={e => setSelections(s => ({ ...s, [ligne.id]: { ...s[ligne.id], tva: e.target.value } }))}
                  placeholder="0"
                  style={{ padding: '8px 10px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 13, width: '100%', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {!isValid && !saving && (
          <span style={{ fontSize: 11.5, color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
            <XCircle size={13} /> Sélectionnez un lot et indiquez la quantité et le prix pour chaque variété
          </span>
        )}
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button
            className="btn btn-primary"
            style={{ background: isValid && !saving ? 'linear-gradient(135deg, #d97706, #b45309)' : '#9ca3af', border: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, cursor: isValid ? 'pointer' : 'not-allowed' }}
            onClick={submit} disabled={!isValid || saving}
          >
            {saving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Envoi…</> : <><Settings2 size={13} /> Envoyer proposition R2</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL : DÉCISION QUOTATAIRE sur proposition R2 (ACCORD / REFUS par ligne)
   ══════════════════════════════════════════════════════════════════════════════ */
function DecisionQuotataireModal({
  commande, varieties, onClose, onSuccess, setToast,
}: {
  commande: any; varieties: any[]; onClose: () => void; onSuccess: () => void; setToast: (t: any) => void
}) {
  const lignesR2: any[] = commande.lignes ?? []
  const [decisions, setDecisions] = useState<Record<number, { accepte: boolean }>>(() => {
    const init: Record<number, { accepte: boolean }> = {}
    for (const l of lignesR2) init[l.id] = { accepte: true }
    return init
  })
  const [propositions, setPropositions] = useState<Record<number, any>>({})
  const [lotsInfo, setLotsInfo] = useState<Record<number, any>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Charger le bordereau pour obtenir les prix proposés
    api.get(endpoints.orderBordereauTransfert(commande.id))
      .then(r => {
        const propMap: Record<number, any> = {}
        ;(r.data?.lignes ?? []).forEach((l: any) => { if (l.proposition) propMap[l.idLigne] = l.proposition })
        setPropositions(propMap)
      }).catch(() => {})

    const ids = lignesR2.map((l: any) => l.idLotPropose).filter(Boolean)
    Promise.all(ids.map(id => api.get(endpoints.lotById(id)).then(r => [id, r.data] as [number, any]).catch(() => null)))
      .then(results => {
        const map: Record<number, any> = {}
        results.forEach(r => { if (r) map[r[0]] = r[1] })
        setLotsInfo(map)
      })
  }, [])

  function varNom(idVariete: number) {
    const v = varieties.find((vv: any) => vv.id === idVariete)
    return v ? `${v.nomVariete} (${v.codeVariete})` : `Variété #${idVariete}`
  }

  const nbAcceptes = Object.values(decisions).filter(d => d.accepte).length

  async function submit() {
    setSaving(true)
    try {
      const decs = lignesR2.map(l => ({ idLigne: l.id, accepte: decisions[l.id]?.accepte ?? true }))
      await api.patch(endpoints.orderDecisionQuotataire(commande.id), { decisions: decs })
      const msg = nbAcceptes === 0
        ? `Toutes les lignes refusées — le multiplicateur pourra re-proposer`
        : `Décision envoyée : ${nbAcceptes} ligne${nbAcceptes > 1 ? 's' : ''} acceptée${nbAcceptes > 1 ? 's' : ''}`
      setToast({ msg, type: nbAcceptes > 0 ? 'success' : 'warning' })
      onSuccess(); onClose()
    } catch (err: any) {
      setToast({ msg: err?.response?.data?.message ?? 'Erreur', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Ma décision par variété" subtitle={`${commande.codeCommande} — Examinez la proposition du multiplicateur`} onClose={onClose} size="lg">
      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <Settings2 size={15} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>Vérifiez les lots proposés, les quantités et les <strong>prix unitaires HT</strong>. Acceptez ou refusez ligne par ligne.</span>
      </div>

      {lignesR2.map((ligne: any) => {
        const lot  = lotsInfo[ligne.idLotPropose]
        const prop = propositions[ligne.id]
        const dec  = decisions[ligne.id] ?? { accepte: true }
        const prix = prop?.prixUnitaireHt ?? null
        const qte  = ligne.quantiteProposee ?? ligne.quantiteDemandee
        const montantHT = prix !== null && qte ? Number(prix) * Number(qte) : null
        return (
          <div key={ligne.id} style={{ border: `2px solid ${dec.accepte ? '#bbf7d0' : '#fca5a5'}`, borderRadius: 10, padding: 16, marginBottom: 14, background: dec.accepte ? '#f0fdf4' : '#fef2f2', transition: 'all .15s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{varNom(ligne.idVariete)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  R2 · Demandé : {ligne.quantiteDemandee} {ligne.unite}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={() => setDecisions(d => ({ ...d, [ligne.id]: { accepte: true } }))}
                  style={{ padding: '5px 14px', borderRadius: 7, border: `2px solid ${dec.accepte ? '#16a34a' : 'var(--border)'}`, background: dec.accepte ? '#dcfce7' : 'var(--surface)', color: dec.accepte ? '#15803d' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all .12s' }}>
                  <CheckCircle2 size={13} /> Accepter
                </button>
                <button onClick={() => setDecisions(d => ({ ...d, [ligne.id]: { accepte: false } }))}
                  style={{ padding: '5px 14px', borderRadius: 7, border: `2px solid ${!dec.accepte ? '#dc2626' : 'var(--border)'}`, background: !dec.accepte ? '#fee2e2' : 'var(--surface)', color: !dec.accepte ? '#dc2626' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all .12s' }}>
                  <XCircle size={13} /> Refuser
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'monospace' }}>
                {lot?.codeLot ?? `Lot #${ligne.idLotPropose ?? '—'}`}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>Quantité proposée</div>
                  <div style={{ fontWeight: 700, color: '#15803d', fontSize: 13 }}>{qte} {ligne.unite}</div>
                </div>
                {prix !== null && (
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>Prix unitaire HT</div>
                    <div style={{ fontWeight: 700, color: '#d97706', fontSize: 13 }}>{Number(prix).toLocaleString('fr-SN')} FCFA/kg</div>
                  </div>
                )}
                {montantHT !== null && (
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>Montant HT estimé</div>
                    <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 13 }}>{montantHT.toLocaleString('fr-SN')} FCFA</div>
                  </div>
                )}
                {lot?.campagne && (
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>Campagne</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{lot.campagne}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
        <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #16a34a, #059669)', border: 'none', display: 'flex', alignItems: 'center', gap: 7 }} onClick={submit} disabled={saving}>
          {saving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Envoi…</> : <><CheckCircle2 size={13} /> Envoyer ma décision</>}
        </button>
      </div>
    </Modal>
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

      {!loading && <EvolutionChart orders={orders} varieties={varieties} orgs={orgs} />}

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
            {displayed.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ gap: 5, fontSize: 12 }}
                onClick={() => downloadXlsx(`senjiw-commandes-admin-${new Date().toISOString().slice(0, 10)}`, buildOrderXlsSheets(displayed, orgs, varieties))}
              ><Download size={13} /> Export .xls</button>
            )}
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
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, fontFamily: 'var(--font-sans)', flex: 1 }}
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
