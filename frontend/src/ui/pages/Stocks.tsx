import { useEffect, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import {
  Database, RefreshCw, Plus, MapPin, Package, TrendingUp,
  X, Edit2, Trash2, Archive, Search, ChevronDown,
  ArrowRightLeft, FileText, Download, CheckCircle2,
} from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { Modal, Field, FormInput, FormSelect, FormRow, FormActions, Toast } from '../components/Modal'
import { keycloak } from '../../lib/keycloak'
import {
  generateTransferDoc, generateNumero,
  TransferDocData, LotPdfData, PartiePdf,
} from '../../lib/pdf/generateTransferDoc'

interface Props { roleKey: string }

const GEN_COLOR: Record<string, string> = {
  G0: '#6366f1', G1: '#0ea5e9', G2: '#22c55e', G3: '#f59e0b',
  G4: '#f97316', R1: '#ec4899', R2: '#14b8a6'
}
const GEN_BADGE: Record<string, string> = {
  G0: 'badge-blue', G1: 'badge-green', G2: 'badge-gold', G3: 'badge-gray',
  G4: 'badge-gray', R1: 'badge-blue', R2: 'badge-green'
}
const UPSEMCL_GENS   = ['G1', 'G2', 'G3']
const SELECTOR_GENS  = ['G0', 'G1']

/* ── Règles de transfert inter-organisations par rôle ── */
const TRANSFER_RULES_STOCK: Record<string, { allowedGens: string[]; source: string; destination: string; destRoleKey: string }> = {
  'seed-selector': { allowedGens: ['G1'], source: 'ISRA/CNRA',  destination: 'UPSemCL',       destRoleKey: 'seed-upsemcl'       },
  'seed-upsemcl':  { allowedGens: ['G3'], source: 'UPSemCL',    destination: 'Multiplicateur', destRoleKey: 'seed-multiplicator' },
}

const ROLE_LABELS_PDF: Record<string, string> = {
  'seed-selector':      'Sélectionneur ISRA/CNRA',
  'seed-upsemcl':       'Unité de Production UPSemCL',
  'seed-multiplicator': 'Multiplicateur Agréé',
  'seed-quotataire':    'Distributeur / Quotataire',
  'seed-admin':         'Administrateur',
}

const STATUT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  DISPONIBLE:    { label: 'Disponible',    color: '#15803d', bg: '#f0fdf4' },
  CERTIFIE:      { label: 'Certifiée',     color: '#15803d', bg: '#dcfce7' },
  EN_COURS_CERT: { label: 'En certif.',    color: '#1d4ed8', bg: '#eff6ff' },
  DECLASS:       { label: 'Déclassée',     color: '#92660a', bg: '#fef9ed' },
  TRANSFERE:     { label: 'Transféré',     color: '#7e22ce', bg: '#fdf4ff' },
  EN_PRODUCTION: { label: 'En production', color: '#92660a', bg: '#fef9ed' },
  EPUISE:        { label: 'Épuisé',        color: '#6b7280', bg: '#f9fafb' },
  RETIRE:        { label: 'Retiré',        color: '#dc2626', bg: '#fef2f2' },
  SOUCHE:        { label: 'Souche',        color: '#0f766e', bg: '#f0fdfa' },
  PERDU:         { label: 'Perdu',         color: '#dc2626', bg: '#fef2f2' },
}

const MVT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  IN:       { label: '↓ Entrée',    color: '#15803d', bg: '#f0fdf4' },
  OUT:      { label: '↑ Sortie',    color: '#dc2626', bg: '#fef2f2' },
  TRANSFER: { label: '⇄ Transfert', color: '#7e22ce', bg: '#fdf4ff' },
}

function StatutBadge({ statut }: { statut?: string }) {
  if (!statut) return null
  const s = STATUT_STYLE[statut]
  if (!s) return <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{statut}</span>
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

interface BarDatum { label: string; value: number; color: string }

function StockBarChart({ data }: { data: BarDatum[] }) {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 40 }}>
        Aucune donnée à visualiser
      </div>
    )
  }
  const W = 620, H = 220, PL = 64, PR = 16, PT = 14, PB = 52
  const maxV = Math.max(...data.map(d => d.value), 1)
  const chartW = W - PL - PR
  const chartH = H - PT - PB
  const n = data.length
  const barW = Math.max(6, Math.floor(chartW / n) - 6)
  const fmt = (v: number) =>
    v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M'
    : v >= 1_000   ? (v / 1_000).toFixed(0) + 'k'
    : String(v)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {[0, 0.25, 0.5, 0.75, 1.0].map((t, i) => {
        const val = Math.round(t * maxV)
        const y   = PT + chartH - t * chartH
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth={0.8} strokeDasharray="4 3" />
            <text x={PL - 6} y={y + 4} fontSize={9} fill="var(--text-muted)" textAnchor="end">{fmt(val)}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const step = chartW / n
        const x    = PL + i * step + (step - barW) / 2
        const bh   = Math.max(2, (d.value / maxV) * chartH)
        const y    = PT + chartH - bh
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={3} fill={d.color} opacity={0.85} />
            {bh > 22 && (
              <text x={x + barW / 2} y={y + 13} fontSize={8} fill="white" textAnchor="middle" fontWeight={700}>
                {fmt(d.value)}
              </text>
            )}
            <text x={x + barW / 2} y={H - PB + 15} fontSize={9} fill="var(--text-muted)" textAnchor="middle">
              {d.label.length > 9 ? d.label.slice(0, 8) + '…' : d.label}
            </text>
          </g>
        )
      })}
      <text x={10} y={H / 2} fontSize={9} fill="var(--text-muted)" textAnchor="middle"
        transform={`rotate(-90,10,${H / 2})`}>Stock (kg)
      </text>
    </svg>
  )
}

function LotDropdown({ lots, value, onChange, placeholder = 'Sélectionner un lot…', varMap }: {
  lots: any[]; value: string; onChange: (v: string) => void
  placeholder?: string; varMap: Record<number, any>
}) {
  const [q,    setQ]    = useState('')
  const [open, setOpen] = useState(false)

  const filtered = lots.filter(l => {
    if (!q) return true
    const term = q.toLowerCase()
    const vnom = varMap[l.idVariete]?.nomVariete ?? varMap[l.idVariete]?.codeVariete ?? ''
    return l.codeLot?.toLowerCase().includes(term) || vnom.toLowerCase().includes(term)
  }).slice(0, 25)

  const selected = lots.find(l => String(l.id) === value)
  const selVnom  = selected ? (varMap[selected.idVariete]?.nomVariete ?? '') : ''
  const selGen   = selected?.generation?.codeGeneration ?? ''

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', background: 'var(--surface)', fontSize: 13, minHeight: 38 }}
        onClick={() => setOpen(o => !o)}
      >
        {selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: (GEN_COLOR[selGen] ?? '#6b7280') + '22', color: GEN_COLOR[selGen] ?? '#6b7280', flexShrink: 0 }}>{selGen}</span>
            <span style={{ fontWeight: 600, fontSize: 12 }}>{selected.codeLot}</span>
            {selVnom && <span style={{ color: 'var(--text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {selVnom}</span>}
          </div>
        ) : (
          <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: 12 }}>{placeholder}</span>
        )}
        <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', zIndex: 100, top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', maxHeight: 260, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', borderRadius: 5, padding: '5px 8px' }}>
              <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                autoFocus
                value={q}
                onChange={(e: { target: { value: string } }) => setQ(e.target.value)}
                placeholder="Code lot ou variété…"
                style={{ border: 'none', outline: 'none', fontSize: 12, flex: 1, background: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Aucun lot trouvé</div>
              : filtered.map(l => {
                  const gen     = l.generation?.codeGeneration ?? '?'
                  const vnom    = varMap[l.idVariete]?.nomVariete ?? varMap[l.idVariete]?.codeVariete ?? ''
                  const isSel   = String(l.id) === value
                  return (
                    <div
                      key={l.id}
                      style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: isSel ? 'var(--surface-2)' : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={(e: MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e: MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = isSel ? 'var(--surface-2)' : 'transparent')}
                      onClick={() => { onChange(String(l.id)); setOpen(false); setQ('') }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: (GEN_COLOR[gen] ?? '#6b7280') + '22', color: GEN_COLOR[gen] ?? '#6b7280', flexShrink: 0 }}>{gen}</span>
                      <span style={{ fontWeight: 600 }}>{l.codeLot}</span>
                      {vnom && <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {vnom}</span>}
                    </div>
                  )
                })
            }
          </div>
        </div>
      )}
    </div>
  )
}

export function Stocks({ roleKey }: Props) {
  const [allStocks,  setAllStocks]  = useState<any[]>([])
  const [lots,       setLots]       = useState<any[]>([])
  const [varieties,  setVarieties]  = useState<any[]>([])
  const [sitesList,  setSitesList]  = useState<any[]>([])
  const [movements,  setMovements]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [saving,     setSaving]     = useState(false)

  const [site,         setSite]         = useState('')
  const [filterGen,    setFilterGen]    = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [showChart,    setShowChart]    = useState(true)
  const [showHistory,  setShowHistory]  = useState(false)
  const [historyLotId, setHistoryLotId] = useState<number | null>(null)

  const [showStockForm, setShowStockForm] = useState(false)
  const [showMvtForm,   setShowMvtForm]   = useState(false)
  const [editStock,     setEditStock]     = useState<any | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<any | null>(null)

  const isUPSemCL  = roleKey === 'seed-upsemcl'
  const isSelector = roleKey === 'seed-selector'
  const isMulti    = roleKey === 'seed-multiplicator'
  const isAdmin    = roleKey === 'seed-admin'
  const canManage  = ['seed-admin', 'seed-upsemcl', 'seed-multiplicator', 'seed-selector'].includes(roleKey)

  const [stockForm, setStockForm] = useState({ idLot: '', siteCode: '', quantite: '', unite: 'kg' })
  const [mvtForm,   setMvtForm]   = useState({ idLot: '', type: 'IN', siteSourceCode: '', siteDestinationCode: '', quantite: '', unite: 'kg', reference: '' })
  const [editForm,  setEditForm]  = useState({ quantite: '', unite: 'kg' })

  /* ── Transfert inter-organisations depuis le stock ── */
  const transferRule = TRANSFER_RULES_STOCK[roleKey] as typeof TRANSFER_RULES_STOCK[string] | undefined
  const [showTransferForm,  setShowTransferForm]  = useState(false)
  const [transferSource,    setTransferSource]    = useState<{ stock: any; lot: any } | null>(null)
  const [transferForm,      setTransferForm]      = useState({
    usernameDestinataire: '', quantite: '', observations: '',
  })
  const [transferSaving, setTransferSaving] = useState(false)
  const [lastTransfer,   setLastTransfer]   = useState<any>(null)
  const [membres,        setMembres]        = useState<any[]>([])

  const varMap: Record<number, any> = Object.fromEntries(varieties.map(v => [v.id, v]))
  const lotMap: Record<number, any> = Object.fromEntries(lots.map(l => [l.id, l]))

  const availableLots = isUPSemCL
    ? lots.filter(l => UPSEMCL_GENS.includes(l.generation?.codeGeneration))
    : isSelector
    ? lots.filter(l => SELECTOR_GENS.includes(l.generation?.codeGeneration))
    : lots

  async function fetchAll(isRefresh = false) {
    isRefresh ? setRefreshing(true) : setLoading(true)
    const stockUrl = isMulti ? endpoints.stockMonStock : endpoints.stocks
    const lotsUrl  = isMulti ? endpoints.lotsMesLots   : endpoints.lots
    await Promise.all([
      api.get(stockUrl).then(r          => setAllStocks(r.data)).catch(() => setAllStocks([])),
      api.get(lotsUrl).then(r           => setLots(r.data)).catch(() => {}),
      api.get(endpoints.varieties).then(r => setVarieties(r.data)).catch(() => {}),
      api.get(endpoints.sites).then(r     => setSitesList(r.data)).catch(() => {}),
      api.get(endpoints.movements).then(r => setMovements(r.data)).catch(() => {}),
      transferRule ? api.get(endpoints.membres).then(r => setMembres(r.data)).catch(() => {}) : Promise.resolve(),
    ])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchAll() }, [])

  const stocks = (() => {
    let s = allStocks
    if (isUPSemCL)  s = s.filter(st => UPSEMCL_GENS.includes(lotMap[st.idLot]?.generation?.codeGeneration))
    if (isSelector) s = s.filter(st => SELECTOR_GENS.includes(lotMap[st.idLot]?.generation?.codeGeneration))
    if (site)        s = s.filter(st => st.site?.codeSite === site)
    if (filterGen)   s = s.filter(st => lotMap[st.idLot]?.generation?.codeGeneration === filterGen)
    if (filterSearch) {
      const term = filterSearch.toLowerCase()
      s = s.filter(st => {
        const lot     = lotMap[st.idLot]
        const variete = lot ? varMap[lot.idVariete] : null
        return lot?.codeLot?.toLowerCase().includes(term)
          || variete?.nomVariete?.toLowerCase().includes(term)
          || variete?.espece?.nomCommun?.toLowerCase().includes(term)
          || variete?.espece?.nomEspece?.toLowerCase().includes(term)
          || st.site?.codeSite?.toLowerCase().includes(term)
      })
    }
    return s
  })()

  const totalQty = stocks.reduce((s, st) => s + (parseFloat(st.quantiteDisponible) || 0), 0)
  const siteList = [...new Set(allStocks.map((s: any) => s.site?.codeSite).filter(Boolean))]
  const maxQty   = Math.max(...stocks.map((s: any) => parseFloat(s.quantiteDisponible) || 0), 1)

  const barData: BarDatum[] = (() => {
    const agg: Record<string, { qty: number; gen: string }> = {}
    stocks.forEach(st => {
      const lot  = lotMap[st.idLot]
      if (!lot) return
      const key  = varMap[lot.idVariete]?.nomVariete ?? varMap[lot.idVariete]?.codeVariete ?? `Lot#${lot.id}`
      const gen  = lot.generation?.codeGeneration ?? '?'
      if (!agg[key]) agg[key] = { qty: 0, gen }
      agg[key].qty += parseFloat(st.quantiteDisponible) || 0
    })
    return Object.entries(agg)
      .map(([label, { qty, gen }]) => ({ label, value: Math.round(qty), color: GEN_COLOR[gen] ?? '#6b7280' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  })()

  const filteredMvts = historyLotId
    ? movements.filter((m: any) => m.idLot === historyLotId)
    : movements

  function toastErr(err: any, fallback: string) {
    const st  = err?.response?.status
    const msg = err?.response?.data?.message || err?.response?.data?.error || fallback
    if (st === 409) return setToast({ msg: `Stock insuffisant — ${msg}`, type: 'error' })
    if (st === 400) return setToast({ msg: `Données invalides — ${msg}`, type: 'error' })
    if (st === 404) return setToast({ msg: `Introuvable — ${msg}`, type: 'error' })
    if (st === 500) return setToast({ msg: `Erreur serveur — veuillez réessayer`, type: 'error' })
    setToast({ msg, type: 'error' })
  }

  async function submitStock(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.stocks, {
        idLot: Number(stockForm.idLot), siteCode: stockForm.siteCode,
        quantite: Number(stockForm.quantite), unite: stockForm.unite
      })
      setToast({ msg: `Stock enregistré sur ${stockForm.siteCode}`, type: 'success' })
      setShowStockForm(false)
      setStockForm({ idLot: '', siteCode: '', quantite: '', unite: 'kg' })
      fetchAll(true)
    } catch (err: any) { toastErr(err, 'Erreur enregistrement stock')
    } finally { setSaving(false) }
  }

  async function submitMvt(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await api.post(endpoints.movements, {
        idLot: Number(mvtForm.idLot), type: mvtForm.type,
        siteSourceCode:      mvtForm.siteSourceCode      || undefined,
        siteDestinationCode: mvtForm.siteDestinationCode || undefined,
        quantite: Number(mvtForm.quantite), unite: mvtForm.unite,
        reference: mvtForm.reference || undefined
      })
      const labels: Record<string, string> = { IN: 'Entrée', OUT: 'Sortie', TRANSFER: 'Transfert' }
      setToast({ msg: `${labels[mvtForm.type] || mvtForm.type} de ${mvtForm.quantite} ${mvtForm.unite} enregistré`, type: 'success' })
      setShowMvtForm(false)
      setMvtForm({ idLot: '', type: 'IN', siteSourceCode: '', siteDestinationCode: '', quantite: '', unite: 'kg', reference: '' })
      fetchAll(true)
    } catch (err: any) { toastErr(err, 'Erreur mouvement')
    } finally { setSaving(false) }
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault(); setSaving(true)
    if (!editStock) return
    try {
      await api.put(endpoints.stockById(editStock.id), {
        idLot: editStock.idLot, siteCode: editStock.site?.codeSite,
        quantite: Number(editForm.quantite), unite: editForm.unite
      })
      setToast({ msg: `Stock mis à jour`, type: 'success' })
      setEditStock(null)
      fetchAll(true)
    } catch (err: any) { toastErr(err, 'Erreur mise à jour')
    } finally { setSaving(false) }
  }

  async function doDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await api.delete(endpoints.stockById(deleteTarget.id))
      setToast({ msg: `Entrée de stock supprimée`, type: 'success' })
      setDeleteTarget(null)
      fetchAll(true)
    } catch (err: any) { toastErr(err, 'Erreur suppression')
    } finally { setSaving(false) }
  }

  const genOptions = isUPSemCL ? UPSEMCL_GENS : isSelector ? SELECTOR_GENS : ['G0', 'G1', 'G2', 'G3', 'G4', 'R1', 'R2']

  /* ── Transfert inter-orgs depuis le stock ── */
  function openTransferFromStock(stock: any, lot: any) {
    setTransferSource({ stock, lot })
    setTransferForm({
      usernameDestinataire: '',
      quantite:             String(Math.floor(parseFloat(stock.quantiteDisponible) || 0)),
      observations:         '',
    })
    setLastTransfer(null)
    setShowTransferForm(true)
  }

  async function submitTransferFromStock(e: FormEvent) {
    e.preventDefault()
    if (!transferSource || !transferRule) return
    if (!transferForm.usernameDestinataire) {
      toastErr(null, 'Veuillez sélectionner un destinataire')
      return
    }
    setTransferSaving(true)
    try {
      /* Le backend génère codeTransfert, usernameEmetteur et roleEmetteur depuis le JWT.
         Seul le lot-service crée le TransfertLot ET déclenche Kafka → débit stock. */
      const resp = await api.post(endpoints.lotTransfer(transferSource.lot.id), {
        usernameDestinataire: transferForm.usernameDestinataire,
        quantite:             Number(transferForm.quantite),
        observations:         transferForm.observations || undefined,
      })
      setLastTransfer({ ...resp.data, _lot: transferSource.lot })
      setShowTransferForm(false)
      setTransferSource(null)
      setToast({ msg: `Transfert ${resp.data.codeTransfert} initié → ${transferForm.usernameDestinataire}`, type: 'success' })
      fetchAll(true)
    } catch (err: any) {
      toastErr(err, 'Erreur lors du transfert')
    } finally { setTransferSaving(false) }
  }

  function downloadTransferDoc(t: any, docType: 'BORDEREAU' | 'ACCUSE_RECEPTION') {
    const lot     = t._lot ?? lotMap[t.idLot]
    const variete = varMap[lot?.idVariete]
    const gen     = lot?.generation?.codeGeneration || ''
    const jwt     = keycloak.tokenParsed as Record<string, unknown>
    const me      = (jwt?.preferred_username as string) || ''

    const lotData: LotPdfData = {
      codeLot:         lot?.codeLot || `LOT-${t.idLot}`,
      nomVariete:      variete?.nomVariete || 'N/D',
      nomEspece:       variete?.espece?.nomCommun || variete?.espece?.nomEspece || 'Semence',
      generationCode:  gen || '—',
      quantiteNette:   Number(t.quantite ?? lot?.quantiteNette ?? 0),
      unite:           lot?.unite || 'kg',
      tauxGermination: lot?.tauxGermination,
      puretePhysique:  lot?.puretePhysique,
      statutLot:       lot?.statutLot || 'TRANSFERE',
      dateProduction:  lot?.dateProduction,
      campagne:        lot?.campagne,
      lotParentCode:   lot?.lotParent?.codeLot,
    }
    const expediteur: PartiePdf = {
      username: t.usernameEmetteur || me,
      nom:      t.usernameEmetteur || me,
      roleKey,
      roleLabel: ROLE_LABELS_PDF[roleKey] || roleKey,
    }
    const destinataire: PartiePdf = {
      username:  t.usernameDestinataire || transferRule?.destination || '—',
      nom:       t.usernameDestinataire || transferRule?.destination || '—',
      roleKey:   transferRule?.destRoleKey || 'seed-upsemcl',
      roleLabel: ROLE_LABELS_PDF[transferRule?.destRoleKey || 'seed-upsemcl'],
    }
    const docData: TransferDocData = {
      type:               docType,
      codeTransfert:      t.codeTransfert,
      numero:             generateNumero(t.id),
      lot:                lotData,
      expediteur,
      destinataire,
      quantiteTransferee: Number(t.quantite ?? 0),
      dateDemande:        t.dateDemande || new Date().toISOString().split('T')[0],
      observations:       t.observations,
      dateAcceptation:    docType === 'ACCUSE_RECEPTION' ? (t.dateAcceptation || new Date().toISOString().split('T')[0]) : undefined,
      nomReceptionnaire:  docType === 'ACCUSE_RECEPTION' ? me : undefined,
      quantiteRecue:      docType === 'ACCUSE_RECEPTION' ? Number(t.quantite ?? 0) : undefined,
    }
    generateTransferDoc(docData)
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {lastTransfer && (
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#f3e8ff,#ede9fe)', border: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', gap: 14 }}>
          <CheckCircle2 size={20} style={{ color: '#7e22ce', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#581c87' }}>
              Transfert <span style={{ fontFamily: 'monospace' }}>{lastTransfer.codeTransfert}</span> créé avec succès
            </div>
            <div style={{ fontSize: 12, color: '#7e22ce', marginTop: 2 }}>
              {lastTransfer.quantite} {lastTransfer._lot?.unite || 'kg'} → {lastTransfer.usernameDestinataire || transferRule?.destination}
              {lastTransfer.statut && (
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: '#7e22ce22', color: '#7e22ce' }}>
                  {lastTransfer.statut}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 10px', gap: 5 }}
              onClick={() => downloadTransferDoc(lastTransfer, 'BORDEREAU')}
            >
              <FileText size={12} /> Bordereau PDF
            </button>
            {lastTransfer.statut === 'ACCEPTE' && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '5px 10px', gap: 5 }}
                onClick={() => downloadTransferDoc(lastTransfer, 'ACCUSE_RECEPTION')}
              >
                <Download size={12} /> Accusé de réception
              </button>
            )}
          </div>
          <button
            className="btn btn-ghost btn-icon"
            style={{ padding: '4px 6px', flexShrink: 0 }}
            onClick={() => setLastTransfer(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isUPSemCL && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e922,#22c55e11)', border: '1px solid #0ea5e933', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0ea5e9', background: '#0ea5e915', borderRadius: 4, padding: '2px 8px' }}>UPSEMCL</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Réception G1 → multiplication G1→G3 → transfert G3 aux multiplicateurs</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#22c55e' }}>Périmètre : G1 · G2 · G3</span>
        </div>
      )}

      {isSelector && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#6366f122,#0369a111)', border: '1px solid #0369a133', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', background: '#0369a115', borderRadius: 4, padding: '2px 8px' }}>SÉLECTIONNEUR</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Conservation noyau génétique G0 · production pré-base G1 → transfert vers UPSemCL</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#6366f1' }}>Périmètre : G0 · G1</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Database size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : stocks.length}</div>
            <div className="stat-label">Entrées stock</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><MapPin size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : siteList.length}</div>
            <div className="stat-label">Sites de stockage</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon gold"><Package size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : totalQty.toLocaleString('fr-FR')}</div>
            <div className="stat-label">Quantité totale (kg)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon violet"><TrendingUp size={18} /></div>
          <div className="stat-body">
            <div className="stat-value">{loading ? '…' : stocks.length > 0 ? Math.round(totalQty / stocks.length).toLocaleString('fr-FR') : 0}</div>
            <div className="stat-label">Moyenne / entrée (kg)</div>
          </div>
        </div>
      </div>

      {/* Chart section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowChart(c => !c)}>
          <span className="card-title">
            <span className="card-title-icon"><TrendingUp size={15} /></span>
            Visualisation stock par variété
            {isUPSemCL   && <span style={{ marginLeft: 6, fontSize: 10, color: '#0ea5e9', background: '#0ea5e915', borderRadius: 3, padding: '1px 5px' }}>G1/G2/G3</span>}
            {isSelector  && <span style={{ marginLeft: 6, fontSize: 10, color: '#6366f1', background: '#6366f115', borderRadius: 3, padding: '1px 5px' }}>G0/G1</span>}
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>{showChart ? '▲' : '▼'}</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{barData.length} variété(s) · stock illimité</span>
        </div>
        {showChart && (
          <div style={{ padding: '12px 20px 16px' }}>
            <StockBarChart data={barData} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, justifyContent: 'center' }}>
              {Object.entries(GEN_COLOR).map(([gen, color]) => {
                if (!barData.some(d => d.color === color)) return null
                return (
                  <div key={gen} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                    {gen}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Inventory table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-icon"><Database size={15} /></span>
            Inventaire par site
            <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{stocks.length}</span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManage && (
              <button className="btn btn-secondary" onClick={() => setShowStockForm(true)}><Plus size={13} /> Enregistrer stock</button>
            )}
            {canManage && (
              <button className="btn btn-primary" onClick={() => setShowMvtForm(true)}><Plus size={13} /> Mouvement</button>
            )}
            <button
              className="btn btn-secondary"
              style={{ gap: 5, background: showHistory ? 'var(--surface-2)' : undefined }}
              onClick={() => { setShowHistory(h => !h); setHistoryLotId(null) }}
            >
              <Archive size={13} /> Historique
            </button>
            <button className="btn btn-secondary btn-icon" onClick={() => fetchAll(true)} disabled={refreshing}><RefreshCw size={13} /></button>
          </div>
        </div>

        {/* Site tabs */}
        {!loading && siteList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>Sites :</span>
            <button
              className={'gen-chain-btn ' + (!site ? 'active' : '')}
              style={{ background: !site ? 'var(--green-50)' : 'transparent', color: 'var(--green-700)' }}
              onClick={() => setSite('')}
            >Tous</button>
            {siteList.map((s: any) => (
              <button
                key={s}
                className={'gen-chain-btn ' + (site === s ? 'active' : '')}
                style={{ background: site === s ? 'var(--blue-50)' : 'transparent', color: 'var(--blue-700)' }}
                onClick={() => setSite(site === s ? '' : s)}
              >
                <MapPin size={10} />{s}
              </button>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Recherche</label>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <FormInput
                value={filterSearch}
                onChange={(e: { target: { value: string } }) => setFilterSearch(e.target.value)}
                placeholder="Lot, variété, espèce…"
                style={{ paddingLeft: 28, width: 210 }}
              />
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">Génération</label>
            <FormSelect value={filterGen} onChange={(e: { target: { value: string } }) => setFilterGen(e.target.value)}>
              <option value="">Toutes</option>
              {genOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </FormSelect>
          </div>
          {(filterSearch || filterGen || site) && (
            <button className="btn btn-ghost" onClick={() => { setFilterSearch(''); setFilterGen(''); setSite('') }}>
              <X size={12} /> Effacer filtres
            </button>
          )}
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Espèce</th>
                <th>Variété</th>
                <th>Génération</th>
                <th>Code Lot</th>
                <th>Quantité disponible</th>
                <th style={{ width: 120 }}>Niveau relatif</th>
                {canManage && <th style={{ width: 110 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0, 1, 2, 3, 4].map(i => (
                    <tr key={i}><td colSpan={canManage ? 8 : 7}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td></tr>
                  ))
                : stocks.length === 0
                  ? (
                    <tr>
                      <td colSpan={canManage ? 8 : 7}>
                        <div className="empty-state">
                          <div className="empty-icon"><Database size={20} /></div>
                          <div className="empty-title">
                            Aucun stock{isUPSemCL ? ' G1/G2/G3' : isSelector ? ' G0/G1' : ''} trouvé
                          </div>
                          {canManage && (
                            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowMvtForm(true)}>+ Enregistrer un mouvement</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                  : stocks.map(s => {
                      const qty      = parseFloat(s.quantiteDisponible || 0)
                      const pct      = Math.min(100, Math.round((qty / maxQty) * 100))
                      const barColor = pct > 60 ? '#16a34a' : pct > 30 ? '#f59e0b' : '#ef4444'
                      const lot      = lotMap[s.idLot]
                      const variete  = lot ? varMap[lot.idVariete] : null
                      const gen      = lot?.generation?.codeGeneration || '—'
                      return (
                        <tr key={s.id}>
                          <td>
                            <span className="badge badge-blue" style={{ gap: 4 }}>
                              <MapPin size={10} />{s.site?.codeSite || '—'}
                            </span>
                          </td>
                          <td>
                            {variete?.espece
                              ? <div>
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{variete.espece.nomCommun ?? variete.espece.nomEspece}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{variete.espece.codeEspece}</div>
                                </div>
                              : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                            }
                          </td>
                          <td>
                            {variete
                              ? <div>
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{variete.nomVariete}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{variete.codeVariete}</div>
                                </div>
                              : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                            }
                          </td>
                          <td>
                            {gen !== '—'
                              ? <span className={`badge ${GEN_BADGE[gen] || 'badge-gray'}`}>{gen}</span>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          <td>
                            {lot
                              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <span className="td-mono" style={{ fontSize: 11 }}>{lot.codeLot}</span>
                                  <StatutBadge statut={lot.statutLot} />
                                </div>
                              : <span className="td-mono" style={{ color: 'var(--text-muted)' }}>#{s.idLot}</span>
                            }
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{qty.toLocaleString('fr-FR')}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 12 }}>{s.unite || 'kg'}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 99, transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                            </div>
                          </td>
                          {canManage && (
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  className="btn btn-ghost btn-icon"
                                  style={{ padding: '4px 6px' }}
                                  title="Modifier la quantité"
                                  onClick={() => { setEditStock(s); setEditForm({ quantite: String(qty), unite: s.unite || 'kg' }) }}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  className="btn btn-ghost btn-icon"
                                  style={{ padding: '4px 6px' }}
                                  title="Historique des mouvements de ce lot"
                                  onClick={() => { setHistoryLotId(s.idLot); setShowHistory(true) }}
                                >
                                  <Archive size={13} />
                                </button>
                                {transferRule && transferRule.allowedGens.includes(gen) && parseFloat(s.quantiteDisponible) > 0 && lot?.statutLot === 'DISPONIBLE' && (
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    style={{ padding: '4px 6px', color: '#7e22ce' }}
                                    title={`Transférer vers ${transferRule.destination}`}
                                    onClick={() => openTransferFromStock(s, lot)}
                                  >
                                    <ArrowRightLeft size={13} />
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    className="btn btn-ghost btn-icon"
                                    style={{ padding: '4px 6px', color: '#dc2626' }}
                                    title="Supprimer cette entrée"
                                    onClick={() => setDeleteTarget(s)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement history */}
      {showHistory && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">
              <span className="card-title-icon"><Archive size={15} /></span>
              Historique des mouvements
              <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{filteredMvts.length}</span>
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {historyLotId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Lot : <strong style={{ color: 'var(--text-primary)' }}>{lotMap[historyLotId]?.codeLot ?? '#' + historyLotId}</strong>
                  </span>
                  <button
                    style={{ border: 'none', background: '#0ea5e915', cursor: 'pointer', color: '#0ea5e9', fontSize: 11, padding: '2px 6px', borderRadius: 4 } as any}
                    onClick={() => setHistoryLotId(null)}
                  >Voir tout</button>
                </div>
              )}
              <button className="btn btn-ghost btn-icon" onClick={() => setShowHistory(false)}><X size={13} /></button>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Code Lot</th>
                  <th>Variété</th>
                  <th>Site source</th>
                  <th>Site destination</th>
                  <th>Quantité</th>
                  <th>Référence</th>
                  <th>Opérateur</th>
                </tr>
              </thead>
              <tbody>
                {filteredMvts.length === 0
                  ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty-state">
                          <div className="empty-title">Aucun mouvement enregistré</div>
                        </div>
                      </td>
                    </tr>
                  )
                  : filteredMvts.slice(0, 100).map((m: any) => {
                      const lot     = lotMap[m.idLot]
                      const variete = lot ? varMap[lot.idVariete] : null
                      const ms      = MVT_STYLE[m.typeMouvement] ?? { label: m.typeMouvement, color: '#6b7280', bg: '#f9fafb' }
                      const date    = m.createdAt
                        ? new Date(m.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'
                      return (
                        <tr key={m.id}>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{date}</td>
                          <td>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: ms.bg, color: ms.color, whiteSpace: 'nowrap' }}>
                              {ms.label}
                            </span>
                          </td>
                          <td><span className="td-mono" style={{ fontSize: 11 }}>{lot?.codeLot ?? '#' + m.idLot}</span></td>
                          <td><span style={{ fontSize: 11 }}>{variete?.nomVariete ?? '—'}</span></td>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.siteSource?.codeSite ?? '—'}</span></td>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.siteDestination?.codeSite ?? '—'}</span></td>
                          <td>
                            <span style={{ fontWeight: 700 }}>{parseFloat(m.quantite).toLocaleString('fr-FR')}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 11 }}>{m.unite}</span>
                          </td>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.referenceOperation ?? '—'}</span></td>
                          <td><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.usernameOperateur ?? '—'}</span></td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {showStockForm && (
        <Modal title="Enregistrer un Stock" subtitle="Définir la quantité d'un lot sur un site (illimitée)" onClose={() => setShowStockForm(false)} size="sm">
          <form onSubmit={submitStock}>
            <Field label="Lot semencier" required hint="Rechercher par code lot ou variété">
              <LotDropdown lots={availableLots} value={stockForm.idLot} onChange={v => setStockForm(f => ({ ...f, idLot: v }))} varMap={varMap} />
            </Field>
            <Field label="Site de stockage" required>
              <FormSelect value={stockForm.siteCode} onChange={(e: { target: { value: string } }) => setStockForm(f => ({ ...f, siteCode: e.target.value }))}>
                <option value="">— Sélectionner un site —</option>
                {sitesList.map((s: any) => (
                  <option key={s.id} value={s.codeSite}>{s.codeSite}{s.nomSite ? ` — ${s.nomSite}` : ''}</option>
                ))}
              </FormSelect>
            </Field>
            <FormRow>
              <Field label="Quantité" required>
                <FormInput type="number" value={stockForm.quantite} onChange={(e: { target: { value: string } }) => setStockForm(f => ({ ...f, quantite: e.target.value }))} placeholder="1000" min="0" step="0.01" required />
              </Field>
              <Field label="Unité">
                <FormSelect value={stockForm.unite} onChange={(e: { target: { value: string } }) => setStockForm(f => ({ ...f, unite: e.target.value }))}>
                  <option value="kg">kg</option>
                  <option value="t">t</option>
                  <option value="g">g</option>
                </FormSelect>
              </Field>
            </FormRow>
            <FormActions onCancel={() => setShowStockForm(false)} loading={saving} submitLabel="Enregistrer le stock" />
          </form>
        </Modal>
      )}

      {showMvtForm && (
        <Modal title="Mouvement de Stock" subtitle="Enregistrer une entrée, sortie ou transfert de semences" onClose={() => setShowMvtForm(false)}>
          <form onSubmit={submitMvt}>
            <FormRow>
              <Field label="Lot semencier" required>
                <LotDropdown lots={availableLots} value={mvtForm.idLot} onChange={v => setMvtForm(f => ({ ...f, idLot: v }))} varMap={varMap} />
              </Field>
              <Field label="Type de mouvement" required>
                <FormSelect value={mvtForm.type} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="IN">↓ IN — Entrée en stock</option>
                  <option value="OUT">↑ OUT — Sortie de stock</option>
                  <option value="TRANSFER">⇄ TRANSFER — Transfert entre sites</option>
                </FormSelect>
              </Field>
            </FormRow>
            {(mvtForm.type === 'IN' || mvtForm.type === 'TRANSFER') && (
              <Field label="Site destination" required hint="Site qui reçoit les semences">
                <FormSelect value={mvtForm.siteDestinationCode} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, siteDestinationCode: e.target.value }))}>
                  <option value="">— Sélectionner un site —</option>
                  {sitesList.map((s: any) => (
                    <option key={s.id} value={s.codeSite}>{s.codeSite}{s.nomSite ? ` — ${s.nomSite}` : ''}</option>
                  ))}
                </FormSelect>
              </Field>
            )}
            {(mvtForm.type === 'OUT' || mvtForm.type === 'TRANSFER') && (
              <Field label="Site source" required hint="Site d'où partent les semences">
                <FormSelect value={mvtForm.siteSourceCode} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, siteSourceCode: e.target.value }))}>
                  <option value="">— Sélectionner un site —</option>
                  {sitesList.map((s: any) => (
                    <option key={s.id} value={s.codeSite}>{s.codeSite}{s.nomSite ? ` — ${s.nomSite}` : ''}</option>
                  ))}
                </FormSelect>
              </Field>
            )}
            <FormRow>
              <Field label="Quantité" required>
                <div style={{ display: 'flex', gap: 8 }}>
                  <FormInput type="number" value={mvtForm.quantite} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, quantite: e.target.value }))} placeholder="500" min="0.01" step="0.01" required style={{ flex: 1 }} />
                  <FormSelect value={mvtForm.unite} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}>
                    <option value="kg">kg</option>
                    <option value="t">t</option>
                  </FormSelect>
                </div>
              </Field>
              <Field label="Référence opération">
                <FormInput value={mvtForm.reference} onChange={(e: { target: { value: string } }) => setMvtForm(f => ({ ...f, reference: e.target.value }))} placeholder="REF-2026-001" />
              </Field>
            </FormRow>
            <FormActions onCancel={() => setShowMvtForm(false)} loading={saving} submitLabel="Enregistrer le mouvement" />
          </form>
        </Modal>
      )}

      {editStock && (
        <Modal
          title="Modifier le stock"
          subtitle={`${lotMap[editStock.idLot]?.codeLot ?? '#' + editStock.idLot} — ${editStock.site?.codeSite ?? ''}`}
          onClose={() => setEditStock(null)}
          size="sm"
        >
          <form onSubmit={submitEdit}>
            <Field label="Nouvelle quantité disponible" required hint="Capacité illimitée — BigDecimal(14,2) côté serveur">
              <div style={{ display: 'flex', gap: 8 }}>
                <FormInput
                  type="number"
                  value={editForm.quantite}
                  onChange={(e: { target: { value: string } }) => setEditForm(f => ({ ...f, quantite: e.target.value }))}
                  min="0"
                  step="0.01"
                  required
                  style={{ flex: 1 }}
                />
                <FormSelect value={editForm.unite} onChange={(e: { target: { value: string } }) => setEditForm(f => ({ ...f, unite: e.target.value }))} style={{ width: 80 }}>
                  <option value="kg">kg</option>
                  <option value="t">t</option>
                  <option value="g">g</option>
                </FormSelect>
              </div>
            </Field>
            <FormActions onCancel={() => setEditStock(null)} loading={saving} submitLabel="Mettre à jour" />
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Confirmer la suppression" subtitle="Cette action est irréversible" onClose={() => setDeleteTarget(null)} size="sm">
          <div style={{ paddingBottom: 8 }}>
            <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>Entrée à supprimer</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Lot <strong>{lotMap[deleteTarget.idLot]?.codeLot ?? '#' + deleteTarget.idLot}</strong>
                {' '}— Site <strong>{deleteTarget.site?.codeSite}</strong>
              </div>
              <div style={{ fontSize: 13, color: '#dc2626', marginTop: 4 }}>
                Quantité : {parseFloat(deleteTarget.quantiteDisponible).toLocaleString('fr-FR')} {deleteTarget.unite}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: 'white', border: 'none' }}
                onClick={doDelete}
                disabled={saving}
              >
                {saving ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showTransferForm && transferSource && transferRule && (
        <Modal
          title="Transférer vers l'organisation"
          subtitle={`${transferRule.source}  →  ${transferRule.destination}`}
          onClose={() => { setShowTransferForm(false); setTransferSource(null) }}
          size="sm"
        >
          <form onSubmit={submitTransferFromStock}>
            {/* Lot info — lecture seule */}
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                    Lot sélectionné
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                      background: (GEN_COLOR[transferSource.lot?.generation?.codeGeneration] ?? '#6b7280') + '22',
                      color: GEN_COLOR[transferSource.lot?.generation?.codeGeneration] ?? '#6b7280',
                    }}>
                      {transferSource.lot?.generation?.codeGeneration || '—'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{transferSource.lot?.codeLot}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {varMap[transferSource.lot?.idVariete]?.nomVariete || '—'}
                    {varMap[transferSource.lot?.idVariete]?.espece?.nomCommun && ` · ${varMap[transferSource.lot?.idVariete].espece.nomCommun}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Disponible</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                    {parseFloat(transferSource.stock.quantiteDisponible).toLocaleString('fr-FR')}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>{transferSource.stock.unite || 'kg'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flux organisations */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: '#0369a115', border: '1px solid #0369a133', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0c4a6e', marginTop: 2 }}>{transferRule.source}</div>
              </div>
              <ArrowRightLeft size={16} style={{ color: '#7e22ce', flexShrink: 0 }} />
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: '#7e22ce15', border: '1px solid #7e22ce33', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destination</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#581c87', marginTop: 2 }}>{transferRule.destination}</div>
              </div>
            </div>

            {(() => {
              const eligibles = membres.filter((m: any) => m.keycloakRole === transferRule.destRoleKey)
              return (
                <Field label="Destinataire" required hint={`Rôle : ${transferRule.destination}`}>
                  <FormSelect
                    value={transferForm.usernameDestinataire}
                    onChange={(e: { target: { value: string } }) => setTransferForm(f => ({ ...f, usernameDestinataire: e.target.value }))}
                    required
                  >
                    <option value="">— Sélectionner un destinataire —</option>
                    {eligibles.length === 0
                      ? <option disabled value="">Aucun membre {transferRule.destination} enregistré</option>
                      : eligibles.map((m: any) => (
                        <option key={m.id} value={m.keycloakUsername}>
                          {m.nomComplet || m.keycloakUsername}{m.organisation?.nomOrganisation ? ` — ${m.organisation.nomOrganisation}` : ''}
                        </option>
                      ))
                    }
                  </FormSelect>
                </Field>
              )
            })()}

            <Field
              label="Quantité à transférer"
              required
              hint={`Max disponible : ${parseFloat(transferSource.stock.quantiteDisponible).toLocaleString('fr-FR')} ${transferSource.stock.unite || 'kg'}`}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <FormInput
                  type="number"
                  value={transferForm.quantite}
                  onChange={(e: { target: { value: string } }) => setTransferForm(f => ({ ...f, quantite: e.target.value }))}
                  min="0.01"
                  max={String(parseFloat(transferSource.stock.quantiteDisponible) || 0)}
                  step="0.01"
                  required
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{transferSource.stock.unite || 'kg'}</span>
              </div>
            </Field>

            <Field label="Observations">
              <FormInput
                value={transferForm.observations}
                onChange={(e: { target: { value: string } }) => setTransferForm(f => ({ ...f, observations: e.target.value }))}
                placeholder="Commentaires, conditions de transfert…"
              />
            </Field>

            <FormActions
              onCancel={() => { setShowTransferForm(false); setTransferSource(null) }}
              loading={transferSaving}
              submitLabel={`Initier le transfert vers ${transferRule.destination}`}
            />
          </form>
        </Modal>
      )}
    </div>
  )
}
