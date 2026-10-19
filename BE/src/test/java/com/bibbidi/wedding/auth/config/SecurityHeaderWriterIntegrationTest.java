package com.bibbidi.wedding.auth.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.support.BibbidiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.header.HeaderWriterFilter;
import org.springframework.test.util.ReflectionTestUtils;

class SecurityHeaderWriterIntegrationTest extends BibbidiIntegrationTest {

    @Autowired
    private FilterChainProxy filterChainProxy;

    @Test
    void writesSecurityHeadersBeforeSseWorkerCommitsResponse() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/ai/chat");

        HeaderWriterFilter headerWriterFilter = filterChainProxy.getFilterChains().stream()
                .filter(chain -> chain.matches(request))
                .flatMap(chain -> chain.getFilters().stream())
                .filter(HeaderWriterFilter.class::isInstance)
                .map(HeaderWriterFilter.class::cast)
                .findFirst()
                .orElseThrow();

        assertThat(ReflectionTestUtils.getField(headerWriterFilter, "shouldWriteHeadersEagerly")).isEqualTo(true);
    }
}
