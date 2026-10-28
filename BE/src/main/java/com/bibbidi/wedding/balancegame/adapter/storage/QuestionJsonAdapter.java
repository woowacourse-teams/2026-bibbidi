package com.bibbidi.wedding.balancegame.adapter.storage;

import com.bibbidi.wedding.balancegame.domain.Question;
import com.bibbidi.wedding.balancegame.domain.Questions;
import com.bibbidi.wedding.balancegame.service.port.QuestionPort;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class QuestionJsonAdapter implements QuestionPort {

    private static final String LOCATION_NOT_SET_MESSAGE = "밸런스게임 문항 위치가 설정되지 않았습니다.";
    private static final String NOT_LOADED_MESSAGE = "밸런스게임 문항을 읽지 못해 응답할 수 없습니다. location=";
    private static final String LOAD_FAILURE_LOG = "밸런스게임 문항을 읽지 못했습니다. location={}";

    private final String location;
    private final @Nullable Questions questions;

    public QuestionJsonAdapter(
            JsonContentReader reader,
            @Value("${bibbidi.balance-game.questions-location}") String location
    ) {
        if (location.isBlank()) {
            throw new IllegalStateException(LOCATION_NOT_SET_MESSAGE);
        }
        this.location = location;
        this.questions = load(reader);
    }

    @Override
    public Questions findAll() {
        if (questions == null) {
            throw new BusinessException(ClientError.INTERNAL_ERROR, NOT_LOADED_MESSAGE + location);
        }

        return questions;
    }

    private @Nullable Questions load(JsonContentReader reader) {
        try {
            return new Questions(reader.readList(location, Question.class));
        } catch (IOException | RuntimeException exception) {
            log.error(LOAD_FAILURE_LOG, location, exception);
            return null;
        }
    }
}
