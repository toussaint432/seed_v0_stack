-- V82 : Trigger de protection des lots orphelins sur désactivation d'organisation
--
-- Intercepte tout UPDATE sur shared.organisation où active passe de true à false.
-- Avorte la transaction si l'organisation possède encore des lots de semences
-- dans un statut non terminal dans lot.lot_semencier.
--
-- Statuts terminaux (lot inactif, org peut être désactivée) :
--   TRANSFERE, EPUISE, RETIRE, DECLASS, PERDU
--
-- Statuts bloquants (lot encore actif sur la plateforme) :
--   DISPONIBLE, EN_PRODUCTION, CERTIFIE, EN_COURS_CERT, SOUCHE
--
-- NOTE : les termes ARCHIVE/CONSOMME n'existent pas dans la contrainte réelle
-- de lot_semencier — utiliser les valeurs ci-dessus.

-- ── 1. Fonction trigger (schéma shared — protège une table shared) ───────────
CREATE OR REPLACE FUNCTION shared.verifier_lots_avant_desactivation_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    nb_lots_actifs  INTEGER;
    noms_statuts    TEXT;
BEGIN
    -- S'active uniquement quand active passe de true à false
    IF OLD.active IS DISTINCT FROM NEW.active AND NEW.active = false THEN

        SELECT COUNT(*)
        INTO   nb_lots_actifs
        FROM   lot.lot_semencier l
        WHERE  l.id_org_producteur = OLD.id
          AND  l.statut_lot NOT IN ('TRANSFERE', 'EPUISE', 'RETIRE', 'DECLASS', 'PERDU');

        IF nb_lots_actifs > 0 THEN

            -- Récupérer les statuts concernés pour un message explicite
            SELECT string_agg(DISTINCT l.statut_lot, ', ' ORDER BY l.statut_lot)
            INTO   noms_statuts
            FROM   lot.lot_semencier l
            WHERE  l.id_org_producteur = OLD.id
              AND  l.statut_lot NOT IN ('TRANSFERE', 'EPUISE', 'RETIRE', 'DECLASS', 'PERDU');

            RAISE EXCEPTION 'LOTS_ACTIFS_BLOCAGE: Désactivation impossible — l''organisation "%" possède encore % lot(s) actif(s) sur la plateforme (statuts : %). Archivez ou transférez ces lots avant de désactiver cette organisation.',
                OLD.nom_organisation,
                nb_lots_actifs,
                noms_statuts;
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

-- ── 2. Trigger BEFORE UPDATE sur shared.organisation ─────────────────────────
-- DROP IF EXISTS pour idempotence Flyway (CREATE OR REPLACE TRIGGER = PostgreSQL 14+)
DROP TRIGGER IF EXISTS trg_protection_lots_orphelins ON shared.organisation;

CREATE TRIGGER trg_protection_lots_orphelins
BEFORE UPDATE ON shared.organisation
FOR EACH ROW EXECUTE FUNCTION shared.verifier_lots_avant_desactivation_org();

-- ── 3. Test de non-régression (vérification lecture seule, rollback immédiat) ─
DO $$
DECLARE
    nb_orgs_avec_lots INTEGER;
BEGIN
    SELECT COUNT(DISTINCT o.id)
    INTO   nb_orgs_avec_lots
    FROM   shared.organisation o
    JOIN   lot.lot_semencier l ON l.id_org_producteur = o.id
    WHERE  o.active = true
      AND  l.statut_lot NOT IN ('TRANSFERE', 'EPUISE', 'RETIRE', 'DECLASS', 'PERDU');

    RAISE NOTICE 'V82 OK — % organisation(s) active(s) avec lots non-terminaux protégée(s) par le trigger.',
        nb_orgs_avec_lots;
END;
$$;
