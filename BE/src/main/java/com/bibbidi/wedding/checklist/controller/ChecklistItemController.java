package com.bibbidi.wedding.checklist.controller;

import com.bibbidi.wedding.checklist.controller.dto.resp.ChecklistItemResponse;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistItemResult;
import com.bibbidi.wedding.common.auth.Auth;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ChecklistItemController {

    private final ChecklistService checklistService;

    public ChecklistItemController(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @GetMapping("/api/checklist-items/{itemId}/remaining-appointments")
    public boolean hasRemainingAppointments(
            @Auth Long userId,
            @PathVariable Long itemId
    ) {
        return checklistService.hasRemainingAppointments(userId, itemId);
    }

    @PutMapping("/api/checklist-items/{itemId}/category")
    public ChecklistItemResponse changeCategory(
            @Auth Long userId,
            @PathVariable Long itemId,
            @Valid @RequestBody @NotNull(message = "카테고리를 선택해야 합니다.") Long categoryId
    ) {
        ChecklistItemResult result = checklistService.changeItemCategory(userId, itemId, categoryId);

        return ChecklistItemResponse.from(result);
    }

    @PutMapping("/api/checklist-items/{itemId}/title")
    public ChecklistItemResponse changeTitle(
            @Auth Long userId,
            @PathVariable Long itemId,
            @Valid
            @RequestBody
            @NotBlank(message = "할 일 제목을 입력해야 합니다.")
            @Size(max = 50, message = "할 일 제목은 50자를 넘을 수 없습니다.")
            String title
    ) {
        String stripedTitle = title.strip();
        ChecklistItemResult result = checklistService.changeItemTitle(
                userId,
                itemId,
                stripedTitle
        );

        return ChecklistItemResponse.from(result);
    }

    @PutMapping("/api/checklist-items/{itemId}/status")
    public ChecklistItemResponse changeStatus(
            @Auth Long userId,
            @PathVariable Long itemId,
            @Valid @RequestBody @NotNull(message = "할 일 상태를 선택해야 합니다.") String status
    ) {
        ChecklistItemResult result = checklistService.changeItemStatus(userId, itemId, status);

        return ChecklistItemResponse.from(result);
    }

    @DeleteMapping("/api/checklist-items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @Auth Long userId,
            @PathVariable Long itemId
    ) {
        checklistService.deleteItem(userId, itemId);
    }
}
