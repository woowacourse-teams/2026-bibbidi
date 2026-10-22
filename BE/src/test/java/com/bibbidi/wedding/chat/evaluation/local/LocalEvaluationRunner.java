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
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
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
        List<Document> context = createEvaluationContext(input);
        GeneratedAnswer answer = generateAnswer(input, scenario, context);
        List<EvaluationResponse> evaluations = evaluateMetrics(scenario, context, answer, metrics);

        report.record(scenario, model.calls(), answer.text(), answer.recommendedItemIds(), context, evaluations);
    }

    private GeneratedAnswer generateAnswer(LocalEvaluationInput input, EvaluationScenario scenario,
                                          List<Document> context) {
        String answerText = "";
        List<Long> recommendedItemIds = new ArrayList<>();
        try {
            Prompt prompt = createPrompt(input, scenario);
            JsonNode response = readModelResponse(prompt);
            validateResponse(response);
            answerText = response.path("answer").asText();
            readRecommendedItemIds(response.path("recommendedItemIds"), recommendedItemIds);
        } catch (RuntimeException failure) {
            report.recordFailure(scenario, model.calls(), answerText, recommendedItemIds,
                    context, List.of(), "generation", null, failure);
            throw failure;
        }
        return new GeneratedAnswer(answerText, recommendedItemIds);
    }

    private List<EvaluationResponse> evaluateMetrics(EvaluationScenario scenario, List<Document> context,
                                                     GeneratedAnswer answer, Map<String, MetricInformation> metrics) {
        BibbidiEvaluationRequest request = new BibbidiEvaluationRequest(scenario, context, answer.text());
        List<EvaluationResponse> evaluations = new ArrayList<>();
        for (String metricType : scenario.metrics()) {
            try {
                MetricInformation metric = metrics.get(metricType);
                BibbidiEvaluator evaluator = new BibbidiEvaluator(metric, judge);
                EvaluationResponse evaluation = evaluator.evaluate(request);
                evaluations.add(evaluation);
            } catch (RuntimeException failure) {
                report.recordFailure(scenario, model.calls(), answer.text(), answer.recommendedItemIds(),
                        context, evaluations, "metricEvaluation", metricType, failure);
                throw failure;
            }
        }
        return evaluations;
    }

    private JsonNode readModelResponse(Prompt prompt) {
        ChatResponse response = model.call(prompt);
        String responseJson = response.getResult().getOutput().getText();
        return mapper.readTree(responseJson);
    }

    private void validateResponse(JsonNode response) {
        JsonNode answer = response.path("answer");
        JsonNode recommendedItemIds = response.path("recommendedItemIds");
        if (!answer.isTextual() || answer.asText().isBlank() || !recommendedItemIds.isArray()) {
            throw new IllegalStateException("Model response must contain answer and recommendedItemIds");
        }
    }

    private void readRecommendedItemIds(JsonNode values, List<Long> recommendedItemIds) {
        for (JsonNode id : values) {
            if (!id.isIntegralNumber() || !id.canConvertToLong()) {
                throw new IllegalStateException("recommendedItemIds must contain integers");
            }
            recommendedItemIds.add(id.asLong());
        }
    }

    private List<Document> createEvaluationContext(LocalEvaluationInput input) {
        List<Document> context = new ArrayList<>();
        context.add(new Document(input.systemPrompt()));
        for (String information : input.providedContext()) {
            context.add(new Document(information));
        }
        return List.copyOf(context);
    }

    private Prompt createPrompt(LocalEvaluationInput input, EvaluationScenario scenario) {
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

    private record GeneratedAnswer(String text, List<Long> recommendedItemIds) {
    }
}
