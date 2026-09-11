-- V78 — Enrichissement modal commande : contact acheteur + contact fournisseur dénormalisés
-- Permet d'afficher Prénom NOM · Rôle / Organisation / Téléphone sans join en runtime.

ALTER TABLE orders.commande
  ADD COLUMN IF NOT EXISTS telephone_acheteur           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS role_acheteur                VARCHAR(80),
  ADD COLUMN IF NOT EXISTS nom_organisation_fournisseur VARCHAR(200),
  ADD COLUMN IF NOT EXISTS nom_complet_fournisseur      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS telephone_fournisseur        VARCHAR(50);
