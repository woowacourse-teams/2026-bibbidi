package com.bobbidi.bibbidi.shared

import kotlin.test.Test
import kotlin.test.assertFailsWith

class AppConfigurationTest {
    @Test
    fun productionRejectsDeveloperTools() {
        assertFailsWith<IllegalArgumentException> {
            AppConfiguration("prod", "https://api.example.invalid", "https://web.example.invalid", true)
        }
    }

    @Test
    fun endpointsRejectCleartextTraffic() {
        assertFailsWith<IllegalArgumentException> {
            AppConfiguration("dev", "http://dev-api.example.invalid", "https://dev-web.example.invalid", true)
        }
        assertFailsWith<IllegalArgumentException> {
            AppConfiguration("dev", "https://dev-api.example.invalid", "http://dev-web.example.invalid", true)
        }
    }

    @Test
    fun unknownEnvironmentsAreRejected() {
        assertFailsWith<IllegalArgumentException> {
            AppConfiguration("unknown", "https://api.example.invalid", "https://web.example.invalid", false)
        }
    }
}
