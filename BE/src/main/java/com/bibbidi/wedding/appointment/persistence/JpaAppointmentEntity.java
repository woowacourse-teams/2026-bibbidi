package com.bibbidi.wedding.appointment.persistence;

import com.bibbidi.wedding.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "appointments")
public class JpaAppointmentEntity extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "checklist_item_id", nullable = false)
    private Long checklistItemId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "appointment_date", nullable = false)
    private LocalDate date;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "place", length = 255)
    private String place;

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo;

    @Column(name = "is_done", nullable = false)
    private boolean isDone;

    protected JpaAppointmentEntity() {
    }

    public JpaAppointmentEntity(
            Long id,
            Long checklistItemId,
            String title,
            LocalDate date,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String place,
            String memo,
            boolean isDone
    ) {
        this.id = id;
        this.checklistItemId = checklistItemId;
        this.title = title;
        this.date = date;
        this.startTime = startTime;
        this.endTime = endTime;
        this.place = place;
        this.memo = memo;
        this.isDone = isDone;
    }

    public Long id() {
        return id;
    }

    public Long checklistItemId() {
        return checklistItemId;
    }

    public String title() {
        return title;
    }

    public LocalDate date() {
        return date;
    }

    public LocalDateTime startTime() {
        return startTime;
    }

    public LocalDateTime endTime() {
        return endTime;
    }

    public String place() {
        return place;
    }

    public String memo() {
        return memo;
    }

    public boolean isDone() {
        return isDone;
    }
}
