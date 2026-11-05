package com.bibbidi.wedding.chat.evaluation.judge;

import com.bibbidi.wedding.chat.evaluation.data.prep.MetricInformation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.evaluation.EvaluationResponse;

@FunctionalInterface
public interface BibbidiJudge {

    EvaluationResponse evaluate(Prompt prompt, MetricInformation metric, String scenarioName);
}
