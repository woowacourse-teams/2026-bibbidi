package com.bobbidi.bibbidi

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.bobbidi.bibbidi.shared.AppInfo

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val kakao = KakaoLogin(this)
        setContent {
            var busy by remember { mutableStateOf(false) }
            var authenticated by remember { mutableStateOf(false) }
            var message by remember { mutableStateOf<String?>(null) }
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.safeDrawingPadding().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically)) {
                        Text(AppInfo.name, style = MaterialTheme.typography.headlineLarge)
                        if (authenticated) {
                            Text("카카오 계정 인증을 완료했어요")
                            Button(enabled = !busy, onClick = {
                                busy = true
                                kakao.logout { authenticated = false; busy = false; message = null }
                            }) { Text("카카오 로그아웃") }
                        } else {
                            Button(enabled = !busy, colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFFEE500), contentColor = Color(0xFF191919)),
                                onClick = {
                                    busy = true
                                    message = null
                                    kakao.start { result ->
                                        busy = false
                                        authenticated = result == KakaoLoginResult.SUCCESS
                                        message = when (result) {
                                            KakaoLoginResult.SUCCESS, KakaoLoginResult.CANCELLED -> null
                                            KakaoLoginResult.FAILED -> "카카오 인증을 완료하지 못했어요. 다시 시도해 주세요."
                                            KakaoLoginResult.UNCONFIGURED -> "카카오 로그인을 준비하지 못했어요."
                                        }
                                    }
                                }) { Text("카카오 로그인") }
                        }
                        message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        if (busy) CircularProgressIndicator()
                    }
                }
            }
        }
    }
}
