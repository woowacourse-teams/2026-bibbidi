package com.bibbidi.wedding.appointment.service;

import java.util.List;

public interface AppointmentDeleteServiceInterface {
    void changeAllToNewChecklistItemIds(Long newChecklistItemId, List<Long> targetAppointmentIds);

    void deleteAll(List<Long> targetAppointmentIds);
}
