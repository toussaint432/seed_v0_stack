# Sen Jiwu — Plateforme de Gestion des Semences Agricoles

> Système d'information semencier développé pour l'**ISRA / CNRA Bambey — Sénégal**.
> Architecture microservices · Authentification OAuth2/OIDC · Déploiement Docker Compose
>
> *« Sen Jiwu » signifie « Votre semence » en wolof.*

[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Backend](https://img.shields.io/badge/Backend-Spring%20Boot%203.3%20%2F%20Java%2021-6DB33F?style=flat-square&logo=springboot)](https://spring.io)
[![Auth](https://img.shields.io/badge/Auth-Keycloak%2025%20OAuth2--PKCE-4D4D4D?style=flat-square&logo=keycloak)](https://www.keycloak.org)
[![DB](https://img.shields.io/badge/Database-PostgreSQL%2016--alpine-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![Broker](https://img.shields.io/badge/Broker-Apache%20Kafka%207.6-231F20?style=flat-square&logo=apachekafka)](https://kafka.apache.org)
[![Deploy](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?style=flat-square&logo=docker)](https://docs.docker.com/compose)
[![CI](https://img.shields.io/badge/CI%2FCD-Jenkins%20Pipeline-D24939?style=flat-square&logo=jenkins)](https://www.jenkins.io)

---

## Objectifs du projet

### Objectif général

Concevoir et déployer un **système d'information semencier** pour l'ISRA/CNRA Bambey permettant de digitaliser, centraliser et sécuriser la gestion de la chaîne de certification semencière au Sénégal — de la variété génétique pure (G0) à la semence commerciale distribuée (R2) — en garantissant la traçabilité, la conformité et l'accessibilité pour tous les acteurs de la filière.

### Objectifs spécifiques et état de couverture

| # | Objectif spécifique | État | Notes |
|---|---|---|---|
| **OS1** | Numériser le référentiel variétal ISRA (espèces, variétés, zones agro-écologiques) | ✅ Complet | Catalogue public, carte Leaflet ZAE, archivage traçable |
| **OS2** | Assurer la traçabilité générationnelle des lots semenciers (G0→R2, lineage) | ✅ Complet | Lot parent→enfant, lot REC automatique à livraison |
| **OS3** | Gérer les stocks par acteur avec isolation stricte des données | ✅ Complet | RBAC username/organisation, inventaire + mouvements |
| **OS4** | Automatiser le workflow de commandes et de transferts entre acteurs | ✅ Complet | Passation → allocation → livraison → réception |
| **OS5** | Sécuriser l'accès par rôle métier via authentification centralisée | ✅ Complet | Keycloak 25, OAuth2 PKCE, Spring Security RBAC |
| **OS6** | Produire des documents officiels traçables (certificats, fiches, bons) | ✅ Complet | Génération PDF iText/PDFBox, upload fiches techniques |
| **OS7** | Déployer une architecture scalable, monitorée et maintenable | 🔄 En cours | Docker opérationnel, Phase 3 et déploiement ISRA à finaliser |
| **OS8** | Garantir des performances acceptables pour les utilisateurs | 🔄 Partiel | JVM tuning + monitoring en place, tests de charge à réaliser |
| **OS9** | Assurer la scalabilité du système face à la croissance des données | 🔄 Partiel | Architecture prête (microservices + Kafka), orchestration à prévoir |
| **OS10** | Déployer sur infrastructure ISRA (serveur réel, accès multi-sites) | 🔲 À venir | Architecture prête, config réseau/TLS à finaliser |
| **OS11** | Fournir un guide d'utilisation par rôle pour les utilisateurs finaux | 🔄 Partiel | Page Documentation publique disponible (`/documentation`), pages légales disponibles, guide utilisateur par rôle à rédiger |

---

## Présentation

**Sen Jiwu** est une application web professionnelle dédiée à la gestion de la **chaîne de certification semencière** au Sénégal. Elle couvre l'intégralité du cycle de vie des semences — des variétés génétiques pures (G0) jusqu'aux semences commerciales distribuées (R2) — en assurant la traçabilité générationnelle, la gestion des stocks, la certification et la distribution entre acteurs.

### Modules fonctionnels

| Module | Description |
|---|---|
| **Tableau de bord** | KPIs en temps réel, pipeline générationnel G0→R2, lots récents, statuts des commandes |
| **Catalogue public** | Vitrine des espèces et variétés accessibles sans authentification (cartographie ZAE) |
| **Documentation** | Page publique — pipeline CEDEAO/CILSS G0→R2, classification 4 niveaux, 6 rôles acteurs, glossaire |
| **Politique de confidentialité** | Page publique — traitement des données personnelles (loi sénégalaise n°2008-12), bilingue FR/EN |
| **Conditions d'utilisation** | Page publique — CGU bilingues FR/EN (loi n°2008-08 et n°2008-12) |
| **Variétés & Espèces** | Référentiel variétal ISRA avec archivage traçable (commentaire + auteur + date) |
| **Lots semenciers** | Cycle de vie G0 → R2, création de lot enfant, traçabilité lineage, certificats PDF, politique d'édition BROUILLON/CONFIRMÉ, audit trail complet |
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
| **Vue d'ensemble CNRA** | Dashboard décisionnel Directeur — KPIs, pipeline G0→R2, certifications, politique d'édition, top variétés, matrice espèce×génération |
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
│              Frontend React/TS — Vite (Docker)  :5173                │
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
                    │  PostgreSQL 16     │   │    Apache Kafka       │
                    │  alpine edition    │   │   Bus d'événements   │
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
| `lot` | lot-service | `lot_semencier`, `campagne`, `generation_semence`, `certification`, `transfert_lot`, `lot_audit_log`, `outbox_events` |
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
| Build dev / Conteneur | Vite (dev) — nginx:alpine prévu Phase 3 | 5.x |
| Cartographie | Leaflet.js | 1.9 |
| Backend | Spring Boot + Java | 3.3 / Java 21 |
| Sécurité API | Spring Security, OAuth2/OIDC, RBAC | — |
| Base de données | PostgreSQL (Alpine) | 16-alpine |
| Migrations DB | Flyway (auto au démarrage) | — |
| Authentification | Keycloak | 25.0.4 |
| Messagerie async | Apache Kafka + ZooKeeper | cp-kafka 7.6.1 |
| Conteneurisation | Docker + Docker Compose | Engine 26 / Compose v2 |
| Génération PDF | iText / PDFBox (Spring) | — |
| Monitoring | Prometheus + Grafana + Alertmanager | 2.52 / 10.4.3 |
| CI/CD | Jenkins (Pipeline-as-Code, Jenkinsfile) | — |

---

## Stratégie Docker & optimisations (Phase 1)

### Multi-stage builds

Chaque service Java utilise un **build en deux étapes** :

```
Étape 1 — Maven build  :  maven:3.9.8-eclipse-temurin-21
           ↓ compilation + packaging → app.jar
Étape 2 — Runtime      :  eclipse-temurin:21-jre-alpine
           ↓ COPY app.jar uniquement (~60 MB vs ~600 MB)
```

**Gain** : l'image de production ne contient ni Maven, ni le JDK, ni les sources. Seul le JAR compilé et le JRE sont embarqués. Les outils de build n'ont aucune raison d'être présents dans une image de production — c'est un principe de moindre surface d'attaque (OWASP A05:2021 — Security Misconfiguration).

### Choix Alpine vs Distroless

| Option | Taille | Shell | Outils de diagnostic |
|---|---|---|---|
| `eclipse-temurin:21-jre` (Debian) | ~280 MB | ✅ | ✅ |
| `eclipse-temurin:21-jre-alpine` ✅ | ~130 MB | ✅ | ✅ |
| `gcr.io/distroless/java21` | ~85 MB | ❌ | ❌ |

**Choix retenu : Alpine.** En contexte institutionnel ISRA/CNRA, la capacité de `docker exec` dans un conteneur pour diagnostiquer un problème en production est opérationnellement nécessaire. Distroless supprime le shell — ce gain de ~45 MB supplémentaires n'est pas justifié face à la perte de capacité opérationnelle. Alpine conserve le shell tout en réduisant l'image de ~150 MB par service Java (×4 services = **~600 MB** gagnés).

### Image tagging — Semantic Versioning

Toutes les images applicatives suivent le [Semantic Versioning](https://semver.org) :

```yaml
image: seed-catalog:1.0.0
image: seed-lot:1.0.0
image: seed-stock:1.0.0
image: seed-order:1.0.0
image: seed-frontend:1.0.0
```

**Justification** : un tag `:latest` est **mutable** — il peut pointer vers une image différente après un re-push. Un tag `1.0.0` est une promesse de stabilité. En production, un déploiement doit être reproductible et auditables : `seed-catalog:1.0.0` identifie de manière non ambiguë la version déployée dans les logs et l'historique Grafana.

### SHA256 digest pinning — images tierces

Pour les images publiées sans tag de version stable (`:latest` implicite), le digest SHA256 est utilisé :

```yaml
image: provectuslabs/kafka-ui@sha256:8f2ff02d64b0a7a2b71b6b3b3148b85f66d00ec20ad40c30bdcd415d46d31818
image: dpage/pgadmin4@sha256:2f4ce946ddf8360680d7eff4eaba1d91859eb6b4003e6623bad5c63a322c2f4d
image: danielqsj/kafka-exporter@sha256:a51b280b55a763deaa1bc5024310bc2954995d9160014d7445055dac6a090868
```

Un tag peut être réécrit par le mainteneur de l'image (**mutable**). Un SHA256 est cryptographiquement immuable — c'est la forme de pinning la plus rigoureuse. Elle protège contre les attaques de type supply-chain (image substituée) et garantit que `docker compose up` déploie exactement l'image testée, sans surprise.

### Builds déterministes — `npm ci`

```dockerfile
RUN npm ci     # ← lit package-lock.json, échec si lock désynchronisé
# vs npm install qui régénère le lock et peut introduire des versions différentes
```

Conformément au [12-Factor App §IV — Dependencies](https://12factor.net/dependencies), les dépendances doivent être déclarées explicitement et isolées. `npm ci` garantit que le build de CI produit exactement le même bundle que le développeur local.

### `.dockerignore`

Le fichier `frontend/.dockerignore` exclut du contexte Docker :

```
node_modules/   ← évite d'envoyer des centaines de MB inutiles au daemon
dist/           ← artefact généré, non source
.git/           ← historique git non nécessaire dans l'image
.env*           ← secrets ne doivent jamais entrer dans une image
*.log
```

Sans `.dockerignore`, `COPY . .` enverrait l'intégralité du répertoire au Docker daemon — incluant potentiellement des fichiers sensibles.

### CORS — origines autorisées

```yaml
CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173"
```

`localhost` et `127.0.0.1` sont **deux origines HTTP distinctes** même si elles résolvent au même hôte. Les deux sont nécessaires selon le navigateur utilisé. `localhost:3000` (React CRA legacy) a été retiré : ne pas conserver d'origines autorisées non utilisées est une bonne pratique de sécurité (principe de moindre privilège).

---

## Sécurité infrastructure (Phase 2)

### `postgres:16-alpine` — migration depuis `postgres:16`

```
postgres:16 (Debian)  → UID postgres = 999
postgres:16-alpine    → UID postgres = 70
```

Le répertoire de données PostgreSQL (`/var/lib/postgresql/data`) est chown'd avec l'UID de l'image d'origine. Si le volume `seed_pgdata` existe depuis `postgres:16`, la migration vers `postgres:16-alpine` nécessite de le recréer :

```bash
# ⚠️ Cette commande supprime toutes les données locales
docker compose down
docker volume rm seed_v0_stack_seed_pgdata
docker compose up -d
```

> **En production** : effectuer un `pg_dump` complet avant migration, puis `pg_restore` après recréation du volume. Ne jamais recréer un volume de production sans sauvegarde préalable.

### Keycloak healthcheck — `/health/ready:9000`

Keycloak 25 expose deux ports distincts :
- `:8080` — port applicatif (authentification, OIDC, console admin)
- `:9000` — port management (health, métriques Micrometer) — **non exposé publiquement**

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -sf http://localhost:9000/health/ready || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 12
  start_period: 60s
```

`/health/ready` retourne HTTP 200 quand Keycloak est opérationnel (base de données connectée, realm chargé), HTTP 503 pendant l'initialisation. Avec `start_period: 60s` + 12 tentatives × 10s, le système attend jusqu'à **3 minutes** avant de déclarer le service non disponible.

**Impact sur le démarrage** : tous les microservices et le frontend utilisent désormais `condition: service_healthy` au lieu de `condition: service_started`. Cela garantit qu'aucun service ne démarre avant que Keycloak puisse valider les tokens JWT — supprimant les erreurs 401 en boucle au démarrage de la stack.

### Swagger désactivé par défaut

```yaml
SWAGGER_ENABLED: "false"   # catalog-service, lot-service, stock-service, order-service
```

**Justification** : Swagger UI expose l'intégralité de la surface API — routes, paramètres, modèles de données — publiquement. En environnement Dockerisé (staging/production), cette information n'est utile qu'au développeur. L'exposer augmente inutilement la surface d'attaque (OWASP A01:2021 — Broken Access Control).

**Activer Swagger pour le développement :**

```yaml
# Option A — dans docker-compose.yml (temporaire)
SWAGGER_ENABLED: "true"

# Option B — lancer le service hors Docker (recommandé)
docker compose up -d postgres keycloak kafka zookeeper
cd services/catalog-service && mvn spring-boot:run
# → http://localhost:18081/swagger-ui.html
# → http://localhost:18082/swagger-ui.html
# → http://localhost:18083/swagger-ui.html
# → http://localhost:18084/swagger-ui.html
```

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

**Temps de démarrage** : 3–4 minutes au premier lancement (Keycloak healthcheck actif — la stack attend que Keycloak soit réellement opérationnel avant de démarrer les microservices). Les démarrages suivants sont plus rapides (~90 secondes).

```bash
# Vérifier que tous les containers sont healthy
docker compose ps

# Suivre les logs d'un service
docker compose logs -f catalog-service
```

> **Si le volume `seed_pgdata` existait avant la migration vers `postgres:16-alpine`** : voir la section [Sécurité infrastructure](#sécurité-infrastructure-phase-2) — le volume doit être recréé.

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

La plateforme compte **25 utilisateurs actifs** dans le realm Keycloak `seed-v0`. Voici les comptes représentatifs par rôle — la liste complète et les mots de passe sont dans `infra/keycloak/users-credentials.env` (fichier local non commité).

| Utilisateur | Rôle Keycloak | Accès plateforme |
|---|---|---|
| `admin` | `seed-admin` | Supervision complète — tous les modules |
| `directeur` | `seed-directeur` | Dashboard décisionnel CNRA — lecture seule de la chaîne |
| `alla_lo_upsemcl` | `seed-upsemcl` | Lots G1→G3 + Stock + Certifications + Commandes reçues |
| `selecteur_mil` | `seed-selector` | Variétés + Lots G0/G1 + Transferts + Analytiques |
| `multi_bc_ziguinchor` | `seed-multiplicator` | Lots G3→R2 + Mes Sites + Stock + Commandes G3 |
| `quotataire_nord` | `seed-quotataire` | Catalogue semences R2 + Commandes |

**Rôles disponibles (6) :** `seed-admin` · `seed-directeur` · `seed-upsemcl` · `seed-selector` · `seed-multiplicator` · `seed-quotataire`

> **Realm** : `seed-v0` · **Client** : `seed-frontend` · **Mots de passe** : voir `infra/keycloak/users-credentials.env`

---

## Gestion des utilisateurs Keycloak

### Architecture — séparation structure / secrets

La gestion des utilisateurs Keycloak repose sur trois fichiers avec des responsabilités distinctes :

```
infra/keycloak/
├── realm-seed-v0.json          ← Structure (users, rôles, clients, config)
│                                 Versionné dans Git — jamais de mot de passe
│                                 Importé par Keycloak au 1er démarrage uniquement
│
└── users-credentials.env       ← Mots de passe des 25 utilisateurs
                                  LOCAL uniquement — dans .gitignore
                                  Source de vérité pour la restauration
scripts/
├── sync-keycloak.sh            ← Synchronise users-credentials.env → Keycloak Admin API
├── export-keycloak.sh          ← Exporte Keycloak → realm-seed-v0.json (sans mots de passe)
└── keycloak-maintenance.sh     ← Script guidé tout-en-un (export + diff + commit)
```

**Principe** : le JSON versionné définit la *structure* (qui existe, quel rôle). Les mots de passe vivent uniquement dans un fichier local non commité. Ce choix est délibéré — versionner des credentials est une faille de sécurité (OWASP A02:2021 — Cryptographic Failures).

---

### Créer un utilisateur via l'interface plateforme

Quand l'administrateur crée un utilisateur via **Sen Jiw → Gestion des utilisateurs → Nouvel utilisateur** :

1. Le backend appelle l'Admin API Keycloak directement
2. L'utilisateur est créé avec le mot de passe temporaire saisi et le rôle assigné
3. **L'utilisateur peut se connecter immédiatement** — Keycloak lui demande de changer son mot de passe à la première connexion
4. Aucun réglage supplémentaire n'est nécessaire pour que l'utilisateur soit opérationnel

**⚠️ Ce qui n'est pas automatique :** le nouvel utilisateur n'est pas encore versionné dans `realm-seed-v0.json`. Si Keycloak est réinitialisé sans versioning préalable, cet utilisateur est perdu.

---

### Procédure de versioning après création d'un utilisateur

```bash
# 1. Ajouter le mot de passe initial dans le fichier local (jamais commité)
echo "username=mot_de_passe_initial" >> infra/keycloak/users-credentials.env

# 2. Lancer le script de maintenance guidé (export + diff + commit)
./scripts/keycloak-maintenance.sh
```

Le script `keycloak-maintenance.sh` :
- Exporte le realm courant depuis Keycloak (sans mots de passe)
- Affiche le diff Git pour revue humaine
- Détecte les nouveaux utilisateurs et vérifie leur présence dans `users-credentials.env`
- Propose un commit avec un message pré-rempli — **l'humain valide avant chaque commit**

**Pourquoi ne pas automatiser le commit depuis le backend ?** Trois raisons architecturales :
- Un service applicatif ne doit pas avoir accès au dépôt Git (séparation des responsabilités)
- Chaque commit de configuration doit être une intention humaine validée (principe GitOps)
- `realm-seed-v0.json` n'est utile que pour la restauration — sa mise à jour n'est pas critique en temps réel

---

### Sur un nouvel environnement (machine neuve ou reset Docker)

```bash
# 1. Cloner le projet
git clone https://github.com/toussaint432/seed_v0_stack.git && cd seed_v0_stack

# 2. Copier et renseigner les mots de passe
cp infra/keycloak/users-credentials.env.example infra/keycloak/users-credentials.env
nano infra/keycloak/users-credentials.env   # renseigner les vrais mots de passe

# 3. Démarrer la stack — Keycloak importe realm-seed-v0.json (structure uniquement)
docker compose up -d

# 4. Appliquer les mots de passe via l'Admin API
./scripts/sync-keycloak.sh
```

---

### Modifier un rôle ou une configuration Keycloak

Toute modification effectuée dans la **console Keycloak** (nouveau rôle, nouveau mapper, changement de session timeout, etc.) doit être exportée et commitée :

```bash
./scripts/keycloak-maintenance.sh
# → Export automatique, diff affiché, commit guidé
```

---

## Isolation des données par rôle

Chaque acteur est strictement isolé — il ne voit que ses propres ressources :

| Rôle | Lots visibles | Stock visible | Commandes visibles |
|---|---|---|---|
| `seed-selector` | Lots dont il est auteur (G0/G1) | — | — |
| `seed-upsemcl` | Tous les lots G1→G3 de l'UPSemCL | Stock UPSemCL | Commandes reçues (org UPSemCL) |
| `seed-multiplicator` | Ses propres lots + lots reçus (REC) | Son stock propre (org) | Ses propres commandes G3 passées |
| `seed-quotataire` | Uniquement les lots R2 DISPONIBLES | — | Ses propres commandes R2 |
| `seed-directeur` | Lecture seule — tous les lots (indicateurs) | — | — |
| `seed-admin` | Tout | Tout | Tout |

**Lot REC** : à chaque livraison validée, un lot de réception (`REC-{commandeId}-L{ligneId}`) est créé automatiquement avec l'organisation du multiplicateur comme producteur — il apparaît immédiatement dans « Mes Lots » et dans le stock de l'acheteur.

---

## Chaîne générationnelle

```
G0  Noyau génétique   ─┐
G1  Pré-base            ├── Sélectionneur (ISRA)  ──►  UPSemCL
G2  Base              ─┘
                        
G3  Certifiée C1      ─── UPSemCL               ──►  Multiplicateur

G4  Certifiée C2      ─┐
R1  Reproductrice       ├── Multiplicateur        ──►  Quotataires / OP
R2  Commerciale       ─┘
```

Chaque lot conserve une référence vers son **lot parent**, permettant une traçabilité complète de l'origine génétique (vue lineage disponible dans l'interface). La génération est automatiquement proposée à la création d'un lot enfant.

---

## Politique d'édition des lots

Chaque lot semencier possède un `statutEdition` (**BROUILLON** ou **CONFIRMÉ**) indépendant de son statut de certification. Un lot confirmé n'est plus modifiable — cela garantit l'intégrité des données certifiées.

### Règles par rôle

| Rôle | Verrouillage | Déclencheur |
|---|---|---|
| `seed-upsemcl` | Volontaire | Bouton « Valider » dans l'interface — passage manuel en CONFIRMÉ |
| `seed-selector` | Volontaire | Idem — bouton « Valider » dans l'interface |
| `seed-multiplicator` | Automatique | Déclenché quand le lot est certifié (UPSemCL confirme la certification) |
| `seed-admin` | Peut éditer tous les lots | Aucune restriction sur l'admin |

**Auto-lock 30 jours** : un job `@Scheduled` (`LotAutoLockJob`) verrouille automatiquement les lots laissés en BROUILLON depuis plus de 30 jours — évite les lots « oubliés » non finalisés.

### Audit trail

Toutes les modifications de champs d'un lot sont journalisées dans `lot.lot_audit_log` :

| Colonne | Description |
|---|---|
| `lot_id` | Référence au lot modifié |
| `username` | Utilisateur Keycloak auteur de l'action |
| `action` | Type d'action : `CREATION`, `MODIFICATION`, `SUPPRESSION`, `CONFIRMATION` |
| `champ` | Nom du champ modifié (ex. `quantiteConditionnee`) |
| `ancienne_valeur` | Valeur avant modification |
| `nouvelle_valeur` | Valeur après modification |
| `created_at` | Horodatage UTC |

L'historique est accessible via l'interface (bouton « Historique » sur chaque lot) et via l'API `GET /api/lots/{id}/audit`.

---

## Indicateurs agronomiques — formulaire de création de lot

Lors de la création d'un lot semencier, deux indicateurs sont calculés automatiquement à partir des données saisies et affichés en temps réel.

### Rendement parcellaire

```
Rendement (kg/ha) = Production brute (kg) ÷ Superficie plantée (ha)
```

Mesure la productivité brute de la parcelle de multiplication. Reflète la récolte totale avant post-récolte, rapportée à la surface cultivée. Indicateur neutre dans l'interface (pas de code couleur actuellement).

**Plages de référence indicatives pour la filière semencière ISRA :**

| Espèce | Faible | Normal | Élevé |
|---|---|---|---|
| Mil (*Pennisetum glaucum*) | < 600 kg/ha | 600–2 500 kg/ha | > 2 500 kg/ha |
| Riz (*Oryza sativa*) | < 2 500 kg/ha | 2 500–6 000 kg/ha | > 6 000 kg/ha |
| Niébé (*Vigna unguiculata*) | < 400 kg/ha | 400–1 200 kg/ha | > 1 200 kg/ha |
| Arachide (*Arachis hypogaea*) | < 800 kg/ha | 800–2 000 kg/ha | > 2 000 kg/ha |
| Sorgho (*Sorghum bicolor*) | < 500 kg/ha | 500–2 000 kg/ha | > 2 000 kg/ha |

> ⚙️ **Évolution prévue** : un code couleur par espèce (vert / orange / rouge) sera ajouté pour alerter visuellement l'utilisateur quand le rendement sort des normes ISRA par espèce, permettant de détecter les erreurs de saisie avant soumission. Cette fonctionnalité nécessite de fixer les seuils espèce par espèce en concertation avec les agronomes ISRA/CNRA.

---

### Taux de conditionnement

```
Conditionnement (%) = Production conditionnée (kg) ÷ Production brute (kg) × 100
```

Mesure la proportion de la récolte brute effectivement transformée en semence prête à stocker, après les opérations post-récolte : séchage, tri, épuration, emballage.

**Code couleur dans le formulaire :**

| Plage | Couleur | Interprétation |
|---|---|---|
| 70–85% | 🟢 Vert | Dans la norme ISRA — valeurs cohérentes |
| 50–69% ou 86–95% | 🟠 Orange | Hors norme — à vérifier (pertes élevées ou production brute sous-estimée) |
| < 50% ou > 95% | 🔴 Rouge | Suspect — probable erreur de saisie |

**Pourquoi la norme est 70–85% ?** Cette fourchette correspond aux pertes incompressibles du post-récolte semencier :
- Séchage : perte de 8–15% d'humidité (le grain frais pèse plus que le grain sec)
- Tri et épuration : élimination des grains mal formés, brisés, infestés (~5–10%)
- Manipulation et emballage : ~1–3%

Un ratio > 95% signifie que presque rien n'a été perdu au conditionnement — physiquement impossible si la production brute est la récolte fraîche non triée. Un ratio < 50% signale des pertes anormalement élevées (dégâts de stockage, parasites, erreur de saisie).

La formule et la norme sont affichées en rappel contextuel dans le formulaire dès qu'un ratio est calculé.

---

## Structure du projet

```
seed_v0_stack/
├── Jenkinsfile                     # Pipeline CI/CD déclaratif (Pipeline-as-Code)
├── frontend/
│   ├── .dockerignore               # Exclut node_modules, .git, .env du contexte Docker
│   ├── Dockerfile                  # node:20-alpine + npm ci (build déterministe)
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
│               ├── LandingPage.tsx         # Page d'accueil publique Sen Jiwu (WhatsApp CTA)
│               ├── Documentation.tsx       # Documentation filière — pipeline CEDEAO/CILSS, glossaire
│               ├── PrivacyPolicy.tsx       # Politique de confidentialité FR/EN (loi 2008-12)
│               ├── Terms.tsx               # CGU FR/EN (loi 2008-08 et 2008-12)
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
│               ├── DirecteurDashboard.tsx  # Dashboard décisionnel Directeur CNRA
│               ├── Users.tsx               # Gestion Keycloak (admin)
│               └── Profile.tsx             # Profil utilisateur connecté
│
├── services/
│   ├── seed-common/                # Bibliothèque partagée — installée avant les services
│   ├── catalog-service/            # :18081 — Référentiel variétal
│   │   ├── Dockerfile              # Multi-stage Maven → eclipse-temurin:21-jre-alpine
│   │   └── api/
│   │       ├── CatalogController   # Espèces, variétés, archivage traçable, historique
│   │       ├── DocumentController  # Génération PDF fiches variétales & itinéraires
│   │       └── ZoneController      # Zones agro-écologiques (ZAE) + cartographie
│   │
│   ├── lot-service/                # :18082 — Cycle de vie des lots
│   │   ├── Dockerfile              # Multi-stage Maven → eclipse-temurin:21-jre-alpine
│   │   └── api/
│   │       ├── LotController           # CRUD lots, création enfant, isolation par rôle, édition BROUILLON/CONFIRMÉ, audit
│   │       ├── LotDocumentController   # Génération PDF certificat de lot
│   │       ├── TransfertController     # Transferts entre organisations
│   │       ├── CampagneController      # Campagnes agricoles
│   │       ├── CertificationController # Certifications officielles
│   │       ├── ControleQualiteController # Contrôles qualité terrain/labo
│   │       ├── GenerationController    # Référentiel des générations (G0→R2)
│   │       └── ProgrammeController     # Programmes de multiplication
│   │
│   ├── stock-service/              # :18083 — Stocks & sites
│   │   ├── Dockerfile              # Multi-stage Maven → eclipse-temurin:21-jre-alpine
│   │   └── api/
│   │       ├── StockController     # Inventaire + mouvements (IN/OUT/TRANSFER)
│   │       ├── SiteController      # Sites de stockage et production
│   │       ├── CatalogueController # Catalogue des lots disponibles par proximité
│   │       └── TransfertController # Transferts physiques inter-sites
│   │
│   └── order-service/              # :18084 — Commandes & livraisons
│       ├── Dockerfile              # Multi-stage Maven → eclipse-temurin:21-jre-alpine
│       └── api/
│           ├── OrderController         # Commandes, allocation, workflow livraison
│           ├── OrganisationController  # Organisations de la filière
│           ├── MembreController        # Membres des organisations
│           └── ChatController          # Messagerie inter-acteurs
│
├── infra/
│   ├── keycloak/
│   │   ├── realm-seed-v0.json      # Structure realm (users, rôles, clients) — sans mots de passe
│   │   └── users-credentials.env   # Mots de passe 25 users — LOCAL, dans .gitignore
│   ├── postgres/init/              # Schéma initial (remplacé par Flyway dès V1)
│   ├── prometheus/                 # prometheus.yml + règles d'alerte
│   ├── alertmanager/               # Configuration des notifications d'alerte
│   ├── kafka/                      # Configuration JMX exporter
│   └── grafana/                    # Dashboards : JVM, infra, vue d'ensemble
│
├── scripts/
│   ├── keycloak-maintenance.sh     # Script guidé : export + diff + commit (à lancer après création user)
│   ├── sync-keycloak.sh            # Synchronise users-credentials.env → Keycloak Admin API
│   └── export-keycloak.sh          # Exporte Keycloak → realm-seed-v0.json (sans mots de passe)
│
├── data/
│   └── uploads/                    # Fichiers PDF générés et documents uploadés
│
├── docker-compose.yml              # Orchestration complète (14 containers)
└── README.md
```

**Migrations Flyway** : versionnées (V1 → V72+), appliquées automatiquement par `catalog-service` au démarrage. La table `flyway_schema_history` est maintenue dans le schéma `public`.

---

## Développement local (sans Docker)

```bash
# 1. Démarrer uniquement l'infrastructure
docker compose up -d postgres keycloak kafka zookeeper

# 2. Construire seed-common (requis avant tout service)
cd services/seed-common && mvn -B install -DskipTests -q

# 3. Lancer un microservice (exemple)
cd services/catalog-service
./mvnw spring-boot:run

# 4. Lancer le frontend en mode dev
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

### Documentation API (Swagger)

Swagger UI est **désactivé par défaut** dans tous les containers Docker (`SWAGGER_ENABLED: false`) — voir section [Sécurité infrastructure](#sécurité-infrastructure-phase-2).

Pour l'activer en développement, deux options :

```bash
# Option A — flip temporaire dans docker-compose.yml
# SWAGGER_ENABLED: "true"   (sous l'environnement du service concerné)
docker compose up -d catalog-service

# Option B — sans Docker (recommandé, Swagger activé par défaut hors container)
docker compose up -d postgres keycloak kafka zookeeper
cd services/catalog-service && mvn spring-boot:run
```

| Service | URL Swagger (quand activé) |
|---|---|
| catalog-service | http://localhost:18081/swagger-ui.html |
| lot-service | http://localhost:18082/swagger-ui.html |
| stock-service | http://localhost:18083/swagger-ui.html |
| order-service | http://localhost:18084/swagger-ui.html |

---

## Pipeline CI/CD — Jenkins

Le fichier `Jenkinsfile` à la racine du projet définit le pipeline de manière déclarative (**Pipeline-as-Code**) : le pipeline est versionné dans Git, auditable, et reproductible sur n'importe quel serveur Jenkins.

### Prérequis Jenkins

- JDK 21 installé et configuré dans Jenkins sous le nom `jdk21` *(Jenkins → Manage → Tools → JDK)*
- Docker Engine accessible depuis l'agent Jenkins (`/var/run/docker.sock` monté)
- Node.js disponible sur l'agent (pour `npm ci`)

### Stages du pipeline

```
Checkout
    │
    ▼
Install seed-common          ← séquentiel (dépendance Maven locale)
    │
    ▼
Build Backend ─────────────────────────────────────────┐
    │   catalog-service (parallel)                      │
    │   lot-service     (parallel)                      │ mvn -B -DskipTests package
    │   stock-service   (parallel)                      │
    │   order-service   (parallel)  ────────────────────┘
    │
    ▼
Build Frontend               ← npm ci && npm run build
    │
    ▼
Docker Build                 ← docker compose build --parallel
    │
    ▼
Deploy                       ← docker compose up -d
    │
    ▼
Smoke Test                   ← curl /actuator/health sur :18081-18084
```

**Pourquoi `seed-common` est séquentiel ?** Les 4 services en dépendent comme module Maven local (non publié sur Maven Central). Il doit être installé dans `~/.m2` avant que les builds parallèles ne démarrent — sinon chaque service échoue sur `Could not resolve dependency: sn.isra.seed:seed-common`.

**Pourquoi `npm ci` et non `npm install` ?** `npm ci` échoue si `package-lock.json` est désynchronisé, garantissant que le build de CI est identique au build local (12-Factor App §IV).

### Déclenchement du pipeline

En développement local, Jenkins peut interroger GitHub par **polling** (pas besoin de Ngrok) :

```groovy
// À ajouter dans le Jenkinsfile si polling activé
triggers {
  pollSCM('H/5 * * * *')   // toutes les 5 minutes
}
```

> En production sur un serveur public, les **webhooks GitHub** sont à privilégier pour une réaction immédiate au push (plus économe et réactif que le polling).

---

## Rôles et navigation

| Rôle Keycloak | Sections accessibles |
|---|---|
| `seed-admin` | Tout — Catalogue, Lots, Production, Logistique, Référentiels, Administration, Monitoring |
| `seed-selector` | Catalogue · Variétés + Lots G0/G1 · Transferts · Certifications · Analytiques sélectionneur |
| `seed-upsemcl` | Lots G1→G3 · Stock · Programmes · Certifications · Commandes reçues · Transferts |
| `seed-multiplicator` | Mes Lots G3→R2 · Mes Sites · Mon Stock · Commandes G3 passées · Transferts |
| `seed-quotataire` | Catalogue R2 · Mes commandes R2 |
| `seed-directeur` | Vue d'ensemble CNRA · Lots (lecture seule) · Variétés (lecture seule) · Stocks (lecture seule) |

---

## Roadmap

### Réalisé (V1.0 — Fonctionnel)
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
- [x] Indicateurs agronomiques en temps réel dans le formulaire lot (rendement kg/ha, taux de conditionnement avec code couleur vert/orange/rouge et description pédagogique)
- [x] Politique d'édition BROUILLON/CONFIRMÉ sur les lots — verrouillage volontaire (UPSemCL/Sélectionneur) + auto-lock 30 jours + verrouillage automatique à la certification (multiplicateur)
- [x] Audit trail complet des lots — historique champ par champ de toutes les modifications (qui, quoi, avant, après, quand)
- [x] Dashboard décisionnel Directeur CNRA — KPIs, pipeline G0→R2, certifications, politique d'édition, top variétés, matrice espèce×génération
- [x] Rôle `seed-directeur` — lecture seule de l'ensemble de la chaîne semencière, navigation dédiée
- [x] Page Documentation publique — classification CEDEAO/CILSS 4 niveaux (G0→R2), acteurs de la filière, glossaire R1/R2 distincts, accessibles sans authentification
- [x] Pages légales publiques — Politique de confidentialité et CGU bilingues FR/EN (loi sénégalaise n°2008-12 et n°2008-08), conformes CDP
- [x] Routes publiques `/documentation`, `/privacy-policy`, `/terms` — accessibles avant et après authentification
- [x] WhatsApp intégré dans la landing page — topbar (lien cliquable) et section CTA (bouton secondaire)
- [x] Corrections landing page : R1 labellisé "Reproductrice" (seul R2 est commercial), compteur rôles acteurs corrigé à 6
- [x] Monitoring : Prometheus, Grafana, Alertmanager, Kafka UI
- [x] 72+ migrations Flyway — schéma base de données entièrement versionné
- [x] Schema per Service — 6 schémas PostgreSQL distincts (catalog, lot, stock, orders, shared, geo)

### Réalisé (DevOps — Phase 1)
- [x] Multi-stage builds Docker pour les 4 services Java (Maven → eclipse-temurin:21-jre-alpine)
- [x] Images Alpine : -150 MB par service Java (~600 MB total)
- [x] Alpine vs Distroless : choix documenté et justifié (shell conservé, contexte institutionnel)
- [x] SemVer 1.0.0 sur les 5 images applicatives (`seed-catalog`, `seed-lot`, `seed-stock`, `seed-order`, `seed-frontend`)
- [x] SHA256 digest pinning sur les images tierces sans tag stable (kafka-ui, pgadmin, kafka-exporter)
- [x] `npm ci` pour builds frontend déterministes (12-Factor App §IV)
- [x] `frontend/.dockerignore` (exclut node_modules, .git, .env)
- [x] CORS : retrait de `localhost:3000` (origine obsolète, principe de moindre privilège)
- [x] `kafka-exporter` : ajout `restart: unless-stopped` (continuité observabilité)

### Réalisé (DevOps — Phase 2)
- [x] `postgres:16` → `postgres:16-alpine` (-185 MB, même comportement fonctionnel)
- [x] Keycloak healthcheck sur `/health/ready:9000` (port management dédié)
- [x] Cascade `service_healthy` : tous les services attendent Keycloak opérationnel
- [x] `SWAGGER_ENABLED: false` sur les 4 microservices (surface d'attaque réduite)
- [x] Jenkinsfile corrigé : `jdk21`, stage `seed-common` séquentiel, Deploy, Smoke Test fonctionnel

### Réalisé (Sécurité — Gestion Keycloak)
- [x] Séparation structure / secrets : `realm-seed-v0.json` versionné sans aucun mot de passe
- [x] `infra/keycloak/users-credentials.env` — fichier local non commité, contient les mots de passe des 25 users
- [x] Alignement realm JSON ↔ Keycloak : 25 users réels (suppression 6 comptes fantômes, ajout 4 users manquants)
- [x] Rôle `seed-directeur` ajouté au JSON (existait dans Keycloak, absent du versioning)
- [x] `scripts/sync-keycloak.sh` — synchronisation idempotente via Admin API (crée/met à jour, ne supprime jamais)
- [x] `scripts/export-keycloak.sh` — export realm sans credentials pour maintenir le JSON à jour
- [x] `scripts/keycloak-maintenance.sh` — script guidé tout-en-un : export + diff + revue humaine + commit optionnel

### À venir (Phase 3 — Durcissement production)
- [ ] `USER nonroot` dans tous les Dockerfiles (principe de moindre privilège, CIS Docker Benchmark)
- [ ] Réseaux Docker explicites (`seed-backend`, `seed-monitoring`) — isolation réseau inter-services
- [ ] Frontend : `nginx:alpine` + `npm run build` statique (remplace le serveur Vite de développement)
- [ ] Keycloak : `start-dev` → `start` avec TLS activé (mode production)
- [ ] Jenkins : `pollSCM` → webhooks GitHub (avec serveur public ou tunnel sécurisé)

### À venir (Performance & Scalabilité — OS8 / OS9)
- [ ] Tests de charge formels avec k6 ou JMeter sur les endpoints critiques (< 200ms objectif)
- [ ] Pagination serveur sur les listes volumineuses (lots, stocks, commandes)
- [ ] Cache applicatif Spring Cache + Redis pour le référentiel variétal (données stables)
- [ ] PostgreSQL réplication primary/replica (scalabilité lecture en production)
- [ ] Kafka multi-broker 3 nœuds + replication factor 3 (haute disponibilité)

### À venir (Déploiement ISRA — OS10)
- [ ] Configuration reverse proxy Nginx/Traefik avec TLS (Let's Encrypt ou certificat ISRA)
- [ ] Migration ports `127.0.0.1:*` → exposition contrôlée via reverse proxy uniquement
- [ ] Déploiement sur serveur physique ISRA/CNRA Bambey (Ubuntu 22.04, 8 Go RAM min)
- [ ] Sauvegarde automatique PostgreSQL (cron + stockage externe)
- [ ] Monitoring en conditions réelles + ajustement des seuils d'alerte Alertmanager

### À venir (Fonctionnel — Indicateurs agronomiques)
- [ ] Code couleur rendement par espèce dans le formulaire de création de lot (vert / orange / rouge selon les seuils ISRA par espèce) — nécessite validation des seuils par les agronomes CNRA pour mil, riz, niébé, arachide, sorgho
- [ ] Extension possible : intégration des seuils dans la base de données (table `catalog.espece` ou table dédiée) pour permettre une mise à jour sans redéploiement frontend

### À venir (Formation & Documentation — OS11)
- [ ] Guide utilisateur par rôle en PDF (sélectionneur, UPSemCL, multiplicateur, quotataire, admin)
- [ ] Manuel administrateur Keycloak (gestion des comptes, attribution des rôles)
- [ ] Session de formation utilisateurs finaux ISRA/CNRA
- [ ] Vidéos de démonstration pour la soutenance et les investisseurs

---

## ⚠️ Rappels avant mise en production

Ces points sont documentés ici pour ne pas être oubliés lors du passage en production. Ils sont intentionnellement différés en développement.

### Secrets et variables d'environnement

| Variable | Statut actuel | Action requise |
|---|---|---|
| `POSTGRES_PASSWORD` | Valeur par défaut `seed` dans `.env` | Générer un mot de passe fort, stocker dans un secret manager |
| `KEYCLOAK_ADMIN_PASSWORD` | Valeur par défaut `admin` | Changer impérativement en production |
| `GRAFANA_PASSWORD` | Valeur par défaut `admin` | Changer impérativement en production |
| `SMTP_PASSWORD` | App password Gmail dans `.env` | Ne jamais committer — utiliser un secret Docker ou un vault |
| `PGADMIN_DEFAULT_PASSWORD` | Valeur par défaut `admin` | Changer avant exposition publique |

> Le fichier `.env` est dans `.gitignore`. **Ne jamais le committer.**

### Infrastructure

| Point | Statut actuel | Action requise |
|---|---|---|
| Keycloak mode | `start-dev` (base H2 en mémoire pour les sessions) | Passer en `start` avec TLS et base PostgreSQL persistante |
| Frontend serveur | Vite dev server | Remplacer par `nginx:alpine` + build statique (`npm run build`) |
| TLS / HTTPS | Absent | Reverse proxy (Nginx/Traefik) avec certificat Let's Encrypt |
| Exposition ports | `127.0.0.1:*` (loopback uniquement) | En production, ne jamais exposer les ports directement — tout passer par le reverse proxy |
| Avatar utilisateur | Stocké en base64 dans `localStorage` | Implémenter `POST /membres/mon-profil/avatar` côté serveur |
| Réseaux Docker | Réseau par défaut (partagé) | Segmenter : `seed-backend`, `seed-monitoring`, `seed-db` |

### Sauvegardes

```bash
# Sauvegarde PostgreSQL (à automatiser via cron)
docker exec seed-postgres pg_dump -U seed seed > backup_$(date +%Y%m%d).sql

# Restauration
docker exec -i seed-postgres psql -U seed seed < backup_YYYYMMDD.sql
```

---

## Scalabilité (OS9)

### Architecture conçue pour la montée en charge

L'architecture microservices de Sen Jiwu est **intrinsèquement scalable** : chaque service est indépendant et peut être répliqué sans modifier les autres.

```
┌──────────────────────────────────────────────────────────┐
│  catalog-service  ×1        → docker compose up --scale  │
│  lot-service      ×1           catalog-service=3         │
│  stock-service    ×1           (load balancer requis)    │
│  order-service    ×1                                     │
└──────────────────────────────────────────────────────────┘
```

**Ce qui est déjà en place :**
- **Microservices indépendants** : chaque service possède son propre schéma PostgreSQL et peut être redémarré/mis à l'échelle sans impacter les autres
- **Kafka comme bus d'événements** : les opérations asynchrones (lot REC, transferts, notifications) sont découplées — Kafka absorbe les pics de charge sans bloquer les APIs REST
- **`mem_limit` par container** : chaque service est limité en mémoire pour éviter qu'un service monopolise les ressources de l'hôte
- **JVM G1GC** : collecteur garbage adapté aux applications longue durée avec SLA de latence (MaxGCPauseMillis=20-50ms)

**Évolutions prévues (production) :**

| Besoin | Solution recommandée |
|---|---|
| Réplication d'instances | Docker Swarm (simple) ou Kubernetes (complet) |
| Load balancing | Nginx upstream / Traefik |
| Cache distribué | Redis (sessions, résultats fréquents) |
| Base de données scalable | PostgreSQL réplication (primary + replica) |
| Kafka multi-broker | Passage de 1 à 3 brokers Kafka (réplication factor 3) |

> **Justification architecturale** : le choix des microservices vs monolithe était délibéré. Un monolithe aurait été plus simple à développer mais impossible à scaler partiellement — on ne peut pas scaler uniquement le module "commandes" si c'est lui qui reçoit le plus de trafic.

---

## Performance (OS8)

### Optimisations en place

**JVM (tous les services Java) :**

| Paramètre | Valeur | Effet |
|---|---|---|
| `-Xms` | 48–64 MB | Démarrage rapide, pas d'allocation mémoire inutile |
| `-Xmx` | 192–256 MB | Plafond mémoire par service (évite OOM) |
| `XX:+UseG1GC` | activé | Garbage collector low-latency |
| `XX:MaxGCPauseMillis` | 20–50 ms | SLA de pause GC explicite |
| `XX:TieredStopAtLevel=1` | activé | Compilation JIT réduite au niveau C1 (startup plus rapide) |
| `XX:MaxMetaspaceSize` | 128–200 MB | Plafond Metaspace explicite (évite leak mémoire) |

**Kafka :**
- Les opérations lourdes (création de lot REC, événements de stock) passent par Kafka en asynchrone — le client REST reçoit une réponse immédiate sans attendre la propagation
- Rétention des messages : 24h (suffisant pour re-traitement en cas d'échec)

**Monitoring de performance :**
- **Prometheus + Grafana** : métriques JVM (heap, GC, threads), latence HTTP (blackbox-exporter)
- **Kafka UI** : lag des consumer groups, throughput des topics
- **`/actuator/health`** : healthcheck sur chaque service (utilisé par Docker et le Smoke Test Jenkins)

### Objectifs quantitatifs (à mesurer)

| Endpoint | Objectif cible | Outil de mesure |
|---|---|---|
| `GET /varietes` | < 200 ms | Grafana / blackbox-exporter |
| `POST /lots` | < 500 ms | Grafana / JMeter |
| `GET /stocks` | < 300 ms | Grafana / blackbox-exporter |
| Auth Keycloak (PKCE) | < 800 ms | Grafana |

**Axes d'amélioration identifiés :**
- Pagination serveur sur les listes volumineuses (actuellement chargement total)
- Cache applicatif (Spring Cache + Redis) pour le référentiel variétal (données stables)
- Tests de charge formels avec [k6](https://k6.io) ou JMeter (à réaliser avant déploiement ISRA)

---

## Niveaux d'exposition — Accès depuis une autre machine

### Pourquoi `localhost` est inaccessible depuis l'extérieur

Tous les ports sont actuellement liés à `127.0.0.1` (adresse loopback) dans `docker-compose.yml` :

```yaml
ports:
  - "127.0.0.1:5173:5173"    # frontend
  - "127.0.0.1:18080:8080"   # Keycloak
  - "127.0.0.1:18081:8080"   # catalog-service
  # ...
```

`127.0.0.1` est une adresse **locale à la machine elle-même**. Aucun autre appareil — même connecté au même réseau Wi-Fi — ne peut y accéder. C'est intentionnel en développement (surface d'attaque réduite), mais cela bloque tout accès externe.

---

### Niveau 1 — Réseau local (LAN)

**Cas d'usage** : jury/collègues dans la même salle, démonstration en réseau d'entreprise ou sur un réseau Wi-Fi partagé.

```
Ton laptop (Docker)  ─── Wi-Fi/LAN ───►  Laptop jury
192.168.1.42:5173                         http://192.168.1.42:5173
```

**Ce qu'il faut faire :**
- Remplacer `127.0.0.1` par `0.0.0.0` dans les bindings `docker-compose.yml` pour exposer sur toutes les interfaces réseau
- Mettre à jour Keycloak et CORS avec l'IP locale de la machine (voir section [3 endroits à mettre à jour](#les-3-endroits-à-mettre-à-jour-obligatoires) ci-dessous)

**Limites :**
- L'IP locale change selon le réseau (chaque réseau Wi-Fi attribue une IP différente)
- Pas de HTTPS — navigateurs modernes peuvent bloquer certaines fonctionnalités
- Ne fonctionne pas si le jury est à distance

---

### Niveau 2 — URL publique temporaire (tunnel)

**Cas d'usage** : jury à distance, démo en ligne ponctuelle, démonstration sans serveur dédié.

```
Internet
    ↓
Tunnel (ngrok / Cloudflare Tunnel)
    ↓ URL générée : https://abc123.ngrok.io
Ton laptop (Docker)
```

**Outils disponibles :**

| Outil | Avantage | Limite |
|---|---|---|
| **ngrok** | Simple, rapide à configurer | URL change à chaque session (version gratuite), limite de connexions |
| **Cloudflare Tunnel** | URL stable possible, gratuit | Configuration légèrement plus complexe |
| **localtunnel** | Très simple | Instable, déconseillé pour démo officielle |

**Limites :**
- URL temporaire et instable (ngrok gratuit)
- Keycloak doit aussi être exposé via un tunnel (ou sur la même URL publique) — sinon le flux OAuth2 casse
- Non adapté à un usage continu ou multi-utilisateurs

---

### Niveau 3 — Serveur dédié avec URL stable

**Cas d'usage** : URL permanente partageable, accès multi-utilisateurs, démo mémoire en ligne, déploiement ISRA.

```
Internet
    ↓
Serveur (VPS ou serveur physique ISRA)
    ↓ IP publique ou domaine : senjiwu.isra.sn
Reverse proxy Nginx / Traefik  (TLS / HTTPS)
    ↓
Docker Compose (tous les services)
```

**Options de serveur :**

| Option | Coût | Cas d'usage |
|---|---|---|
| VPS OVH / DigitalOcean / Hetzner | 5–15€/mois | Démo mémoire, test public |
| Render / Railway (PaaS) | Gratuit (limité) / payant | Prototype rapide |
| Serveur physique ISRA/CNRA | Gratuit (infra ISRA) | Production réelle — OS10 |

> Le détail de la mise en production sur serveur ISRA est documenté dans la section [Déploiement sur serveur ISRA (OS10)](#déploiement-sur-serveur-isra-os10) ci-dessous.

---

### Les 3 endroits à mettre à jour (obligatoires)

C'est le point critique de tout accès externe. **Si un seul des trois n'est pas mis à jour, la connexion échoue** (redirect_uri mismatch Keycloak ou CORS bloqué côté API).

```
┌─────────────────────────────────────────────────────────────────┐
│  1. KEYCLOAK (infra/keycloak/ — realm seed-v0)                  │
│     → Redirect URIs du client seed-frontend                     │
│     → Web Origins (CORS) dans le realm                         │
│     Avant : http://localhost:5173                               │
│     Après : https://ton-domaine.com  (ou http://IP:5173)        │
├─────────────────────────────────────────────────────────────────┤
│  2. SPRING BOOT (docker-compose.yml)                            │
│     → CORS_ALLOWED_ORIGINS sur les 4 microservices             │
│     Avant : http://localhost:5173                               │
│     Après : https://ton-domaine.com  (ou http://IP:5173)        │
├─────────────────────────────────────────────────────────────────┤
│  3. FRONTEND (src/lib/keycloak.ts ou variable d'environnement)  │
│     → URL de Keycloak que le navigateur appelle                 │
│     Avant : http://localhost:18080                              │
│     Après : https://auth.ton-domaine.com  (ou http://IP:18080)  │
└─────────────────────────────────────────────────────────────────┘
```

> **Pourquoi le point 3 est souvent oublié** : le navigateur de l'utilisateur distant doit pouvoir joindre Keycloak directement (le flux PKCE se fait côté client). Si Keycloak reste sur `localhost:18080`, le navigateur distant ne peut pas le contacter — même si le frontend est accessible.

---

### Tableau de décision rapide

| Besoin | Solution recommandée | Délai estimé |
|---|---|---|
| Présenter au jury dans la même salle | Niveau 1 — LAN (IP locale) | ~30 min |
| Présenter au jury à distance ponctuellement | Niveau 2 — Tunnel ngrok/Cloudflare | ~15 min |
| URL stable pour soutenance en ligne | Niveau 3 — VPS (OVH/Hetzner) | 1–2 jours |
| Déploiement production utilisateurs ISRA | Niveau 3 — Serveur physique ISRA | Planification DSI ISRA |

---

## Déploiement sur serveur ISRA (OS10)

### Architecture cible

```
Internet / LAN ISRA
        │
        ▼
  ┌──────────────┐
  │  Nginx/Traefik│  ← Reverse proxy + TLS (Let's Encrypt ou cert ISRA)
  │  :443 / :80  │
  └──────┬───────┘
         │
         ├── /             → Frontend (nginx:alpine :5173)
         ├── /auth         → Keycloak (:18080)
         ├── /api/catalog  → catalog-service (:18081)
         ├── /api/lot      → lot-service (:18082)
         ├── /api/stock    → stock-service (:18083)
         └── /api/order    → order-service (:18084)
```

### Prérequis serveur ISRA

| Composant | Minimum | Recommandé |
|---|---|---|
| CPU | 4 cœurs | 8 cœurs |
| RAM | 8 Go | 16 Go |
| Disque | 50 Go SSD | 100 Go SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Docker Engine | 26+ | 26+ |
| Docker Compose | v2+ | v2+ |

### Étapes de mise en production

```
Étape 1 — Phase 3 Docker        USER non-root, réseaux explicites, nginx:alpine
Étape 2 — Keycloak production   start-dev → start, TLS activé, realm exporté
Étape 3 — Secrets               .env sécurisé, mots de passe forts, SMTP validé
Étape 4 — Reverse proxy         Nginx ou Traefik avec certificat TLS
Étape 5 — Ports réseau          127.0.0.1:* → 0.0.0.0:* (ou via reverse proxy uniquement)
Étape 6 — Sauvegarde auto       cron pg_dump + stockage externe (Nextcloud ISRA ou S3)
Étape 7 — Tests de charge       k6 ou JMeter sur les endpoints critiques
Étape 8 — Formation             Guide utilisateur par rôle + session de formation CNRA
```

### Changements docker-compose pour serveur

```yaml
# Remplacer les bindings loopback par 0.0.0.0 (ou supprimer le préfixe)
# Avant (dev local uniquement) :
ports:
  - "127.0.0.1:18081:8080"

# Après (serveur, derrière reverse proxy) :
ports:
  - "18081:8080"   # ou ne pas exposer et laisser Nginx accéder via réseau Docker
```

---

## Formation et guide utilisateur (OS11)

### Documentation disponible

| Document | Audience | État |
|---|---|---|
| README technique (ce fichier) | Développeurs, administrateurs système | ✅ Complet |
| Comptes de démo configurés | Formateurs, jury de soutenance | ✅ Disponible |
| Page Documentation (`/documentation`) | Tout public — pipeline CEDEAO/CILSS, rôles, glossaire | ✅ Disponible |
| Politique de confidentialité (`/privacy-policy`) | Utilisateurs de la plateforme | ✅ Disponible |
| Conditions d'utilisation (`/terms`) | Utilisateurs de la plateforme | ✅ Disponible |
| Guide utilisateur par rôle | Utilisateurs finaux ISRA/CNRA | 🔲 À rédiger |
| Manuel administrateur Keycloak | Administrateur ISRA | 🔲 À rédiger |
| Vidéos de démonstration | Investisseurs, jury | 🔲 À envisager |

### Guide utilisateur — contenu prévu par rôle

| Rôle | Workflows à documenter |
|---|---|
| **Sélectionneur** | Créer une variété, créer un lot G0/G1, initier un transfert, consulter les analytiques |
| **UPSemCL** | Recevoir un transfert, créer lots G2/G3, gérer le stock UPSemCL, passer une commande |
| **Multiplicateur** | Gérer mes sites, créer lots R1/R2, suivre mon stock, passer une commande G3 |
| **Quotataire** | Consulter le catalogue, passer une commande R2, suivre mon panier |
| **Admin** | Gérer les utilisateurs Keycloak, superviser la plateforme, consulter les analytiques |

### Format recommandé

Un guide par rôle au format **PDF** ou **page web statique**, organisé par workflows avec captures d'écran annotées. La plateforme étant destinée au personnel ISRA/CNRA, le guide doit être rédigé en **français** avec le vocabulaire métier semencier (G0, R2, UPSemCL, ZAE, etc.).

---

## Contexte du projet

Ce système a été développé dans le cadre d'un **mémoire de fin d'études de Master 2 en Systèmes d'Information** à l'Université Alioune Diop de Bambey (UADB), réalisé en stage au **Centre National de Recherches Agronomiques (CNRA) de Bambey**, sous la supervision de **M. Biram BITEYE**.

Il répond aux besoins réels de modernisation et de traçabilité de la filière semencière nationale sénégalaise.

---

<div align="center">
  <sub>Développé par <strong>Toussaint GOMIS</strong> · M2 SI UADB · ISRA / CNRA Bambey · 2025–2026 · Sen Jiwu</sub><br>
  <sub>toussaint.gomis@uadb.edu.sn · +221 77 758 28 71</sub>
</div>
