package com.bibbidi.wedding.chat.evaluation.data;

import com.bibbidi.wedding.chat.evaluation.data.prep.EvaluationScenario;
import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import tools.jackson.databind.ObjectMapper;

public class EvaluationDataLoader {

    private static final String BASE_PATH = "classpath*:ai-evaluation/";
    private static final String SCENARIOS_PATH = "scenarios/*.json";
    private static final String METRICS_PATH = "metrics/*.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final PathMatchingResourcePatternResolver resourceResolver = new PathMatchingResourcePatternResolver();

    public List<EvaluationScenario> loadScenarios() throws IOException {
        return load(SCENARIOS_PATH, EvaluationScenario.class);
    }

    public List<MetricInformation> loadMetrics() throws IOException {
        return load(METRICS_PATH, MetricInformation.class);
    }

    private <T> List<T> load(String pattern, Class<T> type) throws IOException {
        Resource[] resources = resourceResolver.getResources(BASE_PATH + pattern);
        if (resources.length == 0) {
            throw new IllegalStateException("No evaluation resources found: " + BASE_PATH + pattern);
        }
        Arrays.sort(resources, Comparator.comparing(Resource::getFilename));

        List<T> result = new ArrayList<>(resources.length);
        for (Resource resource : resources) {
            try (InputStream input = resource.getInputStream()) {
                result.add(objectMapper.readValue(input, type));
            }
        }
        return List.copyOf(result);
    }
}
