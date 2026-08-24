package com.bibbidi.wedding.user.exception;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ProblemType;

public final class DuplicateNicknameException extends BusinessException {

    public DuplicateNicknameException() {
        super(ProblemType.CONFLICT, "닉네임 중복으로 회원가입에 실패했습니다..");
    }
}
