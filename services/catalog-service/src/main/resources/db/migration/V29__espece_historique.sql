-- Traçabilité des actions admin sur les espèces
CREATE TABLE IF NOT EXISTS espece_historique (
    id                 BIGSERIAL PRIMARY KEY,
    id_espece          BIGINT       NOT NULL REFERENCES espece(id) ON DELETE CASCADE,
    action             VARCHAR(30)  NOT NULL,  -- CREATION, MODIFICATION, SUPPRESSION
    champ              VARCHAR(100),
    ancienne_valeur    TEXT,
    nouvelle_valeur    TEXT,
    modifie_par        VARCHAR(255) NOT NULL,
    date_modification  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_espece_historique_id_espece ON espece_historique(id_espece);
CREATE INDEX idx_espece_historique_date     ON espece_historique(date_modification DESC);
