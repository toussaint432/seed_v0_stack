package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "zone_espece", schema = "catalog")
@Getter @Setter @NoArgsConstructor
public class ZoneEspece {

    @EmbeddedId
    private ZoneEspeceId id;

    @Column(name = "est_principale", nullable = false)
    private boolean estPrincipale = true;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_zone_agro", insertable = false, updatable = false)
    private ZoneAgro zone;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "id_espece", insertable = false, updatable = false)
    private Espece espece;
}
