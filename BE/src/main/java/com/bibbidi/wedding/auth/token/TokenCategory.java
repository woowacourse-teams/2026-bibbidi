package com.bibbidi.wedding.auth.token;

/**
 * 서명한 토큰의 용도다.
 * 용도가 다른 토큰을 서로 바꿔 쓰지 못하도록 claim에 담아 검증할 때 확인한다.
 */
public enum TokenCategory {
    ACCESS,
    DELETE_GRANT,
}
