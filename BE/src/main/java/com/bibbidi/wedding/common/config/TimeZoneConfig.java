package com.bibbidi.wedding.common.config;

import java.util.TimeZone;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeZoneConfig {
    private static final String KOREA_TIMEZONE_ID = "Asia/Seoul";

    static {
        TimeZone koreaTimeZone = TimeZone.getTimeZone(KOREA_TIMEZONE_ID);
        TimeZone.setDefault(koreaTimeZone);
    }
}

