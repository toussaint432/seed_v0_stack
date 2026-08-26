/* ═══════════════════════════════════════════════════════════════
   MapSemences — Carte interactive Leaflet / OpenStreetMap
   Couches : polygones ZAE · bulles d'activité · marqueurs sites
   Rôles   : admin · sélectionneur · upsemcl · multiplicateur · quotataire
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, GeoJSON, Tooltip, Marker } from 'react-leaflet'
import L from 'leaflet'
import type { PathOptions } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, MapPin, Layers, Filter, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import {
  SITE_COORDS, SITE_META, ZAE_CENTROIDS, ZAE_COLORS, ZAE_DISPLAY,
  SITE_TO_ZAE, SITE_TYPE_COLOR, SENEGAL_ZAE_GEOJSON,
} from '../data/senegal-zae'

/* ── Types ── */
interface StockRow {
  codeSite: string; nomSite: string
  codeGeneration: string; codeEspece: string; nomEspece: string
  codeVariete: string; nomVariete: string
  quantiteTotale: number; nbLots: number
}

interface SiteAgg { total: number; byGen: Record<string, number>; nomSite: string }
interface ZaeAgg  { total: number; sites: string[]; nbLots: number }

interface Props { roleKey: string }

/* ── Générations visibles par rôle ── */
const ROLE_GENS: Record<string, string[]> = {
  'seed-admin':         ['G0','G1','G2','G3','G4','R1','R2'],
  'seed-selector':      ['G0','G1'],
  'seed-upsemcl':       ['G1','G2','G3'],
  'seed-multiplicator': ['G3','G4','R1','R2'],
  'seed-quotataire':    ['R2'],
}

import { GEN_CHART_COLORS as GEN_COLORS } from '../../lib/constants'

/* ── Éclaircissement hex pour le dégradé des icônes ── */
function lightenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * 0.52)
  const lg = Math.round(g + (255 - g) * 0.52)
  const lb = Math.round(b + (255 - b) * 0.52)
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

/* ── Icône personnage site — même langage visuel que MapCatalogue ── */
function createSiteIcon(nomSite: string, stockTotal: number, maxStock: number, zaeCode: string | null): L.DivIcon {
  const hasStock = stockTotal > 0
  const ratio    = hasStock ? Math.sqrt(Math.max(stockTotal, 1) / Math.max(maxStock, 1)) : 0
  const cs       = hasStock ? Math.round(26 + 16 * ratio) : 18
  const baseColor = zaeCode && ZAE_COLORS[zaeCode] ? ZAE_COLORS[zaeCode] : '#15803d'
  const color     = hasStock ? baseColor : '#9ca3af'
  const light     = hasStock ? lightenHex(baseColor) : '#d1d5db'
  const ring      = hasStock ? baseColor + '55' : '#d1d5db55'
  const name      = nomSite.length > 20 ? nomSite.slice(0, 18) + '…' : nomSite
  const svgS      = Math.round(cs * 0.52)
  const opacity   = hasStock ? 1 : 0.42
  const html = `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;opacity:${opacity}">
    <div style="width:${cs}px;height:${cs}px;border-radius:50%;background:radial-gradient(circle at 38% 32%,${light},${color});border:2.5px solid #fff;box-shadow:0 3px 10px ${color}44,0 0 0 2px ${ring},inset 0 1px 0 rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;">
      <svg width="${svgS}" height="${svgS}" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="7.5" r="3.5"/>
        <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/>
      </svg>
    </div>
    ${hasStock ? `<div style="background:rgba(255,255,255,0.97);border:1.5px solid ${color}55;border-radius:5px;padding:2px 7px;font-size:9.5px;font-weight:700;white-space:nowrap;margin-top:3px;color:${color};box-shadow:0 1px 5px rgba(0,0,0,0.15);max-width:140px;overflow:hidden;text-overflow:ellipsis;">${name}</div>` : ''}
  </div>`
  return L.divIcon({ html, className: '', iconSize: [140, cs + (hasStock ? 28 : 4)], iconAnchor: [70, Math.round(cs / 2)] })
}

/* ── Rayon de bulle proportionnel à √(stock/max) ── */
function bubbleR(stock: number, max: number, min = 10, maxR = 42): number {
  if (!stock || !max) return 0
  return min + (maxR - min) * Math.sqrt(stock / max)
}

/* ── Formatage ── */
function fmtKg(v: number) {
  return v >= 1000
    ? `${(v / 1000).toFixed(1)} t`
    : `${Math.round(v).toLocaleString('fr-FR')} kg`
}

/* ═══════════════════ Panneaux latéraux ════════════════════ */

function ZaePanel({ code, zones, agg, stocks }: {
  code: string; zones: any[]; agg: ZaeAgg | undefined; stocks: StockRow[]
}) {
  const zone  = zones.find(z => z.code === code)
  const color = ZAE_COLORS[code] || '#6b7280'

  /* Top variétés dans cette ZAE (via mapping site→zae) */
  const topVarietes = useMemo(() => {
    const map: Record<string, number> = {}
    stocks
      .filter(r => SITE_TO_ZAE[r.codeSite] === code)
      .forEach(r => { map[r.codeVariete] = (map[r.codeVariete] || 0) + Number(r.quantiteTotale) })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [stocks, code])

  /* Stock par génération dans cette ZAE */
  const byGen = useMemo(() => {
    const map: Record<string, number> = {}
    stocks
      .filter(r => SITE_TO_ZAE[r.codeSite] === code)
      .forEach(r => { map[r.codeGeneration] = (map[r.codeGeneration] || 0) + Number(r.quantiteTotale) })
    return map
  }, [stocks, code])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            {ZAE_DISPLAY[code] || code}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            Zone Agro-Écologique · {code}
          </div>
        </div>
      </div>

      {zone?.description && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface-2)', borderRadius: 7, padding: '8px 10px', marginBottom: 12, lineHeight: 1.5 }}>
          {zone.description}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <StatMini label="Stock total" value={agg ? fmtKg(agg.total) : '—'} color={color} />
        <StatMini label="Sites actifs" value={agg ? String(agg.sites.length) : '0'} color={color} />
      </div>

      {/* Stock par génération */}
      {Object.entries(byGen).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Stock par génération
          </div>
          {Object.entries(byGen).sort((a,b) => b[1]-a[1]).map(([gen, kg]) => (
            <div key={gen} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: GEN_COLORS[gen] || '#6b7280', width: 24 }}>{gen}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: GEN_COLORS[gen] || '#6b7280',
                  width: `${Math.min((kg / (agg?.total || 1)) * 100, 100)}%`,
                }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 48, textAlign: 'right' }}>{fmtKg(kg)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top variétés */}
      {topVarietes.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Variétés disponibles
          </div>
          {topVarietes.map(([code, kg]) => (
            <div key={code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{code}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtKg(kg)}</span>
            </div>
          ))}
        </div>
      )}

      {!agg && (
        <div style={{ padding: '14px 0 4px' }}>
          <div style={{ textAlign: 'center', padding: '12px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10 }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🌱</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 }}>Aucun stock dans cette zone</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Consultez les zones adjacentes ou accédez au catalogue pour trouver des fournisseurs proches.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SitePanel({ code, stockBySite }: { code: string; stockBySite: Record<string, SiteAgg> }) {
  const meta  = SITE_META[code]
  const data  = stockBySite[code]
  const color = SITE_TYPE_COLOR[meta?.type || ''] || '#6b7280'
  const total = data?.total || 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            {meta?.nom || code}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {meta?.type || 'Site'} · {meta?.region || '—'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <StatMini label="Stock total" value={total > 0 ? fmtKg(total) : '—'} color={color} />
        <StatMini label="Générations" value={data ? String(Object.keys(data.byGen).length) : '0'} color={color} />
      </div>

      {data && Object.entries(data.byGen).length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Détail par génération
          </div>
          {Object.entries(data.byGen).sort((a,b) => b[1]-a[1]).map(([gen, kg]) => (
            <div key={gen} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: GEN_COLORS[gen] || '#6b7280',
                background: (GEN_COLORS[gen] || '#6b7280') + '18',
                borderRadius: 4, padding: '1px 5px', width: 30, textAlign: 'center',
              }}>{gen}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: GEN_COLORS[gen] || '#6b7280',
                  width: `${Math.min((kg / total) * 100, 100)}%`,
                }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 48, textAlign: 'right' }}>{fmtKg(kg)}</span>
            </div>
          ))}
        </div>
      )}

      {!data && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
          Aucun stock enregistré sur ce site
        </div>
      )}
    </div>
  )
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px', border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

/* ═══════════════════ Composant principal ════════════════════ */

export function MapSemences({ roleKey }: Props) {
  /* ── État ── */
  const [zones,        setZones]        = useState<any[]>([])
  const [stocksAgrege, setStocksAgrege] = useState<StockRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [lastUpdate,   setLastUpdate]   = useState<Date>(new Date())

  /* ── Filtres ── */
  const [filterEspece, setFilterEspece] = useState('')
  const [filterGen,    setFilterGen]    = useState('')
  const [showZAE,      setShowZAE]      = useState(true)
  const [showSites,    setShowSites]    = useState(true)
  const [showBubbles,  setShowBubbles]  = useState(true)

  /* ── Panneau latéral ── */
  const [panel, setPanel] = useState<{ type: 'zae' | 'site'; code: string } | null>(null)

  const allowedGens = ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2']

  /* ── Chargement des données ── */
  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(endpoints.zones),
      api.get(endpoints.stocksAgrege),
    ]).then(([zonesRes, stockRes]) => {
      setZones(Array.isArray(zonesRes.data)  ? zonesRes.data  : [])
      setStocksAgrege(Array.isArray(stockRes.data) ? stockRes.data : [])
      setLastUpdate(new Date())
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* ── Stock filtré selon rôle + filtres UI ── */
  const filteredStocks = useMemo(() => stocksAgrege.filter(r => {
    if (!allowedGens.includes(r.codeGeneration)) return false
    if (filterGen    && r.codeGeneration !== filterGen)    return false
    if (filterEspece && r.codeEspece     !== filterEspece) return false
    return true
  }), [stocksAgrege, allowedGens, filterGen, filterEspece])

  /* ── Agrégation par site ── */
  const stockBySite = useMemo<Record<string, SiteAgg>>(() => {
    const map: Record<string, SiteAgg> = {}
    filteredStocks.forEach(r => {
      const q = Number(r.quantiteTotale) || 0
      if (!map[r.codeSite]) map[r.codeSite] = { total: 0, byGen: {}, nomSite: r.nomSite }
      map[r.codeSite].total += q
      map[r.codeSite].byGen[r.codeGeneration] = (map[r.codeSite].byGen[r.codeGeneration] || 0) + q
    })
    return map
  }, [filteredStocks])

  /* ── Agrégation par ZAE ── */
  const stockByZae = useMemo<Record<string, ZaeAgg>>(() => {
    const map: Record<string, ZaeAgg> = {}
    Object.entries(stockBySite).forEach(([codeSite, data]) => {
      const zae = SITE_TO_ZAE[codeSite]
      if (!zae) return
      if (!map[zae]) map[zae] = { total: 0, sites: [], nbLots: 0 }
      map[zae].total += data.total
      if (!map[zae].sites.includes(codeSite)) map[zae].sites.push(codeSite)
    })
    return map
  }, [stockBySite])

  const maxZae  = useMemo(() => Math.max(...Object.values(stockByZae).map(d => d.total), 1), [stockByZae])
  const maxSite = useMemo(() => Math.max(...Object.values(stockBySite).map(d => d.total), 1), [stockBySite])

  /* ── Espèces disponibles pour le filtre ── */
  const especeOptions = useMemo(() => {
    const set = new Set(stocksAgrege.filter(r => allowedGens.includes(r.codeGeneration)).map(r => r.codeEspece))
    return Array.from(set).sort()
  }, [stocksAgrege, allowedGens])

  /* ── Style GeoJSON polygones ZAE ── */
  const zaeStyle = useCallback((feature: any): PathOptions => {
    const code    = feature?.properties?.code
    const stock   = stockByZae[code]?.total || 0
    const hasStock = stock > 0
    const ratio   = Math.min(stock / maxZae, 1)
    return {
      fillColor:   ZAE_COLORS[code] || '#6b7280',
      fillOpacity: hasStock ? 0.10 + ratio * 0.28 : 0.03,
      color:       hasStock ? ZAE_COLORS[code] || '#6b7280' : '#d1d5db',
      weight:      hasStock ? 1.5 : 0.8,
      dashArray:   hasStock ? undefined : '5 4',
      opacity:     hasStock ? 0.85 : 0.4,
    }
  }, [stockByZae, maxZae])

  /* ── Handler clic ZAE ── */
  const onZaeFeature = useCallback((feature: any, layer: any) => {
    const code = feature?.properties?.code
    layer.on('click', () => setPanel({ type: 'zae', code }))
    layer.bindTooltip(
      `<strong>${ZAE_DISPLAY[code] || code}</strong>`,
      { permanent: false, direction: 'center', className: 'map-tooltip' }
    )
  }, [])

  /* ── Statistiques résumé ── */
  const totalStock = useMemo(() => filteredStocks.reduce((s, r) => s + (Number(r.quantiteTotale) || 0), 0), [filteredStocks])
  const nbZonesActives = Object.keys(stockByZae).length
  const nbSitesActifs  = Object.keys(stockBySite).length

  /* ── Style toggle bouton ── */
  function toggleBtn(active: boolean, color: string, label: string, onClick: () => void) {
    return (
      <button onClick={onClick} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500,
        background: active ? `${color}18` : 'var(--surface-3)',
        border: `1px solid ${active ? color + '55' : 'var(--border)'}`,
        color: active ? color : 'var(--text-muted)',
        transition: 'all .15s',
      }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--green-50)', border: '1px solid var(--green-200)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={16} color="var(--green-700)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Carte agro-écologique
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{nbZonesActives} zone{nbZonesActives > 1 ? 's' : ''} active{nbZonesActives > 1 ? 's' : ''}
              {' · '}{nbSitesActifs} site{nbSitesActifs > 1 ? 's' : ''} · {fmtKg(totalStock)} total
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* ── Contrôles ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
          <Layers size={13} color="var(--text-muted)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>COUCHES</span>
        </div>
        {toggleBtn(showZAE,     '#22c55e', '🗺 Zones ZAE',      () => setShowZAE(v => !v))}
        {toggleBtn(showBubbles, '#0ea5e9', '⬤ Activité',        () => setShowBubbles(v => !v))}
        {toggleBtn(showSites,   '#6366f1', '📍 Sites',          () => setShowSites(v => !v))}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} color="var(--text-muted)" />
        </div>
        <select
          value={filterEspece} onChange={e => setFilterEspece(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <option value="">Toutes espèces</option>
          {especeOptions.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={filterGen} onChange={e => setFilterGen(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <option value="">Toutes générations</option>
          {allowedGens.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* ── Carte + Panneau ── */}
      <div style={{ display: 'flex', gap: 12, height: 480 }}>

        {/* Carte Leaflet */}
        <div style={{
          flex: 1, borderRadius: 12, overflow: 'hidden',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          position: 'relative',
        }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-muted)', backdropFilter: 'blur(2px)' }}>
              Chargement…
            </div>
          )}

          <MapContainer
            center={[14.5, -14.4]}
            zoom={7}
            minZoom={6}
            maxZoom={12}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
            zoomControl
          >
            {/* ── Fond CartoDB Positron (léger, sobre) ── */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
            />

            {/* ── Couche 1 : Polygones ZAE ── */}
            {showZAE && (
              <GeoJSON
                key={`zae-${JSON.stringify(stockByZae)}-${filterGen}-${filterEspece}`}
                data={SENEGAL_ZAE_GEOJSON as any}
                style={zaeStyle}
                onEachFeature={onZaeFeature}
              />
            )}

            {/* ── Couche 2 : Bulles d'activité par ZAE ── */}
            {showBubbles && Object.entries(ZAE_CENTROIDS).map(([code, [lat, lng]]) => {
              const agg    = stockByZae[code]
              const stock  = agg?.total || 0
              const radius = bubbleR(stock, maxZae)
              if (radius === 0) return null
              const color  = ZAE_COLORS[code] || '#6b7280'
              return (
                <CircleMarker
                  key={`bubble-${code}`}
                  center={[lat, lng]}
                  radius={radius}
                  pathOptions={{ fillColor: color, fillOpacity: 0.22, color, weight: 2, opacity: 0.6 }}
                  eventHandlers={{ click: () => setPanel({ type: 'zae', code }) }}
                >
                  <Tooltip permanent direction="center" offset={[0, 0]} opacity={1}>
                    <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color }}>{ZAE_DISPLAY[code] || code}</div>
                      <div style={{ fontSize: 10, color: '#374151', fontWeight: 600 }}>{fmtKg(stock)}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
                        {agg?.sites.length || 0} site{(agg?.sites.length || 0) > 1 ? 's' : ''}
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              )
            })}

            {/* ── Couche 3 : Marqueurs de sites (icône personnage, cohérent avec MapCatalogue) ── */}
            {showSites && Object.entries(SITE_COORDS).map(([code, [lat, lng]]) => {
              const data     = stockBySite[code]
              const total    = data?.total || 0
              const meta     = SITE_META[code]
              const zaeCode  = SITE_TO_ZAE[code] || null
              const icon     = createSiteIcon(meta?.nom || code, total, maxSite, zaeCode)
              const zaeColor = zaeCode && ZAE_COLORS[zaeCode] ? ZAE_COLORS[zaeCode] : '#15803d'
              return (
                <Marker
                  key={`site-${code}`}
                  position={[lat, lng]}
                  icon={icon}
                  eventHandlers={{ click: () => setPanel({ type: 'site', code }) }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <div style={{ lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{meta?.nom || code}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{meta?.type || ''} · {meta?.region || ''}</div>
                      {total > 0
                        ? <div style={{ fontSize: 11, color: zaeColor, fontWeight: 600 }}>{fmtKg(total)} disponibles</div>
                        : <div style={{ fontSize: 11, color: '#9ca3af' }}>Aucun stock</div>
                      }
                    </div>
                  </Tooltip>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        {/* ── Panneau latéral ── */}
        {panel && (
          <div style={{
            width: 248, flexShrink: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px 14px 16px',
            overflowY: 'auto', position: 'relative',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <button
              onClick={() => setPanel(null)}
              style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, borderRadius: 4, display: 'flex' }}
            >
              <X size={15} />
            </button>
            {panel.type === 'zae' && (
              <ZaePanel
                code={panel.code}
                zones={zones}
                agg={stockByZae[panel.code]}
                stocks={filteredStocks}
              />
            )}
            {panel.type === 'site' && (
              <SitePanel code={panel.code} stockBySite={stockBySite} />
            )}
          </div>
        )}
      </div>

      {/* ── Légende ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ZAE :</span>
        {Object.entries(ZAE_DISPLAY).map(([code, name]) => (
          <div
            key={code}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            onClick={() => setPanel({ type: 'zae', code })}
          >
            <div style={{ width: 10, height: 10, borderRadius: 3, background: ZAE_COLORS[code], opacity: 0.75 }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{code} — {name}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%,#4ade80,#15803d)', border: '2px solid #fff', boxShadow: '0 1px 4px #15803d44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Site avec stock</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#9ca3af', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.42 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Site sans stock</span>
          </div>
        </div>
      </div>
    </div>
  )
}
