package sn.isra.seed.catalog_service.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http,
                                          JwtAuthenticationConverter keycloakJwtConverter) throws Exception {
    http
      .csrf(csrf -> csrf.disable())
      .cors(Customizer.withDefaults())
      .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/actuator/health").permitAll()
        .requestMatchers(
          "/v3/api-docs/**",
          "/swagger-ui/**",
          "/swagger-ui.html",
          "/swagger-ui/index.html"
        ).permitAll()
        .requestMatchers(HttpMethod.GET,
            "/api/zones",
            "/api/zones/par-departement/**",
            "/api/zones/*/especes",
            "/api/regions",
            "/api/departements",
            "/api/varieties/*/zones",
            "/api/varieties/*/fiche-varietale",
            "/api/especes/*/itineraire-technique"
        ).permitAll()
        .anyRequest().authenticated()
      )
      .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakJwtConverter)))
      .headers(headers -> headers
          .frameOptions(frame -> frame.deny())
          .contentTypeOptions(Customizer.withDefaults())
          .httpStrictTransportSecurity(hsts -> hsts
              .includeSubDomains(true)
              .maxAgeInSeconds(31536000))
      );

    return http.build();
  }
}
