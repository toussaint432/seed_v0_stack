-- ============================================================
-- V6__referentiel_cnra_complet.sql
-- Référentiel agronomique officiel ISRA/CNRA Sénégal
-- Source : Guide variétal CNRA + fichiers ISRA agronomiques
-- Règles :
--   • ON CONFLICT (code_variete) DO NOTHING  → idempotent sur code
--   • NOT EXISTS sur nom_variete             → pas de doublon nom
--   • Zone associations pour chaque variété
--   • Nettoyage des doublons issus de V2 / seed init
-- ============================================================

-- BEGIN/COMMIT supprimés : Flyway gère sa propre transaction.
-- Un COMMIT explicite provoque un commit prématuré avant
-- que Flyway enregistre l'entrée dans flyway_schema_history.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ────────────────────────────────────────────────────────────
-- 0. NETTOYAGE DES DOUBLONS (V2 vs seed_data.sql)
-- ────────────────────────────────────────────────────────────

-- ARA-12 = double de ARA-FLEUR11 (Fleur 11)
-- 2 lots référencent ARA-12 → on les migre vers ARA-FLEUR11
UPDATE lot_semencier l
SET id_variete = (SELECT id FROM variete WHERE code_variete = 'ARA-FLEUR11')
WHERE l.id_variete = (SELECT id FROM variete WHERE code_variete = 'ARA-12')
  AND EXISTS (SELECT 1 FROM variete WHERE code_variete = 'ARA-FLEUR11');

DELETE FROM variete WHERE code_variete = 'ARA-12'
  AND EXISTS (SELECT 1 FROM variete WHERE code_variete = 'ARA-FLEUR11');

-- NIE-SN = double de NIE-MOURIDE (Mouride) — aucun lot lié
DELETE FROM variete WHERE code_variete = 'NIE-SN'
  AND EXISTS (SELECT 1 FROM variete WHERE code_variete = 'NIE-MOURIDE');

-- RIZ-SN = double de RIZ-SAHEL108 (Sahel 108) — aucun lot lié
DELETE FROM variete WHERE code_variete = 'RIZ-SN'
  AND EXISTS (SELECT 1 FROM variete WHERE code_variete = 'RIZ-SAHEL108');

-- ────────────────────────────────────────────────────────────
-- 1. ESPÈCES — référentiel complet ISRA/CNRA
-- ────────────────────────────────────────────────────────────

INSERT INTO espece (code_espece, nom_commun, nom_scientifique) VALUES
  ('ARA', 'Arachide',  'Arachis hypogaea'),
  ('MIL', 'Mil',       'Pennisetum glaucum'),
  ('SOR', 'Sorgho',    'Sorghum bicolor'),
  ('NIE', 'Niébé',     'Vigna unguiculata'),
  ('MAI', 'Maïs',      'Zea mays'),
  ('RIZ', 'Riz',       'Oryza sativa'),
  ('COT', 'Coton',     'Gossypium hirsutum'),
  ('SES', 'Sésame',    'Sesamum indicum'),
  ('BLE', 'Blé',       'Triticum aestivum'),
  ('FON', 'Fonio',     'Digitaria exilis'),
  ('SOJ', 'Soja',      'Glycine max')
ON CONFLICT (code_espece) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. SORGHO — variétés CNRA homologuées
--    Source : Guide variétal CNRA + tableau image
-- ────────────────────────────────────────────────────────────

-- Pétanke : ancienne variété locale améliorée, cycle court
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-PETANKE', 'Pétanke', e.id, 'ISRA/CNRA Bambey', 'Amélioration variétés locales', 1970, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Pétanke')))
ON CONFLICT (code_variete) DO NOTHING;

-- CE 151-262 : lignée ISRA, grain blanc lissé
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-CE151', 'CE 151-262', e.id, 'ISRA/CNRA Bambey', 'Programme sorgho ISRA', 1985, 95, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('CE 151-262')))
ON CONFLICT (code_variete) DO NOTHING;

-- CE 180-33 : lignée ISRA, grain blanc lissé, bassin arachidier
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-CE180', 'CE 180-33', e.id, 'ISRA/CNRA Bambey', 'Programme sorgho ISRA', 1988, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('CE 180-33')))
ON CONFLICT (code_variete) DO NOTHING;

-- CE 196-7-2-1 : lignée intermédiaire ISRA
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-CE196', 'CE 196-7-2-1', e.id, 'ISRA/CNRA Bambey', 'Programme sorgho ISRA', 1990, 100, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('CE 196-7-2-1')))
ON CONFLICT (code_variete) DO NOTHING;

-- Nganda : variété locale traditionnelle, grain rouge, cycle long
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-NGANDA', 'Nganda', e.id, 'Local Sénégal', 'Sélection participative ISRA', NULL, 110, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Nganda')))
ON CONFLICT (code_variete) DO NOTHING;

-- Faourou : variété locale
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-FAOUROU', 'Faourou', e.id, 'Local Sénégal', 'Sélection participative ISRA', NULL, 100, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Faourou')))
ON CONFLICT (code_variete) DO NOTHING;

-- Galobé : variété locale
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-GALOBE', 'Galobé', e.id, 'Local Sénégal', 'Sélection participative ISRA', NULL, 105, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Galobé')))
ON CONFLICT (code_variete) DO NOTHING;

-- Payenne : variété locale nord Sénégal
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-PAYENNE', 'Payenne', e.id, 'Local Sénégal', 'Sélection participative ISRA', NULL, 95, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Payenne')))
ON CONFLICT (code_variete) DO NOTHING;

-- Darou : variété locale
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-DAROU', 'Darou', e.id, 'Local Sénégal', 'Sélection participative ISRA', NULL, 100, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Darou')))
ON CONFLICT (code_variete) DO NOTHING;

-- Nguinthe : variété locale
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-NGUINTHE', 'Nguinthe', e.id, 'Local Sénégal', 'Sélection participative ISRA', NULL, 100, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Nguinthe')))
ON CONFLICT (code_variete) DO NOTHING;

-- F2-20 : hybride ISRA récent
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOR-F2-20', 'F2-20', e.id, 'ISRA/CNRA Bambey', 'Programme sorgho ISRA', 2015, 100, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOR'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('F2-20')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. MIL — variétés CNRA homologuées
-- ────────────────────────────────────────────────────────────

-- Taaw : variété ISRA 2021, cycle adapté
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'MIL-TAAW', 'Taaw', e.id, 'ISRA/CNRA Bambey', 'Programme amélioration du mil', 2021, 80, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'MIL'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Taaw')))
ON CONFLICT (code_variete) DO NOTHING;

-- Thialack 2 : lignée en cours d'homologation
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'MIL-THIALACK2', 'Thialack 2', e.id, 'ISRA/CNRA Bambey', 'Programme mil ISRA', 2018, 85, 'EN_TEST'
FROM espece e WHERE e.code_espece = 'MIL'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Thialack 2')))
ON CONFLICT (code_variete) DO NOTHING;

-- Souna 3 (correction du nom_variete existant)
UPDATE variete SET nom_variete = 'Souna III'
WHERE code_variete = 'MIL-SOUNA3' AND nom_variete = 'Souna III';

-- ────────────────────────────────────────────────────────────
-- 4. ARACHIDE — variétés CNRA homologuées
-- ────────────────────────────────────────────────────────────

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'ARA-TAARU', 'Taaru', e.id, 'ISRA/CNRA Bambey', 'Programme arachide ISRA', 2010, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'ARA'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Taaru')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'ARA-YAAKAR', 'Yaakar', e.id, 'ISRA/CNRA Bambey', 'Programme arachide ISRA', 2005, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'ARA'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Yaakar')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'ARA-JAAMBAR', 'Jaambar', e.id, 'ISRA/CNRA Bambey', 'Programme arachide ISRA', 2015, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'ARA'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Jaambar')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'ARA-ESSAMAAY', 'Essamaay', e.id, 'ISRA/CNRA Bambey', 'Programme arachide ISRA', 2012, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'ARA'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Essamaay')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'ARA-SUNU-GAAL', 'Sunu Gaal', e.id, 'ISRA/CNRA Bambey', 'Programme arachide ISRA', 2018, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'ARA'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Sunu Gaal')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. NIÉBÉ — variétés CNRA homologuées
-- ────────────────────────────────────────────────────────────

-- Correction cycle pour les variétés existantes
UPDATE variete SET cycle_jours = 67
WHERE code_variete = 'NIE-MELAKH' AND (cycle_jours IS NULL OR cycle_jours != 67);

UPDATE variete SET cycle_jours = 68
WHERE code_variete = 'NIE-MOURIDE' AND (cycle_jours IS NULL OR cycle_jours != 68);

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'NIE-58-74', '58-74', e.id, 'ISRA/CNRA Bambey', 'Programme légumineuses ISRA', 1980, 70, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'NIE'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('58-74')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'NIE-66-35', '66-35', e.id, 'ISRA/CNRA Bambey', 'Programme légumineuses ISRA', 1982, 72, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'NIE'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('66-35')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. MAÏS — variétés CNRA homologuées
-- ────────────────────────────────────────────────────────────

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'MAI-OBATAMPA', 'Obatampa', e.id, 'ISRA/CIMMYT', 'Programme maïs ISRA', 2003, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'MAI'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Obatampa')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'MAI-JABOOT', 'Jaboot', e.id, 'ISRA/CNRA Bambey', 'Programme maïs ISRA', 2018, 95, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'MAI'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Jaboot')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'MAI-YAAYI-SEEX', 'Yaayi Séex', e.id, 'ISRA/CNRA Bambey', 'Programme maïs ISRA', 2015, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'MAI'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Yaayi Séex')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'MAI-GOOR-YOMBOUL', 'Goor Yomboul', e.id, 'ISRA/CNRA Bambey', 'Programme maïs ISRA', 2019, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'MAI'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Goor Yomboul')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'MAI-GAAW-NA', 'Gaaw Na', e.id, 'ISRA/CNRA Bambey', 'Programme maïs ISRA', 2020, 85, 'EN_TEST'
FROM espece e WHERE e.code_espece = 'MAI'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Gaaw Na')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. RIZ — variétés CNRA homologuées (irrigué + pluvial)
-- ────────────────────────────────────────────────────────────

-- Sahel 200 : variété récente zone fleuve
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'RIZ-SAHEL200', 'Sahel 200', e.id, 'AfricaRice / ISRA / SAED', 'Programme riz irrigué', 2010, 115, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'RIZ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Sahel 200')))
ON CONFLICT (code_variete) DO NOTHING;

-- Nerica 1-8 : séries NERICA riz pluvial (AfricaRice)
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'RIZ-NERICA1', 'Nerica 1', e.id, 'AfricaRice', 'Programme riz pluvial ISRA', 2000, 100, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'RIZ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Nerica 1')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'RIZ-NERICA4', 'Nerica 4', e.id, 'AfricaRice', 'Programme riz pluvial ISRA', 2000, 100, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'RIZ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Nerica 4')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'RIZ-NERICA8', 'Nerica 8', e.id, 'AfricaRice', 'Programme riz pluvial ISRA', 2003, 103, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'RIZ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Nerica 8')))
ON CONFLICT (code_variete) DO NOTHING;

-- ISRIZ 1-10 : lignées ISRA en évaluation
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'RIZ-ISRIZ1', 'ISRIZ 1', e.id, 'ISRA/CNRA Bambey', 'Programme riz irrigué ISRA', 2015, 110, 'EN_TEST'
FROM espece e WHERE e.code_espece = 'RIZ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('ISRIZ 1')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'RIZ-ISRIZ5', 'ISRIZ 5', e.id, 'ISRA/CNRA Bambey', 'Programme riz irrigué ISRA', 2016, 112, 'EN_TEST'
FROM espece e WHERE e.code_espece = 'RIZ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('ISRIZ 5')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'RIZ-ISRIZ10', 'ISRIZ 10', e.id, 'ISRA/CNRA Bambey', 'Programme riz irrigué ISRA', 2018, 108, 'EN_TEST'
FROM espece e WHERE e.code_espece = 'RIZ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('ISRIZ 10')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 8. BLÉ — variétés CNRA homologuées (vallée du fleuve)
-- ────────────────────────────────────────────────────────────

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'BLE-PENDAO', 'Pendao', e.id, 'ISRA / SAED Saint-Louis', 'Programme blé irrigué ISRA', 1994, 120, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'BLE'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Pendao')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'BLE-HAMAT', 'Hamat', e.id, 'ISRA / SAED Saint-Louis', 'Programme blé irrigué ISRA', 1996, 115, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'BLE'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Hamat')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'BLE-ALIOUNE', 'Alioune', e.id, 'ISRA / SAED Saint-Louis', 'Programme blé irrigué ISRA', 2000, 118, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'BLE'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Alioune')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'BLE-FANAYE', 'Fanaye', e.id, 'ISRA / SAED Saint-Louis', 'Programme blé irrigué ISRA', 2005, 120, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'BLE'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Fanaye')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'BLE-DIOUFISSA', 'Dioufissa', e.id, 'ISRA / SAED Saint-Louis', 'Programme blé irrigué ISRA', 2010, 115, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'BLE'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Dioufissa')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 9. SÉSAME — variétés CNRA homologuées
-- ────────────────────────────────────────────────────────────

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SES-NIANGBALLO', 'Niangballo', e.id, 'ISRA/CERAAS', 'Programme sésame ISRA', 1990, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SES'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Niangballo')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SES-BOUREIMA', 'Boureima', e.id, 'ISRA/CERAAS', 'Programme sésame ISRA', 1995, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SES'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Boureima')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 10. FONIO — variétés CNRA
-- ────────────────────────────────────────────────────────────

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'FON-FOFANA', 'Fofana', e.id, 'ISRA/DRDR Ziguinchor', 'Programme cultures locales', 2020, 75, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'FON'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Fofana')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'FON-NIATA', 'Niata', e.id, 'ISRA/DRDR Ziguinchor', 'Programme cultures locales', 2022, 80, 'EN_TEST'
FROM espece e WHERE e.code_espece = 'FON'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Niata')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 11. SOJA — variétés CNRA
-- ────────────────────────────────────────────────────────────

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOJ-DOUE', 'Doué', e.id, 'ISRA/CNRA Bambey', 'Programme légumineuses ISRA', 2005, 90, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOJ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('Doué')))
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete)
SELECT 'SOJ-TGM', 'TGM', e.id, 'ISRA/CNRA Bambey', 'Programme légumineuses ISRA', 2010, 95, 'DIFFUSEE'
FROM espece e WHERE e.code_espece = 'SOJ'
  AND NOT EXISTS (SELECT 1 FROM variete v WHERE v.id_espece = e.id AND lower(unaccent(v.nom_variete)) = lower(unaccent('TGM')))
ON CONFLICT (code_variete) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 12. ZONES AGRO-ÉCOLOGIQUES — associations variétés/zones
--     Basées sur les données CNRA et le guide variétal
-- ────────────────────────────────────────────────────────────

-- ── SORGHO ─────────────────────────────────────────────────

-- SOR-PETANKE : SL (optimal), SSH (optimal)
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-PETANKE'  AND z.code='SL'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-PETANKE'  AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-CE145 (CE 145-66) : SL, SSH, SS
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE145'    AND z.code='SL'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE145'    AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE145'   AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-CE151 (CE 151-262) : SL, SSH
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE151'    AND z.code='SL'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE151'    AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE151'   AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-CE180 (CE 180-33) : SSH, SS
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE180'    AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE180'    AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE180'   AND z.code='SL'  ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-CE196 : SL, SSH
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE196'    AND z.code='SL'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-CE196'    AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-NGANDA : toutes zones (locale adaptée)
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='SOR-NGANDA'  AND z.code='SL'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-NGANDA'   AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-NGANDA'   AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='SOR-NGANDA'  AND z.code='CAS' ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-FAOUROU, GALOBE, PAYENNE, DAROU, NGUINTHE : SL, SSH
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL' FROM variete v, zone_agro z WHERE v.code_variete='SOR-FAOUROU'  AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL' FROM variete v, zone_agro z WHERE v.code_variete='SOR-GALOBE'   AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL' FROM variete v, zone_agro z WHERE v.code_variete='SOR-PAYENNE'  AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL' FROM variete v, zone_agro z WHERE v.code_variete='SOR-DAROU'    AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL' FROM variete v, zone_agro z WHERE v.code_variete='SOR-NGUINTHE' AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-SARIASO : SSH, SS
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-SARIASO' AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-SARIASO' AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-FARAFARA : SS, CAS
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-FARAFARA' AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-FARAFARA' AND z.code='CAS' ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-FRAMIDA : SL, SSH
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-FRAMIDA'  AND z.code='SL'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-FRAMIDA'  AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- SOR-F2-20 : SSH, SS
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-F2-20'    AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'   FROM variete v, zone_agro z WHERE v.code_variete='SOR-F2-20'    AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── MIL ────────────────────────────────────────────────────

INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MIL-SOUNA3'   AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MIL-SOUNA11'  AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MIL-THIOU'    AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='MIL-THIOU'    AND z.code='SS' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MIL-IBV8004'  AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MIL-BASSI'    AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MIL-SN'       AND z.code IN ('SL','SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MIL-TAAW'     AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='MIL-THIALACK2' AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── ARACHIDE ───────────────────────────────────────────────

INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-FLEUR11'   AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-55437'     AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='ARA-55437'     AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-GH119'     AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-CHICO'     AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-TAARU'     AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-YAAKAR'    AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-JAAMBAR'   AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-ESSAMAAY'  AND z.code IN ('SSH','SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='ARA-SUNU-GAAL' AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── NIÉBÉ ──────────────────────────────────────────────────

INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='NIE-MELAKH'    AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='NIE-MOURIDE'   AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='NIE-YACINE'    AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='NIE-YACINE'    AND z.code='CAS' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='NIE-BAMBEY21'  AND z.code IN ('SL','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='NIE-58-74'     AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='NIE-66-35'     AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── MAÏS ───────────────────────────────────────────────────

INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MAI-DK8031'       AND z.code IN ('SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='MAI-DK8031'       AND z.code='SSH' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MAI-ESPOIR'       AND z.code IN ('SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MAI-INITIAL'      AND z.code IN ('SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MAI-MAMBA'        AND z.code IN ('SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MAI-OBATAMPA'     AND z.code IN ('SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MAI-JABOOT'       AND z.code IN ('SS','CAS','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MAI-YAAYI-SEEX'   AND z.code IN ('SS','SSH') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='MAI-GOOR-YOMBOUL' AND z.code IN ('SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='MAI-GAAW-NA'      AND z.code IN ('SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── RIZ ────────────────────────────────────────────────────

-- Riz irrigué : Vallée du Fleuve optimal
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='RIZ-SAHEL108'  AND z.code='VF'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='RIZ-SAHEL177'  AND z.code='VF'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='RIZ-SAHEL200'  AND z.code='VF'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='RIZ-TOX728'    AND z.code='VF'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='RIZ-TOX728'    AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
-- Riz pluvial : zones humides
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='RIZ-WASSA'     AND z.code='SS'  ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete='RIZ-WASSA'     AND z.code='CAS' ON CONFLICT (id_variete,id_zone) DO NOTHING;
-- Nerica : riz pluvial
INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete IN ('RIZ-NERICA1','RIZ-NERICA4','RIZ-NERICA8') AND z.code IN ('SS','CAS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
-- ISRIZ : zones irrigables
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete IN ('RIZ-ISRIZ1','RIZ-ISRIZ5','RIZ-ISRIZ10') AND z.code='VF' ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── BLÉ ────────────────────────────────────────────────────

INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete IN ('BLE-PENDAO','BLE-HAMAT','BLE-ALIOUNE','BLE-FANAYE','BLE-DIOUFISSA') AND z.code='VF' ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── SÉSAME ─────────────────────────────────────────────────

INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete IN ('SES-ISRA1','SES-NIANGBALLO','SES-BOUREIMA') AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete='SES-GOUDAS' AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── FONIO ──────────────────────────────────────────────────

INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete IN ('FON-LOCAL1','FON-FOFANA','FON-NIATA') AND z.code='CAS' ON CONFLICT (id_variete,id_zone) DO NOTHING;
INSERT INTO variete_zone SELECT v.id, z.id, 'ACCEPTABLE' FROM variete v, zone_agro z WHERE v.code_variete IN ('FON-LOCAL1','FON-FOFANA') AND z.code='SS' ON CONFLICT (id_variete,id_zone) DO NOTHING;

-- ── SOJA ───────────────────────────────────────────────────

INSERT INTO variete_zone SELECT v.id, z.id, 'OPTIMAL'    FROM variete v, zone_agro z WHERE v.code_variete IN ('SOJ-DOUE','SOJ-TGM') AND z.code IN ('SSH','SS') ON CONFLICT (id_variete,id_zone) DO NOTHING;
