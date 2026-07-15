-- V32 : Restauration de la variété Nerica 4 (supprimée par erreur)
-- Source   : Fiche variétale officielle AfricaRice / ISRA Sénégal
-- Famille  : NERICA pluvial (Oryza glaberrima × O. sativa) — homologation 2009
-- Cohérence: cycle 95–105 j (identique à Nerica 1), pedigree WAB 56-104/CG14
--            (identique à Nerica 5 et 6), rendement 3.5–4.5 t/ha

DO $$
DECLARE riz_id BIGINT;
BEGIN
  SELECT id INTO riz_id FROM espece WHERE code_espece = 'RIZ';
  IF riz_id IS NULL THEN
    RAISE EXCEPTION 'Espèce RIZ introuvable';
  END IF;

  INSERT INTO variete (
    code_variete, nom_variete, id_espece,
    origine, selectionneur_principal,
    annee_creation, cycle_min, cycle_max,
    pedigree, type_grain,
    rendement_min, rendement_max,
    statut_variete, date_creation
  ) VALUES (
    'RIZ-NERICA4',
    'Nerica 4',
    riz_id,
    'Bouaké, Côte d''Ivoire',
    'ISRA-AfricaRice',
    2009, 95, 105,
    'WAB 56-104 / CG14 — culture pluviale centre et sud Sénégal',
    'Hybride interspécifique (NERICA)',
    3.5, 4.5,
    'DIFFUSEE',
    NOW()
  )
  ON CONFLICT (code_variete) DO NOTHING;

END $$;
