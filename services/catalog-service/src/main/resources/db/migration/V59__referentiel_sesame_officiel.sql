-- ─────────────────────────────────────────────────────────────────────────────
-- V59 : Référentiel Sésame officiel — 10 variétés homologuées ISRA/CNRA Bambey
--
-- Variétés retenues :
--   Niangballo (EF 153) · Boureima (HB 168) · Diouffène · Isrita (LC 164)
--   32-15 · 38-1-7 · Jaalgon 128 (S-42) · Namsubani · Akdeniz · SN-403
--
-- Actions :
--   1. Supprimer les variétés hors catalogue officiel (0 lots) : Goudas, ISRA Sésame 1
--   2. Insérer les 8 variétés manquantes
-- Note : données agronomiques à compléter depuis fiches techniques ISRA
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 1 : Supprimer les variétés hors catalogue (0 lots, zones cascadées)
-- ═══════════════════════════════════════════════════════════════════════

DELETE FROM catalog.variete WHERE code_variete IN ('SES-GOUDAS', 'SES-ISRA1');

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 : Insérer les 8 variétés officielles manquantes
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'SES-DIOUFFENE', 'Diouffène', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'SES'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'SES-ISRITA', 'Isrita', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'SES'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'SES-3215', '32-15', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'SES'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'SES-38-1-7', '38-1-7', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'SES'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'SES-JAALGON128', 'Jaalgon 128', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'SES'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'SES-NAMSUBANI', 'Namsubani', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'SES'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'SES-AKDENIZ', 'Akdeniz', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'SES'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'SES-SN403', 'SN-403', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'SES'
ON CONFLICT (code_variete) DO NOTHING;
