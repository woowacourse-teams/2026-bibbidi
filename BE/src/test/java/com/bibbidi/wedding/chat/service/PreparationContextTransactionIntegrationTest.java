package com.bibbidi.wedding.chat.service;

import static com.bibbidi.wedding.chat.ChatTestFixtures.OWNER_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

import com.bibbidi.wedding.catalog.service.CatalogService;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
import com.bibbidi.wedding.chat.repository.ConversationStateRepository;
import com.bibbidi.wedding.chat.service.dto.ConversationStartResult;
import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.checklist.service.dto.ChecklistWithAppointmentsResult;
import com.bibbidi.wedding.user.service.UserService;
import com.bibbidi.wedding.user.service.WeddingDateResult;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@SpringBootTest
@ActiveProfiles("test")
class PreparationContextTransactionIntegrationTest {

    @Autowired
    private ConversationService conversationService;

    @MockitoBean
    private ChecklistService checklistService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private CatalogService catalogService;

    @MockitoSpyBean
    private ConversationStateRepository stateRepository;

    @Test
    @DisplayName("기존 조회는 읽기 전용 트랜잭션 안에서 실행하고 대화 보관 전에 닫는다")
    void shouldCloseReadOnlyTransactionBeforeStoringConversation() {
        when(userService.findWeddingDate(OWNER_ID)).thenAnswer(invocation -> {
            assertReadOnlyTransaction();
            return new WeddingDateResult(null);
        });
        when(checklistService.findMyChecklist(OWNER_ID)).thenAnswer(invocation -> {
            assertReadOnlyTransaction();
            return new ChecklistWithAppointmentsResult(1L, List.of());
        });
        when(catalogService.findAllItemDetails()).thenAnswer(invocation -> {
            assertReadOnlyTransaction();
            return List.of();
        });
        doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return invocation.callRealMethod();
        }).when(stateRepository).create(eq(OWNER_ID), any(PreparationSnapshot.class));

        ConversationStartResult started = conversationService.start(OWNER_ID, null);

        assertThat(started.state().ownerId()).isEqualTo(OWNER_ID);
        assertThat(conversationService.findOwnedBy(started.state().id(), OWNER_ID)).contains(started.state());
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
    }

    private void assertReadOnlyTransaction() {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
        assertThat(TransactionSynchronizationManager.isCurrentTransactionReadOnly()).isTrue();
    }
}
