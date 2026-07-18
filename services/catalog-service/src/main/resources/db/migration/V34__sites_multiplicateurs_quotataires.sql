-- V34 : Réorganisation sites — colonnes departement & est_principal,
--        sites par défaut pour UPSemCL/quotataires,
--        marquage des sites principaux par organisation.

-- ── 1. Nouvelles colonnes sur site ───────────────────────────────
ALTER TABLE site ADD COLUMN IF NOT EXISTS departement   VARCHAR(60);
ALTER TABLE site ADD COLUMN IF NOT EXISTS est_principal BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Site UPSemCL Bambey (org id=2) ────────────────────────────
INSERT INTO site (code_site, nom_site, type_site, localite, region, departement,
                  id_organisation, latitude, longitude, est_principal)
VALUES ('UPSEMCL-SITE-BAMBEY', 'Site UPSemCL Bambey', 'MAGASIN',
        'Bambey', 'Diourbel', 'Bambey', 2, 14.7128, -16.4596, true)
ON CONFLICT (code_site) DO NOTHING;

-- ── 3. Site UPSemCL Saint-Louis (org id=5) ───────────────────────
INSERT INTO site (code_site, nom_site, type_site, localite, region, departement,
                  id_organisation, latitude, longitude, est_principal)
VALUES ('UPSEMCL-SITE-STLOUIS', 'Site UPSemCL Saint-Louis', 'MAGASIN',
        'Saint-Louis', 'Saint-Louis', 'Saint-Louis', 5, 16.0209, -16.4896, true)
ON CONFLICT (code_site) DO NOTHING;

-- ── 4. Sites par défaut pour les OP/quotataires ──────────────────
INSERT INTO site (code_site, nom_site, type_site, localite, region, departement,
                  id_organisation, latitude, longitude, est_principal)
VALUES
  ('SITE-OP-NORD',       'Site OP Nord — Saint-Louis',    'MAGASIN',
   'Saint-Louis', 'Saint-Louis', 'Saint-Louis', 7, 16.0209, -16.4896, true),
  ('SITE-OP-CENTRE',     'Site OP Centre — Kaolack',      'MAGASIN',
   'Kaolack', 'Kaolack', 'Kaolack', 8, 14.1412, -16.0726, true),
  ('SITE-OP-CASAMANCE',  'Site OP Casamance — Ziguinchor','MAGASIN',
   'Ziguinchor', 'Ziguinchor', 'Ziguinchor', 9, 12.5675, -16.2719, true)
ON CONFLICT (code_site) DO NOTHING;

-- ── 5. Marquer les sites principaux existants ────────────────────
-- ISRA (id=1) → CNRA-BAMBEY est le site de référence des sélectionneurs
UPDATE site SET est_principal = true  WHERE code_site = 'CNRA-BAMBEY';
UPDATE site SET est_principal = false WHERE code_site = 'FERME-MULTI-01';

-- UPSEMCL-BAMBEY (id=2) → le nouveau UPSEMCL-SITE-BAMBEY est principal
UPDATE site SET est_principal = false WHERE code_site = 'MAG-BAMBEY';

-- MULTI-SINSALOU (id=4) → FERME-MULTI-02 est le site principal
UPDATE site SET est_principal = true  WHERE code_site = 'FERME-MULTI-02';
UPDATE site SET est_principal = false WHERE code_site = 'FERME-MULTI-03';

-- MULTI-DIOURBEL (id=6) → STOCK-MULTIDIOURBEL est le seul site
UPDATE site SET est_principal = true  WHERE code_site = 'STOCK-MULTIDIOURBEL';

-- ── 6. Renseigner le departement sur les sites existants ─────────
UPDATE site SET departement = 'Bambey'      WHERE code_site IN ('CNRA-BAMBEY','FERME-MULTI-01');
UPDATE site SET departement = 'Thiès'       WHERE code_site IN ('MAG-BAMBEY','LAB-THIES');
UPDATE site SET departement = 'Kaolack'     WHERE code_site IN ('FERME-MULTI-02','ISRA-KAOLACK');
UPDATE site SET departement = 'Nioro du Rip'WHERE code_site = 'FERME-MULTI-03';
UPDATE site SET departement = 'Ziguinchor'  WHERE code_site = 'MAG-ZIGUINCH';
UPDATE site SET departement = 'Podor'       WHERE code_site = 'SAED-PODOR';
