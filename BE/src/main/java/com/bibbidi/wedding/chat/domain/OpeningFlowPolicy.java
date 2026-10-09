package com.bibbidi.wedding.chat.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

public class OpeningFlowPolicy {

    public OpeningDecision classify(
            @Nullable String initialMessage,
            PreparationSnapshot snapshot,
            Set<Long> confirmedAppointmentIds,
            LocalDate today
    ) {
        if (initialMessage != null && !initialMessage.isBlank()) {
            return OpeningDecision.userRequest();
        }
        if (snapshot.hasNoChecklistItems()) {
            return OpeningDecision.preparationInformationRequired(!snapshot.hasWeddingDate());
        }

        List<Long> pastAppointmentIds = snapshot.pastUnconfirmedAppointmentIds(confirmedAppointmentIds, today);
        if (!pastAppointmentIds.isEmpty()) {
            return OpeningDecision.pastAppointments(pastAppointmentIds);
        }

        List<Long> inProgressItemIds = snapshot.inProgressChecklistItemIds();
        if (!inProgressItemIds.isEmpty()) {
            return OpeningDecision.inProgressItems(inProgressItemIds);
        }
        return OpeningDecision.nextRecommendations();
    }
}
