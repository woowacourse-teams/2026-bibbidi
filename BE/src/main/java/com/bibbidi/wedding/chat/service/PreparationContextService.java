package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.Appointment;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.CatalogItem;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.ChecklistItem;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot.Status;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistAppointmentResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemWithAppointmentsResult;
import com.bibbidi.wedding.user.service.UserService;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PreparationContextService {

    private final ChecklistService checklistService;
    private final UserService userService;
    private final CatalogService catalogService;
    private final Clock clock;

    public PreparationContextService(ChecklistService checklistService, UserService userService,
                                     CatalogService catalogService, @Qualifier("conversationClock") Clock clock) {
        this.checklistService = checklistService;
        this.userService = userService;
        this.catalogService = catalogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PreparationSnapshot load(Long userId) {
        LocalDate weddingDate = userService.findWeddingDate(userId).weddingDate();
        List<ChecklistItem> items = checklistService.findMyChecklist(userId).items().stream()
                .map(this::toChecklistItem)
                .toList();
        List<CatalogItem> catalogItems = catalogService.findAllItemDetails().stream()
                .map(this::toCatalogItem)
                .toList();
        return new PreparationSnapshot(weddingDate, items, catalogItems, clock.instant());
    }

    private ChecklistItem toChecklistItem(ChecklistItemWithAppointmentsResult item) {
        Status status = switch (item.statusValue()) {
            case "prev" -> Status.PREV;
            case "continue" -> Status.CONTINUE;
            case "done" -> Status.DONE;
            default -> throw new IllegalStateException("지원하지 않는 할 일 상태입니다.");
        };
        return new ChecklistItem(item.id(), item.categoryId(), item.sourceCatalogItemId(), item.title(), status,
                item.appointments().stream().map(this::toAppointment).toList());
    }

    private Appointment toAppointment(ChecklistAppointmentResult appointment) {
        return new Appointment(appointment.id(), appointment.title(), appointment.date(), appointment.startTime(),
                appointment.endTime(), appointment.place(), appointment.memo(), appointment.isDone());
    }

    private CatalogItem toCatalogItem(CatalogItemDetailSnapshot item) {
        return new CatalogItem(item.id(), item.title(), item.categoryName(), item.phase(), item.stepName());
    }
}
