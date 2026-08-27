package com.bibbidi.wedding.checklist.controller;

import com.bibbidi.wedding.auth.session.Auth;
import com.bibbidi.wedding.checklist.controller.dto.ChecklistCreationResponse;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
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
}
