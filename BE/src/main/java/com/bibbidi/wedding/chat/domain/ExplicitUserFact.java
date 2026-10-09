package com.bibbidi.wedding.chat.domain;

import org.jspecify.annotations.NonNull;

public record ExplicitUserFact(@NonNull String content, @NonNull String evidence) {
}
