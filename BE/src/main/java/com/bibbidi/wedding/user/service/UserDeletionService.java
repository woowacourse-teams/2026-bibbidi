package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.appointment.repository.AppointmentRepository;
import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.ChecklistItemRepository;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserDeletionService {

    private final UserRepository userRepository;
    private final ChecklistRepository checklistRepository;
    private final ChecklistItemRepository checklistItemRepository;
    private final AppointmentRepository appointmentRepository;
    private final PasswordHasher passwordHasher;

    public UserDeletionService(
            UserRepository userRepository,
            ChecklistRepository checklistRepository,
            ChecklistItemRepository checklistItemRepository,
            AppointmentRepository appointmentRepository,
            PasswordHasher passwordHasher
    ) {
        this.userRepository = userRepository;
        this.checklistRepository = checklistRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.appointmentRepository = appointmentRepository;
        this.passwordHasher = passwordHasher;
    }

    @Transactional
    public void delete(Long currentUserId, String rawPassword) {
        User user = userRepository.findById(currentUserId);
        verifyPassword(user, rawPassword);

        checklistRepository.findByOwnerId(currentUserId)
                .ifPresent(this::deleteChecklistData);

        userRepository.deleteById(currentUserId);
    }

    private void verifyPassword(User user, String rawPassword) {
        if (passwordHasher.matches(rawPassword, user.passwordHash())) {
            return;
        }
        throw new BusinessException(
                ClientError.AUTHENTICATION_FAILED,
                "회원 탈퇴 비밀번호 검증에 실패했습니다. userId=" + user.id()
        );
    }

    private void deleteChecklistData(Checklist checklist) {
        List<Long> checklistItemIds = checklistItemRepository.findIdsByChecklistId(checklist.id());
        if (!checklistItemIds.isEmpty()) {
            appointmentRepository.deleteAllByChecklistItemIds(checklistItemIds);
        }
        checklistItemRepository.deleteAllByChecklistId(checklist.id());
        checklistRepository.deleteById(checklist.id());
    }
}
