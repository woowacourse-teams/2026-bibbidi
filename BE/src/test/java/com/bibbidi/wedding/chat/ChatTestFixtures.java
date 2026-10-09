package com.bibbidi.wedding.chat;

import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.Appointment;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.ChecklistItem;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.Status;
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

    public static PreparationSnapshot snapshot(List<ChecklistItem> items) {
        return new PreparationSnapshot(null, items, List.of(), NOW);
    }

    public static PreparationSnapshot emptySnapshot() {
        return snapshot(List.of());
    }

    public static ChecklistItem item(Long id, Status status, Appointment... appointments) {
        return new ChecklistItem(id, 1L, null, "드레스 준비", status, List.of(appointments));
    }

    public static Appointment appointment(Long id, LocalDate date, boolean done) {
        return new Appointment(id, "드레스 피팅", date, null, null, null, null, done);
    }
}
