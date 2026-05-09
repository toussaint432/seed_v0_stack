import { useEffect, useState, useMemo } from 'react'
import {
  ChevronLeft, MapPin, Package, Star, Wheat, Leaf, Sprout,
  Navigation, MessageCircle, ShoppingCart, X, Trash2, CheckCircle2,
  LucideIcon,
} from 'lucide-react'

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

interface CartItem {
  varieteId: number
  nomVariete: string
  codeVariete: string
  nomEspece: string
  idGeneration: number
  generation: string
  quantite: number
  unite: string
  disponible: number
}

type FournisseurEntry = { org: string; region: string; distanceKm?: number; lots: CatalogueItem[] }

const CATALOG = 'http://localhost:18081/api'
const STOCK   = 'http://localhost:18083/api'
const ORDER   = 'http://localhost:18084/api'

/* Mapping code génération → ID PK en base (generation_semence) */
const GEN_ID_MAP: Record<string, number> = { G0:1, G1:2, G2:3, G3:4, G4:5, R1:6, R2:7 }

const ESPECE_ICONS: Record<string, LucideIcon> = {
  default: Leaf,
  MIL: Wheat, SORGHO: Wheat, MAIS: Wheat, RIZ: Sprout,
  ARACHIDE: Sprout, NIEBE: Sprout, COWPEA: Sprout,
}

const NIVEAU_BADGE: Record<string, { label: string; cls: string }> = {
  OPTIMAL:    { label: 'Zone optimale',   cls: 'badge-optimal'    },
  ACCEPTABLE: { label: 'Zone acceptable', cls: 'badge-acceptable' },
  MARGINALE:  { label: 'Zone marginale',  cls: 'badge-marginale'  },
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
    if (!ex) map.set(l.organisationId, { org: l.nomOrganisation, region: l.region, distanceKm: l.distanceKm, lots: [l] })
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

  const [selectedEspece,  setSelectedEspece]  = useState<Espece | null>(null)
  const [selectedVariete, setSelectedVariete] = useState<VarieteGroup | null>(null)
  const [selectedZone,    setSelectedZone]    = useState<ZoneAgro | null>(null)

  const [geoMode,          setGeoMode]          = useState(false)
  const [proximiteItems,   setProximiteItems]   = useState<CatalogueItem[]>([])
  const [proximiteLoading, setProximiteLoading] = useState(false)
  const [proximiteError,   setProximiteError]   = useState<string | null>(null)
  const [contactingOrg,    setContactingOrg]    = useState<number | null>(null)

  /* ── Panier ── */
  const [cart,            setCart]            = useState<CartItem[]>([])
  const [showCart,        setShowCart]        = useState(false)
  const [qtyInputs,       setQtyInputs]       = useState<Record<number, string>>({})
  const [addedIds,        setAddedIds]        = useState<Set<number>>(new Set())
  const [orderObs,        setOrderObs]        = useState('')
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderFeedback,   setOrderFeedback]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  /* ── Actions panier ── */
  function addToCart(v: VarieteGroup) {
    const raw = qtyInputs[v.varieteId]
    const qty = Number(raw || 500)
    if (!qty || qty <= 0) return

    // Préférer R2, sinon R1, sinon première génération disponible
    const r2 = v.lots.find(l => l.generation === 'R2')
    const r1 = v.lots.find(l => l.generation === 'R1')
    const best = r2 ?? r1 ?? v.lots[0]
    const gen   = best?.generation ?? 'R2'
    const idGen = GEN_ID_MAP[gen] ?? 7

    setCart(prev => {
      const existing = prev.find(c => c.varieteId === v.varieteId)
      if (existing) {
        return prev.map(c =>
          c.varieteId === v.varieteId ? { ...c, quantite: c.quantite + qty } : c
        )
      }
      return [...prev, {
        varieteId:   v.varieteId,
        nomVariete:  v.nomVariete,
        codeVariete: v.codeVariete,
        nomEspece:   v.nomEspece,
        idGeneration: idGen,
        generation:  gen,
        quantite:    qty,
        unite:       'kg',
        disponible:  v.stockTotal,
      }]
    })

    // Flash "Ajouté !" pendant 1,8 s
    setAddedIds(prev => { const s = new Set(prev); s.add(v.varieteId); return s })
    setTimeout(() =>
      setAddedIds(prev => { const s = new Set(prev); s.delete(v.varieteId); return s }),
      1800
    )
    setQtyInputs(prev => ({ ...prev, [v.varieteId]: '' }))
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
          codeCommande: code,
          client: 'Commande catalogue',
          idOrganisationFournisseur: null,
          observations: orderObs || null,
          lignes: cart.map(item => ({
            idVariete:    item.varieteId,
            idGeneration: item.idGeneration,
            quantite:     item.quantite,
            unite:        item.unite,
          })),
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error((err as any).message || `Erreur ${resp.status}`)
      }
      setCart([])
      setOrderObs('')
      setShowCart(false)
      setOrderFeedback({ msg: `Commande ${code} soumise — vous serez contacté pour la livraison.`, type: 'success' })
      setTimeout(() => setOrderFeedback(null), 7000)
    } catch (err: any) {
      setOrderFeedback({ msg: err?.message || 'Impossible de soumettre la commande', type: 'error' })
    } finally {
      setSubmittingOrder(false)
    }
  }

  /* ── Contacter un fournisseur ── */
  async function handleContacter(orgId: number) {
    setContactingOrg(orgId)
    try {
      const membresResp = await fetch(`${ORDER}/membres/organisation/${orgId}`, { headers })
      const membres = await membresResp.json()
      const membre = membres.find((m: any) => m.keycloakRole === 'seed-multiplicator') || membres[0]
      if (!membre) return
      await fetch(`${ORDER}/chat/conversations`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinataireUsername: membre.keycloakUsername }),
      })
      onContacter?.()
    } catch { /* ignoré */ }
    finally { setContactingOrg(null) }
  }

  /* ── Recherche de proximité ── */
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
          .then(data => { setProximiteItems(Array.isArray(data) ? data : []); setGeoMode(true); setProximiteLoading(false) })
          .catch(() => { setProximiteError('Erreur de recherche'); setProximiteLoading(false) })
      },
      () => { setProximiteError('Localisation refusée ou indisponible'); setProximiteLoading(false) }
    )
  }

  useEffect(() => {
    fetch(`${CATALOG}/species`, { headers }).then(r => r.json()).then(setEspeces).catch(() => {})
    fetch(`${CATALOG}/zones`).then(r => r.json()).then(setZones).catch(() => {})
  }, [])

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

  const varieteGroups: VarieteGroup[] = useMemo(() => {
    const map = new Map<number, VarieteGroup>()
    for (const item of catalogue) {
      const existing = map.get(item.varieteId)
      if (!existing) {
        map.set(item.varieteId, {
          varieteId: item.varieteId, nomVariete: item.nomVariete,
          codeVariete: item.codeVariete, nomEspece: item.nomEspece,
          niveauAdaptation: item.niveauAdaptation,
          stockTotal: item.quantiteDisponible, nombreFournisseurs: 1, lots: [item],
        })
      } else {
        existing.stockTotal += item.quantiteDisponible
        existing.nombreFournisseurs = new Set(existing.lots.map(l => l.organisationId).concat(item.organisationId)).size
        existing.lots.push(item)
      }
    }
    return Array.from(map.values())
  }, [catalogue])

  const fournisseurs = useMemo(
    () => groupByOrg(geoMode ? proximiteItems : (selectedVariete?.lots ?? [])),
    [geoMode, proximiteItems, selectedVariete]
  )

  const totalCartKg = cart.reduce((s, i) => s + i.quantite, 0)

  /* ─────────────────────────────────────────────────────
     TOAST FEEDBACK & PANIER FLOTTANT (commun à toutes les étapes)
     ───────────────────────────────────────────────────── */
  const CartFloat = () => cart.length > 0 ? (
    <button className="cart-float-btn" onClick={() => setShowCart(true)}>
      <ShoppingCart size={18} />
      <span className="cart-float-count">{cart.length}</span>
      <span className="cart-float-label">
        Mon panier · {totalCartKg.toLocaleString('fr-FR')} kg
      </span>
    </button>
  ) : null

  const FeedbackToast = () => orderFeedback ? (
    <div className={`cart-feedback ${orderFeedback.type}`} onClick={() => setOrderFeedback(null)}>
      {orderFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <X size={15} />}
      {orderFeedback.msg}
    </div>
  ) : null

  /* ── MODAL PANIER ── */
  const CartModal = () => !showCart ? null : (
    <div className="cart-overlay" onClick={() => setShowCart(false)}>
      <div className="cart-modal" onClick={e => e.stopPropagation()}>
        <div className="cart-modal-header">
          <h3>
            <ShoppingCart size={18} />
            Mon panier — {cart.length} variété{cart.length > 1 ? 's' : ''}
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={() => setShowCart(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="cart-items">
          {cart.map(item => (
            <div key={item.varieteId} className="cart-item">
              <div className="cart-item-info">
                <span className="cart-item-nom">{item.nomVariete}</span>
                <div className="cart-item-meta">
                  <span>{item.codeVariete}</span>
                  <span>·</span>
                  <span>{item.nomEspece}</span>
                  <span>·</span>
                  <span className="badge badge-generation" style={{ fontSize: 10, padding: '1px 6px' }}>
                    {item.generation}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                    / {item.disponible.toLocaleString('fr-FR')} kg dispo
                  </span>
                </div>
              </div>
              <div className="cart-item-qty">
                <input
                  type="number"
                  className="cart-qty-input"
                  value={item.quantite}
                  min="1"
                  onChange={e => updateCartItemQty(item.varieteId, Number(e.target.value))}
                />
                <span className="cart-item-unite">kg</span>
              </div>
              <button className="cart-item-remove" onClick={() => removeFromCart(item.varieteId)} title="Retirer">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="cart-obs">
          <label>Observations (optionnel)</label>
          <textarea
            value={orderObs}
            onChange={e => setOrderObs(e.target.value)}
            placeholder="Zone de livraison, urgence, qualité attendue…"
            rows={2}
          />
        </div>

        <div className="cart-total">
          <Package size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
          <strong>{totalCartKg.toLocaleString('fr-FR')} kg</strong> commandés ·{' '}
          {cart.length} variété{cart.length > 1 ? 's' : ''} · R1/R2 certifiées
        </div>

        <button
          className="btn btn-primary cart-submit-btn"
          onClick={submitCartOrder}
          disabled={submittingOrder || cart.length === 0}
        >
          {submittingOrder
            ? 'Envoi en cours…'
            : `Soumettre la commande (${cart.length} variété${cart.length > 1 ? 's' : ''})`}
        </button>

        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
          Votre commande sera traitée par la CNRA / ISRA qui vous contactera pour la livraison.
        </p>
      </div>
    </div>
  )

  /* ── ÉTAPE 1 : Grille espèces ── */
  if (step === 1) return (
    <div className="catalogue-public">
      <FeedbackToast />
      <CartFloat />

      <div className="catalogue-header">
        <h2>Catalogue des semences disponibles</h2>
        <p>Stocks R1 / R2 certifiés chez les multiplicateurs agréés</p>
      </div>

      {zones.length > 0 && (
        <div className="catalogue-zones">
          <span className="zones-label">Ma zone :</span>
          <button className={`zone-chip ${!selectedZone ? 'active' : ''}`} onClick={() => setSelectedZone(null)}>
            Toutes les zones
          </button>
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

      <CartModal />
    </div>
  )

  /* ── ÉTAPE 2 : Variétés avec panier ── */
  if (step === 2) return (
    <div className="catalogue-public">
      <FeedbackToast />
      <CartFloat />

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
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 8, marginBottom: 12 }} />)}
        </div>
      )}

      {!loading && varieteGroups.length === 0 && (
        <div className="catalogue-empty">
          <Package size={40} style={{ opacity: 0.3 }} />
          <p>Aucun stock R1/R2 disponible{selectedZone ? ` en ${selectedZone.nom}` : ''}</p>
        </div>
      )}

      <div className="catalogue-varietes-list">
        {varieteGroups.map(v => {
          const isAdded = addedIds.has(v.varieteId)
          const inCart  = cart.find(c => c.varieteId === v.varieteId)
          return (
            <div key={v.varieteId} className="variete-catalogue-card">
              <div className="variete-card-header">
                <div>
                  <h3 className="variete-card-nom">{v.nomVariete}</h3>
                  <span className="variete-card-code">{v.codeVariete}</span>
                </div>
                <div className="variete-card-badges">
                  {niveauBadge(v.niveauAdaptation)}
                  <span className="badge badge-generation">R1/R2</span>
                  {inCart && (
                    <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                      ✓ {inCart.quantite.toLocaleString('fr-FR')} kg au panier
                    </span>
                  )}
                </div>
              </div>

              <div className="variete-card-stats">
                <span><Package size={14} /> {v.stockTotal.toLocaleString('fr-FR')} kg dispo</span>
                <span><MapPin size={14} /> {v.nombreFournisseurs} fournisseur{v.nombreFournisseurs > 1 ? 's' : ''}</span>
              </div>

              {/* Zone ajout au panier */}
              <div className="variete-card-order">
                <div className="variete-qty-row">
                  <input
                    type="number"
                    className="variete-qty-input"
                    value={qtyInputs[v.varieteId] ?? ''}
                    onChange={e => setQtyInputs(prev => ({ ...prev, [v.varieteId]: e.target.value }))}
                    placeholder="Quantité (kg)"
                    min="1"
                    onClick={e => e.stopPropagation()}
                  />
                  <button
                    className="variete-add-btn"
                    style={isAdded
                      ? { background: '#15803d', color: 'white', borderColor: '#15803d' }
                      : { background: '#16a34a', color: 'white', borderColor: '#16a34a' }
                    }
                    onClick={e => { e.stopPropagation(); addToCart(v) }}
                  >
                    {isAdded
                      ? <><CheckCircle2 size={13} /> Ajouté !</>
                      : <><ShoppingCart size={13} /> Ajouter au panier</>
                    }
                  </button>
                </div>
                <button
                  className="variete-card-link"
                  onClick={() => { setSelectedVariete(v); setGeoMode(false); setStep(3) }}
                >
                  Voir les fournisseurs →
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <CartModal />
    </div>
  )

  /* ── ÉTAPE 3 : Fournisseurs ── */
  return (
    <div className="catalogue-public">
      <FeedbackToast />
      <CartFloat />

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
          <button className="btn btn-secondary" onClick={findProximite} disabled={proximiteLoading}>
            <Navigation size={14} />
            {proximiteLoading ? 'Localisation…' : 'Trouver près de moi'}
          </button>
        )}
        {geoMode && (
          <span className="proximite-label">Fournisseurs dans un rayon de 200 km · triés par distance</span>
        )}
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

      <CartModal />
    </div>
  )
}
