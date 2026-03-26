package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "transfert")
@Getter @Setter @NoArgsConstructor
public class Transfert {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code_transfert", unique = true, nullable = false)
    private String codeTransfert;

    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @Column(name = "organisation_source", nullable = false)
    private String organisationSource;

    @Column(name = "organisation_destination", nullable = false)
    private String organisationDestination;

    @Column(name = "role_source")
    private String roleSource;

    @Column(name = "role_destination")
    private String roleDestination;

    @Column(nullable = false)
    private BigDecimal quantite;

    @Column(nullable = false)
    private String unite = "kg";

    @Column(nullable = false)
    private String statut = "EN_ATTENTE";

    @Column(name = "date_transfert")
    private LocalDate dateTransfert;

    private String observations;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (codeTransfert == null || codeTransfert.isBlank())
            codeTransfert = "TRF-" + System.currentTimeMillis();
    }
}
