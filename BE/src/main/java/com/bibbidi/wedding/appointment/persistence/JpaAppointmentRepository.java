package com.bibbidi.wedding.appointment.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface JpaAppointmentRepository extends JpaRepository<JpaAppointmentEntity, Long> {

    Optional<JpaAppointmentEntity> findById(Long id);
}
