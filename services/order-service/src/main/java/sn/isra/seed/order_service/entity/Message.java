package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import sn.isra.seed.order_service.entity.enums.TypeMessage;

import java.time.Instant;

@Entity
@Table(name = "message",
    indexes = {
        @Index(name = "idx_msg_conv", columnList = "id_conversation"),
        @Index(name = "idx_msg_lu",   columnList = "id_conversation, lu")
    }
)
@Getter @Setter @NoArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "La conversation est obligatoire")
    @Column(name = "id_conversation", nullable = false)
    private Long idConversation;

    @NotBlank(message = "L'expéditeur est obligatoire")
    @Size(max = 150)
    @Column(nullable = false, length = 150)
    private String expediteur;

    @NotNull(message = "Le type de message est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TypeMessage type = TypeMessage.TEXT;

    @Column(columnDefinition = "TEXT")
    private String contenu;

    @Column(name = "url_media", columnDefinition = "TEXT")
    private String urlMedia;

    @Size(max = 255)
    @Column(name = "nom_fichier", length = 255)
    private String nomFichier;

    @Positive(message = "La taille du fichier doit être positive")
    @Column(name = "taille_fichier")
    private Integer tailleFichier;

    @NotNull
    @Column(nullable = false)
    private Boolean lu = false;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (lu == null) lu = false;
        if (type == null) type = TypeMessage.TEXT;
    }
}
