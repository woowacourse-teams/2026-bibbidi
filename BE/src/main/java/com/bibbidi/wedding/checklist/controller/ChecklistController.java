package com.bibbidi.wedding.checklist.controller;

import com.bibbidi.wedding.checklist.controller.dto.req.CreateChecklistItemRequest;
import com.bibbidi.wedding.checklist.controller.dto.resp.AddCatalogItemsResponse;
import com.bibbidi.wedding.checklist.controller.dto.resp.ChecklistItemResponse;
import com.bibbidi.wedding.checklist.controller.dto.resp.ChecklistProgressResponse;
import com.bibbidi.wedding.checklist.controller.dto.resp.ChecklistWithAppointmentsResponse;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistProgressResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.common.auth.Auth;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ChecklistController {

    private final ChecklistService checklistService;

    public ChecklistController(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/checklists")
    public Long create(@Auth Long userId) {
        ChecklistCreationResult result = checklistService.create(userId);
        return result.id();
    }

    @GetMapping("/api/checklists/me")
    public ChecklistWithAppointmentsResponse findMyChecklist(@Auth Long userId) {
        ChecklistWithAppointmentsResult result = checklistService.findMyChecklist(userId);
        return ChecklistWithAppointmentsResponse.from(result);
    }

    @GetMapping("/api/checklists/me/progress")
    public ChecklistProgressResponse findMyChecklistProgress(@Auth Long userId) {
        ChecklistProgressResult result = checklistService.findMyChecklistProgress(userId);
        return ChecklistProgressResponse.from(result);
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/checklists/me/catalog-items")
    public AddCatalogItemsResponse addItemsFromCatalog(
            @Auth Long userId,
            @Valid
            @RequestBody
            @NotEmpty(message = "추가할 준비 항목을 하나 이상 선택해야 합니다.")
            List<@NotNull(message = "준비 항목 ID는 비어 있을 수 없습니다.") Long> catalogItemIds
    ) {
        CatalogItemAdditionResult result = checklistService.addItemsFromCatalog(userId, catalogItemIds);
        return AddCatalogItemsResponse.from(result);
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/checklists/me/items")
    public ChecklistItemResponse addCustomItem(@Auth Long userId,
                                               @Valid @RequestBody CreateChecklistItemRequest request) {
        ChecklistItemResult result = checklistService.addCustomItem(userId, request.title(), request.categoryId());

        return ChecklistItemResponse.from(result);
    }
}
