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

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public UserCreationResult createUser(String nickname, String passwordHash) {
        if (userRepository.existsByNickname(nickname)) {
            throw new BusinessException(ClientError.DUPLICATE_NICKNAME, "닉네임 중복으로 회원가입에 실패했습니다.");
        }

        User user = userRepository.save(User.create(nickname, passwordHash));

        return new UserCreationResult(user.id(), user.nickname());
    }

    public UserAuthenticationInfo findAuthenticationInfo(String nickname) {
        User user = userRepository.findByNickname(nickname);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    @Transactional(readOnly = true)
    public UserAuthenticationInfo findCurrentUserAuthenticationInfo(Long currentUserId) {
        User user = findCurrentUser(currentUserId);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    @Transactional
    public void updatePasswordHash(Long currentUserId, String passwordHash) {
        userRepository.updatePasswordHash(currentUserId, passwordHash);
    }

    @Transactional
    public NicknameChangeResult changeNickname(Long currentUserId, String nickname) {
        User user = findCurrentUser(currentUserId);

        if (user.nickname().equals(nickname)) {
            return NicknameChangeResult.from(user);
        }

        if (userRepository.existsByNicknameExcludingUser(nickname, currentUserId)) {
            throw new BusinessException(
                    ClientError.DUPLICATE_NICKNAME,
                    "닉네임 중복으로 변경에 실패했습니다. userId=" + currentUserId
            );
        }

        userRepository.updateNickname(currentUserId, nickname);
        return new NicknameChangeResult(currentUserId, nickname);
    }

    private User findCurrentUser(Long currentUserId) {
        try {
            return userRepository.findById(currentUserId);
        } catch (BusinessException exception) {
            if (exception.clientError() != ClientError.USER_NOT_FOUND) {
                throw exception;
            }
            throw authenticationRequired(currentUserId);
        }
    }

    private BusinessException authenticationRequired(Long currentUserId) {
        return new BusinessException(
                ClientError.AUTHENTICATION_REQUIRED,
                "Session 사용자 조회에 실패했습니다. userId=" + currentUserId
        );
    }
}
