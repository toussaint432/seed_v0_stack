package sn.isra.seed.catalog_service.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "variete_historique")
@Getter @Setter @NoArgsConstructor
public class VarieteHistorique {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_variete", nullable = false)
    private Long idVariete;

    @Column(name = "champ", nullable = false, length = 100)
    private String champ;

    @Column(name = "ancienne_valeur", columnDefinition = "TEXT")
    private String ancienneValeur;

    @Column(name = "nouvelle_valeur", columnDefinition = "TEXT")
    private String nouvelleValeur;

    @Column(name = "modifie_par", nullable = false, length = 255)
    private String modifiePar;

    @Column(name = "date_modification", nullable = false)
    private Instant dateModification = Instant.now();

    public VarieteHistorique(Long idVariete, String champ,
                              String ancienneValeur, String nouvelleValeur,
                              String modifiePar) {
        this.idVariete       = idVariete;
        this.champ           = champ;
        this.ancienneValeur  = ancienneValeur;
        this.nouvelleValeur  = nouvelleValeur;
        this.modifiePar      = modifiePar;
        this.dateModification = Instant.now();
    }
}
