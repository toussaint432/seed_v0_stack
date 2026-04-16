-- ============================================================
-- V4__lot_code_espece.sql
-- Ajout de la colonne code_espece sur lot_semencier
-- Permet le filtrage rapide par espèce sans jointure
-- ============================================================

ALTER TABLE lot_semencier ADD COLUMN IF NOT EXISTS code_espece VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_lot_espece ON lot_semencier(code_espece);
