-- ============================================================
-- V43 — Documentation des décisions d'architecture intentionnelles
-- Auteur : ISRA / CNRA — Plateforme Sen Jiwu
-- Objectif :
--   Documenter via COMMENT ON les champs qui semblent redondants
--   mais sont des choix architecturaux délibérés (dénormalisation,
--   snapshots, caches inter-service, concepts métier distincts).
--   Ces commentaires sont visibles dans pgAdmin, psql \d+ et les
--   outils ERD.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. lot_semencier.code_espece
--    Cache de code espèce dénormalisé depuis catalog-service.
--    Évite un appel inter-service lors du filtrage par
--    spécialisation du sélectionneur.
-- ────────────────────────────────────────────────────────────
COMMENT ON COLUMN lot_semencier.code_espece IS
    'Dénormalisé depuis catalog-service (espece.code_espece via variete.id_espece). '
    'Peuplé à la création du lot et propagé aux enfants (G0→G1→G2→G3). '
    'Évite un appel inter-service pour filtrer les lots par spécialisation du sélectionneur. '
    'Source de vérité : espece.code_espece.';

-- ────────────────────────────────────────────────────────────
-- 2. lot_semencier.campagne (varchar) + id_campagne (FK)
--    Double représentation intentionnelle :
--    - campagne varchar = cache texte pour la vue v_stock_agrege
--      (lecture rapide sans jointure supplémentaire)
--    - id_campagne = FK de référence (intégrité forte)
-- ────────────────────────────────────────────────────────────
COMMENT ON COLUMN lot_semencier.campagne IS
    'Libellé de campagne dénormalisé (ex: "2024-2025"). '
    'Cache texte utilisé par v_stock_agrege pour lecture sans jointure. '
    'Source de vérité : id_campagne → campagne.code_campagne.';

COMMENT ON COLUMN lot_semencier.id_campagne IS
    'FK de référence vers campagne.id. Source de vérité pour la campagne du lot. '
    'La colonne campagne (varchar) en est le cache de lecture rapide.';

-- ────────────────────────────────────────────────────────────
-- 3. lot_semencier.responsable_nom + responsable_role
--    Snapshot immuable au moment de la création du lot.
--    Préserve la traçabilité biologique même si le compte
--    utilisateur est modifié ou désactivé ultérieurement.
-- ────────────────────────────────────────────────────────────
COMMENT ON COLUMN lot_semencier.responsable_nom IS
    'Snapshot du nom complet du responsable à la création du lot. '
    'Immuable après création — préserve la traçabilité de la chaîne semencière '
    'même si le profil Keycloak est modifié ou le compte désactivé.';

COMMENT ON COLUMN lot_semencier.responsable_role IS
    'Snapshot du rôle Keycloak du responsable à la création (ex: SELECTEUR, UPSEMCL). '
    'Complément de responsable_nom pour l''audit de la custody biologique.';

-- ────────────────────────────────────────────────────────────
-- 4. commande.client vs commande.id_organisation_acheteur
--    Deux champs distincts, non redondants :
--    - client = nom libre soumis dans le formulaire (peut être
--      un acheteur externe hors plateforme)
--    - id_organisation_acheteur = FK résolue automatiquement
--      depuis le JWT (username → membre_organisation → organisation)
-- ────────────────────────────────────────────────────────────
COMMENT ON COLUMN commande.client IS
    'Nom d''affichage libre de l''acheteur, soumis dans le formulaire de commande. '
    'Peut désigner un client externe (hors plateforme) ou un représentant d''organisation. '
    'Distinct de id_organisation_acheteur : ce champ est saisi, pas calculé.';

COMMENT ON COLUMN commande.id_organisation_acheteur IS
    'FK vers organisation.id de l''acheteur inscrit sur la plateforme. NULL pour les clients externes. '
    'Résolu automatiquement depuis le JWT à la création : username → membre_organisation → organisation.';

-- ────────────────────────────────────────────────────────────
-- 5. TABLE transfert_lot vs TABLE transfert
--    Deux concepts métier distincts — pas une duplication :
--    - transfert_lot : demande de transfert de custody biologique
--      entre utilisateurs (workflow) — géré par lot-service
--    - transfert : mouvement physique de stock entre organisations
--      — géré par stock-service
-- ────────────────────────────────────────────────────────────
COMMENT ON TABLE transfert_lot IS
    'Demande de transfert de custody biologique d''un lot entre utilisateurs (user → user). '
    'Workflow : SOUMIS → ACCEPTÉ / REFUSÉ. Gère la chaîne G0→G1→G2→G3. '
    'N''affecte pas directement les quantités de stock. Géré par lot-service.';

COMMENT ON TABLE transfert IS
    'Transfert physique de stock entre organisations (org → org, site → site). '
    'Produit des mouvements_stock et met à jour les quantités disponibles. '
    'Géré par stock-service. Distinct de transfert_lot (workflow custody biologique).';
