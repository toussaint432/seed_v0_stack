/* ═══════════════════════════════════════════════════════════════
   MapCatalogue — Vue carte du catalogue R1/R2 pour les quotataires
   Objectif : visualiser les stocks disponibles par site/ZAE,
              localiser les fournisseurs proches, commander depuis la carte.
   ═══════════════════════════════════════════════════════════════ */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, GeoJSON, Tooltip, Circle, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { PathOptions } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin, Navigation, Star, Package, ShoppingCart, CheckCircle2,
  MessageCircle, X, Layers, Filter,
} from 'lucide-react'
import {
  ZAE_COLORS, ZAE_DISPLAY, SITE_TO_ZAE, SENEGAL_ZAE_GEOJSON,
} from '../data/senegal-zae'

/* ── Types (identiques à CataloguePublic) ── */
interface CatalogueItem {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; codeEspece: string
  lotId: number; codeLot: string; generation: string; campagne: string
  tauxGermination: number; quantiteDisponible: number; unite: string
  siteId: number; nomSite: string; region: string
  organisationId: number; nomOrganisation: string
  latitude: number; longitude: number
  niveauAdaptation: string | null
  distanceKm?: number
  nomComplet?: string
  telephone?: string
  localite?: string
  departement?: string
}
interface CartItem {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; idGeneration: number; generation: string
  quantite: number; unite: string; disponible: number
}
interface ZoneAgro { id: number; code: string; nom: string }
interface Espece    { id: number; codeEspece: string; nomCommun: string }

interface SiteGroup {
  siteId: number; nomSite: string; region: string
  lat: number; lng: number
  orgId: number; orgNom: string
  nomComplet?: string
  telephone?: string
  localite?: string
  departement?: string
  stockTotal: number; lots: CatalogueItem[]
  zaeCode: string | null
  distanceKm?: number
}

interface CurrentUser {
  nomComplet: string
  telephone: string
  localite: string
  roleKey: string
  nomOrganisation: string
  latitude?: number
  longitude?: number
}

interface Props {
  catalogue:      CatalogueItem[]
  zones:          ZoneAgro[]
  selectedEspece: Espece | null
  selectedZone:   ZoneAgro | null
  cart:           CartItem[]
  /* Coordonnées GPS obtenues par auto-géoloc dans CataloguePublic */
  userCoords?:    [number, number] | null
  /* Indique si on est en mode "proximité toutes espèces" */
  geoMode?:       boolean
  proximiteCount?: number
  /* Profil de l'utilisateur connecté, pour le panneau "Votre position" */
  currentUser?:   CurrentUser
  onAddToCart:    (item: CatalogueItem, qty: number) => void
  onContacter:    (orgId: number) => Promise<void>
  onSelectZone:   (z: ZoneAgro | null) => void
}

const NIVEAU_CFG: Record<string, { label: string; color: string; bg: string }> = {
  OPTIMAL:    { label: 'Zone optimale',   color: '#16a34a', bg: '#f0fdf4' },
  ACCEPTABLE: { label: 'Zone acceptable', color: '#d97706', bg: '#fffbeb' },
  MARGINALE:  { label: 'Zone marginale',  color: '#ea580c', bg: '#fff7ed' },
}

/* ── Icône user (cercle bleu personnalisé) ── */
const USER_ICON = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb40"></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

/* ── Distance Haversine (km) entre deux coordonnées GPS ── */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/* ── Icône personnage multiplicateur (DivIcon SVG) ── */
function createMultiplicateurIcon(orgNom: string, stockTotal: number, maxStock: number, isSelected: boolean): L.DivIcon {
  const ratio = Math.sqrt(Math.max(stockTotal, 1) / Math.max(maxStock, 1))
  const cs = Math.round(30 + 18 * ratio)
  const color = isSelected ? '#1d4ed8' : '#15803d'
  const light = isSelected ? '#60a5fa' : '#4ade80'
  const ring  = isSelected ? '#93c5fd' : '#86efac'
  const name  = orgNom.length > 22 ? orgNom.slice(0, 20) + '…' : orgNom
  const svgS  = Math.round(cs * 0.52)
  const html  = `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
    <div style="
      width:${cs}px;height:${cs}px;border-radius:50%;
      background:radial-gradient(circle at 38% 32%,${light},${color});
      border:2.5px solid #fff;
      box-shadow:0 3px 12px ${color}55,0 0 0 2px ${ring},inset 0 1px 0 rgba(255,255,255,0.35);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="${svgS}" height="${svgS}" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="7.5" r="3.5"/>
        <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7H5z"/>
      </svg>
    </div>
    <div style="
      background:rgba(255,255,255,0.97);border:1.5px solid ${color}55;border-radius:5px;
      padding:2px 7px;font-size:9.5px;font-weight:700;white-space:nowrap;margin-top:3px;
      color:${color};box-shadow:0 1px 5px rgba(0,0,0,0.18);
      max-width:150px;overflow:hidden;text-overflow:ellipsis;
    ">${name}</div>
  </div>`
  return L.divIcon({ html, className: '', iconSize: [160, cs + 28], iconAnchor: [80, Math.round(cs / 2)] })
}

/* ── Centrage auto (position utilisateur ou centroïde de zone) ── */
function FlyTo({ pos, zoom = 9 }: { pos: [number, number] | null; zoom?: number }) {
  const map = useMap()
  if (pos) map.flyTo(pos, zoom, { animate: true, duration: 1.2 })
  return null
}

/* ────────────────────────────────────────────
   Composant principal
──────────────────────────────────────────── */
export function MapCatalogue({ catalogue, zones, selectedEspece, selectedZone, cart, userCoords, geoMode, proximiteCount, currentUser, onAddToCart, onContacter, onSelectZone }: Props) {

  /* ── État ── */
  const [selectedSite,   setSelectedSite]   = useState<SiteGroup | null>(null)
  const [showUserPanel,  setShowUserPanel]  = useState(false)
  const [geoLabel,       setGeoLabel]       = useState<string | null>(null)
  const [userPos,        setUserPos]         = useState<[number, number] | null>(null)
  const [geoLoading,     setGeoLoading]      = useState(false)
  const [geoError,       setGeoError]        = useState<string | null>(null)
  const [flyTarget,      setFlyTarget]       = useState<[number, number] | null>(null)
  const [flyZoom,        setFlyZoom]         = useState<number>(9)
  const [showDistRings,  setShowDistRings]   = useState(false)
  const [showZAE,        setShowZAE]         = useState(true)
  const [qtyInputs,      setQtyInputs]       = useState<Record<number, string>>({})
  const [addedIds,       setAddedIds]        = useState<Set<number>>(new Set())
  const [contactingOrg,  setContactingOrg]   = useState<number | null>(null)

  /* Synchronise la position utilisateur transmise par le parent (auto-géoloc) */
  useEffect(() => {
    if (userCoords) {
      setUserPos(userCoords)
      setFlyTarget(userCoords)
      setFlyZoom(9)
      setShowDistRings(true)
    }
  }, [userCoords])

  /* Reverse geocoding Nominatim : donne un nom de lieu lisible si currentUser.localite est vide */
  useEffect(() => {
    if (!userPos) return
    /* Priorité : localité connue en base */
    if (currentUser?.localite && currentUser.localite.trim() !== '') {
      setGeoLabel(currentUser.localite.trim())
      return
    }
    /* Fallback : appel Nominatim (1 req max par position) */
    const controller = new AbortController()
    const [lat, lng] = userPos
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
      { signal: controller.signal, headers: { 'User-Agent': 'SenJiw/1.0 (ISRA CNRA Bambey)' } }
    )
      .then(r => {
        if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`)
        return r.json()
      })
      .then((d: { address?: Record<string, string> }) => {
        const a = d.address ?? {}
        const lieu = a.village || a.town || a.city || a.municipality || ''
        const zone = a.county || a.state_district || a.state || ''
        setGeoLabel(lieu && zone ? `${lieu}, ${zone}` : lieu || zone || 'Localisation obtenue')
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          console.warn('[MapCatalogue] Reverse geocoding échoué :', err)
          setGeoLabel(null)
        }
      })
    return () => controller.abort()
  }, [userPos, currentUser?.localite])

  /* Quand une zone est sélectionnée depuis la liste, centrer la carte sur son centroïde */
  useEffect(() => {
    if (!selectedZone) return
    const feature = SENEGAL_ZAE_GEOJSON.features.find(
      f => f.properties.code === selectedZone.code
    )
    if (!feature) return
    try {
      const center = L.geoJSON(feature).getBounds().getCenter()
      setFlyTarget([center.lat, center.lng])
      setFlyZoom(8)
    } catch {
      /* feature invalide — on ne vole pas, pas d'erreur silencieuse */
      console.warn('[MapCatalogue] Impossible de calculer le centroïde pour la zone', selectedZone.code)
    }
  }, [selectedZone])

  /* ── Grouper par site (depuis les données catalogue chargées) ── */
  const sites = useMemo<SiteGroup[]>(() => {
    const map = new Map<number, SiteGroup>()
    for (const item of catalogue) {
      if (!item.latitude || !item.longitude) continue
      const ex = map.get(item.siteId)
      if (!ex) {
        /* Cherche le code ZAE via le nom du site (matching approximatif) */
        const siteKey  = Object.keys(SITE_TO_ZAE).find(k => item.nomSite?.toUpperCase().includes(k.toUpperCase().split('-')[0]))
        const zaeCode  = siteKey ? SITE_TO_ZAE[siteKey] : null
        map.set(item.siteId, {
          siteId:      item.siteId,
          nomSite:     item.nomSite,
          region:      item.region,
          lat:         item.latitude,
          lng:         item.longitude,
          orgId:       item.organisationId,
          orgNom:      item.nomOrganisation,
          nomComplet:  item.nomComplet,
          telephone:   item.telephone ?? undefined,
          localite:    item.localite ?? undefined,
          departement: item.departement ?? undefined,
          stockTotal:  item.quantiteDisponible,
          lots:        [item],
          zaeCode,
          distanceKm:  item.distanceKm,
        })
      } else {
        ex.stockTotal += item.quantiteDisponible
        ex.lots.push(item)
        if (item.distanceKm != null && (ex.distanceKm == null || item.distanceKm < ex.distanceKm)) {
          ex.distanceKm = item.distanceKm
        }
      }
    }
    /* Trier par distance si disponible, sinon par stock */
    return Array.from(map.values()).sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm
      return b.stockTotal - a.stockTotal
    })
  }, [catalogue])

  const maxStock = useMemo(() => Math.max(...sites.map(s => s.stockTotal), 1), [sites])

  /* ── Style polygone ZAE ── */
  const zaeStyle = useCallback((feature: any): PathOptions => {
    const code  = feature?.properties?.code
    const hasSite = sites.some(s => s.zaeCode === code)
    return {
      fillColor:   ZAE_COLORS[code] || '#6b7280',
      fillOpacity: hasSite ? 0.13 : 0.04,
      color:       hasSite ? (ZAE_COLORS[code] || '#6b7280') : '#9ca3af',
      weight:      hasSite ? 1.5 : 0.8,
      dashArray:   '5 4',
    }
  }, [sites])

  /* ── Géolocalisation ── */
  function locateUser() {
    if (!navigator.geolocation) { setGeoError('Géolocalisation non supportée'); return }
    setGeoLoading(true); setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserPos(coords)
        setFlyTarget(coords)
        setFlyZoom(9)
        setShowDistRings(true)
        setGeoLoading(false)
      },
      () => { setGeoError('Localisation refusée'); setGeoLoading(false) }
    )
  }

  /* ── Ajout panier simplifié depuis la carte ── */
  function handleAdd(lot: CatalogueItem) {
    const qty = Number(qtyInputs[lot.varieteId] || 500)
    onAddToCart(lot, qty)
    setAddedIds(prev => { const s = new Set(prev); s.add(lot.varieteId); return s })
    setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(lot.varieteId); return s }), 2000)
    setQtyInputs(prev => ({ ...prev, [lot.varieteId]: '' }))
  }

  async function handleContact(orgId: number) {
    setContactingOrg(orgId)
    await onContacter(orgId).catch(() => {})
    setContactingOrg(null)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ══════════════════ CARTE (gauche) ══════════════════ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Barre de contrôle superposée */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 800,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* Localisation */}
          <button
            onClick={locateUser}
            disabled={geoLoading}
            title="Me localiser"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: userPos ? '#eff6ff' : 'var(--surface)',
              color: userPos ? '#1d4ed8' : 'var(--text-primary)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}>
            <Navigation size={13} style={{ animation: geoLoading ? 'spin 1s linear infinite' : 'none' }} />
            {geoLoading ? 'Localisation…' : userPos ? 'Position active' : 'Me localiser'}
          </button>

          {/* Cercles de distance */}
          {userPos && (
            <button
              onClick={() => setShowDistRings(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 11,
                background: showDistRings ? '#eff6ff' : 'var(--surface)',
                color: showDistRings ? '#1d4ed8' : 'var(--text-secondary)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}>
              <Layers size={12} /> Rayons 50/100/200 km
            </button>
          )}

          {/* Toggle zones */}
          <button
            onClick={() => setShowZAE(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
              borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 11,
              background: showZAE ? '#f0fdf4' : 'var(--surface)',
              color: showZAE ? '#16a34a' : 'var(--text-secondary)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
            <Filter size={12} /> Zones ZAE
          </button>
        </div>

        {/* Erreur géoloc */}
        {geoError && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 900, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={12} /> {geoError}
          </div>
        )}

        {/* Bandeau informatif : inviter à sélectionner une espèce uniquement si aucune donnée n'est affichée */}
        {!selectedEspece && catalogue.length === 0 && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 800,
            background: 'rgba(255,255,255,0.94)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 18px', fontSize: 12, color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 7, backdropFilter: 'blur(6px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <Filter size={13} color="#16a34a" />
            Sélectionnez une espèce dans la barre de gauche pour voir les stocks disponibles
          </div>
        )}

        {/* Bandeau mode proximité : récapitulatif en bas de carte */}
        {geoMode && catalogue.length > 0 && !selectedEspece && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 800,
            background: 'rgba(255,255,255,0.96)', border: '1px solid #bfdbfe',
            borderRadius: 10, padding: '8px 16px', fontSize: 12, color: '#1e40af',
            display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(6px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <Navigation size={13} color="#2563eb" />
            <strong>{proximiteCount ?? catalogue.length}</strong> lots disponibles dans un rayon de 200 km · triés par distance
          </div>
        )}

        <MapContainer
          center={[14.4, -14.5]}
          zoom={6}
          minZoom={5}
          maxZoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
            subdomains="abcd"
            maxZoom={20}
          />

          {/* Clic pour recentrer */}
          {flyTarget && <FlyTo pos={flyTarget} zoom={flyZoom} />}

          {/* ── Couche 1 : Polygones ZAE ── */}
          {showZAE && (
            <GeoJSON
              key={`zae-cat-${catalogue.length}`}
              data={SENEGAL_ZAE_GEOJSON as any}
              style={zaeStyle}
              onEachFeature={(feature, layer) => {
                const code = feature?.properties?.code
                const hasSite = sites.some(s => s.zaeCode === code)
                layer.bindTooltip(
                  `<div style="text-align:center"><strong>${ZAE_DISPLAY[code] || code}</strong>${hasSite ? '<br/><span style="color:#16a34a;font-size:11px">Stock disponible</span>' : ''}</div>`,
                  { direction: 'center', className: 'map-tooltip' }
                )
                /* Clic sur zone → filtre le catalogue */
                layer.on('click', () => {
                  const matched = zones.find(z => z.code === code || z.nom?.toLowerCase().includes(code.toLowerCase()))
                  if (matched) onSelectZone(selectedZone?.id === matched.id ? null : matched)
                })
              }}
            />
          )}

          {/* ── Couche 2 : Cercles de distance autour de l'utilisateur ── */}
          {userPos && showDistRings && [50000, 100000, 200000].map(r => (
            <Circle
              key={r}
              center={userPos}
              radius={r}
              pathOptions={{ fillOpacity: 0, color: '#2563eb', weight: 1, dashArray: '6 5', opacity: 0.35 }}
            />
          ))}

          {/* ── Couche 3 : Position utilisateur ──
               userPos (GPS navigateur) en priorité, sinon position du site en BDD ── */}
          {(() => {
            const autoPos: [number, number] | null =
              currentUser?.latitude && currentUser?.longitude
                ? [currentUser.latitude, currentUser.longitude]
                : null
            const displayPos = userPos ?? autoPos
            if (!displayPos) return null
            return (
              <Marker
                position={displayPos}
                icon={USER_ICON}
                eventHandlers={{ click: () => { setShowUserPanel(true); setSelectedSite(null) } }}
              >
                <Tooltip permanent direction="top" offset={[0, -12]}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>
                    {currentUser?.nomComplet || 'Votre position'} — cliquez pour les détails
                  </span>
                </Tooltip>
              </Marker>
            )
          })()}

          {/* ── Couche 4 : Multiplicateurs (icône personnage + popup enrichi) ── */}
          {sites.map((site) => {
            const isSelected  = selectedSite?.siteId === site.siteId
            const icon        = createMultiplicateurIcon(site.nomComplet || site.orgNom, site.stockTotal, maxStock, isSelected)
            const uniqueVar   = new Set(site.lots.map(l => l.varieteId)).size
            const travelHours = site.distanceKm != null ? Math.round(site.distanceKm / 50) : null
            /* Agréger les lots par variété pour afficher le stock total par variété */
            const varAggMap = new Map<number, { lot: CatalogueItem; stockTotal: number }>()
            for (const l of site.lots) {
              const ex = varAggMap.get(l.varieteId)
              if (!ex) varAggMap.set(l.varieteId, { lot: l, stockTotal: l.quantiteDisponible })
              else { ex.stockTotal += l.quantiteDisponible; if (l.tauxGermination > ex.lot.tauxGermination) ex.lot = l }
            }
            const allVarietes = Array.from(varAggMap.values()).sort((a, b) => b.stockTotal - a.stockTotal)

            return (
              <Marker
                key={site.siteId}
                position={[site.lat, site.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    setSelectedSite(site)
                    setShowUserPanel(false)
                    setFlyTarget([site.lat, site.lng])
                    setFlyZoom(9)
                  },
                }}
              >
                <Popup maxWidth={296} minWidth={256} className="seed-popup">
                  <div style={{ fontFamily: 'system-ui,-apple-system,sans-serif', margin: '-14px -14px -10px' }}>

                    {/* ── En-tête ── */}
                    <div style={{ padding: '12px 14px 10px', background: isSelected ? '#eff6ff' : '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0d1f11', flex: 1, lineHeight: 1.3 }}>{site.nomComplet || site.orgNom}</div>
                        <span style={{ fontSize: 9, fontWeight: 700, background: isSelected ? '#dbeafe' : '#dcfce7', color: isSelected ? '#1d4ed8' : '#15803d', padding: '2px 6px', borderRadius: 4, border: `1px solid ${isSelected ? '#bfdbfe' : '#bbf7d0'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          Multiplicateur agréé
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <MapPin size={10} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <span>{site.region}</span>
                        {site.zaeCode && (
                          <span style={{ background: '#f0f4f0', border: '1px solid #d1d5db', padding: '1px 5px', borderRadius: 3, fontSize: 10, color: '#374151' }}>
                            ZAE {site.zaeCode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Distance ── */}
                    {site.distanceKm != null && (
                      <div style={{ padding: '7px 14px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Navigation size={12} style={{ color: '#2563eb', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>{Math.round(site.distanceKm)} km</span>
                        <span style={{ fontSize: 10.5, color: '#4b5563' }}>de votre position</span>
                        {travelHours != null && (
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
                            ~{travelHours} h de route
                          </span>
                        )}
                      </div>
                    )}

                    {/* ── Variétés — formulaire par variété ── */}
                    <div style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ padding: '9px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Package size={11} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>
                          {site.stockTotal.toLocaleString('fr-FR')} kg disponibles
                        </span>
                        <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>
                          {uniqueVar} variété{uniqueVar > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto' }}>
                        {allVarietes.map(({ lot: l, stockTotal: vTotal }) => {
                          const inCartV  = cart.find(c => c.varieteId === l.varieteId)
                          const isAddedV = addedIds.has(l.varieteId)
                          return (
                            <div key={l.varieteId} style={{ background: inCartV ? '#f0fdf4' : '#f9fafb', borderRadius: 7, padding: '7px 8px', border: `1px solid ${inCartV ? '#bbf7d0' : '#e5e7eb'}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                                <span style={{ flex: 1, fontWeight: 600, fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nomVariete}</span>
                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: 3, fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{l.generation}</span>
                                {l.tauxGermination > 0 && (
                                  <span style={{ color: '#d97706', fontSize: 10, flexShrink: 0 }}>☆{l.tauxGermination}%</span>
                                )}
                                <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 10, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{vTotal.toLocaleString('fr-FR')} kg</span>
                              </div>
                              {inCartV && (
                                <div style={{ fontSize: 10, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                                  <CheckCircle2 size={9} /> {inCartV.quantite.toLocaleString('fr-FR')} kg dans le panier
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 4 }}>
                                <input
                                  type="number" min="1" placeholder="Qté (kg)"
                                  value={qtyInputs[l.varieteId] ?? ''}
                                  onChange={e => setQtyInputs(prev => ({ ...prev, [l.varieteId]: e.target.value }))}
                                  style={{ flex: 1, height: 27, borderRadius: 5, border: '1px solid #d1d5db', padding: '0 6px', fontSize: 10.5 }}
                                />
                                <button
                                  onClick={() => handleAdd(l)}
                                  style={{ height: 27, padding: '0 9px', borderRadius: 5, border: 'none', cursor: 'pointer', background: isAddedV ? '#15803d' : '#16a34a', color: '#fff', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, transition: 'background 0.15s' }}>
                                  {isAddedV ? <><CheckCircle2 size={9} /> Ajouté!</> : <><ShoppingCart size={9} /> Ajouter</>}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── Actions ── */}
                    <div style={{ padding: '10px 14px' }}>
                      <button onClick={() => handleContact(site.orgId)} disabled={contactingOrg === site.orgId}
                        style={{ width: '100%', height: 32, borderRadius: 7, border: 'none', cursor: contactingOrg === site.orgId ? 'wait' : 'pointer', background: contactingOrg === site.orgId ? '#9ca3af' : '#2563eb', color: '#fff', fontWeight: 700, fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <MessageCircle size={12} />
                        {contactingOrg === site.orgId ? 'Connexion…' : 'Envoyer un message'}
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {/* Légende bas de carte */}
        <div style={{
          position: 'absolute', bottom: 14, right: 14, zIndex: 800,
          background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', fontSize: 11, backdropFilter: 'blur(6px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>Sites</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a' }} />
            <span>Stock disponible</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1d4ed8' }} />
            <span>Site sélectionné</span>
          </div>
          {userPos && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', border: '2px solid #fff', boxShadow: '0 0 0 1.5px #2563eb40' }} />
              <span>Votre position</span>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ PANNEAU DROIT ══════════════════ */}
      <div style={{
        width: 340, flexShrink: 0,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* ── En-tête panneau ── */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
          {showUserPanel ? (
            /* ── Panneau Votre position ── */
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2563eb', border: '3px solid #fff', boxShadow: '0 0 0 2px #2563eb40', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {currentUser ? currentUser.nomComplet.slice(0, 2).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {currentUser?.nomComplet || 'Utilisateur'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {({
                        'seed-quotataire':    'Quotataire / OP',
                        'seed-multiplicator': 'Multiplicateur agréé',
                        'seed-selector':      'Sélectionneur',
                        'seed-upsemcl':       'UPSemCL',
                        'seed-admin':         'Administrateur ISRA',
                      } as Record<string, string>)[currentUser?.roleKey ?? ''] ?? 'Utilisateur'}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowUserPanel(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}>
                  <X size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                {currentUser?.nomOrganisation && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                    <Package size={11} style={{ flexShrink: 0 }} />
                    <span>{currentUser.nomOrganisation}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                  <MapPin size={11} style={{ flexShrink: 0 }} />
                  <span>
                    {geoLabel === null
                      ? 'Localisation en cours…'
                      : geoLabel || 'Localisation inconnue'}
                  </span>
                </div>
                {currentUser?.telephone && currentUser.telephone.trim() !== '' ? (
                  <a href={`tel:${currentUser.telephone}`}
                     style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                    <span style={{ fontSize: 13 }}>📞</span>
                    <span>{currentUser.telephone}</span>
                  </a>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Téléphone non renseigné</div>
                )}
                {proximiteCount != null && proximiteCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803d', fontWeight: 600 }}>
                    <Navigation size={11} style={{ flexShrink: 0 }} />
                    <span>{proximiteCount} multiplicateur{proximiteCount > 1 ? 's' : ''} à moins de 200 km</span>
                  </div>
                )}
              </div>
            </>
          ) : selectedSite ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {selectedSite.nomComplet || selectedSite.nomSite}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {selectedSite.orgNom}
                    {selectedSite.distanceKm != null && (() => {
                      const km = Math.round(selectedSite.distanceKm)
                      const dc = distBadge(km)
                      const h  = Math.ceil(km / 50)
                      return (
                        <span style={{ marginLeft: 6, background: dc.bg, color: dc.color, border: `1px solid ${dc.border}`, padding: '1px 7px', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Navigation size={9} /> {km} km · ~{h}h
                        </span>
                      )
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSite(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', flexShrink: 0 }}>
                  <X size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#16a34a', fontWeight: 600, background: '#f0fdf4', padding: '2px 8px', borderRadius: 99, border: '1px solid #bbf7d0' }}>
                  <Package size={10} /> {selectedSite.stockTotal.toLocaleString('fr-FR')} kg dispo
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>
                  <MapPin size={10} /> {selectedSite.localite ? `${selectedSite.localite}, ` : ''}{selectedSite.departement || selectedSite.region}
                </span>
                {selectedSite.telephone && (
                  <a href={`tel:${selectedSite.telephone}`}
                     style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#2563eb', fontWeight: 600, background: '#eff6ff', padding: '2px 8px', borderRadius: 99, border: '1px solid #bfdbfe', textDecoration: 'none' }}
                     title="Appeler ce multiplicateur">
                    📞 {selectedSite.telephone}
                  </a>
                )}
              </div>

              {/* Bouton contacter */}
              <button
                onClick={() => handleContact(selectedSite.orgId)}
                disabled={contactingOrg === selectedSite.orgId}
                style={{ width: '100%', height: 32, marginTop: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: contactingOrg === selectedSite.orgId ? '#9ca3af' : '#16a34a', color: '#fff', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <MessageCircle size={13} />
                {contactingOrg === selectedSite.orgId ? 'Connexion…' : 'Contacter ce fournisseur'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>
                {selectedEspece
                  ? selectedEspece.nomCommun
                  : geoMode
                    ? 'Multiplicateurs près de vous'
                    : 'Fournisseurs disponibles'
                }
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {sites.length > 0
                  ? geoMode && !selectedEspece
                    ? `${sites.length} site${sites.length > 1 ? 's' : ''} · triés par distance`
                    : `${sites.length} site${sites.length > 1 ? 's' : ''} · cliquez sur un marqueur`
                  : selectedEspece
                    ? 'Aucun stock disponible pour cette espèce'
                    : geoMode
                      ? 'Aucun multiplicateur dans ce rayon'
                      : 'Sélectionnez une espèce pour voir les sites'
                }
              </div>
              {geoMode && sites.length > 0 && !selectedEspece && (
                <div style={{ fontSize: 10.5, color: '#2563eb', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Navigation size={10} />
                  Rayon 200 km · triés par distance
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Contenu panneau ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {selectedSite ? (
            /* ── Lots du site sélectionné ── */
            <SiteLots
              site={selectedSite}
              cart={cart}
              qtyInputs={qtyInputs}
              addedIds={addedIds}
              onQtyChange={(id, val) => setQtyInputs(prev => ({ ...prev, [id]: val }))}
              onAdd={handleAdd}
            />
          ) : sites.length > 0 ? (
            /* ── Liste des sites (triés distance/stock) ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sites.map(site => (
                <SiteCard
                  key={site.siteId}
                  site={site}
                  isSelected={selectedSite?.siteId === site.siteId}
                  onClick={() => { setSelectedSite(site); setShowUserPanel(false); setFlyTarget([site.lat, site.lng]); setFlyZoom(9) }}
                />
              ))}
            </div>
          ) : !selectedEspece ? (
            /* ── État vide : aucune espèce sélectionnée ── */
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🗺️</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Explorez la carte
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                Sélectionnez une espèce dans la barre de gauche pour voir les fournisseurs disponibles sur la carte.
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Aucun site disponible
              </div>
              <div style={{ fontSize: 12 }}>
                {selectedZone ? `Aucun stock en ${selectedZone.nom}` : 'Aucun stock R1/R2 pour cette espèce'}
              </div>
            </div>
          )}
        </div>

        {/* ── Filtres zones dans le panneau ── */}
        {zones.length > 0 && !selectedSite && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>
                Filtrer par zone ZAE
              </span>
              {selectedZone && (
                <button onClick={() => onSelectZone(null)}
                  style={{ fontSize: 10, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit', textDecoration: 'underline' }}>
                  Réinitialiser
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {zones.map(z => {
                const isActive = selectedZone?.id === z.id
                const hasSite = sites.some(s => s.zaeCode === z.code)
                return (
                  <button
                    key={z.id}
                    onClick={() => hasSite ? onSelectZone(isActive ? null : z) : undefined}
                    title={hasSite ? z.nom : `${z.nom} — aucun stock disponible`}
                    style={{
                      padding: '3px 9px', borderRadius: 99, fontSize: 11, fontFamily: 'inherit',
                      cursor: hasSite ? 'pointer' : 'not-allowed',
                      background: isActive ? '#16a34a' : 'var(--surface)',
                      color: isActive ? '#fff' : hasSite ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      fontWeight: isActive ? 700 : 400,
                      opacity: hasSite ? 1 : 0.38,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                    {hasSite && !isActive && (
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                    )}
                    {z.nom}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes markerPulse {
          0%   { box-shadow: 0 0 0 0 rgba(22,163,74,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(22,163,74,0); }
          100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); }
        }
        .map-tooltip { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
        .map-tooltip::before { display: none; }
        /* Popup Leaflet custom : design épuré */
        .seed-popup .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.14) !important;
          border: 1px solid #e5e7eb !important;
          padding: 0 !important;
        }
        .seed-popup .leaflet-popup-content {
          margin: 14px 14px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        }
        .seed-popup .leaflet-popup-tip-container { display: none !important; }
        .seed-popup .leaflet-popup-close-button {
          top: 8px !important; right: 8px !important;
          color: #9ca3af !important; font-size: 18px !important;
        }
        .seed-popup .leaflet-popup-close-button:hover { color: #374151 !important; }
      `}</style>
    </div>
  )
}

function distBadge(km: number) {
  if (km < 80)  return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
  if (km < 150) return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' }
  return { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
}

/* ── Carte de site (liste des fournisseurs) ── */
function SiteCard({ site, isSelected, onClick }: { site: SiteGroup; isSelected: boolean; onClick: () => void }) {
  const uniqueVarietes = new Set(site.lots.map(l => l.varieteId)).size

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 10, padding: '11px 13px', cursor: 'pointer',
        background: isSelected ? '#f0fdf4' : 'var(--surface)',
        border: isSelected ? '1.5px solid #16a34a' : '1px solid var(--border)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{site.nomComplet || site.nomSite}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{site.orgNom}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>
            {site.stockTotal > 999 ? `${(site.stockTotal / 1000).toFixed(1)}t` : `${site.stockTotal}kg`}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>disponibles</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <MapPin size={9} /> {site.region}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
          · {uniqueVarietes} variété{uniqueVarietes > 1 ? 's' : ''}
        </span>
        {site.distanceKm != null && (() => {
          const km = Math.round(site.distanceKm)
          const dc = distBadge(km)
          const h  = Math.ceil(km / 50)
          return (
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, color: dc.color, background: dc.bg, border: `1px solid ${dc.border}`, padding: '1px 7px', borderRadius: 4 }}>
              <Navigation size={9} /> {km} km · ~{h}h
            </span>
          )
        })()}
      </div>
    </div>
  )
}

/* ── Lots détaillés du site sélectionné ── */
function SiteLots({ site, cart, qtyInputs, addedIds, onQtyChange, onAdd }: {
  site: SiteGroup
  cart: CartItem[]
  qtyInputs: Record<number, string>
  addedIds: Set<number>
  onQtyChange: (id: number, val: string) => void
  onAdd: (lot: CatalogueItem) => void
}) {
  /* Agréger par variété — somme de tous les lots, lot le plus frais comme représentant */
  const byVariete = useMemo(() => {
    const map = new Map<number, { lot: CatalogueItem; stockTotal: number }>()
    for (const lot of site.lots) {
      const ex = map.get(lot.varieteId)
      if (!ex) {
        map.set(lot.varieteId, { lot, stockTotal: lot.quantiteDisponible })
      } else {
        ex.stockTotal += lot.quantiteDisponible
        if (lot.tauxGermination > ex.lot.tauxGermination) ex.lot = lot
      }
    }
    return Array.from(map.values()).sort((a, b) => b.stockTotal - a.stockTotal)
  }, [site.lots])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 0 6px' }}>
        {byVariete.length} variété{byVariete.length > 1 ? 's' : ''} disponibles
      </div>

      {byVariete.map(({ lot, stockTotal }) => {
        const inCart  = cart.find(c => c.varieteId === lot.varieteId)
        const isAdded = addedIds.has(lot.varieteId)
        const nCfg    = lot.niveauAdaptation ? NIVEAU_CFG[lot.niveauAdaptation] : null

        return (
          <div key={lot.varieteId} style={{ background: inCart ? '#f0fdf4' : 'var(--surface-2)', borderRadius: 10, padding: '11px 12px', border: inCart ? '1.5px solid #16a34a' : '1px solid var(--border)' }}>
            {/* Nom variété */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{lot.nomVariete}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{lot.codeVariete} · {lot.nomEspece}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, marginLeft: 8 }}>
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 5, fontWeight: 700, fontSize: 11 }}>{lot.generation}</span>
                {nCfg && (
                  <span style={{ background: nCfg.bg, color: nCfg.color, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                    {nCfg.label}
                  </span>
                )}
              </div>
            </div>

            {/* Méta */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                {stockTotal.toLocaleString('fr-FR')} kg
              </span>
              {lot.tauxGermination > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#d97706' }}>
                  <Star size={10} /> {lot.tauxGermination}%
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lot.campagne}</span>
            </div>

            {/* Panier : présence */}
            {inCart && (
              <div style={{ background: '#dcfce7', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <CheckCircle2 size={11} /> {inCart.quantite.toLocaleString('fr-FR')} kg dans le panier
              </div>
            )}

            {/* Saisie quantité */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number" min="1"
                value={qtyInputs[lot.varieteId] ?? ''}
                onChange={e => onQtyChange(lot.varieteId, e.target.value)}
                placeholder="Qté (kg)"
                style={{ flex: 1, height: 32, borderRadius: 7, border: '1px solid var(--border)', padding: '0 8px', fontSize: 12, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => onAdd(lot)}
                style={{ height: 32, padding: '0 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: isAdded ? '#15803d' : '#16a34a', color: '#fff', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', transition: 'background 0.15s', flexShrink: 0 }}>
                {isAdded ? <><CheckCircle2 size={12} /> Ajouté!</> : <><ShoppingCart size={12} /> Ajouter</>}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
