package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final ChecklistService checklistService;

    public UserService(UserRepository userRepository, ChecklistService checklistService) {
        this.userRepository = userRepository;
        this.checklistService = checklistService;
    }

    @Transactional
    public UserResult createUser(String nickname, String passwordHash) {
        try {
            User user = new User(null, nickname, passwordHash);
            User savedUser = userRepository.save(user);

            return UserResult.from(savedUser);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(
                    ClientError.DUPLICATE_NICKNAME,
                    "이미 사용 중인 닉네임입니다. nickname=" + nickname
            );
        }
    }

    public NicknameAvailabilityResult checkNicknameAvailability(String nickname) {
        boolean isAvailableNickname = !userRepository.existsByNickname(nickname);
        return new NicknameAvailabilityResult(nickname, isAvailableNickname);
    }

    public UserAuthenticationInfo findAuthenticationInfo(String nickname) {
        User user = userRepository.findByNickname(nickname);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    public UserAuthenticationInfo findAuthenticationInfo(Long userId) {
        User user = userRepository.findById(userId);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    public UserAuthenticationInfo findCurrentUserAuthenticationInfo(Long currentUserId) {
        User user = findCurrentUser(currentUserId);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    @Transactional
    public void changePasswordHash(Long currentUserId, String passwordHash) {
        User user = findCurrentUser(currentUserId);
        User changedUser = user.changePasswordHash(passwordHash);
        userRepository.save(changedUser);
    }

    @Transactional
    public void delete(Long userId) {
        checklistService.deleteByOwnerId(userId);
        userRepository.deleteById(userId);
    }

    @Transactional
    public UserResult changeNickname(Long currentUserId, String nickname) {
        User user = findCurrentUser(currentUserId);

        if (user.nickname().equals(nickname)) {
            return UserResult.from(user);
        }

        try {
            User changedUser = user.changeNickname(nickname);
            User savedUser = userRepository.save(changedUser);
            return UserResult.from(savedUser);
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
