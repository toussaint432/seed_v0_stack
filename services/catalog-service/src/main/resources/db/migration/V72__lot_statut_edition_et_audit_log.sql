-- V72 : politique d'édition des lots (BROUILLON/CONFIRME) + journal d'audit

ALTER TABLE lot.lot_semencier
    ADD COLUMN IF NOT EXISTS statut_edition   VARCHAR(20)  NOT NULL DEFAULT 'BROUILLON',
    ADD COLUMN IF NOT EXISTS date_confirmation TIMESTAMPTZ;

-- Table d'audit append-only : enregistre chaque modification de champ
CREATE TABLE IF NOT EXISTS lot.lot_audit_log (
    id              BIGSERIAL    PRIMARY KEY,
    lot_id          BIGINT       NOT NULL REFERENCES lot.lot_semencier(id) ON DELETE CASCADE,
    username        VARCHAR(150) NOT NULL,
    action          VARCHAR(30)  NOT NULL,   -- MODIFICATION | SUPPRESSION | CONFIRMATION
    champ           VARCHAR(100),             -- nom du champ modifié (NULL si action globale)
    ancienne_valeur TEXT,
    nouvelle_valeur TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_lot_id    ON lot.lot_audit_log(lot_id);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON lot.lot_audit_log(created_at DESC);
