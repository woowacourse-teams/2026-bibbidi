package com.bibbidi.wedding.balancegame.repository;

import java.io.IOException;
import java.util.List;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;

@Component
class JsonContentReader {

    private final ResourceLoader resourceLoader;
    private final ObjectMapper mapper;

    JsonContentReader(ResourceLoader resourceLoader, ObjectMapper mapper) {
        this.resourceLoader = resourceLoader;
        this.mapper = mapper;
    }

    <T> List<T> readList(String location, Class<T> elementType) throws IOException {
        return mapper.readerForListOf(elementType)
                .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                        DeserializationFeature.FAIL_ON_MISSING_CREATOR_PROPERTIES,
                        DeserializationFeature.FAIL_ON_NULL_CREATOR_PROPERTIES)
                .with(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                .readValue(resourceLoader.getResource(location).getContentAsByteArray());
    }
}
