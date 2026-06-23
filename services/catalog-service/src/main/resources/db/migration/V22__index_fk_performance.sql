-- V22 : Index sur colonnes FK non indexées
--        Améliore les performances des JOIN, DELETE en cascade et requêtes filtrées.
--        Utilisation de IF NOT EXISTS pour idempotence (safe en cas de re-run).

CREATE INDEX IF NOT EXISTS idx_commande_org_fournisseur
    ON commande(id_organisation_fournisseur);

CREATE INDEX IF NOT EXISTS idx_ligne_commande_variete
    ON ligne_commande(id_variete);

CREATE INDEX IF NOT EXISTS idx_ligne_commande_generation
    ON ligne_commande(id_generation);

CREATE INDEX IF NOT EXISTS idx_rendement_production_parcelle
    ON rendement_production(id_parcelle);

CREATE INDEX IF NOT EXISTS idx_site_organisation
    ON site(id_organisation);
