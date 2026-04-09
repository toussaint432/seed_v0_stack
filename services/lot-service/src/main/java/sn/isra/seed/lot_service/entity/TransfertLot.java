package sn.isra.seed.lot_service.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.lot_service.entity.enums.StatutTransfert;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "transfert_lot",
    indexes = {
        @Index(name = "idx_trflot_lot",      columnList = "id_lot"),
        @Index(name = "idx_trflot_emetteur", columnList = "username_emetteur"),
        @Index(name = "idx_trflot_dest",     columnList = "username_destinataire")
    }
)
@Getter @Setter @NoArgsConstructor
public class TransfertLot {

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

    @NotBlank(message = "L'émetteur est obligatoire")
    @Size(max = 150)
    @Column(name = "username_emetteur", nullable = false, length = 150)
    private String usernameEmetteur;

    @NotBlank(message = "Le rôle émetteur est obligatoire")
    @Size(max = 50)
    @Column(name = "role_emetteur", nullable = false, length = 50)
    private String roleEmetteur;

    @NotBlank(message = "Le destinataire est obligatoire")
    @Size(max = 150)
    @Column(name = "username_destinataire", nullable = false, length = 150)
    private String usernameDestinataire;

    @NotBlank(message = "Le rôle destinataire est obligatoire")
    @Size(max = 50)
    @Column(name = "role_destinataire", nullable = false, length = 50)
    private String roleDestinataire;

    @NotBlank(message = "La génération transférée est obligatoire")
    @Size(max = 10)
    @Column(name = "generation_transferee", nullable = false, length = 10)
    private String generationTransferee;

    @Positive(message = "La quantité doit être positive")
    @Column(precision = 12, scale = 2)
    private BigDecimal quantite;

    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StatutTransfert statut = StatutTransfert.EN_ATTENTE;

    @Column(name = "date_demande")
    private LocalDate dateDemande;

    @Column(name = "date_acceptation")
    private LocalDate dateAcceptation;

    @Column(name = "motif_refus", columnDefinition = "TEXT")
    private String motifRefus;

    @Column(columnDefinition = "TEXT")
    private String observations;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    /** Navigation lecture seule — LAZY pour éviter N+1 */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_lot", insertable = false, updatable = false)
    private LotSemencier lot;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (dateDemande == null) dateDemande = LocalDate.now();
        if (statut == null) statut = StatutTransfert.EN_ATTENTE;
    }
}
