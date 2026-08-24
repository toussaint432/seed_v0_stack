-- Colonnes métier manquantes sur programme_multiplication
ALTER TABLE lot.programme_multiplication
    ADD COLUMN IF NOT EXISTS multiplicateur      VARCHAR(120),
    ADD COLUMN IF NOT EXISTS campagne            VARCHAR(20),
    ADD COLUMN IF NOT EXISTS username_createur   VARCHAR(80),
    ADD COLUMN IF NOT EXISTS role_createur       VARCHAR(40);
