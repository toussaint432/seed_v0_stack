package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "zone_agro")
@Getter @Setter @NoArgsConstructor
public class ZoneAgro {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 10)
    private String code;

    @Column(nullable = false, length = 150)
    private String nom;

    @Column(columnDefinition = "TEXT")
    private String description;
}
