package sn.isra.seed.lot_service.entity;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.lot_service.entity.enums.ResultatCertification;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "certification",
    indexes = @Index(name = "idx_cert_lot", columnList = "id_lot"))
@Getter @Setter @NoArgsConstructor
public class Certification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Le lot est obligatoire")
    @Column(name = "id_lot", nullable = false)
    private Long idLot;

    @NotBlank(message = "L'organisme certificateur est obligatoire")
    @Size(max = 200)
    @Column(name = "organisme_certificateur", nullable = false, length = 200)
    private String organismeCertificateur;

    @NotBlank(message = "Le numéro de certificat est obligatoire")
    @Size(max = 100)
    @Column(name = "numero_certificat", nullable = false, unique = true, length = 100)
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

    @NotNull(message = "Le résultat de certification est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "resultat_certification", nullable = false, length = 30)
    private ResultatCertification resultatCertification;

    @Column(name = "motif_rejet", columnDefinition = "TEXT")
    private String motifRejet;

    @Column(name = "date_expiration")
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateExpiration;

    @Size(max = 255)
    @Column(name = "nom_document", length = 255)
    private String nomDocument;

    @JsonIgnore
    @Column(name = "contenu_document")
    private byte[] contenuDocument;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { this.createdAt = Instant.now(); }
}
