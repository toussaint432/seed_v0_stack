package sn.isra.seed.catalog_service.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import sn.isra.seed.catalog_service.entity.Espece;
import sn.isra.seed.catalog_service.entity.EspeceHistorique;
import sn.isra.seed.catalog_service.entity.Variete;
import sn.isra.seed.catalog_service.entity.VarieteHistorique;
import sn.isra.seed.catalog_service.entity.enums.StatutVariete;
import sn.isra.seed.catalog_service.repo.EspeceHistoriqueRepo;
import sn.isra.seed.catalog_service.repo.EspeceRepo;
import sn.isra.seed.catalog_service.repo.VarieteHistoriqueRepo;
import sn.isra.seed.catalog_service.repo.VarieteRepo;
import sn.isra.seed.common.util.JwtHelper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CatalogService {

    private final EspeceRepo            especeRepo;
    private final EspeceHistoriqueRepo  especeHistoriqueRepo;
    private final VarieteRepo           varieteRepo;
    private final VarieteHistoriqueRepo historiqueRepo;

    public Espece createSpecies(Espece e, Jwt jwt) {
        Espece saved = especeRepo.save(e);
        String user = JwtHelper.getUsername(jwt) != null ? JwtHelper.getUsername(jwt) : "inconnu";
        especeHistoriqueRepo.save(new EspeceHistorique(saved.getId(), "CREATION",
            "codeEspece", null, saved.getCodeEspece(), user));
        return saved;
    }

    public Variete createVariety(Variete v) {
        if (v.getEspece() == null || v.getEspece().getId() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ 'espece.id' est obligatoire");
        Espece espece = especeRepo.findById(v.getEspece().getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Espèce introuvable : id=" + v.getEspece().getId()));
        v.setEspece(espece);
        return varieteRepo.save(v);
    }

    @Transactional
    public Variete updateVariete(Long id, Variete body, Jwt jwt) {
        Variete v = varieteRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable"));

        String user = JwtHelper.getUsername(jwt) != null ? JwtHelper.getUsername(jwt) : "inconnu";
        List<VarieteHistorique> changes = new ArrayList<>();

        trackStr(changes, v.getId(), "Nom variété",             v.getNomVariete(),             body.getNomVariete(),             user);
        trackStr(changes, v.getId(), "Origine",                 v.getOrigine(),                body.getOrigine(),                user);
        trackStr(changes, v.getId(), "Sélectionneur principal", v.getSelectionneurPrincipal(), body.getSelectionneurPrincipal(), user);
        trackStr(changes, v.getId(), "Année d'obtention",       str(v.getAnneeCreation()),     str(body.getAnneeCreation()),     user);
        trackStr(changes, v.getId(), "Cycle min (j)",           str(v.getCycleMin()),          str(body.getCycleMin()),          user);
        trackStr(changes, v.getId(), "Cycle max (j)",           str(v.getCycleMax()),          str(body.getCycleMax()),          user);
        trackStr(changes, v.getId(), "Statut",                  str(v.getStatutVariete()),     str(body.getStatutVariete()),     user);
        trackStr(changes, v.getId(), "Pedigree",                v.getPedigree(),               body.getPedigree(),               user);
        trackStr(changes, v.getId(), "Type de grain",           v.getTypeGrain(),              body.getTypeGrain(),              user);
        trackStr(changes, v.getId(), "Rendement min (t/ha)",    str(v.getRendementMin()),      str(body.getRendementMin()),      user);
        trackStr(changes, v.getId(), "Rendement max (t/ha)",    str(v.getRendementMax()),      str(body.getRendementMax()),      user);

        if (body.getNomVariete()             != null) v.setNomVariete(body.getNomVariete());
        if (body.getOrigine()                != null) v.setOrigine(body.getOrigine());
        if (body.getSelectionneurPrincipal() != null) v.setSelectionneurPrincipal(body.getSelectionneurPrincipal());
        if (body.getAnneeCreation()          != null) v.setAnneeCreation(body.getAnneeCreation());
        if (body.getCycleMin()               != null) v.setCycleMin(body.getCycleMin());
        if (body.getCycleMax()               != null) v.setCycleMax(body.getCycleMax());
        if (body.getStatutVariete()          != null) v.setStatutVariete(body.getStatutVariete());
        if (body.getPedigree()               != null) v.setPedigree(body.getPedigree());
        if (body.getTypeGrain()              != null) v.setTypeGrain(body.getTypeGrain());
        if (body.getRendementMin()           != null) v.setRendementMin(body.getRendementMin());
        if (body.getRendementMax()           != null) v.setRendementMax(body.getRendementMax());

        Variete saved = varieteRepo.save(v);
        if (!changes.isEmpty()) historiqueRepo.saveAll(changes);
        return saved;
    }

    @Transactional
    public Variete archiveVariete(Long id, String commentaire, Jwt jwt) {
        if (commentaire == null || commentaire.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Un commentaire est obligatoire pour archiver une variété");

        Variete v = varieteRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable"));

        if (StatutVariete.ARCHIVEE == v.getStatutVariete())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette variété est déjà archivée");

        v.setStatutVariete(StatutVariete.ARCHIVEE);
        v.setCommentaireArchivage(commentaire.trim());
        v.setDateArchivage(Instant.now());
        v.setArchivePar(JwtHelper.getUsername(jwt) != null ? JwtHelper.getUsername(jwt) : "inconnu");
        return varieteRepo.save(v);
    }

    @Transactional
    public void deleteVariete(Long id) {
        Variete v = varieteRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Variété introuvable"));

        if (StatutVariete.ARCHIVEE != v.getStatutVariete())
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Seules les variétés archivées peuvent être supprimées définitivement");

        long nbLots = varieteRepo.countLotsParVariete(id);
        long nbCommandes = varieteRepo.countCommandesParVariete(id);
        if (nbLots > 0 || nbCommandes > 0) {
            StringBuilder msg = new StringBuilder(
                "Impossible de supprimer cette variété : elle est encore référencée par ");
            if (nbLots > 0) msg.append(nbLots).append(" lot(s) semencier(s)");
            if (nbLots > 0 && nbCommandes > 0) msg.append(" et ");
            if (nbCommandes > 0) msg.append(nbCommandes).append(" ligne(s) de commande");
            msg.append(". Supprimez ou réaffectez ces éléments avant de procéder.");
            throw new ResponseStatusException(HttpStatus.CONFLICT, msg.toString());
        }

        varieteRepo.delete(v);
    }

    private void trackStr(List<VarieteHistorique> list, Long idVariete,
                          String champ, String ancienne, String nouvelle, String user) {
        if (nouvelle == null || Objects.equals(ancienne, nouvelle)) return;
        list.add(new VarieteHistorique(idVariete, champ, ancienne, nouvelle, user));
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}
