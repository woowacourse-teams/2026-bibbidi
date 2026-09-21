package com.bibbidi.wedding.user.controller;

import com.bibbidi.wedding.common.auth.Auth;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameRequest;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameResponse;
import com.bibbidi.wedding.user.controller.dto.CurrentUserResponse;
import com.bibbidi.wedding.user.controller.dto.NicknameAvailabilityResponse;
import com.bibbidi.wedding.user.controller.dto.WeddingDateRequest;
import com.bibbidi.wedding.user.controller.dto.WeddingDateResponse;
import com.bibbidi.wedding.user.service.PasswordLoginIdAvailabilityResult;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
import com.bibbidi.wedding.user.service.WeddingDateResult;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public CurrentUserResponse findCurrentUser(@Auth Long currentUserId) {
        UserResult result = userService.findCurrentUserInfo(currentUserId);
        return CurrentUserResponse.from(result);
    }

    @GetMapping("/me/wedding-date")
    public WeddingDateResponse findWeddingDate(@Auth Long currentUserId) {
        WeddingDateResult result = userService.findWeddingDate(currentUserId);
        return WeddingDateResponse.from(result);
    }

    @GetMapping("/nickname/availability")
    public NicknameAvailabilityResponse checkNicknameAvailability(
            @Valid @ModelAttribute ChangeNicknameRequest request
    ) {
        PasswordLoginIdAvailabilityResult result =
                userService.checkPasswordLoginIdAvailability(request.nickname());
        return NicknameAvailabilityResponse.from(result);
    }

    @PutMapping("/me/nickname")
    public ChangeNicknameResponse changeNickname(
            @Auth Long currentUserId,
            @Valid @RequestBody ChangeNicknameRequest request
    ) {
        UserResult result = userService.changeNickname(currentUserId, request.nickname());
        return ChangeNicknameResponse.from(result);
    }

    @PutMapping("/me/wedding-date")
    public WeddingDateResponse updateWeddingDate(
            @Auth Long currentUserId,
            @Valid @RequestBody WeddingDateRequest request
    ) {
        WeddingDateResult result = userService.updateWeddingDate(currentUserId, request.weddingDate());
        return WeddingDateResponse.from(result);
    }
}

