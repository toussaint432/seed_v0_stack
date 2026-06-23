-- Ajout des horodatages d'audit précis sur transfert_lot
-- accepted_at et refused_at existent dans l'entité Java mais manquaient dans le schéma,
-- ce qui provoquait une PSQLException à chaque acceptation/refus de transfert.

ALTER TABLE transfert_lot
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refused_at  TIMESTAMPTZ;
