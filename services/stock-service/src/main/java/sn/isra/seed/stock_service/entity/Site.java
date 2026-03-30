package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "site")
@Getter @Setter @NoArgsConstructor
public class Site {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code_site", unique = true, nullable = false)
    private String codeSite;

    @Column(name = "nom_site", nullable = false)
    private String nomSite;

    @Column(name = "type_site", nullable = false)
    private String typeSite;

    private String localite;
    private String region;

    // Phase 1 : géolocalisation + liaison organisation
    @Column(name = "id_organisation")
    private Long idOrganisation;

    @Column(precision = 10, scale = 6)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 6)
    private BigDecimal longitude;
}
