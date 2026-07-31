-- Spécialisation du sélectionneur : espèce / spéculation de référence
ALTER TABLE membre_organisation ADD COLUMN IF NOT EXISTS specialisation VARCHAR(255);
