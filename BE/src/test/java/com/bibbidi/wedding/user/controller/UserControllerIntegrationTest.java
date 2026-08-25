package com.bibbidi.wedding.user.controller;

import static com.epages.restdocs.apispec.MockMvcRestDocumentationWrapper.document;
import static com.epages.restdocs.apispec.ResourceDocumentation.resource;
import static com.epages.restdocs.apispec.Schema.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.restdocs.payload.PayloadDocumentation.fieldWithPath;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.repository.UserRepository;
import com.bibbidi.wedding.user.service.PasswordHasher;
import com.epages.restdocs.apispec.ResourceSnippetParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.MediaType;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@ExtendWith({OutputCaptureExtension.class, RestDocumentationExtension.class})
class UserControllerIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordHasher passwordHasher;

    @BeforeEach
    void setUp(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
    }

    @Test
    @DisplayName("유효한 가입 요청이면 사용자를 생성한다")
    void shouldCreateUserWhenRequestIsValid() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "bibbidi",
                                  "password": "wish"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nickname").value("bibbidi"))
                .andExpect(jsonPath("$.checklistId").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(result -> assertThat(result.getRequest().getSession(false)).isNull())
                .andDo(document(
                        "users-create",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("회원가입")
                                .description("닉네임과 비밀번호로 사용자를 생성합니다.")
                                .requestSchema(schema("CreateUserRequest"))
                                .responseSchema(schema("CreateUserResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("로그인에 사용할 닉네임"),
                                        fieldWithPath("password").description("사용자 비밀번호")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("생성된 사용자 ID"),
                                        fieldWithPath("nickname").description("사용자 닉네임")
                                )
                                .build())
                ));

        User user = userRepository.findByNickname("bibbidi").orElseThrow();

        assertThat(user.passwordHash()).isNotEqualTo("wish");
        assertThat(passwordHasher.matches("wish", user.passwordHash())).isTrue();
    }

    @Test
    @DisplayName("닉네임과 비밀번호가 유효하지 않으면 원문 비밀번호를 기록하지 않고 요청을 거절한다")
    void shouldRejectWithoutPasswordLeakWhenRequestIsInvalid(
            CapturedOutput output
    ) throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "12345678901",
                                  "password": "q!3"
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
                        "비밀번호는 4자 이상 20자 이하여야 합니다."
                )))
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(jsonPath("$.instance").doesNotExist())
                .andDo(document(
                        "users-create-invalid-request",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("회원가입")
                                .description("닉네임과 비밀번호로 사용자를 생성합니다.")
                                .requestSchema(schema("CreateUserRequest"))
                                .responseSchema(schema("ValidationErrorResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("로그인에 사용할 닉네임"),
                                        fieldWithPath("password").description("사용자 비밀번호")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("오류 식별자"),
                                        fieldWithPath("status").description("HTTP 상태 코드"),
                                        fieldWithPath("message").description("오류 메시지"),
                                        fieldWithPath("errors").description("요청 필드별 검증 오류 목록"),
                                        fieldWithPath("errors[].field").description("검증에 실패한 요청 필드"),
                                        fieldWithPath("errors[].message").description("필드 검증 오류 메시지")
                                )
                                .build())
                ));

        assertThat(output)
                .contains("WARN")
                .contains("errorId=102")
                .contains("status=400")
                .doesNotContain("q!3");
    }

    @Test
    @DisplayName("닉네임이 비어 있거나 비밀번호가 20자를 초과하면 요청을 거절한다")
    void shouldRejectRequestWhenNicknameIsEmptyAndPasswordIsTooLong() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "",
                                  "password": "123456789012345678901"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.length()").value(2))
                .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("nickname", "password")))
                .andExpect(jsonPath("$.errors[*].message", containsInAnyOrder(
                        "닉네임은 비어 있을 수 없습니다.",
                        "비밀번호는 4자 이상 20자 이하여야 합니다."
                )))
                .andDo(document(
                        "users-create-empty-nickname-and-too-long-password",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("회원가입")
                                .description("닉네임과 비밀번호로 사용자를 생성합니다.")
                                .requestSchema(schema("CreateUserRequest"))
                                .responseSchema(schema("ValidationErrorResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("로그인에 사용할 닉네임"),
                                        fieldWithPath("password").description("사용자 비밀번호")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("오류 식별자"),
                                        fieldWithPath("status").description("HTTP 상태 코드"),
                                        fieldWithPath("message").description("오류 메시지"),
                                        fieldWithPath("errors").description("요청 필드별 검증 오류 목록"),
                                        fieldWithPath("errors[].field").description("검증에 실패한 요청 필드"),
                                        fieldWithPath("errors[].message").description("필드 검증 오류 메시지")
                                )
                                .build())
                ));
    }

    @Test
    @DisplayName("대소문자만 다른 닉네임이 이미 존재하면 가입을 거절한다")
    void shouldRejectWhenNicknameAlreadyExists(CapturedOutput output) throws Exception {
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
                .andExpect(jsonPath("$.id").value(403))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("이미 사용 중인 닉네임입니다."))
                .andExpect(jsonPath("$.type").doesNotExist())
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.detail").doesNotExist())
                .andExpect(jsonPath("$.instance").doesNotExist())
                .andExpect(content().string(not(containsString("닉네임 중복으로 회원가입에 실패했습니다."))))
                .andDo(document(
                        "users-create-nickname-conflict",
                        resource(ResourceSnippetParameters.builder()
                                .tag("User")
                                .summary("회원가입")
                                .description("닉네임과 비밀번호로 사용자를 생성합니다.")
                                .requestSchema(schema("CreateUserRequest"))
                                .responseSchema(schema("ErrorResponse"))
                                .requestFields(
                                        fieldWithPath("nickname").description("로그인에 사용할 닉네임"),
                                        fieldWithPath("password").description("사용자 비밀번호")
                                )
                                .responseFields(
                                        fieldWithPath("id").description("오류 식별자"),
                                        fieldWithPath("status").description("HTTP 상태 코드"),
                                        fieldWithPath("message").description("오류 메시지")
                                )
                                .build())
                ));

        assertThat(output)
                .contains("WARN")
                .contains("errorId=403")
                .contains("status=409")
                .contains("message=닉네임 중복으로 회원가입에 실패했습니다.");
    }
}
