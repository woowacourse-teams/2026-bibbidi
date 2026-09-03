package com.bibbidi.wedding.feedback.domain;

import org.jspecify.annotations.Nullable;

public final class Feedback {

    private final Sentiment sentiment;
    private final String content;

    public Feedback(Sentiment sentiment, @Nullable String content) {
        this.sentiment = sentiment;
        this.content = content;
    }

    public Sentiment sentiment() {
        return sentiment;
    }

    public String content() {
        return content;
    }
}
