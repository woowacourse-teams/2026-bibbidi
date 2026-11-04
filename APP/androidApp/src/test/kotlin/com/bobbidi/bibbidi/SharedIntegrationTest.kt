package com.bobbidi.bibbidi

import com.bobbidi.bibbidi.shared.AppInfo
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SharedIntegrationTest {
    @Test
    fun androidCanReadSharedAppName() {
        assertEquals("비비디", AppInfo.name)
    }

    @Test
    fun compiledConfigurationMatchesTheSelectedEnvironment() {
        val config = compiledAppConfiguration()
        val isDevelopment = BuildConfig.FLAVOR == "dev"
        assertEquals(if (isDevelopment) "com.bobbidi.bibbidi.dev" else "com.bobbidi.bibbidi", BuildConfig.APPLICATION_ID)
        assertEquals(if (isDevelopment) "dev" else "prod", config.environment)
        assertTrue(config.apiBaseUrl.startsWith("https://"), "API endpoint must use HTTPS")
        assertTrue(config.webBaseUrl.startsWith("https://"), "Web endpoint must use HTTPS")
        assertEquals(isDevelopment, config.developerToolsEnabled)
        if (!isDevelopment) assertFalse(BuildConfig.DEBUG)
    }
}
