import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  MapPin, Package, Star, Wheat, Leaf, Sprout,
  Navigation, MessageCircle, ShoppingCart, X, Trash2, CheckCircle2,
  Search, ChevronRight, RefreshCw, LucideIcon,
} from 'lucide-react'
import { MapCatalogue } from '../components/MapCatalogue'

/* ── Types ─────────────────────────────────────────────── */
interface Espece { id: number; codeEspece: string; nomCommun: string }

type ZoneInfo = { idZone: number; niveau: string }

interface CatalogueItem {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; codeEspece: string
  lotId: number; codeLot: string; generation: string; campagne: string
  tauxGermination: number; quantiteDisponible: number; unite: string
  siteId: number; nomSite: string; region: string
  organisationId: number; nomOrganisation: string
  latitude: number; longitude: number
  niveauAdaptation: string | null
  zonesAdaptation?: string   // JSON : [{idZone, niveau}]
  distanceKm?: number
  nomComplet?: string
  telephone?: string
  localite?: string
  departement?: string
}

interface ZoneAgro { id: number; code: string; nom: string }

interface VarieteGroup {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; codeEspece: string; niveauAdaptation: string | null
  stockTotal: number; nombreFournisseurs: number
  tauxGerminationMoyen: number
  lots: CatalogueItem[]
  zonesAdaptation: ZoneInfo[]
}

interface VarieteAgg {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; codeEspece: string; generation: string
  stockTotal: number; tauxGermination: number
  niveauAdaptation: string | null; zonesAdaptation: ZoneInfo[]
  representant: CatalogueItem
}

interface MultGroup {
  orgId: number; orgNom: string; nomComplet?: string
  region: string; distanceKm?: number
  telephone?: string
  localite?: string
  varietes: VarieteAgg[]
  stockTotal: number
}

interface CartItem {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; idGeneration: number; generation: string
  quantite: number; unite: string; disponible: number
  organisationId?: number; nomOrganisation?: string
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

function getInitials(name: string): string {
  const parts = name.split(/\s+/).slice(0, 2)
  return parts.map(w => w[0] ?? '').join('').toUpperCase() || '?'
}

const AVATAR_COLORS = ['#16a34a', '#0284c7', '#7c3aed', '#dc2626', '#ea580c', '#0891b2', '#65a30d', '#d97706']
function getAvatarColor(orgId: number): string {
  return AVATAR_COLORS[orgId % AVATAR_COLORS.length]
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
  const [zoneEspeces,     setZoneEspeces]     = useState<string[]>([])
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

  const [currentUser, setCurrentUser] = useState<{
    nomComplet: string; telephone: string; localite: string; roleKey: string; nomOrganisation: string
  } | null>(null)

  const [cart,            setCart]            = useState<CartItem[]>([])
  const [cartConflict,    setCartConflict]    = useState<{ current: string; blocked: string } | null>(null)
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

  /* ── Ajout panier depuis la vue liste (par multiplicateur) ── */
  function addToCartFromMult(variete: VarieteAgg, mult: MultGroup, qty: number) {
    if (!qty || qty <= 0) return
    const lot = variete.representant
    const gen = lot.generation ?? 'R2'
    if (roleKey === 'seed-quotataire' && gen !== 'R2') {
      setOrderFeedback({ msg: `Seules les semences R2 peuvent être commandées. Ce lot est en ${gen}.`, type: 'error' })
      return
    }
    if (cart.length > 0 && cart[0].organisationId && cart[0].organisationId !== mult.orgId) {
      setCartConflict({ current: cart[0].nomOrganisation ?? 'ce multiplicateur', blocked: mult.nomComplet || mult.orgNom })
      return
    }
    const idGen = GEN_ID_MAP[gen] ?? 7
    setCart(prev => {
      const existing = prev.find(c => c.varieteId === variete.varieteId)
      if (existing) return prev.map(c => c.varieteId === variete.varieteId ? { ...c, quantite: c.quantite + qty } : c)
      return [...prev, { varieteId: variete.varieteId, nomVariete: variete.nomVariete, codeVariete: variete.codeVariete, nomEspece: variete.nomEspece, idGeneration: idGen, generation: gen, quantite: qty, unite: lot.unite || 'kg', disponible: variete.stockTotal, organisationId: mult.orgId, nomOrganisation: mult.nomComplet || mult.orgNom }]
    })
    setAddedIds(prev => { const s = new Set(prev); s.add(variete.varieteId); return s })
    setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(variete.varieteId); return s }), 1800)
    setQtyInputs(prev => ({ ...prev, [`${mult.orgId}-${variete.varieteId}`]: '' }))
  }

  /* ── Ajout panier depuis la vue carte ── */
  function addToCartFromMap(lot: CatalogueItem, qty: number) {
    if (roleKey === 'seed-quotataire' && lot.generation !== 'R2') {
      setOrderFeedback({ msg: 'En tant que Quotataire, vous ne pouvez commander que des semences R2. Ce lot est en ' + lot.generation + '.', type: 'error' })
      return
    }
    if (cart.length > 0 && cart[0].organisationId && cart[0].organisationId !== lot.organisationId) {
      setCartConflict({ current: cart[0].nomOrganisation ?? 'ce multiplicateur', blocked: lot.nomOrganisation })
      return
    }
    const idGen = GEN_ID_MAP[lot.generation] ?? 7
    const vGroup = varieteGroups.find(v => v.varieteId === lot.varieteId)
    const disponible = vGroup?.stockTotal ?? lot.quantiteDisponible
    setCart(prev => {
      const existing = prev.find(c => c.varieteId === lot.varieteId)
      if (existing) return prev.map(c => c.varieteId === lot.varieteId ? { ...c, quantite: c.quantite + qty } : c)
      return [...prev, { varieteId: lot.varieteId, nomVariete: lot.nomVariete, codeVariete: lot.codeVariete, nomEspece: lot.nomEspece, idGeneration: idGen, generation: lot.generation, quantite: qty, unite: lot.unite || 'kg', disponible, organisationId: lot.organisationId, nomOrganisation: lot.nomOrganisation }]
    })
  }

  function addToCartFromMult(variete: VarieteAgg, mult: MultGroup, qty: number) {
    if (!qty || qty <= 0) return
    const lot = variete.representant
    const gen = lot.generation ?? 'R2'
    if (roleKey === 'seed-quotataire' && gen !== 'R2') {
      setOrderFeedback({ msg: `Seules les semences R2 peuvent être commandées. Ce lot est en ${gen}.`, type: 'error' })
      return
    }
    const idGen = GEN_ID_MAP[gen] ?? 7
    setCart(prev => {
      const existing = prev.find(c => c.varieteId === variete.varieteId)
      if (existing) return prev.map(c => c.varieteId === variete.varieteId ? { ...c, quantite: c.quantite + qty } : c)
      return [...prev, { varieteId: variete.varieteId, nomVariete: variete.nomVariete, codeVariete: variete.codeVariete, nomEspece: variete.nomEspece, idGeneration: idGen, generation: gen, quantite: qty, unite: lot.unite || 'kg', disponible: variete.stockTotal, organisationId: mult.orgId }]
    })
    setAddedIds(prev => { const s = new Set(prev); s.add(variete.varieteId); return s })
    setTimeout(() => setAddedIds(prev => { const s = new Set(prev); s.delete(variete.varieteId); return s }), 1800)
    setQtyInputs(prev => ({ ...prev, [`${mult.orgId}-${variete.varieteId}`]: '' }))
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
      /* Détermine le fournisseur : si tous les articles viennent du même multiplicateur → on lie la commande */
      const orgIds = [...new Set(cart.map(i => i.organisationId).filter((id): id is number => id != null))]
      const idOrganisationFournisseur = orgIds.length === 1 ? orgIds[0] : null
      const resp = await fetch(`${ORDER}/orders`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeCommande: code, client: 'Commande catalogue',
          idOrganisationFournisseur, observations: orderObs || null,
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

  /* ── Profil de l'utilisateur connecté (nom, téléphone, localité) ── */
  useEffect(() => {
    if (!token) return
    fetch(`${STOCK}/profil/me`, { headers })
      .then(r => {
        if (!r.ok) throw new Error(`Profil HTTP ${r.status}`)
        return r.json()
      })
      .then((d: { nomComplet: string; telephone: string; localite: string; roleKey: string; nomOrganisation: string }) => {
        setCurrentUser(d)
      })
      .catch(err => {
        console.warn('[CataloguePublic] Impossible de charger le profil utilisateur :', err)
      })
  }, [token]) /* Rechargé si le token change (reconnexion) */

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

  /* Charge les espèces recommandées pour la ZAE de l'utilisateur */
  useEffect(() => {
    if (!selectedZone) { setZoneEspeces([]); return }
    fetch(`${CATALOG}/zones/${selectedZone.id}/especes`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setZoneEspeces(data.map((ze: any) => ze.espece?.codeEspece).filter(Boolean) as string[])
        }
      })
      .catch(() => setZoneEspeces([]))
  }, [selectedZone])

  /* Fonction de chargement du catalogue — espèce et zone sont toutes deux optionnelles */
  const chargerCatalogue = useCallback((espece: Espece | null, zone: ZoneAgro | null, silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const params = new URLSearchParams()
    if (espece) params.set('espece', espece.codeEspece)
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
    chargerCatalogue(selectedEspece, selectedZone)
  }, [selectedEspece, selectedZone])

  /* Auto-refresh toutes les 60s */
  useEffect(() => {
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
        let zones: ZoneInfo[] = []
        try { zones = item.zonesAdaptation ? JSON.parse(item.zonesAdaptation) : [] } catch { zones = [] }
        map.set(item.varieteId, {
          varieteId: item.varieteId, nomVariete: item.nomVariete,
          codeVariete: item.codeVariete, nomEspece: item.nomEspece,
          codeEspece: item.codeEspece ?? selectedEspece?.codeEspece ?? '',
          niveauAdaptation: item.niveauAdaptation,
          stockTotal: item.quantiteDisponible, nombreFournisseurs: 1,
          tauxGerminationMoyen: item.tauxGermination || 0,
          lots: [item], zonesAdaptation: zones,
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

  const filteredVarietes = useMemo(() => {
    if (!search) return varieteGroups
    const s = search.toLowerCase()
    return varieteGroups.filter(v =>
      v.nomVariete.toLowerCase().includes(s) ||
      v.codeVariete.toLowerCase().includes(s) ||
      v.nomEspece.toLowerCase().includes(s)
    )
  }, [varieteGroups, search])

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
    /* Espèces de la ZAE de l'utilisateur remontent en tête — indicateur de pertinence agronomique */
    const inZone = (v: VarieteGroup) => zoneEspeces.includes(v.codeEspece)
    const zoneBoost = (a: VarieteGroup, b: VarieteGroup) => {
      const za = inZone(a) ? 0 : 1
      const zb = inZone(b) ? 0 : 1
      return za - zb
    }
    if (sortBy === 'germination')
      return vs.sort((a, b) => zoneBoost(a, b) || b.tauxGerminationMoyen - a.tauxGerminationMoyen)
    if (sortBy === 'distance') {
      const dMin = (v: VarieteGroup) => Math.min(...v.lots.map(l => distanceByOrgId.get(l.organisationId) ?? Infinity))
      return vs.sort((a, b) => zoneBoost(a, b) || dMin(a) - dMin(b))
    }
    return vs.sort((a, b) => zoneBoost(a, b) || b.stockTotal - a.stockTotal)
  }, [filteredVarietes, sortBy, distanceByOrgId, zoneEspeces])

  const fournisseurs = useMemo(
    () => groupByOrg(geoMode ? proximiteItems : (selectedVariete?.lots ?? [])),
    [geoMode, proximiteItems, selectedVariete]
  )

  const multGroups: MultGroup[] = useMemo(() => {
    const map = new Map<number, MultGroup>()
    for (const item of catalogue) {
      const distKm = distanceByOrgId.get(item.organisationId)
      const ex = map.get(item.organisationId)
      if (!ex) {
        let zones: ZoneInfo[] = []
        try { zones = item.zonesAdaptation ? JSON.parse(item.zonesAdaptation) : [] } catch { zones = [] }
        map.set(item.organisationId, {
          orgId: item.organisationId, orgNom: item.nomOrganisation,
          nomComplet: item.nomComplet, region: item.region, distanceKm: distKm,
          telephone: item.telephone ?? undefined, localite: item.localite ?? undefined,
          varietes: [{ varieteId: item.varieteId, nomVariete: item.nomVariete, codeVariete: item.codeVariete, nomEspece: item.nomEspece, codeEspece: item.codeEspece ?? selectedEspece?.codeEspece ?? '', generation: item.generation, stockTotal: item.quantiteDisponible, tauxGermination: item.tauxGermination, niveauAdaptation: item.niveauAdaptation, zonesAdaptation: zones, representant: item }],
          stockTotal: item.quantiteDisponible,
        })
      } else {
        const exV = ex.varietes.find(v => v.varieteId === item.varieteId)
        if (!exV) {
          let zones: ZoneInfo[] = []
          try { zones = item.zonesAdaptation ? JSON.parse(item.zonesAdaptation) : [] } catch { zones = [] }
          ex.varietes.push({ varieteId: item.varieteId, nomVariete: item.nomVariete, codeVariete: item.codeVariete, nomEspece: item.nomEspece, codeEspece: item.codeEspece ?? selectedEspece?.codeEspece ?? '', generation: item.generation, stockTotal: item.quantiteDisponible, tauxGermination: item.tauxGermination, niveauAdaptation: item.niveauAdaptation, zonesAdaptation: zones, representant: item })
        } else {
          exV.stockTotal += item.quantiteDisponible
          if (item.tauxGermination > exV.tauxGermination) { exV.tauxGermination = item.tauxGermination; exV.representant = item }
        }
        ex.stockTotal += item.quantiteDisponible
      }
    }
    for (const mg of map.values()) mg.varietes.sort((a, b) => b.stockTotal - a.stockTotal)
    return Array.from(map.values())
  }, [catalogue, distanceByOrgId, selectedEspece])

  const filteredMultGroups = useMemo(() => {
    if (!search) return multGroups
    const s = search.toLowerCase()
    return multGroups.map(mg => {
      const orgMatch = (mg.orgNom + ' ' + (mg.nomComplet ?? '')).toLowerCase().includes(s)
      if (orgMatch) return mg
      const fv = mg.varietes.filter(v => v.nomVariete.toLowerCase().includes(s) || v.codeVariete.toLowerCase().includes(s) || v.nomEspece.toLowerCase().includes(s))
      return fv.length > 0 ? { ...mg, varietes: fv } : null
    }).filter((mg): mg is MultGroup => mg !== null)
  }, [multGroups, search])

  const sortedMultGroups = useMemo(() => {
    const mgs = [...filteredMultGroups]
    if (geoMode) return mgs.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    return mgs.sort((a, b) => b.stockTotal - a.stockTotal)
  }, [filteredMultGroups, geoMode])

  /* Données carte : toujours le catalogue complet — tous les multiplicateurs restent visibles.
     proximiteItems sert uniquement au tri par distance et aux indicateurs dans la liste,
     jamais comme filtre d'affichage sur la carte (évite l'incohérence liste 4 / carte 2). */
  const catalogueForMap = useMemo<CatalogueItem[]>(() => {
    let base = catalogue
    if (selectedEspece) {
      base = base.filter(item => item.codeEspece === selectedEspece.codeEspece)
    }
    if (!search.trim()) return base
    const s = search.toLowerCase()
    return base.filter(item =>
      item.nomVariete.toLowerCase().includes(s) ||
      item.codeVariete.toLowerCase().includes(s) ||
      item.nomEspece.toLowerCase().includes(s)
    )
  }, [catalogue, search, selectedEspece])

  const totalCartKg = cart.reduce((s, i) => s + i.quantite, 0)

  /* Lookup rapide zone id → zone (pour les badges ZAE sur les cartes) */
  const zoneMap = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones])

  /* Multiplicateur actif du panier (null si panier vide) */
  const cartMult = useMemo<{ orgId: number; orgNom: string } | null>(() => {
    if (cart.length === 0) return null
    const first = cart[0]
    if (!first.organisationId) return null
    return { orgId: first.organisationId, orgNom: first.nomOrganisation ?? 'Multiplicateur' }
  }, [cart])

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
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 14px' }}>
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
          {cartMult && (
            <div style={{ margin: '0 20px 14px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircle2 size={12} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>Commande en cours chez</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cartMult.orgNom}</div>
              </div>
            </div>
          )}
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
                {isActive && multGroups.length > 0 && (
                  <span style={{ background: '#16a34a', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {multGroups.length}
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
              <div style={{ fontSize: 11, opacity: 0.8 }}>
                {totalCartKg.toLocaleString('fr-FR')} kg{cartMult ? ` · ${cartMult.orgNom}` : ''}
              </div>
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
              {!loading && sortedMultGroups.length > 0
                ? `${sortedMultGroups.length} multiplicateur${sortedMultGroups.length > 1 ? 's' : ''} disponible${sortedMultGroups.length > 1 ? 's' : ''}${selectedZone ? ` · ${selectedZone.nom}` : ''}`
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

          {/* Champ de recherche : toujours visible */}
          {(
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

        {/* Bandeau mode proximité : visible en vue liste quand la géoloc est active.
            Affiche le total catalogue + le sous-ensemble à moins de 200 km pour cohérence. */}
        {geoMode && viewMode === 'list' && (
          <div style={{
            padding: '8px 20px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <Navigation size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#1e40af', flex: 1 }}>
              <strong>{sortedMultGroups.length} multiplicateur{sortedMultGroups.length > 1 ? 's' : ''}</strong> au total
              {proximiteItems.length > 0 && (
                <> · <strong>{new Set(proximiteItems.map(i => i.organisationId)).size}</strong> à moins de 200 km</>
              )}
               ·
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
            currentUser={currentUser ?? undefined}
            onAddToCart={addToCartFromMap}
            onContacter={async (orgId) => { await handleContacter(orgId) }}
            onSelectZone={setSelectedZone}
          />
        )}

        {/* Content area - mode liste */}
        {viewMode === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* Skeleton loading */}
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {[1,2,3,4].map(i => (
                <div key={i} className="skeleton" style={{ height: 220, borderRadius: 14 }} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && sortedMultGroups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Package size={44} style={{ opacity: 0.2, marginBottom: 14, display: 'block', margin: '0 auto 14px' }} />
              <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Aucun multiplicateur disponible</p>
              <p style={{ fontSize: 13 }}>
                {selectedZone
                  ? `Aucun stock R2${selectedEspece ? ` de ${selectedEspece.nomCommun}` : ''} en ${selectedZone.nom}`
                  : selectedEspece ? `Aucun stock R2 pour ${selectedEspece.nomCommun}` : 'Aucun stock R2 disponible'}
                {search ? ` · "${search}"` : ''}
              </p>
            </div>
          )}

          {/* Compteur + indicateur tri */}
          {!loading && sortedMultGroups.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{sortedMultGroups.length} multiplicateur{sortedMultGroups.length > 1 ? 's' : ''}</strong>
                {selectedEspece ? ` · ${selectedEspece.nomCommun}` : ' · Toutes espèces'}
                {selectedZone ? ` · ${selectedZone.nom}` : ' · Toutes zones'}
                {geoMode
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#2563eb', marginLeft: 8, fontSize: 11 }}><Navigation size={10} /> Triés par distance</span>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#16a34a', marginLeft: 8, fontSize: 11 }}><Package size={10} /> Triés par stock</span>
                }
              </span>
            </div>
          )}

          {/* Grille multiplicateurs */}
          {!loading && sortedMultGroups.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {sortedMultGroups.map(mult => {
                const initials    = getInitials(mult.nomComplet || mult.orgNom)
                const avatarColor = getAvatarColor(mult.orgId)
                const distKm      = mult.distanceKm != null ? Math.round(mult.distanceKm) : null
                const distH       = distKm != null ? Math.ceil(distKm / 50) : null
                const distBg      = distKm == null ? '#f9fafb' : distKm < 80 ? '#f0fdf4' : distKm < 150 ? '#fffbeb' : '#f9fafb'
                const distCol     = distKm == null ? '#6b7280' : distKm < 80 ? '#15803d' : distKm < 150 ? '#b45309' : '#6b7280'
                const distBdr     = distKm == null ? '#e5e7eb' : distKm < 80 ? '#bbf7d0' : distKm < 150 ? '#fde68a' : '#e5e7eb'

                return (
                  <div key={mult.orgId} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    {/* En-tête multiplicateur */}
                    <div style={{ padding: '14px 16px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0, letterSpacing: '0.03em' }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.2 }}>{mult.nomComplet || mult.orgNom}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                            <CheckCircle2 size={9} /> Agréé
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> {mult.localite ? `${mult.localite}, ` : ''}{mult.region}</span>
                          {distKm != null && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: distBg, color: distCol, border: `1px solid ${distBdr}`, borderRadius: 99, padding: '1px 7px', fontWeight: 600 }}>
                              <Navigation size={9} /> {distKm} km · ~{distH}h
                            </span>
                          )}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Package size={10} /> <strong style={{ color: 'var(--text-primary)' }}>{mult.stockTotal.toLocaleString('fr-FR')} kg</strong> total</span>
                          {mult.telephone && (
                            <a href={`tel:${mult.telephone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                               title="Appeler ce multiplicateur">
                              📞 {mult.telephone}
                            </a>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleContacter(mult.orgId)} disabled={contactingOrg === mult.orgId}
                        style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        <MessageCircle size={11} />
                        {contactingOrg === mult.orgId ? 'Connexion…' : 'Contacter'}
                      </button>
                    </div>

                    {/* Liste des variétés */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {mult.varietes.map((variete, idx) => {
                        const qKey    = `${mult.orgId}-${variete.varieteId}`
                        const isAdded = addedIds.has(variete.varieteId)
                        const inCart  = cart.find(c => c.varieteId === variete.varieteId)
                        const nCfg    = variete.niveauAdaptation ? NIVEAU_CONFIG[variete.niveauAdaptation] : null
                        const zonesBadges = variete.zonesAdaptation
                          .map(zi => ({ zone: zoneMap.get(zi.idZone), niveau: zi.niveau }))
                          .filter(z => z.zone != null) as Array<{ zone: ZoneAgro; niveau: string }>

                        return (
                          <div key={variete.varieteId} style={{ padding: '12px 16px', borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{variete.nomVariete}</span>
                                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)' }}>{variete.codeVariete}</span>
                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>{variete.generation}</span>
                                {!selectedEspece && variete.nomEspece && (
                                  <span style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500 }}>{variete.nomEspece}</span>
                                )}
                                {nCfg && (
                                  <span style={{ background: nCfg.bg, color: nCfg.color, border: `1px solid ${nCfg.color}40`, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{nCfg.label}</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Package size={10} style={{ color: '#16a34a' }} />
                                  <strong style={{ color: 'var(--text-primary)' }}>{variete.stockTotal.toLocaleString('fr-FR')} kg</strong>
                                </span>
                                {variete.tauxGermination > 0 && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Star size={10} style={{ color: '#d97706' }} /> {variete.tauxGermination}%
                                  </span>
                                )}
                              </div>
                              {zonesBadges.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
                                  {zonesBadges.slice(0, 3).map(({ zone, niveau }) => {
                                    const cfg = NIVEAU_CONFIG[niveau]
                                    return (
                                      <span key={zone.id} title={cfg?.label ?? niveau}
                                        style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 99, fontWeight: 600, border: `1px solid ${cfg?.color ?? '#9ca3af'}40`, background: cfg?.bg ?? '#f9fafb', color: cfg?.color ?? '#6b7280', whiteSpace: 'nowrap' }}>
                                        {zone.nom}
                                      </span>
                                    )
                                  })}
                                  {zonesBadges.length > 3 && (
                                    <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 99, fontWeight: 600, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                                      +{zonesBadges.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {inCart && (
                              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '5px 9px', fontSize: 11, color: '#15803d', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, marginBottom: 7 }}>
                                <CheckCircle2 size={11} /> {inCart.quantite.toLocaleString('fr-FR')} kg dans votre panier
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: 7 }}>
                              <input type="number"
                                value={qtyInputs[qKey] ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQtyInputs(prev => ({ ...prev, [qKey]: e.target.value }))}
                                placeholder="Qté (kg)" min="1"
                                style={{ flex: 1, height: 34, borderRadius: 7, border: '1px solid var(--border)', padding: '0 10px', fontSize: 12, fontFamily: 'inherit', background: 'var(--surface-2)', color: 'var(--text-primary)' }} />
                              <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); addToCartFromMult(variete, mult, Number(qtyInputs[qKey] || 500)) }}
                                style={{ height: 34, padding: '0 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: isAdded ? '#15803d' : '#16a34a', color: '#fff', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', transition: 'background 0.15s' }}>
                                {isAdded ? <><CheckCircle2 size={12} /> Ajouté</> : <><ShoppingCart size={12} /> Ajouter</>}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Toast conflit multiplicateur */}
      {cartConflict && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', padding: '16px 20px', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 2100, maxWidth: 460, width: 'calc(100vw - 48px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <X size={16} style={{ color: '#f87171', marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Panier réservé à {cartConflict.current}
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                Validez ou videz d'abord votre commande en cours avant de commander chez <strong style={{ color: '#fff' }}>{cartConflict.blocked}</strong>.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setCartConflict(null); setShowCart(true) }}
              style={{ height: 32, padding: '0 14px', borderRadius: 7, border: '1px solid #475569', background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShoppingCart size={12} /> Voir mon panier
            </button>
            <button
              onClick={() => { setCart([]); setCartConflict(null) }}
              style={{ height: 32, padding: '0 14px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={12} /> Vider le panier
            </button>
          </div>
        </div>
      )}

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
