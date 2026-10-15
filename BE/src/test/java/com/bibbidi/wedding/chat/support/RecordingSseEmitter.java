package com.bibbidi.wedding.chat.support;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 실제로 응답을 쓰지 않고, 전송한 이벤트와 완료 호출만 기록하는 가짜 {@link SseEmitter}.
 */
public class RecordingSseEmitter extends SseEmitter {

    public static final String SEND = "send";
    public static final String COMPLETE = "complete";

    private final List<String> log = new CopyOnWriteArrayList<>();
    private final List<List<Object>> sentData = new CopyOnWriteArrayList<>();
    private volatile RuntimeException sendFailure;
    private volatile IOException sendIoFailure;

    public RecordingSseEmitter failSendWith(RuntimeException failure) {
        this.sendFailure = failure;
        return this;
    }

    public RecordingSseEmitter failSendWith(IOException failure) {
        this.sendIoFailure = failure;
        return this;
    }

    @Override
    public void send(SseEventBuilder builder) throws IOException {
        if (sendIoFailure != null) {
            throw sendIoFailure;
        }
        if (sendFailure != null) {
            throw sendFailure;
        }
        log.add(SEND);
        List<Object> data = new ArrayList<>();
        builder.build().forEach(part -> data.add(part.getData()));
        sentData.add(data);
    }

    @Override
    public void complete() {
        log.add(COMPLETE);
    }

    /** 호출이 일어난 순서. 외부에서 기록을 덧붙일 수 있도록 같은 목록을 돌려준다. */
    public List<String> log() {
        return log;
    }

    public List<List<Object>> sentData() {
        return List.copyOf(sentData);
    }

    public int sendCount() {
        return sentData.size();
    }

    public int completeCount() {
        return (int) log.stream().filter(COMPLETE::equals).count();
    }
}
