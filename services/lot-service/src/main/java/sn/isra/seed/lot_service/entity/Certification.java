package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "certification")
@Getter @Setter @NoArgsConstructor
public class Certification {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @Column(name = "organisme_certificateur", nullable = false)
    private String organismeCertificateur;

    @Column(name = "numero_certificat", nullable = false, unique = true)
    private String numeroCertificat;

    @Column(name = "date_demande")
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateDemande;

    @Column(name = "date_inspection")
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateInspection;

    @Column(name = "date_certification")
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateCertification;

    @Column(name = "resultat_certification", nullable = false)
    private String resultatCertification;

    @Column(name = "motif_rejet")
    private String motifRejet;

    @Column(name = "date_expiration")
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateExpiration;

    @Column(name = "nom_document")
    private String nomDocument;

    @JsonIgnore
    @Column(name = "contenu_document")
    private byte[] contenuDocument;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void prePersist() { this.createdAt = Instant.now(); }
}
