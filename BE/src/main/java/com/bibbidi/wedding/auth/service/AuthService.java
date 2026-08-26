package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.password.PasswordHasher;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserAuthenticationInfo;
import com.bibbidi.wedding.user.service.UserCreationResult;
import com.bibbidi.wedding.user.service.UserService;
import java.util.NoSuchElementException;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserService userService;
    private final PasswordHasher passwordHasher;

    public AuthService(UserService userService, PasswordHasher passwordHasher) {
        this.userService = userService;
        this.passwordHasher = passwordHasher;
    }

    public UserCreationResult register(String nickname, String rawPassword) {
        String passwordHash = passwordHasher.hash(rawPassword);
        return userService.createUser(nickname, passwordHash);
    }

    public AuthResult login(String nickname, String rawPassword) {
        UserAuthenticationInfo user;
        try {
            user = userService.findAuthenticationInfo(nickname);
        } catch (NoSuchElementException ignored) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "로그인 인증에 실패했습니다.");
        }

        if (!passwordHasher.matches(rawPassword, user.passwordHash())) {
            throw new BusinessException(ClientError.AUTHENTICATION_FAILED, "로그인 인증에 실패했습니다.");
        }

        return new AuthResult(user.userId(), user.nickname());
    }
}
