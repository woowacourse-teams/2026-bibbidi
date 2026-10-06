package com.bobbidi.bibbidi.shared

import kotlin.test.Test
import kotlin.test.assertEquals

class AppInfoTest {
    @Test
    fun appNameIsAvailableToPlatformEntryPoints() {
        assertEquals("비비디", AppInfo.name)
    }
}
