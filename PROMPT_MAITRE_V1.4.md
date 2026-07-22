# SEED PLATFORM CNRA — PROMPT MAÎTRE V1.4
# Corrigé sur base de l'audit complet du code source réel
# Date : Mars 2026

═══════════════════════════════════════════════════════════════
## 1. PROJET
═══════════════════════════════════════════════════════════════

Plateforme nationale de gestion de la chaîne semencière du CNRA/ISRA
Sénégal. Traçabilité G0→R2, mise en relation quotataires ↔ multiplicateurs,
recherche géographique, messagerie inter-acteurs.

═══════════════════════════════════════════════════════════════
## 2. STACK TECHNIQUE RÉEL
═══════════════════════════════════════════════════════════════

Frontend : React 18 + TypeScript + Vite (port 5173)
Backend  : 4 microservices Spring Boot 3 (Java 21)
  catalog-service  :18081 — espèces, variétés (+ zones Phase 2)
  lot-service      :18082 — lots, campagnes, programmes, certifications, contrôles
  stock-service    :18083 — stocks, sites, transferts stock, mouvements
  order-service    :18084 — commandes, organisations, membres

Infra :
  Keycloak 25      :18080 (realm seed-v0, PKCE)
  PostgreSQL 16    :5432  (DB partagée : seed, ddl-auto=none)
  Kafka            :19092 + kafka-ui :18085
  Prometheus       :19090
  Grafana          :13000

IMPORTANT : Tous les services partagent la même base PostgreSQL "seed".
IMPORTANT : kafka-ui occupe le port 18085 → messaging-service = port 18086.

═══════════════════════════════════════════════════════════════
## 3. COMPTES KEYCLOAK EXISTANTS
═══════════════════════════════════════════════════════════════

| Username       | Rôle               | Nom affiché              |
|----------------|--------------------|--------------------------| 
| admin          | seed-admin         | Admin ISRA               |
| toussaint      | seed-admin         | Toussaint GOMIS          |
| selecteur      | seed-selector      | Ibrahima Sélectionneur   |
| upseml         | seed-upseml        | Fatou UPSemCL            |
| multiplicateur | seed-multiplicator | Moussa Multiplicateur    |
| quotataire     | seed-quotataire    | Aminata Quotataire       |

Mot de passe = même que le username (env dev).

═══════════════════════════════════════════════════════════════
## 4. CHAÎNE SEMENCIÈRE
═══════════════════════════════════════════════════════════════

Sélectionneur (G0→G1) → UPSemCL (G1→G2→G3) → Multiplicateur (G3→G4→R1→R2) → Quotataire

Transferts autorisés (à protéger par CHECK SQL) :
  seed-selector → seed-upseml : G1 uniquement
  seed-upseml   → seed-multiplicator : G3 uniquement

Catalogue quotataire : R1 et R2 uniquement (jamais G3/G4).
Commande : 1 quotataire ↔ 1 multiplicateur, paiement hors plateforme.

═══════════════════════════════════════════════════════════════
## 5. ZONES AGRO-ÉCOLOGIQUES (7 zones ISRA/ANCAR)
═══════════════════════════════════════════════════════════════

| Code | Nom                      | Cultures typiques             |
|------|--------------------------|-------------------------------|
| VFS  | Vallée du Fleuve Sénégal | Riz irrigué, sorgho           |
| BA   | Bassin Arachidier        | Mil, arachide, niébé          |
| SO   | Sénégal Oriental         | Mil, sorgho, maïs, coton      |
| CS   | Casamance                | Riz pluvial, mil, maïs        |
| SP   | Zone Sylvo-Pastorale     | Mil, sorgho aride             |
| NI   | Zone des Niayes          | Maraîchage, horticole         |
| PC   | Petite Côte              | Cultures diversifiées         |

Niveaux d'adaptation variétale : OPTIMAL | ACCEPTABLE | MARGINALE
Le sélectionneur saisit les zones, l'admin peut corriger.

═══════════════════════════════════════════════════════════════
## 6. ÉTAT ACTUEL DU CODE (ce qui EXISTE déjà)
═══════════════════════════════════════════════════════════════

### 6.1 Tables SQL existantes (01_schema.sql)
espece, variete, generation_semence, site, lot_semencier (avec campagne),
stock, mouvement_stock, commande, ligne_commande, allocation_commande

### 6.2 Entités Java existantes
catalog-service : Espece, Variete
lot-service     : LotSemencier, Generation, Campagne, Programme, 
                  Certification, ControleQualite
order-service   : Commande, Organisation (basique)
stock-service   : Site, Stock, Transfert (stock), MouvementStock

### 6.3 Frontend existant (13 pages fonctionnelles)
Dashboard, Varieties, Lots, Stocks, Orders, Certifications,
Transfers, Campagnes, Sites, Organisations, Programs, Users, Profile
+ composants : Modal, ConfirmDialog, Pagination, StatusBadge

### 6.4 Ce qui est DÉJÀ fonctionnel
✅ Auth Keycloak PKCE (singleton window.__seedKeycloak)
✅ JWT Spring Boot via JWK_SET_URI http://keycloak:8080
✅ Dashboard KPIs + pipeline G0→R2
✅ CRUD Lots avec parenté (lot enfant), filtres par génération
✅ LineageModal (traçabilité visuelle mais sans noms acteurs)
✅ CRUD Variétés avec archivage (soft-delete)
✅ CRUD Stocks, Sites, Organisations (basiques)
✅ Page Transferts (UI présente mais vide, 0 transferts)
✅ Page Commandes (UI présente mais vide, 0 commandes)
✅ Gestion utilisateurs admin (Keycloak Admin API)
✅ Profil utilisateur (avatar, edit inline, changement mdp)
✅ CSS cohérent (card, btn, badge, stat-card, skeleton)
✅ Kafka events (lot.created)
✅ Prometheus + Grafana

═══════════════════════════════════════════════════════════════
## 7. RÈGLES DE DÉVELOPPEMENT PERMANENTES
═══════════════════════════════════════════════════════════════

- Jamais de ddl-auto=create/update → ALTER TABLE manuel puis rebuild
- Utiliser les classes CSS existantes (card, btn-primary, badge, etc.)
- Composants existants : Modal, Field, FormInput, FormSelect, FormRow,
  FormActions, Toast, ConfirmDialog, Pagination
- Langue interface : Français exclusivement
- TypeScript strict côté frontend
- Bearer token = keycloak.token (jamais localStorage)
- Pas de suppression physique (soft-delete / archive)
- Messages futurs = auditables (jamais supprimés)
- Kafka : publier événement à chaque action métier
- Vérifier rôle (@PreAuthorize) + propriété dans chaque endpoint
- DB partagée → un service peut créer une entité read-only
  pointant sur la table d'un autre service

═══════════════════════════════════════════════════════════════
## 8. ROADMAP — 6 PHASES PAS-À-PAS
═══════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — ORGANISATIONS ENRICHIES + MEMBRES + TRAÇABILITÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objectif : l'arbre généalogique affiche les noms d'acteurs/organisations.
La table membre_organisation lie les comptes Keycloak aux organisations.

--- SQL ---
ALTER organisation : +localite, +telephone, +email, +latitude, +longitude, +active
CREATE membre_organisation (keycloak_username UNIQUE → organisation)
ALTER lot_semencier : +id_org_producteur, +username_createur, +responsable_nom, +responsable_role
ALTER site : +id_organisation, +latitude, +longitude
NOTE : campagne existe DÉJÀ — ne PAS l'ajouter

--- Backend order-service (:18084) ---
Organisation.java : enrichir avec latitude, longitude, telephone, email, active
MembreOrganisation.java : nouvelle entité
MembreOrganisationRepo.java : nouveau repo
MembreController.java : nouveau controller
  GET  /api/membres                    → tous, filtre ?role=
  GET  /api/membres/username/{u}       → résolution username → profil+org
  GET  /api/membres/organisation/{id}  → membres d'une org
  POST /api/membres                    → seed-admin
OrganisationController.java : enrichir avec @PreAuthorize, filtre region, soft-delete
MethodSecurityConfig.java : activer @PreAuthorize (n'existait pas)

--- Backend lot-service (:18082) ---
LotSemencier.java : +idOrgProducteur, +usernameCreateur, +responsableNom, +responsableRole
LotController.create() : extraire username du JWT, stocker traçabilité
LotController.lineage() : retourner LineageNode DTO avec champs acteur
LineageNode.java : nouveau DTO (record)
CreateChildLotRequest.java : +responsableNom, +responsableRole, +idOrgProducteur

--- Backend stock-service (:18083) ---
Site.java : +idOrganisation, +latitude, +longitude
SiteController.java : gérer les nouveaux champs dans PUT

--- Frontend ---
endpoints.ts : ajouter membres, membreByUsername, membresByOrg
Organisations.tsx : enrichir avec colonnes GPS, type acteur ISRA/UPSEML/MULTIPLICATEUR
Lots.tsx > LineageModal : afficher responsableNom et responsableRole dans chaque nœud

--- Tests Phase 1 ---
SQL : \d organisation → latitude, longitude visibles
SQL : SELECT * FROM membre_organisation → 6 lignes
curl : GET /api/membres/username/selecteur → profil avec organisation ISRA CNRA Bambey
curl : GET /api/lots/1/lineage → nœuds avec responsableNom
curl : POST /api/organisations (token quotataire) → 403
Frontend : connecter en admin → Organisations montre latitude/longitude
Frontend : connecter en quotataire → pas d'accès Organisations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — ZONES AGRO-ÉCOLOGIQUES + CATALOGUE QUOTATAIRE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objectif : quotataire voit R1/R2 filtrés par zone + niveau adaptation.

--- SQL ---
CREATE zone_agro (code, nom, description) + INSERT 7 zones
CREATE variete_zone (id_variete, id_zone, niveau_adaptation CHECK OPTIMAL|ACCEPTABLE|MARGINALE)

--- Backend catalog-service (:18081) ---
ZoneAgro.java + ZoneAgroRepo
VarieteZone.java (clé composite)
GET  /api/zones → public (pas de JWT requis)
PUT  /api/varietes/{id}/zones → seed-selector, seed-admin
GET  /api/varietes/{id}/zones → public

--- Backend stock-service (:18083) ---
GET /api/stocks/catalogue → R1/R2 uniquement, jointure variete+organisation
  Paramètres : espece, idZone
  FILTRE OBLIGATOIRE : generation IN ('R1', 'R2')

--- Frontend ---
Varieties.tsx : section "Zones recommandées" (badges vert/jaune/orange)
CataloguePublic.tsx : NOUVELLE PAGE (seed-quotataire)
  Flux : Espèce (icônes) → Variété (badges adaptation) → Multiplicateur (stock dispo)
App.tsx + getNavSections : ajouter route /catalogue pour seed-quotataire

--- Tests Phase 2 ---
curl : GET /api/zones → 7 zones
curl : PUT /api/varietes/1/zones (sélectionneur) → 200
curl : PUT /api/varietes/1/zones (quotataire) → 403
curl : GET /api/stocks/catalogue → R1/R2 uniquement, jamais G3/G4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2bis — TRANSFERTS ENRICHIS (lot_semencier)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objectif : transferts avec émetteur + destinataire + CHECK flux métier.
DISTINCT du transfert stock existant (table transfert de stock-service).

--- SQL ---
CREATE transfert_lot (emetteur, destinataire, generation_transferee, statut EN_ATTENTE)
  CHECK constraint : selector→upseml G1 ONLY, upseml→multiplicator G3 ONLY

--- Backend lot-service (:18082) ---
TransfertLot.java + repo
POST /api/lots/{id}/transfer : enrichir (destinataireUsername, observations)
PUT  /api/transferts/{id}/accepter → statut ACCEPTE + date_acceptation
PUT  /api/transferts/{id}/refuser → statut REFUSE + motif
GET  /api/transferts/recus → transferts EN_ATTENTE pour le connecté

--- Frontend ---
Lots.tsx : modal transfert → dropdown destinataires (filtrés par rôle cible)
Transfers.tsx : enrichir avec historique + boutons Accepter/Refuser

--- Tests Phase 2bis ---
SQL : INSERT transfert selector→multi → ERROR CHECK
SQL : INSERT transfert selector→upseml G1 → OK
curl : POST /api/lots/1/transfer {destinataireUsername: "upseml"} → 201
curl : PUT /api/transferts/1/accepter → statut ACCEPTE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — GÉOLOCALISATION + PROXIMITÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objectif : quotataire → GPS → multiplicateurs triés par distance.

--- Backend stock-service (:18083) ---
GET /api/stocks/catalogue/proximite?idVariete={}&lat={}&lng={}&rayonKm=100
HaversineUtil.java : calcul distance
Tri résultats par distance ASC

--- Frontend ---
CataloguePublic.tsx : bouton "Trouver près de moi"
  navigator.geolocation.getCurrentPosition()
  Fallback : dropdown régions si GPS refusé
  Cards avec distance "à X km"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4 — COMMANDE ENRICHIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objectif : quotataire commande chez un multiplicateur spécifique.

--- SQL ---
ALTER commande : +id_site_fournisseur, +username_acheteur,
  +id_organisation_acheteur, +id_organisation_fournisseur

--- Backend order-service (:18084) ---
Commande.java : enrichir
POST /api/commandes → seed-quotataire
GET  /api/commandes/mes-commandes → quotataire (filtre par username JWT)
GET  /api/commandes/a-traiter → multiplicateur (filtre par org)
PUT  /api/commandes/{id}/statut → EN_ATTENTE → CONFIRMEE → LIVREE

SÉCURITÉ : vérifier propriété (le multi ne voit que SES commandes)

--- Frontend ---
Orders.tsx : flux 3 étapes (variété → multiplicateur → quantité)
  Mention "Règlement à convenir directement"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 5 — COMMENTAIRES ET NOTATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objectif : quotataires laissent des avis (texte + note /5 + campagne + zone).

--- SQL ---
CREATE commentaire_variete (id_variete, auteur_username, note 1-5, contenu,
  campagne_utilisation, zone_utilisation, archive BOOLEAN)
Règle : 1 commentaire par quotataire par variété par campagne

--- Backend catalog-service (:18081) ---
CommentaireVariete.java + repo
GET  /api/varietes/{id}/commentaires → paginé, public
GET  /api/varietes/{id}/note-moyenne → {moyenne, nombreAvis}
POST /api/varietes/{id}/commentaires → seed-quotataire only
DELETE /api/varietes/{id}/commentaires/{cid} → admin (archive=true)

--- Frontend ---
StarRating.tsx : composant étoiles 1-5
Section commentaires dans détail variété
Note moyenne dans le catalogue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 6 — MESSAGERIE INTER-ACTEURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Objectif : messagerie async texte + audio + image entre acteurs adjacents.

PORT : 18086 (pas 18085 → occupé par kafka-ui)

Canaux autorisés (CHECK SQL + validation Java) :
  quotataire ↔ multiplicateur
  multiplicateur ↔ upseml
  upseml ↔ sélectionneur
  admin ↔ tout le monde

--- Docker ---
messaging-service :18086 (nouveau Spring Boot)
MinIO :9000/9001 (bucket seed-messages)

--- SQL ---
CREATE conversation (participant_1, participant_2, role_1, role_2, CHECK canaux)
CREATE message (id_conversation, expediteur, type TEXT|AUDIO|IMAGE, contenu, url_media,
  mime_type_verifie, lu, created_at — JAMAIS de delete)
CREATE audit_acces_message (admin_username, action, ip_address)
INDEX sur message(id_conversation, created_at DESC)

--- Backend messaging-service (:18086) ---
Validation canaux Java (Map<String, Set<String>>)
Validation uploads Apache Tika (MIME whitelist, audio 2Mo, image 5Mo)
Audio : Opus/WebM (pas WAV — 50Ko vs 5Mo pour 30s sur 3G Sénégal)
Polling GET messages?since={} + 304 Not Modified
Admin : GET /admin/messages + log dans audit_acces_message (CDP loi 2008-12)

--- Frontend ---
Messages.tsx : NOUVELLE PAGE
  Mobile-first : pattern 2 vues (liste / fil), pas split layout
  Hold-to-record audio (MediaRecorder API, mimeType audio/webm;codecs=opus)
  Player <audio>, lightbox <img>
  Badge non-lus dans navbar

═══════════════════════════════════════════════════════════════
## 9. COMMANDES DE RÉFÉRENCE
═══════════════════════════════════════════════════════════════

```bash
# Tokens par rôle
TOKEN_ADMIN=$(curl -s -X POST "http://localhost:18080/realms/seed-v0/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=seed-frontend&username=admin&password=admin" | jq -r '.access_token')

TOKEN_SEL=$(curl -s -X POST "http://localhost:18080/realms/seed-v0/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=seed-frontend&username=selecteur&password=selecteur" | jq -r '.access_token')

TOKEN_UPS=$(curl -s -X POST "http://localhost:18080/realms/seed-v0/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=seed-frontend&username=upseml&password=upseml" | jq -r '.access_token')

TOKEN_MULTI=$(curl -s -X POST "http://localhost:18080/realms/seed-v0/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=seed-frontend&username=multiplicateur&password=multiplicateur" | jq -r '.access_token')

TOKEN_QUOT=$(curl -s -X POST "http://localhost:18080/realms/seed-v0/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=seed-frontend&username=quotataire&password=quotataire" | jq -r '.access_token')

# Rebuild
docker-compose up --build <service-name> -d
docker-compose logs -f <service-name> --tail=50

# SQL
docker exec -it seed-postgres psql -U seed -d seed -c "SQL"
docker exec -it seed-postgres psql -U seed -d seed -c "\d nom_table"
```

═══════════════════════════════════════════════════════════════
## 10. INSTRUCTION PAR SESSION
═══════════════════════════════════════════════════════════════

1. Lire ce prompt + identifier la phase en cours
2. Pour tout changement SQL : ALTER TABLE en PREMIER + vérifier avec \d
3. Modifier entité Java + repo + controller
4. docker-compose up --build <service> -d + vérifier logs
5. Tester avec curl (cas normal + erreur + sécurité)
6. Modifier/créer page frontend TSX
7. docker-compose up --build frontend -d
8. Vérifier visuellement par rôle
9. NE PAS passer à la phase suivante tant que les tests ne passent pas

═══════════════════════════════════════════════════════════════
## 11. CORRECTIONS V1.4 vs V1.3
═══════════════════════════════════════════════════════════════

| # | Correction |
|---|-----------|
| 1 | Port messaging-service : 18086 (pas 18085, pris par kafka-ui) |
| 2 | Organisation reste dans order-service (pas catalog-service) |
| 3 | campagne déjà dans lot_semencier — ne pas ADD COLUMN |
| 4 | Usernames réels : admin, selecteur, multiplicateur, quotataire, upseml, toussaint |
| 5 | DB partagée (seed) → read-only entities cross-service OK |
| 6 | MethodSecurityConfig manquait dans order-service → ajouté |
| 7 | Organisation.contact migré → telephone |
| 8 | client_id Keycloak = seed-frontend (pas seed-front) |

Ce prompt est prêt à être collé en début de n'importe quelle session.
