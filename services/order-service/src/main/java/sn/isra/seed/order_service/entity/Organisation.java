package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
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

    @Column(name = "type_organisation", nullable = false)
    private String typeOrganisation;

    private String region;
    private String localite;
    private String contact;
    private String telephone;
    private String email;

    private Boolean active;

    @Column(precision = 10, scale = 6)
    private java.math.BigDecimal latitude;

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
