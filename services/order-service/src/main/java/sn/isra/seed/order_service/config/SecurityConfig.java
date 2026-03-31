package sn.isra.seed.order_service.config;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http,
                                          UserSyncFilter userSyncFilter) throws Exception {
    http
      .csrf(csrf -> csrf.disable())
      .cors(Customizer.withDefaults())
      .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers(
          "/actuator/**",
          "/v3/api-docs/**",
          "/swagger-ui/**",
          "/swagger-ui.html",
          "/swagger-ui/index.html",
          "/api/chat/files/**"
        ).permitAll()
        .anyRequest().authenticated()
      )
      .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakJwtConverter())))
      // UserSyncFilter s'exécute juste après la validation du JWT
      .addFilterAfter(userSyncFilter, BearerTokenAuthenticationFilter.class)
      // En-têtes de sécurité HTTP
      .headers(headers -> headers
          .frameOptions(frame -> frame.deny())               // Anti-clickjacking
          .contentTypeOptions(Customizer.withDefaults())     // Anti MIME-sniffing
          .httpStrictTransportSecurity(hsts -> hsts          // Force HTTPS (actif en prod)
              .includeSubDomains(true)
              .maxAgeInSeconds(31536000))
      );
    return http.build();
  }

  /**
   * Empêche Spring Boot d'enregistrer UserSyncFilter une deuxième fois
   * dans la chaîne servlet (il est déjà dans la chaîne Spring Security).
   */
  @Bean
  FilterRegistrationBean<UserSyncFilter> userSyncFilterRegistration(UserSyncFilter filter) {
    FilterRegistrationBean<UserSyncFilter> bean = new FilterRegistrationBean<>(filter);
    bean.setEnabled(false);
    return bean;
  }

  @Bean
  JwtAuthenticationConverter keycloakJwtConverter() {
    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter((Jwt jwt) -> {
      Map<String, Object> realmAccess = jwt.getClaim("realm_access");
      if (realmAccess == null) return List.of();
      Object roles = realmAccess.get("roles");
      if (!(roles instanceof List<?>)) return List.of();
      Collection<GrantedAuthority> authorities = ((List<?>) roles).stream()
          .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r))
          .collect(Collectors.toList());
      return authorities;
    });
    return converter;
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of(
      "http://localhost:5173",
      "http://localhost:3000"
    ));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    // CORS : headers explicites — jamais de wildcard avec credentials=true
    config.setAllowedHeaders(List.of(
        "Authorization", "Content-Type", "Accept",
        "Origin", "X-Requested-With", "Cache-Control"
    ));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
