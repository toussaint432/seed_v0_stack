package sn.isra.seed.lot_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name="generation_semence")
@Getter @Setter @NoArgsConstructor
public class Generation {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
  private Long id;

  @Column(name="code_generation", unique=true, nullable=false)
  private String codeGeneration;

  @Column(name="ordre_generation", nullable=false)
  private Integer ordreGeneration;
}
