-- Refactoring organisation CNRA : correction du discriminant type_organisation
-- et mise à jour du code/nom pour refléter le centre opérationnel réel (CNRA Bambey).
-- Suppression de UPSEMCL-STLOUIS (id=5) : hors périmètre opérationnel, aucune donnée liée.

-- 1. Supprimer la contrainte CHECK existante ('ISRA' dans la liste)
ALTER TABLE shared.organisation
    DROP CONSTRAINT IF EXISTS organisation_type_organisation_check;

-- 2. Mettre à jour les données AVANT de recréer la contrainte
UPDATE shared.organisation
SET code_organisation = 'CNRA-BAMBEY',
    nom_organisation  = 'CNRA Bambey',
    type_organisation = 'CNRA'
WHERE id = 1;

DELETE FROM shared.organisation WHERE id = 5;

-- 3. Recréer la contrainte avec 'CNRA' à la place de 'ISRA'
ALTER TABLE shared.organisation
    ADD CONSTRAINT organisation_type_organisation_check
    CHECK (type_organisation IN ('CNRA','UPSEMCL','MULTIPLICATEUR',
                                  'COOPERATIVE','DETAILLANT','ONG','AUTRE'));
