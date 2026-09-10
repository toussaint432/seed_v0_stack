-- V77 — Dénormalisation variété sur transfert_lot pour les documents PDF
-- Auteur : ISRA / CNRA — Plateforme Sen Jiw

ALTER TABLE lot.transfert_lot
    ADD COLUMN IF NOT EXISTS nom_variete  VARCHAR(200),
    ADD COLUMN IF NOT EXISTS code_variete VARCHAR(50),
    ADD COLUMN IF NOT EXISTS code_espece  VARCHAR(30);

-- Backfill depuis lot_semencier pour les transferts existants
UPDATE lot.transfert_lot t
SET nom_variete  = ls.nom_variete,
    code_variete = ls.code_variete,
    code_espece  = ls.code_espece
FROM lot.lot_semencier ls
WHERE ls.id = t.id_lot
  AND t.nom_variete IS NULL;
