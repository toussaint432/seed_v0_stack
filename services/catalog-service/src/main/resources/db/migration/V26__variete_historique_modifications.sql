-- ─────────────────────────────────────────────────────────────────────────
-- V26 : Historique des modifications de variétés
--       Traçabilité champ par champ (auteur, date, ancienne/nouvelle valeur)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS variete_historique (
    id                BIGSERIAL    PRIMARY KEY,
    id_variete        BIGINT       NOT NULL REFERENCES variete(id) ON DELETE CASCADE,
    champ             VARCHAR(100) NOT NULL,
    ancienne_valeur   TEXT,
    nouvelle_valeur   TEXT,
    modifie_par       VARCHAR(255) NOT NULL,
    date_modification TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variete_hist_variete_date
    ON variete_historique(id_variete, date_modification DESC);
