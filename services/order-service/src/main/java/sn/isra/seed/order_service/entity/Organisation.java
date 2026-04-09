package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "organisation")
@Getter @Setter @NoArgsConstructor
public class Organisation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code_organisation", unique = true, nullable = false)
    private String codeOrganisation;

    @Column(name = "nom_organisation", nullable = false)
    private String nomOrganisation;

    @NotNull(message = "Le type d'organisation est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "type_organisation", nullable = false, length = 30)
    private sn.isra.seed.order_service.entity.enums.TypeOrganisation typeOrganisation;

    @Size(max = 100)
    private String region;

    @Size(max = 100)
    private String localite;

    @Size(max = 150)
    private String contact;

    @Size(max = 50)
    private String telephone;

    @Email(message = "Format email invalide")
    @Size(max = 150)
    private String email;

    private Boolean active;

    @DecimalMin(value = "-90.0") @DecimalMax(value = "90.0")
    @Column(precision = 10, scale = 6)
    private java.math.BigDecimal latitude;

    @DecimalMin(value = "-180.0") @DecimalMax(value = "180.0")
    @Column(precision = 10, scale = 6)
    private java.math.BigDecimal longitude;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (active == null) active = true;
        if (codeOrganisation == null || codeOrganisation.isBlank())
            codeOrganisation = "ORG-" + System.currentTimeMillis();
    }
}
