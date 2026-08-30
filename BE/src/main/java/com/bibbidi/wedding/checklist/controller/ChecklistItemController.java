package com.bibbidi.wedding.checklist.controller;

import com.bibbidi.wedding.auth.session.Auth;
import com.bibbidi.wedding.checklist.controller.dto.ChangeChecklistItemCategoryRequest;
import com.bibbidi.wedding.checklist.controller.dto.ChangeChecklistItemTitleRequest;
import com.bibbidi.wedding.checklist.controller.dto.ChecklistItemResponse;
import com.bibbidi.wedding.checklist.service.ChecklistItemDeletionService;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ChecklistItemController {

    private final ChecklistService checklistService;
    private final ChecklistItemDeletionService checklistItemDeletionService;

    public ChecklistItemController(
            ChecklistService checklistService,
            ChecklistItemDeletionService checklistItemDeletionService
    ) {
        this.checklistService = checklistService;
        this.checklistItemDeletionService = checklistItemDeletionService;
    }

    @PutMapping("/api/checklist-items/{itemId}/category")
    public ChecklistItemResponse changeCategory(
            @Auth Long userId,
            @PathVariable Long itemId,
            @Valid @RequestBody ChangeChecklistItemCategoryRequest request
    ) {
        ChecklistItemResult result = checklistService.changeItemCategory(
                userId,
                itemId,
                request.categoryId()
        );

        return ChecklistItemResponse.from(result);
    }

    @PutMapping("/api/checklist-items/{itemId}/title")
    public ChecklistItemResponse changeTitle(
            @Auth Long userId,
            @PathVariable Long itemId,
            @Valid @RequestBody ChangeChecklistItemTitleRequest request
    ) {
        ChecklistItemResult result = checklistService.changeItemTitle(
                userId,
                itemId,
                request.title()
        );

        return ChecklistItemResponse.from(result);
    }

    @DeleteMapping("/api/checklist-items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @Auth Long userId,
            @PathVariable Long itemId
    ) {
        checklistItemDeletionService.delete(userId, itemId);
    }
}
