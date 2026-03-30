package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;
import java.io.Serializable;

@Embeddable
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
public class VarieteZoneId implements Serializable {

    @Column(name = "id_variete")
    private Long idVariete;

    @Column(name = "id_zone")
    private Long idZone;
}
