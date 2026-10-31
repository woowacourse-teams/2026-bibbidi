package com.bibbidi.wedding.chat.adapter.ai.config;

import com.bibbidi.wedding.chat.adapter.ai.observation.CacheTokenMeterObservationHandler;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiObservationConfig {

    // Spring AI 기본 핸들러(ChatModelMeterObservationHandler)를 대체한다.
    @Bean
    CacheTokenMeterObservationHandler chatModelMeterObservationHandler(ObjectProvider<MeterRegistry> meterRegistry) {
        return new CacheTokenMeterObservationHandler(meterRegistry.getIfAvailable(SimpleMeterRegistry::new));
    }
}
