-- ─────────────────────────────────────────────────────────────────────────────
-- V62 : Lots de production R1 — campagne 2026 par variété × zone d'adaptation
--
-- Génère un lot R1 par combinaison (variété, zone) depuis catalog.variete_zone.
-- Organisation productrice : GIE/coopérative de la zone concernée.
-- Toutes les variétés en statut DIFFUSEE.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO lot.lot_semencier (
    code_lot,
    id_variete,
    id_generation,
    campagne,
    code_espece,
    statut_lot,
    statut_certification,
    id_org_producteur,
    username_createur,
    unite
)
SELECT
    'R1-' || v.code_variete || '-2026-' || z.code AS code_lot,
    v.id                                           AS id_variete,
    6                                              AS id_generation,  -- R1
    '2026'                                         AS campagne,
    e.code_espece,
    'DISPONIBLE'                                   AS statut_lot,
    'SANS_CERTIFICAT'                              AS statut_certification,
    CASE z.code
        WHEN 'BA'  THEN 4   -- Coopérative Sine-Saloum Semences
        WHEN 'BC'  THEN 29  -- GIE Semences Basse Casamance
        WHEN 'HC'  THEN 26  -- GIE Semences Haute Casamance
        WHEN 'MC'  THEN 28  -- GIE Semences Moyenne Casamance
        WHEN 'NAY' THEN 27  -- GIE Semences des Niayes
        WHEN 'SO'  THEN 24  -- GIE Semences Orientales
        WHEN 'VF'  THEN 25  -- GIE Semences du Delta
        WHEN 'ZSP' THEN 23  -- GIE Semencier du Ferlo
    END                                            AS id_org_producteur,
    CASE z.code
        WHEN 'BA'  THEN 'multi_fatick'
        WHEN 'BC'  THEN 'multi_bc_ziguinchor'
        WHEN 'HC'  THEN 'multi_hc_kolda'
        WHEN 'MC'  THEN 'multi_mc_sedhiou'
        WHEN 'NAY' THEN 'multi_nay_thies'
        WHEN 'SO'  THEN 'multi_so_tambacounda'
        WHEN 'VF'  THEN 'multi_vf_stlouis'
        WHEN 'ZSP' THEN 'multi_zsp_louga'
    END                                            AS username_createur,
    'kg'                                           AS unite
FROM catalog.variete_zone vz
JOIN catalog.variete v ON v.id = vz.id_variete
JOIN catalog.espece  e ON e.id = v.id_espece
JOIN geo.zone_agro   z ON z.id = vz.id_zone
WHERE v.statut_variete = 'DIFFUSEE'
ON CONFLICT (code_lot) DO NOTHING;
