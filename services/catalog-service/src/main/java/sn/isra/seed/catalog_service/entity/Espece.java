package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Entity
@Table(name = "espece")
@Getter @Setter @NoArgsConstructor
public class Espece {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Le code espèce est obligatoire")
    @Size(max = 30, message = "Le code espèce ne doit pas dépasser 30 caractères")
    @Column(name = "code_espece", unique = true, nullable = false, length = 30)
    private String codeEspece;

    @NotBlank(message = "Le nom commun est obligatoire")
    @Size(max = 120, message = "Le nom commun ne doit pas dépasser 120 caractères")
    @Column(name = "nom_commun", nullable = false, length = 120)
    private String nomCommun;

    @Size(max = 200)
    @Column(name = "nom_scientifique", length = 200)
    private String nomScientifique;
}
