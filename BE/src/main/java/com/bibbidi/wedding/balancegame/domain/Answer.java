package com.bibbidi.wedding.balancegame.domain;

public record Answer(
        Question question,
        Option selected
) {

    public String questionText() {
        return question.text();
    }

    public String selectedText() {
        return selected.text();
    }
}
