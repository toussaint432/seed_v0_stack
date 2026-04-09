package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.stock_service.entity.enums.TypeSite;

import java.math.BigDecimal;

@Entity
@Table(name = "site")
@Getter @Setter @NoArgsConstructor
public class Site {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code site est obligatoire")
    @Size(max = 50)
    @Column(name = "code_site", unique = true, nullable = false, length = 50)
    private String codeSite;

    @NotBlank(message = "Le nom du site est obligatoire")
    @Size(max = 200)
    @Column(name = "nom_site", nullable = false, length = 200)
    private String nomSite;

    @NotNull(message = "Le type de site est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "type_site", nullable = false, length = 30)
    private TypeSite typeSite;

    @Size(max = 200)
    private String localite;

    @Size(max = 200)
    private String region;

    @Column(name = "id_organisation")
    private Long idOrganisation;

    @DecimalMin(value = "-90.0") @DecimalMax(value = "90.0")
    @Column(precision = 10, scale = 6)
    private BigDecimal latitude;

    @DecimalMin(value = "-180.0") @DecimalMax(value = "180.0")
    @Column(precision = 10, scale = 6)
    private BigDecimal longitude;
}
