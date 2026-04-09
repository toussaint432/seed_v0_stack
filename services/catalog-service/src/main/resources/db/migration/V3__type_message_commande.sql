-- ============================================================
-- V3__type_message_commande.sql
-- Ajout du type COMMANDE dans la contrainte CHECK de message.type
-- Permet d'envoyer une demande de commande structurée via le chat
-- ============================================================

-- Supprimer la contrainte CHECK existante (générée automatiquement)
ALTER TABLE message DROP CONSTRAINT IF EXISTS message_type_check;

-- Recréer la contrainte avec COMMANDE inclus
ALTER TABLE message
    ADD CONSTRAINT message_type_check
    CHECK (type IN ('TEXT','IMAGE','FICHIER','AUDIO','COMMANDE'));
