-- V28 : Colonne certificat_path sur lot_semencier
-- Stocke le chemin relatif du certificat officiel (PDF ou image) attaché au lot.
ALTER TABLE lot_semencier ADD COLUMN IF NOT EXISTS certificat_path VARCHAR(500);
