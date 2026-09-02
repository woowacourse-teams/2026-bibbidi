package com.bibbidi.wedding.checklist.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class ChecklistItemStatusTest {

    @ParameterizedTest
    @CsvSource({
            "PREV, PREV",
            "CONTINUE, CONTINUE",
            "DONE, DONE",
            "done, DONE",
            "Done, DONE",
            "cOnTiNuE, CONTINUE"
    })
    @DisplayName("대소문자를 구분하지 않고 상태 이름과 같은 값을 주면 그 상태를 만든다")
    void shouldCreateStatusFromMatchingName(String value, ChecklistItemStatus expected) {
        ChecklistItemStatus status = ChecklistItemStatus.from(value);

        assertThat(status).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"FINISHED", "", " ", "DONE "})
    @NullSource
    @DisplayName("상태 이름과 다른 값을 주면 만들 수 없다")
    void shouldRejectValueThatMatchesNoStatus(String value) {
        assertThatThrownBy(() -> ChecklistItemStatus.from(value))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("지원하지 않는 할 일 상태입니다.")
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.INVALID_REQUEST);
    }
}
