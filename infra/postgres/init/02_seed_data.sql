-- 02_seed_data.sql
INSERT INTO espece(code_espece, nom_commun, nom_scientifique)
VALUES ('ARA', 'Arachide', 'Arachis hypogaea')
ON CONFLICT DO NOTHING;

INSERT INTO generation_semence(code_generation, ordre_generation) VALUES
('G0', 0), ('G1', 1), ('G2', 2), ('G3', 3), ('G4', 4), ('R1', 5), ('R2', 6)
ON CONFLICT DO NOTHING;

INSERT INTO variete(code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours)
SELECT 'ARA-12', 'Fleur 11', e.id, 'ISRA', 'Equipe selection', 2019, 90
FROM espece e WHERE e.code_espece='ARA'
ON CONFLICT DO NOTHING;

INSERT INTO site(code_site, nom_site, type_site, localite, region) VALUES
('MAG-THIES', 'Magasin Thiès', 'MAGASIN', 'Thiès', 'Thiès'),
('FERME-MULTI-01', 'Ferme Multiplicateur 01', 'FERME', 'Tivaouane', 'Thiès')
ON CONFLICT DO NOTHING;

-- Lot G0 initial
INSERT INTO lot_semencier(code_lot, id_variete, id_generation, id_lot_parent, campagne, date_production, quantite_nette, unite, taux_germination, purete_physique, statut_lot)
SELECT
  'LOT-ARA12-G0-2026-001',
  v.id,
  g.id,
  NULL,
  'HIV-2026',
  '2026-10-15',
  40,
  'kg',
  95.0,
  99.0,
  'DISPONIBLE'
FROM variete v, generation_semence g
WHERE v.code_variete='ARA-12' AND g.code_generation='G0'
ON CONFLICT DO NOTHING;

-- Stock initial du lot G0 au magasin
INSERT INTO stock(id_lot, id_site, quantite_disponible, unite)
SELECT l.id, s.id, 40, 'kg'
FROM lot_semencier l, site s
WHERE l.code_lot='LOT-ARA12-G0-2026-001' AND s.code_site='MAG-THIES'
ON CONFLICT DO NOTHING;
