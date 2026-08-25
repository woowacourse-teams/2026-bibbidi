package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistService {

    private final ChecklistRepository checklistRepository;

    public ChecklistService(ChecklistRepository checklistRepository) {
        this.checklistRepository = checklistRepository;
    }

    @Transactional
    public Checklist createChecklistFor(Long ownerId) {
        return checklistRepository.save(Checklist.createFor(ownerId));
    }
}
