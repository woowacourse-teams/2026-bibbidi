package com.bibbidi.wedding.balancegame.adapter.ai;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("bibbidi.ai.balance-game")
public record BalanceGameAiProperties(@NotBlank String model) {
}
