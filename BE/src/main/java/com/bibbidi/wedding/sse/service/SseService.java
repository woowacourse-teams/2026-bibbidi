package com.bibbidi.wedding.sse.service;

import com.bibbidi.wedding.sse.service.dto.SseEvent;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.FutureTask;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class SseService {

    private final ExecutorService workerExecutor;
    private final ScheduledExecutorService timeoutExecutor;

    public SseService(
            @Qualifier("sseVirtualThreadExecutor") ExecutorService workerExecutor,
            @Qualifier("sseTimeoutExecutor") ScheduledExecutorService timeoutExecutor
    ) {
        this.workerExecutor = workerExecutor;
        this.timeoutExecutor = timeoutExecutor;
    }

    public SseEmitter stream(Duration timeout, SseEvent failure, Consumer<SseConnection> work) {
        // 전체 제한 시간은 아래 타이머로 관리하며 Servlet의 별도 타이머는 사용하지 않는다.
        SseEmitter emitter = new SseEmitter(0L);
        long deadline = System.nanoTime() + timeout.toNanos();
        SseConnection connection = new SseConnection(emitter, failure, deadline);
        emitter.onCompletion(connection::disconnect);
        emitter.onError(ignored -> connection.disconnect());
        emitter.onTimeout(connection::disconnect);

        var task = new FutureTask<Void>(() -> {
            try {
                connection.checkActive();
                work.accept(connection);
                connection.complete();
            } catch (Exception exception) {
                connection.fail(exception);
            }
            return null;
        });
        connection.attachTask(task);
        try {
            long remaining = Math.max(0, deadline - System.nanoTime());
            connection.attachTimeout(timeoutExecutor.schedule(connection::timeout, remaining, TimeUnit.NANOSECONDS));
            workerExecutor.execute(task);
        } catch (RuntimeException exception) {
            connection.fail(exception);
        }
        return emitter;
    }
}
