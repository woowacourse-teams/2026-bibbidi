package com.bibbidi.wedding.checklist.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.checklist.service.dto.ChecklistCreationResult;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class ChecklistServiceTest {

    @Mock
    private ChecklistRepository checklistRepository;

    private ChecklistService checklistService;

    @BeforeEach
    void setUp() {
        checklistService = new ChecklistService(checklistRepository);
    }

    @Test
    @DisplayName("소유자 ID로 빈 체크리스트를 생성한다")
    void shouldCreateChecklistForOwner() {
        // given
        given(checklistRepository.existsByOwnerId(1L)).willReturn(false);
        given(checklistRepository.save(any(Checklist.class))).willReturn(new Checklist(10L, 1L));

        // when
        ChecklistCreationResult result = checklistService.create(1L);

        // then
        assertThat(result).isEqualTo(new ChecklistCreationResult(10L));
    }

    @Test
    @DisplayName("소유자의 체크리스트가 이미 존재하면 생성을 거절한다")
    void shouldRejectWhenChecklistAlreadyExists() {
        // given
        given(checklistRepository.existsByOwnerId(1L)).willReturn(true);

        // when, then
        assertThatThrownBy(() -> checklistService.create(1L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_CHECKLIST);
        then(checklistRepository).should(never()).save(any(Checklist.class));
    }

    @Test
    @DisplayName("동시 생성으로 UNIQUE 제약을 위반하면 중복 체크리스트 오류로 변환한다")
    void shouldConvertUniqueConstraintViolationToDuplicateChecklistError() {
        // given
        given(checklistRepository.existsByOwnerId(1L)).willReturn(false);
        willThrow(new DataIntegrityViolationException("duplicate owner"))
                .given(checklistRepository)
                .save(any(Checklist.class));

        // when, then
        assertThatThrownBy(() -> checklistService.create(1L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.DUPLICATE_CHECKLIST);
    }

    @Test
    @DisplayName("소유자의 체크리스트이면 소유권을 인정한다")
    void shouldConfirmOwnershipWhenChecklistBelongsToOwner() {
        // given
        given(checklistRepository.findByOwnerId(1L)).willReturn(new Checklist(10L, 1L));

        // when, then
        assertThat(checklistService.checkOwnership(1L, 10L)).isTrue();
    }

    @Test
    @DisplayName("다른 체크리스트이면 소유권을 인정하지 않는다")
    void shouldDenyOwnershipWhenChecklistIsNotOwners() {
        // given
        given(checklistRepository.findByOwnerId(1L)).willReturn(new Checklist(10L, 1L));

        // when, then
        assertThat(checklistService.checkOwnership(1L, 99L)).isFalse();
    }

    @Test
    @DisplayName("소유자의 체크리스트가 없으면 소유권 확인에 실패한다")
    void shouldFailOwnershipCheckWhenOwnerHasNoChecklist() {
        // given
        willThrow(new BusinessException(ClientError.CHECKLIST_NOT_FOUND, "not found"))
                .given(checklistRepository)
                .findByOwnerId(1L);

        // when, then
        assertThatThrownBy(() -> checklistService.checkOwnership(1L, 10L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CHECKLIST_NOT_FOUND);
    }
}
