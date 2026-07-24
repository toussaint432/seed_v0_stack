-- Isolation par membre individuel : chaque multiplicateur/quotataire a ses propres sites
ALTER TABLE site ADD COLUMN IF NOT EXISTS id_membre BIGINT REFERENCES membre_organisation(id);

-- Zone agro-écologique du site (code ZAE : NAY, BA, ZSP, VF, SO, HC, MC, BC)
ALTER TABLE site ADD COLUMN IF NOT EXISTS zone_code VARCHAR(10);

-- Assigner les sites existants des multiplicateurs à leurs propriétaires respectifs
UPDATE site SET id_membre = (SELECT id FROM membre_organisation WHERE keycloak_username = 'multiplicateur')
WHERE code_site = 'FERME-MULTI-02';

UPDATE site SET id_membre = (SELECT id FROM membre_organisation WHERE keycloak_username = 'multi_fatick')
WHERE code_site = 'FERME-MULTI-03';

-- Assigner les sites quotataires à leurs membres
UPDATE site SET id_membre = (SELECT id FROM membre_organisation WHERE keycloak_username = 'quotataire')
WHERE code_site = 'SITE-OP-NORD';

UPDATE site SET id_membre = (SELECT id FROM membre_organisation WHERE keycloak_username = 'quotataire_centre')
WHERE code_site = 'SITE-OP-CENTRE';

UPDATE site SET id_membre = (SELECT id FROM membre_organisation WHERE keycloak_username = 'quotataire_casamance')
WHERE code_site = 'SITE-OP-CASAMANCE';
