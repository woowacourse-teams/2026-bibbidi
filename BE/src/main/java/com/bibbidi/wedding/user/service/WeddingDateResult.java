package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.user.domain.WeddingDate;
import java.time.LocalDate;

public record WeddingDateResult(
        LocalDate weddingDate
) {

    public static WeddingDateResult from(WeddingDate weddingDate) {
        return new WeddingDateResult(weddingDate.date());
    }
}
