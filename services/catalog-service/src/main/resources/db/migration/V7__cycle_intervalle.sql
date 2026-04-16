-- ============================================================
-- V7__cycle_intervalle.sql
-- Remplacement de cycle_jours (entier) par cycle_min / cycle_max
-- Permet d'exprimer un intervalle réel ex: 75-90 jours
-- Source : Guide variétal CNRA + données agronomiques ISRA
-- ============================================================

-- 1. Ajout des nouvelles colonnes
ALTER TABLE variete ADD COLUMN IF NOT EXISTS cycle_min INTEGER;
ALTER TABLE variete ADD COLUMN IF NOT EXISTS cycle_max INTEGER;

-- 2. Migration des données existantes : cycle_jours → intervalle
--    Règle par défaut : cycle_jours ± 5 jours (tolérance biologique standard)
UPDATE variete
SET cycle_min = cycle_jours - 5,
    cycle_max = cycle_jours + 5
WHERE cycle_jours IS NOT NULL;

-- 3. Intervalles précis par espèce/variété (données CNRA réelles)

-- ── ARACHIDE (cycles hâtifs 75-90j, tardifs 90-120j) ─────────
UPDATE variete SET cycle_min = 85, cycle_max = 95  WHERE code_variete IN ('ARA-FLEUR11','ARA-55437','ARA-TAARU','ARA-YAAKAR','ARA-JAAMBAR','ARA-ESSAMAAY','ARA-SUNU-GAAL');
UPDATE variete SET cycle_min = 80, cycle_max = 90  WHERE code_variete = 'ARA-CHICO';
UPDATE variete SET cycle_min = 95, cycle_max = 105 WHERE code_variete = 'ARA-GH119';

-- ── MIL (cycles 75-130j selon écotype) ───────────────────────
UPDATE variete SET cycle_min = 85, cycle_max = 95  WHERE code_variete = 'MIL-SOUNA3';
UPDATE variete SET cycle_min = 85, cycle_max = 95  WHERE code_variete = 'MIL-SOUNA11';
UPDATE variete SET cycle_min = 95, cycle_max = 110 WHERE code_variete = 'MIL-THIOU';
UPDATE variete SET cycle_min = 80, cycle_max = 90  WHERE code_variete = 'MIL-IBV8004';
UPDATE variete SET cycle_min = 90, cycle_max = 100 WHERE code_variete = 'MIL-BASSI';
UPDATE variete SET cycle_min = 110, cycle_max = 130 WHERE code_variete = 'MIL-SN';
UPDATE variete SET cycle_min = 75, cycle_max = 85  WHERE code_variete = 'MIL-TAAW';
UPDATE variete SET cycle_min = 80, cycle_max = 90  WHERE code_variete = 'MIL-THIALACK2';

-- ── SORGHO (cycles 85-120j) ───────────────────────────────────
UPDATE variete SET cycle_min = 85, cycle_max = 95  WHERE code_variete IN ('SOR-PETANKE','SOR-CE180');
UPDATE variete SET cycle_min = 85, cycle_max = 95  WHERE code_variete = 'SOR-FRAMIDA';
UPDATE variete SET cycle_min = 90, cycle_max = 105 WHERE code_variete IN ('SOR-CE145','SOR-CE151');
UPDATE variete SET cycle_min = 95, cycle_max = 105 WHERE code_variete IN ('SOR-CE196','SOR-F2-20','SOR-FAOUROU','SOR-PAYENNE','SOR-DAROU','SOR-NGUINTHE');
UPDATE variete SET cycle_min = 100, cycle_max = 115 WHERE code_variete IN ('SOR-SARIASO','SOR-GALOBE');
UPDATE variete SET cycle_min = 105, cycle_max = 120 WHERE code_variete IN ('SOR-NGANDA','SOR-FARAFARA');

-- ── NIÉBÉ (cycles courts 55-80j) ─────────────────────────────
UPDATE variete SET cycle_min = 62, cycle_max = 72  WHERE code_variete = 'NIE-MELAKH';
UPDATE variete SET cycle_min = 63, cycle_max = 73  WHERE code_variete = 'NIE-MOURIDE';
UPDATE variete SET cycle_min = 65, cycle_max = 75  WHERE code_variete IN ('NIE-YACINE','NIE-58-74');
UPDATE variete SET cycle_min = 68, cycle_max = 78  WHERE code_variete = 'NIE-66-35';
UPDATE variete SET cycle_min = 70, cycle_max = 80  WHERE code_variete = 'NIE-BAMBEY21';

-- ── MAÏS (cycles 80-110j) ────────────────────────────────────
UPDATE variete SET cycle_min = 85, cycle_max = 95  WHERE code_variete IN ('MAI-DK8031','MAI-OBATAMPA','MAI-YAAYI-SEEX','MAI-GOOR-YOMBOUL');
UPDATE variete SET cycle_min = 90, cycle_max = 100 WHERE code_variete IN ('MAI-ESPOIR','MAI-JABOOT');
UPDATE variete SET cycle_min = 80, cycle_max = 90  WHERE code_variete IN ('MAI-INITIAL','MAI-GAAW-NA');
UPDATE variete SET cycle_min = 95, cycle_max = 110 WHERE code_variete = 'MAI-MAMBA';

-- ── RIZ irrigué (cycles 105-125j, zone fleuve) ───────────────
UPDATE variete SET cycle_min = 105, cycle_max = 115 WHERE code_variete IN ('RIZ-SAHEL108','RIZ-ISRIZ1','RIZ-ISRIZ10');
UPDATE variete SET cycle_min = 110, cycle_max = 120 WHERE code_variete IN ('RIZ-SAHEL177','RIZ-SAHEL200','RIZ-ISRIZ5');
UPDATE variete SET cycle_min = 115, cycle_max = 125 WHERE code_variete = 'RIZ-WASSA';
UPDATE variete SET cycle_min = 100, cycle_max = 110 WHERE code_variete = 'RIZ-TOX728';

-- ── RIZ pluvial NERICA (cycles 95-110j) ──────────────────────
UPDATE variete SET cycle_min = 95, cycle_max = 105 WHERE code_variete IN ('RIZ-NERICA1','RIZ-NERICA4');
UPDATE variete SET cycle_min = 98, cycle_max = 108 WHERE code_variete = 'RIZ-NERICA8';

-- ── BLÉ (cycles 110-125j, zone fleuve contre-saison) ─────────
UPDATE variete SET cycle_min = 115, cycle_max = 125 WHERE code_variete IN ('BLE-PENDAO','BLE-FANAYE');
UPDATE variete SET cycle_min = 110, cycle_max = 120 WHERE code_variete IN ('BLE-HAMAT','BLE-DIOUFISSA');
UPDATE variete SET cycle_min = 113, cycle_max = 123 WHERE code_variete = 'BLE-ALIOUNE';

-- ── SÉSAME (cycles 85-95j) ────────────────────────────────────
UPDATE variete SET cycle_min = 85, cycle_max = 95  WHERE code_variete IN ('SES-ISRA1','SES-NIANGBALLO','SES-BOUREIMA');
UPDATE variete SET cycle_min = 80, cycle_max = 90  WHERE code_variete = 'SES-GOUDAS';

-- ── FONIO (cycles courts 70-85j) ─────────────────────────────
UPDATE variete SET cycle_min = 75, cycle_max = 85  WHERE code_variete IN ('FON-LOCAL1','FON-NIATA');
UPDATE variete SET cycle_min = 70, cycle_max = 80  WHERE code_variete = 'FON-FOFANA';

-- ── SOJA (cycles 85-100j) ─────────────────────────────────────
UPDATE variete SET cycle_min = 85, cycle_max = 95  WHERE code_variete = 'SOJ-DOUE';
UPDATE variete SET cycle_min = 90, cycle_max = 100 WHERE code_variete = 'SOJ-TGM';

-- 4. Ajout des contraintes
ALTER TABLE variete ADD CONSTRAINT chk_cycle_coherent
  CHECK (cycle_min IS NULL OR cycle_max IS NULL OR cycle_min <= cycle_max);

-- 5. Suppression de l'ancienne colonne
ALTER TABLE variete DROP COLUMN IF EXISTS cycle_jours;
