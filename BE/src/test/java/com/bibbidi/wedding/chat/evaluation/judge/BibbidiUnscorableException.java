package com.bibbidi.wedding.chat.evaluation.judge;

import com.bibbidi.wedding.chat.evaluation.data.result.JudgeInvocation;

public class BibbidiUnscorableException extends RuntimeException {

    private final JudgeInvocation invocation;

    public BibbidiUnscorableException(String reason, JudgeInvocation invocation) {
        super(reason);
        this.invocation = invocation;
    }

    public JudgeInvocation invocation() {
        return invocation;
    }
}
