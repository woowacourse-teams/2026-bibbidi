package com.bibbidi.wedding.checklist.service;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.domain.ChecklistItem;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.util.Objects;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChecklistService {

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
            throw duplicateChecklist(ownerId);
        }

        try {
            Checklist checklist = checklistRepository.save(new Checklist(null, ownerId));
            return ChecklistCreationResult.from(checklist);
        } catch (DataIntegrityViolationException exception) {
            throw duplicateChecklist(ownerId);
        }
    }

    @Transactional(readOnly = true)
    public boolean checkOwnership(Long ownerId, Long checklistId) {
        Checklist target = checklistRepository.findByOwnerId(ownerId);
        return (
                Objects.equals(
                        target.id(), checklistId
                )
        );
    }

    @Transactional(readOnly = true)
    public boolean checkItemOwnership(Long ownerId, Long checklistItemId) {
        ChecklistItem checklistItem = checklistItemRepository.findById(checklistItemId);

        return checkOwnership(ownerId, checklistItem.checklistId());
    }

    private BusinessException duplicateChecklist(Long ownerId) {
        return new BusinessException(
                ClientError.DUPLICATE_CHECKLIST,
                "체크리스트 중복 생성에 실패했습니다. ownerId=" + ownerId
        );
    }
}
