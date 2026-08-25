package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;

    public UserService(UserRepository userRepository, PasswordHasher passwordHasher) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
    }

    @Transactional
    public UserCreationResult createUser(String nickname, String rawPassword) {
        if (userRepository.existsByNickname(nickname)) {
            throw new BusinessException(
                    ClientError.DUPLICATE_NICKNAME,
                    "닉네임 중복으로 회원가입에 실패했습니다."
            );
        }

        String passwordHash = passwordHasher.hash(rawPassword);
        User user = userRepository.save(User.create(nickname, passwordHash));

        return new UserCreationResult(user.id(), user.nickname());
    }
}
