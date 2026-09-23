package com.bibbidi.wedding.common.domain;

/**
 * 회원 가입 완료 여부다. 약관에 동의하기 전에는 PENDING이다.
 * user가 가진 값이면서 auth가 토큰에 실어 나르므로 두 feature가 함께 쓰는 곳에 둔다.
 */
public enum UserStatus {
    PENDING,
    ACTIVE,
}
