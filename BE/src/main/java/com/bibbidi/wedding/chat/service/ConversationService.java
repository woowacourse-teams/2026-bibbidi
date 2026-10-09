package com.bibbidi.wedding.chat.service;

import com.bibbidi.wedding.chat.domain.ConversationState;
import com.bibbidi.wedding.chat.domain.OpeningDecision;
import com.bibbidi.wedding.chat.domain.OpeningFlowPolicy;
import com.bibbidi.wedding.chat.domain.PreparationSnapshot;
import com.bibbidi.wedding.chat.repository.ConversationStateRepository;
import com.bibbidi.wedding.chat.service.dto.ConversationStartResult;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

@Service
public class ConversationService {

    private final PreparationContextService preparationContextService;
    private final ConversationStateRepository stateRepository;
    private final OpeningFlowPolicy openingFlowPolicy;
    private final Clock clock;

    public ConversationService(
            PreparationContextService preparationContextService,
            ConversationStateRepository stateRepository,
            OpeningFlowPolicy openingFlowPolicy,
            @Qualifier("conversationClock") Clock clock
    ) {
        this.preparationContextService = preparationContextService;
        this.stateRepository = stateRepository;
        this.openingFlowPolicy = openingFlowPolicy;
        this.clock = clock;
    }

    public ConversationStartResult start(Long userId, @Nullable String initialMessage) {
        PreparationSnapshot snapshot = preparationContextService.load(userId);
        ConversationState state = stateRepository.create(userId, snapshot);
        OpeningDecision opening = openingFlowPolicy.classify(
                initialMessage,
                snapshot,
                state.confirmedAppointmentIds(),
                LocalDate.now(clock)
        );
        return new ConversationStartResult(state, opening);
    }

    public Optional<ConversationState> findOwnedBy(String conversationId, Long userId) {
        return stateRepository.findOwnedBy(conversationId, userId);
    }
}
