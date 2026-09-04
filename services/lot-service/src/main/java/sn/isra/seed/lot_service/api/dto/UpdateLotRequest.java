package sn.isra.seed.lot_service.api.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Champs éditables d'un lot pendant la fenêtre BROUILLON.
 * Les champs identitaires (codeLot, idVariete, generation, usernameCreateur) sont immuables.
 */
@Getter @Setter
public class UpdateLotRequest {

    @Size(max = 50)
    private String campagne;

    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate dateProduction;

    @DecimalMin(value = "0.0")
    private BigDecimal quantiteNette;

    @Size(max = 10)
    private String unite;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    private BigDecimal tauxGermination;

    @DecimalMin(value = "0.0") @DecimalMax(value = "100.0")
    private BigDecimal puretePhysique;

    @DecimalMin(value = "0.0")
    private BigDecimal superficieHa;

    @DecimalMin(value = "0.0")
    private BigDecimal productionBruteKg;

    @Size(max = 50)
    private String niveauSemence;

    @DecimalMin(value = "0.0")
    private BigDecimal quantiteSemenceSrcKg;
}
