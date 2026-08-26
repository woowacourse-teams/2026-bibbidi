package com.bibbidi.wedding.appointment.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaAppointmentRepository extends JpaRepository<JpaAppointmentEntity, Long> {
}
