package com.bibbidi.wedding.chat.service.dto;

import com.bibbidi.wedding.chat.domain.ConversationState;
import com.bibbidi.wedding.chat.domain.OpeningDecision;

public record ConversationStartResult(ConversationState state, OpeningDecision opening) {
}
