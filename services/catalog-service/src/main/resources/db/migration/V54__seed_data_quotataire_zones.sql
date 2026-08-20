-- ─────────────────────────────────────────────────────────────────────────────
-- V54 : Données de test pour les quotataires — couverture des 8 zones agro-écologiques
--
-- 1. Assigner id_zone_agro aux organisations multiplicateurs existantes (BA)
-- 2. Ajouter GPS + zone_code aux sites existants
-- 3. Créer des lots R2 pour multiplicateur_kaolack (0 lots actuellement)
-- 4. Créer un multiplicateur virtuel par zone restante (ZSP, SO, VF, HC, NAY, MC, BC)
--    avec des lots R2 adaptés aux cultures de la zone
--    Note : ces utilisateurs n'ont pas de compte Keycloak — catalogue seulement.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════
-- PARTIE 1 : Zones agro-écologiques pour les orgs existantes (BA)
-- ═══════════════════════════════════════════════════════════════════════

UPDATE shared.organisation
SET id_zone_agro = (SELECT id FROM geo.zone_agro WHERE code = 'BA')
WHERE code_organisation IN ('MULTI-SINSALOU', 'MULTI-KAOLACK', 'MULTI-KAOLACK-02', 'MULTI-DIOURBEL');

-- ═══════════════════════════════════════════════════════════════════════
-- PARTIE 2 : GPS + zone_code pour les sites existants
-- ═══════════════════════════════════════════════════════════════════════

UPDATE stock.site SET latitude = 14.150700, longitude = -16.072600, zone_code = 'BA'
WHERE code_site = 'FERME-MULTI-02';

UPDATE stock.site SET latitude = 13.739900, longitude = -15.798500, zone_code = 'BA'
WHERE code_site = 'FERME-MULTI-03';

UPDATE stock.site SET latitude = 14.150700, longitude = -16.075000, zone_code = 'BA'
WHERE code_site = 'FERME-MULTI-KAOLACK';

UPDATE stock.site SET latitude = 14.654700, longitude = -16.232600, zone_code = 'BA'
WHERE code_site = 'STOCK-MULTIDIOURBEL';

-- ═══════════════════════════════════════════════════════════════════════
-- PARTIE 3 : Lots R2 pour multiplicateur_kaolack (org MULTI-KAOLACK, BA)
--            Variétés adaptées au Bassin Arachidier : Arachide + Mil
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-ARA-FLEUR11-2026-KAO',
    v.id, g.id, '2026',
    175000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-KAOLACK'),
    'multiplicateur_kaolack', NOW(), '2026-04-15', 'ARA'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'ARA-FLEUR11'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-MIL-SOUNA3-2026-KAO',
    v.id, g.id, '2026',
    98000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-KAOLACK'),
    'multiplicateur_kaolack', NOW(), '2026-05-20', 'MIL'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'MIL-SOUNA3'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id,
       (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-KAOLACK'),
       l.quantite_nette, 'kg'
FROM lot.lot_semencier l
WHERE l.code_lot IN ('R2-ARA-FLEUR11-2026-KAO', 'R2-MIL-SOUNA3-2026-KAO')
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- PARTIE 4 : Multiplicateurs virtuels par zone (lots catalogue seulement)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── ZSP — Zone Sylvo-pastorale (Louga) ────────────────────────────

INSERT INTO shared.organisation (code_organisation, nom_organisation, type_organisation,
    region, localite, departement, active, id_zone_agro)
VALUES ('MULTI-ZSP-01', 'GIE Semencier du Ferlo', 'MULTIPLICATEUR',
    'Louga', 'Louga', 'Louga', true,
    (SELECT id FROM geo.zone_agro WHERE code = 'ZSP'))
ON CONFLICT (code_organisation) DO NOTHING;

INSERT INTO shared.membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
VALUES ('multi_zsp_louga', 'seed-multiplicator', 'GIE Semencier du Ferlo',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-ZSP-01'), 'RESPONSABLE', true)
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO stock.site (code_site, nom_site, type_site, localite, region, departement,
    latitude, longitude, zone_code, est_principal, id_organisation, id_membre)
VALUES ('FERME-ZSP-01', 'Ferme Semencière du Ferlo', 'FERME',
    'Louga', 'Louga', 'Louga',
    15.6118, -16.2278, 'ZSP', true,
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-ZSP-01'),
    (SELECT id FROM shared.membre_organisation WHERE keycloak_username = 'multi_zsp_louga'))
ON CONFLICT (code_site) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-MIL-SOUNA3-2026-ZSP',
    v.id, g.id, '2026',
    80000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-ZSP-01'),
    'multi_zsp_louga', NOW(), '2026-05-15', 'MIL'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'MIL-SOUNA3'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-SOR-CE145-2026-ZSP',
    v.id, g.id, '2026',
    62000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-ZSP-01'),
    'multi_zsp_louga', NOW(), '2026-05-20', 'SOR'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'SOR-CE145'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id,
       (SELECT id FROM stock.site WHERE code_site = 'FERME-ZSP-01'),
       l.quantite_nette, 'kg'
FROM lot.lot_semencier l
WHERE l.code_lot IN ('R2-MIL-SOUNA3-2026-ZSP', 'R2-SOR-CE145-2026-ZSP')
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ─── SO — Sénégal Oriental (Tambacounda) ────────────────────────────

INSERT INTO shared.organisation (code_organisation, nom_organisation, type_organisation,
    region, localite, departement, active, id_zone_agro)
VALUES ('MULTI-SO-01', 'GIE Semences Orientales', 'MULTIPLICATEUR',
    'Tambacounda', 'Tambacounda', 'Tambacounda', true,
    (SELECT id FROM geo.zone_agro WHERE code = 'SO'))
ON CONFLICT (code_organisation) DO NOTHING;

INSERT INTO shared.membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
VALUES ('multi_so_tambacounda', 'seed-multiplicator', 'GIE Semences Orientales',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-SO-01'), 'RESPONSABLE', true)
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO stock.site (code_site, nom_site, type_site, localite, region, departement,
    latitude, longitude, zone_code, est_principal, id_organisation, id_membre)
VALUES ('FERME-SO-01', 'Ferme Semencière Tambacounda', 'FERME',
    'Tambacounda', 'Tambacounda', 'Tambacounda',
    13.7707, -13.6672, 'SO', true,
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-SO-01'),
    (SELECT id FROM shared.membre_organisation WHERE keycloak_username = 'multi_so_tambacounda'))
ON CONFLICT (code_site) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-MAI-DK8031-2026-SO',
    v.id, g.id, '2026',
    120000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-SO-01'),
    'multi_so_tambacounda', NOW(), '2026-06-01', 'MAI'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'MAI-DK8031'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-SOR-CE145-2026-SO',
    v.id, g.id, '2026',
    55000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-SO-01'),
    'multi_so_tambacounda', NOW(), '2026-05-25', 'SOR'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'SOR-CE145'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id,
       (SELECT id FROM stock.site WHERE code_site = 'FERME-SO-01'),
       l.quantite_nette, 'kg'
FROM lot.lot_semencier l
WHERE l.code_lot IN ('R2-MAI-DK8031-2026-SO', 'R2-SOR-CE145-2026-SO')
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ─── VF — Vallée du Fleuve Sénégal (Saint-Louis) ──────────────────

INSERT INTO shared.organisation (code_organisation, nom_organisation, type_organisation,
    region, localite, departement, active, id_zone_agro)
VALUES ('MULTI-VF-01', 'GIE Semences du Delta', 'MULTIPLICATEUR',
    'Saint-Louis', 'Saint-Louis', 'Saint-Louis', true,
    (SELECT id FROM geo.zone_agro WHERE code = 'VF'))
ON CONFLICT (code_organisation) DO NOTHING;

INSERT INTO shared.membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
VALUES ('multi_vf_stlouis', 'seed-multiplicator', 'GIE Semences du Delta',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-VF-01'), 'RESPONSABLE', true)
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO stock.site (code_site, nom_site, type_site, localite, region, departement,
    latitude, longitude, zone_code, est_principal, id_organisation, id_membre)
VALUES ('FERME-VF-01', 'Ferme Semencière Delta Sénégal', 'FERME',
    'Saint-Louis', 'Saint-Louis', 'Saint-Louis',
    16.0179, -16.4896, 'VF', true,
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-VF-01'),
    (SELECT id FROM shared.membre_organisation WHERE keycloak_username = 'multi_vf_stlouis'))
ON CONFLICT (code_site) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-RIZ-SAHEL108-2026-VF',
    v.id, g.id, '2026',
    95000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-VF-01'),
    'multi_vf_stlouis', NOW(), '2026-04-10', 'RIZ'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'RIZ-SAHEL108'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-RIZ-SAHEL177-2026-VF',
    v.id, g.id, '2026',
    80000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-VF-01'),
    'multi_vf_stlouis', NOW(), '2026-04-15', 'RIZ'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'RIZ-SAHEL177'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id,
       (SELECT id FROM stock.site WHERE code_site = 'FERME-VF-01'),
       l.quantite_nette, 'kg'
FROM lot.lot_semencier l
WHERE l.code_lot IN ('R2-RIZ-SAHEL108-2026-VF', 'R2-RIZ-SAHEL177-2026-VF')
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ─── HC — Haute Casamance (Kolda) ───────────────────────────────────

INSERT INTO shared.organisation (code_organisation, nom_organisation, type_organisation,
    region, localite, departement, active, id_zone_agro)
VALUES ('MULTI-HC-01', 'GIE Semences Haute Casamance', 'MULTIPLICATEUR',
    'Kolda', 'Kolda', 'Kolda', true,
    (SELECT id FROM geo.zone_agro WHERE code = 'HC'))
ON CONFLICT (code_organisation) DO NOTHING;

INSERT INTO shared.membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
VALUES ('multi_hc_kolda', 'seed-multiplicator', 'GIE Semences Haute Casamance',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-HC-01'), 'RESPONSABLE', true)
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO stock.site (code_site, nom_site, type_site, localite, region, departement,
    latitude, longitude, zone_code, est_principal, id_organisation, id_membre)
VALUES ('FERME-HC-01', 'Ferme Semencière Kolda', 'FERME',
    'Kolda', 'Kolda', 'Kolda',
    12.8983, -14.9404, 'HC', true,
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-HC-01'),
    (SELECT id FROM shared.membre_organisation WHERE keycloak_username = 'multi_hc_kolda'))
ON CONFLICT (code_site) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-MAI-DK8031-2026-HC',
    v.id, g.id, '2026',
    75000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-HC-01'),
    'multi_hc_kolda', NOW(), '2026-06-05', 'MAI'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'MAI-DK8031'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-ARA-FLEUR11-2026-HC',
    v.id, g.id, '2026',
    90000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-HC-01'),
    'multi_hc_kolda', NOW(), '2026-05-28', 'ARA'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'ARA-FLEUR11'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id,
       (SELECT id FROM stock.site WHERE code_site = 'FERME-HC-01'),
       l.quantite_nette, 'kg'
FROM lot.lot_semencier l
WHERE l.code_lot IN ('R2-MAI-DK8031-2026-HC', 'R2-ARA-FLEUR11-2026-HC')
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ─── NAY — Niayes (Thiès) ───────────────────────────────────────────

INSERT INTO shared.organisation (code_organisation, nom_organisation, type_organisation,
    region, localite, departement, active, id_zone_agro)
VALUES ('MULTI-NAY-01', 'GIE Semences des Niayes', 'MULTIPLICATEUR',
    'Thiès', 'Thiès', 'Thiès', true,
    (SELECT id FROM geo.zone_agro WHERE code = 'NAY'))
ON CONFLICT (code_organisation) DO NOTHING;

INSERT INTO shared.membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
VALUES ('multi_nay_thies', 'seed-multiplicator', 'GIE Semences des Niayes',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-NAY-01'), 'RESPONSABLE', true)
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO stock.site (code_site, nom_site, type_site, localite, region, departement,
    latitude, longitude, zone_code, est_principal, id_organisation, id_membre)
VALUES ('FERME-NAY-01', 'Ferme Semencière des Niayes', 'FERME',
    'Thiès', 'Thiès', 'Thiès',
    14.7910, -16.9259, 'NAY', true,
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-NAY-01'),
    (SELECT id FROM shared.membre_organisation WHERE keycloak_username = 'multi_nay_thies'))
ON CONFLICT (code_site) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-ARA-FLEUR11-2026-NAY',
    v.id, g.id, '2026',
    130000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-NAY-01'),
    'multi_nay_thies', NOW(), '2026-05-10', 'ARA'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'ARA-FLEUR11'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-NIE-BAMBEY21-2026-NAY',
    v.id, g.id, '2026',
    45000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-NAY-01'),
    'multi_nay_thies', NOW(), '2026-05-18', 'NIE'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'NIE-BAMBEY21'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id,
       (SELECT id FROM stock.site WHERE code_site = 'FERME-NAY-01'),
       l.quantite_nette, 'kg'
FROM lot.lot_semencier l
WHERE l.code_lot IN ('R2-ARA-FLEUR11-2026-NAY', 'R2-NIE-BAMBEY21-2026-NAY')
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ─── MC — Moyenne Casamance (Sédhiou) ───────────────────────────────

INSERT INTO shared.organisation (code_organisation, nom_organisation, type_organisation,
    region, localite, departement, active, id_zone_agro)
VALUES ('MULTI-MC-01', 'GIE Semences Moyenne Casamance', 'MULTIPLICATEUR',
    'Sédhiou', 'Sédhiou', 'Sédhiou', true,
    (SELECT id FROM geo.zone_agro WHERE code = 'MC'))
ON CONFLICT (code_organisation) DO NOTHING;

INSERT INTO shared.membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
VALUES ('multi_mc_sedhiou', 'seed-multiplicator', 'GIE Semences Moyenne Casamance',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-MC-01'), 'RESPONSABLE', true)
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO stock.site (code_site, nom_site, type_site, localite, region, departement,
    latitude, longitude, zone_code, est_principal, id_organisation, id_membre)
VALUES ('FERME-MC-01', 'Ferme Semencière Sédhiou', 'FERME',
    'Sédhiou', 'Sédhiou', 'Sédhiou',
    12.7048, -15.5566, 'MC', true,
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-MC-01'),
    (SELECT id FROM shared.membre_organisation WHERE keycloak_username = 'multi_mc_sedhiou'))
ON CONFLICT (code_site) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-RIZ-NERICA1-2026-MC',
    v.id, g.id, '2026',
    65000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-MC-01'),
    'multi_mc_sedhiou', NOW(), '2026-05-05', 'RIZ'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'RIZ-NERICA1'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-MAI-DK8031-2026-MC',
    v.id, g.id, '2026',
    58000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-MC-01'),
    'multi_mc_sedhiou', NOW(), '2026-06-10', 'MAI'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'MAI-DK8031'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id,
       (SELECT id FROM stock.site WHERE code_site = 'FERME-MC-01'),
       l.quantite_nette, 'kg'
FROM lot.lot_semencier l
WHERE l.code_lot IN ('R2-RIZ-NERICA1-2026-MC', 'R2-MAI-DK8031-2026-MC')
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ─── BC — Basse Casamance (Ziguinchor) ──────────────────────────────

INSERT INTO shared.organisation (code_organisation, nom_organisation, type_organisation,
    region, localite, departement, active, id_zone_agro)
VALUES ('MULTI-BC-01', 'GIE Semences Basse Casamance', 'MULTIPLICATEUR',
    'Ziguinchor', 'Ziguinchor', 'Ziguinchor', true,
    (SELECT id FROM geo.zone_agro WHERE code = 'BC'))
ON CONFLICT (code_organisation) DO NOTHING;

INSERT INTO shared.membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
VALUES ('multi_bc_ziguinchor', 'seed-multiplicator', 'GIE Semences Basse Casamance',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-BC-01'), 'RESPONSABLE', true)
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO stock.site (code_site, nom_site, type_site, localite, region, departement,
    latitude, longitude, zone_code, est_principal, id_organisation, id_membre)
VALUES ('FERME-BC-01', 'Ferme Semencière Ziguinchor', 'FERME',
    'Ziguinchor', 'Ziguinchor', 'Ziguinchor',
    12.5643, -16.2685, 'BC', true,
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-BC-01'),
    (SELECT id FROM shared.membre_organisation WHERE keycloak_username = 'multi_bc_ziguinchor'))
ON CONFLICT (code_site) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-RIZ-SAHEL108-2026-BC',
    v.id, g.id, '2026',
    85000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-BC-01'),
    'multi_bc_ziguinchor', NOW(), '2026-04-20', 'RIZ'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'RIZ-SAHEL108'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (code_lot, id_variete, id_generation, campagne,
    quantite_nette, unite, statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece)
SELECT 'R2-MAI-DK8031-2026-BC',
    v.id, g.id, '2026',
    67000.00, 'kg', 'DISPONIBLE',
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-BC-01'),
    'multi_bc_ziguinchor', NOW(), '2026-06-03', 'MAI'
FROM catalog.variete v
JOIN lot.generation_semence g ON g.code_generation = 'R2'
WHERE v.code_variete = 'MAI-DK8031'
ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id,
       (SELECT id FROM stock.site WHERE code_site = 'FERME-BC-01'),
       l.quantite_nette, 'kg'
FROM lot.lot_semencier l
WHERE l.code_lot IN ('R2-RIZ-SAHEL108-2026-BC', 'R2-MAI-DK8031-2026-BC')
ON CONFLICT (id_lot, id_site) DO NOTHING;
