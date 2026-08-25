package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import com.bibbidi.wedding.user.service.PasswordHasher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;

    public AuthService(UserRepository userRepository, PasswordHasher passwordHasher) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
    }

    @Transactional(readOnly = true)
    public AuthResult login(String nickname, String rawPassword) {
        User user = userRepository.findByNickname(nickname)
                .orElseThrow(AuthService::loginFailed);

        if (!passwordHasher.matches(rawPassword, user.passwordHash())) {
            throw loginFailed();
        }

        return new AuthResult(user.id(), user.nickname());
    }

    private static BusinessException loginFailed() {
        return new BusinessException(ClientError.AUTHENTICATION_FAILED, "로그인 인증에 실패했습니다.");
    }
}
