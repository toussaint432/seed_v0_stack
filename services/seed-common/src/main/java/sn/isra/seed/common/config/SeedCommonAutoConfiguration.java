package sn.isra.seed.common.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Import;

@AutoConfiguration
@Import({ GlobalExceptionHandler.class, KeycloakSecurityBeans.class })
public class SeedCommonAutoConfiguration {
}
