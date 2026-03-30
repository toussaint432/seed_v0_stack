package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "variete_zone")
@Getter @Setter @NoArgsConstructor
public class VarieteZone {

    @EmbeddedId
    private VarieteZoneId id;

    @Column(name = "niveau_adaptation", length = 20, nullable = false)
    private String niveauAdaptation = "OPTIMAL";

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_zone", insertable = false, updatable = false)
    private ZoneAgro zone;
}
