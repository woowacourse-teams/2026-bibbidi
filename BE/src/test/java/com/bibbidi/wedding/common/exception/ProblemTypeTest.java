package com.bibbidi.wedding.common.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ProblemTypeTest {

    @Test
    @DisplayName("오류 유형을 정의하면 오류 ID는 서로 중복되지 않는다")
    void shouldHaveUniqueIdsWhenProblemTypesAreDefined() {
        assertThat(Arrays.stream(ProblemType.values()).map(ProblemType::id).toList())
                .doesNotHaveDuplicates();
    }
}
