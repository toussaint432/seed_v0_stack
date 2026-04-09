package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.order_service.entity.enums.StatutCommande;

import java.time.Instant;

@Entity
@Table(name = "commande",
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

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (statut == null) statut = StatutCommande.SOUMISE;
    }
}
