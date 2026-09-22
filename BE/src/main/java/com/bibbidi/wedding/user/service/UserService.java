package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.domain.WeddingDate;
import com.bibbidi.wedding.user.repository.UserRepository;
import java.time.LocalDate;
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
        User user = new User(null, nickname, passwordHash);
        User savedUser = userRepository.create(user);

        return UserResult.from(savedUser);
    }

    public NicknameAvailabilityResult checkNicknameAvailability(String nickname) {
        boolean isAvailableNickname = !userRepository.existsPasswordLoginUserByNickname(nickname);
        return new NicknameAvailabilityResult(nickname, isAvailableNickname);
    }

    public UserAuthenticationInfo findAuthenticationInfo(String nickname) {
        User user = userRepository.findPasswordLoginUserByNickname(nickname);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    public UserAuthenticationInfo findAuthenticationInfo(Long userId) {
        User user = userRepository.findById(userId);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    public UserAuthenticationInfo findCurrentUserAuthenticationInfo(Long currentUserId) {
        User user = userRepository.findById(currentUserId);
        return new UserAuthenticationInfo(user.id(), user.nickname(), user.passwordHash());
    }

    public UserResult findCurrentUserInfo(Long currentUserId) {
        User user = userRepository.findById(currentUserId);
        return UserResult.from(user);
    }

    public WeddingDateResult findWeddingDate(Long currentUserId) {
        WeddingDate weddingDate = userRepository.findWeddingDateByUserId(currentUserId);
        return WeddingDateResult.from(weddingDate);
    }

    @Transactional
    public WeddingDateResult updateWeddingDate(Long currentUserId, LocalDate weddingDate) {
        WeddingDate currentWeddingDate = userRepository.findWeddingDateByUserId(currentUserId);
        WeddingDate changedWeddingDate = currentWeddingDate.changeDate(weddingDate);
        WeddingDate savedWeddingDate = userRepository.saveWeddingDate(changedWeddingDate);
        return WeddingDateResult.from(savedWeddingDate);
    }

    @Transactional
    public void changePasswordHash(Long currentUserId, String passwordHash) {
        User user = userRepository.findById(currentUserId);
        User changedUser = user.changePasswordHash(passwordHash);
        userRepository.update(changedUser);
    }

    @Transactional
    public void delete(Long userId) {
        checklistService.deleteByOwnerId(userId);
        userRepository.deleteById(userId);
    }

    @Transactional
    public UserResult changeNickname(Long currentUserId, String nickname) {
        User user = userRepository.findById(currentUserId);

        if (user.nickname().equals(nickname)) {
            return UserResult.from(user);
        }

        User changedUser = user.changeNickname(nickname);
        User savedUser = userRepository.update(changedUser);
        return UserResult.from(savedUser);
    }
}
