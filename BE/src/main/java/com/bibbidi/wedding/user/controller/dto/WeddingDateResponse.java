package com.bibbidi.wedding.user.controller.dto;

import com.bibbidi.wedding.user.service.WeddingDateResult;
import java.time.LocalDate;

public record WeddingDateResponse(
        LocalDate weddingDate
) {

    public static WeddingDateResponse from(WeddingDateResult result) {
        return new WeddingDateResponse(result.weddingDate());
    }
}
