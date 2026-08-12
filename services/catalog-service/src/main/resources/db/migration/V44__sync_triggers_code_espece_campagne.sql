-- ============================================================
-- V44 — Triggers de cohérence : code_espece et campagne
-- Auteur : ISRA / CNRA — Plateforme Sen Jiwu
-- Objectif :
--   1. lot_semencier.code_espece était renseigné manuellement
--      par le service Java. Risque de divergence avec la source
--      de vérité (variete → espece). Ce trigger le rend automatique.
--   2. lot_semencier.campagne (varchar) et id_campagne (FK)
--      coexistaient sans garantie de synchronisation. Ce trigger
--      maintient la cohérence dans les deux sens.
--   3. Backfill des 4 lots orphelins (campagne='2024-2025'
--      sans id_campagne) — la campagne correspondante est créée.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TRIGGER : auto-sync lot_semencier.code_espece
--    Source de vérité : variete → espece (chemin id_variete)
--    Remplace le setCodeEspece() manuel dans LotService.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_lot_code_espece()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_variete IS NOT NULL THEN
        NEW.code_espece := (
            SELECT e.code_espece
            FROM   variete v
            JOIN   espece  e ON e.id = v.id_espece
            WHERE  v.id = NEW.id_variete
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lot_code_espece_sync ON lot_semencier;
CREATE TRIGGER trg_lot_code_espece_sync
    BEFORE INSERT OR UPDATE OF id_variete ON lot_semencier
    FOR EACH ROW EXECUTE FUNCTION fn_sync_lot_code_espece();

-- Backfill : corriger les éventuelles incohérences existantes
UPDATE lot_semencier ls
SET    code_espece = (
    SELECT e.code_espece
    FROM   variete v
    JOIN   espece  e ON e.id = v.id_espece
    WHERE  v.id = ls.id_variete
)
WHERE  ls.id_variete IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Résoudre les 4 lots orphelins (campagne='2024-2025'
--    sans id_campagne correspondant).
--    La campagne Hivernage 2024 est créée si absente.
-- ────────────────────────────────────────────────────────────
INSERT INTO campagne (code_campagne, libelle, annee, statut)
VALUES ('HIV-2024', '2024-2025', 2024, 'TERMINEE')
ON CONFLICT (code_campagne) DO NOTHING;

UPDATE lot_semencier
SET    id_campagne = (SELECT id FROM campagne WHERE code_campagne = 'HIV-2024')
WHERE  campagne    = '2024-2025'
AND    id_campagne IS NULL;

-- ────────────────────────────────────────────────────────────
-- 3. TRIGGER : sync bidirectionnel campagne ↔ id_campagne
--
--    Sens A : id_campagne renseigné → campagne varchar alignée
--             (quand un futur formulaire utilisera le FK)
--    Sens B : campagne varchar renseignée → id_campagne résolu
--             par lookup libelle (formulaires existants)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_lot_campagne()
RETURNS TRIGGER AS $$
DECLARE
    v_libelle   VARCHAR;
    v_id        BIGINT;
BEGIN
    -- Sens A : FK prioritaire
    IF NEW.id_campagne IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.id_campagne IS DISTINCT FROM OLD.id_campagne)
    THEN
        SELECT libelle INTO v_libelle FROM campagne WHERE id = NEW.id_campagne;
        IF FOUND THEN
            NEW.campagne := v_libelle;
        END IF;

    -- Sens B : varchar → résolution FK si le libellé existe
    ELSIF NEW.campagne IS NOT NULL AND NEW.id_campagne IS NULL THEN
        SELECT id INTO v_id
        FROM   campagne
        WHERE  libelle       = NEW.campagne
            OR code_campagne = NEW.campagne
        LIMIT  1;
        IF FOUND THEN
            NEW.id_campagne := v_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lot_campagne_sync ON lot_semencier;
CREATE TRIGGER trg_lot_campagne_sync
    BEFORE INSERT OR UPDATE OF campagne, id_campagne ON lot_semencier
    FOR EACH ROW EXECUTE FUNCTION fn_sync_lot_campagne();
