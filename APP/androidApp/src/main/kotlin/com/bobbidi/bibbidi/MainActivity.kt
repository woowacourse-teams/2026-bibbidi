package com.bobbidi.bibbidi

import android.content.Context
import android.os.Bundle
import android.view.ViewGroup.LayoutParams
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val homeUrl = (application as BibbidiApplication).configuration.webBaseUrl
        val historyBack = object : OnBackPressedCallback(false) {
            override fun handleOnBackPressed() {
                webView?.goBack()
            }
        }
        onBackPressedDispatcher.addCallback(this, historyBack)

        setContent {
            AndroidView(
                modifier = Modifier.fillMaxSize().safeDrawingPadding(),
                factory = { context ->
                    createWebView(context, homeUrl, savedInstanceState, historyBack)
                },
                onRelease = { view ->
                    historyBack.isEnabled = false
                    webView = null
                    view.destroy()
                },
            )
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView?.saveState(outState)
    }

    private fun createWebView(
        context: Context,
        homeUrl: String,
        savedInstanceState: Bundle?,
        historyBack: OnBackPressedCallback,
    ): WebView = WebView(context).apply {
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        webViewClient = object : WebViewClient() {
            override fun doUpdateVisitedHistory(
                view: WebView,
                url: String,
                isReload: Boolean,
            ) {
                historyBack.isEnabled = view.canGoBack()
            }
        }
        webView = this
        if (savedInstanceState == null || restoreState(savedInstanceState) == null) {
            loadUrl(homeUrl)
        } else {
            historyBack.isEnabled = canGoBack()
        }
    }
}
