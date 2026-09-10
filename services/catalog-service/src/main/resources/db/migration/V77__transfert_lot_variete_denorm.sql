-- V77 — Dénormalisation variété sur transfert_lot pour les documents PDF
-- Auteur : ISRA / CNRA — Plateforme Sen Jiw

ALTER TABLE lot.transfert_lot
    ADD COLUMN IF NOT EXISTS nom_variete  VARCHAR(200),
    ADD COLUMN IF NOT EXISTS code_variete VARCHAR(50),
    ADD COLUMN IF NOT EXISTS code_espece  VARCHAR(30);

-- Backfill depuis catalog.variete via lot_semencier
UPDATE lot.transfert_lot t
SET nom_variete  = v.nom_variete,
    code_variete = v.code_variete,
    code_espece  = ls.code_espece
FROM lot.lot_semencier ls
JOIN catalog.variete v ON v.id = ls.id_variete
WHERE ls.id = t.id_lot
  AND t.nom_variete IS NULL;
