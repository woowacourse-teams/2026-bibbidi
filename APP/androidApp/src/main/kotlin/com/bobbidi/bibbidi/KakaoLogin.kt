package com.bobbidi.bibbidi

import android.app.Activity
import com.kakao.sdk.auth.model.OAuthToken
import com.kakao.sdk.common.model.ClientError
import com.kakao.sdk.common.model.ClientErrorCause
import com.kakao.sdk.user.UserApiClient

enum class KakaoLoginResult { SUCCESS, CANCELLED, FAILED, UNCONFIGURED }

class KakaoLogin(private val activity: Activity) {
    fun start(complete: (KakaoLoginResult) -> Unit) {
        if (BuildConfig.KAKAO_NATIVE_APP_KEY.isBlank()) {
            complete(KakaoLoginResult.UNCONFIGURED)
            return
        }
        val finish: (OAuthToken?, Throwable?) -> Unit = { token, error ->
            complete(when {
                error is ClientError && error.reason == ClientErrorCause.Cancelled -> KakaoLoginResult.CANCELLED
                error != null -> KakaoLoginResult.FAILED
                token != null -> KakaoLoginResult.SUCCESS
                else -> KakaoLoginResult.FAILED
            })
        }
        if (UserApiClient.instance.isKakaoTalkLoginAvailable(activity)) {
            UserApiClient.instance.loginWithKakaoTalk(activity) { token, error ->
                if (error != null && !(error is ClientError && error.reason == ClientErrorCause.Cancelled)) {
                    UserApiClient.instance.loginWithKakaoAccount(activity, callback = finish)
                } else finish(token, error)
            }
        } else UserApiClient.instance.loginWithKakaoAccount(activity, callback = finish)
    }

    fun logout(complete: () -> Unit) {
        UserApiClient.instance.logout { complete() }
    }
}
