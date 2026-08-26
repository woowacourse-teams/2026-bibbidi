package com.bibbidi.wedding.appointment.repository;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import java.time.LocalDateTime;
import org.springframework.stereotype.Component;

@Component
public class AppointmentMapper {

    public JpaAppointmentEntity toEntity(Appointment appointment) {
        return new JpaAppointmentEntity(
                appointment.id(),
                appointment.checklistItemId(),
                appointment.title(),
                appointment.date(),
                appointment.startTime(),
                appointment.endTime(),
                appointment.place(),
                appointment.memo(),
                appointment.isDone()
        );
    }

    public Appointment toDomain(JpaAppointmentEntity entity) {
        return new Appointment(
                entity.id(),
                entity.checklistItemId(),
                entity.title(),
                entity.date(),
                entity.startTime(),
                entity.endTime(),
                entity.place(),
                entity.memo(),
                entity.isDone()
        );
    }
}
