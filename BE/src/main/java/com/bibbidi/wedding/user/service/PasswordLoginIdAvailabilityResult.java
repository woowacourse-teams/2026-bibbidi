package com.bibbidi.wedding.user.service;

public record PasswordLoginIdAvailabilityResult(
        String passwordLoginId,
        boolean available
) {
}
