package sn.isra.seed.lot_service;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;

@TestConfiguration
class TestJwtConfig {

    @Bean
    @Primary
    JwtDecoder testJwtDecoder() {
        return token -> { throw new BadJwtException("Test mode : utilisez jwt() post-processor"); };
    }
}
