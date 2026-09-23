package com.bibbidi.wedding.auth.config;

import com.bibbidi.wedding.auth.oidc.client.OidcApiClient;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

/**
 * 소셜 제공자를 부르는 클라이언트를 만든다. 제공자가 늦게 답하더라도 요청 스레드가 묶이지 않도록 연결과 읽기에 제한 시간을 둔다.
 */
@Configuration
@EnableScheduling
@EnableConfigurationProperties({OidcProviderProperties.class, OidcPublicKeyCacheProperties.class})
public class OidcClientConfig {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(3);

    @Bean
    public OidcApiClient oidcApiClient() {
        RestClient restClient = RestClient.builder()
                .requestFactory(requestFactory())
                .build();

        HttpServiceProxyFactory proxyFactory = HttpServiceProxyFactory
                .builderFor(RestClientAdapter.create(restClient))
                .build();

        return proxyFactory.createClient(OidcApiClient.class);
    }

    private static JdkClientHttpRequestFactory requestFactory() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();

        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(READ_TIMEOUT);

        return requestFactory;
    }
}
