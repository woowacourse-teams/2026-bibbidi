package com.bibbidi.wedding.chat.support;

import com.bibbidi.wedding.chat.adapter.ai.AiChatStreamRecorder;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * 어댑터를 직접 만드는 테스트가 쓰는 대화 기록기. 지표는 메모리 레지스트리에만 쌓인다.
 */
public final class AiChatStreamRecorderFixture {

    public static final String MODEL = "test-model";

    private AiChatStreamRecorderFixture() {
    }

    public static AiChatStreamRecorder create() {
        return create(new SimpleMeterRegistry());
    }

    public static AiChatStreamRecorder create(MeterRegistry registry) {
        return new AiChatStreamRecorder(registry, MODEL);
    }
}
