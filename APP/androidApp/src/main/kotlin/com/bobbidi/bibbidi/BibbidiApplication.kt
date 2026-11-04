package com.bobbidi.bibbidi

import android.app.Application
import com.bobbidi.bibbidi.shared.AppConfiguration

class BibbidiApplication : Application() {
    val configuration = compiledAppConfiguration()
}

internal fun compiledAppConfiguration() = AppConfiguration(
    environment = BuildConfig.ENVIRONMENT,
    apiBaseUrl = BuildConfig.API_BASE_URL,
    webBaseUrl = BuildConfig.WEB_BASE_URL,
    developerToolsEnabled = BuildConfig.DEVELOPER_TOOLS_ENABLED,
)
