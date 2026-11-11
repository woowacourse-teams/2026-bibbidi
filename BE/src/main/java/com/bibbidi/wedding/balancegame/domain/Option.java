package com.bibbidi.wedding.balancegame.domain;

public record Option(
        String id,
        String text,
        String imageUrl
) {

    public boolean hasId(String optionId) {
        return id.equals(optionId);
    }
}
