package com.bibbidi.wedding.common.domain;

/**
 * 회원이 무엇을 할 수 있는지다. 가입 상태와는 다른 축이다.
 * 가입 상태는 서비스를 쓸 준비가 됐는지를, 역할은 어디까지 손댈 수 있는지를 가른다.
 */
public enum UserRole {
    NORMAL,
    ADMIN,
}
