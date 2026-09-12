-- V79 : Potentiels agricoles sur zones agro-écologiques + table de liaison zone-espèce
-- Appliqué manuellement en session précédente (V79b) — cette migration est idempotente
-- grâce aux clauses IF NOT EXISTS pour permettre à Flyway d'enregistrer l'état officiel.

-- ── 1. Colonnes potentiels ha sur geo.zone_agro ─────────────────────────────────────────
ALTER TABLE geo.zone_agro
    ADD COLUMN IF NOT EXISTS potentiel_cereales_ha     NUMERIC(12, 1),
    ADD COLUMN IF NOT EXISTS potentiel_legumineuses_ha NUMERIC(12, 1);

-- Données SIG par zone (UPDATE idempotent — ne crée rien si déjà là)
UPDATE geo.zone_agro SET potentiel_cereales_ha =  950000.0, potentiel_legumineuses_ha =  120000.0 WHERE code = 'BA';
UPDATE geo.zone_agro SET potentiel_cereales_ha =   45000.0, potentiel_legumineuses_ha =   18000.0 WHERE code = 'BC';
UPDATE geo.zone_agro SET potentiel_cereales_ha =  210000.0, potentiel_legumineuses_ha =   65000.0 WHERE code = 'HC';
UPDATE geo.zone_agro SET potentiel_cereales_ha =  180000.0, potentiel_legumineuses_ha =   42000.0 WHERE code = 'MC';
UPDATE geo.zone_agro SET potentiel_cereales_ha =   85000.0, potentiel_legumineuses_ha =   95000.0 WHERE code = 'NAY';
UPDATE geo.zone_agro SET potentiel_cereales_ha =  320000.0, potentiel_legumineuses_ha =   38000.0 WHERE code = 'SO';
UPDATE geo.zone_agro SET potentiel_cereales_ha =  290000.0, potentiel_legumineuses_ha =    8000.0 WHERE code = 'VF';
UPDATE geo.zone_agro SET potentiel_cereales_ha =  140000.0, potentiel_legumineuses_ha =   22000.0 WHERE code = 'ZSP';

-- ── 2. Table de liaison zone ↔ espèce ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog.zone_espece (
    id_zone_agro   BIGINT  NOT NULL REFERENCES geo.zone_agro(id)  ON DELETE CASCADE,
    id_espece      BIGINT  NOT NULL REFERENCES catalog.espece(id) ON DELETE CASCADE,
    est_principale BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT pk_zone_espece PRIMARY KEY (id_zone_agro, id_espece)
);

-- 26 liaisons agronomiques stratégiques (INSERT OR IGNORE)
INSERT INTO catalog.zone_espece (id_zone_agro, id_espece, est_principale)
SELECT z.id, e.id, true
FROM geo.zone_agro z, catalog.espece e
WHERE (z.code = 'BC'  AND e.code_espece IN ('ARA','RIZ'))
   OR (z.code = 'MC'  AND e.code_espece IN ('RIZ','MAI','SOR','ARA','NIE'))
   OR (z.code = 'HC'  AND e.code_espece IN ('MAI','RIZ','ARA'))
   OR (z.code = 'BA'  AND e.code_espece IN ('ARA','MIL','SOR','NIE','SES'))
   OR (z.code = 'NAY' AND e.code_espece IN ('NIE'))
   OR (z.code = 'SO'  AND e.code_espece IN ('MAI','SOR','FON','ARA'))
   OR (z.code = 'VF'  AND e.code_espece IN ('RIZ','BLE','SOR'))
   OR (z.code = 'ZSP' AND e.code_espece IN ('MIL','SOR','NIE'))
ON CONFLICT ON CONSTRAINT pk_zone_espece DO NOTHING;
