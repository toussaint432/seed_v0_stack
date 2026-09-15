-- V86 : Backfill nom_variete / code_variete dans lot.lot_semencier et lot.transfert_lot
--
-- Raison : les lots créés avant l'ajout de la colonne dénormalisée, ou via le flux
-- de réception automatique (préfixe REC-), ont nom_variete = NULL ou ''.
-- On résout via la jointure directe avec catalog.variete dans le même schéma DB.
-- Idempotent : WHERE filtre les lignes déjà correctement renseignées.

-- ── 1. lot.lot_semencier ──────────────────────────────────────────────────────
UPDATE lot.lot_semencier ls
SET
    nom_variete  = v.nom_variete,
    code_variete = v.code_variete
FROM catalog.variete v
WHERE ls.id_variete = v.id
  AND (ls.nom_variete IS NULL OR ls.nom_variete = '');

-- ── 2. lot.lot_semencier : espèce manquante (cohérence) ──────────────────────
UPDATE lot.lot_semencier ls
SET code_espece = e.code_espece
FROM catalog.variete v
JOIN catalog.espece e ON v.id_espece = e.id
WHERE ls.id_variete = v.id
  AND (ls.code_espece IS NULL OR ls.code_espece = '');

-- ── 3. lot.transfert_lot : enrichir via le lot source (id_lot → lot_semencier) ─
UPDATE lot.transfert_lot tl
SET
    nom_variete  = ls.nom_variete,
    code_variete = ls.code_variete,
    code_espece  = ls.code_espece
FROM lot.lot_semencier ls
WHERE tl.id_lot = ls.id
  AND (tl.nom_variete IS NULL OR tl.nom_variete = '');

DO $$
DECLARE
    nb_lots      INTEGER;
    nb_transferts INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_lots
    FROM lot.lot_semencier WHERE nom_variete IS NULL OR nom_variete = '';

    SELECT COUNT(*) INTO nb_transferts
    FROM lot.transfert_lot WHERE nom_variete IS NULL OR nom_variete = '';

    RAISE NOTICE 'V86 OK — lots encore sans variété : %, transferts encore sans variété : %',
        nb_lots, nb_transferts;
END;
$$;
