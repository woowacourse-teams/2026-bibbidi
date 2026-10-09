package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.chat.domain.PreparationAppointment;
import com.bibbidi.wedding.chat.domain.PreparationCatalogItem;
import com.bibbidi.wedding.chat.domain.PreparationChecklistItem;
import com.bibbidi.wedding.chat.domain.PreparationChecklistItemStatus;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
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

    public PreparationContextService(
            ChecklistService checklistService,
            UserService userService,
            CatalogService catalogService,
            @Qualifier("conversationClock") Clock clock
    ) {
        this.checklistService = checklistService;
        this.userService = userService;
        this.catalogService = catalogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PreparationSnapshot load(Long userId) {
        LocalDate weddingDate = userService.findWeddingDate(userId).weddingDate();
        List<PreparationChecklistItem> items = checklistService.findMyChecklist(userId).items().stream()
                .map(this::toChecklistItem)
                .toList();
        List<PreparationCatalogItem> catalogItems = catalogService.findAllItemDetails().stream()
                .map(this::toCatalogItem)
                .toList();
        return new PreparationSnapshot(weddingDate, items, catalogItems, clock.instant());
    }

    private PreparationChecklistItem toChecklistItem(ChecklistItemWithAppointmentsResult item) {
        PreparationChecklistItemStatus status = switch (item.statusValue()) {
            case "prev" -> PreparationChecklistItemStatus.PREV;
            case "continue" -> PreparationChecklistItemStatus.CONTINUE;
            case "done" -> PreparationChecklistItemStatus.DONE;
            default -> throw new IllegalStateException("지원하지 않는 할 일 상태입니다.");
        };
        return new PreparationChecklistItem(
                item.id(),
                item.categoryId(),
                item.sourceCatalogItemId(),
                item.title(),
                status,
                item.appointments().stream().map(this::toAppointment).toList()
        );
    }

    private PreparationAppointment toAppointment(ChecklistAppointmentResult appointment) {
        return new PreparationAppointment(
                appointment.id(),
                appointment.title(),
                appointment.date(),
                appointment.startTime(),
                appointment.endTime(),
                appointment.place(),
                appointment.memo(),
                appointment.isDone()
        );
    }

    private PreparationCatalogItem toCatalogItem(CatalogItemDetailSnapshot item) {
        return new PreparationCatalogItem(
                item.id(),
                item.title(),
                item.categoryName(),
                item.phase(),
                item.stepName()
        );
    }
}
