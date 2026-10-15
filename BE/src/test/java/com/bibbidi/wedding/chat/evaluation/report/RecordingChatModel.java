package com.bibbidi.wedding.chat.evaluation.report;

import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;

public class RecordingChatModel implements ChatModel {

    private final ChatModel delegate;
    private final List<ModelCall> calls = new ArrayList<>();

    public RecordingChatModel(ChatModel delegate) {
        this.delegate = delegate;
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        ChatResponse response = delegate.call(prompt);
        calls.add(new ModelCall(prompt, response));
        return response;
    }

    @Override
    public ChatOptions getOptions() {
        return delegate.getOptions();
    }

    public List<ModelCall> calls() {
        return List.copyOf(calls);
    }

    public record ModelCall(Prompt prompt, ChatResponse response) {
    }
}
