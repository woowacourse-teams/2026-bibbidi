package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.util.NoSuchElementException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public UserResult createUser(String nickname, String passwordHash) {
        try {
            User user = userRepository.save(new User(null, nickname, passwordHash));
            return UserResult.from(user);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_NICKNAME,
                    "이미 사용 중인 닉네임입니다. nickname=" + nickname
            );
        }
    }

    public UserAuthenticationInfo findAuthenticationInfo(String nickname) {
        User user = userRepository.findByNickname(nickname);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    @Transactional
    public UserResult changeNickname(Long currentUserId, String nickname) {
        User user = findCurrentUser(currentUserId);

        if (user.nickname().equals(nickname)) {
            return UserResult.from(user);
        }

        try {
            userRepository.updateNickname(currentUserId, nickname);
            return new UserResult(currentUserId, nickname);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_NICKNAME,
                    "이미 사용 중인 닉네임입니다. nickname=" + nickname
            );
        }
    }

    private User findCurrentUser(Long currentUserId) {
        try {
            return userRepository.findById(currentUserId);
        } catch (NoSuchElementException exception) {
            throw new BusinessException(
                    ClientError.AUTHENTICATION_REQUIRED,
                    "Session 사용자 조회에 실패했습니다. userId=" + currentUserId
            );
        }
    }
}
