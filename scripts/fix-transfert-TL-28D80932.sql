-- =============================================================================
-- Correction de l'état incohérent causé par le bug de code mismatch
-- Transfert : TL-28D80932-6-L40
-- Commande  : CMD-G3-MTRIHN7J
--
-- Ce script est IDEMPOTENT : il vérifie l'état avant chaque action.
-- À exécuter via psql sur la base "seed" avec search_path incluant les schémas lot/stock/order.
-- Exemple : psql -U seed -d seed -v ON_ERROR_STOP=1 -f fix-transfert-TL-28D80932.sql
-- =============================================================================

DO $$
DECLARE
    v_code_transfert      TEXT    := 'TL-28D80932-6-L40';
    v_code_commande       TEXT    := 'CMD-G3-MTRIHN7J';
    v_code_lot_rec        TEXT    := 'REC-DIRECT-TL-28D80932-6-L40';

    v_transfert_id        BIGINT;
    v_lot_source_id       BIGINT;
    v_qte_transferee      NUMERIC;
    v_username_dest       TEXT;
    v_org_dest_id         BIGINT;
    v_site_dest_id        BIGINT;
    v_new_lot_id          BIGINT;
    v_existing_rec_lot    BIGINT;
BEGIN

    -- -------------------------------------------------------------------------
    -- 1. Vérifier que le transfert existe et est dans l'état attendu
    -- -------------------------------------------------------------------------
    SELECT t.id, t.id_lot, t.quantite, t.username_destinataire
    INTO v_transfert_id, v_lot_source_id, v_qte_transferee, v_username_dest
    FROM transfert_lot t
    WHERE t.code_transfert = v_code_transfert;

    IF v_transfert_id IS NULL THEN
        RAISE EXCEPTION '[ABORT] Transfert % introuvable.', v_code_transfert;
    END IF;

    RAISE NOTICE 'Transfert trouvé : id=%, lot_source=%, qte=%, destinataire=%',
        v_transfert_id, v_lot_source_id, v_qte_transferee, v_username_dest;

    -- -------------------------------------------------------------------------
    -- 2. Vérifier si le lot REC est déjà créé (idempotence)
    -- -------------------------------------------------------------------------
    SELECT id INTO v_existing_rec_lot
    FROM lot_semencier
    WHERE code_lot = v_code_lot_rec
    LIMIT 1;

    IF v_existing_rec_lot IS NOT NULL THEN
        RAISE NOTICE '[SKIP] Lot REC % existe déjà (id=%). Vérification du transfert uniquement.',
            v_code_lot_rec, v_existing_rec_lot;
        v_new_lot_id := v_existing_rec_lot;
    ELSE
        -- ---------------------------------------------------------------------
        -- 3. Résoudre l'organisation du destinataire
        -- ---------------------------------------------------------------------
        SELECT mo.id_organisation
        INTO v_org_dest_id
        FROM membre_organisation mo
        WHERE mo.keycloak_username = v_username_dest
        LIMIT 1;

        IF v_org_dest_id IS NULL THEN
            RAISE EXCEPTION '[ABORT] Organisation introuvable pour le destinataire %', v_username_dest;
        END IF;

        -- ---------------------------------------------------------------------
        -- 4. Résoudre le site principal du destinataire
        -- ---------------------------------------------------------------------
        SELECT s.id INTO v_site_dest_id
        FROM site s
        WHERE s.id_organisation = v_org_dest_id
        ORDER BY s.est_principal DESC, s.id ASC
        LIMIT 1;

        IF v_site_dest_id IS NULL THEN
            RAISE EXCEPTION '[ABORT] Aucun site trouvé pour l''organisation id=%', v_org_dest_id;
        END IF;

        -- ---------------------------------------------------------------------
        -- 5. Créer le lot de réception pour le destinataire
        -- ---------------------------------------------------------------------
        INSERT INTO lot_semencier (
            code_lot, id_variete, id_generation, id_lot_parent,
            campagne, quantite_nette, unite,
            statut_lot, id_org_producteur, username_createur,
            created_at, date_production, code_espece
        )
        SELECT
            v_code_lot_rec,
            l.id_variete, l.id_generation, v_lot_source_id,
            COALESCE(l.campagne, EXTRACT(YEAR FROM NOW())::TEXT),
            v_qte_transferee, 'kg',
            'DISPONIBLE', v_org_dest_id, v_username_dest,
            NOW(), CURRENT_DATE, l.code_espece
        FROM lot_semencier l
        WHERE l.id = v_lot_source_id
        RETURNING id INTO v_new_lot_id;

        RAISE NOTICE 'Lot REC créé : id=%, code=%, qte=% kg', v_new_lot_id, v_code_lot_rec, v_qte_transferee;

        -- ---------------------------------------------------------------------
        -- 6. Retirer les kg du lot source crédités à tort au site du destinataire
        -- ---------------------------------------------------------------------
        UPDATE stock
        SET quantite_disponible = GREATEST(0, quantite_disponible - v_qte_transferee),
            updated_at          = NOW()
        WHERE id_lot  = v_lot_source_id
          AND id_site = v_site_dest_id
          AND quantite_disponible > 0;

        RAISE NOTICE '% kg retirés du lot source (id=%) au site du destinataire', v_qte_transferee, v_lot_source_id;

        -- ---------------------------------------------------------------------
        -- 7. Créditer ces kg au nouveau lot REC au même site
        -- ---------------------------------------------------------------------
        INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
        VALUES (v_new_lot_id, v_site_dest_id, v_qte_transferee, 'kg')
        ON CONFLICT (id_lot, id_site) DO UPDATE
            SET quantite_disponible = stock.quantite_disponible + EXCLUDED.quantite_disponible,
                updated_at          = NOW();

        RAISE NOTICE '% kg crédités au lot REC (id=%) au site %', v_qte_transferee, v_new_lot_id, v_site_dest_id;
    END IF;

    -- -------------------------------------------------------------------------
    -- 8. Rediriger le transfert vers le lot REC (si pas déjà fait)
    -- -------------------------------------------------------------------------
    IF (SELECT id_lot FROM transfert_lot WHERE id = v_transfert_id) != v_new_lot_id THEN
        UPDATE transfert_lot
        SET id_lot = v_new_lot_id
        WHERE id = v_transfert_id;
        RAISE NOTICE 'Transfert redirigé : id_lot % → %', v_lot_source_id, v_new_lot_id;
    ELSE
        RAISE NOTICE '[SKIP] Transfert pointe déjà sur le lot REC %', v_new_lot_id;
    END IF;

    -- -------------------------------------------------------------------------
    -- 9. Marquer la commande LIVREE
    -- -------------------------------------------------------------------------
    UPDATE commande
    SET statut = 'LIVREE'
    WHERE code_commande = v_code_commande
      AND statut != 'LIVREE';

    IF FOUND THEN
        RAISE NOTICE 'Commande % passée à LIVREE.', v_code_commande;
    ELSE
        RAISE NOTICE '[SKIP] Commande % est déjà LIVREE ou introuvable.', v_code_commande;
    END IF;

    RAISE NOTICE '=== Correction appliquée avec succès ===';
END $$;
