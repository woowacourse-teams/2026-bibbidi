package com.bibbidi.wedding.user.service;

import com.bibbidi.wedding.checklist.service.ChecklistService;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.domain.WeddingDate;
import com.bibbidi.wedding.user.repository.UserRepository;
import com.bibbidi.wedding.user.service.dto.PasswordLoginInfo;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
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
    public UserResult createPendingUser(String nickname, String email) {
        User savedUser = userRepository.create(User.pending(nickname, email));
        return UserResult.from(savedUser);
    }

    @Transactional
    public UserResult activate(Long currentUserId) {
        User user = userRepository.findById(currentUserId);
        if (user.isActive()) {
            return UserResult.from(user);
        }
        return UserResult.from(userRepository.update(user.activate()));
    }

    @Transactional
    public UserResult agreeToTerms(Long currentUserId, String termsVersion) {
        User user = userRepository.findById(currentUserId);
        return UserResult.from(userRepository.update(
                user.agreeToTerms(termsVersion, LocalDateTime.now())));
    }

    public NicknameAvailabilityResult checkNicknameAvailability(String nickname) {
        boolean isAvailableNickname = !userRepository.existsByNickname(nickname);
        return new NicknameAvailabilityResult(nickname, isAvailableNickname);
    }

    public UserResult findCurrentUserInfo(Long currentUserId) {
        User user = userRepository.findById(currentUserId);
        return UserResult.from(user);
    }

    public Optional<PasswordLoginInfo> findPasswordLoginInfo(String nickname) {
        return userRepository.findPasswordLoginInfo(nickname);
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
    public void removePassword(Long userId) {
        userRepository.removePasswordHash(userId);
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
