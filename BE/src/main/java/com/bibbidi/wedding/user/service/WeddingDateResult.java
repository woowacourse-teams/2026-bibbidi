package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.user.domain.User;
import java.time.LocalDate;

public record WeddingDateResult(
        LocalDate weddingDate
) {

    public static WeddingDateResult from(User user) {
        return new WeddingDateResult(user.weddingDate());
    }
}
