-- ============================================================
-- V11__lot_campagne_texte.sql
-- Ajout de la colonne campagne (texte dénormalisé) sur lot_semencier.
-- La FK id_campagne (→ campagne.id) existait déjà.
-- Ce champ texte est lu directement par l'entité JPA LotSemencier
-- pour éviter une jointure supplémentaire sur campagne.
-- ============================================================

ALTER TABLE lot_semencier
    ADD COLUMN IF NOT EXISTS campagne VARCHAR(50);

-- Backfill depuis la table campagne si des lots ont déjà id_campagne renseigné
UPDATE lot_semencier ls
   SET campagne = c.libelle
  FROM campagne c
 WHERE c.id = ls.id_campagne
   AND ls.campagne IS NULL;
