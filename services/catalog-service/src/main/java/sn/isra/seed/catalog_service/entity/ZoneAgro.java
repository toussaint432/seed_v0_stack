package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Entity
@Table(name = "zone_agro")
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
}
