package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistService {

    private static final String DUPLICATE_CHECKLIST_MESSAGE = "체크리스트 중복 생성에 실패했습니다. ownerId=";

    private final ChecklistRepository checklistRepository;
    private final ChecklistItemRepository checklistItemRepository;

    public ChecklistService(
            ChecklistRepository checklistRepository,
            ChecklistItemRepository checklistItemRepository
    ) {
        this.checklistRepository = checklistRepository;
        this.checklistItemRepository = checklistItemRepository;
    }

    @Transactional
    public ChecklistCreationResult create(Long ownerId) {
        if (checklistRepository.existsByOwnerId(ownerId)) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST,
                    DUPLICATE_CHECKLIST_MESSAGE + ownerId
            );
        }

        try {
            Checklist checklist = checklistRepository.save(new Checklist(null, ownerId));
            return ChecklistCreationResult.from(checklist);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_CHECKLIST,
                    DUPLICATE_CHECKLIST_MESSAGE + ownerId
            );
        }
    }

    @Transactional(readOnly = true)
    public boolean checkItemOwnership(Long ownerId, Long checklistItemId) {
        return checklistItemRepository.existsByIdAndOwnerId(checklistItemId, ownerId);
    }
}
