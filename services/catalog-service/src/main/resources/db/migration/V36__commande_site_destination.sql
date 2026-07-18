-- V36 : Ajout du site de destination choisi par le multiplicateur lors de l'acceptation de proposition
ALTER TABLE commande ADD COLUMN IF NOT EXISTS site_destination_code VARCHAR(50);
