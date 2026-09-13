-- V84 : Bordereau persisté + statuts TRANSFERE/RECEPTIONNEE + commentaire réception
--
-- Flux cible 5 étapes :
--   SOUMISE → EN_NEGOCIATION → ACCEPTEE → TRANSFERE → RECEPTIONNEE
--
-- TRANSFERE  : déclencheur unique atomique (lot + stock + facture + bordereau)
-- RECEPTIONNEE : acheteur confirme réception physique + commentaire contestation

-- ── 1. Mise à jour du CHECK constraint orders.commande.statut ────────────────
--    Ajoute TRANSFERE et RECEPTIONNEE (garde tous les statuts existants pour
--    la rétro-compatibilité des 27 commandes déjà en production)
ALTER TABLE orders.commande DROP CONSTRAINT IF EXISTS commande_statut_check;

ALTER TABLE orders.commande
    ADD CONSTRAINT commande_statut_check
    CHECK (statut IN (
        'SOUMISE',
        'EN_NEGOCIATION',
        'ACCEPTEE',
        'ACCORDEE',
        'EN_LIVRAISON',
        'LIVREE',
        'ANNULEE',
        'REJETEE',
        'EN_PREPARATION',
        'TRANSFERE',
        'RECEPTIONNEE'
    ));

-- ── 2. Colonne commentaire_reception sur orders.commande ─────────────────────
ALTER TABLE orders.commande
    ADD COLUMN IF NOT EXISTS commentaire_reception TEXT;

-- ── 3. Nouvelle table orders.bordereau ───────────────────────────────────────
--    Métadonnées des bordereaux émis — sans stockage du blob PDF.
--    Bilatérale : acheteur ET vendeur peuvent retrouver le document via id_org.
CREATE TABLE IF NOT EXISTS orders.bordereau (
    id                  BIGSERIAL    PRIMARY KEY,
    type_bordereau      VARCHAR(30)  NOT NULL
                            CHECK (type_bordereau IN ('BORDEREAU_UNIFIE', 'BORDEREAU_TRANSFERT')),
    numero_bordereau    VARCHAR(50)  NOT NULL UNIQUE,
    id_commande         BIGINT       REFERENCES orders.commande(id),
    id_transfert_lot    BIGINT,
    date_emission       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    username_emetteur   VARCHAR(150) NOT NULL,
    id_org_emetteur     BIGINT       NOT NULL,
    id_org_destinataire BIGINT       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bordereau_commande
    ON orders.bordereau(id_commande);

CREATE INDEX IF NOT EXISTS idx_bordereau_org_emetteur
    ON orders.bordereau(id_org_emetteur);

CREATE INDEX IF NOT EXISTS idx_bordereau_org_destinataire
    ON orders.bordereau(id_org_destinataire);

-- ── 4. Vérification non-régression ──────────────────────────────────────────
DO $$
DECLARE
    nb_cmd INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_cmd FROM orders.commande;
    RAISE NOTICE 'V84 OK — % commande(s) existante(s) ; nouveaux statuts TRANSFERE/RECEPTIONNEE disponibles.', nb_cmd;
END;
$$;
