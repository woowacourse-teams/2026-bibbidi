package com.bibbidi.wedding.chat.domain;

import org.jspecify.annotations.NonNull;

public record PreparationCatalogItem(
        @NonNull Long id,
        @NonNull String title,
        @NonNull String categoryName,
        int phase,
        @NonNull String stepName
) {
}
