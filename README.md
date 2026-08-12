# Sen Jiwu — Plateforme de Gestion des Semences Agricoles

> Système d'information semencier développé pour l'**ISRA / CNRA Bambey — Sénégal**.
> Architecture microservices · Authentification OAuth2/OIDC · Déploiement Docker Compose
>
> *« Sen Jiwu » signifie « Votre semence » en wolof.*

[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Backend](https://img.shields.io/badge/Backend-Spring%20Boot%203.5%20%2F%20Java%2021-6DB33F?style=flat-square&logo=springboot)](https://spring.io)
[![Auth](https://img.shields.io/badge/Auth-Keycloak%2025%20OAuth2--PKCE-4D4D4D?style=flat-square&logo=keycloak)](https://www.keycloak.org)
[![DB](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Broker](https://img.shields.io/badge/Broker-Apache%20Kafka%207.6-231F20?style=flat-square&logo=apachekafka)](https://kafka.apache.org)
[![Deploy](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?style=flat-square&logo=docker)](https://docs.docker.com/compose)

---

## Présentation

**Sen Jiwu** est une application web professionnelle dédiée à la gestion de la **chaîne de certification semencière** au Sénégal. Elle couvre l'intégralité du cycle de vie des semences — des variétés génétiques pures (G0) jusqu'aux semences commerciales distribuées (R2) — en assurant la traçabilité générationnelle, la gestion des stocks, la certification et la distribution entre acteurs.

### Modules fonctionnels

| Module | Description |
|---|---|
| **Tableau de bord** | KPIs en temps réel, pipeline générationnel G0→R2, lots récents, statuts des commandes |
| **Catalogue public** | Vitrine des espèces et variétés accessibles sans authentification (cartographie ZAE) |
| **Variétés & Espèces** | Référentiel variétal ISRA avec archivage traçable (commentaire + auteur + date) |
| **Lots semenciers** | Cycle de vie G0 → R2, création de lot enfant, traçabilité lineage, certificats PDF |
| **Mes Sites** | Sites de stockage personnels du multiplicateur — CRUD complet |
| **Stock** | Inventaire par site et organisation, mouvements IN/OUT/TRANSFER, isolation par acteur |
| **Commandes** | Passation G3/R2, confirmation, allocation lot → ligne commande, workflow livraison |
| **Transferts** | Transferts inter-organisations avec règles métier par rôle, lot REC automatique à réception |
| **Certifications** | Contrôles qualité laboratoire/terrain, certification officielle, upload de document |
| **Campagnes** | Gestion des campagnes agricoles (hivernale, contre-saison, irriguée) |
| **Sites** | Sites de stockage et fermes de production — vue globale (admin/UPSemCL) |
| **Programmes** | Programmes de multiplication — planification et suivi |
| **Utilisateurs** | Gestion des comptes Keycloak et attribution des rôles plateforme (admin) |
| **Messages** | Messagerie interne entre acteurs de la chaîne |
| **Analytiques** | Tableaux de bord avancés — vue globale et vue sélectionneur |
| **Profil** | Informations du compte connecté, rôle actif, tokens JWT |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Navigateur utilisateur                           │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Frontend React/TS — Nginx (Docker)  :5173               │
│      Keycloak PKCE · Vite · Leaflet · Lucide React · CSS custom      │
└────┬──────────────┬──────────────┬──────────────┬────────────────────┘
     │ OAuth2/OIDC  │ REST + JWT   │ REST + JWT   │ REST + JWT   │ REST + JWT
     ▼              ▼              ▼              ▼              ▼
┌──────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ ┌────────────┐
│Keycloak  │ │catalog-svc  │ │  lot-svc    │ │ stock-svc  │ │ order-svc  │
│  :18080  │ │  :18081     │ │   :18082    │ │   :18083   │ │   :18084   │
│          │ │Variétés     │ │Lots G0→R2   │ │Inventaire  │ │Commandes   │
│SSO/JWT   │ │Espèces      │ │Transferts   │ │Sites       │ │Allocations │
│realm     │ │PDF fiches   │ │Certif./PDF  │ │Mouvements  │ │Livraisons  │
│seed-v0   │ │Zones ZAE    │ │Campagnes    │ │Transferts  │ │Membres     │
└──────────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ └──────┬─────┘
                    └───────────────┴───────────────┴───────────────┘
                                            │ SQL / JDBC
                              ┌─────────────┴─────────────┐
                              │                           │
                    ┌─────────▼──────────┐   ┌───────────▼──────────┐
                    │   PostgreSQL 16    │   │    Apache Kafka       │
                    │   base « seed »    │   │   Bus d'événements   │
                    │     :15432         │   │      :19092           │
                    │                   │   └──────────────────────┘
                    │  Schema per Svc   │
                    │  ─────────────    │
                    │  catalog  · geo   │
                    │  lot      · stock │
                    │  orders   · shared│
                    └────────────────────┘

Monitoring : Prometheus :19090 · Grafana :13000 · Alertmanager :19093 · Kafka UI :18085
```

### Schema per Service

La base PostgreSQL `seed` est organisée en **6 schémas distincts** — un par domaine métier — garantissant l'isolation logique des données entre services tout en conservant une base unique :

| Schéma | Propriétaire | Tables principales |
|---|---|---|
| `catalog` | catalog-service | `espece`, `variete`, `variete_zone`, `espece_historique`, `variete_historique` |
| `lot` | lot-service | `lot_semencier`, `campagne`, `generation_semence`, `certification`, `transfert_lot`, `outbox_events` |
| `stock` | stock-service | `stock`, `site`, `mouvement_stock`, `transfert`, `outbox_events` |
| `orders` | order-service | `commande`, `ligne_commande`, `allocation_commande` |
| `shared` | order-service | `organisation`, `membre_organisation`, `conversation`, `message` |
| `geo` | catalog-service | `regions`, `departements`, `zone_agro`, `departement_zone` |

Les migrations Flyway sont gérées exclusivement par `catalog-service` ; la table `flyway_schema_history` reste dans le schéma `public`.

---

## Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Frontend | React + TypeScript | 18 / TS 5 |
| Build & Serveur | Vite + Nginx (Alpine) | 5.x |
| Cartographie | Leaflet.js | 1.9 |
| Backend | Spring Boot + Java | 3.5 / Java 21 |
| Sécurité API | Spring Security, OAuth2/OIDC | — |
| Base de données | PostgreSQL | 16 |
| Migrations DB | Flyway | — |
| Authentification | Keycloak | 25.0.4 |
| Messagerie async | Apache Kafka + ZooKeeper | cp-kafka 7.6.1 |
| Conteneurisation | Docker + Docker Compose | Engine 26 / v2 |
| Génération PDF | iText / PDFBox (Spring) | — |
| Monitoring | Prometheus + Grafana + Alertmanager | 2.52 / 10.4.3 |

---

## Démarrage rapide

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4.x (ou Docker Engine + Compose v2)
- Git

### Installation

```bash
git clone https://github.com/toussaint432/seed_v0_stack.git
cd seed_v0_stack

docker compose up -d --build
```

Le démarrage complet prend **2–3 minutes**. Attendre que tous les containers soient `healthy` :

```bash
docker compose ps
```

### Accès aux services

| Service | URL | Identifiants / Notes |
|---|---|---|
| **Frontend** | http://localhost:5173 | Interface principale |
| **Keycloak** | http://localhost:18080 | admin / admin (console admin) |
| **Kafka UI** | http://localhost:18085 | Monitoring des topics Kafka |
| **Grafana** | http://localhost:13000 | admin / admin — dashboards JVM & infra |
| **Prometheus** | http://localhost:19090 | Métriques système |
| **Alertmanager** | http://localhost:19093 | Règles d'alerte |
| Catalog API | http://localhost:18081/actuator/health | Variétés, espèces, PDF, ZAE |
| Lot API | http://localhost:18082/actuator/health | Lots, campagnes, certifications |
| Stock API | http://localhost:18083/actuator/health | Inventaire, sites, mouvements |
| Order API | http://localhost:18084/actuator/health | Commandes, livraisons, membres |

---

## Comptes utilisateurs

| Utilisateur | Mot de passe | Rôle Keycloak | Accès |
|---|---|---|---|
| `admin` | `admin123` | `seed-admin` | Supervision complète — tous les modules |
| `selecteur` | `select123` | `seed-selector` | Variétés + Lots G0/G1 + Transferts + Analytiques |
| `upseml` | `upseml123` | `seed-upsemcl` | Lots G1→G3 + Stock + Certifications + Commandes reçues |
| `multiplicateur` | `multi123` | `seed-multiplicator` | Lots G3→R2 + Mes Sites + Stock + Commandes G3 |
| `multi_fatick` | `multifat123` | `seed-multiplicator` | Idem multiplicateur — organisation Fatick |
| `quotataire` | `quota123` | `seed-quotataire` | Catalogue semences R2 + Commandes |

> **Realm Keycloak** : `seed-v0` · **Client** : `seed-frontend`

---

## Isolation des données par rôle

Chaque acteur est strictement isolé — il ne voit que ses propres ressources :

| Rôle | Lots visibles | Stock visible | Commandes visibles |
|---|---|---|---|
| `seed-selector` | Lots dont il est auteur (G0/G1) | — | — |
| `seed-upsemcl` | Tous les lots G1→G3 de l'UPSemCL | Stock UPSemCL | Commandes reçues (org UPSemCL) |
| `seed-multiplicator` | Ses propres lots + lots reçus (REC) | Son stock propre (org) | Ses propres commandes G3 passées |
| `seed-quotataire` | Uniquement les lots R2 DISPONIBLES | — | Ses propres commandes R2 |
| `seed-admin` | Tout | Tout | Tout |

**Lot REC** : à chaque livraison validée, un lot de réception (`REC-{commandeId}-L{ligneId}`) est créé automatiquement avec l'organisation du multiplicateur comme producteur — il apparaît immédiatement dans « Mes Lots » et dans le stock de l'acheteur.

---

## Chaîne générationnelle

```
G0  Noyau génétique   ─┐
G1  Pré-base            ├── Sélectionneur (ISRA)  ──►  UPSemCL
G2  Base              ─┘
                        
G3  Certifiée C1      ─┐
R1  Reproductrice       ├── UPSemCL               ──►  Multiplicateur
                      ─┘
                        
R2  Commerciale       ───── Multiplicateur         ──►  Quotataires / OP
```

Chaque lot conserve une référence vers son **lot parent**, permettant une traçabilité complète de l'origine génétique (vue lineage disponible dans l'interface). La génération est automatiquement proposée à la création d'un lot enfant.

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
│       │   ├── pdf/                # Générateurs PDF (facture, bon de transfert)
│       │   └── types.ts            # Types TypeScript partagés
│       └── ui/
│           ├── App.tsx             # Layout principal, sidebar, navigation par rôle
│           ├── components/         # Modal, ConfirmDialog, Pagination, StatusBadge, Toast
│           └── pages/
│               ├── LandingPage.tsx         # Page d'accueil publique Sen Jiwu
│               ├── CataloguePublic.tsx     # Catalogue accessible sans auth + carte Leaflet
│               ├── Dashboard.tsx           # KPIs, pipeline générationnel
│               ├── Varieties.tsx           # Espèces & variétés + archivage traçable
│               ├── Lots.tsx                # Lots G0→R2, création enfant, lineage
│               ├── MesSites.tsx            # Sites de stockage du multiplicateur
│               ├── Stocks.tsx              # Inventaire + mouvements
│               ├── Orders.tsx              # Commandes + allocation + livraison
│               ├── Transfers.tsx           # Transferts inter-organisations
│               ├── Certifications.tsx      # Contrôles qualité + certification
│               ├── Campagnes.tsx           # Campagnes agricoles
│               ├── Sites.tsx               # Sites globaux (admin/UPSemCL)
│               ├── Programs.tsx            # Programmes de multiplication
│               ├── Messages.tsx            # Messagerie interne
│               ├── GlobalAnalytics.tsx     # Tableau de bord analytique global
│               ├── SelectorAnalytics.tsx   # Analytiques sélectionneur
│               ├── Users.tsx               # Gestion Keycloak (admin)
│               └── Profile.tsx             # Profil utilisateur connecté
│
├── services/
│   ├── catalog-service/            # :18081 — Référentiel variétal
│   │   └── api/
│   │       ├── CatalogController   # Espèces, variétés, archivage traçable, historique
│   │       ├── DocumentController  # Génération PDF fiches variétales & itinéraires
│   │       └── ZoneController      # Zones agro-écologiques (ZAE) + cartographie
│   │
│   ├── lot-service/                # :18082 — Cycle de vie des lots
│   │   └── api/
│   │       ├── LotController           # CRUD lots, création enfant, isolation par rôle
│   │       ├── LotDocumentController   # Génération PDF certificat de lot
│   │       ├── TransfertController     # Transferts entre organisations
│   │       ├── CampagneController      # Campagnes agricoles
│   │       ├── CertificationController # Certifications officielles
│   │       ├── ControleQualiteController # Contrôles qualité terrain/labo
│   │       ├── GenerationController    # Référentiel des générations (G0→R2)
│   │       └── ProgrammeController     # Programmes de multiplication
│   │
│   ├── stock-service/              # :18083 — Stocks & sites
│   │   └── api/
│   │       ├── StockController     # Inventaire + mouvements (IN/OUT/TRANSFER)
│   │       ├── SiteController      # Sites de stockage et production
│   │       ├── CatalogueController # Catalogue des lots disponibles par proximité
│   │       └── TransfertController # Transferts physiques inter-sites
│   │
│   └── order-service/              # :18084 — Commandes & livraisons
│       └── api/
│           ├── OrderController         # Commandes, allocation, workflow livraison
│           ├── OrganisationController  # Organisations de la filière
│           ├── MembreController        # Membres des organisations
│           └── ChatController          # Messagerie inter-acteurs
│
├── infra/
│   ├── keycloak/                   # Realm seed-v0 (import automatique), thème ISRA
│   ├── postgres/init/              # Schéma initial (remplacé par Flyway dès V1)
│   ├── prometheus/                 # prometheus.yml + règles d'alerte
│   ├── alertmanager/               # Configuration des notifications d'alerte
│   ├── kafka/                      # Configuration JMX exporter
│   └── grafana/                    # Dashboards : JVM, infra, vue d'ensemble
│
├── data/
│   └── uploads/                    # Fichiers PDF générés et documents uploadés
│
├── docker-compose.yml              # Orchestration complète (14 containers)
└── README.md
```

**Migrations Flyway** : 45 migrations versionnées (V1 → V45 + V11.1), appliquées automatiquement par `catalog-service` au démarrage. La table `flyway_schema_history` est maintenue dans le schéma `public`.

---

## Développement local (sans Docker)

```bash
# 1. Démarrer uniquement l'infrastructure
docker compose up -d postgres keycloak kafka zookeeper

# 2. Lancer un microservice (exemple)
cd services/catalog-service
./mvnw spring-boot:run

# 3. Lancer le frontend en mode dev
cd frontend
npm install
npm run dev   # http://localhost:5173
```

> Variables d'environnement requises par chaque service : voir `docker-compose.yml`.

**Rebuild après modification backend :**
```bash
docker compose build catalog-service   # ou lot-service / stock-service / order-service
docker compose up -d catalog-service
```

**Rebuild après modification frontend :**
```bash
docker compose build frontend && docker compose up -d frontend
```

---

## Rôles et navigation

| Rôle Keycloak | Sections accessibles |
|---|---|
| `seed-admin` | Tout — Catalogue, Lots, Production, Logistique, Référentiels, Administration, Monitoring |
| `seed-selector` | Catalogue · Variétés + Lots G0/G1 · Transferts · Certifications · Analytiques sélectionneur |
| `seed-upsemcl` | Lots G1→G3 · Stock · Programmes · Certifications · Commandes reçues · Transferts |
| `seed-multiplicator` | Mes Lots G3→R2 · Mes Sites · Mon Stock · Commandes G3 passées · Transferts |
| `seed-quotataire` | Catalogue R2 · Mes commandes R2 |

---

## Roadmap

### Réalisé (V1.0)
- [x] Authentification OAuth2 PKCE via Keycloak 25, navigation conditionnelle par rôle
- [x] Catalogue public avec cartographie Leaflet des zones agro-écologiques (sans auth)
- [x] Référentiel variétal ISRA avec archivage traçable (commentaire, auteur, historique)
- [x] Cycle de vie des lots G0 → R2 — traçabilité lineage, création de lot enfant
- [x] Isolation stricte des données par rôle : lots, stock, commandes (username-based)
- [x] Lot REC automatique à la livraison — visible immédiatement dans « Mes Lots » et stock
- [x] Génération PDF : fiches variétales, itinéraires techniques, certificats de lot, bons de transfert
- [x] Inventaire stock par site, mouvements IN/OUT/TRANSFER, isolation par organisation
- [x] Workflow commandes complet : passation → allocation → négociation → livraison → réception
- [x] Transferts inter-organisations avec règles métier par génération et par rôle
- [x] Certifications officielles + contrôles qualité terrain/laboratoire
- [x] Campagnes, Sites, Programmes de multiplication
- [x] Messagerie interne entre acteurs
- [x] Tableaux de bord analytiques (global + sélectionneur)
- [x] Monitoring : Prometheus, Grafana, Alertmanager, Kafka UI
- [x] 45 migrations Flyway — schéma base de données entièrement versionné (V1 → V45)
- [x] Schema per Service — 6 schémas PostgreSQL distincts (catalog, lot, stock, orders, shared, geo)
- [x] Triggers DB auto-synchronisation `code_espece` et `campagne ↔ id_campagne` sur `lot_semencier`
- [x] Montée de version Spring Boot 3.3 → 3.5

### En cours / V1.1
- [ ] Notifications email/SMS sur événements critiques (livraison, certification)
- [ ] Workflow de validation multi-étapes pour les certifications officielles
- [ ] Pagination serveur sur les listes volumineuses
- [ ] Application mobile (React Native)
- [ ] Déploiement cloud (serveur ISRA / VPS)

---

## Contexte du projet

Ce système a été développé dans le cadre d'un **mémoire de fin d'études de Master 2 en Systèmes d'Information** à l'Université Alioune Diop de Bambey (UADB), réalisé en stage au **Centre National de Recherches Agronomiques (CNRA) de Bambey**, sous la supervision de **M. Biram BITEYE**.

Il répond aux besoins réels de modernisation et de traçabilité de la filière semencière nationale sénégalaise.

---

<div align="center">
  <sub>Développé par <strong>Toussaint GOMIS</strong> · M2 SI UADB · ISRA / CNRA Bambey · 2025–2026 · Sen Jiwu</sub><br>
  <sub>toussaint.gomis@uadb.edu.sn · +221 77 758 28 71</sub>
</div>
