-- ─────────────────────────────────────────────────────────────────────────────
-- V55 : Suppression définitive de l'espèce Soja (SOJ) de la plateforme
--
-- Le soja ne fait pas partie du portefeuille semencier ISRA/CNRA Bambey.
--
-- Dépendances supprimées par CASCADE :
--   • catalog.variete (SOJ-DOUE, SOJ-TGM) → catalog.variete_zone (4 lignes)
--   • catalog.espece (SOJ) → catalog.espece_historique
--
-- Prérequis vérifiés : 0 lot_semencier, 0 ligne_commande référencent ces variétés.
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM catalog.variete
WHERE id_espece = (SELECT id FROM catalog.espece WHERE code_espece = 'SOJ');

DELETE FROM catalog.espece
WHERE code_espece = 'SOJ';
