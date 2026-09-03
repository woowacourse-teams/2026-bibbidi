package com.bibbidi.wedding.checklist.controller;

import com.bibbidi.wedding.auth.session.Auth;
import com.bibbidi.wedding.checklist.controller.dto.AddCatalogItemsRequest;
import com.bibbidi.wedding.checklist.controller.dto.AddCatalogItemsResponse;
import com.bibbidi.wedding.checklist.controller.dto.ChecklistCreationResponse;
import com.bibbidi.wedding.checklist.controller.dto.ChecklistItemResponse;
import com.bibbidi.wedding.checklist.controller.dto.ChecklistWithAppointmentsResponse;
import com.bibbidi.wedding.checklist.controller.dto.CreateChecklistItemRequest;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.CatalogItemAdditionResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
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
    public ChecklistCreationResponse create(@Auth Long userId) {
        ChecklistCreationResult result = checklistService.create(userId);
        return ChecklistCreationResponse.from(result);
    }

    @GetMapping("/api/checklists/me")
    public ChecklistWithAppointmentsResponse findMyChecklist(@Auth Long userId) {
        ChecklistWithAppointmentsResult result = checklistService.findMyChecklist(userId);
        return ChecklistWithAppointmentsResponse.from(result);
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/checklists/me/catalog-items")
    public AddCatalogItemsResponse addItemsFromCatalog(@Auth Long userId, @Valid @RequestBody AddCatalogItemsRequest request) {
        CatalogItemAdditionResult result = checklistService.addItemsFromCatalog(userId, request.catalogItemIds());
        return AddCatalogItemsResponse.from(result);
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/checklists/me/items")
    public ChecklistItemResponse addCustomItem(@Auth Long userId, @Valid @RequestBody CreateChecklistItemRequest request) {
        ChecklistItemResult result = checklistService.addCustomItem(userId, request.title(), request.categoryId());

        return ChecklistItemResponse.from(result);
    }
}
