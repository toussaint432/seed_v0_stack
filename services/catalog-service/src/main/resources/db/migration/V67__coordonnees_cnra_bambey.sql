-- V67 : Ajout des coordonnées GPS manquantes pour les sites sans latitude/longitude
--
-- Sites concernés :
--   • CNRA-BAMBEY  (site principal des sélectionneurs)
--   • ISRA-KAOLACK (station de recherche Kaolack)
-- Les multiplicateurs et quotataires ont déjà leurs coordonnées (V34).
-- Ces coordonnées sont nécessaires pour l'affichage des membres sur la carte du dashboard.
-- ══════════════════════════════════════════════════════════════════════════════

SET search_path TO stock, public;

UPDATE site
SET latitude  = 14.7028,
    longitude = -16.4412
WHERE code_site = 'CNRA-BAMBEY'
  AND (latitude IS NULL OR longitude IS NULL);

UPDATE site
SET latitude  = 14.1541,
    longitude = -16.0726
WHERE code_site = 'ISRA-KAOLACK'
  AND (latitude IS NULL OR longitude IS NULL);
