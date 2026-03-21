
-- Modele relationnel pour une plateforme de gestion des semences agricoles
-- Compatible PostgreSQL avec ajustements mineurs pour MySQL

CREATE TABLE role (
    id_role BIGSERIAL PRIMARY KEY,
    code_role VARCHAR(50) NOT NULL UNIQUE,
    libelle VARCHAR(100) NOT NULL
);

CREATE TABLE type_organisation (
    id_type_org BIGSERIAL PRIMARY KEY,
    code_type VARCHAR(50) NOT NULL UNIQUE,
    libelle VARCHAR(100) NOT NULL
);

CREATE TABLE organisation (
    id_organisation BIGSERIAL PRIMARY KEY,
    nom VARCHAR(200) NOT NULL,
    sigle VARCHAR(50),
    id_type_org BIGINT NOT NULL REFERENCES type_organisation(id_type_org),
    telephone VARCHAR(50),
    email VARCHAR(150),
    adresse TEXT,
    statut_actif BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE utilisateur (
    id_utilisateur BIGSERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    mot_de_passe_hash TEXT NOT NULL,
    id_role BIGINT NOT NULL REFERENCES role(id_role),
    id_organisation BIGINT REFERENCES organisation(id_organisation),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE espece (
    id_espece BIGSERIAL PRIMARY KEY,
    code_espece VARCHAR(50) NOT NULL UNIQUE,
    nom_commun VARCHAR(100) NOT NULL,
    nom_scientifique VARCHAR(150)
);

CREATE TABLE generation_semence (
    id_generation BIGSERIAL PRIMARY KEY,
    code_generation VARCHAR(20) NOT NULL UNIQUE,
    ordre_generation INTEGER NOT NULL,
    description TEXT
);

CREATE TABLE classe_semence (
    id_classe BIGSERIAL PRIMARY KEY,
    code_classe VARCHAR(50) NOT NULL UNIQUE,
    libelle VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE campagne (
    id_campagne BIGSERIAL PRIMARY KEY,
    code_campagne VARCHAR(50) NOT NULL UNIQUE,
    libelle VARCHAR(150) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    type_campagne VARCHAR(50),
    statut VARCHAR(50)
);

CREATE TABLE site (
    id_site BIGSERIAL PRIMARY KEY,
    code_site VARCHAR(50) UNIQUE,
    nom_site VARCHAR(150) NOT NULL,
    type_site VARCHAR(50) NOT NULL,
    localite VARCHAR(100),
    region VARCHAR(100),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    id_organisation BIGINT REFERENCES organisation(id_organisation)
);

CREATE TABLE variete (
    id_variete BIGSERIAL PRIMARY KEY,
    code_variete VARCHAR(50) NOT NULL UNIQUE,
    nom_variete VARCHAR(150) NOT NULL,
    id_espece BIGINT NOT NULL REFERENCES espece(id_espece),
    origine VARCHAR(200),
    selectionneur_principal VARCHAR(150),
    annee_creation INTEGER,
    cycle_jours INTEGER,
    description_morphologique TEXT,
    caracteristiques_agronomiques TEXT,
    zone_recommandee TEXT,
    statut_variete VARCHAR(50) NOT NULL DEFAULT 'en_test',
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lot_semencier (
    id_lot BIGSERIAL PRIMARY KEY,
    code_lot VARCHAR(80) NOT NULL UNIQUE,
    id_variete BIGINT NOT NULL REFERENCES variete(id_variete),
    id_generation BIGINT NOT NULL REFERENCES generation_semence(id_generation),
    id_classe BIGINT REFERENCES classe_semence(id_classe),
    id_lot_parent BIGINT REFERENCES lot_semencier(id_lot),
    id_campagne BIGINT REFERENCES campagne(id_campagne),
    id_organisation_responsable BIGINT REFERENCES organisation(id_organisation),
    id_site_origine BIGINT REFERENCES site(id_site),
    date_production DATE,
    date_recolte DATE,
    quantite_initiale DECIMAL(14,3),
    unite_quantite VARCHAR(20) NOT NULL DEFAULT 'kg',
    quantite_nette DECIMAL(14,3),
    stock_disponible DECIMAL(14,3) NOT NULL DEFAULT 0,
    taux_germination DECIMAL(5,2),
    taux_humidite DECIMAL(5,2),
    purete_physique DECIMAL(5,2),
    conformite_varietale VARCHAR(50),
    statut_lot VARCHAR(50) NOT NULL DEFAULT 'en_production',
    observations TEXT,
    cree_par BIGINT REFERENCES utilisateur(id_utilisateur),
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE programme_multiplication (
    id_programme BIGSERIAL PRIMARY KEY,
    code_programme VARCHAR(80) NOT NULL UNIQUE,
    id_lot_source BIGINT NOT NULL REFERENCES lot_semencier(id_lot),
    id_generation_cible BIGINT NOT NULL REFERENCES generation_semence(id_generation),
    id_multiplicateur BIGINT NOT NULL REFERENCES organisation(id_organisation),
    id_campagne BIGINT NOT NULL REFERENCES campagne(id_campagne),
    surface_prevue_ha DECIMAL(12,3),
    quantite_semence_allouee DECIMAL(14,3),
    date_attribution DATE,
    statut_programme VARCHAR(50) NOT NULL DEFAULT 'planifie',
    observations TEXT,
    id_lot_produit BIGINT REFERENCES lot_semencier(id_lot)
);

CREATE TABLE parcelle_multiplication (
    id_parcelle BIGSERIAL PRIMARY KEY,
    id_programme BIGINT NOT NULL REFERENCES programme_multiplication(id_programme) ON DELETE CASCADE,
    code_parcelle VARCHAR(80),
    localisation VARCHAR(200),
    superficie_ha DECIMAL(12,3),
    date_semis DATE,
    date_recolte_prevue DATE,
    date_recolte_reelle DATE,
    observations TEXT
);

CREATE TABLE rendement_production (
    id_rendement BIGSERIAL PRIMARY KEY,
    id_programme BIGINT NOT NULL REFERENCES programme_multiplication(id_programme) ON DELETE CASCADE,
    rendement_prevu_kg_ha DECIMAL(12,3),
    rendement_reel_kg_ha DECIMAL(12,3),
    quantite_recoltee_totale DECIMAL(14,3),
    pertes_estimees DECIMAL(14,3),
    date_saisie DATE,
    observations TEXT
);

CREATE TABLE controle_qualite (
    id_controle BIGSERIAL PRIMARY KEY,
    id_lot BIGINT NOT NULL REFERENCES lot_semencier(id_lot) ON DELETE CASCADE,
    type_controle VARCHAR(50) NOT NULL,
    date_controle DATE NOT NULL,
    taux_germination DECIMAL(5,2),
    taux_humidite DECIMAL(5,2),
    purete_physique DECIMAL(5,2),
    purete_specifique DECIMAL(5,2),
    conformite_varietale VARCHAR(50),
    resultat VARCHAR(50) NOT NULL,
    observations TEXT,
    controleur VARCHAR(150)
);

CREATE TABLE certification (
    id_certification BIGSERIAL PRIMARY KEY,
    id_lot BIGINT NOT NULL REFERENCES lot_semencier(id_lot) ON DELETE CASCADE,
    organisme_certificateur VARCHAR(200) NOT NULL,
    numero_certificat VARCHAR(100) NOT NULL UNIQUE,
    date_demande DATE,
    date_inspection DATE,
    date_certification DATE,
    resultat_certification VARCHAR(50) NOT NULL,
    motif_rejet TEXT,
    date_expiration DATE
);

CREATE TABLE stock (
    id_stock BIGSERIAL PRIMARY KEY,
    id_lot BIGINT NOT NULL REFERENCES lot_semencier(id_lot) ON DELETE CASCADE,
    id_site BIGINT NOT NULL REFERENCES site(id_site),
    quantite_disponible DECIMAL(14,3) NOT NULL DEFAULT 0,
    unite_quantite VARCHAR(20) NOT NULL DEFAULT 'kg',
    date_mise_a_jour TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    statut_stock VARCHAR(50),
    CONSTRAINT uq_stock_lot_site UNIQUE (id_lot, id_site)
);

CREATE TABLE mouvement_stock (
    id_mouvement BIGSERIAL PRIMARY KEY,
    id_lot BIGINT NOT NULL REFERENCES lot_semencier(id_lot),
    type_mouvement VARCHAR(50) NOT NULL,
    id_site_source BIGINT REFERENCES site(id_site),
    id_site_destination BIGINT REFERENCES site(id_site),
    quantite DECIMAL(14,3) NOT NULL,
    unite_quantite VARCHAR(20) NOT NULL DEFAULT 'kg',
    date_mouvement TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_operation VARCHAR(100),
    id_utilisateur BIGINT REFERENCES utilisateur(id_utilisateur),
    observations TEXT
);

CREATE TABLE transfert (
    id_transfert BIGSERIAL PRIMARY KEY,
    code_transfert VARCHAR(80) NOT NULL UNIQUE,
    id_lot BIGINT NOT NULL REFERENCES lot_semencier(id_lot),
    organisation_source BIGINT NOT NULL REFERENCES organisation(id_organisation),
    organisation_destination BIGINT NOT NULL REFERENCES organisation(id_organisation),
    site_source BIGINT REFERENCES site(id_site),
    site_destination BIGINT REFERENCES site(id_site),
    quantite_transferee DECIMAL(14,3) NOT NULL,
    date_demande DATE NOT NULL,
    date_validation DATE,
    date_reception DATE,
    statut_transfert VARCHAR(50) NOT NULL DEFAULT 'demande',
    valide_par BIGINT REFERENCES utilisateur(id_utilisateur),
    receptionne_par BIGINT REFERENCES utilisateur(id_utilisateur),
    observations TEXT
);

CREATE TABLE commande (
    id_commande BIGSERIAL PRIMARY KEY,
    code_commande VARCHAR(80) NOT NULL UNIQUE,
    id_client_org BIGINT NOT NULL REFERENCES organisation(id_organisation),
    date_commande DATE NOT NULL,
    statut_commande VARCHAR(50) NOT NULL DEFAULT 'brouillon',
    montant_estime DECIMAL(14,2),
    observations TEXT
);

CREATE TABLE ligne_commande (
    id_ligne_commande BIGSERIAL PRIMARY KEY,
    id_commande BIGINT NOT NULL REFERENCES commande(id_commande) ON DELETE CASCADE,
    id_variete BIGINT NOT NULL REFERENCES variete(id_variete),
    id_generation BIGINT REFERENCES generation_semence(id_generation),
    quantite_demandee DECIMAL(14,3) NOT NULL,
    unite_quantite VARCHAR(20) NOT NULL DEFAULT 'kg',
    quantite_validee DECIMAL(14,3),
    quantite_livree DECIMAL(14,3),
    observations TEXT
);

CREATE TABLE attribution_commande (
    id_attribution BIGSERIAL PRIMARY KEY,
    id_ligne_commande BIGINT NOT NULL REFERENCES ligne_commande(id_ligne_commande) ON DELETE CASCADE,
    id_lot BIGINT NOT NULL REFERENCES lot_semencier(id_lot),
    quantite_attribuee DECIMAL(14,3) NOT NULL,
    date_attribution DATE NOT NULL,
    observations TEXT
);

CREATE TABLE distribution (
    id_distribution BIGSERIAL PRIMARY KEY,
    id_commande BIGINT NOT NULL REFERENCES commande(id_commande) ON DELETE CASCADE,
    date_distribution DATE,
    mode_distribution VARCHAR(50),
    recepteur VARCHAR(150),
    reference_bon_livraison VARCHAR(100),
    statut_distribution VARCHAR(50),
    observations TEXT
);

CREATE TABLE document_joint (
    id_document BIGSERIAL PRIMARY KEY,
    type_objet VARCHAR(50) NOT NULL,
    id_objet BIGINT NOT NULL,
    nom_fichier VARCHAR(255) NOT NULL,
    chemin_fichier TEXT NOT NULL,
    type_document VARCHAR(100),
    date_upload TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    charge_par BIGINT REFERENCES utilisateur(id_utilisateur)
);

CREATE TABLE historique_statut_lot (
    id_historique BIGSERIAL PRIMARY KEY,
    id_lot BIGINT NOT NULL REFERENCES lot_semencier(id_lot) ON DELETE CASCADE,
    ancien_statut VARCHAR(50),
    nouveau_statut VARCHAR(50) NOT NULL,
    date_changement TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_utilisateur BIGINT REFERENCES utilisateur(id_utilisateur),
    motif TEXT
);

CREATE INDEX idx_lot_variete ON lot_semencier(id_variete);
CREATE INDEX idx_lot_generation ON lot_semencier(id_generation);
CREATE INDEX idx_lot_parent ON lot_semencier(id_lot_parent);
CREATE INDEX idx_stock_site ON stock(id_site);
CREATE INDEX idx_mvt_lot_date ON mouvement_stock(id_lot, date_mouvement);
CREATE INDEX idx_transfert_statut ON transfert(statut_transfert);
CREATE INDEX idx_cmd_client ON commande(id_client_org);
CREATE INDEX idx_ctrl_lot ON controle_qualite(id_lot);
CREATE INDEX idx_cert_lot ON certification(id_lot);
