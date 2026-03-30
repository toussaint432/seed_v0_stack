import React, { useEffect, useState } from 'react'
import { ChevronLeft, MapPin, Package, Star, Wheat, Leaf, Sprout, Navigation, MessageCircle } from 'lucide-react'

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
}

interface ZoneAgro { id: number; code: string; nom: string }

interface VarieteGroup {
  varieteId: number; nomVariete: string; codeVariete: string
  nomEspece: string; niveauAdaptation: string | null
  stockTotal: number; nombreFournisseurs: number
  lots: CatalogueItem[]
}

type FournisseurEntry = { org: string; region: string; distanceKm?: number; lots: CatalogueItem[] }

const CATALOG  = 'http://localhost:18081/api'
const STOCK    = 'http://localhost:18083/api'
const ORDER    = 'http://localhost:18084/api'

const ESPECE_ICONS: Record<string, React.ElementType> = {
  default: Leaf,
  MIL: Wheat, SORGHO: Wheat, MAIS: Wheat, RIZ: Sprout,
  ARACHIDE: Sprout, NIEBE: Sprout, COWPEA: Sprout,
}

const NIVEAU_BADGE: Record<string, { label: string; cls: string }> = {
  OPTIMAL:    { label: 'Zone optimale',    cls: 'badge-optimal'    },
  ACCEPTABLE: { label: 'Zone acceptable',  cls: 'badge-acceptable' },
  MARGINALE:  { label: 'Zone marginale',   cls: 'badge-marginale'  },
}

function niveauBadge(n: string | null) {
  if (!n) return null
  const b = NIVEAU_BADGE[n]
  if (!b) return null
  return <span className={`badge ${b.cls}`}>{b.label}</span>
}

function groupByOrg(items: CatalogueItem[]): FournisseurEntry[] {
  const map = new Map<number, FournisseurEntry>()
  for (const l of items) {
    const ex = map.get(l.organisationId)
    if (!ex) map.set(l.organisationId, {
      org: l.nomOrganisation, region: l.region,
      distanceKm: l.distanceKm, lots: [l],
    })
    else ex.lots.push(l)
  }
  return Array.from(map.values())
}

/* ── Composant principal ──────────────────────────────── */
export function CataloguePublic({ token, onContacter }: { roleKey: string; token: string; onContacter?: () => void }) {
  const headers = { Authorization: `Bearer ${token}` }

  const [step,       setStep]       = useState<1 | 2 | 3>(1)
  const [especes,    setEspeces]    = useState<Espece[]>([])
  const [zones,      setZones]      = useState<ZoneAgro[]>([])
  const [catalogue,  setCatalogue]  = useState<CatalogueItem[]>([])
  const [loading,    setLoading]    = useState(false)

  const [selectedEspece,   setSelectedEspece]   = useState<Espece | null>(null)
  const [selectedVariete,  setSelectedVariete]  = useState<VarieteGroup | null>(null)
  const [selectedZone,     setSelectedZone]     = useState<ZoneAgro | null>(null)

  const [geoMode,          setGeoMode]          = useState(false)
  const [proximiteItems,   setProximiteItems]   = useState<CatalogueItem[]>([])
  const [proximiteLoading, setProximiteLoading] = useState(false)
  const [proximiteError,   setProximiteError]   = useState<string | null>(null)
  const [contactingOrg,    setContactingOrg]    = useState<number | null>(null)

  async function handleContacter(orgId: number) {
    setContactingOrg(orgId)
    try {
      // Résoudre l'org → premier membre multiplicateur
      const membresResp = await fetch(`${ORDER}/membres/organisation/${orgId}`, { headers })
      const membres = await membresResp.json()
      const membre = membres.find((m: any) => m.keycloakRole === 'seed-multiplicator') || membres[0]
      if (!membre) return
      // Créer ou retrouver la conversation
      await fetch(`${ORDER}/chat/conversations`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinataireUsername: membre.keycloakUsername }),
      })
      onContacter?.()
    } catch { /* ignoré */ }
    finally { setContactingOrg(null) }
  }

  function findProximite() {
    if (!navigator.geolocation) {
      setProximiteError('Géolocalisation non supportée par votre navigateur')
      return
    }
    setProximiteLoading(true)
    setProximiteError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng), rayonKm: '200' })
        if (selectedVariete) params.set('idVariete', String(selectedVariete.varieteId))
        fetch(`${STOCK}/stocks/catalogue/proximite?${params}`, { headers })
          .then(r => r.json())
          .then(data => {
            setProximiteItems(Array.isArray(data) ? data : [])
            setGeoMode(true)
            setProximiteLoading(false)
          })
          .catch(() => { setProximiteError('Erreur de recherche'); setProximiteLoading(false) })
      },
      () => { setProximiteError('Localisation refusée ou indisponible'); setProximiteLoading(false) }
    )
  }

  /* Charger espèces + zones au montage */
  useEffect(() => {
    fetch(`${CATALOG}/species`, { headers }).then(r => r.json()).then(setEspeces).catch(() => {})
    fetch(`${CATALOG}/zones`).then(r => r.json()).then(setZones).catch(() => {})
  }, [])

  /* Charger catalogue quand l'espèce ou la zone change */
  useEffect(() => {
    if (!selectedEspece) return
    setLoading(true)
    const params = new URLSearchParams({ espece: selectedEspece.codeEspece })
    if (selectedZone) params.set('idZone', String(selectedZone.id))
    fetch(`${STOCK}/stocks/catalogue?${params}`, { headers })
      .then(r => r.json())
      .then(data => { setCatalogue(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedEspece, selectedZone])

  /* Grouper par variété */
  const varieteGroups: VarieteGroup[] = React.useMemo(() => {
    const map = new Map<number, VarieteGroup>()
    for (const item of catalogue) {
      const existing = map.get(item.varieteId)
      if (!existing) {
        map.set(item.varieteId, {
          varieteId: item.varieteId,
          nomVariete: item.nomVariete,
          codeVariete: item.codeVariete,
          nomEspece: item.nomEspece,
          niveauAdaptation: item.niveauAdaptation,
          stockTotal: item.quantiteDisponible,
          nombreFournisseurs: 1,
          lots: [item],
        })
      } else {
        existing.stockTotal += item.quantiteDisponible
        existing.nombreFournisseurs = new Set(existing.lots.map(l => l.organisationId).concat(item.organisationId)).size
        existing.lots.push(item)
      }
    }
    return Array.from(map.values())
  }, [catalogue])

  /* Fournisseurs pour étape 3 (mode normal ou proximité) */
  const fournisseurs = React.useMemo(
    () => groupByOrg(geoMode ? proximiteItems : (selectedVariete?.lots ?? [])),
    [geoMode, proximiteItems, selectedVariete]
  )

  /* ── ÉTAPE 1 : Grille espèces ── */
  if (step === 1) return (
    <div className="catalogue-public">
      <div className="catalogue-header">
        <h2>Catalogue des semences disponibles</h2>
        <p>Stocks R1 / R2 certifiés chez les multiplicateurs agréés</p>
      </div>

      {zones.length > 0 && (
        <div className="catalogue-zones">
          <span className="zones-label">Ma zone :</span>
          <button
            className={`zone-chip ${!selectedZone ? 'active' : ''}`}
            onClick={() => setSelectedZone(null)}
          >Toutes les zones</button>
          {zones.map(z => (
            <button
              key={z.id}
              className={`zone-chip ${selectedZone?.id === z.id ? 'active' : ''}`}
              onClick={() => setSelectedZone(z)}
            >{z.nom}</button>
          ))}
        </div>
      )}

      <div className="catalogue-especes-grid">
        {especes.map(e => {
          const Icon = ESPECE_ICONS[e.codeEspece] ?? ESPECE_ICONS.default
          return (
            <button
              key={e.id}
              className="espece-card"
              onClick={() => { setSelectedEspece(e); setStep(2) }}
            >
              <div className="espece-icon"><Icon size={32} /></div>
              <span className="espece-nom">{e.nomCommun}</span>
              <span className="espece-code">{e.codeEspece}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  /* ── ÉTAPE 2 : Variétés ── */
  if (step === 2) return (
    <div className="catalogue-public">
      <div className="catalogue-nav">
        <button className="btn-back" onClick={() => setStep(1)}>
          <ChevronLeft size={16} /> Espèces
        </button>
        <span className="catalogue-breadcrumb">
          {selectedEspece?.nomCommun}
          {selectedZone && <> · <span className="zone-tag">{selectedZone.nom}</span></>}
        </span>
      </div>

      {loading && (
        <div className="catalogue-loading">
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 8, marginBottom: 12 }} />)}
        </div>
      )}

      {!loading && varieteGroups.length === 0 && (
        <div className="catalogue-empty">
          <Package size={40} style={{ opacity: 0.3 }} />
          <p>Aucun stock R1/R2 disponible{selectedZone ? ` en ${selectedZone.nom}` : ''}</p>
        </div>
      )}

      <div className="catalogue-varietes-list">
        {varieteGroups.map(v => (
          <div key={v.varieteId} className="variete-catalogue-card">
            <div className="variete-card-header">
              <div>
                <h3 className="variete-card-nom">{v.nomVariete}</h3>
                <span className="variete-card-code">{v.codeVariete}</span>
              </div>
              <div className="variete-card-badges">
                {niveauBadge(v.niveauAdaptation)}
                <span className="badge badge-generation">R1/R2</span>
              </div>
            </div>
            <div className="variete-card-stats">
              <span><Package size={14} /> {v.stockTotal.toLocaleString('fr-FR')} kg dispo</span>
              <span><MapPin size={14} /> {v.nombreFournisseurs} fournisseur{v.nombreFournisseurs > 1 ? 's' : ''}</span>
            </div>
            <button
              className="btn btn-primary variete-card-btn"
              onClick={() => { setSelectedVariete(v); setGeoMode(false); setStep(3) }}
            >Voir les fournisseurs →</button>
          </div>
        ))}
      </div>
    </div>
  )

  /* ── ÉTAPE 3 : Multiplicateurs ── */
  return (
    <div className="catalogue-public">
      <div className="catalogue-nav">
        <button className="btn-back" onClick={() => setStep(2)}>
          <ChevronLeft size={16} /> Variétés
        </button>
        <span className="catalogue-breadcrumb">
          {selectedVariete?.nomVariete}
          {niveauBadge(selectedVariete?.niveauAdaptation ?? null)}
        </span>
      </div>

      {/* Barre de proximité */}
      <div className="proximite-bar">
        {geoMode ? (
          <button className="btn btn-secondary" onClick={() => setGeoMode(false)}>
            <ChevronLeft size={14} /> Tous les fournisseurs
          </button>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={findProximite}
            disabled={proximiteLoading}
          >
            <Navigation size={14} />
            {proximiteLoading ? 'Localisation…' : 'Trouver près de moi'}
          </button>
        )}
        {geoMode && <span className="proximite-label">Fournisseurs dans un rayon de 200 km · triés par distance</span>}
        {proximiteError && <span className="proximite-error">{proximiteError}</span>}
      </div>

      {geoMode && fournisseurs.length === 0 && (
        <div className="catalogue-empty">
          <Navigation size={40} style={{ opacity: 0.3 }} />
          <p>Aucun fournisseur trouvé dans un rayon de 200 km</p>
        </div>
      )}

      <div className="fournisseurs-list">
        {fournisseurs.map(f => {
          const totalQte = f.lots.reduce((acc, l) => acc + l.quantiteDisponible, 0)
          return (
            <div key={f.org} className="fournisseur-card card">
              <div className="fournisseur-header">
                <div>
                  <h3 className="fournisseur-nom">{f.org}</h3>
                  <span className="fournisseur-region"><MapPin size={12} /> {f.region}</span>
                </div>
                <div className="fournisseur-stock">
                  {f.distanceKm != null && (
                    <span className="distance-badge">
                      <Navigation size={11} /> {Math.round(f.distanceKm)} km
                    </span>
                  )}
                  <span className="stock-qty">{totalQte.toLocaleString('fr-FR')}</span>
                  <span className="stock-unit">kg</span>
                </div>
              </div>

              <div className="fournisseur-details">
                {f.lots.map(l => (
                  <div key={l.lotId} className="fournisseur-lot">
                    <span className="lot-code">{l.codeLot}</span>
                    <span className="lot-gen badge badge-generation">{l.generation}</span>
                    <span className="lot-campagne">{l.campagne}</span>
                    {l.tauxGermination && (
                      <span className="lot-germination">
                        <Star size={11} /> {l.tauxGermination}% germin.
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="fournisseur-footer">
                <span className="paiement-note">💬 Règlement à convenir directement</span>
                <button
                  className="btn btn-primary"
                  onClick={() => handleContacter(f.lots[0].organisationId)}
                  disabled={contactingOrg === f.lots[0].organisationId}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <MessageCircle size={14} />
                  {contactingOrg === f.lots[0].organisationId ? 'Connexion…' : 'Contacter'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
