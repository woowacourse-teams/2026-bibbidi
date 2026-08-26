package com.bibbidi.wedding.user.authentication;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import com.bibbidi.wedding.user.service.PasswordHasher;
import org.springframework.stereotype.Service;

@Service
public class UserAuthenticationService {

    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;

    public UserAuthenticationService(UserRepository userRepository, PasswordHasher passwordHasher) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
    }

    public AuthenticatedUser authenticate(String nickname, String rawPassword) {
        User user = userRepository.findByNickname(nickname);

        if (!passwordHasher.matches(rawPassword, user.passwordHash())) {
            throw authenticationFailed();
        }

        return new AuthenticatedUser(user.id(), user.nickname());
    }

    private static BusinessException authenticationFailed() {
        return new BusinessException(ClientError.AUTHENTICATION_FAILED, "로그인 인증에 실패했습니다.");
    }
}
