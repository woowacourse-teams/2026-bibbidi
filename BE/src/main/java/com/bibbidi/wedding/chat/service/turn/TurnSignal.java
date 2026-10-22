package com.bibbidi.wedding.chat.service.turn;

import java.time.Duration;

/**
 * 한 턴의 모델 응답이 소비자에게 흘리는 신호. 모델 이름은 어댑터가 알려 준 값이고, 경과 시간은 모델 호출 시작부터 잰 값이라 구독 시점과 무관하다.
 */
public sealed interface TurnSignal {

    String model();

    Duration elapsed();

    record Chunk(String model, String text, Duration elapsed) implements TurnSignal {
    }

    record Completed(String model, Duration elapsed) implements TurnSignal {
    }

    record Failed(String model, Throwable cause, Duration elapsed) implements TurnSignal {
    }

    record Cancelled(String model, CancelReason reason, Duration elapsed) implements TurnSignal {
    }
}
