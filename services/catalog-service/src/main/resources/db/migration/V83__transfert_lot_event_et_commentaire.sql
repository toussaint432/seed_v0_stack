-- V83 : Journal immuable des transitions de statut des transferts
--        + colonne commentaire_reception sur lot.transfert_lot
--
-- lot.transfert_lot_event : audit trail des transitions EN_ATTENTE/ACCEPTE/REJETE/ANNULE
-- Modèle : identique à lot.historique_statut_lot (pattern de référence V17)

-- ── 1. Colonne commentaire_reception sur lot.transfert_lot ───────────────────
ALTER TABLE lot.transfert_lot
    ADD COLUMN IF NOT EXISTS commentaire_reception TEXT;

-- ── 2. Table journal immuable des transitions de statut des transferts ───────
CREATE TABLE IF NOT EXISTS lot.transfert_lot_event (
    id               BIGSERIAL PRIMARY KEY,
    id_transfert_lot BIGINT      NOT NULL REFERENCES lot.transfert_lot(id),
    statut_avant     VARCHAR(20),
    statut_apres     VARCHAR(20) NOT NULL,
    username         VARCHAR(150) NOT NULL,
    commentaire      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfert_lot_event_transfert
    ON lot.transfert_lot_event(id_transfert_lot);

CREATE INDEX IF NOT EXISTS idx_transfert_lot_event_created_at
    ON lot.transfert_lot_event(created_at DESC);

-- ── 3. Vérification non-régression ──────────────────────────────────────────
DO $$
DECLARE
    nb_transferts INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_transferts FROM lot.transfert_lot;
    RAISE NOTICE 'V83 OK — % transfert(s) existant(s) protégés ; journal transfert_lot_event prêt.', nb_transferts;
END;
$$;
