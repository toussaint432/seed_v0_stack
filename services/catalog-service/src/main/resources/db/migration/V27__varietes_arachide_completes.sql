-- V27 : Nettoyage ARA-CHICO (hors catalogue officiel) + 22 variétés d'Arachide manquantes
-- Espèce ARA (id=1), statut DIFFUSEE par défaut

-- ── Suppression de ARA-CHICO (variété hors catalogue officiel ISRA/CNRA) ──
-- Ordre : historique_statut_lot → mouvement_stock → stock → transfert_lot → lot_semencier → variete
DO $$
DECLARE chico_id BIGINT;
BEGIN
  SELECT id INTO chico_id FROM variete WHERE code_variete = 'ARA-CHICO';
  IF chico_id IS NOT NULL THEN
    DELETE FROM historique_statut_lot WHERE id_lot IN (SELECT id FROM lot_semencier WHERE id_variete = chico_id);
    DELETE FROM mouvement_stock        WHERE id_lot IN (SELECT id FROM lot_semencier WHERE id_variete = chico_id);
    DELETE FROM stock                  WHERE id_lot IN (SELECT id FROM lot_semencier WHERE id_variete = chico_id);
    DELETE FROM transfert_lot          WHERE id_lot IN (SELECT id FROM lot_semencier WHERE id_variete = chico_id);
    DELETE FROM lot_semencier          WHERE id_variete = chico_id;
    DELETE FROM variete                WHERE id = chico_id;
  END IF;
END $$;

INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal,
                     annee_creation, cycle_min, cycle_max, pedigree, type_grain,
                     rendement_min, rendement_max, statut_variete, date_creation)
VALUES

-- ── Variétés historiques IRHO ────────────────────────────────────────────
('ARA-28206',   '28-206',     1, 'Bambey, Sénégal',      'IRHO',       1928, 120, 120,
 'Population de Bamako',                                           'Virginia', 1.5, 2.5, 'DIFFUSEE', NOW()),

('ARA-57313',   '57-313',     1, 'Bambey, Sénégal',      'IRHO',       1957, 125, 125,
 'Population de Ouagadougou',                                      'Virginia', 1.5, 2.5, 'DIFFUSEE', NOW()),

('ARA-57422',   '57-422',     1, 'Bambey, Sénégal',      'IRHO',       1957, 105, 110,
 'Population C 334-3-404 de Tifton, USA',                          'Virginia', 2.5, 2.5, 'DIFFUSEE', NOW()),

('ARA-69101',   '69-101',     1, 'Bambey, Sénégal',      'IRHO',       1969, 125, 125,
 '55-455 X 28-206 /// 28-206',                                     'Virginia', 1.5, 2.5, 'DIFFUSEE', NOW()),

('ARA-756A',    '756-A',      1, 'Bambey, Sénégal',      'IRHO',       1951, 125, 125,
 'Population locale de Casamance',                                 'Virginia', NULL, NULL,'DIFFUSEE', NOW()),

-- ── Série 73-xx IRHO-ISRA ───────────────────────────────────────────────
('ARA-7327',    '73-27',      1, 'Nioro, Sénégal',        'IRHO-ISRA',  1973, 120, 125,
 '756 A x GH 119-20',                                              'Virginia', 1.5, 2.0, 'DIFFUSEE', NOW()),

('ARA-7328',    '73-28',      1, 'Bambey, Sénégal',       'IRHO-ISRA',  1973, 120, 125,
 '756 A x GH 119-20',                                              'Virginia', 1.5, 2.0, 'DIFFUSEE', NOW()),

('ARA-7330',    '73-30',      1, 'Bambey, Sénégal',       'ISRA-IRHO',  1973,  95,  95,
 '61-24 x 59-127',                                                 'Spanish',  1.5, 2.0, 'DIFFUSEE', NOW()),

('ARA-7333',    '73-33',      1, 'Nioro, Sénégal',        'IRHO-ISRA',  1973, 105, 110,
 '58-560 x 59-49',                                                 'Virginia', 2.0, 2.5, 'DIFFUSEE', NOW()),

-- ── Série 78-xx ─────────────────────────────────────────────────────────
('ARA-78936',   '78-936',     1, 'Bambey, Sénégal',       'ISRA',       NULL,  75,  75,
 'Variété d''origine chinoise',                                    'Spanish',  2.0, 3.5, 'DIFFUSEE', NOW()),

('ARA-78937',   '78-937',     1, 'Chine',                 NULL,         NULL,  75,  75,
 NULL,                                                             'Spanish',  2.0, 2.0, 'DIFFUSEE', NOW()),

-- ── Variétés ISRA-CIRAD (sélection récurrente) ──────────────────────────
('ARA-5533',    '55-33',      1, 'Bambey, Sénégal',       'ISRA-CIRAD', 1991,  80,  80,
 '[55-437 x Chico] ////55-437 (BC4)',                              'Spanish',  2.0, 2.0, 'DIFFUSEE', NOW()),

('ARA-73911',   '73-9-11',    1, 'Bambey, Sénégal',       'ISRA-CIRAD', 1991,  80,  80,
 '(73-30 x Chico) /////73-30',                                     'Spanish',  3.0, 4.0, 'DIFFUSEE', NOW()),

('ARA-GC835',   'GC 8-35',   1, 'Bambey, Sénégal',       'ISRA-CIRAD', 1990,  80,  80,
 '55-435 x Chico',                                                 'Spanish',  1.5, 1.5, 'DIFFUSEE', NOW()),

('ARA-SRV119',  'SRV 1-19',  1, 'Bambey, Sénégal',       'ISRA-CIRAD', 1990,  90,  90,
 'Sélection récurrente pyramidale avec huit géniteurs',            'hybride',  2.0, 2.0, 'DIFFUSEE', NOW()),

-- ── Variétés ISRA seul ──────────────────────────────────────────────────
('ARA-H750',    'H 75-0',    1, 'Bambey, Sénégal',       'ISRA',       1994, 120, 120,
 'GH 119-20 x 57-422',                                             'Virginia', 2.0, 4.0, 'DIFFUSEE', NOW()),

('ARA-PC7979',  'PC 79-79',  1, 'Bambey, Sénégal',       'ISRA',       1994, 120, 120,
 '53-68 x 59-127',                                                 'Virginia', 2.5, 2.5, 'DIFFUSEE', NOW()),

-- ── Nouvelles variétés ISRA-CIRAD (série ISAR) ──────────────────────────
('ARA-RAWGADU',    'Raw Gadu',    1, 'Bambey, Sénégal', 'ISRA-CIRAD', NULL, 90, 90,
 'Fleur 11 x (AixAd)/BC4F7; Backcross assisté de marqueurs moléculaires',
 'Spanish',  2.5, 2.5, 'DIFFUSEE', NOW()),

('ARA-RAFEETCAR',  'Rafeet Car',  1, 'Bambey, Sénégal', 'ISRA-CIRAD', NULL, 90, 90,
 'Fleur 11 x (AixAd)/BC4F7; Backcross assisté de marqueurs moléculaires',
 'Spanish',  2.5, 3.5, 'DIFFUSEE', NOW()),

('ARA-TOSSET',     'Tosset',      1, 'Bambey, Sénégal', 'ISRA-CIRAD', NULL, 90, 90,
 'Fleur 11 x (AixAd)/BC4F7; Backcross assisté de marqueurs moléculaires',
 'Spanish',  2.5, 2.5, 'DIFFUSEE', NOW()),

('ARA-KOMKOM',     'Kom Kom',     1, 'Bambey, Sénégal', 'ISRA-CIRAD', NULL, 90, 90,
 'Fleur 11 x (AixAd)/BC4F7; Backcross assisté de marqueurs moléculaires',
 'Spanish',  2.5, 2.5, 'DIFFUSEE', NOW()),

('ARA-AMOULMOROM', 'Amoul Morom', 1, 'Caroline du Nord, USA', 'ISRA-CIRAD', NULL, 120, 120,
 'NC Ac 10811 (Backcross assisté de marqueurs moléculaires)',
 'Virginia', 2.5, 2.5, 'DIFFUSEE', NOW())

ON CONFLICT (code_variete) DO NOTHING;
