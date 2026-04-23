package sn.isra.seed.stock_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.stock_service.entity.enums.StatutTransfert;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "transfert",
    indexes = {
        @Index(name = "idx_trf_lot",    columnList = "id_lot"),
        @Index(name = "idx_trf_statut", columnList = "statut")
    }
)
@Getter @Setter @NoArgsConstructor
public class Transfert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code transfert est obligatoire")
    @Size(max = 80)
    @Column(name = "code_transfert", unique = true, nullable = false, length = 80)
    private String codeTransfert;

    @NotNull(message = "Le lot est obligatoire")
    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @NotBlank(message = "L'organisation source est obligatoire")
    @Size(max = 200)
    @Column(name = "organisation_source", nullable = false, length = 200)
    private String organisationSource;

    @NotBlank(message = "L'organisation destination est obligatoire")
    @Size(max = 200)
    @Column(name = "organisation_destination", nullable = false, length = 200)
    private String organisationDestination;

    @Size(max = 50)
    @Column(name = "role_source", length = 50)
    private String roleSource;

    @Size(max = 50)
    @Column(name = "role_destination", length = 50)
    private String roleDestination;

    @NotNull(message = "La quantité est obligatoire")
    @Positive(message = "La quantité doit être positive")
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal quantite;

    @NotBlank(message = "L'unité est obligatoire")
    @Size(max = 10)
    @Column(nullable = false, length = 10)
    private String unite = "kg";

    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StatutTransfert statut = StatutTransfert.EN_ATTENTE;

    /**
     * Codes des sites physiques impliqués dans le transfert.
     * Envoyés par le frontend (champs siteSource / siteDestination).
     * Requis pour que l'acceptation déclenche la mise à jour du stock.
     */
    @Size(max = 50)
    @Column(name = "code_site_source", length = 50)
    private String codeSiteSource;

    @Size(max = 50)
    @Column(name = "code_site_destination", length = 50)
    private String codeSiteDestination;

    @Column(name = "date_transfert")
    private LocalDate dateTransfert;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (statut == null) statut = StatutTransfert.EN_ATTENTE;
        if (unite == null) unite = "kg";
        if (codeTransfert == null || codeTransfert.isBlank())
            codeTransfert = "TRF-" + System.currentTimeMillis();
    }
}
