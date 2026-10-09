package com.bibbidi.wedding.chat.domain;

import java.util.List;
import java.util.Set;
import org.jspecify.annotations.NonNull;

public record ConversationState(
        @NonNull String id,
        @NonNull Long ownerId,
        @NonNull PreparationSnapshot snapshot,
        @NonNull List<ExplicitUserFact> explicitFacts,
        @NonNull Set<Long> confirmedAppointmentIds
) {

    public ConversationState {
        explicitFacts = List.copyOf(explicitFacts);
        confirmedAppointmentIds = Set.copyOf(confirmedAppointmentIds);
    }

    public boolean isOwnedBy(Long userId) {
        return ownerId.equals(userId);
    }

    public ConversationState withAcceptedContext(List<ExplicitUserFact> facts, Set<Long> appointmentIds) {
        return new ConversationState(id, ownerId, snapshot, facts, appointmentIds);
    }
}
