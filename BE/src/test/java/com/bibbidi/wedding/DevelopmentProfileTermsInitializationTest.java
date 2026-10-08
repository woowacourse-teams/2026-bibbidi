package com.bibbidi.wedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.bibbidi.wedding.terms.persistence.JpaTermsEntity;
import com.bibbidi.wedding.terms.persistence.JpaTermsRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = "auth.jwt.secret=test-only-jwt-secret-value-for-bibbidi-auth")
class DevelopmentProfileTermsInitializationTest {

    @Autowired
    private JpaTermsRepository termsRepository;

    @Test
    void initializesTermsReferenceData() {
        assertThat(termsRepository.findAll())
                .extracting(JpaTermsEntity::code, JpaTermsEntity::version, JpaTermsEntity::required)
                .containsExactlyInAnyOrder(
                        tuple("SERVICE", "v1", true),
                        tuple("MARKETING", "v1", false));
    }
}
