-- V41 : Workflow de certification des lots (G4/R1/R2) par UPSemCL / Admin
-- Statuts : SANS_CERTIFICAT (rouge) | EN_ATTENTE (jaune) | CERTIFIE (vert) | REJETE (rouge)

ALTER TABLE lot_semencier
    ADD COLUMN IF NOT EXISTS statut_certification VARCHAR(20)  NOT NULL DEFAULT 'SANS_CERTIFICAT',
    ADD COLUMN IF NOT EXISTS approbateur_username VARCHAR(150),
    ADD COLUMN IF NOT EXISTS date_approbation     TIMESTAMP,
    ADD COLUMN IF NOT EXISTS motif_rejet_cert     TEXT;

-- Contrainte de valeurs
ALTER TABLE lot_semencier
    DROP CONSTRAINT IF EXISTS chk_statut_certification;
ALTER TABLE lot_semencier
    ADD CONSTRAINT chk_statut_certification
    CHECK (statut_certification IN ('SANS_CERTIFICAT','EN_ATTENTE','CERTIFIE','REJETE'));

-- Index partiel sur les lots en attente (requête principale du panneau UPSemCL)
CREATE INDEX IF NOT EXISTS idx_lot_statut_cert
    ON lot_semencier (statut_certification)
    WHERE statut_certification = 'EN_ATTENTE';

-- Rétrocompatibilité : lots qui ont déjà un certificat uploadé → EN_ATTENTE
UPDATE lot_semencier
SET statut_certification = 'EN_ATTENTE'
WHERE certificat_path IS NOT NULL
  AND statut_certification = 'SANS_CERTIFICAT';
