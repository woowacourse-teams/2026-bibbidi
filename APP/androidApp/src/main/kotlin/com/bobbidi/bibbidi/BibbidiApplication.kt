package com.bobbidi.bibbidi

import android.app.Application
import com.bobbidi.bibbidi.shared.AppConfiguration
import com.kakao.sdk.common.KakaoSdk

class BibbidiApplication : Application() {
    val configuration = compiledAppConfiguration()

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.KAKAO_NATIVE_APP_KEY.isNotBlank()) {
            KakaoSdk.init(this, BuildConfig.KAKAO_NATIVE_APP_KEY, loggingEnabled = false)
        }
    }
}

internal fun compiledAppConfiguration() = AppConfiguration(
    environment = BuildConfig.ENVIRONMENT,
    apiBaseUrl = BuildConfig.API_BASE_URL,
    webBaseUrl = BuildConfig.WEB_BASE_URL,
    developerToolsEnabled = BuildConfig.DEVELOPER_TOOLS_ENABLED,
)
