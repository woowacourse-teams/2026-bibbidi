package com.bibbidi.wedding.support;

import static org.springframework.restdocs.mockmvc.MockMvcRestDocumentation.documentationConfiguration;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.restdocs.RestDocumentationContextProvider;
import org.springframework.restdocs.RestDocumentationExtension;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@ExtendWith(RestDocumentationExtension.class)
public abstract class BibbidiIntegrationTest {

    @Autowired
    private WebApplicationContext context;

    protected MockMvc mockMvc;

    @BeforeEach
    void setUpRestDocs(RestDocumentationContextProvider restDocumentation) {
        mockMvc = webAppContextSetup(context)
                .apply(documentationConfiguration(restDocumentation))
                .build();
    }
}
