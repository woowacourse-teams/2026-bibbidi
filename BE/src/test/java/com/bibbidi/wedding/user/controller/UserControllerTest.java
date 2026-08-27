package com.bibbidi.wedding.user.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

import com.bibbidi.wedding.user.controller.dto.ChangeNicknameRequest;
import com.bibbidi.wedding.user.controller.dto.ChangeNicknameResponse;
import com.bibbidi.wedding.user.service.NicknameChangeResult;
import com.bibbidi.wedding.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    private UserController userController;

    @BeforeEach
    void setUp() {
        userController = new UserController(userService);
    }

    @Test
    @DisplayName("현재 사용자의 닉네임 변경 결과를 응답한다")
    void shouldChangeCurrentUserNickname() {
        given(userService.changeNickname(1L, "new-name"))
                .willReturn(new NicknameChangeResult(1L, "new-name"));

        ResponseEntity<ChangeNicknameResponse> response = userController.changeNickname(
                1L,
                new ChangeNicknameRequest("new-name")
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(new ChangeNicknameResponse(1L, "new-name"));
        then(userService).should().changeNickname(1L, "new-name");
    }
}
