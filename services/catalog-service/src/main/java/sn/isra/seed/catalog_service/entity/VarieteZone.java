package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import sn.isra.seed.catalog_service.entity.enums.NiveauAdaptation;

@Entity
@Table(name = "variete_zone")
@Getter @Setter @NoArgsConstructor
public class VarieteZone {

    @EmbeddedId
    private VarieteZoneId id;

    @NotNull(message = "Le niveau d'adaptation est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "niveau_adaptation", nullable = false, length = 20)
    private NiveauAdaptation niveauAdaptation = NiveauAdaptation.OPTIMAL;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_zone", insertable = false, updatable = false)
    private ZoneAgro zone;
}
