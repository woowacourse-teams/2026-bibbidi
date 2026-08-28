package com.bibbidi.wedding.appointment.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface JpaAppointmentRepository extends JpaRepository<JpaAppointmentEntity, Long> {

    Optional<JpaAppointmentEntity> findById(Long id);

    @Modifying(clearAutomatically = true)
    @Query("""
            UPDATE JpaAppointmentEntity appointment
            SET appointment.checklistItemId = :newChecklistItemId
            WHERE appointment.id IN :targetAppointmentIds
            """)
    int changeAllToNewChecklistItemIds(
            Long newChecklistItemId,
            List<Long> targetAppointmentIds
    );

    @Modifying(clearAutomatically = true)
    @Query("""
            DELETE FROM JpaAppointmentEntity appointment
            WHERE appointment.id IN :targetAppointmentIds
            """)
    int deleteAll(List<Long> targetAppointmentIds);
}
