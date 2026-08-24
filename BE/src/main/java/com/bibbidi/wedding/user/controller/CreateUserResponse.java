package com.bibbidi.wedding.user.controller;

import com.bibbidi.wedding.user.service.UserCreationResult;
import java.util.UUID;

public record CreateUserResponse(UUID id, String nickname, long checklistId) {

    public static CreateUserResponse from(UserCreationResult result) {
        return new CreateUserResponse(result.id(), result.nickname(), result.checklistId());
    }
}
