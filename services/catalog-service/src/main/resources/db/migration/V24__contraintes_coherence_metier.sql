-- ============================================================
-- V24 — Contraintes de cohérence métier
-- Auteur : ISRA / CNRA — Plateforme Sen Jiw
-- Objectif :
--   1. Contrainte CHECK source/destination sur mouvement_stock
--      (IN exige destination, OUT exige source, TRANSFER exige les deux)
--   2. Contrainte CHECK statut commande (valeurs autorisées)
--   3. Index sur commande.statut pour les requêtes filtrées fréquentes
--   4. Index sur conversation.dernier_message_at pour le tri des conversations
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. COHÉRENCE SITE SOURCE / DESTINATION PAR TYPE DE MOUVEMENT
--    IN  : destination obligatoire, source interdite
--    OUT : source obligatoire, destination interdite
--    TRANSFER : source ET destination obligatoires
-- ────────────────────────────────────────────────────────────
ALTER TABLE mouvement_stock
    ADD CONSTRAINT chk_mvt_site_coherent CHECK (
        (type_mouvement = 'IN'       AND id_site_destination IS NOT NULL AND id_site_source IS NULL)
     OR (type_mouvement = 'OUT'      AND id_site_source IS NOT NULL      AND id_site_destination IS NULL)
     OR (type_mouvement = 'TRANSFER' AND id_site_source IS NOT NULL      AND id_site_destination IS NOT NULL)
    );

-- ────────────────────────────────────────────────────────────
-- 2. CONTRAINTE STATUT COMMANDE
--    Restreint les valeurs acceptées aux statuts de l'enum StatutCommande.java.
-- ────────────────────────────────────────────────────────────
ALTER TABLE commande
    ADD CONSTRAINT chk_commande_statut CHECK (
        statut IN ('SOUMISE', 'ACCEPTEE', 'EN_PREPARATION', 'LIVREE', 'ANNULEE', 'REJETEE')
    );

-- ────────────────────────────────────────────────────────────
-- 3. INDEX COMMANDE.STATUT
--    Accélère les requêtes filtrées par statut
--    (tableau de bord admin, "mes commandes en attente", etc.)
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commande_statut
    ON commande(statut);

-- ────────────────────────────────────────────────────────────
-- 4. INDEX CONVERSATION.DERNIER_MESSAGE_AT
--    Accélère le tri par activité récente dans la messagerie
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conv_dernier_message
    ON conversation(dernier_message_at DESC NULLS LAST);
