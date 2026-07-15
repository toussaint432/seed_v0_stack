-- V25 : Stockage des documents PDF
-- fiche_varietale_path : chemin vers le PDF de fiche variétale (1 par variété)
-- itineraire_tech_path : chemin vers le PDF d'itinéraire technique (1 par espèce)

ALTER TABLE variete
  ADD COLUMN IF NOT EXISTS fiche_varietale_path VARCHAR(500);

ALTER TABLE espece
  ADD COLUMN IF NOT EXISTS itineraire_tech_path VARCHAR(500);
