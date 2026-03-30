package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "message")
@Getter @Setter @NoArgsConstructor
public class Message {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_conversation", nullable = false)
    private Long idConversation;

    @Column(nullable = false, length = 150)
    private String expediteur;

    @Column(nullable = false, length = 20)
    private String type = "TEXT";

    @Column(columnDefinition = "TEXT")
    private String contenu;

    @Column(name = "url_media", columnDefinition = "TEXT")
    private String urlMedia;

    @Column(name = "nom_fichier", length = 255)
    private String nomFichier;

    @Column(name = "taille_fichier")
    private Integer tailleFichier;

    @Column(nullable = false)
    private Boolean lu = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
