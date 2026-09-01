-- Dénormalisation du nom et code variété dans lot_semencier
-- Évite les appels inter-services pour afficher les graphes de production
ALTER TABLE lot.lot_semencier
  ADD COLUMN IF NOT EXISTS nom_variete   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS code_variete  VARCHAR(50);

-- Enrichissement identité acheteur dans commande
-- Peuplé à la création depuis membre_organisation, évite les joins coûteux à la lecture
ALTER TABLE orders.commande
  ADD COLUMN IF NOT EXISTS nom_complet_acheteur      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS nom_organisation_acheteur VARCHAR(200),
  ADD COLUMN IF NOT EXISTS localisation_acheteur     VARCHAR(200);
