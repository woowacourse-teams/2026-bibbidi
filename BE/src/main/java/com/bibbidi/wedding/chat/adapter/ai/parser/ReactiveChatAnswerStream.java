package com.bibbidi.wedding.chat.adapter.ai.parser;

import com.bibbidi.wedding.chat.service.dto.ChatAnswer;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import tools.jackson.databind.ObjectMapper;

public final class ReactiveChatAnswerStream {

    private static final Pattern ANSWER_FIELD = Pattern.compile("\"answer\"\\s*:\\s*\"");

    private final ObjectMapper mapper;
    private final AnswerDeltaWriter answerWriter;
    private final StringBuilder json = new StringBuilder();
    private int position;
    private boolean answerStarted;
    private boolean answerEnded;
    private boolean escaped;
    private int unicodeDigits;
    private int unicodeValue;

    public ReactiveChatAnswerStream(ObjectMapper mapper, Consumer<String> sendAnswerChunk) {
        this.mapper = mapper;
        this.answerWriter = new AnswerDeltaWriter(sendAnswerChunk);
    }

    public void accept(String chunk) {
        json.append(chunk);
        if (!answerStarted) {
            Matcher matcher = ANSWER_FIELD.matcher(json);
            if (!matcher.find()) {
                return;
            }
            answerStarted = true;
            position = matcher.end();
        }
        if (answerEnded) {
            return;
        }

        StringBuilder decoded = new StringBuilder();
        while (position < json.length() && !answerEnded) {
            char next = json.charAt(position++);
            if (unicodeDigits > 0) {
                int digit = Character.digit(next, 16);
                if (digit < 0) {
                    break;
                }
                unicodeValue = (unicodeValue << 4) | digit;
                if (--unicodeDigits == 0) {
                    decoded.append((char) unicodeValue);
                }
            } else if (escaped) {
                escaped = false;
                switch (next) {
                    case '"' -> decoded.append('"');
                    case '\\' -> decoded.append('\\');
                    case '/' -> decoded.append('/');
                    case 'b' -> decoded.append('\b');
                    case 'f' -> decoded.append('\f');
                    case 'n' -> decoded.append('\n');
                    case 'r' -> decoded.append('\r');
                    case 't' -> decoded.append('\t');
                    case 'u' -> {
                        unicodeDigits = 4;
                        unicodeValue = 0;
                    }
                    default -> {
                        return;
                    }
                }
            } else if (next == '\\') {
                escaped = true;
            } else if (next == '"') {
                answerEnded = true;
            } else {
                decoded.append(next);
            }
        }
        if (!decoded.isEmpty()) {
            char[] text = new char[decoded.length()];
            decoded.getChars(0, decoded.length(), text, 0);
            answerWriter.write(text, 0, text.length);
        }
    }

    public ChatAnswer finish() {
        ChatAnswer answer = new ChatAnswerStream(mapper).read(Stream.of(json.toString()), ignored -> {
        });
        if (!answer.answer().equals(answerWriter.text()) || answerWriter.hasPendingText()) {
            throw new IllegalStateException("스트리밍 답변과 검증된 응답이 일치하지 않습니다.");
        }
        return answer;
    }
}
