/* ═══════════════════════════════════════════════════════════════
   MapCatalogue — Vue carte du catalogue R1/R2 pour les quotataires
   Objectif : visualiser les stocks disponibles par site/ZAE,
              localiser les fournisseurs proches, commander depuis la carte.
   ═══════════════════════════════════════════════════════════════ */
import { useState, useMemo, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, GeoJSON, Tooltip, Circle, Marker, useMap } from 'react-leaflet'
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
  stockTotal: number; lots: CatalogueItem[]
  zaeCode: string | null
  distanceKm?: number
}

interface Props {
  catalogue:      CatalogueItem[]
  zones:          ZoneAgro[]
  selectedEspece: Espece | null
  selectedZone:   ZoneAgro | null
  cart:           CartItem[]
  onAddToCart:    (item: CatalogueItem, qty: number) => void
  onContacter:    (orgId: number) => Promise<void>
  onSelectZone:   (z: ZoneAgro | null) => void
}

const GEN_ID: Record<string, number> = { G0:1, G1:2, G2:3, G3:4, G4:5, R1:6, R2:7 }

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

/* ── Centrage auto sur la position utilisateur ── */
function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap()
  if (pos) map.flyTo(pos, 9, { animate: true, duration: 1.2 })
  return null
}

/* ────────────────────────────────────────────
   Composant principal
──────────────────────────────────────────── */
export function MapCatalogue({ catalogue, zones, selectedEspece, selectedZone, cart, onAddToCart, onContacter, onSelectZone }: Props) {

  /* ── État ── */
  const [selectedSite,   setSelectedSite]   = useState<SiteGroup | null>(null)
  const [userPos,        setUserPos]         = useState<[number, number] | null>(null)
  const [geoLoading,     setGeoLoading]      = useState(false)
  const [geoError,       setGeoError]        = useState<string | null>(null)
  const [flyTarget,      setFlyTarget]       = useState<[number, number] | null>(null)
  const [showDistRings,  setShowDistRings]   = useState(false)
  const [showZAE,        setShowZAE]         = useState(true)
  const [qtyInputs,      setQtyInputs]       = useState<Record<number, string>>({})
  const [addedIds,       setAddedIds]        = useState<Set<number>>(new Set())
  const [contactingOrg,  setContactingOrg]   = useState<number | null>(null)

  const flyRef = useRef<[number, number] | null>(null)

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
          siteId:     item.siteId,
          nomSite:    item.nomSite,
          region:     item.region,
          lat:        item.latitude,
          lng:        item.longitude,
          orgId:      item.organisationId,
          orgNom:     item.nomOrganisation,
          stockTotal: item.quantiteDisponible,
          lots:       [item],
          zaeCode,
          distanceKm: item.distanceKm,
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

  /* ── Rayon de marqueur site ── */
  function siteRadius(stock: number): number {
    return 7 + 14 * Math.sqrt(stock / maxStock)
  }

  /* ── Couverture de stock par espèce ── */
  const especesDispoCount = useMemo(() => {
    const set = new Set(catalogue.map(c => c.codeEspece))
    return set.size
  }, [catalogue])

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

        {/* Message aucune espèce */}
        {!selectedEspece && (
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
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={20}
          />

          {/* Clic pour recentrer */}
          {flyTarget && <FlyTo pos={flyTarget} />}

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

          {/* ── Couche 3 : Position utilisateur ── */}
          {userPos && (
            <Marker position={userPos} icon={USER_ICON}>
              <Tooltip permanent direction="top" offset={[0, -12]}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>Votre position</span>
              </Tooltip>
            </Marker>
          )}

          {/* ── Couche 4 : Sites fournisseurs ── */}
          {sites.map(site => {
            const isSelected = selectedSite?.siteId === site.siteId
            const color      = isSelected ? '#1d4ed8' : '#16a34a'
            const radius     = siteRadius(site.stockTotal)
            return (
              <CircleMarker
                key={site.siteId}
                center={[site.lat, site.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color, fillOpacity: isSelected ? 0.92 : 0.78,
                  color: isSelected ? '#fff' : '#fff', weight: 2,
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedSite(site)
                    setFlyTarget([site.lat, site.lng])
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -radius]}>
                  <div style={{ lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{site.nomSite}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{site.orgNom} · {site.region}</div>
                    <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                      {site.stockTotal.toLocaleString('fr-FR')} kg dispo
                    </div>
                    {site.distanceKm != null && (
                      <div style={{ fontSize: 10, color: '#1d4ed8' }}>à {Math.round(site.distanceKm)} km</div>
                    )}
                  </div>
                </Tooltip>
              </CircleMarker>
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
          {selectedSite ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {selectedSite.nomSite}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {selectedSite.orgNom}
                    {selectedSite.distanceKm != null && (
                      <span style={{ marginLeft: 6, background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 4, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Navigation size={9} /> {Math.round(selectedSite.distanceKm)} km
                      </span>
                    )}
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
                  <MapPin size={10} /> {selectedSite.region}
                </span>
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
                {selectedEspece ? selectedEspece.nomCommun : 'Fournisseurs disponibles'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {sites.length > 0
                  ? `${sites.length} site${sites.length > 1 ? 's' : ''} · cliquez sur un marqueur`
                  : selectedEspece
                    ? 'Aucun stock disponible pour cette espèce'
                    : 'Sélectionnez une espèce pour voir les sites'
                }
              </div>
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
                  onClick={() => { setSelectedSite(site); setFlyTarget([site.lat, site.lng]) }}
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
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Filtrer par zone ZAE
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {zones.map(z => {
                const isActive = selectedZone?.id === z.id
                const zCode = z.code
                const hasSite = sites.some(s => s.zaeCode === zCode)
                return (
                  <button
                    key={z.id}
                    onClick={() => onSelectZone(isActive ? null : z)}
                    style={{
                      padding: '3px 9px', borderRadius: 99, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? '#16a34a' : hasSite ? 'var(--surface)' : 'var(--surface-3)',
                      color: isActive ? '#fff' : hasSite ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: isActive ? '1.5px solid #16a34a' : `1px solid ${hasSite ? 'var(--border)' : 'transparent'}`,
                      fontWeight: isActive ? 700 : 400,
                      opacity: hasSite ? 1 : 0.5,
                    }}>
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
        .map-tooltip { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
        .map-tooltip::before { display: none; }
      `}</style>
    </div>
  )
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
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{site.nomSite}</div>
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
        {site.distanceKm != null && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '1px 6px', borderRadius: 4 }}>
            <Navigation size={9} /> {Math.round(site.distanceKm)} km
          </span>
        )}
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
  /* Dédoublonner par variété (afficher la meilleure entrée) */
  const byVariete = useMemo(() => {
    const map = new Map<number, CatalogueItem>()
    for (const lot of site.lots) {
      const ex = map.get(lot.varieteId)
      if (!ex || lot.quantiteDisponible > ex.quantiteDisponible) map.set(lot.varieteId, lot)
    }
    return Array.from(map.values()).sort((a, b) => b.quantiteDisponible - a.quantiteDisponible)
  }, [site.lots])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 0 6px' }}>
        {byVariete.length} variété{byVariete.length > 1 ? 's' : ''} disponibles
      </div>

      {byVariete.map(lot => {
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
                {lot.quantiteDisponible.toLocaleString('fr-FR')} kg
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
