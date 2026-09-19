package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.order_service.entity.enums.StatutExpressionBesoin;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "expression_besoin", schema = "orders",
    indexes = {
        @Index(name = "idx_eb_createur",  columnList = "username_createur"),
        @Index(name = "idx_eb_org",       columnList = "id_organisation"),
        @Index(name = "idx_eb_variete",   columnList = "id_variete")
    }
)
@Getter @Setter @NoArgsConstructor
public class ExpressionBesoin {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "id_variete", nullable = false)
    private Long idVariete;

    @Size(max = 150)
    @Column(name = "nom_variete", length = 150)
    private String nomVariete;

    @Size(max = 30)
    @Column(name = "code_espece", length = 30)
    private String codeEspece;

    @Size(max = 150)
    @Column(name = "nom_espece", length = 150)
    private String nomEspece;

    @NotBlank
    @Size(max = 30)
    @Column(name = "campagne_cible", nullable = false, length = 30)
    private String campagneCible;

    @NotNull
    @DecimalMin("0.01")
    @Column(name = "quantite_souhaitee", nullable = false, precision = 14, scale = 2)
    private BigDecimal quantiteSouhaitee;

    @Size(max = 10)
    @Column(name = "unite", length = 10)
    private String unite = "kg";

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutExpressionBesoin statut = StatutExpressionBesoin.SOUMISE;

    @NotBlank
    @Size(max = 150)
    @Column(name = "username_createur", nullable = false, length = 150)
    private String usernameCreateur;

    @Column(name = "nom_complet_createur", length = 200)
    private String nomCompletCreateur;

    @Column(name = "id_organisation")
    private Long idOrganisation;

    @Size(max = 200)
    @Column(name = "nom_organisation", length = 200)
    private String nomOrganisation;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = Instant.now();
        if (statut == null) statut = StatutExpressionBesoin.SOUMISE;
        if (unite == null) unite = "kg";
    }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }
}
