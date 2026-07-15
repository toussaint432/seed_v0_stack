-- ============================================================
-- V31 : Ajout des 50 variétés de Riz manquantes — catalogue officiel ISRA/CNRA Sénégal
-- Source   : 61 fiches variétales officielles ISRA/CNRA (homologations 1970–2009)
-- Existant : 11 variétés déjà en base (ISRIZ1/5/10, NERICA1/4/8, SAHEL108/177/200, TOX728, WASSA)
-- Ajoutés  : 50 variétés manquantes, statut DIFFUSEE (homologuées)
--
-- Groupes :
--   1. Introductions historiques IRRI/IRAT (1970–1994)
--   2. Série Djibélor — ISRA-IRAT Casamance (1972/1994)
--   3. Introductions sub-submergé et mangrove (1994/1997)
--   4. WARDA/WAR — culture mangrove Casamance (1997)
--   5. ISRIZ 2–9, 11–15 — série ISRA/CNRA Bambey
--   6. Variétés Japonica pluviales (homologation 2009)
--   7. NERICA pluvial (Oryza glaberrima × O. sativa, 2009)
--   8. Nerica-S irrigué — Vallée du Fleuve (2009)
--   9. Sahel 201–202 — Vallée du Fleuve (1994)
--  10. Sahel 134/159/208–210 — Vallée du Fleuve (2007)
--  11. Série Sahel 217–329 — Vallée du Fleuve (2009)
-- ============================================================

DO $$
DECLARE riz_id BIGINT;
BEGIN
  SELECT id INTO riz_id FROM espece WHERE code_espece = 'RIZ';
  IF riz_id IS NULL THEN
    RAISE EXCEPTION 'Espèce RIZ introuvable — vérifier que la migration V2 a bien été appliquée';
  END IF;

  INSERT INTO variete (
    code_variete, nom_variete, id_espece,
    origine, selectionneur_principal,
    annee_creation, cycle_min, cycle_max,
    pedigree, type_grain,
    rendement_min, rendement_max,
    statut_variete, date_creation
  ) VALUES

  -- ════════════════════════════════════════════════════════════
  -- 1. INTRODUCTIONS HISTORIQUES — IRRI Philippines (1970–1994)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-IR8',
   'IR 8',
   riz_id,
   'Los Baños, Philippines',
   'IRRI',
   1970, 125, 145,
   'Peta × Dee-Geo-Woo-Gen',
   'Grain long (Indica)',
   7.0, 8.0, 'DIFFUSEE', NOW()),

  ('RIZ-IR442',
   'IR 442',
   riz_id,
   'Los Baños, Philippines',
   'IRRI',
   1972, 120, 130,
   'Peta 2 / Taïchung Native 1',
   'Grain long (Indica)',
   5.5, 8.0, 'DIFFUSEE', NOW()),

  ('RIZ-IR1529680',
   'IR 1529-680-3',
   riz_id,
   'Los Baños, Philippines',
   'IRRI',
   1971, 125, 130,
   'Segadis 2 / Taïchung Native 1 × IR24',
   'Grain long (Indica)',
   5.0, 9.0, 'DIFFUSEE', NOW()),

  ('RIZ-JAYA',
   'Jaya',
   riz_id,
   'Inde',
   'IARI New Delhi',
   1970, 120, 140,
   'Taïchung Native 1 × 141',
   'Grain long (Indica)',
   7.0, 8.0, 'DIFFUSEE', NOW()),

  ('RIZ-IKONGPAO',
   'Ikong Pao',
   riz_id,
   'Taïwan',
   'TARI Taïwan / ISRA',
   1994, 75, 120,
   'Dee Geo Wos Gen / Tall',
   'Grain long (Indica)',
   5.5, 8.0, 'DIFFUSEE', NOW()),

  ('RIZ-IRAT10',
   'IRAT 10',
   riz_id,
   'Bouaké, Côte d''Ivoire',
   'IRAT',
   1974, 95, 105,
   'Lung Sheng 1 × 63-104',
   'Grain long (Indica)',
   5.0, 5.5, 'DIFFUSEE', NOW()),

  ('RIZ-KH998',
   'KH 998',
   riz_id,
   'Sénégal (introduction)',
   'ISRA',
   1994, 120, 134,
   'Lignée pure sélectionnée',
   'Grain long (Indica)',
   4.0, 8.5, 'DIFFUSEE', NOW()),

  ('RIZ-KWANSHESHUNG',
   'Kwan She Shung',
   riz_id,
   'Chine',
   'CAAS Chine / ISRA',
   1994, 100, 110,
   'Sélection chinoise — introduction Sénégal',
   'Grain long (Indica)',
   7.0, 8.0, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 2. SÉRIE DJIBÉLOR — ISRA-IRAT (Casamance, homologation 1994)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-DJ8341',
   'Dj 8-341',
   riz_id,
   'Djibélor, Sénégal',
   'ISRA-IRAT',
   1972, 95, 105,
   'H4 × Se 322G — culture nappe et bas-fond Casamance',
   'Grain long (Indica)',
   3.5, 4.0, 'DIFFUSEE', NOW()),

  ('RIZ-DJ11509',
   'Dj 11-509',
   riz_id,
   'Djibélor, Sénégal',
   'ISRA-IRAT',
   1972, 95, 105,
   'H4 × Se 288-D — culture pluviale sud Sénégal',
   'Grain long (Indica)',
   4.0, 4.5, 'DIFFUSEE', NOW()),

  ('RIZ-DJ12519',
   'Dj 12-519',
   riz_id,
   'Djibélor, Sénégal',
   'IRAT',
   1972, 100, 110,
   'D 254 × Se 288D — culture pluviale Casamance',
   'Grain long (Indica)',
   4.0, 4.5, 'DIFFUSEE', NOW()),

  ('RIZ-DJ684D',
   'Dj 684-D',
   riz_id,
   'Djibélor, Sénégal',
   'IRAT',
   1970, 120, 125,
   'Taïchung Native 1 × Ebandioulaye — culture irriguée et submergée',
   'Grain long (Indica)',
   4.0, 6.5, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 3. INTRODUCTIONS SUBMERGÉES (homologation 1997)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-BG902',
   'BG 90-2',
   riz_id,
   'Sri Lanka',
   'ISRA / Sri Lanka',
   1997, 120, 125,
   'Peta 3 × TN1 / Remadja — Lignée pure, culture submergée sud Sénégal',
   'Grain long fusiforme (Indica)',
   6.0, 8.5, 'DIFFUSEE', NOW()),

  ('RIZ-BR51465',
   'BR 51-46-5',
   riz_id,
   'Bangladesh',
   'BRRI Bangladesh / ISRA',
   1997, 120, 125,
   'IR 20 / IR 5-114-3-2',
   'Grain long fusiforme (Indica)',
   5.0, 7.0, 'DIFFUSEE', NOW()),

  ('RIZ-BW2481',
   'BW 248-1',
   riz_id,
   'Sri Lanka',
   'IRRI / ISRA',
   1997, 125, 130,
   'Sélection Sri Lanka — introduction ISRA Sénégal',
   'Grain long (Indica)',
   4.5, 6.0, 'DIFFUSEE', NOW()),

  ('RIZ-ITA123',
   'ITA 123',
   riz_id,
   'Ibadan, Nigeria',
   'IITA',
   1997, 120, 130,
   'Mutant de OS-6 — culture submergée sud Sénégal',
   'Grain long (Indica)',
   6.0, 7.0, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 4. VARIÉTÉS WARDA/WAR — Mangrove (Sierra Leone/Casamance, 1997)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-ROK5',
   'Rok 5',
   riz_id,
   'Rokupr, Sierra Leone',
   'WARDA',
   1997, 130, 150,
   'SR 26 / Wellington — semi-flottant, mangrove Casamance et Fatick',
   'Grain long (Indica)',
   4.0, 5.0, 'DIFFUSEE', NOW()),

  ('RIZ-WAR1',
   'WAR 1',
   riz_id,
   'Rokupr, Sierra Leone',
   'WARDA',
   1997, 130, 140,
   'IR 4595-4-1-5 / Pa Fant 213 — culture mangrove Casamance',
   'Grain long (Indica)',
   3.5, 4.0, 'DIFFUSEE', NOW()),

  ('RIZ-WAR77322',
   'WAR 77-3-2-2',
   riz_id,
   'Rokupr, Sierra Leone',
   'WARDA',
   1997, 135, 145,
   'IR 4595-4-1-5 / Pa Fant 213 — culture mangrove Casamance',
   'Grain long (Indica)',
   2.0, 3.0, 'DIFFUSEE', NOW()),

  ('RIZ-WAR812132',
   'WAR 81-2-1-3-2',
   riz_id,
   'Rokupr, Sierra Leone',
   'WARDA',
   1997, 135, 145,
   'Miniku 33A / Bayer Putih 462-10 — culture mangrove Casamance',
   'Grain long (Indica)',
   2.0, 2.5, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 5. SÉRIE ISRIZ — ISRA/CNRA Bambey (ISRIZ 2–9 et 11–15)
  --    ISRIZ 1, 5, 10 déjà présents en base — omis ici
  -- ════════════════════════════════════════════════════════════

  ('RIZ-ISRIZ2',
   'ISRIZ 2',
   riz_id,
   'Djibélor / Bambey, Sénégal',
   'ISRA/CNRA Bambey',
   NULL, 90, 110,
   'ISRIZ-J4-145 — sélection ISRA, double saison',
   'Grain long (Indica)',
   10.0, 12.0, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ3',
   'ISRIZ 3',
   riz_id,
   'Djibélor / Bambey, Sénégal',
   'ISRA/CNRA Bambey',
   NULL, 92, 120,
   'ISRIZ-J3-128 — sélection ISRA',
   'Grain long (Indica)',
   11.0, 13.5, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ4',
   'ISRIZ 4 (Kuenseum)',
   riz_id,
   'Corée du Sud / Sénégal',
   'RDA Corée du Sud / ISRA',
   NULL, 105, 125,
   'Namcheon / Namyeong — variété Tongil, maintenu ISRA Bambey',
   'Grain long (Indica)',
   11.0, 13.5, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ6',
   'ISRIZ 6 (Milyang 23)',
   riz_id,
   'Corée du Sud / Sénégal',
   'RDA Corée du Sud / ISRA',
   NULL, 103, 120,
   'IR 1317-316-5-1 / IR24 → Milyang 23 — variété Tongil',
   'Grain long (Indica)',
   11.0, 13.5, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ7',
   'ISRIZ 7 (Taebaegbyeo)',
   riz_id,
   'Corée du Sud / Sénégal',
   'RDA Corée du Sud / ISRA',
   NULL, 106, 123,
   'Taebaegbyeo — variété Tongil, maintenu ISRA Bambey',
   'Grain long (Indica)',
   10.0, 12.5, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ8',
   'ISRIZ 8',
   riz_id,
   'Pakistan / Sénégal',
   'ISRA/CNRA Bambey',
   NULL, 99, 134,
   'BAS 320 / IR 661 — double saison',
   'Grain long (Indica)',
   9.0, 11.5, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ9',
   'ISRIZ 9 (AR051H)',
   riz_id,
   'Bouaké, Côte d''Ivoire / Sénégal',
   'AfricaRice / ISRA',
   NULL, 110, 130,
   'AR051H — hybride interspécifique AfricaRice',
   'Grain long (Indica)',
   9.9, 13.0, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ11',
   'ISRIZ 11',
   riz_id,
   'Los Baños, Philippines / Sénégal',
   'IRRI / ISRA',
   NULL, 105, 125,
   'IR 72593-B-3-2-3-8 — sol non salé',
   'Grain long (Indica)',
   10.0, 12.5, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ12',
   'ISRIZ 12 (08FAN10)',
   riz_id,
   'Chine / Sénégal',
   'CAAS Chine / ISRA',
   NULL, 92, 127,
   '08FAN10 — adaptation plateau et périmètre irrigué',
   'Grain long (Indica)',
   9.0, 10.5, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ13',
   'ISRIZ 13',
   riz_id,
   'Bouaké, Côte d''Ivoire / Sénégal',
   'AfricaRice / ISRA',
   NULL, 115, 127,
   'WAB 2098-WAC3-1-TGR2-WAT85',
   'Grain long (Indica)',
   11.0, 12.4, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ14',
   'ISRIZ 14',
   riz_id,
   'Bouaké, Côte d''Ivoire / Sénégal',
   'AfricaRice / ISRA',
   NULL, 114, 132,
   'FAROX 521-288-H1',
   'Grain long (Indica)',
   11.0, 12.1, 'DIFFUSEE', NOW()),

  ('RIZ-ISRIZ15',
   'ISRIZ 15',
   riz_id,
   'Brésil / Sénégal',
   'Embrapa Brésil / ISRA',
   NULL, 92, 120,
   'CT8837-1-17-9-21 // Oryza-1 / Oryzica Lianos-4',
   'Grain long (Indica)',
   11.0, 12.5, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 6. VARIÉTÉS JAPONICA PLUVIALES (homologation 2009)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-ITA150',
   'ITA 150',
   riz_id,
   'Ibadan, Nigeria',
   'IITA',
   2009, 73, 80,
   '63-83 × Dourado Précoce — culture pluviale centre et sud Sénégal',
   'Grain court (Japonica)',
   3.0, 4.0, 'DIFFUSEE', NOW()),

  ('RIZ-WAB5650',
   'WAB 56-50',
   riz_id,
   'Bouaké, Côte d''Ivoire',
   'AfricaRice / ISRA',
   2009, 72, 78,
   'IDSA 6 × IAC 164 — Japonica pluvial cycle très court',
   'Grain court (Japonica)',
   3.0, 4.0, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 7. NERICA PLUVIAL (O. glaberrima × O. sativa, 2009)
  --    Nerica 1, 4, 8 déjà présents en base — omis ici
  -- ════════════════════════════════════════════════════════════

  ('RIZ-NERICA5',
   'Nerica 5',
   riz_id,
   'Bouaké, Côte d''Ivoire',
   'ISRA-AfricaRice',
   2009, 90, 95,
   'WAB 56-104 / CG14 — culture pluviale centre et sud Sénégal',
   'Hybride interspécifique (NERICA)',
   3.5, 4.0, 'DIFFUSEE', NOW()),

  ('RIZ-NERICA6',
   'Nerica 6',
   riz_id,
   'Bouaké, Côte d''Ivoire',
   'ISRA-AfricaRice',
   2009, 95, 100,
   'WAB 56-104 / CG14 — culture pluviale centre et sud Sénégal',
   'Hybride interspécifique (NERICA)',
   4.5, 5.0, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 8. NERICA-S IRRIGUÉ — Vallée du Fleuve Sénégal (2009)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-NERICAS19',
   'Nerica-S-19',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 128, 134,
   'Tog 5681 / 2*IR64 / IR31785 — culture irriguée Vallée du Fleuve',
   'Hybride interspécifique (NERICA)',
   10.0, 11.0, 'DIFFUSEE', NOW()),

  ('RIZ-NERICAS21',
   'Nerica-S-21',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 128, 134,
   'Tog 5681 / 2*IR64 / IR31785 — culture irriguée Vallée du Fleuve',
   'Hybride interspécifique (NERICA)',
   12.0, 13.0, 'DIFFUSEE', NOW()),

  ('RIZ-NERICAS36',
   'Nerica-S-36',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 119, 125,
   'Tog 5681 / 2*IR1529 / IR1529 — culture irriguée Vallée du Fleuve',
   'Hybride interspécifique (NERICA)',
   10.0, 11.0, 'DIFFUSEE', NOW()),

  ('RIZ-NERICAS44',
   'Nerica-S-44',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 119, 125,
   'IR64 / Tog5681 / 4*IR64 — culture irriguée Vallée du Fleuve',
   'Hybride interspécifique (NERICA)',
   11.0, 12.0, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 9. SAHEL 201–202 — Vallée du Fleuve (homologation 1994)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-SAHEL201',
   'Sahel 201',
   riz_id,
   'Sri Lanka',
   'ISRA-AfricaRice',
   1994, 121, 142,
   'IR 2071-586 / BG 400-1',
   'Grain long (Indica)',
   9.0, 10.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL202',
   'Sahel 202',
   riz_id,
   'IITA Nigeria',
   'ISRA-AfricaRice',
   1994, 117, 139,
   'TOX 494-3696 / TOX 711 / BG 6812',
   'Grain long (Indica)',
   10.0, 11.0, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 10. SAHEL 134–210 — Vallée du Fleuve (homologation 24 oct 2007)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-SAHEL134',
   'Sahel 134',
   riz_id,
   'Los Baños, Philippines',
   'ISRA-AfricaRice',
   2007, 110, 131,
   'IR 1791-5-4-3-3 / IR 9129-209-2-2-1',
   'Grain long (Indica)',
   9.0, 10.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL159',
   'Sahel 159',
   riz_id,
   'Los Baños, Philippines',
   'ISRA-AfricaRice',
   2007, 109, 130,
   'IR 13240-108-2-2-3 / IR 9129-209-2-2-1',
   'Grain long (Indica)',
   9.0, 10.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL208',
   'Sahel 208',
   riz_id,
   'IITA Nigeria',
   'ISRA-AfricaRice',
   2007, 125, 145,
   'ITA 212 / UPL R17',
   'Grain long (Indica)',
   11.0, 12.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL209',
   'Sahel 209',
   riz_id,
   'IITA Nigeria',
   'ISRA-AfricaRice',
   2007, 126, 140,
   'TSY / Morobérékan // ITA306',
   'Grain long (Indica)',
   11.0, 12.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL210',
   'Sahel 210',
   riz_id,
   'Amérique Latine',
   'ISRA-AfricaRice',
   2007, 125, 141,
   'ECIA 31-6066',
   'Grain long (Indica)',
   11.0, 12.0, 'DIFFUSEE', NOW()),

  -- ════════════════════════════════════════════════════════════
  -- 11. SÉRIE SAHEL 217–329 — Vallée du Fleuve (homologation 3 mars 2009)
  -- ════════════════════════════════════════════════════════════

  ('RIZ-SAHEL217',
   'Sahel 217',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 126, 132,
   'Sahel 201 / 4456',
   'Grain long (Indica)',
   12.0, 13.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL222',
   'Sahel 222',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 100, 106,
   'Sahel 201 / 4456 — cycle court',
   'Grain long (Indica)',
   12.0, 13.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL305',
   'Sahel 305',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 121, 127,
   'IR 64 / 4456',
   'Grain long (Indica)',
   9.0, 10.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL317',
   'Sahel 317',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 119, 125,
   '4456 / 32 Xuan 5C',
   'Grain long (Indica)',
   11.0, 12.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL328',
   'Sahel 328',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 113, 119,
   'Sahel 134 / IR 66231-37-1-2',
   'Grain long (Indica)',
   9.0, 10.0, 'DIFFUSEE', NOW()),

  ('RIZ-SAHEL329',
   'Sahel 329',
   riz_id,
   'Saint-Louis, Sénégal',
   'ISRA-AfricaRice',
   2009, 113, 119,
   'Jaya / Basmati 370 — grain parfumé',
   'Grain long parfumé (Indica)',
   6.5, 7.0, 'DIFFUSEE', NOW())

  ON CONFLICT (code_variete) DO NOTHING;

END $$;
