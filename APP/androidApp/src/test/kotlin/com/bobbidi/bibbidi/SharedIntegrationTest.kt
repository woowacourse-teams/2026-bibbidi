package com.bobbidi.bibbidi

import com.bobbidi.bibbidi.shared.AppInfo
import kotlin.test.Test
import kotlin.test.assertEquals

class SharedIntegrationTest {
    @Test
    fun androidCanReadSharedAppName() {
        assertEquals("비비디", AppInfo.name)
    }
}
