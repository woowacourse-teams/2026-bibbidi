package com.bibbidi.wedding.balancegame.repository;

import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion;
import com.bibbidi.wedding.balancegame.domain.BalanceGameQuestion.Choice;
import com.bibbidi.wedding.balancegame.repository.dto.ChoiceData;
import com.bibbidi.wedding.balancegame.repository.dto.QuestionData;
import com.bibbidi.wedding.balancegame.repository.dto.QuestionFile;
import jakarta.validation.Validator;
import java.io.IOException;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;

@Repository
public class BalanceGameQuestionRepository {

    private final List<BalanceGameQuestion> questions;

    public BalanceGameQuestionRepository(
            ObjectMapper mapper,
            Validator validator,
            @Value("classpath:balance-game/questions.json") Resource resource,
            @Value("${bibbidi.balance-game.image-base-url:}") String imageBaseUrl
    ) {
        QuestionFile file = readFile(mapper, resource);
        validateRequiredValues(file, validator, resource);
        validateDuplicates(file.questions());
        String baseUrl = prepareImageBaseUrl(file, imageBaseUrl);
        this.questions = file.questions().stream()
                .map(question -> question.toQuestion(baseUrl))
                .sorted(Comparator.comparingInt(BalanceGameQuestion::order))
                .toList();
    }

    public List<BalanceGameQuestion> findAll() {
        return questions;
    }

    public Optional<BalanceGameQuestion> findById(Long questionId) {
        return questions.stream()
                .filter(question -> question.id().equals(questionId))
                .findFirst();
    }

    public Optional<Choice> findOptionById(Long questionId, String optionId) {
        return findById(questionId).flatMap(question -> question.options().stream()
                .filter(option -> option.id().equals(optionId))
                .findFirst());
    }

    private static QuestionFile readFile(ObjectMapper mapper, Resource resource) {
        try {
            return mapper.readerFor(QuestionFile.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                            DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                    .without(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                    .readValue(resource.getContentAsByteArray());
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

    private static void validateDuplicates(List<QuestionData> questions) {
        Set<Long> questionIds = new HashSet<>();
        Set<Integer> orders = new HashSet<>();
        for (QuestionData question : questions) {
            if (!questionIds.add(question.id())) {
                throw new IllegalStateException("밸런스게임 문항 ID가 중복됩니다: id=" + question.id());
            }
            if (!orders.add(question.order())) {
                throw new IllegalStateException("밸런스게임 문항 노출 순서가 중복됩니다: order=" + question.order());
            }
            Set<String> optionIds = new HashSet<>();
            for (ChoiceData option : question.options()) {
                if (!optionIds.add(option.id())) {
                    throw new IllegalStateException("밸런스게임 선택지 ID가 중복됩니다: questionId="
                            + question.id() + ", optionId=" + option.id());
                }
            }
        }
    }

    private static String prepareImageBaseUrl(QuestionFile file, String imageBaseUrl) {
        boolean hasImage = file.questions().stream()
                .flatMap(question -> question.options().stream())
                .anyMatch(option -> option.imagePath() != null);
        if (hasImage && imageBaseUrl.isBlank()) {
            throw new IllegalStateException("밸런스게임 이미지가 있으면 bibbidi.balance-game.image-base-url 설정이 필요합니다");
        }
        return imageBaseUrl.endsWith("/") ? imageBaseUrl.substring(0, imageBaseUrl.length() - 1) : imageBaseUrl;
    }
}
