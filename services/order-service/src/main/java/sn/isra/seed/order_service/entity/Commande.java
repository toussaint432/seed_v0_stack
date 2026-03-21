package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name="commande")
@Getter @Setter @NoArgsConstructor
public class Commande {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @Column(name="code_commande", unique=true, nullable=false)
  private String codeCommande;

  @Column(nullable=false)
  private String client;

  private String statut;

  @Column(name="created_at")
  private Instant createdAt;
}
