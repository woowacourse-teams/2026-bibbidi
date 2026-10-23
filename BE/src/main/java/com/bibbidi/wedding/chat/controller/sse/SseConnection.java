package com.bibbidi.wedding.chat.controller.sse;

import com.bibbidi.wedding.chat.controller.dto.resp.ChatResponse;
import com.bibbidi.wedding.chat.controller.sse.dto.SseEvent;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.concurrent.CancellationException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Slf4j
public final class SseConnection {

    private final SseEmitter emitter;
    private final long deadline;
    private @Nullable Future<?> task;
    private @Nullable Future<?> timeout;
    private boolean closed;
    private volatile boolean timedOut;

    SseConnection(SseEmitter emitter, long deadline) {
        this.emitter = emitter;
        this.deadline = deadline;
    }

    public synchronized void send(SseEvent event) {
        checkActive();
        sendEvent(event);
    }

    private void sendEvent(SseEvent event) {
        try {
            emitter.send(SseEmitter.event()
                    .name(event.type().value())
                    .data(event.data(), MediaType.APPLICATION_JSON));
        } catch (IOException exception) {
            disconnect();
            throw new UncheckedIOException(exception);
        } catch (IllegalStateException exception) {
            disconnect();
            throw exception;
        }
    }

    public synchronized void complete(SseEvent lastEvent, Runnable onComplete) {
        checkActive();
        sendEvent(lastEvent);
        try {
            onComplete.run();
        } catch (RuntimeException exception) {
            log.error("SSE 완료 후 처리 실패", exception);
        } finally {
            complete();
        }
    }

    synchronized void complete() {
        if (!closed) {
            close(false);
            emitter.complete();
        }
    }

    synchronized void checkActive() {
        if (closed || Thread.currentThread().isInterrupted() || System.nanoTime() >= deadline) {
            throw new CancellationException("SSE 응답 처리가 종료되었습니다.");
        }
    }

    synchronized void attachTask(Future<?> task) {
        this.task = task;
        if (closed) {
            task.cancel(true);
        }
    }

    synchronized void attachTimeout(Future<?> timeout) {
        this.timeout = timeout;
        if (closed) {
            timeout.cancel(false);
        }
    }

    synchronized void timeout() {
        if (!closed) {
            timedOut = true;
        }
        fail(new TimeoutException("SSE 전체 응답 시간 초과"), true);
    }

    synchronized void fail(Exception exception) {
        fail(exception, false);
    }

    private void fail(Exception exception, boolean interrupt) {
        if (!closed) {
            ClientError clientError = ClientError.INTERNAL_ERROR;
            if (exception instanceof BusinessException businessException) {
                clientError = businessException.clientError();
                log.warn("SSE 응답 처리 실패. errorCode={} message={}",
                        clientError.errorCode(), exception.getMessage());
            } else {
                log.error("SSE 응답 처리 실패. type={}", exception.getClass().getSimpleName(), exception);
            }
            close(interrupt);
            try {
                emitter.send(SseEmitter.event()
                        .name(ChatEventType.FAILURE.value())
                        .data(new ChatResponse.Failure(clientError.errorCode(), clientError.message()),
                                MediaType.APPLICATION_JSON));
            } catch (IOException | IllegalStateException ignored) {
                // 이미 끊긴 연결에는 실패 이벤트를 다시 전송하지 않는다.
            } finally {
                emitter.complete();
            }
        }
    }

    public boolean timedOut() {
        return timedOut;
    }

    synchronized void disconnect() {
        if (!closed) {
            close(true);
        }
    }

    private void close(boolean interrupt) {
        closed = true;
        if (timeout != null) {
            timeout.cancel(false);
        }
        if (interrupt && task != null) {
            task.cancel(true);
        }
    }
}
