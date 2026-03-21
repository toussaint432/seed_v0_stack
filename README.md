# 🌱 Seed Platform — Gestion des Semences Agricoles

> Plateforme de gestion de la chaîne semencière développée pour l'**ISRA / CNRA Sénégal**.  
> Architecture microservices · Sécurité OAuth2 · Déploiement Docker

[![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Backend](https://img.shields.io/badge/Backend-Spring%20Boot%203-6DB33F?style=flat-square&logo=springboot)](https://spring.io)
[![Auth](https://img.shields.io/badge/Auth-Keycloak%20OAuth2-4D4D4D?style=flat-square&logo=keycloak)](https://www.keycloak.org)
[![DB](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Broker](https://img.shields.io/badge/Broker-Apache%20Kafka-231F20?style=flat-square&logo=apachekafka)](https://kafka.apache.org)
[![Deploy](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?style=flat-square&logo=docker)](https://docs.docker.com/compose)

---

## Présentation

Seed Platform est une application web professionnelle dédiée à la gestion de la **chaîne de certification semencière** au Sénégal. Elle couvre l'ensemble du cycle de vie des semences, des variétés génétiques (G0) jusqu'aux semences commerciales (R2), en passant par la multiplication, le stockage et la distribution.

### Fonctionnalités principales

- **Catalogue** — Gestion des espèces et variétés certifiées
- **Lots semenciers** — Suivi générationnel G0 → G1 → G2 → G3 → G4 → R1 → R2 avec traçabilité complète
- **Stocks** — Inventaire par site de stockage avec mouvements
- **Commandes** — Passation et allocation de commandes de semences
- **Gestion des rôles** — Interface adaptée par profil utilisateur (Sélectionneur, UPSemCL, Multiplicateur, Quotataire)
- **Temps réel** — Synchronisation automatique des données (polling 8s)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend React                        │
│              (Vite · Tailwind · Lucide)                  │
│                   localhost:5173                         │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / REST
          ┌────────────┼────────────┐
          │            │            │
    ┌─────▼──────┐ ┌───▼────┐ ┌───▼──────┐ ┌──────────────┐
    │  catalog   │ │  lot   │ │  stock   │ │    order     │
    │  :18081    │ │ :18082 │ │  :18083  │ │    :18084    │
    └─────┬──────┘ └───┬────┘ └───┬──────┘ └──────┬───────┘
          └────────────┴──────────┴────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    Apache Kafka        │
                    │  (événements métier)   │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
        ┌─────▼──────┐  ┌──────▼─────┐  ┌────────▼──────┐
        │ PostgreSQL │  │  Keycloak  │  │  Prometheus   │
        │    :5432   │  │   :18080   │  │  + Grafana    │
        └────────────┘  └────────────┘  └───────────────┘
```

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Lucide React |
| Backend | Spring Boot 3, Spring Security, Spring Data JPA |
| Base de données | PostgreSQL 16 |
| Authentification | Keycloak 25 (OAuth2 + PKCE) |
| Messagerie | Apache Kafka 7.6 |
| Conteneurisation | Docker, Docker Compose |
| CI/CD | Jenkins |
| Monitoring | Prometheus, Grafana |

---

## Démarrage rapide

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 4.x
- Git

### Installation

```bash
# Cloner le projet
git clone https://github.com/toussaint432/seed_v0_stack.git
cd seed_v0_stack

# Lancer tous les services
docker compose up -d --build
```

Le démarrage complet prend environ 60 secondes. Attendez que tous les containers soient `healthy`.

### Accès aux services

| Service | URL | Description |
|---|---|---|
| **Frontend** | http://localhost:5173 | Interface principale |
| **Keycloak** | http://localhost:18080 | Administration IAM |
| **Kafka UI** | http://localhost:18085 | Monitoring des topics |
| **Grafana** | http://localhost:13000 | Dashboards métriques |
| **Prometheus** | http://localhost:19090 | Métriques systèmes |
| Catalog API | http://localhost:18081/swagger-ui.html | Espèces & variétés |
| Lot API | http://localhost:18082/swagger-ui.html | Lots semenciers |
| Stock API | http://localhost:18083/swagger-ui.html | Inventaire |
| Order API | http://localhost:18084/swagger-ui.html | Commandes |

---

## Comptes utilisateurs (V0)

| Utilisateur | Mot de passe | Rôle | Accès |
|---|---|---|---|
| `admin` | `admin123` | Administrateur ISRA | Vue complète — tous les modules |
| `selecteur` | `select123` | Sélectionneur | Variétés + Lots G0/G1 |
| `upseml` | `upseml123` | UPSemCL | Lots G1→G3 + Stock |
| `multiplicateur` | `multi123` | Multiplicateur | Lots G3→R2 + Stock |
| `quotataire` | `quota123` | Quotataire / OP | Catalogue + Commandes |

---

## Chaîne générationnelle

```
G0 (Noyau génétique)
 └─► G1 (Pré-base)        Sélectionneur → UPSemCL
      └─► G2 (Base)
           └─► G3 (Certifiée C1)   UPSemCL → Multiplicateur
                └─► G4 (Certifiée C2)
                     └─► R1
                          └─► R2 (Commerciale)   → Quotataires / OP
```

Chaque lot conserve une référence vers son **lot parent**, permettant une traçabilité complète de l'origine génétique.

---

## Structure du projet

```
seed_v0_stack/
├── frontend/                   # Application React (Vite + Tailwind)
│   └── src/
│       ├── ui/
│       │   ├── App.tsx          # Layout principal + gestion des rôles
│       │   └── pages/
│       │       ├── Dashboard.tsx
│       │       ├── Varieties.tsx
│       │       ├── Lots.tsx
│       │       ├── Stocks.tsx
│       │       └── Orders.tsx
│       └── lib/
│           ├── api.ts           # Client HTTP
│           └── keycloak.ts      # Authentification
├── services/
│   ├── catalog-service/         # Espèces & variétés (port 18081)
│   ├── lot-service/             # Lots semenciers (port 18082)
│   ├── stock-service/           # Stocks & mouvements (port 18083)
│   └── order-service/           # Commandes & allocations (port 18084)
├── infra/
│   ├── postgres/init/           # Schéma SQL + données de test
│   ├── keycloak/                # Realm JSON (import automatique)
│   ├── prometheus/              # Configuration métriques
│   └── grafana/                 # Dashboards JVM
├── docs/
│   ├── scenario_test.md         # Scénario de test end-to-end
│   └── api_contracts.md         # Contrats d'API
├── Jenkinsfile                  # Pipeline CI/CD
└── docker-compose.yml
```

---

## Développement local (sans Docker)

```bash
# Démarrer uniquement l'infrastructure
docker compose up -d postgres keycloak kafka zookeeper

# Lancer un microservice
cd services/catalog-service
mvn spring-boot:run

# Lancer le frontend
cd frontend
npm install
npm run dev
```

Variables d'environnement requises par chaque service : voir `docker-compose.yml`.

---

## Scénario de test end-to-end

1. Connectez-vous avec le compte `selecteur`
2. Créez une variété via **Catalog Service** (Swagger)
3. Créez un lot **G0** lié à cette variété
4. Transférez vers **G1** (UPSemCL)
5. Enregistrez un mouvement de stock
6. Connectez-vous avec `quotataire` et passez une commande **R2**
7. Connectez-vous avec `upseml` et allouez la commande

Détail complet : [`docs/scenario_test.md`](docs/scenario_test.md)

---

## Roadmap V1

- [ ] Module de certification et d'inspection des lots
- [ ] Workflow de validation multi-étapes
- [ ] Génération de rapports PDF (campagne, bilan stock)
- [ ] Notifications email / SMS
- [ ] Application mobile (React Native)
- [ ] Déploiement cloud (AWS / Azure)

---

## Contexte académique

Ce projet a été développé dans le cadre d'un **Master 2 en Développement Full Stack** et vise à répondre aux besoins réels du **Centre National de Recherche Agronomique (CNRA)** au Sénégal pour la modernisation de la gestion de la chaîne semencière nationale.

---

<div align="center">
  <sub>Développé avec ❤️ pour l'agriculture sénégalaise · ISRA / CNRA · 2025</sub>
</div>
