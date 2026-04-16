-- ============================================================
-- V9__variete_champs_agronomiques.sql
-- Enrichissement du référentiel variétal — format ISRA/CNRA
-- Ajout : pedigree, type_grain, rendement_min, rendement_max
-- Colonnes additive-only — aucune colonne supprimée ni modifiée
-- ============================================================

-- ── 1. Ajout des colonnes ─────────────────────────────────────

ALTER TABLE variete ADD COLUMN IF NOT EXISTS pedigree       TEXT;
ALTER TABLE variete ADD COLUMN IF NOT EXISTS type_grain     VARCHAR(50);
ALTER TABLE variete ADD COLUMN IF NOT EXISTS rendement_min  NUMERIC(4,1);
ALTER TABLE variete ADD COLUMN IF NOT EXISTS rendement_max  NUMERIC(4,1);

-- ADD CONSTRAINT ne supporte pas IF NOT EXISTS en PostgreSQL — bloc DO pour idempotence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rendement_coherent'
  ) THEN
    ALTER TABLE variete ADD CONSTRAINT chk_rendement_coherent
      CHECK (rendement_min IS NULL OR rendement_max IS NULL OR rendement_min <= rendement_max);
  END IF;
END $$;

-- ── 2. ARACHIDE — données CNRA réelles ───────────────────────

UPDATE variete SET
  pedigree      = 'Sélection massa ISRA Bambey',
  type_grain     = 'Virginia (Bold)',
  rendement_min  = 2.5, rendement_max = 3.5
WHERE code_variete = 'ARA-FLEUR11';

UPDATE variete SET
  pedigree      = 'Sélection de CE 145-66',
  type_grain     = 'Spanish (Bold)',
  rendement_min  = 2.0, rendement_max = 3.0
WHERE code_variete = 'ARA-55437';

UPDATE variete SET
  pedigree      = 'ICRISAT × ISRA sélection',
  type_grain     = 'Spanish (Petit)',
  rendement_min  = 2.0, rendement_max = 2.8
WHERE code_variete = 'ARA-CHICO';

UPDATE variete SET
  pedigree      = 'ISRA / IRA Ghana introduction',
  type_grain     = 'Virginia',
  rendement_min  = 2.2, rendement_max = 3.2
WHERE code_variete = 'ARA-GH119';

UPDATE variete SET
  pedigree      = 'Sélection locale ISRA-CNRA Bambey',
  type_grain     = 'Spanish (Bold)',
  rendement_min  = 2.3, rendement_max = 3.3
WHERE code_variete = 'ARA-TAARU';

UPDATE variete SET
  pedigree      = 'Sélection locale ISRA-CNRA Bambey',
  type_grain     = 'Spanish (Bold)',
  rendement_min  = 2.3, rendement_max = 3.3
WHERE code_variete = 'ARA-YAAKAR';

UPDATE variete SET
  pedigree      = 'Croisement ISRA-CNRA — résistance rosette',
  type_grain     = 'Virginia (Bold)',
  rendement_min  = 2.4, rendement_max = 3.4
WHERE code_variete = 'ARA-JAAMBAR';

UPDATE variete SET
  pedigree      = 'Sélection ISRA-CNRA — tolérance sécheresse',
  type_grain     = 'Spanish (Bold)',
  rendement_min  = 2.2, rendement_max = 3.0
WHERE code_variete = 'ARA-ESSAMAAY';

UPDATE variete SET
  pedigree      = 'Sélection ISRA-CNRA — adaptation zone Centre-Nord',
  type_grain     = 'Spanish (Bold)',
  rendement_min  = 2.4, rendement_max = 3.4
WHERE code_variete = 'ARA-SUNU-GAAL';

-- ── 3. MIL — données CNRA réelles ────────────────────────────

UPDATE variete SET
  pedigree      = 'Souna III × Tiolé — sélection ISRA',
  type_grain     = 'Grain perlé (Blanc)',
  rendement_min  = 1.5, rendement_max = 2.5
WHERE code_variete = 'MIL-SOUNA11';

UPDATE variete SET
  pedigree      = 'Croisement local ISRA Bambey',
  type_grain     = 'Grain perlé (Blanc)',
  rendement_min  = 1.4, rendement_max = 2.2
WHERE code_variete = 'MIL-THIOU';

UPDATE variete SET
  pedigree      = 'IBV 8004 — Introduction Burkina / ICRISAT',
  type_grain     = 'Grain perlé (Crème)',
  rendement_min  = 1.6, rendement_max = 2.6
WHERE code_variete = 'MIL-IBV8004';

UPDATE variete SET
  pedigree      = 'Sélection locale ISRA — écotype Bassi',
  type_grain     = 'Grain perlé (Blanc)',
  rendement_min  = 1.3, rendement_max = 2.0
WHERE code_variete = 'MIL-BASSI';

UPDATE variete SET
  pedigree      = 'Sanio Local — sélection conservatrice ISRA',
  type_grain     = 'Grain perlé (Blanc)',
  rendement_min  = 1.0, rendement_max = 1.8
WHERE code_variete = 'MIL-SN';

-- ── 4. SORGHO — données CNRA réelles ─────────────────────────

UPDATE variete SET
  pedigree      = 'CE 145-66 — sélection ISRA Bambey',
  type_grain     = 'Grain blanc (Tanin bas)',
  rendement_min  = 1.5, rendement_max = 2.5
WHERE code_variete = 'SOR-CE145';

UPDATE variete SET
  pedigree      = 'CE 180 — sélection ISRA',
  type_grain     = 'Grain blanc',
  rendement_min  = 1.5, rendement_max = 2.3
WHERE code_variete = 'SOR-CE180';

UPDATE variete SET
  pedigree      = 'FRAMIDA — introduction ICRISAT',
  type_grain     = 'Grain rouge (Tanin élevé)',
  rendement_min  = 1.8, rendement_max = 2.8
WHERE code_variete = 'SOR-FRAMIDA';

-- ── 5. NIÉBÉ — données CNRA réelles ──────────────────────────

UPDATE variete SET
  pedigree      = 'Sélection ISRA Bambey — type Mélakh',
  type_grain     = 'Grain blanc (Petits)',
  rendement_min  = 0.8, rendement_max = 1.4
WHERE code_variete = 'NIE-MELAKH';

UPDATE variete SET
  pedigree      = 'Sélection ISRA — type Mouride',
  type_grain     = 'Grain crème (Moyens)',
  rendement_min  = 0.8, rendement_max = 1.3
WHERE code_variete IN ('NIE-MOURIDE', 'NIE-SN');

-- ── 6. MAÏS — données CNRA réelles ───────────────────────────

UPDATE variete SET
  pedigree      = 'DK 8031 — introduction DeKalb',
  type_grain     = 'Hybride grain jaune (Denté)',
  rendement_min  = 4.0, rendement_max = 7.0
WHERE code_variete = 'MAI-DK8031';

UPDATE variete SET
  pedigree      = 'OBATANPA — introduction CIMMYT / Ghana',
  type_grain     = 'Grain blanc (QPM — qualité protéique)',
  rendement_min  = 3.5, rendement_max = 6.0
WHERE code_variete = 'MAI-OBATAMPA';

-- ── 7. RIZ irrigué — données CNRA réelles ────────────────────

UPDATE variete SET
  pedigree      = 'SAHEL 108 — sélection ADRAO / Vallée du Fleuve',
  type_grain     = 'Grain long (Indica)',
  rendement_min  = 6.0, rendement_max = 9.0
WHERE code_variete IN ('RIZ-SAHEL108', 'RIZ-SN');

UPDATE variete SET
  pedigree      = 'SAHEL 177 — sélection ADRAO',
  type_grain     = 'Grain long (Indica)',
  rendement_min  = 6.5, rendement_max = 9.5
WHERE code_variete = 'RIZ-SAHEL177';

UPDATE variete SET
  pedigree      = 'ISRIZ1 — sélection ISRA Vallée du Fleuve',
  type_grain     = 'Grain long parfumé (Indica)',
  rendement_min  = 5.5, rendement_max = 8.5
WHERE code_variete = 'RIZ-ISRIZ1';

-- ── 8. Ancien lot de test V2 ──────────────────────────────────

UPDATE variete SET
  type_grain = 'Virginia (Bold)', rendement_min = 2.5, rendement_max = 3.5
WHERE code_variete = 'ARA-12';

UPDATE variete SET
  type_grain = 'Grain perlé (Blanc)', rendement_min = 1.0, rendement_max = 1.8
WHERE code_variete = 'MIL-SN'
  AND type_grain IS NULL;
