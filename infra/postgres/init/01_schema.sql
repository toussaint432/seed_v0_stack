-- ============================================================
-- 01_schema.sql — Docker PostgreSQL init script
-- SEED Platform — ISRA / CNRA
--
-- Ce script s'exécute UNE SEULE FOIS à la création du volume
-- Docker (premier démarrage du conteneur PostgreSQL).
-- Il crée le schéma complet de la plateforme.
--
-- ⚠️  Flyway (catalog-service) est le propriétaire officiel
--     du schéma. En production, utiliser uniquement Flyway.
--     Ce fichier doit rester synchronisé avec :
--     services/catalog-service/src/main/resources/db/migration/
--     V1__schema_complet.sql
-- ============================================================

-- Extensions PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- Recherche fulltext par trigrammes
CREATE EXTENSION IF NOT EXISTS unaccent;  -- Comparaisons insensibles aux accents

-- ────────────────────────────────────────────────────────────
-- RÉFÉRENTIEL CATALOGUE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS espece (
  id               BIGSERIAL    PRIMARY KEY,
  code_espece      VARCHAR(30)  UNIQUE NOT NULL,
  nom_commun       VARCHAR(120) NOT NULL,
  nom_scientifique VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS zone_agro (
  id          BIGSERIAL    PRIMARY KEY,
  code        VARCHAR(10)  UNIQUE NOT NULL,
  nom         VARCHAR(150) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS variete (
  id                      BIGSERIAL    PRIMARY KEY,
  code_variete            VARCHAR(50)  UNIQUE NOT NULL,
  nom_variete             VARCHAR(200) NOT NULL,
  id_espece               BIGINT       NOT NULL REFERENCES espece(id),
  origine                 VARCHAR(200),
  selectionneur_principal VARCHAR(200),
  annee_creation          INTEGER,
  cycle_jours             INTEGER,
  statut_variete          VARCHAR(30)  NOT NULL DEFAULT 'DIFFUSEE'
                          CHECK (statut_variete IN ('DIFFUSEE','EN_TEST','RETIREE','ARCHIVEE')),
  date_creation           TIMESTAMP    DEFAULT now(),
  -- Soft-delete traçable
  commentaire_archivage   TEXT,
  date_archivage          TIMESTAMP,
  archive_par             VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS variete_zone (
  id_variete        BIGINT     NOT NULL REFERENCES variete(id) ON DELETE CASCADE,
  id_zone           BIGINT     NOT NULL REFERENCES zone_agro(id),
  niveau_adaptation VARCHAR(20) NOT NULL DEFAULT 'OPTIMAL'
                    CHECK (niveau_adaptation IN ('OPTIMAL','ACCEPTABLE','MARGINALE')),
  PRIMARY KEY (id_variete, id_zone)
);

-- ────────────────────────────────────────────────────────────
-- RÉFÉRENTIEL SEMENCIER
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generation_semence (
  id               BIGSERIAL   PRIMARY KEY,
  code_generation  VARCHAR(10) UNIQUE NOT NULL,
  ordre_generation INTEGER     NOT NULL
);

CREATE TABLE IF NOT EXISTS campagne (
  id            BIGSERIAL    PRIMARY KEY,
  code_campagne VARCHAR(50)  UNIQUE NOT NULL,
  libelle       VARCHAR(200) NOT NULL,
  annee         INTEGER      NOT NULL,
  date_debut    DATE,
  date_fin      DATE,
  statut        VARCHAR(30)  NOT NULL DEFAULT 'PLANIFIEE'
                CHECK (statut IN ('PLANIFIEE','EN_COURS','TERMINEE','ANNULEE')),
  created_at    TIMESTAMP    DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- ORGANISATIONS ET SITES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organisation (
  id                BIGSERIAL    PRIMARY KEY,
  code_organisation VARCHAR(80)  UNIQUE NOT NULL,
  nom_organisation  VARCHAR(200) NOT NULL,
  type_organisation VARCHAR(50)  NOT NULL
                    CHECK (type_organisation IN ('ISRA','UPSEMCL','MULTIPLICATEUR',
                                                 'COOPERATIVE','DETAILLANT','ONG','AUTRE')),
  region            VARCHAR(100),
  localite          VARCHAR(100),
  contact           VARCHAR(150),
  telephone         VARCHAR(50),
  email             VARCHAR(150),
  active            BOOLEAN      NOT NULL DEFAULT true,
  latitude          NUMERIC(10,6),
  longitude         NUMERIC(10,6),
  created_at        TIMESTAMP    DEFAULT now()
);

CREATE TABLE IF NOT EXISTS membre_organisation (
  id                BIGSERIAL    PRIMARY KEY,
  keycloak_username VARCHAR(150) UNIQUE NOT NULL,
  keycloak_role     VARCHAR(50)  NOT NULL,
  nom_complet       VARCHAR(150) NOT NULL,
  id_organisation   BIGINT       NOT NULL REFERENCES organisation(id),
  role_dans_org     VARCHAR(50)  NOT NULL DEFAULT 'MEMBRE',
  principal         BOOLEAN      NOT NULL DEFAULT false,
  telephone         VARCHAR(50),
  created_at        TIMESTAMP    DEFAULT now(),
  updated_at        TIMESTAMP    DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site (
  id              BIGSERIAL    PRIMARY KEY,
  code_site       VARCHAR(50)  UNIQUE NOT NULL,
  nom_site        VARCHAR(200) NOT NULL,
  type_site       VARCHAR(30)  NOT NULL
                  CHECK (type_site IN ('MAGASIN','FERME','LABORATOIRE','STATION_RECHERCHE','SILO')),
  localite        VARCHAR(200),
  region          VARCHAR(200),
  id_organisation BIGINT       REFERENCES organisation(id),
  latitude        NUMERIC(10,6),
  longitude       NUMERIC(10,6)
);

-- ────────────────────────────────────────────────────────────
-- LOTS SEMENCIERS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lot_semencier (
  id                  BIGSERIAL     PRIMARY KEY,
  code_lot            VARCHAR(80)   UNIQUE NOT NULL,
  id_variete          BIGINT        NOT NULL REFERENCES variete(id),
  id_generation       BIGINT        NOT NULL REFERENCES generation_semence(id),
  id_lot_parent       BIGINT        REFERENCES lot_semencier(id),
  id_campagne         BIGINT        REFERENCES campagne(id),
  date_production     DATE,
  quantite_nette      NUMERIC(14,2),
  unite               VARCHAR(10)   NOT NULL DEFAULT 'kg',
  taux_germination    NUMERIC(5,2)  CHECK (taux_germination BETWEEN 0 AND 100),
  purete_physique     NUMERIC(5,2)  CHECK (purete_physique BETWEEN 0 AND 100),
  statut_lot          VARCHAR(30)   NOT NULL DEFAULT 'DISPONIBLE'
                      CHECK (statut_lot IN ('DISPONIBLE','EN_PRODUCTION','CERTIFIE',
                                            'TRANSFERE','EPUISE','RETIRE')),
  -- Traçabilité acteurs
  id_org_producteur   BIGINT        REFERENCES organisation(id),
  username_createur   VARCHAR(150),
  responsable_nom     VARCHAR(150),
  responsable_role    VARCHAR(100),
  created_at          TIMESTAMP     DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- QUALITÉ ET CERTIFICATION
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS controle_qualite (
  id                   BIGSERIAL    PRIMARY KEY,
  id_lot               BIGINT       NOT NULL REFERENCES lot_semencier(id) ON DELETE CASCADE,
  type_controle        VARCHAR(50)  NOT NULL
                       CHECK (type_controle IN ('GERMINATION','HUMIDITE','PURETE_PHYSIQUE',
                                                'PURETE_SPECIFIQUE','SANITAIRE','COMPLET')),
  date_controle        DATE         NOT NULL,
  taux_germination     NUMERIC(5,2) CHECK (taux_germination BETWEEN 0 AND 100),
  taux_humidite        NUMERIC(5,2) CHECK (taux_humidite BETWEEN 0 AND 100),
  purete_physique      NUMERIC(5,2) CHECK (purete_physique BETWEEN 0 AND 100),
  purete_specifique    NUMERIC(5,2) CHECK (purete_specifique BETWEEN 0 AND 100),
  conformite_varietale VARCHAR(50)  CHECK (conformite_varietale IN ('CONFORME','NON_CONFORME','PARTIELLE')),
  resultat             VARCHAR(30)  NOT NULL
                       CHECK (resultat IN ('CONFORME','NON_CONFORME','EN_ATTENTE')),
  controleur           VARCHAR(150),
  observations         TEXT,
  created_at           TIMESTAMP    DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certification (
  id                      BIGSERIAL    PRIMARY KEY,
  id_lot                  BIGINT       NOT NULL REFERENCES lot_semencier(id) ON DELETE CASCADE,
  organisme_certificateur VARCHAR(200) NOT NULL,
  numero_certificat       VARCHAR(100) UNIQUE NOT NULL,
  date_demande            DATE,
  date_inspection         DATE,
  date_certification      DATE,
  resultat_certification  VARCHAR(30)  NOT NULL
                          CHECK (resultat_certification IN ('CONFORME','NON_CONFORME','EN_ATTENTE')),
  motif_rejet             TEXT,
  date_expiration         DATE,
  nom_document            VARCHAR(255),
  contenu_document        BYTEA,
  created_at              TIMESTAMP    DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- STOCK ET MOUVEMENTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock (
  id                  BIGSERIAL     PRIMARY KEY,
  id_lot              BIGINT        NOT NULL REFERENCES lot_semencier(id),
  id_site             BIGINT        NOT NULL REFERENCES site(id),
  quantite_disponible NUMERIC(14,2) NOT NULL DEFAULT 0
                      CHECK (quantite_disponible >= 0),
  unite               VARCHAR(10)   NOT NULL DEFAULT 'kg',
  updated_at          TIMESTAMP     DEFAULT now(),
  UNIQUE (id_lot, id_site)
);

CREATE TABLE IF NOT EXISTS mouvement_stock (
  id                  BIGSERIAL     PRIMARY KEY,
  id_lot              BIGINT        NOT NULL REFERENCES lot_semencier(id),
  type_mouvement      VARCHAR(20)   NOT NULL
                      CHECK (type_mouvement IN ('IN','OUT','TRANSFER')),
  id_site_source      BIGINT        REFERENCES site(id),
  id_site_destination BIGINT        REFERENCES site(id),
  quantite            NUMERIC(14,2) NOT NULL CHECK (quantite > 0),
  unite               VARCHAR(10)   NOT NULL DEFAULT 'kg',
  reference_operation VARCHAR(80),
  username_operateur  VARCHAR(150),
  created_at          TIMESTAMP     DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- PROGRAMMES DE MULTIPLICATION
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_multiplication (
  id               BIGSERIAL     PRIMARY KEY,
  code_programme   VARCHAR(80)   UNIQUE NOT NULL,
  id_lot_source    BIGINT        REFERENCES lot_semencier(id),
  id_organisation  BIGINT        REFERENCES organisation(id),
  generation_cible VARCHAR(10)   NOT NULL
                   CHECK (generation_cible IN ('G0','G1','G2','G3','G4','R1','R2')),
  superficie_ha    NUMERIC(12,3) CHECK (superficie_ha > 0),
  objectif_kg      NUMERIC(14,2) CHECK (objectif_kg > 0),
  date_debut       DATE,
  date_fin         DATE,
  statut           VARCHAR(30)   NOT NULL DEFAULT 'PLANIFIE'
                   CHECK (statut IN ('PLANIFIE','EN_COURS','TERMINE','SUSPENDU','ANNULE')),
  observations     TEXT,
  created_at       TIMESTAMP     DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parcelle_multiplication (
  id                  BIGSERIAL     PRIMARY KEY,
  id_programme        BIGINT        NOT NULL REFERENCES programme_multiplication(id) ON DELETE CASCADE,
  code_parcelle       VARCHAR(50)   UNIQUE NOT NULL,
  superficie_ha       NUMERIC(12,3) NOT NULL CHECK (superficie_ha > 0),
  localite            VARCHAR(200),
  date_semis          DATE,
  date_recolte_prevue DATE,
  observations        TEXT,
  created_at          TIMESTAMP     DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rendement_production (
  id                       BIGSERIAL     PRIMARY KEY,
  id_programme             BIGINT        NOT NULL REFERENCES programme_multiplication(id) ON DELETE CASCADE,
  id_parcelle              BIGINT        REFERENCES parcelle_multiplication(id),
  rendement_reel_kg_ha     NUMERIC(10,2) CHECK (rendement_reel_kg_ha >= 0),
  quantite_recoltee_totale NUMERIC(14,2) CHECK (quantite_recoltee_totale >= 0),
  date_recolte             DATE,
  taux_perte_pct           NUMERIC(5,2)  CHECK (taux_perte_pct BETWEEN 0 AND 100),
  observations             TEXT,
  created_at               TIMESTAMP     DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- TRANSFERTS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transfert (
  id                       BIGSERIAL     PRIMARY KEY,
  code_transfert           VARCHAR(80)   UNIQUE NOT NULL,
  id_lot                   BIGINT        NOT NULL REFERENCES lot_semencier(id),
  organisation_source      VARCHAR(200)  NOT NULL,
  organisation_destination VARCHAR(200)  NOT NULL,
  role_source              VARCHAR(50),
  role_destination         VARCHAR(50),
  quantite                 NUMERIC(14,2) NOT NULL CHECK (quantite > 0),
  unite                    VARCHAR(10)   NOT NULL DEFAULT 'kg',
  statut                   VARCHAR(30)   NOT NULL DEFAULT 'EN_ATTENTE'
                           CHECK (statut IN ('EN_ATTENTE','ACCEPTE','REJETE','ANNULE')),
  date_transfert           DATE,
  observations             TEXT,
  created_at               TIMESTAMP     DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfert_lot (
  id                    BIGSERIAL     PRIMARY KEY,
  code_transfert        VARCHAR(80)   UNIQUE NOT NULL,
  id_lot                BIGINT        NOT NULL REFERENCES lot_semencier(id),
  username_emetteur     VARCHAR(150)  NOT NULL,
  role_emetteur         VARCHAR(50)   NOT NULL,
  username_destinataire VARCHAR(150)  NOT NULL,
  role_destinataire     VARCHAR(50)   NOT NULL,
  generation_transferee VARCHAR(10)   NOT NULL
                        CHECK (generation_transferee IN ('G0','G1','G2','G3','G4','R1','R2')),
  quantite              NUMERIC(12,2) CHECK (quantite > 0),
  statut                VARCHAR(30)   NOT NULL DEFAULT 'EN_ATTENTE'
                        CHECK (statut IN ('EN_ATTENTE','ACCEPTE','REJETE','ANNULE')),
  date_demande          DATE          DEFAULT CURRENT_DATE,
  date_acceptation      DATE,
  motif_refus           TEXT,
  observations          TEXT,
  created_at            TIMESTAMP     DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- COMMANDES ET DISTRIBUTION
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commande (
  id                          BIGSERIAL    PRIMARY KEY,
  code_commande               VARCHAR(80)  UNIQUE NOT NULL,
  client                      VARCHAR(200) NOT NULL,
  statut                      VARCHAR(30)  NOT NULL DEFAULT 'SOUMISE'
                              CHECK (statut IN ('SOUMISE','ACCEPTEE','EN_PREPARATION',
                                                'LIVREE','ANNULEE','REJETEE')),
  username_acheteur           VARCHAR(150),
  id_organisation_acheteur    BIGINT       REFERENCES organisation(id),
  id_organisation_fournisseur BIGINT       REFERENCES organisation(id),
  observations                TEXT,
  created_at                  TIMESTAMP    DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ligne_commande (
  id                BIGSERIAL     PRIMARY KEY,
  id_commande       BIGINT        NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  id_variete        BIGINT        NOT NULL REFERENCES variete(id),
  id_generation     BIGINT        REFERENCES generation_semence(id),
  quantite_demandee NUMERIC(14,2) NOT NULL CHECK (quantite_demandee > 0),
  unite             VARCHAR(10)   NOT NULL DEFAULT 'kg'
);

CREATE TABLE IF NOT EXISTS allocation_commande (
  id               BIGSERIAL     PRIMARY KEY,
  id_ligne         BIGINT        NOT NULL REFERENCES ligne_commande(id) ON DELETE CASCADE,
  id_lot           BIGINT        NOT NULL REFERENCES lot_semencier(id),
  quantite_allouee NUMERIC(14,2) NOT NULL CHECK (quantite_allouee > 0),
  created_at       TIMESTAMP     DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- MESSAGERIE
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation (
  id                 BIGSERIAL    PRIMARY KEY,
  participant_1      VARCHAR(150) NOT NULL,
  participant_2      VARCHAR(150) NOT NULL,
  dernier_message_at TIMESTAMP    DEFAULT now(),
  created_at         TIMESTAMP    DEFAULT now(),
  UNIQUE (participant_1, participant_2)
);

CREATE TABLE IF NOT EXISTS message (
  id              BIGSERIAL    PRIMARY KEY,
  id_conversation BIGINT       NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  expediteur      VARCHAR(150) NOT NULL,
  type            VARCHAR(20)  NOT NULL DEFAULT 'TEXT'
                  CHECK (type IN ('TEXT','IMAGE','FICHIER','AUDIO','COMMANDE')),
  contenu         TEXT,
  url_media       TEXT,
  nom_fichier     VARCHAR(255),
  taille_fichier  INTEGER      CHECK (taille_fichier > 0),
  lu              BOOLEAN      NOT NULL DEFAULT false,
  created_at      TIMESTAMP    DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- AUDIT — HISTORIQUE STATUT LOT
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS historique_statut_lot (
  id             BIGSERIAL    PRIMARY KEY,
  id_lot         BIGINT       NOT NULL REFERENCES lot_semencier(id) ON DELETE CASCADE,
  ancien_statut  VARCHAR(30),
  nouveau_statut VARCHAR(30)  NOT NULL,
  username       VARCHAR(150),
  commentaire    TEXT,
  created_at     TIMESTAMP    DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- INDEX DE PERFORMANCE
-- ════════════════════════════════════════════════════════════

-- Variété
CREATE INDEX IF NOT EXISTS idx_variete_espece  ON variete(id_espece);
CREATE INDEX IF NOT EXISTS idx_variete_statut  ON variete(statut_variete) WHERE date_archivage IS NULL;
CREATE INDEX IF NOT EXISTS idx_variete_zone    ON variete_zone(id_zone);

-- Lot
CREATE INDEX IF NOT EXISTS idx_lot_variete     ON lot_semencier(id_variete);
CREATE INDEX IF NOT EXISTS idx_lot_generation  ON lot_semencier(id_generation);
CREATE INDEX IF NOT EXISTS idx_lot_parent      ON lot_semencier(id_lot_parent);
CREATE INDEX IF NOT EXISTS idx_lot_campagne    ON lot_semencier(id_campagne);
CREATE INDEX IF NOT EXISTS idx_lot_statut      ON lot_semencier(statut_lot);
CREATE INDEX IF NOT EXISTS idx_lot_org         ON lot_semencier(id_org_producteur);

-- Qualité
CREATE INDEX IF NOT EXISTS idx_ctrl_lot        ON controle_qualite(id_lot);
CREATE INDEX IF NOT EXISTS idx_ctrl_date       ON controle_qualite(date_controle);
CREATE INDEX IF NOT EXISTS idx_cert_lot        ON certification(id_lot);

-- Stock
CREATE INDEX IF NOT EXISTS idx_stock_lot       ON stock(id_lot);
CREATE INDEX IF NOT EXISTS idx_stock_site      ON stock(id_site);
CREATE INDEX IF NOT EXISTS idx_mvt_lot         ON mouvement_stock(id_lot);
CREATE INDEX IF NOT EXISTS idx_mvt_date        ON mouvement_stock(created_at);
CREATE INDEX IF NOT EXISTS idx_mvt_site_src    ON mouvement_stock(id_site_source);
CREATE INDEX IF NOT EXISTS idx_mvt_site_dst    ON mouvement_stock(id_site_destination);

-- Transferts
CREATE INDEX IF NOT EXISTS idx_trf_lot         ON transfert(id_lot);
CREATE INDEX IF NOT EXISTS idx_trf_statut      ON transfert(statut);
CREATE INDEX IF NOT EXISTS idx_trflot_lot      ON transfert_lot(id_lot);
CREATE INDEX IF NOT EXISTS idx_trflot_emetteur ON transfert_lot(username_emetteur);
CREATE INDEX IF NOT EXISTS idx_trflot_dest     ON transfert_lot(username_destinataire);

-- Commandes
CREATE INDEX IF NOT EXISTS idx_cmd_statut      ON commande(statut);
CREATE INDEX IF NOT EXISTS idx_cmd_acheteur    ON commande(id_organisation_acheteur);
CREATE INDEX IF NOT EXISTS idx_ligne_commande  ON ligne_commande(id_commande);
CREATE INDEX IF NOT EXISTS idx_alloc_ligne     ON allocation_commande(id_ligne);
CREATE INDEX IF NOT EXISTS idx_alloc_lot       ON allocation_commande(id_lot);

-- Organisation
CREATE INDEX IF NOT EXISTS idx_membre_org      ON membre_organisation(id_organisation);
CREATE INDEX IF NOT EXISTS idx_membre_username ON membre_organisation(keycloak_username);

-- Programme
CREATE INDEX IF NOT EXISTS idx_prog_lot        ON programme_multiplication(id_lot_source);
CREATE INDEX IF NOT EXISTS idx_prog_org        ON programme_multiplication(id_organisation);
CREATE INDEX IF NOT EXISTS idx_parcelle_prog   ON parcelle_multiplication(id_programme);
CREATE INDEX IF NOT EXISTS idx_rendement_prog  ON rendement_production(id_programme);

-- Messagerie
CREATE INDEX IF NOT EXISTS idx_msg_conv        ON message(id_conversation);
CREATE INDEX IF NOT EXISTS idx_msg_lu          ON message(id_conversation, lu) WHERE lu = false;

-- Audit
CREATE INDEX IF NOT EXISTS idx_hist_lot        ON historique_statut_lot(id_lot);
CREATE INDEX IF NOT EXISTS idx_hist_date       ON historique_statut_lot(created_at);
