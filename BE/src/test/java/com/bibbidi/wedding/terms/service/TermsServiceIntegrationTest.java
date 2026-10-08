package com.bibbidi.wedding.terms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Sql("/terms-fixture.sql")
class TermsServiceIntegrationTest {

    private static final Long REQUIRED_SERVICE_TERMS_ID = 1L;
    private static final Long REQUIRED_PRIVACY_TERMS_ID = 2L;
    private static final Long OPTIONAL_MARKETING_TERMS_ID = 3L;

    @Autowired
    private TermsService termsService;

    @Autowired
    private UserService userService;

    private Long userId;

    @BeforeEach
    void setUp() {
        userId = userService.createPendingUser("current", null).id();
    }

    @Test
    @DisplayName("보여 줄 약관을 모두 내려 준다")
    void shouldFindAllTerms() {
        List<TermsResult> terms = termsService.findAll();

        assertThat(terms).hasSize(3);
        assertThat(terms).filteredOn(TermsResult::required).hasSize(2);
    }

    @Test
    @DisplayName("필수 약관에 모두 동의하면 동의를 기록한다")
    void shouldRecordAgreementWhenAllRequiredAgreed() {
        termsService.agree(userId, List.of(REQUIRED_SERVICE_TERMS_ID, REQUIRED_PRIVACY_TERMS_ID));

        assertThat(termsService.findAgreedTermsIds(userId))
                .containsExactlyInAnyOrder(REQUIRED_SERVICE_TERMS_ID, REQUIRED_PRIVACY_TERMS_ID);
    }

    @Test
    @DisplayName("선택 약관까지 동의해도 기록한다")
    void shouldRecordAgreementIncludingOptionalTerms() {
        termsService.agree(userId, List.of(
                REQUIRED_SERVICE_TERMS_ID, REQUIRED_PRIVACY_TERMS_ID, OPTIONAL_MARKETING_TERMS_ID));

        assertThat(termsService.findAgreedTermsIds(userId))
                .containsExactlyInAnyOrder(
                        REQUIRED_SERVICE_TERMS_ID, REQUIRED_PRIVACY_TERMS_ID, OPTIONAL_MARKETING_TERMS_ID);
    }

    @Test
    @DisplayName("필수 약관이 하나라도 빠지면 아무것도 기록하지 않는다")
    void shouldRejectWhenRequiredTermsAreMissing() {
        assertThatThrownBy(() -> termsService.agree(userId, List.of(REQUIRED_SERVICE_TERMS_ID)))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.TERMS_AGREEMENT_REQUIRED);
        assertThat(termsService.findAgreedTermsIds(userId)).isEmpty();
    }

    @Test
    @DisplayName("존재하지 않는 약관에 동의하려 하면 거절한다")
    void shouldRejectUnknownTerms() {
        assertThatThrownBy(() -> termsService.agree(userId, List.of(
                REQUIRED_SERVICE_TERMS_ID, REQUIRED_PRIVACY_TERMS_ID, 999L)))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.INVALID_REQUEST);
    }

    @Test
    @DisplayName("탈퇴하면 그 회원의 동의 기록을 지운다")
    void shouldDeleteAgreementsOnWithdrawal() {
        termsService.agree(userId, List.of(REQUIRED_SERVICE_TERMS_ID, REQUIRED_PRIVACY_TERMS_ID));

        termsService.deleteAgreementsOf(userId);

        assertThat(termsService.findAgreedTermsIds(userId)).isEmpty();
        assertThat(termsService.findAll()).hasSize(3);
    }
}
