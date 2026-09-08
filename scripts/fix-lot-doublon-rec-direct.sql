-- =============================================================================
-- Suppression du lot REC en double créé par le script de correction précédent
--
-- Situation : deux lots G3 de 50 kg existent pour le multiplicateur :
--   - REC-1-L40              → créé par "Accuser réception" (CORRECT, parent = G3-UPSemCL)
--   - REC-DIRECT-TL-28D...   → créé par le script fix (EN TROP, parent = REC-1-L40, erroné)
--
-- Action : supprimer REC-DIRECT, transférer son stock à REC-1-L40, rediriger le transfert.
-- Le résultat final : 1 lot REC-1-L40 · 50 kg en stock · transfert correctement lié.
-- =============================================================================

DO $$
DECLARE
    v_lot_direct_id  BIGINT;
    v_lot_rec1_id    BIGINT;
    v_site_id        BIGINT;
    v_qte_direct     NUMERIC := 0;
    v_qte_rec1       NUMERIC := 0;
BEGIN

    -- 1. Résoudre les deux lots
    SELECT id INTO v_lot_direct_id FROM lot_semencier WHERE code_lot = 'REC-DIRECT-TL-28D80932-6-L40';
    SELECT id INTO v_lot_rec1_id   FROM lot_semencier WHERE code_lot = 'REC-1-L40';

    IF v_lot_direct_id IS NULL THEN
        RAISE NOTICE '[SKIP] Lot REC-DIRECT-TL-28D80932-6-L40 introuvable — déjà supprimé ?';
        RETURN;
    END IF;
    IF v_lot_rec1_id IS NULL THEN
        RAISE EXCEPTION '[ABORT] Lot REC-1-L40 introuvable — vérifiez la base.';
    END IF;

    RAISE NOTICE 'Lot en trop (REC-DIRECT) : id=%  |  Lot à conserver (REC-1-L40) : id=%',
        v_lot_direct_id, v_lot_rec1_id;

    -- 2. Lire le stock du lot REC-DIRECT
    SELECT COALESCE(quantite_disponible, 0), id_site
    INTO v_qte_direct, v_site_id
    FROM stock
    WHERE id_lot = v_lot_direct_id
    LIMIT 1;

    RAISE NOTICE 'Stock REC-DIRECT : % kg (site id=%)  |  Sera transféré à REC-1-L40',
        v_qte_direct, v_site_id;

    -- 3. S'assurer que REC-1-L40 a exactement 50 kg en stock au même site
    --    (on écrase pour garantir l'état correct quelle que soit la séquence passée)
    IF v_site_id IS NOT NULL THEN
        INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
        VALUES (v_lot_rec1_id, v_site_id, 50, 'kg')
        ON CONFLICT (id_lot, id_site) DO UPDATE
            SET quantite_disponible = 50,
                updated_at = NOW();
    END IF;

    -- 4. Supprimer le stock du lot en double
    DELETE FROM stock WHERE id_lot = v_lot_direct_id;
    RAISE NOTICE 'Stock REC-DIRECT supprimé.';

    -- 5. Rediriger le transfert TL-28D80932-6-L40 vers REC-1-L40
    UPDATE transfert_lot
    SET id_lot = v_lot_rec1_id
    WHERE id_lot = v_lot_direct_id;
    RAISE NOTICE 'Transfert redirigé : lot_id % → %', v_lot_direct_id, v_lot_rec1_id;

    -- 6. Supprimer le lot REC-DIRECT (après avoir retiré toutes ses références)
    DELETE FROM lot_semencier WHERE id = v_lot_direct_id;
    RAISE NOTICE 'Lot REC-DIRECT-TL-28D80932-6-L40 (id=%) supprimé.', v_lot_direct_id;

    -- 7. Vérification finale
    PERFORM 1 FROM lot_semencier WHERE id = v_lot_rec1_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '[ABORT] REC-1-L40 introuvable après correction — rollback.';
    END IF;

    RAISE NOTICE '=== Correction terminée : 1 lot REC-1-L40 · 50 kg · transfert lié ===';
END $$;
