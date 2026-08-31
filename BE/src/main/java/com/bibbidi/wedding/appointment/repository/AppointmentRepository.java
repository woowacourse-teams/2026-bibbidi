package com.bibbidi.wedding.appointment.repository;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.List;
import org.jspecify.annotations.NonNull;
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

    public Appointment findById(Long id) {
        JpaAppointmentEntity queryResult = getJpaAppointmentEntity(id);
        return appointmentMapper.toDomain(queryResult);
    }

    public boolean existsRemainingByChecklistItemId(Long checklistItemId) {
        return jpaAppointmentRepository.existsRemainingByChecklistItemId(checklistItemId);
    }

    public List<Appointment> findAllRemainingByChecklistItemId(Long checklistItemId) {
        return jpaAppointmentRepository.findAllRemainingByChecklistItemId(checklistItemId)
                .stream()
                .map(appointmentMapper::toDomain)
                .toList();
    }

    public void saveAll(List<Appointment> appointments) {
        List<JpaAppointmentEntity> entities = appointments.stream()
                .map(appointmentMapper::toEntity)
                .toList();

        jpaAppointmentRepository.saveAll(entities);
    }

    public int deleteAllByChecklistItemIds(List<Long> checklistItemIds) {
        return jpaAppointmentRepository.deleteAllByChecklistItemIds(checklistItemIds);
    }

    public void deleteById(Long id) {
        jpaAppointmentRepository.deleteById(id);
    }

    public void changeAllToNewChecklistItemIds(Long newChecklistItemId, List<Long> targetAppointmentIds) {
        jpaAppointmentRepository.changeAllToNewChecklistItemIds(newChecklistItemId, targetAppointmentIds);
    }

    public void deleteAll(List<Long> targetAppointmentIds) {
        jpaAppointmentRepository.deleteAll(targetAppointmentIds);
    }

    public List<Appointment> findOverlapCandidates(Long userId, Appointment appointment) {
        return jpaAppointmentRepository.findOverlapCandidates(
                        userId,
                        appointment.startTime(),
                        appointment.endTime()
                )
                .stream()
                .map(appointmentMapper::toDomain)
                .toList();
    }

    private @NonNull JpaAppointmentEntity getJpaAppointmentEntity(Long id) {
        return jpaAppointmentRepository.findById(id)
                .orElseThrow(
                        () -> new BusinessException(
                                ClientError.APPOINTMENT_NOT_FOUND,
                                "업데이트 대상 일정 조회 실패: " + id
                        )
                );
    }
}
