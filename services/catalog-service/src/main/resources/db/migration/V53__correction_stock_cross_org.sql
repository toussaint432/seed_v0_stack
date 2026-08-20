-- ─────────────────────────────────────────────────────────────────────────────
-- V53 : Correction des entrées stock inter-organisations
--
-- Après V52, deux incohérences subsistent :
--   • Lot 15 (G3-MIL, id_org=4, multi_fatick) a son stock à FERME-MULTI-02
--     (désormais propriété de MULTI-KAOLACK-02 / multiplicateur)
--   • Lots 33-34 (SIM-R1/R2, id_org=MULTI-KAOLACK-02, multiplicateur) ont
--     leur stock à FERME-MULTI-03 (propriété de MULTI-SINSALOU / multi_fatick)
--
-- Correction : déplacer chaque stock vers le site de son organisation productrice.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Lot 15 (G3-MIL, multi_fatick) : déplacer FERME-MULTI-02 → FERME-MULTI-03
UPDATE stock.stock
SET id_site = (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-03')
WHERE id_lot = 15
  AND id_site = (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-02');

-- 2. Lot 33 (SIM-R1, multiplicateur) : déplacer FERME-MULTI-03 → FERME-MULTI-02
UPDATE stock.stock
SET id_site = (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-02')
WHERE id_lot = 33
  AND id_site = (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-03');

-- 3. Lot 34 (SIM-R2, multiplicateur) : déplacer FERME-MULTI-03 → FERME-MULTI-02
UPDATE stock.stock
SET id_site = (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-02')
WHERE id_lot = 34
  AND id_site = (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-03');
