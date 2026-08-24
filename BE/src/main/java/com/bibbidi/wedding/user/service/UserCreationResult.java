package com.bibbidi.wedding.user.service;

import java.util.UUID;

public record UserCreationResult(UUID id, String nickname, long checklistId) {
}
