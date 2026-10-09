package com.bibbidi.wedding.chat;

import com.bibbidi.wedding.chat.domain.PreparationAppointment;
import com.bibbidi.wedding.chat.domain.PreparationChecklistItem;
import com.bibbidi.wedding.chat.domain.PreparationChecklistItemStatus;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

public final class ChatTestFixtures {

    public static final Long OWNER_ID = 1L;
    public static final Instant NOW = Instant.parse("2026-10-07T15:30:00Z");
    public static final Clock CLOCK = Clock.fixed(NOW, ZoneId.of("Asia/Seoul"));
    public static final LocalDate TODAY = LocalDate.of(2026, 10, 8);

    private ChatTestFixtures() {
    }

    public static PreparationSnapshot snapshot(List<PreparationChecklistItem> items) {
        return new PreparationSnapshot(null, items, List.of(), NOW);
    }

    public static PreparationSnapshot emptySnapshot() {
        return snapshot(List.of());
    }

    public static PreparationChecklistItem item(Long id, PreparationChecklistItemStatus status, PreparationAppointment... appointments) {
        return new PreparationChecklistItem(id, 1L, null, "드레스 준비", status, List.of(appointments));
    }

    public static PreparationAppointment appointment(Long id, LocalDate date, boolean done) {
        return new PreparationAppointment(id, "드레스 피팅", date, null, null, null, null, done);
    }
}
