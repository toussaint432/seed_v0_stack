package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class ZoneEspeceId implements Serializable {

    @Column(name = "id_zone_agro")
    private Long idZoneAgro;

    @Column(name = "id_espece")
    private Long idEspece;
}
