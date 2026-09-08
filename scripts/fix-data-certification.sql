-- ══════════════════════════════════════════════════════════════════
-- Script correctif — état données certification Sen Jiw
-- À exécuter AVANT le rebuild des services (état base cohérent).
-- ══════════════════════════════════════════════════════════════════

SET search_path = lot, stock, shared, public;

BEGIN;

-- ── 1. Corriger REC-1-L40 : lot G3 reçu ne doit pas être en workflow certification
--    Ce lot a statut_certification = EN_ATTENTE suite à un upload accidentel
--    avant que le bouton UI ait été restreint aux G4/R1/R2.
UPDATE lot.lot_semencier
SET
    statut_certification    = 'SANS_CERTIFICAT',
    certificat_path         = NULL,
    approbateur_username    = NULL,
    date_approbation        = NULL,
    motif_rejet_cert        = NULL
WHERE code_lot = 'REC-1-L40';

-- ── 2. Confirmer les lots G3 de l'UPSemCL (statut_edition → CONFIRME)
--    Nécessaire après le rebuild : le catalogue G3 exige désormais CONFIRME.
--    Seuls les lots G3 DISPONIBLES de l'UPSemCL (pas les REC-*) sont confirmés.
UPDATE lot.lot_semencier
SET
    statut_edition   = 'CONFIRME',
    date_confirmation = NOW()
WHERE
    code_lot LIKE 'G3-%'
    AND statut_lot = 'DISPONIBLE'
    AND statut_edition = 'BROUILLON';

-- ── 3. Supprimer le stock fantôme de G3-ARA-28206-2026-01 chez le multiplicateur
--    Lors du faire-transfert, le stock du lot source a été crédité au site Kaolack.
--    Puis l'accuser-reception a créé REC-1-L40 avec son propre stock (50 kg).
--    Résultat : double crédit 50+50 kg. La source de vérité est REC-1-L40.
DELETE FROM stock.stock
WHERE
    id_lot = (
        SELECT id FROM lot.lot_semencier WHERE code_lot = 'G3-ARA-28206-2026-01'
    )
    AND id_site IN (
        SELECT s.id
        FROM stock.site s
        JOIN shared.organisation o ON o.id = s.id_organisation
        WHERE o.type_organisation = 'MULTIPLICATEUR'
    );

COMMIT;

-- ── Vérification post-exécution ──────────────────────────────────
SELECT
    ls.code_lot,
    g.code_generation,
    ls.statut_lot,
    ls.statut_edition,
    ls.statut_certification
FROM lot.lot_semencier ls
JOIN lot.generation_semence g ON g.id = ls.id_generation
WHERE g.code_generation IN ('G3','G4','R1','R2')
ORDER BY g.ordre_generation, ls.created_at;

SELECT
    ls.code_lot,
    g.code_generation,
    s.quantite_disponible,
    o.nom_organisation,
    si.nom_site
FROM stock.stock s
JOIN lot.lot_semencier ls ON ls.id = s.id_lot
JOIN lot.generation_semence g ON g.id = ls.id_generation
JOIN stock.site si ON si.id = s.id_site
JOIN shared.organisation o ON o.id = si.id_organisation
WHERE g.code_generation IN ('G3','G4','R1','R2')
  AND s.quantite_disponible > 0
ORDER BY g.ordre_generation, ls.code_lot;
