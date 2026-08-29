package com.bibbidi.wedding.appointment.service;

import java.util.List;

public interface AppointmentDeleteService {
    void changeAllToNewChecklistItemIds(Long newChecklistItemId, List<Long> targetAppointmentIds);

    void deleteAll(List<Long> targetAppointmentIds);

    void deleteAllByChecklistItemIds(List<Long> checklistItemIds);
}
