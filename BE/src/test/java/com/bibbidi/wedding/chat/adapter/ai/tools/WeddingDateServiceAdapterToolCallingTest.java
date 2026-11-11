package com.bibbidi.wedding.chat.adapter.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.chat.support.ToolCallingFixture;
import com.bibbidi.wedding.user.service.UserService;
import com.bibbidi.wedding.user.service.WeddingDateResult;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WeddingDateServiceAdapterToolCallingTest {

    private static final Long USER_ID = 7L;

    private UserService userService;
    private ToolCallingFixture toolCalling;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        toolCalling = new ToolCallingFixture(new WeddingDateServiceAdapter(userService));
    }

    @Test
    @DisplayName("결혼 날짜 도구를 모델 요청에 등록한다")
    void registersTheWeddingDateToolOnTheModelRequest() {
        assertThat(toolCalling.registeredToolNames(USER_ID)).containsExactly("getMyWeddingDate");
    }

    @Test
    @DisplayName("모델이 getMyWeddingDate를 호출하면 요청한 사용자의 결혼 날짜를 돌려준다")
    void returnsTheWeddingDateOfTheRequestingUser() {
        when(userService.findWeddingDate(USER_ID)).thenReturn(new WeddingDateResult(LocalDate.of(2027, 5, 15)));

        String response = toolCalling.callTool(USER_ID, "getMyWeddingDate", "{}");

        verify(userService).findWeddingDate(USER_ID);
        assertThat(response).contains("2027-05-15");
    }

    @Test
    @DisplayName("결혼 날짜를 등록하지 않았으면 날짜 없이 돌려준다")
    void returnsNoDateWhenTheUserHasNotRegisteredOne() {
        when(userService.findWeddingDate(USER_ID)).thenReturn(new WeddingDateResult(null));

        String response = toolCalling.callTool(USER_ID, "getMyWeddingDate", "{}");

        assertThat(response).doesNotContain("20");
    }
}
