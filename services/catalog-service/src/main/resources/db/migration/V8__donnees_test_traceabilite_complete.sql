-- ============================================================
-- V8__donnees_test_traceabilite_complete.sql
-- Données de démonstration : chaîne G0 → R2 complète
--   • Arachide (ARA-12 / Fleur 11) : G0→G1→G2→G3→R1→R2
--   • Mil       (MIL-SN / Sanio Local) : G0→G1→G2→G3→G4→R1→R2
-- Acteurs alignés sur les comptes Keycloak seed-v0 (V5) :
--   selecteur_ara, selecteur_mil, upsemcl_bambey, upsemcl,
--   multiplicateur, admin (quotataire)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 0. FILET DE SÉCURITÉ — Lots V2 (G0 et G1 ARA)
--    Si V2 ne les a pas insérés (baseline-version mal configuré
--    lors d'une migration précédente), on les crée ici.
--    ON CONFLICT DO NOTHING protège si V2 les avait déjà créés.
-- ──────────────────────────────────────────────────────────────

-- G0 ARA (lot racine — noyau génétique ISRA CNRA)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G0-ARA-2026-001',
  v.id, g.id, NULL, c.id,
  '2026-03-15', 50.00, 'kg', 96.5, 99.2, 'DISPONIBLE',
  'ARA', 'selecteur_ara', 'Dr. Diallo Mamadou', 'seed-selector',
  (SELECT id FROM organisation WHERE code_organisation = 'ISRA-CNRA')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'G0'
JOIN campagne           c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'ARA-12'
ON CONFLICT (code_lot) DO NOTHING;

-- G1 ARA (pré-base — transféré à UPSemCL)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G1-ARA-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-05-20', 320.00, 'kg', 94.0, 98.5, 'TRANSFERE',
  'ARA', 'upsemcl_bambey', 'Station Bambey UPSemCL', 'seed-upsemcl',
  (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
FROM variete v
JOIN generation_semence g  ON g.code_generation = 'G1'
JOIN lot_semencier      p  ON p.code_lot = 'SIM-G0-ARA-2026-001'
JOIN campagne           c  ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'ARA-12'
ON CONFLICT (code_lot) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 0b. MISE À JOUR des lots V2 existants
--     (code_espece + username + id_org absents de V2 original)
-- ──────────────────────────────────────────────────────────────

UPDATE lot_semencier SET
  code_espece       = 'ARA',
  username_createur = 'selecteur_ara',
  id_org_producteur = (SELECT id FROM organisation WHERE code_organisation = 'ISRA-CNRA')
WHERE code_lot = 'SIM-G0-ARA-2026-001'
  AND (code_espece IS NULL OR username_createur IS NULL);

UPDATE lot_semencier SET
  code_espece       = 'ARA',
  username_createur = 'upsemcl_bambey',
  statut_lot        = 'TRANSFERE',
  id_org_producteur = (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
WHERE code_lot = 'SIM-G1-ARA-2026-001';

-- ──────────────────────────────────────────────────────────────
-- 1. CHAÎNE ARACHIDE — G2 à R2
--    Variété : ARA-12 (Fleur 11)  |  Responsable : selecteur_ara
-- ──────────────────────────────────────────────────────────────

-- G2 — Base (UPSemCL Bambey, multiplicé depuis G1)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G2-ARA-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-06-10', 2800.00, 'kg', 92.5, 97.8, 'DISPONIBLE',
  'ARA', 'upsemcl_bambey', 'Agent UPSemCL Bambey', 'seed-upsemcl',
  (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'G2'
JOIN lot_semencier     p ON p.code_lot = 'SIM-G1-ARA-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'ARA-12'
ON CONFLICT (code_lot) DO NOTHING;

-- G3 — Certifiée C1 (UPSemCL Bambey → transféré multiplicateur)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G3-ARA-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-08-05', 18500.00, 'kg', 91.0, 97.0, 'TRANSFERE',
  'ARA', 'upsemcl_bambey', 'Agent UPSemCL Bambey', 'seed-upsemcl',
  (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'G3'
JOIN lot_semencier     p ON p.code_lot = 'SIM-G2-ARA-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'ARA-12'
ON CONFLICT (code_lot) DO NOTHING;

-- R1 — Commerciale R1 (Multiplicateur Sine-Saloum, produit depuis G3)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-R1-ARA-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-09-20', 75000.00, 'kg', 88.5, 95.5, 'DISPONIBLE',
  'ARA', 'multiplicateur', 'Multiplicateur Agréé', 'seed-multiplicator',
  (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'R1'
JOIN lot_semencier     p ON p.code_lot = 'SIM-G3-ARA-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'ARA-12'
ON CONFLICT (code_lot) DO NOTHING;

-- R2 — Commerciale R2 (Multiplicateur → Quotataires)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-R2-ARA-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-10-30', 320000.00, 'kg', 85.0, 94.0, 'DISPONIBLE',
  'ARA', 'multiplicateur', 'Multiplicateur Agréé', 'seed-multiplicator',
  (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'R2'
JOIN lot_semencier     p ON p.code_lot = 'SIM-R1-ARA-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'ARA-12'
ON CONFLICT (code_lot) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 2. CHAÎNE MIL — G0 à R2 (chaîne complète avec G4)
--    Variété : MIL-SN (Sanio Local)  |  Responsable : selecteur_mil
-- ──────────────────────────────────────────────────────────────

-- G0 — Noyau génétique (ISRA CNRA Bambey)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G0-MIL-2026-001',
  v.id, g.id, NULL, c.id,
  '2026-03-10', 30.00, 'kg', 97.5, 99.8, 'DISPONIBLE',
  'MIL', 'selecteur_mil', 'Sélectionneur Mil', 'seed-selector',
  (SELECT id FROM organisation WHERE code_organisation = 'ISRA-CNRA')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'G0'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'MIL-SN'
ON CONFLICT (code_lot) DO NOTHING;

-- G1 — Pré-base (ISRA CNRA → transféré UPSemCL National)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G1-MIL-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-05-15', 250.00, 'kg', 95.0, 99.0, 'TRANSFERE',
  'MIL', 'selecteur_mil', 'Sélectionneur Mil', 'seed-selector',
  (SELECT id FROM organisation WHERE code_organisation = 'ISRA-CNRA')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'G1'
JOIN lot_semencier     p ON p.code_lot = 'SIM-G0-MIL-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'MIL-SN'
ON CONFLICT (code_lot) DO NOTHING;

-- G2 — Base (UPSemCL National)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G2-MIL-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-06-20', 2000.00, 'kg', 93.0, 98.0, 'DISPONIBLE',
  'MIL', 'upsemcl', 'Agent UPSemCL National', 'seed-upsemcl',
  (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-NAT')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'G2'
JOIN lot_semencier     p ON p.code_lot = 'SIM-G1-MIL-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'MIL-SN'
ON CONFLICT (code_lot) DO NOTHING;

-- G3 — Certifiée C1 (UPSemCL National → transféré multiplicateur)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G3-MIL-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-07-30', 12000.00, 'kg', 91.5, 97.5, 'TRANSFERE',
  'MIL', 'upsemcl', 'Agent UPSemCL National', 'seed-upsemcl',
  (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-NAT')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'G3'
JOIN lot_semencier     p ON p.code_lot = 'SIM-G2-MIL-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'MIL-SN'
ON CONFLICT (code_lot) DO NOTHING;

-- G4 — Certifiée C2 (Multiplicateur, produit depuis G3 reçu)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-G4-MIL-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-08-25', 9500.00, 'kg', 90.0, 96.5, 'DISPONIBLE',
  'MIL', 'multiplicateur', 'Multiplicateur Agréé', 'seed-multiplicator',
  (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'G4'
JOIN lot_semencier     p ON p.code_lot = 'SIM-G3-MIL-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'MIL-SN'
ON CONFLICT (code_lot) DO NOTHING;

-- R1 — Commerciale R1 (Multiplicateur)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-R1-MIL-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-09-15', 55000.00, 'kg', 88.0, 95.0, 'DISPONIBLE',
  'MIL', 'multiplicateur', 'Multiplicateur Agréé', 'seed-multiplicator',
  (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'R1'
JOIN lot_semencier     p ON p.code_lot = 'SIM-G4-MIL-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'MIL-SN'
ON CONFLICT (code_lot) DO NOTHING;

-- R2 — Commerciale R2 (Multiplicateur → Quotataires)
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, id_campagne,
                            date_production, quantite_nette, unite,
                            taux_germination, purete_physique, statut_lot,
                            code_espece, username_createur, responsable_nom, responsable_role,
                            id_org_producteur)
SELECT 'SIM-R2-MIL-2026-001',
  v.id, g.id, p.id, c.id,
  '2026-10-20', 220000.00, 'kg', 85.5, 94.5, 'DISPONIBLE',
  'MIL', 'multiplicateur', 'Multiplicateur Agréé', 'seed-multiplicator',
  (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU')
FROM variete v
JOIN generation_semence g ON g.code_generation = 'R2'
JOIN lot_semencier     p ON p.code_lot = 'SIM-R1-MIL-2026-001'
JOIN campagne          c ON c.code_campagne = 'HIV-2026'
WHERE v.code_variete = 'MIL-SN'
ON CONFLICT (code_lot) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 3. STOCKS (un enregistrement site × lot par niveau de chaîne)
-- ──────────────────────────────────────────────────────────────

-- ARA — G0 au CNRA Bambey (banque de gènes)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 50.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-G0-ARA-2026-001' AND s.code_site = 'CNRA-BAMBEY'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ARA — G2 au Magasin Thiès (UPSemCL)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 2800.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-G2-ARA-2026-001' AND s.code_site = 'MAG-THIES'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ARA — G3 à la Ferme Mult-02 Kaolack (après transfert multiplicateur)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 18500.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-G3-ARA-2026-001' AND s.code_site = 'FERME-MULTI-02'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ARA — R1 à la Ferme Mult-02 (en production)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 75000.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-R1-ARA-2026-001' AND s.code_site = 'FERME-MULTI-02'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ARA — R2 à la Ferme Mult-03 Fatick (commercialisation)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 320000.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-R2-ARA-2026-001' AND s.code_site = 'FERME-MULTI-03'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- MIL — G0 au CNRA Bambey
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 30.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-G0-MIL-2026-001' AND s.code_site = 'CNRA-BAMBEY'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- MIL — G1 au CNRA Bambey (avant transfert UPSemCL)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 250.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-G1-MIL-2026-001' AND s.code_site = 'CNRA-BAMBEY'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- MIL — G2 au Magasin Saint-Louis (UPSemCL National)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 2000.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-G2-MIL-2026-001' AND s.code_site = 'MAG-STLOUIS'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- MIL — G3 au Magasin Saint-Louis (avant transfert multiplicateur)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 12000.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-G3-MIL-2026-001' AND s.code_site = 'MAG-STLOUIS'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- MIL — G4 à la Ferme Mult-02 (multiplicateur)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 9500.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-G4-MIL-2026-001' AND s.code_site = 'FERME-MULTI-02'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- MIL — R1 à la Ferme Mult-03 Fatick
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 55000.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-R1-MIL-2026-001' AND s.code_site = 'FERME-MULTI-03'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- MIL — R2 à la Ferme Mult-03 Fatick (commercialisation)
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 220000.00, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot = 'SIM-R2-MIL-2026-001' AND s.code_site = 'FERME-MULTI-03'
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 4. TRANSFERTS (traçabilité des passages de main entre acteurs)
-- ──────────────────────────────────────────────────────────────

-- TL-1 : selecteur_ara → upsemcl_bambey (G1 ARA)
INSERT INTO transfert_lot (code_transfert, id_lot,
  username_emetteur, role_emetteur,
  username_destinataire, role_destinataire,
  generation_transferee, quantite, statut,
  date_demande, date_acceptation, observations)
SELECT 'TL-ARA-G1-2026-001', l.id,
  'selecteur_ara', 'seed-selector',
  'upsemcl_bambey', 'seed-upsemcl',
  'G1', 320.00, 'ACCEPTE',
  '2026-05-18', '2026-05-20',
  'Transfert G1 Arachide Fleur 11 — Station Bambey — Campagne HIV-2026'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G1-ARA-2026-001'
ON CONFLICT (code_transfert) DO NOTHING;

-- TL-2 : upsemcl_bambey → multiplicateur (G3 ARA)
INSERT INTO transfert_lot (code_transfert, id_lot,
  username_emetteur, role_emetteur,
  username_destinataire, role_destinataire,
  generation_transferee, quantite, statut,
  date_demande, date_acceptation, observations)
SELECT 'TL-ARA-G3-2026-001', l.id,
  'upsemcl_bambey', 'seed-upsemcl',
  'multiplicateur', 'seed-multiplicator',
  'G3', 18500.00, 'ACCEPTE',
  '2026-08-01', '2026-08-05',
  'Transfert G3 Arachide C1 certifiée — Coopérative Sine-Saloum Semences'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-ARA-2026-001'
ON CONFLICT (code_transfert) DO NOTHING;

-- TL-3 : selecteur_mil → upsemcl (G1 MIL)
INSERT INTO transfert_lot (code_transfert, id_lot,
  username_emetteur, role_emetteur,
  username_destinataire, role_destinataire,
  generation_transferee, quantite, statut,
  date_demande, date_acceptation, observations)
SELECT 'TL-MIL-G1-2026-001', l.id,
  'selecteur_mil', 'seed-selector',
  'upsemcl', 'seed-upsemcl',
  'G1', 250.00, 'ACCEPTE',
  '2026-05-12', '2026-05-15',
  'Transfert G1 Mil Sanio Local — UPSemCL National Saint-Louis'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G1-MIL-2026-001'
ON CONFLICT (code_transfert) DO NOTHING;

-- TL-4 : upsemcl → multiplicateur (G3 MIL)
INSERT INTO transfert_lot (code_transfert, id_lot,
  username_emetteur, role_emetteur,
  username_destinataire, role_destinataire,
  generation_transferee, quantite, statut,
  date_demande, date_acceptation, observations)
SELECT 'TL-MIL-G3-2026-001', l.id,
  'upsemcl', 'seed-upsemcl',
  'multiplicateur', 'seed-multiplicator',
  'G3', 12000.00, 'ACCEPTE',
  '2026-07-28', '2026-07-30',
  'Transfert G3 Mil C1 certifiée — Coopérative Sine-Saloum Semences'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-MIL-2026-001'
ON CONFLICT (code_transfert) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 5. CONTRÔLES QUALITÉ (G3 et R2 = niveaux critiques ISRA)
-- ──────────────────────────────────────────────────────────────

INSERT INTO controle_qualite (id_lot, type_controle, date_controle,
  taux_germination, taux_humidite, purete_physique, purete_specifique,
  conformite_varietale, resultat, controleur, observations)
SELECT l.id, 'COMPLET', '2026-07-28',
  91.0, 9.2, 97.0, 99.1,
  'CONFORME', 'CONFORME', 'Laboratoire ISRA Thiès',
  'Contrôle pré-transfert G3 Arachide. Toutes valeurs conformes aux normes ISRA/CNRA.'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-ARA-2026-001';

INSERT INTO controle_qualite (id_lot, type_controle, date_controle,
  taux_germination, taux_humidite, purete_physique, purete_specifique,
  conformite_varietale, resultat, controleur, observations)
SELECT l.id, 'COMPLET', '2026-07-25',
  91.5, 9.5, 97.5, 99.3,
  'CONFORME', 'CONFORME', 'Laboratoire ISRA Thiès',
  'Contrôle pré-transfert G3 Mil. Conforme normes ISRA/CNRA.'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-MIL-2026-001';

INSERT INTO controle_qualite (id_lot, type_controle, date_controle,
  taux_germination, taux_humidite, purete_physique, purete_specifique,
  conformite_varietale, resultat, controleur, observations)
SELECT l.id, 'GERMINATION', '2026-10-25',
  85.0, 9.8, 94.0, 98.0,
  'CONFORME', 'CONFORME', 'Laboratoire ISRA Thiès',
  'Contrôle R2 Arachide avant commercialisation quotataires. OK.'
FROM lot_semencier l WHERE l.code_lot = 'SIM-R2-ARA-2026-001';

INSERT INTO controle_qualite (id_lot, type_controle, date_controle,
  taux_germination, taux_humidite, purete_physique, purete_specifique,
  conformite_varietale, resultat, controleur, observations)
SELECT l.id, 'GERMINATION', '2026-10-18',
  85.5, 9.6, 94.5, 98.2,
  'CONFORME', 'CONFORME', 'Laboratoire ISRA Thiès',
  'Contrôle R2 Mil avant commercialisation quotataires. OK.'
FROM lot_semencier l WHERE l.code_lot = 'SIM-R2-MIL-2026-001';

-- ──────────────────────────────────────────────────────────────
-- 6. CERTIFICATIONS (G3 ARA et G3 MIL — DAPS Sénégal)
-- ──────────────────────────────────────────────────────────────

INSERT INTO certification (id_lot, organisme_certificateur, numero_certificat,
  date_demande, date_inspection, date_certification,
  resultat_certification, date_expiration)
SELECT l.id,
  'DAPS — Direction des Ressources Agricoles et Pastorales',
  'CERT-ARA-G3-2026-001',
  '2026-07-20', '2026-07-25', '2026-07-30',
  'CONFORME', '2027-07-30'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-ARA-2026-001'
ON CONFLICT (numero_certificat) DO NOTHING;

INSERT INTO certification (id_lot, organisme_certificateur, numero_certificat,
  date_demande, date_inspection, date_certification,
  resultat_certification, date_expiration)
SELECT l.id,
  'DAPS — Direction des Ressources Agricoles et Pastorales',
  'CERT-MIL-G3-2026-001',
  '2026-07-22', '2026-07-27', '2026-08-01',
  'CONFORME', '2027-08-01'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-MIL-2026-001'
ON CONFLICT (numero_certificat) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 7. PROGRAMMES DE MULTIPLICATION
-- ──────────────────────────────────────────────────────────────

INSERT INTO programme_multiplication (code_programme, id_lot_source, id_organisation,
  generation_cible, superficie_ha, objectif_kg,
  date_debut, date_fin, statut, observations)
SELECT 'PROG-MUL-ARA-2026', l.id,
  (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU'),
  'R2', 350.00, 350000.00,
  '2026-08-15', '2026-11-15', 'EN_COURS',
  'Production R2 Arachide Fleur 11 — 350 ha — Coopérative Sine-Saloum. Objectif 350 t.'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-ARA-2026-001'
ON CONFLICT (code_programme) DO NOTHING;

INSERT INTO programme_multiplication (code_programme, id_lot_source, id_organisation,
  generation_cible, superficie_ha, objectif_kg,
  date_debut, date_fin, statut, observations)
SELECT 'PROG-MUL-MIL-2026', l.id,
  (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU'),
  'R2', 220.00, 220000.00,
  '2026-08-01', '2026-11-01', 'TERMINE',
  'Production R2 Mil Sanio Local — 220 ha — Terminé. Rendement atteint.'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-MIL-2026-001'
ON CONFLICT (code_programme) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 8. COMMANDES QUOTATAIRES (acheteurs de semences R2)
-- ──────────────────────────────────────────────────────────────

INSERT INTO commande (code_commande, client, statut, username_acheteur,
  id_organisation_fournisseur, observations)
VALUES
  ('CMD-2026-001',
   'Coopérative Agropastorale de Diourbel', 'SOUMISE', 'admin',
   (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU'),
   'Demande 5 000 kg R2 Arachide Fleur 11 — Campagne semis 2026-2027')
ON CONFLICT (code_commande) DO NOTHING;

INSERT INTO commande (code_commande, client, statut, username_acheteur,
  id_organisation_fournisseur, observations)
VALUES
  ('CMD-2026-002',
   'GIE Semences du Sine', 'ACCEPTEE', 'admin',
   (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU'),
   'Demande 3 000 kg R2 Mil Sanio Local — Allocation validée et en attente livraison')
ON CONFLICT (code_commande) DO NOTHING;

-- Ligne commande 1 (ARA R2 — 5 000 kg)
INSERT INTO ligne_commande (id_commande, id_variete, id_generation, quantite_demandee, unite)
SELECT c.id, v.id, g.id, 5000.00, 'kg'
FROM commande c, variete v, generation_semence g
WHERE c.code_commande = 'CMD-2026-001'
  AND v.code_variete   = 'ARA-12'
  AND g.code_generation = 'R2';

-- Ligne commande 2 (MIL R2 — 3 000 kg)
INSERT INTO ligne_commande (id_commande, id_variete, id_generation, quantite_demandee, unite)
SELECT c.id, v.id, g.id, 3000.00, 'kg'
FROM commande c, variete v, generation_semence g
WHERE c.code_commande = 'CMD-2026-002'
  AND v.code_variete   = 'MIL-SN'
  AND g.code_generation = 'R2';

-- Allocation CMD-2026-002 (commande ACCEPTEE → lot R2 MIL alloué)
INSERT INTO allocation_commande (id_ligne, id_lot, quantite_allouee)
SELECT lc.id, l.id, 3000.00
FROM ligne_commande lc
JOIN commande c ON c.id = lc.id_commande
JOIN lot_semencier l ON l.code_lot = 'SIM-R2-MIL-2026-001'
WHERE c.code_commande = 'CMD-2026-002';

-- ──────────────────────────────────────────────────────────────
-- 9. HISTORIQUE STATUTS (journal d'audit des changements de statut)
-- ──────────────────────────────────────────────────────────────

INSERT INTO historique_statut_lot (id_lot, ancien_statut, nouveau_statut, username, commentaire)
SELECT l.id, 'DISPONIBLE', 'TRANSFERE', 'selecteur_ara',
  'Transfert G1 Arachide Fleur 11 vers UPSemCL Bambey — réf. TL-ARA-G1-2026-001'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G1-ARA-2026-001';

INSERT INTO historique_statut_lot (id_lot, ancien_statut, nouveau_statut, username, commentaire)
SELECT l.id, 'DISPONIBLE', 'TRANSFERE', 'upsemcl_bambey',
  'Transfert G3 Arachide C1 vers Multiplicateur Sine-Saloum — réf. TL-ARA-G3-2026-001'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-ARA-2026-001';

INSERT INTO historique_statut_lot (id_lot, ancien_statut, nouveau_statut, username, commentaire)
SELECT l.id, 'DISPONIBLE', 'TRANSFERE', 'selecteur_mil',
  'Transfert G1 Mil Sanio Local vers UPSemCL National — réf. TL-MIL-G1-2026-001'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G1-MIL-2026-001';

INSERT INTO historique_statut_lot (id_lot, ancien_statut, nouveau_statut, username, commentaire)
SELECT l.id, 'DISPONIBLE', 'TRANSFERE', 'upsemcl',
  'Transfert G3 Mil C1 vers Multiplicateur Sine-Saloum — réf. TL-MIL-G3-2026-001'
FROM lot_semencier l WHERE l.code_lot = 'SIM-G3-MIL-2026-001';
