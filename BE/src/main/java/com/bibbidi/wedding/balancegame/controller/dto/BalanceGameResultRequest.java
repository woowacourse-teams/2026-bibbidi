package com.bibbidi.wedding.balancegame.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.Map;

public record BalanceGameResultRequest(
        @NotEmpty(message = "하나 이상의 문항에 답해야 합니다.")
        Map<
                @NotBlank(message = "문항 ID는 비어 있을 수 없습니다.") String,
                @NotBlank(message = "선택지 ID는 비어 있을 수 없습니다.") String
                > answers
) {
}
