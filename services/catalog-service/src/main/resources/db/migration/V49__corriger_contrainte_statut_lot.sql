-- ─────────────────────────────────────────────────────────────────────────────
-- V49 : Correction de la contrainte statut_lot — ajout des 4 valeurs manquantes
--
-- La contrainte Hibernate générée (lot_semencier_statut_lot_check) ne couvrait
-- que 6 valeurs sur les 10 déclarées dans l'enum StatutLot :
--   Manquants : DECLASS, EN_COURS_CERT, SOUCHE, PERDU
--
-- Toute tentative de mettre un lot dans un de ces statuts depuis le frontend
-- ou l'API déclenchait une DataIntegrityViolationException (500).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE lot.lot_semencier
  DROP CONSTRAINT IF EXISTS lot_semencier_statut_lot_check;

ALTER TABLE lot.lot_semencier
  ADD CONSTRAINT lot_semencier_statut_lot_check
    CHECK (statut_lot IN (
      'DISPONIBLE',
      'EN_PRODUCTION',
      'CERTIFIE',
      'TRANSFERE',
      'EPUISE',
      'RETIRE',
      'DECLASS',
      'EN_COURS_CERT',
      'SOUCHE',
      'PERDU'
    ));
