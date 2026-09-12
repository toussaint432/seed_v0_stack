package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.math.BigDecimal;
import java.util.List;

@Entity
@Table(name = "zone_agro", schema = "geo")
@Getter @Setter @NoArgsConstructor
public class ZoneAgro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code de zone est obligatoire")
    @Size(max = 10)
    @Column(unique = true, nullable = false, length = 10)
    private String code;

    @NotBlank(message = "Le nom de zone est obligatoire")
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String nom;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "potentiel_cereales_ha", precision = 12, scale = 1)
    private BigDecimal potentielCerealesHa;

    @Column(name = "potentiel_legumineuses_ha", precision = 12, scale = 1)
    private BigDecimal potentielLegumineusesHa;

    @JsonIgnore
    @OneToMany(mappedBy = "zone", fetch = FetchType.LAZY)
    private List<ZoneEspece> especesLiees;
}
