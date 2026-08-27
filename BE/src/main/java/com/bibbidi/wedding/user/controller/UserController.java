package com.bibbidi.wedding.user.controller;

import com.bibbidi.wedding.auth.session.Auth;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameRequest;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameResponse;
import com.bibbidi.wedding.user.controller.dto.NicknameAvailabilityResponse;
import com.bibbidi.wedding.user.service.NicknameAvailabilityResult;
import com.bibbidi.wedding.user.service.UserResult;
import com.bibbidi.wedding.user.service.UserService;
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

    @GetMapping("/nickname/availability")
    public NicknameAvailabilityResponse checkNicknameAvailability(
            @Valid @ModelAttribute ChangeNicknameRequest request
    ) {
        NicknameAvailabilityResult result = userService.checkNicknameAvailability(request.nickname());
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
}
