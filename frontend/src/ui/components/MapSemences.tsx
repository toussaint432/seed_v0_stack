/* ═══════════════════════════════════════════════════════════════
   MapSemences — Carte interactive Leaflet / OpenStreetMap
   Couches : polygones ZAE · bulles d'activité · marqueurs sites
   Rôles   : admin · sélectionneur · upsemcl · multiplicateur · quotataire
   ═══════════════════════════════════════════════════════════════ */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { PathOptions } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, MapPin, Layers, Filter, RefreshCw, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import {
  SITE_COORDS, SITE_META, ZAE_COLORS, ZAE_DISPLAY,
  SITE_TO_ZAE, SITE_TYPE_COLOR, SENEGAL_ZAE_GEOJSON,
} from '../data/senegal-zae'

/* ── Types ── */
interface StockRow {
  codeSite: string; nomSite: string; zoneCode: string | null
  codeGeneration: string; codeEspece: string; nomEspece: string
  codeVariete: string; nomVariete: string
  quantiteTotale: number; nbLots: number
}

interface SiteAgg { total: number; byGen: Record<string, number>; nomSite: string }
interface ZaeAgg  { total: number; sites: string[]; nbLots: number }

interface MembreCarte {
  username: string
  nomComplet: string
  role: string
  nomOrganisation: string
  typeOrganisation: string
  latitude: number
  longitude: number
  nomSite: string
  zoneCode: string | null
}

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

/* ── Couleurs et labels par rôle Keycloak ── */
const ROLE_COLORS: Record<string, string> = {
  'seed-selector':      '#7c3aed',
  'seed-upsemcl':       '#2563eb',
  'seed-multiplicator': '#15803d',
  'seed-quotataire':    '#d97706',
}
const ROLE_LABELS: Record<string, string> = {
  'seed-selector':      'Sélectionneur',
  'seed-upsemcl':       'UPSemCL',
  'seed-multiplicator': 'Multiplicateur',
  'seed-quotataire':    'Quotataire',
}

/* ── Icône utilisateur — personnage coloré par rôle ── */
function createMembreIcon(nomComplet: string, role: string): L.DivIcon {
  const color = ROLE_COLORS[role] || '#6b7280'
  const light = lightenHex(color)
  const cs    = 28
  const svgS  = Math.round(cs * 0.52)
  const label = nomComplet.length > 22 ? nomComplet.slice(0, 20) + '…' : nomComplet
  const html  = `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
    <div style="width:${cs}px;height:${cs}px;border-radius:50%;background:radial-gradient(circle at 38% 32%,${light},${color});border:2.5px solid #fff;box-shadow:0 3px 10px ${color}44,0 0 0 2px ${color}33,inset 0 1px 0 rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;">
      <svg width="${svgS}" height="${svgS}" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="7.5" r="3.5"/>
        <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/>
      </svg>
    </div>
    <div style="background:rgba(255,255,255,0.97);border:1.5px solid ${color}55;border-radius:5px;padding:2px 6px;font-size:9px;font-weight:700;white-space:nowrap;margin-top:3px;color:${color};box-shadow:0 1px 5px rgba(0,0,0,0.15);max-width:130px;overflow:hidden;text-overflow:ellipsis;">${label}</div>
  </div>`
  return L.divIcon({ html, className: '', iconSize: [140, cs + 28], iconAnchor: [70, Math.round(cs / 2)] })
}

/* ── Icône cluster — personnage + badge compteur ── */
function createClusterIcon(group: MembreCarte[]): L.DivIcon {
  const allSameRole = group.every(m => m.role === group[0].role)
  const color = allSameRole ? (ROLE_COLORS[group[0].role] || '#6b7280') : '#6b7280'
  const light = lightenHex(color)
  const count = group.length
  const cs    = 34
  const svgS  = Math.round(cs * 0.47)
  const html  = `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;position:relative;">
    <div style="width:${cs}px;height:${cs}px;border-radius:50%;background:radial-gradient(circle at 38% 32%,${light},${color});border:2.5px solid #fff;box-shadow:0 3px 10px ${color}44,0 0 0 2px ${color}33,inset 0 1px 0 rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;">
      <svg width="${svgS}" height="${svgS}" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/></svg>
    </div>
    <div style="position:absolute;top:-3px;right:calc(50% - ${Math.round(cs / 2) + 2}px);background:${color};color:#fff;border-radius:10px;font-size:10px;font-weight:800;padding:1px 5px;border:2px solid #fff;min-width:18px;text-align:center;line-height:16px;">${count}</div>
  </div>`
  return L.divIcon({ html, className: '', iconSize: [140, cs + 10], iconAnchor: [70, Math.round(cs / 2)] })
}


/* ── Formatage ── */
function fmtKg(v: number) {
  return v >= 1000
    ? `${(v / 1000).toFixed(1)} t`
    : `${Math.round(v).toLocaleString('fr-FR')} kg`
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtDist(km: number): string {
  const h = Math.floor(km / 60)
  const m = Math.round((km / 60 - h) * 60)
  return h === 0 ? `${Math.round(km)} km · ~${m} min` : `${Math.round(km)} km · ~${h}h${m > 0 ? m : ''}`
}

/* ═══════════════════ Panneaux latéraux ════════════════════ */

function ZaePanel({ code, zones, agg, stocks }: {
  code: string; zones: any[]; agg: ZaeAgg | undefined; stocks: StockRow[]
}) {
  const zone  = zones.find(z => z.code === code)
  const color = ZAE_COLORS[code] || '#6b7280'

  /* Top variétés dans cette ZAE */
  const topVarietes = useMemo(() => {
    const map: Record<string, number> = {}
    stocks
      .filter(r => (r.zoneCode || SITE_TO_ZAE[r.codeSite]) === code)
      .forEach(r => { map[r.codeVariete] = (map[r.codeVariete] || 0) + Number(r.quantiteTotale) })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [stocks, code])

  /* Stock par génération dans cette ZAE */
  const byGen = useMemo(() => {
    const map: Record<string, number> = {}
    stocks
      .filter(r => (r.zoneCode || SITE_TO_ZAE[r.codeSite]) === code)
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

/* ═══════════════════ Bouton contact ════════════════════ */

function ClusterContactBtn({ username, color }: { username: string; color: string }) {
  const navigate = useNavigate()
  return (
    <button
      style={{ marginTop: 10, width: '100%', padding: '7px 0', background: color, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
      onClick={() => navigate(`/messages?to=${username}`)}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Envoyer un message
    </button>
  )
}

/* ═══════════════════ Popup cluster ════════════════════ */

function ClusterPopup({
  group, filteredStocks, userPos,
}: {
  group: MembreCarte[]
  filteredStocks: StockRow[]
  userPos: [number, number] | null
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const m = selected ? group.find(g => g.username === selected) ?? null : null

  if (m) {
    const color    = ROLE_COLORS[m.role] || '#6b7280'
    const label    = ROLE_LABELS[m.role] || m.role
    const siteStocks = filteredStocks.filter(r => r.nomSite === m.nomSite)
    const siteTotal  = siteStocks.reduce((s, r) => s + Number(r.quantiteTotale), 0)
    const varMap     = new Map<string, { codeVariete: string; nomVariete: string; codeGen: string; codeEspece: string; total: number }>()
    siteStocks.forEach(r => {
      const ex = varMap.get(r.codeVariete)
      if (ex) ex.total += Number(r.quantiteTotale)
      else varMap.set(r.codeVariete, { codeVariete: r.codeVariete, nomVariete: r.nomVariete, codeGen: r.codeGeneration, codeEspece: r.codeEspece, total: Number(r.quantiteTotale) })
    })
    const varieties = Array.from(varMap.values()).sort((a, b) => b.total - a.total)
    const km        = userPos ? distKm(userPos[0], userPos[1], m.latitude, m.longitude) : null

    return (
      <div style={{ fontFamily: 'inherit', padding: '2px 0' }}>
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '0 0 8px 0', marginBottom: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Retour à la liste
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `radial-gradient(circle at 38% 32%, ${lightenHex(color)}, ${color})`, border: '2px solid #fff', boxShadow: `0 2px 6px ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', lineHeight: 1.2 }}>{m.nomComplet}</div>
            <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, background: color + '18', color, borderRadius: 4, padding: '1px 6px', marginTop: 2 }}>{label}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7, marginBottom: 4 }}>
          <div>📍 {m.nomSite}{m.zoneCode ? ` · ZAE ${m.zoneCode}` : ''}</div>
          <div>🏢 {m.nomOrganisation}</div>
          {km !== null && <div style={{ color: '#2563eb', fontWeight: 600 }}>✈ {fmtDist(km)} de votre position</div>}
        </div>
        {varieties.length > 0 && (
          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 6, paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Stock disponible</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>{fmtKg(siteTotal)} · {varieties.length} variété{varieties.length > 1 ? 's' : ''}</span>
            </div>
            {varieties.slice(0, 4).map(v => (
              <div key={v.codeVariete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{v.nomVariete}</span>
                  <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 5 }}>{v.codeEspece}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: GEN_COLORS[v.codeGen] || '#6b7280', background: (GEN_COLORS[v.codeGen] || '#6b7280') + '18', borderRadius: 3, padding: '1px 4px' }}>{v.codeGen}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{fmtKg(v.total)}</span>
                </div>
              </div>
            ))}
            {varieties.length > 4 && <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right', marginTop: 3 }}>+{varieties.length - 4} autre{varieties.length - 4 > 1 ? 's' : ''} variété{varieties.length - 4 > 1 ? 's' : ''}</div>}
          </div>
        )}
        <ClusterContactBtn username={m.username} color={color} />
      </div>
    )
  }

  /* ── Vue liste ── */
  const allSameRole  = group.every(g => g.role === group[0].role)
  const headerColor  = allSameRole ? (ROLE_COLORS[group[0].role] || '#6b7280') : '#6b7280'

  return (
    <div style={{ fontFamily: 'inherit', padding: '2px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `radial-gradient(circle at 38% 32%, ${lightenHex(headerColor)}, ${headerColor})`, border: '2px solid #fff', boxShadow: `0 2px 6px ${headerColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/></svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{group.length} acteurs</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>📍 {group[0].nomSite}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {group.map(mem => {
          const c = ROLE_COLORS[mem.role] || '#6b7280'
          const l = ROLE_LABELS[mem.role] || mem.role
          return (
            <button
              key={mem.username}
              onClick={() => setSelected(mem.username)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: `radial-gradient(circle at 38% 32%, ${lightenHex(c)}, ${c})`, border: '2px solid #fff', boxShadow: `0 1px 4px ${c}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mem.nomComplet}</div>
                <span style={{ fontSize: 9, fontWeight: 700, background: c + '18', color: c, borderRadius: 3, padding: '1px 5px' }}>{l}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )
        })}
      </div>
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
  const [showZAE,          setShowZAE]          = useState(true)
  const [showSitesAndUsers, setShowSitesAndUsers] = useState(true)
  const [activeRoles, setActiveRoles] = useState<Set<string>>(
    () => new Set(['seed-selector', 'seed-upsemcl', 'seed-multiplicator', 'seed-quotataire'])
  )

  /* ── Utilisateurs carte ── */
  const [membres,  setMembres]  = useState<MembreCarte[]>([])
  const [userPos,  setUserPos]  = useState<[number, number] | null>(null)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setUserPos([p.coords.latitude, p.coords.longitude]),
      () => {}
    )
  }, [])

  /* ── Panneau latéral ── */
  const [panel, setPanel] = useState<{ type: 'zae' | 'site'; code: string } | null>(null)

  const allowedGens = ROLE_GENS[roleKey] ?? ['G0','G1','G2','G3','G4','R1','R2']

  /* ── Chargement des données ── */
  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(endpoints.zones),
      api.get(endpoints.stocksAgrege),
      api.get(endpoints.membresCarte).catch(() => ({ data: [] })),
    ]).then(([zonesRes, stockRes, membresRes]) => {
      setZones(Array.isArray(zonesRes.data)   ? zonesRes.data   : [])
      setStocksAgrege(Array.isArray(stockRes.data)  ? stockRes.data  : [])
      setMembres(Array.isArray(membresRes.data) ? membresRes.data : [])
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

  /* ── Agrégation par ZAE (depuis zone_code dynamique de l'API) ── */
  const stockByZae = useMemo<Record<string, ZaeAgg>>(() => {
    const map: Record<string, ZaeAgg> = {}
    filteredStocks.forEach(r => {
      const zae = r.zoneCode || SITE_TO_ZAE[r.codeSite]
      if (!zae) return
      const q = Number(r.quantiteTotale) || 0
      if (!map[zae]) map[zae] = { total: 0, sites: [], nbLots: 0 }
      map[zae].total += q
      if (!map[zae].sites.includes(r.codeSite)) map[zae].sites.push(r.codeSite)
    })
    return map
  }, [filteredStocks])

  const maxZae  = useMemo(() => Math.max(...Object.values(stockByZae).map(d => d.total), 1), [stockByZae])
  const maxSite = useMemo(() => Math.max(...Object.values(stockBySite).map(d => d.total), 1), [stockBySite])

  const toggleRole = useCallback((role: string) => {
    setActiveRoles(prev => {
      const next = new Set(prev)
      if (next.has(role)) {
        if (next.size > 1) next.delete(role)
      } else {
        next.add(role)
      }
      return next
    })
  }, [])

  const visibleMembres = useMemo(
    () => membres.filter(m => activeRoles.has(m.role)),
    [membres, activeRoles]
  )

  /* Groupes de membres co-localisés — même rôle uniquement.
     Sélectionneurs/UPSemCL : 0.05° (site institutionnel partagé).
     Multiplicateurs/Quotataires : 0.01° (~1 km). */
  const memberGroups = useMemo<MembreCarte[][]>(() => {
    const assigned = new Set<string>()
    const groups: MembreCarte[][] = []
    visibleMembres.forEach(m => {
      if (assigned.has(m.username)) return
      const institutional = m.role === 'seed-selector' || m.role === 'seed-upsemcl'
      const threshold = institutional ? 0.05 : 0.01
      const group = visibleMembres.filter(o =>
        o.role === m.role &&
        Math.hypot(m.latitude - o.latitude, m.longitude - o.longitude) < threshold
      )
      group.forEach(g => assigned.add(g.username))
      groups.push(group)
    })
    return groups
  }, [visibleMembres])

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
      fillOpacity: hasStock ? 0.10 + ratio * 0.28 : 0.07,
      color:       hasStock ? ZAE_COLORS[code] || '#6b7280' : '#9ca3af',
      weight:      hasStock ? 1.5 : 1.1,
      dashArray:   hasStock ? undefined : '4 3',
      opacity:     hasStock ? 0.85 : 0.60,
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
        {/* Acteurs : master toggle + filtres de rôle inline */}
        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 6, border: `1px solid ${showSitesAndUsers ? '#7c3aed55' : 'var(--border)'}`, overflow: 'hidden', transition: 'border-color .15s' }}>
          <button onClick={() => setShowSitesAndUsers(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
            background: showSitesAndUsers ? '#7c3aed18' : 'var(--surface-3)',
            border: 'none', color: showSitesAndUsers ? '#7c3aed' : 'var(--text-muted)',
            transition: 'all .15s',
          }}>
            👤 Acteurs
          </button>
          {showSitesAndUsers && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderLeft: '1px solid #7c3aed33', background: '#7c3aed08' }}>
              {Object.entries(ROLE_LABELS)
                .filter(([role]) => {
                  const visible: Record<string, string[]> = {
                    'seed-admin':        ['seed-selector','seed-upsemcl','seed-multiplicator','seed-quotataire'],
                    'seed-upsemcl':      ['seed-selector','seed-multiplicator','seed-quotataire'],
                    'seed-selector':     ['seed-upsemcl','seed-multiplicator','seed-quotataire'],
                    'seed-multiplicator':['seed-upsemcl','seed-quotataire'],
                    'seed-quotataire':   ['seed-multiplicator'],
                  }
                  return (visible[roleKey] ?? []).includes(role)
                })
                .map(([role, label]) => {
                  const active = activeRoles.has(role)
                  return (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      title={`${active ? 'Masquer' : 'Afficher'} ${label}`}
                      style={{
                        width: 20, height: 20, borderRadius: '50%', padding: 0, border: 'none',
                        background: active
                          ? `radial-gradient(circle at 38% 32%, ${lightenHex(ROLE_COLORS[role])}, ${ROLE_COLORS[role]})`
                          : '#d1d5db',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: active ? 1 : 0.45, transition: 'all .15s', flexShrink: 0,
                        outline: active ? `2px solid ${ROLE_COLORS[role]}55` : 'none', outlineOffset: 1,
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/></svg>
                    </button>
                  )
                })}
            </div>
          )}
        </div>

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
            {/* ── Fond Stadia Alidade Smooth (style Positron, libre, sans clé) ── */}
            <TileLayer
              url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
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


            {/* ── Couche 3 : Acteurs (cluster si co-localisés, sinon popup individuel) ── */}
            {showSitesAndUsers && memberGroups.map((group, idx) => {
              /* ── Cluster : plusieurs acteurs au même endroit ── */
              if (group.length > 1) {
                const centroid: [number, number] = [
                  group.reduce((s, m) => s + m.latitude,  0) / group.length,
                  group.reduce((s, m) => s + m.longitude, 0) / group.length,
                ]
                return (
                  <Marker key={`cluster-${idx}`} position={centroid} icon={createClusterIcon(group)}>
                    <Popup minWidth={230} maxWidth={290}>
                      <ClusterPopup group={group} filteredStocks={filteredStocks} userPos={userPos} />
                    </Popup>
                  </Marker>
                )
              }

              /* ── Acteur unique ── */
              const m = group[0]
              const icon  = createMembreIcon(m.nomComplet, m.role)
              const color = ROLE_COLORS[m.role] || '#6b7280'
              const label = ROLE_LABELS[m.role] || m.role

              /* Variétés du site par nom de site (jointure naturelle) */
              const siteStocks = filteredStocks.filter(r => r.nomSite === m.nomSite)
              const siteTotal  = siteStocks.reduce((s, r) => s + Number(r.quantiteTotale), 0)
              const varMap = new Map<string, { codeVariete: string; nomVariete: string; codeGen: string; codeEspece: string; total: number }>()
              siteStocks.forEach(r => {
                const existing = varMap.get(r.codeVariete)
                if (existing) existing.total += Number(r.quantiteTotale)
                else varMap.set(r.codeVariete, { codeVariete: r.codeVariete, nomVariete: r.nomVariete, codeGen: r.codeGeneration, codeEspece: r.codeEspece, total: Number(r.quantiteTotale) })
              })
              const varieties = Array.from(varMap.values()).sort((a, b) => b.total - a.total)

              /* Distance depuis la position du viewer */
              const km = userPos ? distKm(userPos[0], userPos[1], m.latitude, m.longitude) : null

              return (
                <Marker
                  key={`membre-${m.username}`}
                  position={[m.latitude, m.longitude]}
                  icon={icon}
                >
                  <Popup minWidth={230} maxWidth={290}>
                    <div style={{ fontFamily: 'inherit', padding: '2px 0' }}>

                      {/* En-tête : avatar + nom + rôle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: `radial-gradient(circle at 38% 32%, ${lightenHex(color)}, ${color})`,
                          border: '2px solid #fff', boxShadow: `0 2px 6px ${color}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
                            <circle cx="12" cy="7.5" r="3.5"/>
                            <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/>
                          </svg>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', lineHeight: 1.2 }}>{m.nomComplet}</div>
                          <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, background: color + '18', color, borderRadius: 4, padding: '1px 6px', marginTop: 2 }}>
                            {label}
                          </span>
                        </div>
                      </div>

                      {/* Localisation */}
                      <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7, marginBottom: 4 }}>
                        <div>📍 {m.nomSite}{m.zoneCode ? ` · ZAE ${m.zoneCode}` : ''}</div>
                        <div>🏢 {m.nomOrganisation}</div>
                        {km !== null && (
                          <div style={{ color: '#2563eb', fontWeight: 600 }}>
                            ✈ {fmtDist(km)} de votre position
                          </div>
                        )}
                      </div>

                      {/* Stock par variété */}
                      {varieties.length > 0 && (
                        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 6, paddingTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                              Stock disponible
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>
                              {fmtKg(siteTotal)} · {varieties.length} variété{varieties.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          {varieties.slice(0, 4).map(v => (
                            <div key={v.codeVariete} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                              <div>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{v.nomVariete}</span>
                                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 5 }}>{v.codeEspece}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: GEN_COLORS[v.codeGen] || '#6b7280', background: (GEN_COLORS[v.codeGen] || '#6b7280') + '18', borderRadius: 3, padding: '1px 4px' }}>
                                  {v.codeGen}
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{fmtKg(v.total)}</span>
                              </div>
                            </div>
                          ))}
                          {varieties.length > 4 && (
                            <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right', marginTop: 3 }}>
                              +{varieties.length - 4} autre{varieties.length - 4 > 1 ? 's' : ''} variété{varieties.length - 4 > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bouton Contacter */}
                      <ClusterContactBtn username={m.username} color={color} />

                    </div>
                  </Popup>
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
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acteurs visibles :</span>
        {Object.entries(ROLE_LABELS)
          .filter(([role]) => {
            const visible: Record<string, string[]> = {
              'seed-admin':        ['seed-selector','seed-upsemcl','seed-multiplicator','seed-quotataire'],
              'seed-upsemcl':      ['seed-selector','seed-multiplicator','seed-quotataire'],
              'seed-selector':     ['seed-upsemcl','seed-multiplicator','seed-quotataire'],
              'seed-multiplicator':['seed-upsemcl','seed-quotataire'],
              'seed-quotataire':   ['seed-multiplicator'],
            }
            return (visible[roleKey] ?? []).includes(role)
          })
          .map(([role, label]) => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: `radial-gradient(circle at 38% 32%, ${lightenHex(ROLE_COLORS[role])}, ${ROLE_COLORS[role]})`,
                border: '2px solid #fff', boxShadow: `0 1px 4px ${ROLE_COLORS[role]}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/></svg>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
      </div>
    </div>
  )
}
