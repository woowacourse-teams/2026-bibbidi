package com.bibbidi.wedding.balancegame.controller.dto;

import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import java.util.List;

public record BalanceGameRecommendationResponse(List<Item> items) {

    public static BalanceGameRecommendationResponse from(List<CatalogItemDetailSnapshot> items) {
        return new BalanceGameRecommendationResponse(items.stream()
                .map(item -> new Item(item.id(), item.title(), item.categoryName(), item.phase(), item.stepName()))
                .toList());
    }

    public record Item(Long catalogItemId, String title, String categoryName, int phase, String stepName) {
    }
}
