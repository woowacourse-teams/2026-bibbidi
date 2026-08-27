package com.bibbidi.wedding.appointment.service;

import java.util.List;

public interface AppointmentDeleteServiceInterface {
    void changeAllToNewChecklistItemIds(Long newChecklistItemId, List<Integer> targetAppointmentIds);
    void deleteAll(List<Integer> targetAppointmentIds);
}
