-- V24 a créé chk_commande_statut avec une liste incomplète de statuts
-- (manquaient EN_NEGOCIATION, ACCORDEE, EN_LIVRAISON).
-- La contrainte commande_statut_check (générée par le DDL Hibernate) couvre
-- déjà tous les statuts valides du workflow. On supprime la contrainte obsolète.
ALTER TABLE orders.commande DROP CONSTRAINT IF EXISTS chk_commande_statut;
