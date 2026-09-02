package com.bibbidi.wedding.appointment.persistence;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JpaAppointmentRepository extends JpaRepository<JpaAppointmentEntity, Long> {

    Optional<JpaAppointmentEntity> findById(Long id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM JpaAppointmentEntity appointment WHERE appointment.checklistItemId IN :checklistItemIds")
    int deleteAllByChecklistItemIds(@Param("checklistItemIds") List<Long> checklistItemIds);

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
            SELECT COUNT(appointment) > 0
            FROM JpaAppointmentEntity appointment
            WHERE appointment.checklistItemId = :checklistItemId
              AND appointment.isDone = false
            """)
    boolean existsRemainingByChecklistItemId(Long checklistItemId);

    @Query("""
            SELECT appointment
            FROM JpaAppointmentEntity appointment
            WHERE appointment.checklistItemId = :checklistItemId
              AND appointment.isDone = :isDone
            """)
    List<JpaAppointmentEntity> findAllByChecklistItemIdAndIsDone(Long checklistItemId, boolean isDone);

    @Query("""
            SELECT appointment
            FROM JpaAppointmentEntity appointment
            JOIN JpaChecklistItemEntity item ON item.id = appointment.checklistItemId
            WHERE item.checklist.ownerId = :userId
              AND appointment.startTime <= :endTime
              AND appointment.endTime >= :startTime
            """)
    List<JpaAppointmentEntity> findOverlapCandidates(
            Long userId,
            LocalDateTime startTime,
            LocalDateTime endTime
    );
}
