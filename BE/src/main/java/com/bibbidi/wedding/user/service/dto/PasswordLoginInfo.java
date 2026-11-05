package com.bibbidi.wedding.user.service.dto;

public record PasswordLoginInfo(Long userId, String passwordHash) {
}
