-- V87 : Unification REJETEE → ANNULEE
-- Toutes les commandes marquées REJETEE sont converties en ANNULEE.
-- Si aucun motif n'existait, un motif neutre est injecté pour traçabilité.
UPDATE orders.commande
SET
    statut      = 'ANNULEE',
    observations = CASE
        WHEN observations IS NULL OR TRIM(observations) = ''
        THEN 'Commande annulée (anciennement rejetée — migration V87)'
        ELSE observations
    END
WHERE statut = 'REJETEE';
