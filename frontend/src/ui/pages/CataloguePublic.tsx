import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  MapPin, Package, Star, Wheat, Leaf, Sprout,
  Navigation, MessageCircle, ShoppingCart, X, Trash2, CheckCircle2,
  Search, ChevronRight, RefreshCw, LucideIcon,
} from 'lucide-react'
import { MapCatalogue } from '../components/MapCatalogue'

/* ── Types ─────────────────────────────────────────────── */
interface Espece { id: number; codeEspece: string; nomCommun: string }

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
}

interface ZoneAgro { id: number; code: string; nom: string }

interface VarieteGroup {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; codeEspece: string; niveauAdaptation: string | null
  stockTotal: number; nombreFournisseurs: number
  tauxGerminationMoyen: number
  lots: CatalogueItem[]
}

interface CartItem {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; idGeneration: number; generation: string
  quantite: number; unite: string; disponible: number
}

type FournisseurEntry = {
  org: string; orgId: number; region: string; distanceKm?: number; lots: CatalogueItem[]
}

const CATALOG = 'http://localhost:18081/api'
const STOCK   = 'http://localhost:18083/api'
const ORDER   = 'http://localhost:18084/api'

const GEN_ID_MAP: Record<string, number> = { G0:1, G1:2, G2:3, G3:4, G4:5, R1:6, R2:7 }

const ESPECE_ICONS: Record<string, LucideIcon> = {
  default: Leaf,
  MIL: Wheat, SORGHO: Wheat, MAIS: Wheat, RIZ: Sprout,
  ARACHIDE: Sprout, NIEBE: Sprout, COWPEA: Sprout,
}

const NIVEAU_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPTIMAL:    { label: 'Zone optimale',   color: '#16a34a', bg: '#f0fdf4' },
  ACCEPTABLE: { label: 'Zone acceptable', color: '#d97706', bg: '#fffbeb' },
  MARGINALE:  { label: 'Zone marginale',  color: '#ea580c', bg: '#fff7ed' },
}

function groupByOrg(items: CatalogueItem[]): FournisseurEntry[] {
  const map = new Map<number, FournisseurEntry>()
  for (const l of items) {
    const ex = map.get(l.organisationId)
    if (!ex) map.set(l.organisationId, { org: l.nomOrganisation, orgId: l.organisationId, region: l.region, distanceKm: l.distanceKm, lots: [l] })
    else ex.lots.push(l)
  }
  return Array.from(map.values())
}

/* ── Composant principal ──────────────────────────────── */
export function CataloguePublic({ roleKey, token, onContacter }: { roleKey: string; token: string; onContacter?: () => void }) {
  const headers = { Authorization: `Bearer ${token}` }

  const [especes,   setEspeces]   = useState<Espece[]>([])
  const [zones,     setZones]     = useState<ZoneAgro[]>([])
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([])
  const [loading,   setLoading]   = useState(false)

  const [selectedEspece,  setSelectedEspece]  = useState<Espece | null>(null)
  const [selectedVariete, setSelectedVariete] = useState<VarieteGroup | null>(null)
  const [selectedZone,    setSelectedZone]    = useState<ZoneAgro | null>(null)
  const [search,          setSearch]          = useState('')

  const [showFournisseurs, setShowFournisseurs] = useState(false)
  const [showCart,         setShowCart]         = useState(false)

  const [geoMode,          setGeoMode]          = useState(false)
  const [proximiteItems,   setProximiteItems]   = useState<CatalogueItem[]>([])
  const [proximiteLoading, setProximiteLoading] = useState(false)
  const [proximiteError,   setProximiteError]   = useState<string | null>(null)
  const [contactingOrg,    setContactingOrg]    = useState<number | null>(null)
  /* Coordonnées GPS de l'utilisateur (obtenues automatiquement ou manuellement) */
  const [userCoords,       setUserCoords]       = useState<[number, number] | null>(null)

  const [cart,            setCart]            = useState<CartItem[]>([])
  const [qtyInputs,       setQtyInputs]       = useState<Record<number, string>>({})
  const [addedIds,        setAddedIds]        = useState<Set<number>>(new Set())
  const [sortBy,          setSortBy]          = useState<'stock' | 'distance' | 'germination'>('stock')
  const [orderObs,        setOrderObs]        = useState('')
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderFeedback,   setOrderFeedback]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  /* ── Vue liste / carte ── */
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  /* ── Horodatage du dernier refresh (pour l'indicateur "actualisé il y a Xs") ── */
  const [lastRefresh,  setLastRefresh]  = useState<Date>(new Date())
  const [refreshing,   setRefreshing]   = useState(false)
  const [refreshLabel, setRefreshLabel] = useState<string | null>(null)

  /* ── Cart actions ── */
  function addToCart(v: VarieteGroup) {
    const qty = Number(qtyInputs[v.varieteId] || 500)
    if (!qty || qty <= 0) return
    const r2 = v.lots.find(l => l.generation === 'R2')
    const r1 = v.lots.find(l => l.generation === 'R1')
    const best = r2 ?? r1 ?? v.lots[0]
    const gen = best?.generation ?? 'R2'
    if (roleKey === 'seed-quotataire' && gen !== 'R2') {
      setOrderFeedback({ msg: 'Seules les semences R2 peuvent être commandées par un Quotataire. Ce lot est en ' + gen + '.', type: 'error' })
      return
    }
    const idGen = GEN_ID_MAP[gen] ?? 7
    setCart(prev => {
      const existing = prev.find(c => c.varieteId === v.varieteId)
      if (existing) return prev.map(c => c.varieteId === v.varieteId ? { ...c, quantite: c.quantite + qty } : c)
      return [...prev, { varieteId: v.varieteId, nomVariete: v.nomVariete, codeVariete: v.codeVariete, nomEspece: v.nomEspece, idGeneration: idGen, generation: gen, quantite: qty, unite: 'kg', disponible: v.stockTotal }]
    })
    setAddedIds(prev => { const s = new Set(prev); s.add(v.varieteId); return s })
    setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(v.varieteId); return s }), 1800)
    setQtyInputs(prev => ({ ...prev, [v.varieteId]: '' }))
  }

  /* ── Ajout panier depuis la vue carte ── */
  function addToCartFromMap(lot: CatalogueItem, qty: number) {
    if (roleKey === 'seed-quotataire' && lot.generation !== 'R2') {
      setOrderFeedback({ msg: 'En tant que Quotataire, vous ne pouvez commander que des semences R2. Ce lot est en ' + lot.generation + '.', type: 'error' })
      return
    }
    const idGen = GEN_ID_MAP[lot.generation] ?? 7
    setCart(prev => {
      const existing = prev.find(c => c.varieteId === lot.varieteId)
      if (existing) return prev.map(c => c.varieteId === lot.varieteId ? { ...c, quantite: c.quantite + qty } : c)
      return [...prev, { varieteId: lot.varieteId, nomVariete: lot.nomVariete, codeVariete: lot.codeVariete, nomEspece: lot.nomEspece, idGeneration: idGen, generation: lot.generation, quantite: qty, unite: lot.unite || 'kg', disponible: lot.quantiteDisponible }]
    })
  }

  function removeFromCart(varieteId: number) {
    setCart(prev => prev.filter(c => c.varieteId !== varieteId))
  }

  function updateCartItemQty(varieteId: number, qty: number) {
    if (qty <= 0) { removeFromCart(varieteId); return }
    setCart(prev => prev.map(c => c.varieteId === varieteId ? { ...c, quantite: qty } : c))
  }

  async function submitCartOrder() {
    if (cart.length === 0 || submittingOrder) return
    setSubmittingOrder(true)
    setOrderFeedback(null)
    try {
      const code = 'CMD-' + Date.now().toString(36).toUpperCase()
      const resp = await fetch(`${ORDER}/orders`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeCommande: code, client: 'Commande catalogue',
          idOrganisationFournisseur: null, observations: orderObs || null,
          lignes: cart.map(item => ({ idVariete: item.varieteId, idGeneration: item.idGeneration, quantite: item.quantite, unite: item.unite })),
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error((err as any).message || `Erreur ${resp.status}`)
      }
      setCart([]); setOrderObs(''); setShowCart(false)
      setOrderFeedback({ msg: `Commande ${code} soumise — vous serez contacté pour la livraison.`, type: 'success' })
      setTimeout(() => setOrderFeedback(null), 7000)
    } catch (err: any) {
      setOrderFeedback({ msg: err?.message || 'Impossible de soumettre la commande', type: 'error' })
    } finally { setSubmittingOrder(false) }
  }

  async function handleContacter(orgId: number) {
    setContactingOrg(orgId)
    try {
      const membresResp = await fetch(`${ORDER}/membres/organisation/${orgId}`, { headers })
      const membres = await membresResp.json()
      const membre = membres.find((m: any) => m.keycloakRole === 'seed-multiplicator') || membres[0]
      if (!membre) return
      await fetch(`${ORDER}/chat/conversations`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinataireUsername: membre.keycloakUsername }),
      })
      onContacter?.()
    } catch { /* ignoré */ }
    finally { setContactingOrg(null) }
  }

  function findProximite(coords?: [number, number]) {
    if (!navigator.geolocation && !coords) { setProximiteError('Géolocalisation non supportée'); return }
    setProximiteLoading(true); setProximiteError(null)

    const doSearch = (lat: number, lng: number) => {
      setUserCoords([lat, lng])
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), rayonKm: '200' })
      if (selectedVariete) params.set('idVariete', String(selectedVariete.varieteId))
      fetch(`${STOCK}/stocks/catalogue/proximite?${params}`, { headers })
        .then(r => r.json())
        .then(data => { setProximiteItems(Array.isArray(data) ? data : []); setGeoMode(true); setProximiteLoading(false) })
        .catch(() => { setProximiteError('Erreur de recherche'); setProximiteLoading(false) })
    }

    if (coords) {
      doSearch(coords[0], coords[1])
    } else {
      navigator.geolocation.getCurrentPosition(
        pos => doSearch(pos.coords.latitude, pos.coords.longitude),
        () => { setProximiteError('Localisation refusée ou indisponible'); setProximiteLoading(false) }
      )
    }
  }

  /* ── Auto-géolocalisation silencieuse à la connexion ── */
  useEffect(() => {
    if (!navigator.geolocation || !token) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const coords: [number, number] = [lat, lng]
        setUserCoords(coords)
        /* Charge tous les fournisseurs proches (toutes espèces) */
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng), rayonKm: '200' })
        fetch(`${STOCK}/stocks/catalogue/proximite?${params}`, { headers })
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              setProximiteItems(data)
              setGeoMode(true)
              setViewMode('map') /* Passe directement à la carte */
            }
          })
          .catch(() => { /* Géoloc silencieuse : aucun message d'erreur */ })
      },
      () => { /* Refus de géolocalisation → expérience normale */ },
      { timeout: 8000, maximumAge: 300000 } /* 5 min de cache GPS */
    )
  }, []) /* Une seule fois au montage */

  useEffect(() => {
    fetch(`${CATALOG}/species`, { headers }).then(r => r.json()).then(setEspeces).catch(() => {})

    // Charge les zones puis pré-sélectionne celle de l'utilisateur connecté
    fetch(`${CATALOG}/zones`)
      .then(r => r.json())
      .then((loadedZones: ZoneAgro[]) => {
        setZones(loadedZones)
        // Résolution de la ZAE de l'utilisateur via son profil d'organisation
        fetch(`${CATALOG}/zones/ma-zone`, { headers })
          .then(r => r.status === 204 ? null : r.json())
          .then((userZone: ZoneAgro | null) => {
            if (userZone) {
              const matched = loadedZones.find(z => z.id === userZone.id)
              if (matched) setSelectedZone(matched)
            }
          })
          .catch(() => { /* pas de zone configurée → Toutes zones par défaut */ })
      })
      .catch(() => {})
  }, [])

  /* Fonction de chargement du catalogue (utilisée au changement d'espèce et au refresh) */
  const chargerCatalogue = useCallback((espece: Espece, zone: ZoneAgro | null, silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const params = new URLSearchParams({ espece: espece.codeEspece })
    if (zone) params.set('idZone', String(zone.id))
    fetch(`${STOCK}/stocks/catalogue?${params}`, { headers })
      .then(r => r.json())
      .then(data => {
        setCatalogue(Array.isArray(data) ? data : [])
        setLastRefresh(new Date())
        if (!silent) setLoading(false)
        else setRefreshing(false)
      })
      .catch(() => { setLoading(false); setRefreshing(false) })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedEspece) return
    chargerCatalogue(selectedEspece, selectedZone)
  }, [selectedEspece, selectedZone])

  /* Auto-refresh toutes les 60s quand une espèce est sélectionnée */
  useEffect(() => {
    if (!selectedEspece) return
    const interval = setInterval(() => {
      chargerCatalogue(selectedEspece, selectedZone, true /* silent */)
    }, 60000)
    return () => clearInterval(interval)
  }, [selectedEspece, selectedZone])

  /* Met à jour le label "actualisé il y a Xs" toutes les 15s */
  useEffect(() => {
    const timer = setInterval(() => {
      const secondes = Math.round((Date.now() - lastRefresh.getTime()) / 1000)
      if (secondes < 10) setRefreshLabel(null)
      else if (secondes < 60) setRefreshLabel(`actualisé il y a ${secondes}s`)
      else setRefreshLabel(`actualisé il y a ${Math.round(secondes / 60)}min`)
    }, 15000)
    return () => clearInterval(timer)
  }, [lastRefresh])

  const varieteGroups: VarieteGroup[] = useMemo(() => {
    const map = new Map<number, VarieteGroup>()
    for (const item of catalogue) {
      const existing = map.get(item.varieteId)
      if (!existing) {
        map.set(item.varieteId, {
          varieteId: item.varieteId, nomVariete: item.nomVariete,
          codeVariete: item.codeVariete, nomEspece: item.nomEspece,
          codeEspece: item.codeEspece ?? selectedEspece?.codeEspece ?? '',
          niveauAdaptation: item.niveauAdaptation,
          stockTotal: item.quantiteDisponible, nombreFournisseurs: 1,
          tauxGerminationMoyen: item.tauxGermination || 0,
          lots: [item],
        })
      } else {
        existing.stockTotal += item.quantiteDisponible
        existing.nombreFournisseurs = new Set(existing.lots.map(l => l.organisationId).concat(item.organisationId)).size
        if (item.tauxGermination && existing.tauxGerminationMoyen) {
          existing.tauxGerminationMoyen = Math.round((existing.tauxGerminationMoyen + item.tauxGermination) / 2)
        } else if (item.tauxGermination) {
          existing.tauxGerminationMoyen = item.tauxGermination
        }
        existing.lots.push(item)
      }
    }
    return Array.from(map.values())
  }, [catalogue])

  const filteredVarietes = useMemo(() =>
    varieteGroups.filter(v =>
      !search ||
      v.nomVariete.toLowerCase().includes(search.toLowerCase()) ||
      v.codeVariete.toLowerCase().includes(search.toLowerCase())
    ),
    [varieteGroups, search]
  )

  /* Map orgId → distance minimale depuis les données de proximité */
  const distanceByOrgId = useMemo(() => {
    const map = new Map<number, number>()
    for (const item of proximiteItems) {
      if (item.distanceKm != null) {
        const ex = map.get(item.organisationId)
        if (ex == null || item.distanceKm < ex) map.set(item.organisationId, item.distanceKm)
      }
    }
    return map
  }, [proximiteItems])

  useEffect(() => {
    setSortBy(geoMode ? 'distance' : 'stock')
  }, [geoMode])

  const sortedFilteredVarietes = useMemo(() => {
    const vs = [...filteredVarietes]
    if (sortBy === 'germination')
      return vs.sort((a, b) => b.tauxGerminationMoyen - a.tauxGerminationMoyen)
    if (sortBy === 'distance') {
      return vs.sort((a, b) => {
        const dMin = (v: VarieteGroup) => Math.min(...v.lots.map(l => distanceByOrgId.get(l.organisationId) ?? Infinity))
        return dMin(a) - dMin(b)
      })
    }
    return vs.sort((a, b) => b.stockTotal - a.stockTotal)
  }, [filteredVarietes, sortBy, distanceByOrgId])

  const fournisseurs = useMemo(
    () => groupByOrg(geoMode ? proximiteItems : (selectedVariete?.lots ?? [])),
    [geoMode, proximiteItems, selectedVariete]
  )

  /* Données carte : items de proximité filtrés par espèce sélectionnée (si applicable),
     ou catalogue filtré par espèce en mode liste. Recherche textuelle dans les deux cas. */
  const catalogueForMap = useMemo<CatalogueItem[]>(() => {
    let base = (geoMode && proximiteItems.length > 0) ? proximiteItems : catalogue
    if (geoMode && selectedEspece) {
      base = base.filter(item => item.codeEspece === selectedEspece.codeEspece)
    }
    if (!search.trim()) return base
    const s = search.toLowerCase()
    return base.filter(item =>
      item.nomVariete.toLowerCase().includes(s) ||
      item.codeVariete.toLowerCase().includes(s) ||
      item.nomEspece.toLowerCase().includes(s)
    )
  }, [geoMode, proximiteItems, catalogue, search, selectedEspece])

  const totalCartKg = cart.reduce((s, i) => s + i.quantite, 0)

  /* ── Fournisseurs drawer ── */
  const FournisseursDrawer = () => (
    <>
      {showFournisseurs && !showCart && (
        <div onClick={() => setShowFournisseurs(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1039 }} />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: 'var(--surface)', boxShadow: '-6px 0 30px rgba(0,0,0,0.1)',
        transform: showFournisseurs ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 1040, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', background: 'var(--green-50)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Fournisseurs disponibles</div>
            <button onClick={() => setShowFournisseurs(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
          {selectedVariete && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              <strong>{selectedVariete.nomVariete}</strong> · {selectedVariete.codeVariete}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {geoMode ? (
              <button onClick={() => setGeoMode(false)}
                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                Tous les fournisseurs
              </button>
            ) : (
              <button onClick={findProximite} disabled={proximiteLoading}
                style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #0369a1', background: '#eff6ff', cursor: 'pointer', color: '#1d4ed8', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Navigation size={12} /> {proximiteLoading ? 'Localisation…' : 'Près de moi'}
              </button>
            )}
            {geoMode && <span style={{ fontSize: 11, color: '#0369a1', fontStyle: 'italic' }}>Rayon 200 km · triés par distance</span>}
            {proximiteError && <span style={{ fontSize: 11, color: '#dc2626' }}>{proximiteError}</span>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fournisseurs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <MapPin size={32} style={{ opacity: 0.2, marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13 }}>
                {geoMode ? 'Aucun fournisseur dans un rayon de 200 km' : 'Aucun fournisseur disponible'}
              </p>
            </div>
          ) : (
            fournisseurs.map(f => {
              const totalQte = f.lots.reduce((acc, l) => acc + l.quantiteDisponible, 0)
              return (
                <div key={f.org} style={{ background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.org}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <MapPin size={11} /> {f.region}
                        {f.distanceKm != null && (
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Navigation size={10} /> {Math.round(f.distanceKm)} km
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{totalQte.toLocaleString('fr-FR')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>kg dispo</div>
                    </div>
                  </div>
                  <div style={{ padding: '0 16px', marginBottom: 2 }}>
                    {f.lots.map(l => (
                      <div key={l.lotId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 12 }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 11 }}>{l.codeLot}</span>
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>{l.generation}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{l.campagne}</span>
                        {l.tauxGermination > 0 && (
                          <span style={{ marginLeft: 'auto', color: '#d97706', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Star size={10} /> {l.tauxGermination}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>💬 Règlement à convenir</span>
                    <button
                      onClick={() => handleContacter(f.orgId)} disabled={contactingOrg === f.orgId}
                      style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: contactingOrg === f.orgId ? '#9ca3af' : '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <MessageCircle size={12} />
                      {contactingOrg === f.orgId ? 'Connexion…' : 'Contacter'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )

  /* ── Contenu du cart drawer (inliné pour éviter la perte de focus) ── */
  const cartDrawerJsx = (
    <>
      {showCart && (
        <div onClick={() => setShowCart(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1099 }} />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'var(--surface)', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        transform: showCart ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 1100, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', flexShrink: 0 }}>
            <ShoppingCart size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Mon panier</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {cart.length} variété{cart.length > 1 ? 's' : ''} · {totalCartKg.toLocaleString('fr-FR')} kg
            </div>
          </div>
          <button onClick={() => setShowCart(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <ShoppingCart size={40} style={{ opacity: 0.2, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13 }}>Votre panier est vide</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cart.map(item => (
                <div key={item.varieteId} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.nomVariete}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {item.codeVariete} · {item.nomEspece} ·
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{item.generation}</span>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.varieteId)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" value={item.quantite} min="1"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCartItemQty(item.varieteId, Number(e.target.value))}
                      style={{ width: 80, height: 32, borderRadius: 6, border: '1px solid var(--border)', padding: '0 8px', fontSize: 13, fontFamily: 'inherit' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      kg / {item.disponible.toLocaleString('fr-FR')} kg dispo
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <textarea value={orderObs} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOrderObs(e.target.value)}
              placeholder="Observations (zone de livraison, urgence…)" rows={3}
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--border)', padding: '8px 12px', fontSize: 12, marginBottom: 12, fontFamily: 'inherit', resize: 'vertical', color: 'var(--text-primary)', background: 'var(--surface-2)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Package size={12} /> Total : <strong style={{ color: 'var(--text-primary)' }}>{totalCartKg.toLocaleString('fr-FR')} kg</strong>
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Semences R1/R2</span>
            </div>
            <button onClick={submitCartOrder} disabled={submittingOrder}
              style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', cursor: submittingOrder ? 'wait' : 'pointer', background: submittingOrder ? '#9ca3af' : '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}>
              {submittingOrder ? 'Envoi en cours…' : `Commander (${cart.length} variété${cart.length > 1 ? 's' : ''})`}
            </button>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
              La CNRA/ISRA vous contactera pour finaliser la livraison.
            </p>
          </div>
        )}
      </div>
    </>
  )

  /* ── MAIN RENDER ── */
  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── LEFT SIDEBAR ── */}
      <div style={{ width: 260, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
            Catalogue R1 / R2
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Semences certifiées
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>ISRA · CNRA · Agréés</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          <div
            onClick={() => { setSelectedEspece(null); setCatalogue([]); setSearch('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: !selectedEspece ? 'var(--green-50)' : 'transparent', border: !selectedEspece ? '1px solid var(--green-200)' : '1px solid transparent', transition: 'all 0.15s' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: !selectedEspece ? '#16a34a' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: !selectedEspece ? '#fff' : '#16a34a', flexShrink: 0 }}>
              <Leaf size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: !selectedEspece ? 700 : 500, color: !selectedEspece ? 'var(--green-700)' : 'var(--text-primary)' }}>
                Toutes les espèces
              </div>
            </div>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px 4px' }}>
            Espèces
          </div>

          {especes.map(e => {
            const Icon = ESPECE_ICONS[e.codeEspece] ?? ESPECE_ICONS.default
            const isActive = selectedEspece?.id === e.id
            return (
              <div key={e.id}
                onClick={() => { setSelectedEspece(e); setSearch('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer', background: isActive ? 'var(--green-50)' : 'transparent', border: isActive ? '1px solid var(--green-200)' : '1px solid transparent', marginBottom: 2, transition: 'all 0.15s' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isActive ? '#16a34a' : '#f0f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#fff' : '#16a34a', flexShrink: 0 }}>
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--green-700)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.nomCommun}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{e.codeEspece}</div>
                </div>
                {isActive && varieteGroups.length > 0 && (
                  <span style={{ background: '#16a34a', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {varieteGroups.length}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {cart.length > 0 && (
          <div onClick={() => setShowCart(true)}
            style={{ margin: 8, borderRadius: 10, padding: '12px 14px', background: 'var(--green-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
            <ShoppingCart size={17} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>
                Mon panier · {cart.length} variété{cart.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{totalCartKg.toLocaleString('fr-FR')} kg</div>
            </div>
            <ChevronRight size={15} style={{ opacity: 0.7, flexShrink: 0 }} />
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{ padding: '14px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
              {selectedEspece ? selectedEspece.nomCommun : 'Catalogue des semences'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {selectedEspece && !loading
                ? `${varieteGroups.length} variété${varieteGroups.length > 1 ? 's' : ''} disponible${varieteGroups.length > 1 ? 's' : ''}${selectedZone ? ` · ${selectedZone.nom}` : ''}`
                : 'Stocks R1 / R2 certifiés chez les multiplicateurs agréés'
              }
              {/* Indicateur de fraîcheur des données */}
              {refreshLabel && !refreshing && selectedEspece && (
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic' }}> · {refreshLabel}</span>
              )}
              {refreshing && (
                <RefreshCw size={10} style={{ color: '#16a34a', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              )}
            </div>
          </div>

          {/* Champ de recherche : visible dès qu'une espèce est sélectionnée ou en mode proximité */}
          {(selectedEspece || geoMode) && (
            <div style={{ position: 'relative', width: 240, flexShrink: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input type="text" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder={geoMode ? 'Filtrer par variété ou espèce…' : 'Rechercher une variété…'}
                style={{ width: '100%', height: 34, paddingLeft: 30, paddingRight: 8, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface-2)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
          )}

          {/* Bascule vue liste / carte */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <button
              onClick={() => setViewMode('list')}
              style={{ height: 34, padding: '0 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: viewMode === 'list' ? '#16a34a' : 'var(--surface)', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              📋 Liste
            </button>
            <button
              onClick={() => setViewMode('map')}
              style={{ height: 34, padding: '0 12px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: viewMode === 'map' ? '#16a34a' : 'var(--surface)', color: viewMode === 'map' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              🗺️ Carte
            </button>
          </div>

          <button onClick={() => setShowCart(true)}
            style={{ height: 34, padding: '0 14px', borderRadius: 8, border: cart.length > 0 ? '1.5px solid #16a34a' : '1px solid var(--border)', background: cart.length > 0 ? '#f0fdf4' : 'var(--surface)', color: cart.length > 0 ? '#16a34a' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <ShoppingCart size={14} />
            {cart.length > 0 ? `Panier (${cart.length})` : 'Panier'}
          </button>
        </div>

        {/* Zone chips - masquées en mode carte (MapCatalogue a son propre filtre) */}
        {zones.length > 0 && viewMode === 'list' && (
          <div style={{ padding: '8px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginRight: 2 }}>Zone :</span>
            {[null, ...zones].map((z, i) => {
              const isActive = z === null ? selectedZone === null : selectedZone?.id === z.id
              return (
                <button key={i}
                  onClick={() => setSelectedZone(z === null ? null : (selectedZone?.id === z.id ? null : z))}
                  style={{ height: 26, padding: '0 12px', borderRadius: 99, fontSize: 12, fontWeight: isActive ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', background: isActive ? '#16a34a' : 'var(--surface)', color: isActive ? '#fff' : 'var(--text-secondary)', border: isActive ? '1.5px solid #16a34a' : '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {z === null ? 'Toutes zones' : z.nom}
                </button>
              )
            })}
          </div>
        )}

        {/* Bandeau mode proximité : visible en vue liste quand la géoloc est active */}
        {geoMode && viewMode === 'list' && proximiteItems.length > 0 && (
          <div style={{
            padding: '8px 20px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <Navigation size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#1e40af', flex: 1 }}>
              <strong>{new Set(proximiteItems.map(i => i.organisationId)).size} multiplicateurs</strong> disponibles dans un rayon de 200 km ·
              <button onClick={() => setViewMode('map')} style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
                Voir sur la carte →
              </button>
            </span>
            <button onClick={() => { setGeoMode(false); setProximiteItems([]) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, display: 'flex', flexShrink: 0 }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Vue carte interactive */}
        {viewMode === 'map' && (
          <MapCatalogue
            catalogue={catalogueForMap}
            zones={zones}
            selectedEspece={selectedEspece}
            selectedZone={selectedZone}
            cart={cart}
            userCoords={userCoords}
            geoMode={geoMode}
            proximiteCount={proximiteItems.length}
            onAddToCart={addToCartFromMap}
            onContacter={async (orgId) => { await handleContacter(orgId) }}
            onSelectZone={setSelectedZone}
          />
        )}

        {/* Content area - mode liste */}
        {viewMode === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* Welcome state */}
          {!selectedEspece && (
            <div style={{ maxWidth: 560, margin: '48px auto', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#16a34a' }}>
                <Sprout size={34} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>Bienvenue dans le catalogue</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28, lineHeight: 1.7 }}>
                Sélectionnez une espèce dans la barre de gauche pour consulter les variétés disponibles, filtrez par zone et ajoutez au panier.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {especes.map(e => {
                  const Icon = ESPECE_ICONS[e.codeEspece] ?? ESPECE_ICONS.default
                  return (
                    <button key={e.id} onClick={() => setSelectedEspece(e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', transition: 'border-color 0.15s' }}>
                      <Icon size={16} style={{ color: '#16a34a' }} />
                      {e.nomCommun}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Skeleton loading */}
          {selectedEspece && loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {[1,2,3,4].map(i => (
                <div key={i} className="skeleton" style={{ height: 220, borderRadius: 14 }} />
              ))}
            </div>
          )}

          {/* Empty */}
          {selectedEspece && !loading && sortedFilteredVarietes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Package size={44} style={{ opacity: 0.2, marginBottom: 14, display: 'block', margin: '0 auto 14px' }} />
              <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Aucune variété disponible</p>
              <p style={{ fontSize: 13 }}>
                {selectedZone ? `Aucun stock R1/R2 en ${selectedZone.nom}` : 'Aucun stock R1/R2 pour cette espèce'}
                {search ? ` correspondant à "${search}"` : ''}
              </p>
            </div>
          )}

          {/* Barre de tri */}
          {selectedEspece && !loading && sortedFilteredVarietes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{sortedFilteredVarietes.length} variété{sortedFilteredVarietes.length > 1 ? 's' : ''}</strong>
                {selectedZone ? ` · ${selectedZone.nom}` : ' · Toutes zones'}
                {geoMode && <span style={{ color: '#2563eb', marginLeft: 6, fontSize: 11 }}>📡 Proximité</span>}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Trier :</span>
              {(['stock', 'distance', 'germination'] as const).map(s => {
                const labels: Record<string, string> = { stock: 'Stock', distance: 'Distance', germination: 'Germination' }
                const icons:  Record<string, string> = { stock: '📦', distance: '📍', germination: '⭐' }
                const active   = sortBy === s
                const disabled = s === 'distance' && !geoMode
                return (
                  <button key={s} onClick={() => !disabled && setSortBy(s)} disabled={disabled}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
                      border: '1px solid', fontFamily: 'inherit',
                      background:   active ? '#f0fdf4' : 'var(--surface)',
                      color:        active ? '#15803d' : disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                      borderColor:  active ? '#bbf7d0' : 'var(--border)',
                      opacity:      disabled ? 0.5 : 1,
                    }}>
                    {icons[s]} {labels[s]}
                  </button>
                )
              })}
            </div>
          )}

          {/* Variety cards grid */}
          {selectedEspece && !loading && sortedFilteredVarietes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {sortedFilteredVarietes.map(v => {
                const isAdded  = addedIds.has(v.varieteId)
                const inCart   = cart.find(c => c.varieteId === v.varieteId)
                const nCfg     = v.niveauAdaptation ? NIVEAU_CONFIG[v.niveauAdaptation] : null
                const accent   = nCfg?.color ?? '#6b7280'
                const stockTonnes = `${v.stockTotal.toLocaleString('fr-FR')} kg`

                /* Fournisseur le plus proche via lookup dans les données de proximité */
                const closestLot = geoMode
                  ? [...v.lots].sort((a, b) => (distanceByOrgId.get(a.organisationId) ?? Infinity) - (distanceByOrgId.get(b.organisationId) ?? Infinity)).find(l => distanceByOrgId.has(l.organisationId)) ?? null
                  : null
                const closestDist = closestLot ? distanceByOrgId.get(closestLot.organisationId) : null

                return (
                  <div key={v.varieteId} style={{ background: 'var(--surface)', borderRadius: 14, border: inCart ? '2px solid #16a34a' : '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.15s, border-color 0.15s' }}>
                    {/* Accent strip */}
                    <div style={{ height: 4, background: accent, flexShrink: 0 }} />

                    <div style={{ padding: '14px 16px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 3 }}>
                            {v.nomVariete}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{v.codeVariete}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                            {v.codeEspece || selectedEspece?.codeEspece}
                          </span>
                          {nCfg && (
                            <span style={{ background: nCfg.bg, color: nCfg.color, border: `1px solid ${nCfg.color}40`, padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {nCfg.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <Package size={12} style={{ color: accent }} />
                          <strong style={{ color: 'var(--text-primary)' }}>{stockTonnes}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <MapPin size={12} style={{ color: accent }} />
                          <span><strong>{v.nombreFournisseurs}</strong> fournisseur{v.nombreFournisseurs > 1 ? 's' : ''}</span>
                        </div>
                        {v.tauxGerminationMoyen > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <Star size={12} style={{ color: '#d97706' }} />
                            <strong>{v.tauxGerminationMoyen}%</strong>
                          </div>
                        )}
                      </div>

                      {/* Fournisseur le plus proche (mode géoloc) */}
                      {closestLot && closestDist != null && (() => {
                        const km = Math.round(closestDist)
                        const h  = Math.ceil(closestDist / 50)
                        const isNear = km < 80
                        const isMed  = km < 150
                        const bg  = isNear ? '#f0fdf4' : isMed ? '#fffbeb' : '#f9fafb'
                        const col = isNear ? '#15803d' : isMed ? '#b45309' : '#6b7280'
                        const bdr = isNear ? '#bbf7d0' : isMed ? '#fde68a' : '#e5e7eb'
                        return (
                          <div style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 8, padding: '6px 10px', fontSize: 11, color: col, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Navigation size={11} style={{ color: col, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {closestLot.nomComplet || closestLot.nomOrganisation}
                            </span>
                            <span style={{ fontWeight: 700, flexShrink: 0 }}>{km} km · ~{h}h</span>
                          </div>
                        )
                      })()}

                      {/* In-cart badge */}
                      {inCart && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          <CheckCircle2 size={13} /> {inCart.quantite.toLocaleString('fr-FR')} kg dans votre panier
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
                          <input type="number"
                            value={qtyInputs[v.varieteId] ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQtyInputs(prev => ({ ...prev, [v.varieteId]: e.target.value }))}
                            placeholder="Qté (kg)" min="1"
                            style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--border)', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); addToCart(v) }}
                            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: isAdded ? '#15803d' : '#16a34a', color: '#fff', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', transition: 'background 0.15s' }}>
                            {isAdded ? <><CheckCircle2 size={13} /> Ajouté !</> : <><ShoppingCart size={13} /> Ajouter</>}
                          </button>
                        </div>
                        <button onClick={() => { setSelectedVariete(v); setGeoMode(false); setShowFournisseurs(true) }}
                          style={{ width: '100%', height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontWeight: 500 }}>
                          <MapPin size={12} style={{ color: accent }} />
                          Voir les {v.nombreFournisseurs} fournisseur{v.nombreFournisseurs > 1 ? 's' : ''} →
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Feedback toast */}
      {orderFeedback && (
        <div onClick={() => setOrderFeedback(null)}
          style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: orderFeedback.type === 'success' ? '#166534' : '#991b1b', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', zIndex: 2000, maxWidth: 480 }}>
          {orderFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <X size={15} />}
          {orderFeedback.msg}
        </div>
      )}

      <FournisseursDrawer />
      {cartDrawerJsx}
    </div>
  )
}
