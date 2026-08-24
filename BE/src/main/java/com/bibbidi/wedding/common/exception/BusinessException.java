package com.bibbidi.wedding.common.exception;

public abstract class BusinessException extends RuntimeException {

    private final ProblemType problemType;

    protected BusinessException(ProblemType problemType, String logMessage) {
        super(logMessage);
        this.problemType = problemType;
    }

    public ProblemType problemType() {
        return problemType;
    }
}
