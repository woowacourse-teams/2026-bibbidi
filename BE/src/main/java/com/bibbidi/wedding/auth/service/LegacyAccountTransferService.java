package com.bibbidi.wedding.auth.service;

import com.bibbidi.wedding.auth.domain.ClientType;
import com.bibbidi.wedding.auth.repository.SocialIdentityRepository;
import com.bibbidi.wedding.auth.service.dto.IssuedSession;
import com.bibbidi.wedding.auth.service.dto.UserAuthInfo;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import com.bibbidi.wedding.user.service.dto.PasswordLoginInfo;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LegacyAccountTransferService {

    private final PasswordEncoder passwordEncoder = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    private final UserService userService;
    private final SocialIdentityRepository socialIdentityRepository;
    private final SessionIssueService sessionIssueService;

    public LegacyAccountTransferService(
            UserService userService,
            SocialIdentityRepository socialIdentityRepository,
            SessionIssueService sessionIssueService
    ) {
        this.userService = userService;
        this.socialIdentityRepository = socialIdentityRepository;
        this.sessionIssueService = sessionIssueService;
    }

    public IssuedSession transfer(Long currentUserId, String nickname, String password) {
        PasswordLoginInfo legacyAccount = userService.findPasswordLoginInfo(nickname)
                .filter(account -> passwordEncoder.matches(password, account.passwordHash()))
                .orElseThrow(() -> new BusinessException(
                        ClientError.AUTHENTICATION_FAILED,
                        "기존 회원의 닉네임이나 비밀번호가 맞지 않습니다. userId=" + currentUserId
                ));

        socialIdentityRepository.changeUserId(currentUserId, legacyAccount.userId());
        userService.removePassword(legacyAccount.userId());
        userService.delete(currentUserId);

        UserResult legacyUser = userService.findCurrentUserInfo(legacyAccount.userId());
        return sessionIssueService.issueForNewFamily(toUserAuthInfo(legacyUser), ClientType.WEB);
    }

    private static UserAuthInfo toUserAuthInfo(UserResult user) {
        return new UserAuthInfo(user.id(), user.status(), user.role(), user.nickname(), user.email());
    }
}
