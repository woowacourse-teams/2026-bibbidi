package com.bibbidi.wedding.common.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void logsExpectedClientErrorAtWarnWithInternalMessage(CapturedOutput output) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/users");

        ResponseEntity<ErrorResponse> response = handler.handleBusinessException(
                new TestConflictException(),
                new ServletWebRequest(request)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isEqualTo(ErrorResponse.from(ProblemType.CONFLICT));
        assertThat(output)
                .contains("WARN")
                .contains("errorId=401")
                .contains("method=POST")
                .contains("uri=/api/users")
                .contains("status=409")
                .contains("message=테스트 충돌 발생");
    }

    @Test
    void logsUnexpectedServerErrorAtErrorWithCause(CapturedOutput output) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/users");

        ResponseEntity<ErrorResponse> response = handler.handleUnexpected(
                new IllegalStateException("unexpected-marker"),
                new ServletWebRequest(request)
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isEqualTo(ErrorResponse.from(ProblemType.INTERNAL_ERROR));
        assertThat(output)
                .contains("ERROR")
                .contains("errorId=901")
                .contains("status=500")
                .contains("message=unexpected-marker")
                .contains("java.lang.IllegalStateException: unexpected-marker");
    }

    private static final class TestConflictException extends BusinessException {

        private TestConflictException() {
            super(ProblemType.CONFLICT, "테스트 충돌 발생");
        }
    }
}
