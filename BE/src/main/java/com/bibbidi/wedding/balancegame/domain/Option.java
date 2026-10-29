package com.bibbidi.wedding.balancegame.domain;

public record Option(
        String id,
        String text
) {

    public boolean hasId(String optionId) {
        return id.equals(optionId);
    }
}
