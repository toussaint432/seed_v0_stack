-- V81 : Traçabilité organisationnelle sur lot.transfert_lot
-- Ajoute id_org_emetteur et id_org_destinataire pour un filtrage multi-tenant sécurisé.
-- Les colonnes username_* sont conservées (rétrocompatibilité et audit nominal).
-- NULL autorisé : utilisateur historique absent de membre_organisation → ne bloque pas Flyway.

-- ── 1. Nouvelles colonnes FK vers shared.organisation ──────────────────────────────────
ALTER TABLE lot.transfert_lot
    ADD COLUMN IF NOT EXISTS id_org_emetteur     BIGINT REFERENCES shared.organisation(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS id_org_destinataire BIGINT REFERENCES shared.organisation(id) ON DELETE SET NULL;

-- ── 2. Backfill id_org_emetteur depuis shared.membre_organisation ──────────────────────
UPDATE lot.transfert_lot t
SET    id_org_emetteur = mo.id_organisation
FROM   shared.membre_organisation mo
WHERE  mo.keycloak_username = t.username_emetteur
  AND  t.id_org_emetteur IS NULL;

-- ── 3. Backfill id_org_destinataire depuis shared.membre_organisation ─────────────────
UPDATE lot.transfert_lot t
SET    id_org_destinataire = mo.id_organisation
FROM   shared.membre_organisation mo
WHERE  mo.keycloak_username = t.username_destinataire
  AND  t.id_org_destinataire IS NULL;

-- ── 4. Index de performance ────────────────────────────────────────────────────────────
-- Requête principale : "Semences reçues par organisation"
CREATE INDEX IF NOT EXISTS idx_trflot_org_dest
    ON lot.transfert_lot (id_org_destinataire)
    WHERE id_org_destinataire IS NOT NULL;

-- Vue future "Semences envoyées par organisation"
CREATE INDEX IF NOT EXISTS idx_trflot_org_emit
    ON lot.transfert_lot (id_org_emetteur)
    WHERE id_org_emetteur IS NOT NULL;
