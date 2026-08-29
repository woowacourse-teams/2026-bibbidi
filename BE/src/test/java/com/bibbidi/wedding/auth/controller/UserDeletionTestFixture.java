package com.bibbidi.wedding.auth.controller;

import com.bibbidi.wedding.appointment.persistence.JpaAppointmentEntity;
import com.bibbidi.wedding.appointment.persistence.JpaAppointmentRepository;
import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepEntity;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import com.bibbidi.wedding.checklist.domain.ChecklistItemStatus;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemEntity;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistItemRepository;
import com.bibbidi.wedding.checklist.persistence.JpaChecklistRepository;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import java.time.LocalDate;

class UserDeletionTestFixture {

    private final JpaUserRepository userRepository;
    private final JpaChecklistRepository checklistRepository;
    private final JpaChecklistItemRepository checklistItemRepository;
    private final JpaAppointmentRepository appointmentRepository;
    private final JpaCategoryRepository categoryRepository;
    private final JpaStepRepository stepRepository;
    private final JpaCatalogItemRepository catalogItemRepository;
    private final PasswordHasher passwordHasher;

    UserDeletionTestFixture(
            JpaUserRepository userRepository,
            JpaChecklistRepository checklistRepository,
            JpaChecklistItemRepository checklistItemRepository,
            JpaAppointmentRepository appointmentRepository,
            JpaCategoryRepository categoryRepository,
            JpaStepRepository stepRepository,
            JpaCatalogItemRepository catalogItemRepository,
            PasswordHasher passwordHasher
    ) {
        this.userRepository = userRepository;
        this.checklistRepository = checklistRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.appointmentRepository = appointmentRepository;
        this.categoryRepository = categoryRepository;
        this.stepRepository = stepRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.passwordHasher = passwordHasher;
    }

    Scenario create(String currentNickname, String otherNickname, String rawPassword) {
        CatalogData catalog = createCatalog();
        UserChecklistData currentUser = createUserWithChecklist(currentNickname, rawPassword);
        UserChecklistData otherUser = createUserWithChecklist(otherNickname, rawPassword);
        JpaChecklistItemEntity otherUsersItem = checklistItemRepository.saveAndFlush(
                new JpaChecklistItemEntity(
                        null,
                        otherUser.checklist(),
                        catalog.categoryId(),
                        catalog.catalogItemId(),
                        "계약서 확인",
                        ChecklistItemStatus.PREV
                )
        );
        Long otherUsersAppointmentId = createAppointment(otherUsersItem.id());

        return new Scenario(
                catalog,
                currentUser,
                new UserWeddingData(
                        otherUser.userId(),
                        otherUser.checklistId(),
                        otherUsersItem.id(),
                        otherUsersAppointmentId
                )
        );
    }

    Long createAppointment(Long checklistItemId) {
        return appointmentRepository.saveAndFlush(new JpaAppointmentEntity(
                null,
                checklistItemId,
                "웨딩홀 상담",
                LocalDate.of(2026, 9, 1),
                null,
                null,
                null,
                null,
                false
        )).id();
    }

    void clear() {
        appointmentRepository.deleteAllInBatch();
        checklistItemRepository.deleteAllInBatch();
        checklistRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();
        catalogItemRepository.deleteAllInBatch();
        stepRepository.deleteAllInBatch();
        categoryRepository.deleteAllInBatch();
    }

    private CatalogData createCatalog() {
        JpaCategoryEntity category = categoryRepository.saveAndFlush(
                new JpaCategoryEntity(null, "웨딩홀", 1)
        );
        JpaStepEntity step = stepRepository.saveAndFlush(
                new JpaStepEntity(null, category.id(), "웨딩홀 계약", "웨딩홀을 결정하고 계약한다.", 1)
        );
        JpaCatalogItemEntity catalogItem = catalogItemRepository.saveAndFlush(
                new JpaCatalogItemEntity(null, step.id(), "계약서 확인", 1, true)
        );

        return new CatalogData(category.id(), step.id(), catalogItem.id());
    }

    private UserChecklistData createUserWithChecklist(String nickname, String rawPassword) {
        JpaUserEntity user = userRepository.saveAndFlush(
                new JpaUserEntity(null, nickname, passwordHasher.hash(rawPassword))
        );
        JpaChecklistEntity checklist = checklistRepository.saveAndFlush(
                new JpaChecklistEntity(null, user.id())
        );

        return new UserChecklistData(user.id(), checklist);
    }

    record Scenario(
            CatalogData catalog,
            UserChecklistData currentUser,
            UserWeddingData otherUser
    ) {
    }

    record CatalogData(
            Long categoryId,
            Long stepId,
            Long catalogItemId
    ) {
    }

    record UserChecklistData(
            Long userId,
            JpaChecklistEntity checklist
    ) {

        Long checklistId() {
            return checklist.id();
        }
    }

    record UserWeddingData(
            Long userId,
            Long checklistId,
            Long checklistItemId,
            Long appointmentId
    ) {
    }
}
