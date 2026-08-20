-- V60 : Référentiel Fonio officiel — 3 variétés : Fofana · Fonio bi · Niata

DELETE FROM catalog.variete WHERE code_variete = 'FON-LOCAL1';

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, statut_variete)
SELECT 'FON-FONIOB', 'Fonio bi', e.id, 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'FON'
ON CONFLICT (code_variete) DO NOTHING;
