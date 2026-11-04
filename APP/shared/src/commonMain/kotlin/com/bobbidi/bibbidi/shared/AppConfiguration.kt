package com.bobbidi.bibbidi.shared

class AppConfiguration(
    val environment: String,
    val apiBaseUrl: String,
    val webBaseUrl: String,
    val developerToolsEnabled: Boolean,
) {
    init {
        require(environment == "dev" || environment == "prod") { "Unknown app environment" }
        require(environment != "prod" || !developerToolsEnabled) { "Production cannot enable developer tools" }
        require(apiBaseUrl.startsWith("https://") && webBaseUrl.startsWith("https://")) {
            "App endpoints must use HTTPS"
        }
    }
}
