# Seed Platform — Gestion des Semences Agricoles

> Plateforme de gestion de la chaîne semencière développée pour l'**ISRA / CNRA Sénégal**.
> Architecture microservices · Sécurité OAuth2 · Déploiement Docker

[![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Backend](https://img.shields.io/badge/Backend-Spring%20Boot%203-6DB33F?style=flat-square&logo=springboot)](https://spring.io)
[![Auth](https://img.shields.io/badge/Auth-Keycloak%2025%20OAuth2-4D4D4D?style=flat-square&logo=keycloak)](https://www.keycloak.org)
[![DB](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Broker](https://img.shields.io/badge/Broker-Apache%20Kafka-231F20?style=flat-square&logo=apachekafka)](https://kafka.apache.org)
[![Deploy](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?style=flat-square&logo=docker)](https://docs.docker.com/compose)

---

## Présentation

Seed Platform est une application web professionnelle dédiée à la gestion de la **chaîne de certification semencière** au Sénégal. Elle couvre l'ensemble du cycle de vie des semences, des variétés génétiques (G0) jusqu'aux semences commerciales (R2), en passant par la multiplication, le stockage, la certification et la distribution.

### Fonctionnalités

| Module | Description |
|---|---|
| **Tableau de bord** | KPIs en temps réel, pipeline générationnel, lots récents, statuts commandes |
| **Catalogue** | Espèces et variétés — filtre par espèce cliquable, recherche, archivage traçable avec commentaire |
| **Lots semenciers** | Suivi G0 → R2, création de lot enfant, tracabilité (lineage), transfert de génération |
| **Stock** | Inventaire par site, mouvements IN/OUT/TRANSFER, filtre par site |
| **Commandes** | Passation, confirmation, allocation lot → ligne commande, annulation |
| **Qualité & Certifications** | Contrôles qualité laboratoire/terrain, certification officielle, upload document |
| **Transferts** | Transferts inter-organisations avec règles métier par rôle (G1→UPSemCL, G3→Multiplicateur…) |
| **Campagnes** | Gestion des campagnes agricoles (hivernale, contre-saison, irriguée) |
| **Sites** | Sites de stockage et fermes de production (CRUD complet) |
| **Organisations** | Acteurs de la chaîne (ISRA, UPSem, Multiplicateurs, OP) |
| **Programmes** | Programmes de multiplication — planification et suivi |
| **Utilisateurs** | Gestion des comptes Keycloak et attribution des rôles plateforme |
| **Profil** | Informations du compte connecté, rôle actif, tokens JWT |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend React                           │
│           Vite · TypeScript · Lucide React · CSS              │
│                     localhost:5173                            │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP / REST + Bearer JWT
         ┌───────────────┼───────────────┐
         │               │               │               │
   ┌─────▼──────┐  ┌─────▼──────┐  ┌────▼──────┐  ┌────▼──────┐
   │  catalog   │  │    lot     │  │   stock   │  │   order   │
   │  :18081    │  │   :18082   │  │   :18083  │  │   :18084  │
   │            │  │            │  │           │  │           │
   │ Espèces    │  │ Lots       │  │ Stocks    │  │ Commandes │
   │ Variétés   │  │ Campagnes  │  │ Sites     │  │ Alloc.    │
   │ (archive)  │  │ Certif.    │  │ Transferts│  │ Org.      │
   │            │  │ Contrôles  │  │           │  │           │
   │            │  │ Programmes │  │           │  │           │
   └─────┬──────┘  └─────┬──────┘  └────┬──────┘  └────┬──────┘
         └───────────────┴───────────────┴──────────────┘
                                 │
                     ┌───────────▼───────────┐
                     │     Apache Kafka       │
                     │   (événements métier)  │
                     └───────────┬───────────┘
                                 │
               ┌─────────────────┼─────────────────┐
               │                 │                  │
         ┌─────▼──────┐  ┌───────▼────┐  ┌─────────▼─────┐
         │ PostgreSQL │  │  Keycloak  │  │  Prometheus   │
         │    :5432   │  │   :18080   │  │  + Grafana    │
         └────────────┘  └────────────┘  └───────────────┘
```

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite, CSS custom (design system), Lucide React |
| Backend | Spring Boot 3, Spring Security (`@PreAuthorize`), Spring Data JPA, Lombok |
| Base de données | PostgreSQL 16 |
| Authentification | Keycloak 25 (OAuth2 PKCE, JWT, rôles realm) |
| Messagerie | Apache Kafka 7.6 |
| Conteneurisation | Docker, Docker Compose |
| CI/CD | Jenkins (Jenkinsfile inclus) |
| Monitoring | Prometheus, Grafana (dashboards JVM) |

---

## Démarrage rapide

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4.x
- Git

### Installation

```bash
git clone https://github.com/toussaint432/seed_v0_stack.git
cd seed_v0_stack

docker compose up -d --build
```

Le démarrage complet prend environ 60–90 secondes. Attendez que tous les containers soient `healthy`.

### Accès aux services

| Service | URL | Description |
|---|---|---|
| **Frontend** | http://localhost:5173 | Interface principale |
| **Keycloak** | http://localhost:18080 | Administration IAM |
| **Kafka UI** | http://localhost:18085 | Monitoring des topics |
| **Grafana** | http://localhost:13000 | Dashboards métriques |
| **Prometheus** | http://localhost:19090 | Métriques systèmes |
| Catalog API | http://localhost:18081/swagger-ui.html | Espèces & variétés |
| Lot API | http://localhost:18082/swagger-ui.html | Lots, campagnes, certifications, programmes |
| Stock API | http://localhost:18083/swagger-ui.html | Inventaire, sites, transferts |
| Order API | http://localhost:18084/swagger-ui.html | Commandes, organisations |

---

## Comptes utilisateurs (V0)

| Utilisateur | Mot de passe | Rôle | Accès |
|---|---|---|---|
| `admin` | `admin123` | Administrateur ISRA | Vue complète — tous les modules |
| `selecteur` | `select123` | Sélectionneur | Variétés + Lots G0/G1 + Transferts |
| `upseml` | `upseml123` | UPSemCL | Lots G1→G3 + Stock + Certifications |
| `multiplicateur` | `multi123` | Multiplicateur | Lots G3→R2 + Stock + Certifications |
| `quotataire` | `quota123` | Quotataire / OP | Catalogue + Commandes |

---

## Chaîne générationnelle

```
G0  Noyau génétique    ──┐
G1  Pré-base              ├── Sélectionneur  ──►  UPSemCL
G2  Base               ──┘
G3  Certifiée C1       ──┐
G4  Certifiée C2          ├── UPSemCL  ──►  Multiplicateur
R1  Reproductrice      ──┘
R2  Commerciale        ──── Multiplicateur  ──►  Quotataires / OP
```

Chaque lot conserve une référence vers son **lot parent**, permettant une tracabilité complète de l'origine génétique (vue lineage disponible dans l'interface).

---

## Structure du projet

```
seed_v0_stack/
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── api.ts              # Client Axios + intercepteurs JWT
│       │   ├── endpoints.ts        # URLs centralisées de tous les services
│       │   ├── keycloak.ts         # Init Keycloak (singleton HMR-safe)
│       │   ├── env.ts              # Variables d'environnement
│       │   └── types.ts            # Types TypeScript partagés
│       ├── ui/
│       │   ├── App.tsx             # Layout principal, sidebar, navigation par rôle
│       │   ├── components/
│       │   │   ├── Modal.tsx       # Modal + FormInput, FormSelect, FormRow, FormActions, Toast
│       │   │   ├── ConfirmDialog.tsx
│       │   │   ├── Pagination.tsx
│       │   │   └── StatusBadge.tsx
│       │   └── pages/
│       │       ├── Dashboard.tsx       # KPIs, pipeline générationnel, lots récents
│       │       ├── Varieties.tsx       # Catalogue espèces (filtre cliquable) + variétés + archivage
│       │       ├── Lots.tsx            # Lots G0→R2, création enfant, tracabilité, transfert
│       │       ├── Stocks.tsx          # Inventaire + mouvements
│       │       ├── Orders.tsx          # Commandes + allocation
│       │       ├── Certifications.tsx  # Contrôles qualité + certification officielle
│       │       ├── Transfers.tsx       # Transferts inter-organisations
│       │       ├── Campagnes.tsx       # Campagnes agricoles
│       │       ├── Sites.tsx           # Sites de stockage et production
│       │       ├── Organisations.tsx   # Acteurs de la filière
│       │       ├── Programs.tsx        # Programmes de multiplication
│       │       ├── Users.tsx           # Gestion Keycloak (admin)
│       │       └── Profile.tsx         # Profil utilisateur connecté
│       └── styles.css              # Design system complet (variables CSS, composants)
│
├── services/
│   ├── catalog-service/            # Port 18081
│   │   └── api/CatalogController   # GET/POST espèces & variétés
│   │                               # PATCH /varieties/{id}/statut
│   │                               # PATCH /varieties/{id}/archive  ← archivage traçable
│   │                               # DELETE /varieties/{id}         ← suppression si ARCHIVEE
│   │
│   ├── lot-service/                # Port 18082
│   │   └── api/
│   │       ├── LotController       # CRUD lots, création enfant, transfert
│   │       ├── CampagneController  # Campagnes agricoles
│   │       ├── CertificationController    # Certifications de lots
│   │       ├── ControleQualiteController  # Contrôles qualité
│   │       └── ProgrammeController        # Programmes de multiplication
│   │
│   ├── stock-service/              # Port 18083
│   │   └── api/
│   │       ├── StockController     # Stocks + mouvements
│   │       ├── SiteController      # Sites de stockage
│   │       └── TransfertController # Transferts physiques
│   │
│   └── order-service/              # Port 18084
│       └── api/
│           ├── OrderController     # Commandes + allocation
│           └── OrganisationController  # Organisations
│
├── infra/
│   ├── postgres/init/
│   │   ├── 01_schema.sql           # Schéma complet (espece, variete, lot_semencier,
│   │   │                           #   site, stock, mouvement_stock, commande…)
│   │   └── 02_seed_data.sql        # Données de test
│   ├── keycloak/                   # Realm JSON (import automatique)
│   ├── prometheus/                 # Configuration scrape
│   └── grafana/                   # Dashboards JVM
│
├── docs/
│   ├── scenario_test.md
│   └── api_contracts.md
├── Jenkinsfile
└── docker-compose.yml
```

---

## Développement local (sans Docker)

```bash
# Démarrer uniquement l'infrastructure
docker compose up -d postgres keycloak kafka zookeeper

# Lancer un microservice (exemple)
cd services/catalog-service
mvn spring-boot:run

# Lancer le frontend
cd frontend
npm install
npm run dev
```

> Variables d'environnement requises par chaque service : voir `docker-compose.yml`.

---

## Scénario de test end-to-end

1. Connectez-vous avec **`selecteur`**
2. Allez dans **Variétés & Espèces** → créez une espèce puis une variété
3. Allez dans **Lots G0/G1** → créez un lot G0 lié à cette variété
4. Créez un lot enfant G1 depuis ce lot G0
5. Dans **Transferts**, transférez le lot G1 vers UPSemCL
6. Connectez-vous avec **`upseml`** → réceptionnez et créez un lot G3
7. Enregistrez un mouvement de stock dans **Stock**
8. Connectez-vous avec **`quotataire`** → passez une commande R2
9. Connectez-vous avec **`upseml`** → allouez la commande à un lot

---

## Rôles et navigation

| Rôle Keycloak | Sections visibles |
|---|---|
| `seed-admin` | Tout — Catalogue, Lots, Production, Logistique, Référentiels, Administration, Monitoring |
| `seed-selector` | Recherche (Variétés + Lots G0/G1) · Transferts · Qualité |
| `seed-upseml` | Multiplication (Lots G1→G3 + Programmes) · Gestion (Stock + Certif. + Transferts) |
| `seed-multiplicator` | Production (Lots G3→R2 + Programmes) · Gestion (Stock + Certif.) |
| `seed-quotataire` | Catalogue semences · Commandes |

---

## Roadmap

### Réalisé (V0)
- [x] Authentification OAuth2 PKCE via Keycloak, navigation par rôle
- [x] Catalogue espèces & variétés avec archivage traçable (commentaire + auteur)
- [x] Suivi générationnel G0 → R2, traçabilité lineage, création lot enfant
- [x] Inventaire stock par site, mouvements IN/OUT/TRANSFER
- [x] Commandes et allocation lot → ligne commande
- [x] Contrôles qualité et certification des lots (avec upload document)
- [x] Transferts inter-organisations avec règles métier par rôle
- [x] Campagnes, Sites, Organisations, Programmes de multiplication
- [x] Gestion des utilisateurs Keycloak (admin)
- [x] Monitoring Prometheus + Grafana + Kafka UI

### En cours / V1
- [ ] Génération de rapports PDF (bilan campagne, état stock)
- [ ] Notifications email / SMS sur événements critiques
- [ ] Workflow de validation multi-étapes pour certifications
- [ ] Pagination serveur sur les listes volumineuses
- [ ] Application mobile (React Native)
- [ ] Déploiement cloud (AWS / Azure)

---

## Contexte

Ce projet a été développé dans le cadre d'un **Master 2 en Développement Full Stack** et répond aux besoins réels du **Centre National de Recherche Agronomique (CNRA)** au Sénégal pour la modernisation de la gestion de la chaîne semencière nationale.

---

<div align="center">
  <sub>Développé pour l'agriculture sénégalaise · ISRA / CNRA · 2025–2026</sub>
</div>
