-- ============================================================
-- V11_1__varietes_niebe_manquantes.sql
-- Insère les variétés niébé référencées en V6/V9/V12
-- mais absentes de tout migration (existaient avant Flyway).
-- ON CONFLICT DO NOTHING garantit l'idempotence.
-- ============================================================

INSERT INTO variete (code_variete, nom_variete, id_espece, origine,
                     selectionneur_principal, annee_creation,
                     cycle_min, cycle_max, statut_variete)
SELECT v.code_variete, v.nom_variete, e.id,
       v.origine, v.selecteur, v.annee, v.cycle_min, v.cycle_max, 'DIFFUSEE'
FROM (VALUES
  ('NIE-MELAKH',   'Mélakh',   'ISRA/CNRA Bambey', 'Programme légumineuses ISRA', 1985, 58, 68),
  ('NIE-BAMBEY21', 'Bambey 21','ISRA/CNRA Bambey', 'Programme légumineuses ISRA', 1990, 62, 72),
  ('NIE-MOURIDE',  'Mouride',  'ISRA/CNRA Bambey', 'Sélection participative ISRA', 1995, 65, 75),
  ('NIE-YACINE',   'Yacine',   'ISRA/CNRA Bambey', 'Programme légumineuses ISRA', 2000, 62, 70)
) AS v(code_variete, nom_variete, origine, selecteur, annee, cycle_min, cycle_max)
JOIN espece e ON e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;
