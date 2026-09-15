-- Lie chaque transfert_lot à la commande qui l'a déclenché.
-- NULL pour les transferts antérieurs (backfill non possible sans id_commande historique).
ALTER TABLE lot.transfert_lot
    ADD COLUMN id_commande BIGINT NULL
    REFERENCES orders.commande(id) ON DELETE SET NULL;

CREATE INDEX idx_trflot_commande ON lot.transfert_lot(id_commande)
    WHERE id_commande IS NOT NULL;
