-- ============================================================
-- V12__lots_nie_test.sql
-- Lots de test NIÉBÉ (NIE) pour selecteur_nie
-- G0 et G1 nécessaires : le sélectionneur ne voit que G0/G1
-- ============================================================

INSERT INTO lot_semencier
  (code_lot, id_variete, id_generation, date_production, quantite_nette, unite,
   taux_germination, purete_physique, statut_lot, code_espece, campagne,
   username_createur, created_at)
SELECT
  v.code_lot, v.id_variete, g.id, v.date_production::date, v.quantite_nette, 'kg',
  v.taux_germination, v.purete_physique, 'DISPONIBLE', 'NIE', '2024-2025',
  'selecteur_nie', NOW()
FROM (VALUES
  ('G0-NIE-MELAKH-2024',   (SELECT id FROM variete WHERE code_variete='NIE-MELAKH'   LIMIT 1), '2024-03-15', 120.00, 98.5, 99.2, 'G0'),
  ('G0-NIE-BAMBEY21-2024', (SELECT id FROM variete WHERE code_variete='NIE-BAMBEY21' LIMIT 1), '2024-03-10',  95.00, 99.0, 99.5, 'G0'),
  ('G1-NIE-MELAKH-2024',   (SELECT id FROM variete WHERE code_variete='NIE-MELAKH'   LIMIT 1), '2024-07-20', 350.00, 97.0, 98.5, 'G1'),
  ('G1-NIE-BAMBEY21-2024', (SELECT id FROM variete WHERE code_variete='NIE-BAMBEY21' LIMIT 1), '2024-08-05', 280.00, 96.5, 98.0, 'G1')
) AS v(code_lot, id_variete, date_production, quantite_nette, taux_germination, purete_physique, gen_code)
JOIN generation_semence g ON g.code_generation = v.gen_code
WHERE NOT EXISTS (
  SELECT 1 FROM lot_semencier WHERE code_lot = v.code_lot
);

-- Établir la filiation G0 → G1
UPDATE lot_semencier
SET id_lot_parent = (SELECT id FROM lot_semencier WHERE code_lot = 'G0-NIE-MELAKH-2024' LIMIT 1)
WHERE code_lot = 'G1-NIE-MELAKH-2024'
  AND id_lot_parent IS NULL;

UPDATE lot_semencier
SET id_lot_parent = (SELECT id FROM lot_semencier WHERE code_lot = 'G0-NIE-BAMBEY21-2024' LIMIT 1)
WHERE code_lot = 'G1-NIE-BAMBEY21-2024'
  AND id_lot_parent IS NULL;
