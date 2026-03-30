package sn.isra.seed.lot_service.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "transfert_lot")
@Getter @Setter @NoArgsConstructor
public class TransfertLot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code_transfert", unique = true, nullable = false)
    private String codeTransfert;

    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @Column(name = "username_emetteur", nullable = false)
    private String usernameEmetteur;

    @Column(name = "role_emetteur", nullable = false)
    private String roleEmetteur;

    @Column(name = "username_destinataire", nullable = false)
    private String usernameDestinataire;

    @Column(name = "role_destinataire", nullable = false)
    private String roleDestinataire;

    @Column(name = "generation_transferee", nullable = false)
    private String generationTransferee;

    @Column(precision = 12, scale = 2)
    private BigDecimal quantite;

    @Column(nullable = false)
    private String statut = "EN_ATTENTE";

    @Column(name = "date_demande")
    private LocalDate dateDemande = LocalDate.now();

    @Column(name = "date_acceptation")
    private LocalDate dateAcceptation;

    @Column(name = "motif_refus")
    private String motifRefus;

    private String observations;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    /* Navigation vers le lot (lecture seule — ignoré par Jackson pour éviter le lazy-loading) */
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_lot", insertable = false, updatable = false)
    private LotSemencier lot;
}
