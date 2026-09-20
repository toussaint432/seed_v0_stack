import { useEffect, useRef, useState } from 'react'
import { TrendingUp, AlertTriangle, RefreshCw, BarChart2, Activity, GitBranch, Download, ChevronRight, X, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { normalizeLot, extractList } from '../../lib/normalizers'
import { fmtT } from '../../lib/fmt'
import { downloadXlsx } from '../../lib/exportUtils'

interface Props {
  userSpecialisation?: string | null
}

interface ChainDemand {
  gen:             string
  username:        string
  nomComplet:      string | null
  nomOrganisation: string
  localisation:    string | null
  qtyKg:           number
  statut:          string
  orderId:         number
}

interface ChainVariete {
  codeVariete: string
  nomVariete:  string
  codeEspece:  string
  demands:     ChainDemand[]
}

interface ProdVariete {
  codeVariete: string
  nomVariete:  string
  g0Kg:        number
  g1Kg:        number
  total:       number
  nbLots:      number
}

interface MonthlyPoint {
  month: string
  count: number
  g1Kg:  number
  g3Kg:  number
  r2Kg:  number
}

interface LotAlert {
  codeVariete:  string
  nomVariete:   string
  codeEspece:   string
  totalG0Kg:    number
  lotsG0:       any[]
  isCritique:   boolean
  isFaible:     boolean
  isAncien:     boolean
  ageMaxAns:    number
  hasG1Demand:  boolean
}

const GEN_COLOR: Record<string, string> = {
  G0: '#1d4ed8', G1: '#15803d', G2: '#92660a',
  G3: '#6d28d9', G4: '#b91c1c', R1: '#0f766e', R2: '#16a34a',
}
const GEN_LABEL: Record<string, string> = {
  G0: 'Génétique', G1: 'Pré-base', G2: 'Base',
  G3: 'Certif. C1', G4: 'Certif. C2', R1: 'R1', R2: 'Commerciale',
}

const REFRESH_INTERVAL  = 30_000
const SEUIL_FAIBLE_KG   = 50
const SEUIL_CRITIQUE_KG = 20
const SEUIL_AGE_ANS     = 3

/* ══════════════════════════════════════════════════════════════════════════
   GRAPHE : Production G0 / G1 par variété
   Barres horizontales groupées, dynamiques, scrollables.
   Échelle commune G0 et G1 pour comparaison directe.
   ══════════════════════════════════════════════════════════════════════════ */
function ProdBarChart({ data }: { data: ProdVariete[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const commonMax = Math.max(...data.map(d => Math.max(d.g0Kg, d.g1Kg)), 1)

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 0', color: 'var(--text-muted)', gap: 8 }}>
        <BarChart2 size={28} style={{ opacity: 0.2 }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Aucun lot G0/G1 actif</span>
        <span style={{ fontSize: 11 }}>Les données apparaîtront une fois les lots créés et actifs</span>
      </div>
    )
  }

  return (
    <div>
      {/* Légende */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, paddingLeft: 2 }}>
        {([
          { color: GEN_COLOR.G0, label: 'G0 — Noyau génétique' },
          { color: GEN_COLOR.G1, label: 'G1 — Pré-base' },
        ] as const).map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {data.length} variété{data.length !== 1 ? 's' : ''}
          {data.length > 8 && ' — défilement activé'}
        </span>
      </div>

      {/* Container scrollable */}
      <div style={{ overflowY: 'auto', maxHeight: 370, paddingRight: 6 }}>
        {data.map(d => {
          const isHov = hovered === d.codeVariete
          const pctG0 = (d.g0Kg / commonMax) * 100
          const pctG1 = (d.g1Kg / commonMax) * 100
          return (
            <div
              key={d.codeVariete}
              onMouseEnter={() => setHovered(d.codeVariete)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                marginBottom: 3,
                background: isHov ? 'var(--surface-2)' : 'transparent',
                transition: 'background 0.13s',
                cursor: 'default',
                border: isHov ? '1px solid var(--border)' : '1px solid transparent',
              }}
            >
              {/* En-tête variété */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220,
                }} title={d.nomVariete}>
                  {d.nomVariete}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                  {d.codeVariete}
                </span>
                <span style={{
                  marginLeft: 'auto', fontSize: 10.5, fontWeight: 600,
                  color: 'var(--text-muted)', flexShrink: 0,
                  background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4,
                }}>
                  {d.nbLots}L
                </span>
              </div>

              {/* Barre G0 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 22, fontSize: 9.5, fontWeight: 800, color: GEN_COLOR.G0,
                  textAlign: 'right', flexShrink: 0, letterSpacing: '0.02em' }}>G0</span>
                <div style={{ flex: 1, height: 9, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pctG0}%`, height: '100%', borderRadius: 99,
                    background: `linear-gradient(90deg, ${GEN_COLOR.G0}dd, ${GEN_COLOR.G0}99)`,
                    transition: 'width 0.55s cubic-bezier(.4,0,.2,1)',
                    minWidth: d.g0Kg > 0 ? 4 : 0,
                  }} />
                </div>
                <span style={{
                  width: 68, fontSize: 11, fontWeight: 700, textAlign: 'right', flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  color: d.g0Kg > 0 ? GEN_COLOR.G0 : 'var(--text-muted)',
                }}>
                  {d.g0Kg > 0 ? fmtT(d.g0Kg) : '—'}
                </span>
              </div>

              {/* Barre G1 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, fontSize: 9.5, fontWeight: 800, color: GEN_COLOR.G1,
                  textAlign: 'right', flexShrink: 0, letterSpacing: '0.02em' }}>G1</span>
                <div style={{ flex: 1, height: 9, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pctG1}%`, height: '100%', borderRadius: 99,
                    background: `linear-gradient(90deg, ${GEN_COLOR.G1}dd, ${GEN_COLOR.G1}99)`,
                    transition: 'width 0.55s cubic-bezier(.4,0,.2,1)',
                    minWidth: d.g1Kg > 0 ? 4 : 0,
                  }} />
                </div>
                <span style={{
                  width: 68, fontSize: 11, fontWeight: 700, textAlign: 'right', flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                  color: d.g1Kg > 0 ? GEN_COLOR.G1 : 'var(--text-muted)',
                }}>
                  {d.g1Kg > 0 ? fmtT(d.g1Kg) : '—'}
                </span>
              </div>

              {/* Tooltip inline au survol */}
              {isHov && d.total > 0 && (
                <div style={{
                  marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--border)',
                  display: 'flex', gap: 14, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    Total : <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {d.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg
                    </strong>
                  </span>
                  {d.g0Kg > 0 && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      G0 : <strong style={{ color: GEN_COLOR.G0, fontVariantNumeric: 'tabular-nums' }}>
                        {d.g0Kg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg
                      </strong>
                    </span>
                  )}
                  {d.g1Kg > 0 && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                      G1 : <strong style={{ color: GEN_COLOR.G1, fontVariantNumeric: 'tabular-nums' }}>
                        {d.g1Kg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   GRAPHE : Évolution mensuelle des demandes sur les variétés du sélectionneur
   ══════════════════════════════════════════════════════════════════════════ */
const STACK_COLORS = { g1: '#0ea5e9', g3: '#f59e0b', r2: '#14b8a6' }
const STACK_LABELS = { g1: 'G1 → UPSemCL', g3: 'G3 → Mult.', r2: 'R2 → Quot.' }

function StackedMonthChart({ data, periodLabel }: { data: MonthlyPoint[]; periodLabel: string }) {
  const [hov, setHov] = useState<number | null>(null)
  const totalG1 = data.reduce((s, d) => s + d.g1Kg, 0)
  const totalG3 = data.reduce((s, d) => s + d.g3Kg, 0)
  const totalR2 = data.reduce((s, d) => s + d.r2Kg, 0)
  const totalKg = totalG1 + totalG3 + totalR2
  const totalOrders = data.reduce((s, d) => s + d.count, 0)
  const hasKg = totalKg > 0

  const W = 400; const H = 200; const PT = 24; const PB = 28; const PL = 36; const PR = 10
  const iW = W - PL - PR; const iH = H - PT - PB
  const maxPerBar = Math.max(...data.map(d => d.g1Kg + d.g3Kg + d.r2Kg), 1)
  const TICKS = 3
  const niceMax = maxPerBar <= 0.1 ? 1 : Math.ceil(maxPerBar / Math.pow(10, Math.floor(Math.log10(maxPerBar)))) * Math.pow(10, Math.floor(Math.log10(maxPerBar)))
  const bW = iW / Math.max(data.length, 1)

  function fmt(kg: number) {
    return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`
  }
  const lastActiveIdx = data.reduce((best, d, i) => (d.g1Kg + d.g3Kg + d.r2Kg) > 0 ? i : best, -1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {hasKg ? fmt(totalKg) : `${totalOrders} commande${totalOrders !== 1 ? 's' : ''}`}
        </span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{periodLabel}</span>
        {hasKg && (['g1','g3','r2'] as const).map(k => {
          const kg = k === 'g1' ? totalG1 : k === 'g3' ? totalG3 : totalR2
          if (kg <= 0) return null
          return (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: STACK_COLORS[k], display: 'inline-block' }} />
              {STACK_LABELS[k]} · <strong style={{ color: STACK_COLORS[k] }}>{fmt(kg)}</strong>
            </span>
          )
        })}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        {Array.from({ length: TICKS + 1 }, (_, t) => {
          const y = PT + (t / TICKS) * iH
          const v = niceMax * (1 - t / TICKS)
          const label = v >= 1000 ? `${(v / 1000).toFixed(0)}t` : v > 0 ? `${Math.round(v)}` : '0'
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)"
                strokeWidth={t === TICKS ? 1.5 : 0.6} strokeDasharray={t === TICKS ? '0' : '3,4'} />
              <text x={PL - 4} y={y + 4} textAnchor="end" fontSize={8} fill="var(--text-muted)" fontFamily="var(--font-sans)">{label}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const total = d.g1Kg + d.g3Kg + d.r2Kg
          const isHov = hov === i; const isLast = i === lastActiveIdx
          const x = PL + i * bW + bW * 0.15; const bw = bW * 0.7
          let yBase = PT + iH
          const segments = [
            { key: 'g1', kg: d.g1Kg, color: STACK_COLORS.g1 },
            { key: 'g3', kg: d.g3Kg, color: STACK_COLORS.g3 },
            { key: 'r2', kg: d.r2Kg, color: STACK_COLORS.r2 },
          ].filter(s => s.kg > 0)
          const bars = segments.map(s => {
            const bh = Math.max((s.kg / niceMax) * iH, 2); const y = yBase - bh; yBase -= bh
            return { ...s, y, bh }
          })
          const topY = bars.length > 0 ? bars[bars.length - 1].y : PT + iH
          return (
            <g key={i} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} style={{ cursor: 'default' }}>
              {isHov && <rect x={x - 2} y={PT} width={bw + 4} height={iH} rx={3} fill="#0ea5e9" opacity={0.05} />}
              {bars.length === 0 && <rect x={x} y={PT + iH - 2} width={bw} height={2} rx={1} fill="var(--border)" opacity={0.4} />}
              {bars.map((b, j) => (
                <rect key={b.key} x={x} y={b.y} width={bw} height={b.bh}
                  rx={j === bars.length - 1 ? 3 : 0} fill={b.color}
                  opacity={isHov ? 1 : isLast ? 0.9 : 0.75} style={{ transition: 'opacity 0.15s' }} />
              ))}
              {total > 0 && (
                <text x={x + bw / 2} y={topY - 5} textAnchor="middle"
                  fontSize={isHov ? 9.5 : 8.5} fontWeight={700} fill="var(--text-secondary)"
                  fontFamily="var(--font-sans)" style={{ transition: 'font-size 0.1s' }}>
                  {fmt(total)}
                </text>
              )}
              <text x={x + bw / 2} y={H - PB + 12} textAnchor="middle" fontSize={9}
                fontWeight={isHov || isLast ? 700 : 400}
                fill={isHov || isLast ? '#0369a1' : 'var(--text-muted)'} fontFamily="var(--font-sans)">
                {d.month}
              </text>
              {isHov && total > 0 && (
                <g>
                  <rect x={x + bw / 2 - 54} y={topY - 60} width={108} height={50} rx={6} fill="var(--text-primary)" opacity={0.92} />
                  <text x={x + bw / 2} y={topY - 46} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="var(--font-sans)">{d.month}</text>
                  {d.g1Kg > 0 && <text x={x + bw / 2} y={topY - 34} textAnchor="middle" fontSize={8.5} fill={STACK_COLORS.g1} fontFamily="var(--font-sans)">G1: {fmt(d.g1Kg)}</text>}
                  {d.g3Kg > 0 && <text x={x + bw / 2} y={topY - 34 + (d.g1Kg > 0 ? 11 : 0)} textAnchor="middle" fontSize={8.5} fill={STACK_COLORS.g3} fontFamily="var(--font-sans)">G3: {fmt(d.g3Kg)}</text>}
                  {d.r2Kg > 0 && <text x={x + bw / 2} y={topY - 34 + (d.g1Kg > 0 ? 11 : 0) + (d.g3Kg > 0 ? 11 : 0)} textAnchor="middle" fontSize={8.5} fill={STACK_COLORS.r2} fontFamily="var(--font-sans)">R2: {fmt(d.r2Kg)}</text>}
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL DÉTAIL D'ALERTE (overlay)
   ══════════════════════════════════════════════════════════════════════════ */
function AlertDetailPanel({ alert: a, onClose }: { alert: LotAlert; onClose: () => void }) {
  function fmtAge(ans: number) {
    if (ans < 1) return `${Math.round(ans * 12)} mois`
    return `${ans.toFixed(1)} an${ans >= 2 ? 's' : ''}`
  }
  function fmtDate(raw: string | null) {
    if (!raw) return '—'
    const d = new Date(raw)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const contextMsg = a.isCritique
    ? 'Stock de noyau génétique critique. Initier une multiplication interne ou contacter l\'UPSemCL pour planifier une nouvelle production de G0 avant épuisement complet.'
    : a.isFaible
    ? 'Stock de noyau génétique faible. Pensez à planifier une nouvelle campagne G0 pour cette variété afin de maintenir la capacité de production G1.'
    : 'Noyau génétique ancien — renouvellement recommandé pour maintenir la viabilité germinative et la pureté génétique.'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 520,
        boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {/* En-tête */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          background: a.isCritique ? '#fef2f2' : a.isFaible ? '#fffbeb' : '#eff6ff',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={16} color={a.isCritique ? '#dc2626' : a.isFaible ? '#d97706' : '#1d4ed8'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{a.nomVariete}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {a.codeVariete} · {a.codeEspece}
              {a.isAncien && (
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#1d4ed8',
                  background: '#eff6ff', padding: '1px 7px', borderRadius: 99, border: '1px solid #bfdbfe' }}>
                  <Clock size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                  {fmtAge(a.ageMaxAns)} · Renouvellement recommandé
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* KPI stock */}
        <div style={{ padding: '14px 18px', display: 'flex', gap: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 10,
            background: a.isCritique ? '#fef2f2' : '#fffbeb', border: `1px solid ${a.isCritique ? '#fecaca' : '#fde68a'}` }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
              color: a.isCritique ? '#dc2626' : '#d97706', lineHeight: 1 }}>
              {a.totalG0Kg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
              Stock G0 total · seuil {SEUIL_FAIBLE_KG} kg
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 10,
            background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
              {a.lotsG0.length}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3 }}>
              lot{a.lotsG0.length !== 1 ? 's' : ''} G0 concerné{a.lotsG0.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Message contextuel */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {contextMsg}
          {a.hasG1Demand && (
            <div style={{ marginTop: 6, fontWeight: 600, color: GEN_COLOR.G1, fontSize: 12 }}>
              ⚠ Des demandes G1 sont en cours sur cette variété — la pression aval justifie une attention prioritaire.
            </div>
          )}
        </div>

        {/* Liste des lots G0 */}
        <div style={{ padding: '10px 18px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
            letterSpacing: '.05em', marginBottom: 8 }}>Lots G0 actifs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {a.lotsG0.map((l: any, i: number) => {
              const dateStr = l.dateProduction ?? l.createdAt ?? null
              const ageMs = dateStr ? Date.now() - new Date(dateStr).getTime() : 0
              const ageAns = ageMs / (365.25 * 24 * 3600 * 1000)
              const ancien = ageAns > SEUIL_AGE_ANS
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8,
                  background: ancien ? '#eff6ff' : 'var(--surface-2)',
                  border: `1px solid ${ancien ? '#bfdbfe' : 'var(--border)'}`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', flex: 1 }}>
                    {l.codeLot ?? '—'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: GEN_COLOR.G0, fontVariantNumeric: 'tabular-nums' }}>
                    {(parseFloat(l.quantiteNette) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg
                  </span>
                  {dateStr && (
                    <span style={{ fontSize: 10.5, color: ancien ? '#1d4ed8' : 'var(--text-muted)', flexShrink: 0 }}>
                      {fmtDate(dateStr)}
                      {ancien && <span style={{ marginLeft: 4, fontWeight: 700 }}>· {fmtAge(ageAns)}</span>}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ══════════════════════════════════════════════════════════════════════════ */
type Period  = '1m'|'3m'|'6m'|'1a'
type GenKey  = 'g1'|'g3'|'r2'
const PERIOD_COUNTS: Record<Period, number> = { '1m': 1, '3m': 3, '6m': 6, '1a': 12 }
const PERIOD_LABELS: Record<Period, string> = {
  '1m': '1 dernier mois', '3m': '3 derniers mois', '6m': '6 derniers mois', '1a': '12 derniers mois',
}

export function SelectorAnalytics({ userSpecialisation }: Props) {
  const [prodByVariete, setProdByVariete] = useState<ProdVariete[]>([])
  const [monthly,       setMonthly]       = useState<MonthlyPoint[]>([])
  const [alerts,        setAlerts]        = useState<LotAlert[]>([])
  const [alertDetail,   setAlertDetail]   = useState<LotAlert | null>(null)
  const [lots,              setLots]              = useState<any[]>([])
  const [brouillonNearLock, setBrouillonNearLock] = useState<any[]>([])
  const [chainVarietes,     setChainVarietes]     = useState<ChainVariete[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [period,        setPeriod]        = useState<Period>('6m')
  const [genFilter,     setGenFilter]     = useState<Set<GenKey>>(new Set())
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchData(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      const [ordersRes, lotsRes] = await Promise.allSettled([
        api.get(`${endpoints.orders}?size=200`),
        api.get(endpoints.lotsMesLots),
      ])

      const orders   = extractList(ordersRes.status === 'fulfilled' ? ordersRes.value.data : null)
      const lotsData = extractList(lotsRes.status   === 'fulfilled' ? lotsRes.value.data   : null).map(normalizeLot)

      setLots(lotsData)

      const specFilter = userSpecialisation?.toUpperCase()
      const ACTIVE_STATUTS_LOT = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT','SOUCHE']

      /* ── Map variétés depuis les lots (nomVariete + codeVariete dénormalisés en V70) ── */
      const lotVarietyMap: Record<number, { nomVariete: string; codeVariete: string; codeEspece: string }> = {}
      lotsData.forEach((l: any) => {
        const idVar = l.idVariete
        if (idVar && !lotVarietyMap[idVar]) {
          lotVarietyMap[idVar] = {
            nomVariete:  l.nomVariete  || l.codeVariete || String(idVar),
            codeVariete: l.codeVariete || '',
            codeEspece:  (l.codeEspece ?? '').toUpperCase(),
          }
        }
      })

      /* ── Production G0/G1 par variété ── */
      const prodMap: Record<string, ProdVariete> = {}
      lotsData.forEach((l: any) => {
        const gen = l.generation?.codeGeneration ?? ''
        if (gen !== 'G0' && gen !== 'G1') return
        const idVar = l.idVariete
        if (!idVar) return
        const vInfo = lotVarietyMap[idVar] ?? { nomVariete: String(idVar), codeVariete: '', codeEspece: '' }
        if (specFilter && vInfo.codeEspece && vInfo.codeEspece !== specFilter) return
        const statut = (l.statutLot ?? '').toUpperCase()
        if (!ACTIVE_STATUTS_LOT.includes(statut)) return
        const key = String(idVar)
        if (!prodMap[key]) prodMap[key] = {
          codeVariete: vInfo.codeVariete || key,
          nomVariete:  vInfo.nomVariete,
          g0Kg: 0, g1Kg: 0, total: 0, nbLots: 0,
        }
        const qty = parseFloat(l.quantiteNette) || 0
        if (gen === 'G0') prodMap[key].g0Kg += qty
        else              prodMap[key].g1Kg += qty
        prodMap[key].total  += qty
        prodMap[key].nbLots++
      })
      setProdByVariete(Object.values(prodMap).sort((a, b) => b.total - a.total))

      /* ── Évolution mensuelle des demandes (12 mois) ── */
      const now2 = new Date()
      const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
      const monthPoints: any[] = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now2.getFullYear(), now2.getMonth() - (11 - i), 1)
        return { month: MONTHS[d.getMonth()], count: 0, g1Kg: 0, g3Kg: 0, r2Kg: 0, _year: d.getFullYear(), _month: d.getMonth() }
      })
      /* IDs des variétés gérées par ce sélectionneur — filtre les lignes hors scope */
      const selectorVarieteIds = new Set(lotsData.map((l: any) => l.idVariete).filter(Boolean))

      orders.forEach((o: any) => {
        const createdAt = o.createdAt || o.dateCommande
        if (!createdAt) return
        const d = new Date(createdAt)
        const mp = monthPoints.find(p => p._year === d.getFullYear() && p._month === d.getMonth())
        if (!mp) return
        let relevant = false
        ;(o.lignes ?? []).forEach((ligne: any) => {
          if (!selectorVarieteIds.has(ligne.idVariete)) return
          const gen = ligne.generation?.codeGeneration ?? ligne.codeGeneration ?? '?'
          const qty = parseFloat(ligne.quantiteDemandee ?? 0) || 0
          if (gen === 'G1')                        mp.g1Kg += qty
          else if (['G2','G3','G4'].includes(gen)) mp.g3Kg += qty
          else if (['R1','R2'].includes(gen))       mp.r2Kg += qty
          relevant = true
        })
        if (relevant) mp.count++
      })
      setMonthly(monthPoints.map(p => ({ month: p.month, count: p.count, g1Kg: p.g1Kg, g3Kg: p.g3Kg, r2Kg: p.r2Kg })))

      /* ── Chaîne aval : qui commande mes variétés ── */
      const chainMap: Record<string, ChainVariete> = {}
      const ACTIVE_ORD = ['SOUMISE','ACCEPTEE','LIVREE']
      orders.forEach((o: any) => {
        if (!ACTIVE_ORD.includes((o.statut ?? '').toUpperCase())) return
        ;(o.lignes ?? []).forEach((ligne: any) => {
          const gen = ligne.generation?.codeGeneration ?? ligne.codeGeneration ?? '?'
          if (!['G1','G3','G4','R1','R2'].includes(gen)) return
          const idVar = ligne.idVariete
          if (!idVar || !selectorVarieteIds.has(idVar)) return
          const vInfo = lotVarietyMap[idVar] ?? { nomVariete: String(idVar), codeVariete: '', codeEspece: '' }
          if (specFilter && vInfo.codeEspece && vInfo.codeEspece !== specFilter) return
          const key = String(idVar)
          if (!chainMap[key]) chainMap[key] = {
            codeVariete: vInfo.codeVariete || key,
            nomVariete: vInfo.nomVariete,
            codeEspece: vInfo.codeEspece || '?', demands: [],
          }
          chainMap[key].demands.push({
            gen,
            username:        o.usernameAcheteur ?? '—',
            nomComplet:      o.nomCompletAcheteur ?? null,
            nomOrganisation: o.nomOrganisationAcheteur ?? o.client ?? '—',
            localisation:    o.localisationAcheteur ?? null,
            qtyKg:  parseFloat(ligne.quantiteDemandee ?? 0) || 0,
            statut: (o.statut ?? '').toUpperCase(),
            orderId: o.id ?? 0,
          })
        })
      })
      setChainVarietes(
        Object.values(chainMap)
          .map(v => ({ ...v, demands: v.demands.sort((a, b) => {
            const ORDER = ['G1','G3','G4','R1','R2']
            return ORDER.indexOf(a.gen) - ORDER.indexOf(b.gen)
          })}))
          .sort((a, b) => b.demands.length - a.demands.length)
      )

      /* ── Alertes G0 : stock faible (< 50 kg) ou ancienneté (> 3 ans) ── */
      const nowMs = Date.now()
      const g0Map: Record<string, { lots: any[]; totalKg: number; idVar: number }> = {}
      lotsData.forEach((l: any) => {
        const gen = l.generation?.codeGeneration
        if (gen !== 'G0') return
        const idVar = l.idVariete
        if (!idVar) return
        const vInfo = lotVarietyMap[idVar] ?? { nomVariete: String(idVar), codeVariete: '', codeEspece: '' }
        if (specFilter && vInfo.codeEspece && vInfo.codeEspece !== specFilter) return
        const key = String(idVar)
        if (!g0Map[key]) g0Map[key] = { lots: [], totalKg: 0, idVar }
        g0Map[key].lots.push(l)
        g0Map[key].totalKg += parseFloat(l.quantiteNette) || 0
      })

      const alertsList: LotAlert[] = Object.entries(g0Map)
        .map(([key, { lots: lotList, totalKg, idVar }]) => {
          const vInfo = lotVarietyMap[idVar] ?? { nomVariete: key, codeVariete: '', codeEspece: '' }
          let maxAgeMs = 0
          lotList.forEach(l => {
            const raw = l.dateProduction ?? l.createdAt ?? null
            if (raw) {
              const t = new Date(raw).getTime()
              if (!isNaN(t)) maxAgeMs = Math.max(maxAgeMs, nowMs - t)
            }
          })
          const ageMaxAns = maxAgeMs / (365.25 * 24 * 3600 * 1000)
          const hasG1Demand = !!(chainMap[key]?.demands.some(d => d.gen === 'G1'))
          return {
            codeVariete:  vInfo.codeVariete || key,
            nomVariete:   vInfo.nomVariete,
            codeEspece:   vInfo.codeEspece || '?',
            totalG0Kg:    totalKg,
            lotsG0:       lotList,
            isCritique:   totalKg < SEUIL_CRITIQUE_KG,
            isFaible:     totalKg >= SEUIL_CRITIQUE_KG && totalKg < SEUIL_FAIBLE_KG,
            isAncien:     ageMaxAns > SEUIL_AGE_ANS,
            ageMaxAns,
            hasG1Demand,
          }
        })
        .filter(a => a.isCritique || a.isFaible || a.isAncien)
        .sort((a, b) => {
          const score = (x: LotAlert) => x.isCritique ? 3 : x.isFaible ? 2 : 1
          return score(b) - score(a) || a.totalG0Kg - b.totalG0Kg
        })
      setAlerts(alertsList)

      /* ── Lots BROUILLON proches du verrouillage automatique (30 j) ── */
      const nowMs2 = Date.now()
      const nearLock = lotsData.filter((l: any) => {
        if (l.statutEdition === 'CONFIRME') return false
        const created = l.createdAt ? new Date(l.createdAt).getTime() : null
        if (!created || isNaN(created)) return false
        const ageDays = (nowMs2 - created) / 86_400_000
        return ageDays >= 23
      }).map((l: any) => {
        const ageDays = (nowMs2 - new Date(l.createdAt).getTime()) / 86_400_000
        return { ...l, ageDays: Math.round(ageDays), daysLeft: Math.max(0, 30 - Math.round(ageDays)) }
      }).sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      setBrouillonNearLock(nearLock)

    } catch { /* silencieux */ } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    timer.current = setInterval(() => fetchData(true), REFRESH_INTERVAL)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [userSpecialisation])

  /* ── Données dérivées ── */
  const specUp = userSpecialisation?.toUpperCase()
  const ACTIVE_LOT = ['DISPONIBLE','EN_PRODUCTION','CERTIFIE','EN_COURS_CERT','SOUCHE']

  /* Map variété locale reconstruite depuis les lots (nomVariete dénormalisé en V70) */
  const lotVarMap: Record<number, { nomVariete: string; codeVariete: string; codeEspece: string }> = {}
  lots.forEach((l: any) => {
    if (l.idVariete && !lotVarMap[l.idVariete]) {
      lotVarMap[l.idVariete] = {
        nomVariete:  l.nomVariete  || l.codeVariete || String(l.idVariete),
        codeVariete: l.codeVariete || '',
        codeEspece:  (l.codeEspece ?? '').toUpperCase(),
      }
    }
  })

  /* Pipeline KPIs — fix: l.statutLot (pas l.statut) */
  const kpiG0Kg = lots
    .filter((l: any) => l.generation?.codeGeneration === 'G0' && ACTIVE_LOT.includes((l.statutLot ?? '').toUpperCase()))
    .reduce((s: number, l: any) => s + (parseFloat(l.quantiteNette) || 0), 0)
  const kpiG1Kg = lots
    .filter((l: any) => l.generation?.codeGeneration === 'G1' && ACTIVE_LOT.includes((l.statutLot ?? '').toUpperCase()))
    .reduce((s: number, l: any) => s + (parseFloat(l.quantiteNette) || 0), 0)
  const kpiG3Kg = chainVarietes.reduce((s, v) =>
    s + v.demands.filter(d => ['G3','G4'].includes(d.gen)).reduce((ss, d) => ss + d.qtyKg, 0), 0)
  const kpiR2Kg = chainVarietes.reduce((s, v) =>
    s + v.demands.filter(d => ['R1','R2'].includes(d.gen)).reduce((ss, d) => ss + d.qtyKg, 0), 0)

  /* Certification G1 (lots G1 avec statut certification en attente ou rejeté) */
  const certifEnAttente = lots.filter((l: any) =>
    l.generation?.codeGeneration === 'G1' && l.statutCertification === 'EN_ATTENTE').length
  const certifRejete = lots.filter((l: any) =>
    l.generation?.codeGeneration === 'G1' && l.statutCertification === 'REJETE').length

  /* Chaîne complète G0/G1 + commandes aval */
  const fullChainMap: Record<string, {
    codeVariete: string; nomVariete: string; codeEspece: string
    g0kg: number; g1kg: number; lotCount: number
    demandesG1: ChainDemand[]; demandesG3: ChainDemand[]; demandesR2: ChainDemand[]
  }> = {}

  lots.forEach((l: any) => {
    const gen = l.generation?.codeGeneration ?? ''
    if (!['G0','G1'].includes(gen)) return
    const idVar = l.idVariete
    if (!idVar) return
    const vInfo = lotVarMap[idVar] ?? { nomVariete: String(idVar), codeVariete: '', codeEspece: '' }
    if (specUp && vInfo.codeEspece && vInfo.codeEspece !== specUp) return
    const key = String(idVar)
    if (!fullChainMap[key]) fullChainMap[key] = {
      codeVariete: vInfo.codeVariete || key, nomVariete: vInfo.nomVariete,
      codeEspece: vInfo.codeEspece || '?',
      g0kg: 0, g1kg: 0, lotCount: 0, demandesG1: [], demandesG3: [], demandesR2: [],
    }
    const qty = parseFloat(l.quantiteNette) || 0
    if (gen === 'G0') fullChainMap[key].g0kg += qty
    else fullChainMap[key].g1kg += qty
    fullChainMap[key].lotCount++
  })

  chainVarietes.forEach(v => {
    if (!fullChainMap[v.codeVariete]) fullChainMap[v.codeVariete] = {
      codeVariete: v.codeVariete, nomVariete: v.nomVariete, codeEspece: v.codeEspece,
      g0kg: 0, g1kg: 0, lotCount: 0, demandesG1: [], demandesG3: [], demandesR2: [],
    }
    const entry = fullChainMap[v.codeVariete]
    v.demands.forEach((d: ChainDemand) => {
      if (d.gen === 'G1') entry.demandesG1.push(d)
      else if (d.gen === 'G3') entry.demandesG3.push(d)
      else if (['R1','R2'].includes(d.gen)) entry.demandesR2.push(d)
    })
  })

  const fullChain = Object.values(fullChainMap)
    .filter(v => v.lotCount > 0 || v.demandesG1.length > 0 || v.demandesG3.length > 0 || v.demandesR2.length > 0)
    .sort((a, b) => {
      const ta = a.demandesR2.length + a.demandesG3.length + a.demandesG1.length
      const tb = b.demandesR2.length + b.demandesG3.length + b.demandesG1.length
      return tb !== ta ? tb - ta : (b.g1kg + b.g0kg) - (a.g1kg + a.g0kg)
    })

  /* Filtres période / génération */
  const displayMonthly = monthly.slice(monthly.length - PERIOD_COUNTS[period])
  const activeGens: Set<GenKey> = genFilter.size === 0 ? new Set(['g1','g3','r2']) : genFilter
  const filteredMonthly: MonthlyPoint[] = displayMonthly.map(m => ({
    ...m,
    g1Kg: activeGens.has('g1') ? m.g1Kg : 0,
    g3Kg: activeGens.has('g3') ? m.g3Kg : 0,
    r2Kg: activeGens.has('r2') ? m.r2Kg : 0,
  }))

  function toggleGen(k: GenKey) {
    setGenFilter(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  function handleExport() {
    const prodRows = prodByVariete.map(d => [
      d.nomVariete, d.codeVariete,
      Math.round(d.g0Kg), Math.round(d.g1Kg), Math.round(d.total), d.nbLots,
    ])
    const chainRows: any[] = []
    fullChain.forEach(v => {
      v.demands.forEach(d => {
        chainRows.push([v.nomVariete, v.codeVariete, v.codeEspece, d.gen,
          d.nomComplet ?? d.username, d.nomOrganisation, d.localisation ?? '—',
          Math.round(d.qtyKg), parseFloat((d.qtyKg / 1000).toFixed(3)), d.statut])
      })
    })
    downloadXlsx(`senjiw-selecteur-${new Date().toISOString().slice(0, 10)}`, [
      { name: 'Production G0/G1', headers: ['Variété','Code','G0 (kg)','G1 (kg)','Total (kg)','Nb lots'], rows: prodRows },
      { name: 'Chaîne aval', headers: ['Variété','Code variété','Espèce','Génération','Nom complet','Organisation','Localisation','Qté (kg)','Qté (t)','Statut'], rows: chainRows },
    ])
  }

  /* ══════════════════════════════════════════════════════════════════════
     RENDU
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="var(--green-700)" />
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            Pilotage semencier — Production &amp; Chaîne aval
          </span>
          {specUp && (
            <span style={{ marginLeft: 4, background: '#0369a120', color: '#0369a1',
              borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
              {specUp}
            </span>
          )}
        </div>
        <button className="btn btn-ghost" style={{ gap: 5, fontSize: 12 }}
          onClick={() => fetchData(true)} disabled={refreshing} title="Actualiser">
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {/* ── Pipeline KPI G0 → G1 → G3 → Commandes ── */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex' }}>
          {([
            { label: 'G0 en stock',       value: fmtT(kpiG0Kg),        color: GEN_COLOR.G0, sub: 'Noyau génétique' },
            { label: 'G1 disponible',     value: fmtT(kpiG1Kg),        color: GEN_COLOR.G1, sub: 'Pré-base' },
            { label: 'G3 demandés',       value: fmtT(kpiG3Kg),        color: GEN_COLOR.G3, sub: 'vers Multiplicateurs' },
            { label: 'R2 demandés',       value: fmtT(kpiR2Kg),        color: GEN_COLOR.R2, sub: 'vers Quotataires' },
          ] as const).map((step, i, arr) => (
            <div key={step.label} style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--surface)', minWidth: 0 }}>
              <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
                {loading ? (
                  <div className="skeleton" style={{ height: 40, borderRadius: 6 }} />
                ) : (
                  <>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {step.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: step.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                      {step.value}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>{step.sub}</div>
                  </>
                )}
              </div>
              {i < arr.length - 1 && (
                <ChevronRight size={14} style={{ color: 'var(--border)', flexShrink: 0, marginRight: -1 }} />
              )}
            </div>
          ))}
        </div>
        {/* Badges certification G1 */}
        {!loading && (certifEnAttente > 0 || certifRejete > 0) && (
          <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)',
            display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Certification G1 :</span>
            {certifEnAttente > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
                background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                {certifEnAttente} en attente
              </span>
            )}
            {certifRejete > 0 && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                {certifRejete} rejeté{certifRejete > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Graphe Production G0 → G1 par variété ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><BarChart2 size={15} /></span>
            Production G0 → G1 par variété
            {specUp && (
              <span style={{ marginLeft: 6, background: '#0369a120', color: '#0369a1',
                borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                {specUp}
              </span>
            )}
          </span>
          {!loading && prodByVariete.length > 0 && (
            <span className="badge badge-blue" style={{ fontSize: 11 }}>
              {prodByVariete.length} variété{prodByVariete.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="card-body" style={{ padding: '12px 16px 16px' }}>
          {loading ? (
            <div className="skeleton" style={{ height: 160, borderRadius: 6 }} />
          ) : (
            <ProdBarChart data={prodByVariete} />
          )}
        </div>
      </div>

      {/* ── Alerte verrouillage automatique BROUILLON ── */}
      {!loading && brouillonNearLock.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title" style={{ color: '#b45309' }}>
              <span className="card-title-icon" style={{ background: '#fffbeb' }}>
                <Clock size={15} color="#b45309" />
              </span>
              Verrouillage automatique imminent
            </span>
            <span style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
              {brouillonNearLock.length} lot{brouillonNearLock.length > 1 ? 's' : ''} concerné{brouillonNearLock.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ padding: '4px 0 8px' }}>
            <div style={{ padding: '0 20px 8px', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Ces lots sont en BROUILLON depuis ≥ 23 jours et seront verrouillés automatiquement à 30 jours d'inactivité.
            </div>
            {brouillonNearLock.map((l: any, i: number) => (
              <div key={l.id ?? i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
                borderTop: '1px solid var(--border)',
                background: l.daysLeft <= 2 ? '#fef2f2' : '#fffbeb',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)',
                  minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {l.codeLot ?? `LOT-${l.id}`}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.nomVariete ?? l.codeVariete ?? '—'}
                  {l.generation?.codeGeneration ? ` · ${l.generation.codeGeneration}` : ''}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: l.daysLeft <= 2 ? '#fecaca' : '#fde68a',
                  color: l.daysLeft <= 2 ? '#dc2626' : '#92400e',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {l.daysLeft === 0 ? 'Verrouillage aujourd\'hui' : `J−${l.daysLeft}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alertes G0 : stock critique / faible / ancienneté ── */}
      {!loading && alerts.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ color: alerts.some(a => a.isCritique) ? 'var(--red-600)' : 'var(--gold-dark)' }}>
              <span className="card-title-icon"
                style={{ background: alerts.some(a => a.isCritique) ? '#fef2f2' : 'var(--gold-light)' }}>
                <AlertTriangle size={15}
                  color={alerts.some(a => a.isCritique) ? 'var(--red-600)' : 'var(--gold-dark)'} />
              </span>
              Alertes noyau génétique G0
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              Cliquez sur une ligne pour voir les détails
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {alerts.map((a, i) => {
              const bgColor = a.isCritique ? '#fef2f2' : a.isFaible ? '#fffbeb' : '#eff6ff'
              const dotColor = a.isCritique ? '#dc2626' : a.isFaible ? '#d97706' : '#1d4ed8'
              const textColor = a.isCritique ? '#dc2626' : a.isFaible ? '#d97706' : '#1d4ed8'
              const borderCol = a.isCritique ? '#fecaca' : a.isFaible ? '#fde68a' : '#bfdbfe'
              const label = a.isCritique ? 'CRITIQUE' : a.isFaible ? 'FAIBLE' : 'ANCIEN'
              return (
                <button
                  key={i}
                  onClick={() => setAlertDetail(a)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 16px', width: '100%', textAlign: 'left',
                    borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none',
                    background: bgColor, border: 'none', cursor: 'pointer',
                    transition: 'filter 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.97)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0,
                      animation: 'pulse-dot 1.8s ease-in-out infinite',
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.nomVariete}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                        {a.codeVariete} · G0
                        {a.isAncien && (
                          <span style={{ marginLeft: 6 }}>
                            <Clock size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                            {a.ageMaxAns.toFixed(1)} an{a.ageMaxAns >= 2 ? 's' : ''}
                          </span>
                        )}
                        {a.hasG1Demand && (
                          <span style={{ marginLeft: 6, color: GEN_COLOR.G1, fontWeight: 600 }}>· G1 demandé</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: bgColor, color: textColor, border: `1px solid ${borderCol}`,
                    }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: textColor, minWidth: 60, textAlign: 'right',
                    }}>
                      {a.totalG0Kg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Section unifiée : Demandes + Chaîne aval ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="card-title">
              <span className="card-title-icon"><TrendingUp size={15} /></span>
              Demandes sur vos variétés
              {specUp && (
                <span style={{ marginLeft: 6, background: '#0369a120', color: '#0369a1',
                  borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                  {specUp}
                </span>
              )}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              {!loading && (
                <button
                  onClick={handleExport}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600,
                    padding: '4px 10px', borderRadius: 7, background: 'var(--surface-2)',
                    border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <Download size={11} /> Export .xls
                </button>
              )}
            </div>
          </div>

          {/* Filtres période / génération */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
              {(['1m','3m','6m','1a'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: period === p ? 700 : 400,
                  background: period === p ? 'var(--surface)' : 'transparent',
                  color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: period === p ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s',
                }}>
                  {p === '1m' ? '1 mois' : p === '3m' ? '3 mois' : p === '6m' ? '6 mois' : '1 an'}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
            {([
              { key: 'g1' as GenKey, label: 'G1 → UPSemCL', color: STACK_COLORS.g1 },
              { key: 'g3' as GenKey, label: 'G3 → Mult.',   color: STACK_COLORS.g3 },
              { key: 'r2' as GenKey, label: 'R2 → Quot.',   color: STACK_COLORS.r2 },
            ]).map(({ key, label, color }) => {
              const active   = genFilter.size === 0 || genFilter.has(key)
              const selected = genFilter.has(key)
              return (
                <button key={key} onClick={() => toggleGen(key)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.12s',
                  background: selected ? `${color}18` : 'var(--surface-2)',
                  color: active ? color : 'var(--text-muted)',
                  border: `1.5px solid ${selected ? color + '55' : 'var(--border)'}`,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2,
                    background: active ? color : 'var(--border)', display: 'inline-block' }} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 280 }}>
          {/* Graphe mensuel */}
          <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
            {loading ? (
              <div className="skeleton" style={{ height: 220, borderRadius: 6 }} />
            ) : filteredMonthly.every(m => m.g1Kg === 0 && m.g3Kg === 0 && m.r2Kg === 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 8 }}>
                <TrendingUp size={32} style={{ opacity: 0.2 }} />
                <span style={{ fontSize: 13 }}>Aucune commande sur la période</span>
              </div>
            ) : (
              <StackedMonthChart data={filteredMonthly} periodLabel={PERIOD_LABELS[period]} />
            )}
          </div>

          {/* Chaîne aval */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <GitBranch size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Chaîne aval — qui commande mes variétés
              </span>
              {!loading && (() => {
                const g3t = fullChain.reduce((s, v) => s + v.demandesG3.reduce((ss, d) => ss + d.qtyKg, 0), 0)
                const r2t = fullChain.reduce((s, v) => s + v.demandesR2.reduce((ss, d) => ss + d.qtyKg, 0), 0)
                return (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {(genFilter.size === 0 || genFilter.has('g3')) && g3t > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: STACK_COLORS.g3, fontVariantNumeric: 'tabular-nums' }}>
                        G3 {fmtT(g3t)}
                      </span>
                    )}
                    {(genFilter.size === 0 || genFilter.has('r2')) && r2t > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: STACK_COLORS.r2, fontVariantNumeric: 'tabular-nums' }}>
                        R2 {fmtT(r2t)}
                      </span>
                    )}
                    <span className="badge badge-blue" style={{ fontSize: 10 }}>
                      {fullChain.length} variété{fullChain.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )
              })()}
            </div>

            <div style={{ overflowY: 'auto', maxHeight: 320, flex: 1 }}>
              {loading ? (
                <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 160, borderRadius: 6 }} /></div>
              ) : fullChain.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '40px 24px', color: 'var(--text-muted)', gap: 8 }}>
                  <GitBranch size={28} style={{ opacity: 0.2 }} />
                  <span style={{ fontSize: 12 }}>Aucune variété en production</span>
                </div>
              ) : (
                fullChain.map((v, vi) => {
                  const showG1 = genFilter.size === 0 || genFilter.has('g1')
                  const showG3 = genFilter.size === 0 || genFilter.has('g3')
                  const showR2 = genFilter.size === 0 || genFilter.has('r2')
                  const C: Record<string, string> = { G1:'#0ea5e9', G3:'#f59e0b', R2:'#14b8a6' }
                  const sC: Record<string, string> = {
                    SOUMISE:'#6b7280', EN_NEGOCIATION:'#d97706', ACCORDEE:'#2563eb',
                    EN_LIVRAISON:'#7c3aed', LIVREE:'#15803d',
                  }
                  const r2Total = v.demandesR2.reduce((s, d) => s + d.qtyKg, 0)
                  const g3Total = v.demandesG3.reduce((s, d) => s + d.qtyKg, 0)
                  const g1HasNext = showG1 && (showG3 || showR2)
                  const g3HasNext = showG3 && showR2
                  return (
                    <div key={v.codeVariete} style={{
                      borderBottom: vi < fullChain.length - 1 ? '1px solid var(--border)' : 'none',
                      padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{v.nomVariete}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          background: 'var(--surface-2)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {v.codeEspece}
                        </span>
                        {(r2Total + g3Total) > 0 && (
                          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800,
                            color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtT(r2Total + g3Total)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 2 }}>
                        {showG1 && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                                background: v.lotCount > 0 ? C.G1 : 'var(--border)', border: '2px solid var(--surface)',
                                boxShadow: v.lotCount > 0 ? `0 0 0 2px ${C.G1}30` : 'none' }} />
                              {g1HasNext && <div style={{ width: 2, flex: 1, minHeight: 14, background: 'var(--border)', marginTop: 2 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: g1HasNext ? 6 : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: v.lotCount > 0 ? C.G1 : 'var(--text-muted)' }}>G0/G1</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Production souche</span>
                                {(v.g0kg + v.g1kg) > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: C.G1, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtT(v.g0kg + v.g1kg)}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                {v.lotCount > 0 ? `${v.lotCount} lot${v.lotCount > 1 ? 's' : ''} · transfert vers UPSemCL` : 'Aucun lot actif'}
                              </div>
                            </div>
                          </div>
                        )}
                        {showG3 && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                                background: v.demandesG3.length > 0 ? C.G3 : 'var(--border)', border: '2px solid var(--surface)',
                                boxShadow: v.demandesG3.length > 0 ? `0 0 0 2px ${C.G3}30` : 'none' }} />
                              {g3HasNext && <div style={{ width: 2, flex: 1, minHeight: 14, background: 'var(--border)', marginTop: 2 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: g3HasNext ? 6 : 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: v.demandesG3.length > 0 ? C.G3 : 'var(--text-muted)' }}>G3</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→ Multiplicateurs</span>
                                {g3Total > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: C.G3, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtT(g3Total)}
                                  </span>
                                )}
                              </div>
                              {v.demandesG3.length > 0 ? v.demandesG3.map((d, i) => {
                                const sc = sC[d.statut] ?? '#6b7280'
                                const label = d.nomComplet ?? d.nomOrganisation ?? d.username
                                return (
                                  <div key={i} style={{ marginTop: 2, padding: '4px 6px', borderRadius: 6,
                                    background: i % 2 === 0 ? 'var(--surface-2)' : 'transparent' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)',
                                        flex: 1, minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {label}
                                      </span>
                                      <span style={{ fontSize: 10.5, fontWeight: 700, color: C.G3, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtT(d.qtyKg)}</span>
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
                                        background: `${sc}14`, color: sc, border: `1px solid ${sc}30`, flexShrink: 0 }}>
                                        {d.statut.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                    {(d.nomOrganisation || d.localisation) && (
                                      <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                                        {d.nomOrganisation && d.nomComplet && (
                                          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {d.nomOrganisation}
                                          </span>
                                        )}
                                        {d.localisation && (
                                          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', flexShrink: 0 }}>· {d.localisation}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              }) : (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                  Distribution via UPSemCL — non suivi directement
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {showR2 && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                                background: v.demandesR2.length > 0 ? C.R2 : 'var(--border)', border: '2px solid var(--surface)',
                                boxShadow: v.demandesR2.length > 0 ? `0 0 0 2px ${C.R2}30` : 'none' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: v.demandesR2.length > 0 ? C.R2 : 'var(--text-muted)' }}>R2</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→ Quotataires</span>
                                {r2Total > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: C.R2, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmtT(r2Total)}
                                  </span>
                                )}
                              </div>
                              {v.demandesR2.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                                  {v.demandesR2.map((d, i) => {
                                    const sc = sC[d.statut] ?? '#6b7280'
                                    const label = d.nomComplet ?? d.nomOrganisation ?? d.username
                                    return (
                                      <div key={i} style={{ marginTop: 2, padding: '4px 6px', borderRadius: 6,
                                        background: i % 2 === 0 ? 'var(--surface-2)' : 'transparent' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-primary)',
                                            flex: 1, minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {label}
                                          </span>
                                          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.R2, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtT(d.qtyKg)}</span>
                                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
                                            background: `${sc}14`, color: sc, border: `1px solid ${sc}30`, flexShrink: 0 }}>
                                            {d.statut.replace(/_/g, ' ')}
                                          </span>
                                        </div>
                                        {(d.nomOrganisation || d.localisation) && (
                                          <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                                            {d.nomOrganisation && d.nomComplet && (
                                              <span style={{ fontSize: 9.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {d.nomOrganisation}
                                              </span>
                                            )}
                                            {d.localisation && (
                                              <span style={{ fontSize: 9.5, color: 'var(--text-muted)', flexShrink: 0 }}>· {d.localisation}</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                  Aucune commande R2 en cours
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay détail alerte */}
      {alertDetail && (
        <AlertDetailPanel alert={alertDetail} onClose={() => setAlertDetail(null)} />
      )}

      <style>{`
        @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.5); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
