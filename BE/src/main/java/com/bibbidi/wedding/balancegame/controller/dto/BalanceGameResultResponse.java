package com.bibbidi.wedding.balancegame.controller.dto;

import com.bibbidi.wedding.balancegame.domain.WeddingType;
import java.util.List;

public record BalanceGameResultResponse(
        String id,
        String name,
        String summary,
        String imageUrl,
        List<Long> catalogItemIds
) {

    public static BalanceGameResultResponse from(WeddingType type) {
        return new BalanceGameResultResponse(
                type.id(),
                type.name(),
                type.summary(),
                type.imageUrl(),
                type.catalogItemIds()
        );
    }
}
