package com.bibbidi.wedding.appointment.persistence;

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
}
