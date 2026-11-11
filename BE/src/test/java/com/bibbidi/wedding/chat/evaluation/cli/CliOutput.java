package com.bibbidi.wedding.chat.evaluation.cli;

import tools.jackson.databind.JsonNode;

public record CliOutput(String answer, JsonNode usage) {
}
