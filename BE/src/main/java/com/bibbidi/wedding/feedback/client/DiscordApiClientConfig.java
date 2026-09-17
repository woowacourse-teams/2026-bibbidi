package com.bibbidi.wedding.feedback.client;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

@Configuration
@EnableConfigurationProperties(DiscordProperties.class)
public class DiscordApiClientConfig {

    @Bean
    public DiscordApiClient discordApiClient() {
        RestClient restClient = RestClient.builder().build();
        HttpServiceProxyFactory proxyFactory = HttpServiceProxyFactory
                .builderFor(RestClientAdapter.create(restClient))
                .build();
        return proxyFactory.createClient(DiscordApiClient.class);
    }
}
