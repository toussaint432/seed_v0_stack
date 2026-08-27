package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "generation_semence", schema = "lot")
@Getter @Setter @NoArgsConstructor
public class GenerationSemence {

    @Id
    private Long id;

    @Column(name = "code_generation", nullable = false)
    private String codeGeneration;

    @Column(name = "ordre_generation", nullable = false)
    private Integer ordreGeneration;
}
