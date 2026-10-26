package com.bibbidi.wedding.balancegame.controller;

import static com.bibbidi.wedding.support.AuthenticationTestSupport.authenticatedUser;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameRecommendationRequest;
import com.bibbidi.wedding.balancegame.controller.dto.BalanceGameRecommendationRequest.Answer;
import com.bibbidi.wedding.balancegame.service.BalanceGameRecommendationService;
import com.bibbidi.wedding.balancegame.service.dto.BalanceGameAnswer;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.SecurityTestConfig;
import com.bibbidi.wedding.support.TestDatabaseLocks;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

@Import(SecurityTestConfig.class)
@WebMvcTest(BalanceGameRecommendationController.class)
@ResourceLock(TestDatabaseLocks.SPRING_TEST)
class BalanceGameRecommendationControllerTest {

    private static final String PATH = "/api/balance-game/recommendations";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper mapper;

    @MockitoBean
    private BalanceGameRecommendationService recommendationService;

    @Test
    @DisplayName("유효한 요청을 서비스 답변 DTO로 변환하고 UNKNOWN을 그대로 전달한다")
    void shouldConvertRequestToServiceAnswers() throws Exception {
        given(recommendationService.recommend(anyList())).willReturn(List.of());

        perform(validRequest()).andExpect(status().isOk());

        then(recommendationService).should().recommend(List.of(
                new BalanceGameAnswer(1L, "A"), new BalanceGameAnswer(2L, "UNKNOWN")));
    }

    @ParameterizedTest
    @MethodSource("invalidRequests")
    @DisplayName("필수 값과 양수 ID 검증에 실패하면 서비스 호출 전에 거절한다")
    void shouldRejectInvalidRequest(BalanceGameRecommendationRequest request) throws Exception {
        perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(ClientError.INVALID_REQUEST.errorCode()))
                .andExpect(jsonPath("$.message").value(ClientError.INVALID_REQUEST.message()))
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist());
        verifyNoInteractions(recommendationService);
    }

    static Stream<BalanceGameRecommendationRequest> invalidRequests() {
        return Stream.of(
                new BalanceGameRecommendationRequest(null),
                new BalanceGameRecommendationRequest(List.of()),
                new BalanceGameRecommendationRequest(Arrays.asList((Answer) null)),
                new BalanceGameRecommendationRequest(List.of(new Answer(null, "A"))),
                new BalanceGameRecommendationRequest(List.of(new Answer(0L, "A"))),
                new BalanceGameRecommendationRequest(List.of(new Answer(-1L, "A"))),
                new BalanceGameRecommendationRequest(List.of(new Answer(1L, null))),
                new BalanceGameRecommendationRequest(List.of(new Answer(1L, " "))));
    }

    @ParameterizedTest
    @EnumSource(value = ClientError.class, names = {"INVALID_REQUEST", "INTERNAL_ERROR", "AI_CAPACITY_EXCEEDED"})
    @DisplayName("서비스 오류를 기존 HTTP 상태와 공개 오류 계약으로 변환한다")
    void shouldUseExistingErrorContract(ClientError error) throws Exception {
        given(recommendationService.recommend(anyList()))
                .willThrow(new BusinessException(error, "private-provider-error"));

        perform(validRequest())
                .andExpect(status().is(error.httpStatus().value()))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$.errorCode").value(error.errorCode()))
                .andExpect(jsonPath("$.message").value(error.message()));
    }

    private ResultActions perform(BalanceGameRecommendationRequest request) throws Exception {
        return mockMvc.perform(post(PATH).with(authenticatedUser(1L))
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)));
    }

    private static BalanceGameRecommendationRequest validRequest() {
        return new BalanceGameRecommendationRequest(List.of(new Answer(1L, "A"), new Answer(2L, "UNKNOWN")));
    }
}
