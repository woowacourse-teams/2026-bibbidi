package com.bibbidi.wedding.balancegame.repository;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestions;
import com.bibbidi.wedding.balancegame.repository.dto.QuestionData;
import com.bibbidi.wedding.balancegame.repository.dto.QuestionFile;
import jakarta.validation.Validator;
import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Repository
public class BalanceGameQuestionRepository {

    private final BalanceGameQuestions questions;

    public BalanceGameQuestionRepository(
            ObjectMapper mapper,
            Validator validator,
            @Value("classpath:balance-game/questions.json") Resource resource
    ) {
        QuestionFile file = readFile(mapper, resource);
        validateRequiredValues(file, validator, resource);
        this.questions = new BalanceGameQuestions(file.questions().stream()
                .map(QuestionData::toQuestion)
                .toList());
    }

    public List<BalanceGameQuestion> findAll() {
        return questions.values();
    }

    private static QuestionFile readFile(ObjectMapper mapper, Resource resource) {
        try {
            return mapper.readValue(resource.getContentAsByteArray(), QuestionFile.class);
        } catch (IOException | JacksonException e) {
            throw new IllegalStateException("밸런스게임 문항 파일을 읽을 수 없습니다: " + resource.getDescription(), e);
        }
    }

    private static void validateRequiredValues(QuestionFile file, Validator validator, Resource resource) {
        if (file == null) {
            throw new IllegalStateException("밸런스게임 문항 파일이 null입니다: " + resource.getDescription());
        }
        String violations = validator.validate(file).stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .sorted()
                .collect(Collectors.joining(", "));
        if (!violations.isEmpty()) {
            throw new IllegalStateException("밸런스게임 문항 파일의 필수 값이 올바르지 않습니다: "
                    + resource.getDescription() + " / " + violations);
        }
    }

}
