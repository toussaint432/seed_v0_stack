-- V85 : Géolocalisation des membres (zone agro-écologique, département, commune, GPS)
--
-- Permet de rattacher chaque membre à sa ZAE de terrain, son département, sa commune
-- et de capturer les coordonnées GPS précises de son site de stockage/production.
-- Pas de FK cross-schema : id_zone_agro est un BigInt simple pour éviter les contraintes
-- inter-schémas entre shared et catalog.

ALTER TABLE shared.membre_organisation
    ADD COLUMN IF NOT EXISTS id_zone_agro BIGINT,
    ADD COLUMN IF NOT EXISTS departement  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS commune      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS latitude     NUMERIC(10,6),
    ADD COLUMN IF NOT EXISTS longitude    NUMERIC(10,6);

CREATE INDEX IF NOT EXISTS idx_membre_zone_agro
    ON shared.membre_organisation(id_zone_agro)
    WHERE id_zone_agro IS NOT NULL;

DO $$
BEGIN
    RAISE NOTICE 'V85 OK — colonnes géospatiales ajoutées à shared.membre_organisation.';
END;
$$;
