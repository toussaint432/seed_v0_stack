-- Migration V001 — Journal d'activité utilisateur
-- Service   : order-service
-- Schéma    : orders
-- À exécuter : une seule fois par environnement (local, staging, production)
-- Commande  : psql -U seed -d seed -f V001__create_user_audit_log.sql

CREATE TABLE IF NOT EXISTS orders.user_audit_log (
    id          BIGSERIAL    PRIMARY KEY,
    username    VARCHAR(150) NOT NULL,
    action_type VARCHAR(60)  NOT NULL,
    description TEXT         NOT NULL,
    entity_ref  VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_username
    ON orders.user_audit_log (username);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
    ON orders.user_audit_log (created_at);
