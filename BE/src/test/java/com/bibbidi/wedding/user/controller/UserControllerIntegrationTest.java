package com.bibbidi.wedding.user.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bibbidi.wedding.checklist.domain.Checklist;
import com.bibbidi.wedding.checklist.repository.ChecklistRepository;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import com.bibbidi.wedding.user.service.PasswordHasher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChecklistRepository checklistRepository;

    @Autowired
    private PasswordHasher passwordHasher;

    @Test
    void createsUserAndEmptyChecklistTogether() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "bibbidi",
                                  "password": "wish"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.nickname").value("bibbidi"))
                .andExpect(jsonPath("$.checklistId").isNumber())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull());

        User user = userRepository.findByNickname("bibbidi").orElseThrow();
        Checklist checklist = checklistRepository.findByOwnerId(user.id()).orElseThrow();

        assertThat(user.passwordHash()).isNotEqualTo("wish");
        assertThat(passwordHasher.matches("wish", user.passwordHash())).isTrue();
        assertThat(checklist.ownerId()).isEqualTo(user.id());
    }

    @Test
    void rejectsInvalidNicknameAndPassword() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "12345678901",
                                  "password": "123"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.id").value(102))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("요청 값이 올바르지 않습니다."))
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors.length()").value(2))
                .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("nickname", "password")))
                .andExpect(jsonPath("$.errors[*].message", containsInAnyOrder(
                        "닉네임은 10자 이하여야 합니다.",
                        "비밀번호는 4자 이상이어야 합니다."
                )))
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(jsonPath("$.instance").doesNotExist());
    }

    @Test
    void rejectsDuplicateNicknameIgnoringCase() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "BibbidiTwo",
                                  "password": "wish"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "bibbiditwo",
                                  "password": "wish"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.id").value(401))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("요청이 현재 리소스 상태와 충돌합니다."))
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(jsonPath("$.instance").doesNotExist())
                .andExpect(content().string(not(containsString("회원가입 실패: 닉네임 중복"))));
    }
}
