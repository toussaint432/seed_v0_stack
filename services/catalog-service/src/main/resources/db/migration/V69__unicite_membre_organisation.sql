-- Prévention des doublons : même personne, même organisation, même rôle
ALTER TABLE shared.membre_organisation
  ADD CONSTRAINT uq_membre_org_role
  UNIQUE (nom_complet, id_organisation, keycloak_role);
