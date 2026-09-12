-- V80 : FKs géographiques sur stock.site
-- Ajoute id_zone_agro et id_departement avec backfill depuis les champs texte existants.
-- Pose l'index unique partiel pour la contrainte "un seul site principal par organisation".
-- Note : id_commune reporté (table geo.communes non encore créée).

-- ── 1. Nouvelles colonnes FK ────────────────────────────────────────────────────────────
ALTER TABLE stock.site
    ADD COLUMN IF NOT EXISTS id_zone_agro   BIGINT  REFERENCES geo.zone_agro(id)    ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_departement INTEGER REFERENCES geo.departements(id)  ON DELETE SET NULL;

-- ── 2. Backfill id_zone_agro depuis zone_code ────────────────────────────────────────
UPDATE stock.site s
SET    id_zone_agro = z.id
FROM   geo.zone_agro z
WHERE  s.zone_code = z.code
  AND  s.id_zone_agro IS NULL;

-- ── 3. Backfill id_departement depuis departement (nom) ──────────────────────────────
UPDATE stock.site s
SET    id_departement = d.id
FROM   geo.departements d
WHERE  LOWER(TRIM(s.departement)) = LOWER(TRIM(d.nom))
  AND  s.id_departement IS NULL;

-- ── 4. Index de performance ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_site_zone_agro    ON stock.site (id_zone_agro)   WHERE id_zone_agro   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_departement  ON stock.site (id_departement) WHERE id_departement IS NOT NULL;

-- ── 5. Contrainte : un seul site principal par organisation ──────────────────────────
-- Index partiel (PostgreSQL unique partial index) — ne bloque pas les sites sans org
CREATE UNIQUE INDEX IF NOT EXISTS uq_site_principal_par_org
    ON stock.site (id_organisation)
    WHERE est_principal = true AND id_organisation IS NOT NULL;
