package com.bibbidi.wedding.appointment.repository;

import com.bibbidi.wedding.appointment.domain.Appointment;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
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
