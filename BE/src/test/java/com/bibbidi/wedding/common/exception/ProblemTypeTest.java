package com.bibbidi.wedding.common.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class ProblemTypeTest {

    @Test
    void errorIdsAreUnique() {
        assertThat(Arrays.stream(ProblemType.values()).map(ProblemType::id).toList())
                .doesNotHaveDuplicates();
    }
}
