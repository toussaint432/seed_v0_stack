-- Contrainte DB : quantite_nette ne peut jamais être négative sur un lot semencier.
-- Cette garde complète la validation applicative (backend 400) et protège contre
-- les race conditions ou insertions directes en base.
ALTER TABLE lot_semencier
    ADD CONSTRAINT chk_quantite_nette_non_negative
    CHECK (quantite_nette IS NULL OR quantite_nette >= 0);
