package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name="espece")
@Getter @Setter @NoArgsConstructor
public class Espece {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @Column(name="code_espece", unique=true, nullable=false)
  private String codeEspece;

  @Column(name="nom_commun", nullable=false)
  private String nomCommun;

  @Column(name="nom_scientifique")
  private String nomScientifique;
}
