package sn.isra.seed.order_service.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;

@Entity
@Table(name = "membre_organisation", schema = "shared")
@Getter @Setter @NoArgsConstructor
public class MembreOrganisation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "keycloak_username", unique = true, nullable = false)
    private String keycloakUsername;

    @Column(name = "keycloak_role", nullable = false)
    private String keycloakRole;

    @Column(name = "nom_complet", nullable = false)
    private String nomComplet;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "id_organisation")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Organisation organisation;

    @Column(name = "role_dans_org")
    private String roleDansOrg;

    private Boolean principal;
    private String telephone;

    @Column(name = "telephone_public")
    private Boolean telephonePublic = false;

    /** Espèce / spéculation de spécialisation — sélectionneurs uniquement */
    @Column(name = "specialisation")
    private String specialisation;

    /** Zone Agro-Écologique de terrain — référence vers catalog.zone_agro (dénormalisé, sans FK cross-schema) */
    @Column(name = "id_zone_agro")
    private Long idZoneAgro;

    @Column(name = "departement", length = 100)
    private String departement;

    @Column(name = "commune", length = 100)
    private String commune;

    /** Coordonnées GPS du site principal de l'acteur (précision 6 décimales ≈ 11 cm) */
    @Column(name = "latitude", precision = 10, scale = 6)
    private java.math.BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 6)
    private java.math.BigDecimal longitude;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = Instant.now();
        if (roleDansOrg == null) roleDansOrg = "MEMBRE";
        if (principal == null) principal = false;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
