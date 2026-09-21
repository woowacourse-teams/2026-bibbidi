package com.bibbidi.wedding.support;

import org.junit.platform.launcher.LauncherSession;
import org.junit.platform.launcher.LauncherSessionListener;

public class JwtTestKeyLauncherSessionListener implements LauncherSessionListener {

    @Override
    public void launcherSessionOpened(LauncherSession session) {
        System.setProperty("bibbidi.jwt.active-key-id", JwtTestKeys.ACTIVE_KEY_ID);
        System.setProperty("bibbidi.jwt.active-private-key", JwtTestKeys.encodedPrivateKey());
    }
}
