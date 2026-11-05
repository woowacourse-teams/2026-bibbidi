package com.bibbidi.wedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import com.bibbidi.wedding.common.domain.UserRole;
import com.bibbidi.wedding.common.domain.UserStatus;
import com.bibbidi.wedding.support.TestDatabaseLocks;
import com.bibbidi.wedding.terms.persistence.JpaTermsEntity;
import com.bibbidi.wedding.terms.persistence.JpaTermsRepository;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = "auth.jwt.secret=test-only-jwt-secret-value-for-bibbidi-auth")
@ResourceLock(TestDatabaseLocks.DATA_LOAD_TEST)
class DevelopmentProfileInitializationTest {

    @Autowired
    private JpaCategoryRepository categoryRepository;

    @Autowired
    private JpaStepRepository stepRepository;

    @Autowired
    private JpaCatalogItemRepository catalogItemRepository;

    @Autowired
    private JpaTermsRepository termsRepository;

    @Autowired
    private JpaUserRepository userRepository;

    @Test
    void initializesCatalogReferenceData() {
        assertThat(categoryRepository.count()).isEqualTo(5);
        assertThat(stepRepository.count()).isEqualTo(43);
        assertThat(catalogItemRepository.count()).isEqualTo(169);
    }

    @Test
    void initializesTermsReferenceData() {
        assertThat(termsRepository.findAll())
                .extracting(JpaTermsEntity::code, JpaTermsEntity::version, JpaTermsEntity::required)
                .containsExactlyInAnyOrder(
                        tuple("SERVICE", "v1", true),
                        tuple("MARKETING", "v1", false));
    }

    @Test
    void initializesFourPendingTestUsers() {
        assertThat(userRepository.findAll())
                .extracting(JpaUserEntity::nickname, JpaUserEntity::status, JpaUserEntity::role)
                .containsExactlyInAnyOrder(
                        tuple("보예", UserStatus.PENDING, UserRole.NORMAL),
                        tuple("티뉴", UserStatus.PENDING, UserRole.NORMAL),
                        tuple("바드", UserStatus.PENDING, UserRole.NORMAL),
                        tuple("라티", UserStatus.PENDING, UserRole.NORMAL));
    }
}
