package com.bibbidi.wedding.chat.evaluation.model;

import org.springframework.ai.chat.metadata.DefaultUsage;

record CliReply(String text, DefaultUsage usage) {
}
