-- ============================================================
-- V16 — Champs production PCAE + sites de stockage multiplicateurs
--
-- Objectifs :
--   • Aligner lot_semencier sur la structure Excel PCAE (superficie,
--     production brute, rendement, cycle, niveau_semence)
--   • Tracer les semences-sources utilisées (quantite_semence_src_kg)
--   • Créer un site de stockage par organisation multiplicatrice
--     (nécessaire pour le crédit stock lors de la livraison)
-- ============================================================

-- ── 1. Colonnes de production sur lot_semencier ─────────────
ALTER TABLE lot_semencier
  ADD COLUMN IF NOT EXISTS superficie_ha            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS production_brute_kg      NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS rendement_kg_ha          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cycle                    CHAR(1),
  ADD COLUMN IF NOT EXISTS niveau_semence           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS quantite_semence_src_kg  NUMERIC(14,2);

COMMENT ON COLUMN lot_semencier.superficie_ha           IS 'Superficie plantée en hectares (source : tableau PCAE)';
COMMENT ON COLUMN lot_semencier.production_brute_kg     IS 'Récolte brute avant conditionnement (kg)';
COMMENT ON COLUMN lot_semencier.rendement_kg_ha         IS 'Rendement calculé : production_brute_kg / superficie_ha';
COMMENT ON COLUMN lot_semencier.cycle                   IS 'Cycle cultural : C = Court, L = Long';
COMMENT ON COLUMN lot_semencier.niveau_semence          IS 'Libellé officiel ex: "3 Semences de base G3"';
COMMENT ON COLUMN lot_semencier.quantite_semence_src_kg IS 'Kg de semences du lot parent utilisés pour cette campagne (planting seed)';

-- ── 2. Site de stockage par organisation multiplicatrice ─────
INSERT INTO site (code_site, nom_site, id_organisation)
SELECT
  'STOCK-' || UPPER(REPLACE(o.code_organisation, '-', '')),
  'Site de stockage — ' || o.nom_organisation,
  o.id
FROM organisation o
WHERE o.type_organisation = 'MULTIPLICATEUR'
  AND NOT EXISTS (
      SELECT 1 FROM site s WHERE s.id_organisation = o.id
  );
