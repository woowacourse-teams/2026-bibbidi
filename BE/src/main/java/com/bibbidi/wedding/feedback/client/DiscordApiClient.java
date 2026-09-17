package com.bibbidi.wedding.feedback.client;

import java.net.URI;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

@HttpExchange
public interface DiscordApiClient {

    @PostExchange
    void sendMessage(URI uri, @RequestBody DiscordMessageDto message);
}
