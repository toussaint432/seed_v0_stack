package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;

@Entity
@Table(name="variete")
@Getter @Setter @NoArgsConstructor
public class Variete {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @Column(name="code_variete", unique=true, nullable=false)
  private String codeVariete;

  @Column(name="nom_variete", nullable=false)
  private String nomVariete;

  @ManyToOne(optional=false, fetch=FetchType.EAGER)
  @JoinColumn(name="id_espece")
  @JsonIgnoreProperties({"hibernateLazyInitializer","handler"})
  private Espece espece;

  private String origine;

  @Column(name="selectionneur_principal")
  private String selectionneurPrincipal;

  @Column(name="annee_creation")
  private Integer anneeCreation;

  @Column(name="cycle_jours")
  private Integer cycleJours;

  @Column(name="statut_variete")
  private String statutVariete;

  @Column(name="date_creation")
  private Instant dateCreation;

  /** Renseigné lors de l'archivage (soft-delete) */
  @Column(name="commentaire_archivage", columnDefinition="TEXT")
  private String commentaireArchivage;

  @Column(name="date_archivage")
  private Instant dateArchivage;

  @Column(name="archive_par", length=150)
  private String archivePar;
}
