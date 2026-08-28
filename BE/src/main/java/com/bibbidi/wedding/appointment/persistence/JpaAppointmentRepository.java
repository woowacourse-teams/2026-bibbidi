package com.bibbidi.wedding.appointment.persistence;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
    void changeAllToNewChecklistItemIds(
            Long newChecklistItemId,
            List<Long> targetAppointmentIds
    );

    @Modifying(clearAutomatically = true)
    @Query("""
            DELETE FROM JpaAppointmentEntity appointment
            WHERE appointment.id IN :targetAppointmentIds
            """)
    void deleteAll(List<Long> targetAppointmentIds);

    @Query("""
            SELECT appointment
            FROM JpaAppointmentEntity appointment
            JOIN JpaChecklistItemEntity item ON item.id = appointment.checklistItemId
            JOIN JpaChecklistEntity checklist ON checklist.id = item.checklistId
            WHERE checklist.ownerId = :userId
              AND appointment.date = :date
              AND appointment.startTime IS NOT NULL
              AND appointment.endTime IS NOT NULL
              AND appointment.place IS NOT NULL
              AND appointment.id <> :excludedAppointmentId
              AND (
                    (appointment.startTime < :endTime AND :startTime < appointment.endTime)
                 OR (:startTime = :endTime
                     AND appointment.startTime <= :startTime AND :startTime <= appointment.endTime)
                 OR (appointment.startTime = appointment.endTime
                     AND :startTime <= appointment.startTime AND appointment.startTime <= :endTime)
              )
            ORDER BY appointment.startTime ASC, appointment.id ASC
            """)
    List<JpaAppointmentEntity> findConflictingWithNewAppointment(
            Long userId,
            LocalDate date,
            LocalDateTime startTime,
            LocalDateTime endTime,
            Long excludedAppointmentId
    );
}
