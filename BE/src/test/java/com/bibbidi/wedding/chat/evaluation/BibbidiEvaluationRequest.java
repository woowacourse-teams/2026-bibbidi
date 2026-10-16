package com.bibbidi.wedding.chat.evaluation;

import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.ai.document.Document;
import org.springframework.ai.evaluation.EvaluationRequest;

public class BibbidiEvaluationRequest extends EvaluationRequest {

    private final EvaluationScenario scenario;

    public BibbidiEvaluationRequest(
            EvaluationScenario scenario,
            List<Document> providedContext,
            String responseContent
    ) {
        super(scenario.userMessage(), providedContext, responseContent);
        this.scenario = scenario;
    }

    public String scenarioName() {
        return scenario.name();
    }

    public String inputValue(String input) {
        return switch (input) {
            case "chatMemory" -> scenario.chatMemory().stream()
                    .map(message -> message.role() + ": " + message.content())
                    .collect(Collectors.joining("\n"));
            case "userMessage" -> getUserText();
            case "modelResponse" -> getResponseContent();
            case "providedContext" -> getDataList().stream()
                    .map(Document::getText)
                    .collect(Collectors.joining("\n"));
            case "referenceAnswer" -> scenario.referenceAnswer();
            case "expectedRefusal" -> scenario.expectedRefusal();
            default -> throw new IllegalArgumentException("Unknown evaluation input: " + input);
        };
    }
}
