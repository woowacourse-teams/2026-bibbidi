package com.bibbidi.wedding.chat.domain;

import java.util.List;
import org.jspecify.annotations.NonNull;

public record OpeningDecision(
        @NonNull OpeningType type,
        boolean askWeddingDate,
        @NonNull List<Long> appointmentIds,
        @NonNull List<Long> checklistItemIds
) {

    public OpeningDecision {
        appointmentIds = List.copyOf(appointmentIds);
        checklistItemIds = List.copyOf(checklistItemIds);
    }

    public static OpeningDecision userRequest() {
        return new OpeningDecision(
                OpeningType.USER_REQUEST,
                false,
                List.of(),
                List.of()
        );
    }

    public static OpeningDecision preparationInformationRequired(boolean askWeddingDate) {
        return new OpeningDecision(
                OpeningType.PREPARATION_INFORMATION_REQUIRED,
                askWeddingDate,
                List.of(),
                List.of()
        );
    }

    public static OpeningDecision pastAppointments(List<Long> appointmentIds) {
        return new OpeningDecision(
                OpeningType.PAST_APPOINTMENTS,
                false,
                appointmentIds,
                List.of()
        );
    }

    public static OpeningDecision inProgressItems(List<Long> checklistItemIds) {
        return new OpeningDecision(
                OpeningType.IN_PROGRESS_ITEMS,
                false,
                List.of(),
                checklistItemIds
        );
    }

    public static OpeningDecision nextRecommendations() {
        return new OpeningDecision(
                OpeningType.NEXT_RECOMMENDATIONS,
                false,
                List.of(),
                List.of()
        );
    }
}
