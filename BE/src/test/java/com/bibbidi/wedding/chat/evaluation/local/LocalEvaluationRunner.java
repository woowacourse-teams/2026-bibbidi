package com.bibbidi.wedding.chat.evaluation.local;

import com.bibbidi.wedding.chat.evaluation.BibbidiEvaluationRequest;
import com.bibbidi.wedding.chat.evaluation.BibbidiEvaluator;
import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import com.bibbidi.wedding.chat.evaluation.judge.BibbidiJudge;
import com.bibbidi.wedding.chat.evaluation.report.BibbidiEvaluationReportWriter;
import com.bibbidi.wedding.chat.evaluation.report.RecordingChatModel;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.document.Document;
import org.springframework.ai.evaluation.EvaluationResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class LocalEvaluationRunner {

    private final RecordingChatModel model;
    private final BibbidiJudge judge;
    private final BibbidiEvaluationReportWriter report;
    private final ObjectMapper mapper = new ObjectMapper();

    public LocalEvaluationRunner(ChatModel model, BibbidiJudge judge, BibbidiEvaluationReportWriter report) {
        this.model = new RecordingChatModel(model);
        this.judge = judge;
        this.report = report;
    }

    public void evaluate(LocalEvaluationInput input, EvaluationScenario scenario,
                         Map<String, MetricInformation> metrics) {
        model.reset();
        String answer = "";
        List<Long> recommendedItemIds = new ArrayList<>();
        List<Document> context = Stream.concat(Stream.of(input.systemPrompt()), input.providedContext().stream())
                .map(Document::new).toList();
        List<EvaluationResponse> evaluations = new ArrayList<>();
        String phase = "generation";
        String evaluatingMetric = null;
        try {
            JsonNode response = mapper.readTree(model.call(prompt(input, scenario)).getResult().getOutput().getText());
            if (!response.path("answer").isTextual() || response.path("answer").asText().isBlank()
                    || !response.path("recommendedItemIds").isArray()) {
                throw new IllegalStateException("Model response must contain answer and recommendedItemIds");
            }
            answer = response.path("answer").asText();
            for (JsonNode id : response.path("recommendedItemIds")) {
                if (!id.isIntegralNumber() || !id.canConvertToLong()) {
                    throw new IllegalStateException("recommendedItemIds must contain integers");
                }
                recommendedItemIds.add(id.asLong());
            }
            phase = "metricEvaluation";
            BibbidiEvaluationRequest request = new BibbidiEvaluationRequest(scenario, context, answer);
            for (String metricType : scenario.metrics()) {
                evaluatingMetric = metricType;
                evaluations.add(new BibbidiEvaluator(metrics.get(metricType), judge).evaluate(request));
                evaluatingMetric = null;
            }
        } catch (RuntimeException failure) {
            report.recordFailure(scenario, model.calls(), answer, recommendedItemIds,
                    context, evaluations, phase, evaluatingMetric, failure);
            throw failure;
        }
        report.record(scenario, model.calls(), answer, recommendedItemIds, context, evaluations);
    }

    private Prompt prompt(LocalEvaluationInput input, EvaluationScenario scenario) {
        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(input.systemPrompt()));
        if (!input.providedContext().isEmpty()) {
            messages.add(new SystemMessage(String.join("\n\n", input.providedContext())));
        }
        for (EvaluationScenario.ChatMessage message : scenario.chatMemory()) {
            messages.add(switch (message.role()) {
                case "user" -> new UserMessage(message.content());
                case "assistant" -> new AssistantMessage(message.content());
                default -> throw new IllegalArgumentException("Unknown chat memory role: " + message.role());
            });
        }
        messages.add(new UserMessage(scenario.userMessage()));
        return new Prompt(messages);
    }
}
