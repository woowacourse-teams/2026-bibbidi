package com.bibbidi.wedding.balancegame.repository.dto;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import org.jspecify.annotations.Nullable;

public record ChoiceData(
        @NotBlank String id,
        @NotBlank String text,
        @Nullable String imagePath
) {

    public Choice toChoice(String imageBaseUrl) {
        if (imagePath == null) {
            return new Choice(id, text, null);
        }
        try {
            URI baseUri = URI.create(imageBaseUrl.endsWith("/") ? imageBaseUrl : imageBaseUrl + "/");
            URI path = URI.create(imagePath);
            URI imageUri = baseUri.resolve(path).normalize();
            if (!("https".equals(baseUri.getScheme()) || "http".equals(baseUri.getScheme()))
                    || baseUri.getHost() == null || baseUri.getRawQuery() != null || baseUri.getRawFragment() != null
                    || imagePath.isBlank() || path.isAbsolute() || path.getRawAuthority() != null
                    || path.getRawQuery() != null || path.getRawFragment() != null
                    || !imageUri.toString().startsWith(baseUri.toString())) {
                throw new IllegalArgumentException("공개 이미지 기본 URL과 그 아래의 상대 경로가 필요합니다");
            }
            return new Choice(id, text, imageUri.toString());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("밸런스게임 이미지 경로가 올바르지 않습니다: optionId=" + id
                    + ", imagePath=" + imagePath + ", image-base-url=" + imageBaseUrl, e);
        }
    }
}
