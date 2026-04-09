-- ============================================================
-- 02_seed_data.sql — Docker PostgreSQL init script
-- SEED Platform — ISRA / CNRA
--
-- Données de référence insérées à la création du volume Docker.
-- Toutes les insertions sont idempotentes (ON CONFLICT DO NOTHING).
--
-- ⚠️  Ces données sont également gérées par Flyway
--     (V2__donnees_initiales.sql). En cas de redémarrage
--     après suppression du volume, Flyway prend le relais.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- GÉNÉRATIONS SEMENCIÈRES
-- ────────────────────────────────────────────────────────────

INSERT INTO generation_semence (code_generation, ordre_generation) VALUES
  ('G0', 0),  -- Noyau génétique (sélectionneur)
  ('G1', 1),  -- Pré-base
  ('G2', 2),  -- Base
  ('G3', 3),  -- Certifiée C1
  ('G4', 4),  -- Certifiée C2
  ('R1', 5),  -- Commerciale R1
  ('R2', 6)   -- Commerciale R2
ON CONFLICT (code_generation) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- ESPÈCES (catalogue de référence ISRA)
-- ────────────────────────────────────────────────────────────

INSERT INTO espece (code_espece, nom_commun, nom_scientifique) VALUES
  ('ARA', 'Arachide',    'Arachis hypogaea'),
  ('MIL', 'Mil',         'Pennisetum glaucum'),
  ('SOR', 'Sorgho',      'Sorghum bicolor'),
  ('NIE', 'Niébé',       'Vigna unguiculata'),
  ('MAI', 'Maïs',        'Zea mays'),
  ('RIZ', 'Riz',         'Oryza sativa'),
  ('COT', 'Coton',       'Gossypium hirsutum'),
  ('SES', 'Sésame',      'Sesamum indicum')
ON CONFLICT (code_espece) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- ZONES AGRO-ÉCOLOGIQUES (Sénégal)
-- ────────────────────────────────────────────────────────────

INSERT INTO zone_agro (code, nom, description) VALUES
  ('SL',  'Soudano-Sahélienne',        'Zone nord — pluviométrie 200-500 mm — mil, sorgho'),
  ('SSH', 'Soudano-Sahélienne humide', 'Zone centre — pluviométrie 500-800 mm — arachide, mil'),
  ('SS',  'Soudanienne Sud',           'Zone sud — pluviométrie 800-1200 mm — maïs, riz, niébé'),
  ('VF',  'Vallée du Fleuve',          'Périmètres irrigués — riz pluvial et irrigué'),
  ('CAS', 'Casamance',                 'Zone sud — forte pluviométrie — riz, maïs, arachide')
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- CAMPAGNE EN COURS
-- ────────────────────────────────────────────────────────────

INSERT INTO campagne (code_campagne, libelle, annee, date_debut, date_fin, statut) VALUES
  ('HIV-2026', 'Hivernage 2026', 2026, '2026-06-01', '2026-11-30', 'EN_COURS')
ON CONFLICT (code_campagne) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SITES DE STOCKAGE (ISRA)
-- ────────────────────────────────────────────────────────────

INSERT INTO site (code_site, nom_site, type_site, localite, region) VALUES
  ('MAG-THIES',      'Magasin central Thiès',     'MAGASIN',           'Thiès',   'Thiès'),
  ('FERME-MULTI-01', 'Station de Bambey',          'STATION_RECHERCHE', 'Bambey',  'Diourbel'),
  ('FERME-MULTI-02', 'Station de Kaolack',         'FERME',             'Kaolack', 'Kaolack'),
  ('MAG-KAOLACK',    'Magasin Kaolack',            'MAGASIN',           'Kaolack', 'Kaolack'),
  ('LAB-THIES',      'Laboratoire analyse Thiès',  'LABORATOIRE',       'Thiès',   'Thiès')
ON CONFLICT (code_site) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- VARIÉTÉS DE RÉFÉRENCE (ISRA)
-- ────────────────────────────────────────────────────────────

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal,
                     annee_creation, cycle_jours, statut_variete)
SELECT 'ARA-12', 'Fleur 11', e.id, 'ISRA Bambey', 'Équipe Sélection ISRA', 2019, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'ARA'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal,
                     annee_creation, cycle_jours, statut_variete)
SELECT 'MIL-SN', 'Sanio Local', e.id, 'ISRA Bambey', 'Équipe Sélection ISRA', 2015, 120, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'MIL'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal,
                     annee_creation, cycle_jours, statut_variete)
SELECT 'NIE-SN', 'Mouride', e.id, 'ISRA Bambey', 'Équipe Sélection ISRA', 2018, 70, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal,
                     annee_creation, cycle_jours, statut_variete)
SELECT 'RIZ-SN', 'Sahel 108', e.id, 'ADRAO', 'Équipe Riziculture', 2010, 108, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'RIZ'
ON CONFLICT (code_variete) DO NOTHING;

-- Adaptation zones agro-écologiques
INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'
FROM variete v, zone_agro z WHERE v.code_variete = 'ARA-12' AND z.code = 'SSH'
ON CONFLICT DO NOTHING;

INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'ACCEPTABLE'
FROM variete v, zone_agro z WHERE v.code_variete = 'ARA-12' AND z.code = 'SS'
ON CONFLICT DO NOTHING;

INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'
FROM variete v, zone_agro z WHERE v.code_variete = 'MIL-SN' AND z.code = 'SL'
ON CONFLICT DO NOTHING;

INSERT INTO variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'
FROM variete v, zone_agro z WHERE v.code_variete = 'RIZ-SN' AND z.code = 'VF'
ON CONFLICT DO NOTHING;
