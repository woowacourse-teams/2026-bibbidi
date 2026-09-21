package com.bibbidi.wedding.auth.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.auth.controller.dto.CreateUserRequest;
import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import tools.jackson.databind.ObjectMapper;

class RegistrationControllerIntegrationTest extends BibbidiIntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("유효한 가입 요청이면 사용자를 생성한다")
    void shouldCreateUserWhenRequestIsValid() throws Exception {
        CreateUserRequest request = new CreateUserRequest("bibbidi", "wish");

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nickname").value("bibbidi"))
                .andExpect(jsonPath("$.checklistId").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull());
    }

    @Test
    @DisplayName("닉네임과 비밀번호가 유효하지 않으면 원문 비밀번호를 기록하지 않고 요청을 거절한다")
    void shouldRejectWithoutPasswordLeakWhenRequestIsInvalid() throws Exception {
        CreateUserRequest request = new CreateUserRequest("12345678901", "q!3");

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.errorCode").isNumber())
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors.length()").value(2))
                .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("nickname", "password")))
                .andExpect(jsonPath("$.errors[*].message", containsInAnyOrder(
                                        "닉네임은 10자 이하여야 합니다.",
                                        "비밀번호는 4자 이상 20자 이하여야 합니다."
                                )
                        )
                )
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(jsonPath("$.instance").doesNotExist());
    }

    @Test
    @DisplayName("닉네임이 비어 있거나 비밀번호가 20자를 초과하면 요청을 거절한다")
    void shouldRejectRequestWhenNicknameIsEmptyAndPasswordIsTooLong() throws Exception {
        CreateUserRequest request = new CreateUserRequest("", "123456789012345678901");

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.length()").value(2))
                .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("nickname", "password")))
                .andExpect(jsonPath("$.errors[*].message", containsInAnyOrder(
                                        "닉네임은 비어 있을 수 없습니다.",
                                        "비밀번호는 4자 이상 20자 이하여야 합니다."
                                )
                        )
                );
    }

    @Test
    @DisplayName("대소문자만 다른 닉네임이 이미 존재하면 가입을 거절한다")
    void shouldRejectWhenNicknameAlreadyExists() throws Exception {
        CreateUserRequest firstRequest = new CreateUserRequest("BibbidiTwo", "wish");
        CreateUserRequest duplicateRequest = new CreateUserRequest("bibbiditwo", "wish");

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(firstRequest)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateRequest)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value(401))
                .andExpect(jsonPath("$.errorCode").isNumber())
                .andExpect(jsonPath("$.message").value("이미 사용 중인 닉네임입니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(jsonPath("$.instance").doesNotExist())
                .andExpect(content().string(not(containsString("닉네임 중복으로 회원가입에 실패했습니다."))));
    }

    @Test
    @DisplayName("Spring MVC의 4xx 오류에도 공통 오류 응답 형식을 적용한다")
    void shouldUseCommonErrorResponseWhenHttpMethodIsNotSupported() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.errorCode").value(101))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.errors").doesNotExist());
    }
}
