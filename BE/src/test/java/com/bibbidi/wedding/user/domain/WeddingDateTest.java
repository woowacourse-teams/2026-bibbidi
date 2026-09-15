package com.bibbidi.wedding.user.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WeddingDateTest {

    @Test
    @DisplayName("결혼 예정일을 변경해도 사용자 ID를 유지한다")
    void shouldKeepUserIdWhenDateChanges() {
        WeddingDate weddingDate = new WeddingDate(1L, null);

        WeddingDate changed = weddingDate.changeDate(LocalDate.of(2027, 5, 15));

        assertThat(changed)
                .extracting(WeddingDate::userId, WeddingDate::date)
                .containsExactly(1L, LocalDate.of(2027, 5, 15));
    }

    @Test
    @DisplayName("과거 날짜와 동일한 날짜로도 변경할 수 있다")
    void shouldAllowPastAndSameDate() {
        LocalDate pastDate = LocalDate.of(2020, 1, 1);
        WeddingDate weddingDate = new WeddingDate(1L, pastDate);

        WeddingDate changed = weddingDate.changeDate(pastDate);

        assertThat(changed.date()).isEqualTo(pastDate);
    }
}
