-- ============================================================
-- SEED DATA — Plateforme Semences ISRA
-- Adapté aux colonnes réelles de la base
-- ============================================================

-- ── ESPÈCES ──────────────────────────────────────────────────
INSERT INTO espece (code_espece, nom_commun, nom_scientifique) VALUES
  ('MIL',  'Mil',     'Pennisetum glaucum'),
  ('SOR',  'Sorgho',  'Sorghum bicolor'),
  ('MAI',  'Maïs',    'Zea mays'),
  ('RIZ',  'Riz',     'Oryza sativa'),
  ('BLE',  'Blé',     'Triticum aestivum'),
  ('SES',  'Sésame',  'Sesamum indicum'),
  ('NIE',  'Niébé',   'Vigna unguiculata'),
  ('SOJ',  'Soja',    'Glycine max'),
  ('FON',  'Fonio',   'Digitaria exilis')
ON CONFLICT (code_espece) DO NOTHING;

-- ── VARIÉTÉS MIL ─────────────────────────────────────────────
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete) VALUES
  ('MIL-SOUNA3',   'Souna III',    (SELECT id FROM espece WHERE code_espece='MIL'), 'ISRA-CNRA Bambey', 'Équipe sélection ISRA', 1975, 90,  'DIFFUSEE'),
  ('MIL-SOUNA11',  'Souna 11',     (SELECT id FROM espece WHERE code_espece='MIL'), 'ISRA-CNRA Bambey', 'Équipe sélection ISRA', 1990, 90,  'DIFFUSEE'),
  ('MIL-THIOU',    'Thiougane',    (SELECT id FROM espece WHERE code_espece='MIL'), 'ISRA-CNRA Bambey', 'Équipe sélection ISRA', 1985, 100, 'DIFFUSEE'),
  ('MIL-IBV8004',  'IBV 8004',     (SELECT id FROM espece WHERE code_espece='MIL'), 'ISRA',             'Sélection participative', 2005, 85, 'DIFFUSEE'),
  ('MIL-BASSI',    'Bassi',        (SELECT id FROM espece WHERE code_espece='MIL'), 'ISRA',             'Équipe sélection ISRA', 2010, 95,  'DIFFUSEE')
ON CONFLICT (code_variete) DO NOTHING;

-- ── VARIÉTÉS SORGHO ──────────────────────────────────────────
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete) VALUES
  ('SOR-CE145',    'CE 145-66',    (SELECT id FROM espece WHERE code_espece='SOR'), 'ISRA-CNRA Bambey', 'Équipe céréales ISRA',        1980, 100, 'DIFFUSEE'),
  ('SOR-FARAFARA', 'Farafara',     (SELECT id FROM espece WHERE code_espece='SOR'), 'ISRA',             'Programme sorgho ISRA',       1995, 110, 'DIFFUSEE'),
  ('SOR-SARIASO',  'Sariaso 14',   (SELECT id FROM espece WHERE code_espece='SOR'), 'ISRA/IER',         'Collaboration sous-régionale', 2002, 105, 'DIFFUSEE'),
  ('SOR-FRAMIDA',  'Framida',      (SELECT id FROM espece WHERE code_espece='SOR'), 'ISRA',             'Équipe amélioration',          1985, 95,  'DIFFUSEE')
ON CONFLICT (code_variete) DO NOTHING;

-- ── VARIÉTÉS MAÏS ────────────────────────────────────────────
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete) VALUES
  ('MAI-DK8031',   'DK 8031',      (SELECT id FROM espece WHERE code_espece='MAI'), 'ISRA/CIMMYT', 'Programme maïs ISRA',       2005, 90,  'DIFFUSEE'),
  ('MAI-ESPOIR',   'Espoir',       (SELECT id FROM espece WHERE code_espece='MAI'), 'ISRA',        'Équipe amélioration maïs',  2008, 95,  'DIFFUSEE'),
  ('MAI-INITIAL',  'Initial',      (SELECT id FROM espece WHERE code_espece='MAI'), 'ISRA/IER',    'Collaboration régionale',   2012, 85,  'DIFFUSEE'),
  ('MAI-MAMBA',    'Mamba',        (SELECT id FROM espece WHERE code_espece='MAI'), 'ISRA',        'Programme maïs',            2015, 100, 'EN_TEST')
ON CONFLICT (code_variete) DO NOTHING;

-- ── VARIÉTÉS RIZ ─────────────────────────────────────────────
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete) VALUES
  ('RIZ-SAHEL108', 'Sahel 108',    (SELECT id FROM espece WHERE code_espece='RIZ'), 'ISRA-SAED', 'Programme riz irrigué ISRA', 1995, 110, 'DIFFUSEE'),
  ('RIZ-SAHEL177', 'Sahel 177',    (SELECT id FROM espece WHERE code_espece='RIZ'), 'ISRA-SAED', 'Programme riz irrigué ISRA', 1998, 115, 'DIFFUSEE'),
  ('RIZ-WASSA',    'Wassa',        (SELECT id FROM espece WHERE code_espece='RIZ'), 'ISRA-DRDR', 'Amélioration participative', 2003, 120, 'DIFFUSEE'),
  ('RIZ-TOX728',   'TOX 728',      (SELECT id FROM espece WHERE code_espece='RIZ'), 'ISRA/WARDA','Collaboration WARDA',        2000, 105, 'DIFFUSEE')
ON CONFLICT (code_variete) DO NOTHING;

-- ── VARIÉTÉS ARACHIDE ────────────────────────────────────────
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete) VALUES
  ('ARA-FLEUR11',  'Fleur 11',     (SELECT id FROM espece WHERE code_espece='ARA'), 'ISRA-CNRA Bambey', 'Programme arachide ISRA', 1983, 90,  'DIFFUSEE'),
  ('ARA-55437',    '55-437',       (SELECT id FROM espece WHERE code_espece='ARA'), 'ISRA-CNRA Bambey', 'Équipe arachide ISRA',    1975, 90,  'DIFFUSEE'),
  ('ARA-GH119',    'GH 119-20',    (SELECT id FROM espece WHERE code_espece='ARA'), 'ISRA',             'Programme huilerie',       2000, 100, 'DIFFUSEE'),
  ('ARA-CHICO',    'Chico',        (SELECT id FROM espece WHERE code_espece='ARA'), 'ISRA/ICRISAT',     'Collaboration ICRISAT',    1998, 85,  'DIFFUSEE')
ON CONFLICT (code_variete) DO NOTHING;

-- ── VARIÉTÉS NIÉBÉ ───────────────────────────────────────────
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete) VALUES
  ('NIE-MELAKH',   'Mélakh',       (SELECT id FROM espece WHERE code_espece='NIE'), 'ISRA-CNRA Bambey', 'Programme niébé ISRA',   1985, 60, 'DIFFUSEE'),
  ('NIE-MOURIDE',  'Mouride',      (SELECT id FROM espece WHERE code_espece='NIE'), 'ISRA',             'Sélection participative', 1990, 65, 'DIFFUSEE'),
  ('NIE-YACINE',   'Yacine',       (SELECT id FROM espece WHERE code_espece='NIE'), 'ISRA',             'Programme légumineuses',   2005, 70, 'DIFFUSEE'),
  ('NIE-BAMBEY21', 'Bambey 21',    (SELECT id FROM espece WHERE code_espece='NIE'), 'ISRA-CNRA Bambey', 'Équipe légumineuses',      1978, 75, 'DIFFUSEE')
ON CONFLICT (code_variete) DO NOTHING;

-- ── VARIÉTÉS SÉSAME & FONIO ──────────────────────────────────
INSERT INTO variete (code_variete, nom_variete, id_espece, origine, selectionneur_principal, annee_creation, cycle_jours, statut_variete) VALUES
  ('SES-ISRA1',    'ISRA Sésame 1',        (SELECT id FROM espece WHERE code_espece='SES'), 'ISRA', 'Programme oléagineux',   2008, 90, 'DIFFUSEE'),
  ('SES-GOUDAS',   'Goudas',               (SELECT id FROM espece WHERE code_espece='SES'), 'ISRA', 'Sélection locale',       2010, 85, 'EN_TEST'),
  ('FON-LOCAL1',   'Fonio Local Casamance',(SELECT id FROM espece WHERE code_espece='FON'), 'ISRA-DRDR Ziguinchor', 'Cultures locales', 2012, 80, 'DIFFUSEE')
ON CONFLICT (code_variete) DO NOTHING;

-- ── SITES ─────────────────────────────────────────────────────
INSERT INTO site (code_site, nom_site, type_site, localite, region) VALUES
  ('CNRA-BAMBEY',   'CNRA Bambey',                    'STATION_RECHERCHE', 'Bambey',      'Diourbel'),
  ('ISRA-KAOLACK',  'Station ISRA Kaolack',           'STATION_RECHERCHE', 'Kaolack',     'Kaolack'),
  ('MAG-KAOLACK',   'Magasin Kaolack',                'MAGASIN',           'Kaolack',     'Kaolack'),
  ('MAG-ZIGUINCH',  'Magasin Ziguinchor',             'MAGASIN',           'Ziguinchor',  'Ziguinchor'),
  ('MAG-STLOUIS',   'Magasin Saint-Louis',            'MAGASIN',           'Saint-Louis', 'Saint-Louis'),
  ('FERME-MULTI-02','Ferme Multiplicateur Casamance',  'FERME',             'Bignona',     'Ziguinchor'),
  ('FERME-MULTI-03','Ferme Multiplicateur Sine-Saloum','FERME',             'Nioro du Rip','Kaolack'),
  ('SAED-PODOR',    'Station SAED Podor',             'STATION_RECHERCHE', 'Podor',       'Saint-Louis')
ON CONFLICT (code_site) DO NOTHING;

-- ── LOTS G0 ───────────────────────────────────────────────────
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, date_production, quantite_nette, unite, taux_germination, purete_physique, statut_lot) VALUES
  ('G0-MIL-SOUNA3-2024',  (SELECT id FROM variete WHERE code_variete='MIL-SOUNA3'),  (SELECT id FROM generation_semence WHERE code_generation='G0'), '2024-06-15', 48.5,  'kg', 98.5, 99.5, 'DISPONIBLE'),
  ('G0-SOR-CE145-2024',   (SELECT id FROM variete WHERE code_variete='SOR-CE145'),   (SELECT id FROM generation_semence WHERE code_generation='G0'), '2024-06-20', 44.0,  'kg', 97.0, 99.0, 'DISPONIBLE'),
  ('G0-MAI-DK8031-2024',  (SELECT id FROM variete WHERE code_variete='MAI-DK8031'),  (SELECT id FROM generation_semence WHERE code_generation='G0'), '2024-05-10', 78.0,  'kg', 96.0, 99.0, 'DISPONIBLE'),
  ('G0-ARA-FLEUR11-2024', (SELECT id FROM variete WHERE code_variete='ARA-FLEUR11'), (SELECT id FROM generation_semence WHERE code_generation='G0'), '2024-04-05', 58.5,  'kg', 98.0, 99.5, 'DISPONIBLE'),
  ('G0-RIZ-SAHEL108-2024',(SELECT id FROM variete WHERE code_variete='RIZ-SAHEL108'),(SELECT id FROM generation_semence WHERE code_generation='G0'), '2024-05-20', 35.0,  'kg', 97.5, 99.0, 'DISPONIBLE')
ON CONFLICT (code_lot) DO NOTHING;

-- ── LOTS G1 ───────────────────────────────────────────────────
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, date_production, quantite_nette, unite, taux_germination, purete_physique, statut_lot) VALUES
  ('G1-MIL-SOUNA3-2024',   (SELECT id FROM variete WHERE code_variete='MIL-SOUNA3'),  (SELECT id FROM generation_semence WHERE code_generation='G1'), (SELECT id FROM lot_semencier WHERE code_lot='G0-MIL-SOUNA3-2024'),  '2024-10-15', 490.0,  'kg', 97.5, 98.5, 'DISPONIBLE'),
  ('G1-SOR-CE145-2024',    (SELECT id FROM variete WHERE code_variete='SOR-CE145'),   (SELECT id FROM generation_semence WHERE code_generation='G1'), (SELECT id FROM lot_semencier WHERE code_lot='G0-SOR-CE145-2024'),   '2024-10-20', 392.0,  'kg', 96.0, 98.0, 'DISPONIBLE'),
  ('G1-ARA-FLEUR11-2024',  (SELECT id FROM variete WHERE code_variete='ARA-FLEUR11'), (SELECT id FROM generation_semence WHERE code_generation='G1'), (SELECT id FROM lot_semencier WHERE code_lot='G0-ARA-FLEUR11-2024'), '2024-09-10', 588.0,  'kg', 97.0, 99.0, 'DISPONIBLE'),
  ('G1-MAI-DK8031-2024',   (SELECT id FROM variete WHERE code_variete='MAI-DK8031'),  (SELECT id FROM generation_semence WHERE code_generation='G1'), (SELECT id FROM lot_semencier WHERE code_lot='G0-MAI-DK8031-2024'),  '2024-11-01', 750.0,  'kg', 96.5, 98.5, 'DISPONIBLE'),
  ('G1-RIZ-SAHEL108-2024', (SELECT id FROM variete WHERE code_variete='RIZ-SAHEL108'),(SELECT id FROM generation_semence WHERE code_generation='G1'), (SELECT id FROM lot_semencier WHERE code_lot='G0-RIZ-SAHEL108-2024'),'2024-11-10', 320.0,  'kg', 97.0, 98.0, 'DISPONIBLE')
ON CONFLICT (code_lot) DO NOTHING;

-- ── LOTS G2 ───────────────────────────────────────────────────
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, date_production, quantite_nette, unite, taux_germination, purete_physique, statut_lot) VALUES
  ('G2-MIL-SOUNA3-2025',   (SELECT id FROM variete WHERE code_variete='MIL-SOUNA3'),  (SELECT id FROM generation_semence WHERE code_generation='G2'), (SELECT id FROM lot_semencier WHERE code_lot='G1-MIL-SOUNA3-2024'),  '2025-03-15', 4400.0,  'kg', 96.0, 97.5, 'DISPONIBLE'),
  ('G2-SOR-CE145-2025',    (SELECT id FROM variete WHERE code_variete='SOR-CE145'),   (SELECT id FROM generation_semence WHERE code_generation='G2'), (SELECT id FROM lot_semencier WHERE code_lot='G1-SOR-CE145-2024'),   '2025-03-20', 3420.0,  'kg', 95.5, 97.0, 'DISPONIBLE'),
  ('G2-ARA-FLEUR11-2025',  (SELECT id FROM variete WHERE code_variete='ARA-FLEUR11'), (SELECT id FROM generation_semence WHERE code_generation='G2'), (SELECT id FROM lot_semencier WHERE code_lot='G1-ARA-FLEUR11-2024'), '2025-02-10', 4880.0,  'kg', 96.5, 98.0, 'DISPONIBLE'),
  ('G2-MAI-DK8031-2025',   (SELECT id FROM variete WHERE code_variete='MAI-DK8031'),  (SELECT id FROM generation_semence WHERE code_generation='G2'), (SELECT id FROM lot_semencier WHERE code_lot='G1-MAI-DK8031-2024'),  '2025-04-01', 6800.0,  'kg', 95.0, 97.0, 'DISPONIBLE')
ON CONFLICT (code_lot) DO NOTHING;

-- ── LOTS G3 ───────────────────────────────────────────────────
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, date_production, quantite_nette, unite, taux_germination, purete_physique, statut_lot) VALUES
  ('G3-MIL-SOUNA3-2025',   (SELECT id FROM variete WHERE code_variete='MIL-SOUNA3'),  (SELECT id FROM generation_semence WHERE code_generation='G3'), (SELECT id FROM lot_semencier WHERE code_lot='G2-MIL-SOUNA3-2025'),  '2025-08-10', 11760.0, 'kg', 95.0, 96.5, 'DISPONIBLE'),
  ('G3-ARA-FLEUR11-2025',  (SELECT id FROM variete WHERE code_variete='ARA-FLEUR11'), (SELECT id FROM generation_semence WHERE code_generation='G3'), (SELECT id FROM lot_semencier WHERE code_lot='G2-ARA-FLEUR11-2025'), '2025-08-20', 14700.0, 'kg', 95.5, 97.0, 'DISPONIBLE'),
  ('G3-MAI-DK8031-2025',   (SELECT id FROM variete WHERE code_variete='MAI-DK8031'),  (SELECT id FROM generation_semence WHERE code_generation='G3'), (SELECT id FROM lot_semencier WHERE code_lot='G2-MAI-DK8031-2025'),  '2025-09-01', 28000.0, 'kg', 94.5, 96.0, 'DISPONIBLE')
ON CONFLICT (code_lot) DO NOTHING;

-- ── LOTS R1 ───────────────────────────────────────────────────
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, date_production, quantite_nette, unite, taux_germination, purete_physique, statut_lot) VALUES
  ('R1-MIL-SOUNA3-2025',   (SELECT id FROM variete WHERE code_variete='MIL-SOUNA3'),  (SELECT id FROM generation_semence WHERE code_generation='R1'), (SELECT id FROM lot_semencier WHERE code_lot='G3-MIL-SOUNA3-2025'),  '2025-11-05', 44100.0,  'kg', 93.0, 95.5, 'DISPONIBLE'),
  ('R1-ARA-FLEUR11-2025',  (SELECT id FROM variete WHERE code_variete='ARA-FLEUR11'), (SELECT id FROM generation_semence WHERE code_generation='R1'), (SELECT id FROM lot_semencier WHERE code_lot='G3-ARA-FLEUR11-2025'), '2025-11-15', 53900.0,  'kg', 93.5, 96.0, 'DISPONIBLE'),
  ('R1-MAI-DK8031-2025',   (SELECT id FROM variete WHERE code_variete='MAI-DK8031'),  (SELECT id FROM generation_semence WHERE code_generation='R1'), (SELECT id FROM lot_semencier WHERE code_lot='G3-MAI-DK8031-2025'),  '2025-12-01', 105000.0, 'kg', 92.5, 95.0, 'DISPONIBLE')
ON CONFLICT (code_lot) DO NOTHING;

-- ── LOTS R2 (vendables aux quotataires) ───────────────────────
INSERT INTO lot_semencier (code_lot, id_variete, id_generation, id_lot_parent, date_production, quantite_nette, unite, taux_germination, purete_physique, statut_lot) VALUES
  ('R2-MIL-SOUNA3-2026',   (SELECT id FROM variete WHERE code_variete='MIL-SOUNA3'),  (SELECT id FROM generation_semence WHERE code_generation='R2'), (SELECT id FROM lot_semencier WHERE code_lot='R1-MIL-SOUNA3-2025'),  '2026-01-15', 147000.0, 'kg', 92.0, 95.0, 'DISPONIBLE'),
  ('R2-ARA-FLEUR11-2026',  (SELECT id FROM variete WHERE code_variete='ARA-FLEUR11'), (SELECT id FROM generation_semence WHERE code_generation='R2'), (SELECT id FROM lot_semencier WHERE code_lot='R1-ARA-FLEUR11-2025'), '2026-01-20', 176400.0, 'kg', 92.5, 95.5, 'DISPONIBLE'),
  ('R2-MAI-DK8031-2026',   (SELECT id FROM variete WHERE code_variete='MAI-DK8031'),  (SELECT id FROM generation_semence WHERE code_generation='R2'), (SELECT id FROM lot_semencier WHERE code_lot='R1-MAI-DK8031-2025'),  '2026-02-01', 390000.0, 'kg', 91.5, 94.5, 'DISPONIBLE'),
  ('R2-SOR-CE145-2026',    (SELECT id FROM variete WHERE code_variete='SOR-CE145'),   (SELECT id FROM generation_semence WHERE code_generation='R2'), NULL,                                                                  '2026-02-10', 78400.0,  'kg', 91.0, 94.0, 'DISPONIBLE'),
  ('R2-NIE-MELAKH-2026',   (SELECT id FROM variete WHERE code_variete='NIE-MELAKH'),  (SELECT id FROM generation_semence WHERE code_generation='R2'), NULL,                                                                  '2026-02-15', 42000.0,  'kg', 93.0, 96.0, 'DISPONIBLE')
ON CONFLICT (code_lot) DO NOTHING;

-- ── STOCKS ────────────────────────────────────────────────────
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite) VALUES
  ((SELECT id FROM lot_semencier WHERE code_lot='R2-MIL-SOUNA3-2026'),   (SELECT id FROM site WHERE code_site='MAG-THIES'),    120000.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='R2-ARA-FLEUR11-2026'),  (SELECT id FROM site WHERE code_site='MAG-KAOLACK'),  155000.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='R2-MAI-DK8031-2026'),   (SELECT id FROM site WHERE code_site='MAG-KAOLACK'),   85000.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='R2-SOR-CE145-2026'),    (SELECT id FROM site WHERE code_site='MAG-KAOLACK'),   65000.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='R2-NIE-MELAKH-2026'),   (SELECT id FROM site WHERE code_site='MAG-ZIGUINCH'),  42000.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='G3-MIL-SOUNA3-2025'),   (SELECT id FROM site WHERE code_site='FERME-MULTI-02'), 9500.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='G3-ARA-FLEUR11-2025'),  (SELECT id FROM site WHERE code_site='FERME-MULTI-03'),12000.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='G2-MIL-SOUNA3-2025'),   (SELECT id FROM site WHERE code_site='MAG-KAOLACK'),   3200.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='G1-MIL-SOUNA3-2024'),   (SELECT id FROM site WHERE code_site='ISRA-KAOLACK'),   490.0, 'kg'),
  ((SELECT id FROM lot_semencier WHERE code_lot='R2-MIL-SOUNA3-2026'),   (SELECT id FROM site WHERE code_site='MAG-STLOUIS'),   27000.0, 'kg')
ON CONFLICT (id_lot, id_site) DO NOTHING;

-- ── VÉRIFICATION ─────────────────────────────────────────────
SELECT 'espece' as table_name, COUNT(*) FROM espece
UNION ALL SELECT 'variete', COUNT(*) FROM variete
UNION ALL SELECT 'site', COUNT(*) FROM site
UNION ALL SELECT 'lot_semencier', COUNT(*) FROM lot_semencier
UNION ALL SELECT 'stock', COUNT(*) FROM stock;
