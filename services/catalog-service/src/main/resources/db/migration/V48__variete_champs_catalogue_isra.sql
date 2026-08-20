-- ─────────────────────────────────────────────────────────────────────────────
-- V48 : Ajout des champs catalogue officiels ISRA/CNRA à la table variete
--
-- Champs ajoutés d'après les fiches variétales ISRA (Arachide Fleur11, Mil
-- Souna3, Riz Sahel108, Niébé Yacine, Maïs Jaboot, Sorgho Nganda) :
--   - annee_homologation : année d'inscription officielle au catalogue
--   - nature_genetique   : statut génétique (Lignée pure, Hybride F1, OPV…)
--   - numero_selection   : référence interne de sélection (ex : IS 9830)
--   - vocation_culturale : usages cibles (Pluvial bas-fonds, Irrigué irrigué…)
--   - photosensibilite   : réponse au photopériodisme (Sensible, Neutre)
--   - synonyme           : nom(s) alternatif(s) ou numéro de sélection public
--
-- Correction d'anomalie :
--   - itineraire_tech_path : colonne référencée dans le frontend mais absente
--     de la table (chemin vers le PDF itinéraire technique au niveau espèce
--     — champ maintenu ici pour la traçabilité variétale, l'upload reste au
--     niveau espèce)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE catalog.variete
  ADD COLUMN IF NOT EXISTS annee_homologation  INTEGER,
  ADD COLUMN IF NOT EXISTS nature_genetique    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS numero_selection    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vocation_culturale  TEXT,
  ADD COLUMN IF NOT EXISTS photosensibilite    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS synonyme            VARCHAR(200),
  ADD COLUMN IF NOT EXISTS itineraire_tech_path VARCHAR(500);

COMMENT ON COLUMN catalog.variete.annee_homologation  IS 'Année d''inscription officielle au catalogue national';
COMMENT ON COLUMN catalog.variete.nature_genetique    IS 'Statut génétique : Lignée pure, Hybride F1, OPV, etc.';
COMMENT ON COLUMN catalog.variete.numero_selection    IS 'Référence interne de sélection ISRA/CNRA (ex : IS 9830)';
COMMENT ON COLUMN catalog.variete.vocation_culturale  IS 'Systèmes de culture cibles (ex : Pluvial, Irrigué, Bas-fonds)';
COMMENT ON COLUMN catalog.variete.photosensibilite    IS 'Réponse au photopériodisme : Sensible, Neutre, Peu sensible';
COMMENT ON COLUMN catalog.variete.synonyme            IS 'Nom(s) alternatif(s) ou code de sélection connu publiquement';
COMMENT ON COLUMN catalog.variete.itineraire_tech_path IS 'Chemin relatif vers le PDF itinéraire technique (ex : itineraires/v123.pdf)';
