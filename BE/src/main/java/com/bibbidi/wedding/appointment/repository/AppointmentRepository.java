package com.bibbidi.wedding.appointment.repository;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import org.springframework.stereotype.Repository;

@Repository
public class AppointmentRepository {

    private final JpaAppointmentRepository jpaAppointmentRepository;
    private final AppointmentMapper appointmentMapper;

    public AppointmentRepository(
            JpaAppointmentRepository jpaAppointmentRepository,
            AppointmentMapper appointmentMapper
    ) {
        this.jpaAppointmentRepository = jpaAppointmentRepository;
        this.appointmentMapper = appointmentMapper;
    }

    public Appointment save(Appointment appointment) {
        JpaAppointmentEntity entity = appointmentMapper.toEntity(appointment);
        JpaAppointmentEntity result = jpaAppointmentRepository.save(entity);
        return appointmentMapper.toDomain(result);
    }
}
