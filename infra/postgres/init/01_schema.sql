-- 01_schema.sql (PostgreSQL)
CREATE TABLE IF NOT EXISTS espece (
  id BIGSERIAL PRIMARY KEY,
  code_espece VARCHAR(30) UNIQUE NOT NULL,
  nom_commun VARCHAR(120) NOT NULL,
  nom_scientifique VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS variete (
  id BIGSERIAL PRIMARY KEY,
  code_variete VARCHAR(50) UNIQUE NOT NULL,
  nom_variete VARCHAR(200) NOT NULL,
  id_espece BIGINT NOT NULL REFERENCES espece(id),
  origine VARCHAR(200),
  selectionneur_principal VARCHAR(200),
  annee_creation INT,
  cycle_jours INT,
  statut_variete VARCHAR(30) DEFAULT 'DIFFUSEE',
  date_creation TIMESTAMP DEFAULT now(),
  -- Archivage (soft-delete traçable)
  commentaire_archivage TEXT,
  date_archivage TIMESTAMP,
  archive_par VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS generation_semence (
  id BIGSERIAL PRIMARY KEY,
  code_generation VARCHAR(10) UNIQUE NOT NULL,
  ordre_generation INT NOT NULL
);

CREATE TABLE IF NOT EXISTS site (
  id BIGSERIAL PRIMARY KEY,
  code_site VARCHAR(50) UNIQUE NOT NULL,
  nom_site VARCHAR(200) NOT NULL,
  type_site VARCHAR(30) NOT NULL,
  localite VARCHAR(200),
  region VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS lot_semencier (
  id BIGSERIAL PRIMARY KEY,
  code_lot VARCHAR(80) UNIQUE NOT NULL,
  id_variete BIGINT NOT NULL REFERENCES variete(id),
  id_generation BIGINT NOT NULL REFERENCES generation_semence(id),
  id_lot_parent BIGINT NULL REFERENCES lot_semencier(id),
  campagne VARCHAR(50),
  date_production DATE,
  quantite_nette NUMERIC(14,2),
  unite VARCHAR(10) DEFAULT 'kg',
  taux_germination NUMERIC(5,2),
  purete_physique NUMERIC(5,2),
  statut_lot VARCHAR(30) DEFAULT 'DISPONIBLE',
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock (
  id BIGSERIAL PRIMARY KEY,
  id_lot BIGINT NOT NULL REFERENCES lot_semencier(id),
  id_site BIGINT NOT NULL REFERENCES site(id),
  quantite_disponible NUMERIC(14,2) NOT NULL DEFAULT 0,
  unite VARCHAR(10) DEFAULT 'kg',
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(id_lot, id_site)
);

CREATE TABLE IF NOT EXISTS mouvement_stock (
  id BIGSERIAL PRIMARY KEY,
  id_lot BIGINT NOT NULL REFERENCES lot_semencier(id),
  type_mouvement VARCHAR(20) NOT NULL, -- IN, OUT, TRANSFER
  id_site_source BIGINT NULL REFERENCES site(id),
  id_site_destination BIGINT NULL REFERENCES site(id),
  quantite NUMERIC(14,2) NOT NULL,
  unite VARCHAR(10) DEFAULT 'kg',
  reference_operation VARCHAR(80),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commande (
  id BIGSERIAL PRIMARY KEY,
  code_commande VARCHAR(80) UNIQUE NOT NULL,
  client VARCHAR(200) NOT NULL,
  statut VARCHAR(30) DEFAULT 'SOUMISE',
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ligne_commande (
  id BIGSERIAL PRIMARY KEY,
  id_commande BIGINT NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  id_variete BIGINT NOT NULL REFERENCES variete(id),
  id_generation BIGINT NULL REFERENCES generation_semence(id),
  quantite_demandee NUMERIC(14,2) NOT NULL,
  unite VARCHAR(10) DEFAULT 'kg'
);

CREATE TABLE IF NOT EXISTS allocation_commande (
  id BIGSERIAL PRIMARY KEY,
  id_ligne BIGINT NOT NULL REFERENCES ligne_commande(id) ON DELETE CASCADE,
  id_lot BIGINT NOT NULL REFERENCES lot_semencier(id),
  quantite_allouee NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
