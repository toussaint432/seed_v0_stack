-- ============================================================
-- V18__zae_reelles_senegal.sql
-- Refonte des Zones Agro-Écologiques réelles du Sénégal
-- + Géographie administrative (régions / départements)
-- + Liaison département ↔ ZAE
-- + Extension de la table organisation (département, zone)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. MISE À JOUR DE LA NOMENCLATURE DES ZONES EXISTANTES
-- Les IDs sont préservés → toutes les FK dans variete_zone
-- restent valides sans aucune migration de données.
-- ────────────────────────────────────────────────────────────

UPDATE zone_agro
SET code = 'ZSP',
    nom  = 'Zone Sylvo-pastorale',
    description = 'Sahel sénégalais — pluviométrie 200-500 mm — mil, sorgho, élevage pastoral'
WHERE code = 'SL';

UPDATE zone_agro
SET code = 'BA',
    nom  = 'Bassin Arachidier',
    description = 'Centre agricole — pluviométrie 400-800 mm — arachide, mil, niébé, sorgho'
WHERE code = 'SSH';

UPDATE zone_agro
SET code = 'SO',
    nom  = 'Sénégal Oriental',
    description = 'Est du Sénégal — pluviométrie 800-1200 mm — maïs, sorgho, coton, riz'
WHERE code = 'SS';

UPDATE zone_agro
SET nom  = 'Vallée du Fleuve Sénégal',
    description = 'Delta et vallée du fleuve — périmètres irrigués — riz irrigué, oignon, tomate'
WHERE code = 'VF';

UPDATE zone_agro
SET code = 'HC',
    nom  = 'Haute Casamance',
    description = 'Kolda — pluviométrie 800-1000 mm — maïs, arachide, niébé, coton'
WHERE code = 'CAS';

-- ────────────────────────────────────────────────────────────
-- 2. AJOUT DES 3 NOUVELLES ZONES AGRO-ÉCOLOGIQUES
-- ────────────────────────────────────────────────────────────

INSERT INTO zone_agro (code, nom, description) VALUES
  ('NAY', 'Niayes',
   'Frange littorale nord — microclimats frais et humides — maraîchage, arachide de bouche, mil hâtif'),
  ('MC',  'Moyenne Casamance',
   'Sédhiou — pluviométrie 1000-1300 mm — riz pluvial, maïs, palmier à huile, manioc'),
  ('BC',  'Basse Casamance',
   'Ziguinchor — pluviométrie > 1300 mm — riz de plateau, coton, arachide, arboriculture fruitière')
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. ASSOCIATIONS VARIÉTÉ-ZONE POUR LES NOUVELLES ZONES
-- ────────────────────────────────────────────────────────────

-- Niayes : mil, arachide adaptés au littoral (cycle court, tolérance embruns)
INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'ACCEPTABLE'
FROM variete v
CROSS JOIN zone_agro z
WHERE v.code_variete IN (
    'ARA-12', 'ARA-FLEUR11', 'ARA-73-30', 'ARA-55-437',
    'MIL-SN', 'MIL-SOUNA3', 'MIL-IBV8004', 'MIL-THIALACK'
  )
  AND z.code = 'NAY'
ON CONFLICT DO NOTHING;

-- Riz irrigable également dans les Niayes (poches maraîchères)
INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'ACCEPTABLE'
FROM variete v
CROSS JOIN zone_agro z
WHERE v.code_variete IN ('RIZ-SN', 'RIZ-SAHEL108', 'RIZ-SAHEL201', 'RIZ-WASSA')
  AND z.code = 'NAY'
ON CONFLICT DO NOTHING;

-- Moyenne Casamance hérite des adaptations Haute Casamance (niveau baissé d'un cran)
INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT vz.id_variete, z_mc.id,
       CASE vz.niveau_adaptation
           WHEN 'OPTIMAL'    THEN 'ACCEPTABLE'
           WHEN 'ACCEPTABLE' THEN 'ACCEPTABLE'
           ELSE 'MARGINALE'
       END
FROM variete_zone vz
JOIN zone_agro z_hc ON vz.id_zone = z_hc.id AND z_hc.code = 'HC'
CROSS JOIN zone_agro z_mc WHERE z_mc.code = 'MC'
ON CONFLICT DO NOTHING;

-- Basse Casamance hérite également (zone humide, cultures rizicoles prioritaires)
INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT vz.id_variete, z_bc.id,
       CASE vz.niveau_adaptation
           WHEN 'OPTIMAL'    THEN 'ACCEPTABLE'
           WHEN 'ACCEPTABLE' THEN 'ACCEPTABLE'
           ELSE 'MARGINALE'
       END
FROM variete_zone vz
JOIN zone_agro z_hc ON vz.id_zone = z_hc.id AND z_hc.code = 'HC'
CROSS JOIN zone_agro z_bc WHERE z_bc.code = 'BC'
ON CONFLICT DO NOTHING;

-- Riz OPTIMAL en BC (forte pluviométrie idéale pour riz pluvial)
INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'
FROM variete v
CROSS JOIN zone_agro z
WHERE v.code_variete IN ('RIZ-SN', 'RIZ-SAHEL108', 'RIZ-SAHEL201', 'RIZ-WASSA', 'RIZ-WAB56104')
  AND z.code = 'BC'
ON CONFLICT (id_variete, id_zone) DO UPDATE SET niveau_adaptation = 'OPTIMAL';

-- Riz OPTIMAL en MC
INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'
FROM variete v
CROSS JOIN zone_agro z
WHERE v.code_variete IN ('RIZ-SN', 'RIZ-SAHEL108', 'RIZ-SAHEL201', 'RIZ-WASSA')
  AND z.code = 'MC'
ON CONFLICT (id_variete, id_zone) DO UPDATE SET niveau_adaptation = 'OPTIMAL';

-- ────────────────────────────────────────────────────────────
-- 4. RÉGIONS ADMINISTRATIVES DU SÉNÉGAL (14 régions officielles)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regions (
    id  SERIAL PRIMARY KEY,
    nom VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO regions (nom) VALUES
  ('Dakar'), ('Thiès'), ('Diourbel'), ('Fatick'),
  ('Kaolack'), ('Kaffrine'), ('Louga'), ('Saint-Louis'),
  ('Matam'), ('Tambacounda'), ('Kédougou'),
  ('Kolda'), ('Sédhiou'), ('Ziguinchor')
ON CONFLICT (nom) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. DÉPARTEMENTS ADMINISTRATIFS (~45 départements officiels)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departements (
    id        SERIAL PRIMARY KEY,
    nom       VARCHAR(60) NOT NULL UNIQUE,
    id_region INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dept_region ON departements(id_region);

INSERT INTO departements (nom, id_region) VALUES
  -- Dakar (5 départements)
  ('Dakar',             (SELECT id FROM regions WHERE nom = 'Dakar')),
  ('Pikine',            (SELECT id FROM regions WHERE nom = 'Dakar')),
  ('Guédiawaye',        (SELECT id FROM regions WHERE nom = 'Dakar')),
  ('Rufisque',          (SELECT id FROM regions WHERE nom = 'Dakar')),
  ('Keur Massar',       (SELECT id FROM regions WHERE nom = 'Dakar')),
  -- Thiès (3 départements)
  ('Thiès',             (SELECT id FROM regions WHERE nom = 'Thiès')),
  ('Mbour',             (SELECT id FROM regions WHERE nom = 'Thiès')),
  ('Tivaouane',         (SELECT id FROM regions WHERE nom = 'Thiès')),
  -- Diourbel (3 départements)
  ('Bambey',            (SELECT id FROM regions WHERE nom = 'Diourbel')),
  ('Diourbel',          (SELECT id FROM regions WHERE nom = 'Diourbel')),
  ('Mbacké',            (SELECT id FROM regions WHERE nom = 'Diourbel')),
  -- Fatick (3 départements)
  ('Fatick',            (SELECT id FROM regions WHERE nom = 'Fatick')),
  ('Foundiougne',       (SELECT id FROM regions WHERE nom = 'Fatick')),
  ('Gossas',            (SELECT id FROM regions WHERE nom = 'Fatick')),
  -- Kaolack (3 départements)
  ('Kaolack',           (SELECT id FROM regions WHERE nom = 'Kaolack')),
  ('Guinguinéo',        (SELECT id FROM regions WHERE nom = 'Kaolack')),
  ('Nioro du Rip',      (SELECT id FROM regions WHERE nom = 'Kaolack')),
  -- Kaffrine (4 départements)
  ('Kaffrine',          (SELECT id FROM regions WHERE nom = 'Kaffrine')),
  ('Birkelane',         (SELECT id FROM regions WHERE nom = 'Kaffrine')),
  ('Koungheul',         (SELECT id FROM regions WHERE nom = 'Kaffrine')),
  ('Malem Hodar',       (SELECT id FROM regions WHERE nom = 'Kaffrine')),
  -- Louga (3 départements)
  ('Louga',             (SELECT id FROM regions WHERE nom = 'Louga')),
  ('Kébémer',           (SELECT id FROM regions WHERE nom = 'Louga')),
  ('Linguère',          (SELECT id FROM regions WHERE nom = 'Louga')),
  -- Saint-Louis (3 départements)
  ('Saint-Louis',       (SELECT id FROM regions WHERE nom = 'Saint-Louis')),
  ('Dagana',            (SELECT id FROM regions WHERE nom = 'Saint-Louis')),
  ('Podor',             (SELECT id FROM regions WHERE nom = 'Saint-Louis')),
  -- Matam (3 départements)
  ('Matam',             (SELECT id FROM regions WHERE nom = 'Matam')),
  ('Kanel',             (SELECT id FROM regions WHERE nom = 'Matam')),
  ('Ranérou Ferlo',     (SELECT id FROM regions WHERE nom = 'Matam')),
  -- Tambacounda (4 départements)
  ('Tambacounda',       (SELECT id FROM regions WHERE nom = 'Tambacounda')),
  ('Bakel',             (SELECT id FROM regions WHERE nom = 'Tambacounda')),
  ('Goudiry',           (SELECT id FROM regions WHERE nom = 'Tambacounda')),
  ('Koumpentoum',       (SELECT id FROM regions WHERE nom = 'Tambacounda')),
  -- Kédougou (3 départements)
  ('Kédougou',          (SELECT id FROM regions WHERE nom = 'Kédougou')),
  ('Salémata',          (SELECT id FROM regions WHERE nom = 'Kédougou')),
  ('Saraya',            (SELECT id FROM regions WHERE nom = 'Kédougou')),
  -- Kolda (3 départements)
  ('Kolda',             (SELECT id FROM regions WHERE nom = 'Kolda')),
  ('Vélingara',         (SELECT id FROM regions WHERE nom = 'Kolda')),
  ('Médina Yoro Foula', (SELECT id FROM regions WHERE nom = 'Kolda')),
  -- Sédhiou (3 départements)
  ('Sédhiou',           (SELECT id FROM regions WHERE nom = 'Sédhiou')),
  ('Bounkiling',        (SELECT id FROM regions WHERE nom = 'Sédhiou')),
  ('Goudomp',           (SELECT id FROM regions WHERE nom = 'Sédhiou')),
  -- Ziguinchor (3 départements)
  ('Ziguinchor',        (SELECT id FROM regions WHERE nom = 'Ziguinchor')),
  ('Bignona',           (SELECT id FROM regions WHERE nom = 'Ziguinchor')),
  ('Oussouye',          (SELECT id FROM regions WHERE nom = 'Ziguinchor'))
ON CONFLICT (nom) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. LIAISON DÉPARTEMENT ↔ ZONE AGRO-ÉCOLOGIQUE
-- est_principale=TRUE : zone de référence pour l'auto-sélection
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departement_zone (
    id_departement INT     NOT NULL REFERENCES departements(id) ON DELETE CASCADE,
    id_zone        INT     NOT NULL REFERENCES zone_agro(id)    ON DELETE CASCADE,
    est_principale BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_departement, id_zone)
);

CREATE INDEX IF NOT EXISTS idx_dz_zone ON departement_zone(id_zone);

-- NAY — Niayes :
-- Dakar (5 depts) + Tivaouane (Thiès littoral) + Saint-Louis ville
INSERT INTO departement_zone (id_departement, id_zone, est_principale)
SELECT d.id, z.id, TRUE
FROM departements d
CROSS JOIN zone_agro z
WHERE d.nom IN ('Dakar', 'Pikine', 'Guédiawaye', 'Rufisque', 'Keur Massar', 'Tivaouane', 'Saint-Louis')
  AND z.code = 'NAY'
ON CONFLICT DO NOTHING;

-- BA — Bassin Arachidier :
-- Diourbel complet + Fatick complet + Kaolack complet + Kaffrine complet
-- + Louga (Louga, Kébémer) + Thiès (Thiès, Mbour)
INSERT INTO departement_zone (id_departement, id_zone, est_principale)
SELECT d.id, z.id, TRUE
FROM departements d
CROSS JOIN zone_agro z
WHERE d.nom IN (
    'Bambey', 'Diourbel', 'Mbacké',
    'Fatick', 'Foundiougne', 'Gossas',
    'Kaolack', 'Guinguinéo', 'Nioro du Rip',
    'Kaffrine', 'Birkelane', 'Koungheul', 'Malem Hodar',
    'Louga', 'Kébémer',
    'Thiès', 'Mbour'
  )
  AND z.code = 'BA'
ON CONFLICT DO NOTHING;

-- ZSP — Zone Sylvo-pastorale :
-- Linguère (Louga) + Ranérou Ferlo (Matam)
INSERT INTO departement_zone (id_departement, id_zone, est_principale)
SELECT d.id, z.id, TRUE
FROM departements d
CROSS JOIN zone_agro z
WHERE d.nom IN ('Linguère', 'Ranérou Ferlo')
  AND z.code = 'ZSP'
ON CONFLICT DO NOTHING;

-- VF — Vallée du Fleuve :
-- Dagana + Podor (Saint-Louis) + Matam + Kanel (Matam)
INSERT INTO departement_zone (id_departement, id_zone, est_principale)
SELECT d.id, z.id, TRUE
FROM departements d
CROSS JOIN zone_agro z
WHERE d.nom IN ('Dagana', 'Podor', 'Matam', 'Kanel')
  AND z.code = 'VF'
ON CONFLICT DO NOTHING;

-- SO — Sénégal Oriental :
-- Tambacounda complet + Kédougou complet
INSERT INTO departement_zone (id_departement, id_zone, est_principale)
SELECT d.id, z.id, TRUE
FROM departements d
CROSS JOIN zone_agro z
WHERE d.nom IN (
    'Tambacounda', 'Bakel', 'Goudiry', 'Koumpentoum',
    'Kédougou', 'Salémata', 'Saraya'
  )
  AND z.code = 'SO'
ON CONFLICT DO NOTHING;

-- HC — Haute Casamance :
-- Kolda complet
INSERT INTO departement_zone (id_departement, id_zone, est_principale)
SELECT d.id, z.id, TRUE
FROM departements d
CROSS JOIN zone_agro z
WHERE d.nom IN ('Kolda', 'Vélingara', 'Médina Yoro Foula')
  AND z.code = 'HC'
ON CONFLICT DO NOTHING;

-- MC — Moyenne Casamance :
-- Sédhiou complet
INSERT INTO departement_zone (id_departement, id_zone, est_principale)
SELECT d.id, z.id, TRUE
FROM departements d
CROSS JOIN zone_agro z
WHERE d.nom IN ('Sédhiou', 'Bounkiling', 'Goudomp')
  AND z.code = 'MC'
ON CONFLICT DO NOTHING;

-- BC — Basse Casamance :
-- Ziguinchor complet
INSERT INTO departement_zone (id_departement, id_zone, est_principale)
SELECT d.id, z.id, TRUE
FROM departements d
CROSS JOIN zone_agro z
WHERE d.nom IN ('Ziguinchor', 'Bignona', 'Oussouye')
  AND z.code = 'BC'
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. EXTENSION DE LA TABLE ORGANISATION
-- departement : localisation administrative précise
-- id_zone_agro : FK vers la ZAE résolue (dénormalisée pour perf)
-- ────────────────────────────────────────────────────────────

ALTER TABLE organisation
    ADD COLUMN IF NOT EXISTS departement  VARCHAR(60),
    ADD COLUMN IF NOT EXISTS id_zone_agro BIGINT REFERENCES zone_agro(id);

CREATE INDEX IF NOT EXISTS idx_org_zone ON organisation(id_zone_agro);

-- ────────────────────────────────────────────────────────────
-- 8. MISE À JOUR DES ORGANISATIONS DE TEST AVEC LEURS ZONES
-- On résout département → zone via la table departement_zone
-- ────────────────────────────────────────────────────────────

-- OP-NORD (Saint-Louis ville) → dept Saint-Louis → NAY (Niayes)
UPDATE organisation
SET departement  = 'Saint-Louis',
    id_zone_agro = (SELECT z.id FROM zone_agro z WHERE z.code = 'NAY')
WHERE code_organisation = 'OP-NORD';

-- OP-CENTRE (Kaolack) → dept Kaolack → BA (Bassin Arachidier)
UPDATE organisation
SET departement  = 'Kaolack',
    id_zone_agro = (SELECT z.id FROM zone_agro z WHERE z.code = 'BA')
WHERE code_organisation = 'OP-CENTRE';

-- OP-CASAMANCE (Ziguinchor) → dept Ziguinchor → BC (Basse Casamance)
UPDATE organisation
SET departement  = 'Ziguinchor',
    id_zone_agro = (SELECT z.id FROM zone_agro z WHERE z.code = 'BC')
WHERE code_organisation = 'OP-CASAMANCE';

-- Multiplicateurs : alignement zones par région connue
UPDATE organisation
SET departement  = 'Diourbel',
    id_zone_agro = (SELECT z.id FROM zone_agro z WHERE z.code = 'BA')
WHERE code_organisation = 'MULTI-DIOURBEL';

-- Fallback : organisations sans zone mais avec région connue
-- → résolution par la correspondance région/zone la plus fréquente
UPDATE organisation o
SET id_zone_agro = sub.zone_id
FROM (
    SELECT d.nom AS dept_nom, dz.id_zone AS zone_id
    FROM departements d
    JOIN departement_zone dz ON dz.id_departement = d.id AND dz.est_principale = TRUE
) sub
WHERE o.departement = sub.dept_nom
  AND o.id_zone_agro IS NULL;
