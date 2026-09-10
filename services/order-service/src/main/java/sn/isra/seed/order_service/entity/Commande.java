package sn.isra.seed.order_service.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.order_service.entity.enums.StatutCommande;
import sn.isra.seed.order_service.entity.enums.TypeCommande;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "commande", schema = "orders",
    indexes = {
        @Index(name = "idx_cmd_statut",   columnList = "statut"),
        @Index(name = "idx_cmd_acheteur", columnList = "id_organisation_acheteur")
    }
)
@Getter @Setter @NoArgsConstructor
public class Commande {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code commande est obligatoire")
    @Size(max = 80)
    @Column(name = "code_commande", unique = true, nullable = false, length = 80)
    private String codeCommande;

    @NotBlank(message = "Le client est obligatoire")
    @Size(max = 200)
    @Column(nullable = false, length = 200)
    private String client;

    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StatutCommande statut = StatutCommande.SOUMISE;

    @Size(max = 150)
    @Column(name = "username_acheteur", length = 150)
    private String usernameAcheteur;

    @Column(name = "id_organisation_acheteur")
    private Long idOrganisationAcheteur;

    @Column(name = "id_organisation_fournisseur")
    private Long idOrganisationFournisseur;

    /** Prénom + Nom de l'acheteur — dénormalisé depuis membre_organisation à la création. */
    @Size(max = 200)
    @Column(name = "nom_complet_acheteur", length = 200)
    private String nomCompletAcheteur;

    /** Nom de l'organisation acheteuse — dénormalisé pour affichage sans join. */
    @Size(max = 200)
    @Column(name = "nom_organisation_acheteur", length = 200)
    private String nomOrganisationAcheteur;

    /** Localisation (localité, région) de l'acheteur — dénormalisée pour la chaîne aval. */
    @Size(max = 200)
    @Column(name = "localisation_acheteur", length = 200)
    private String localisationAcheteur;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_commande", nullable = false, length = 30)
    private TypeCommande typeCommande = TypeCommande.R2_MULT_QUOTATAIRE;

    @Column(name = "code_transfert_genere", length = 80)
    private String codeTransfertGenere;

    @Size(max = 50)
    @Column(name = "site_destination_code", length = 50)
    private String siteDestinationCode;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @JsonManagedReference
    @OneToMany(mappedBy = "commande", fetch = FetchType.EAGER)
    private List<LigneCommande> lignes = new java.util.ArrayList<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (statut == null) statut = StatutCommande.SOUMISE;
    }
}
