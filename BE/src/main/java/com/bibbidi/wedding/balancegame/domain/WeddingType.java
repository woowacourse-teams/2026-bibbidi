package com.bibbidi.wedding.balancegame.domain;

import java.util.List;

public record WeddingType(
        String id,
        String name,
        String summary,
        String imageUrl,
        List<Long> catalogItemIds
) {

    public boolean hasId(String typeId) {
        return id.equals(typeId);
    }
}
