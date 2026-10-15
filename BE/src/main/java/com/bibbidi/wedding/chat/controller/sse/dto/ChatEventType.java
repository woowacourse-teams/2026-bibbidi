package com.bibbidi.wedding.chat.controller.sse.dto;

public enum ChatEventType {
    CONVERSATION("conversation"),
    DELTA("delta"),
    COMPONENT("component"),
    DONE("done"),
    FAILURE("failure");

    private final String value;

    ChatEventType(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }
}
