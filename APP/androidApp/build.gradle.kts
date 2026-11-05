import java.net.URI
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val localSettings = Properties().apply {
    rootProject.file("local.properties").takeIf { it.isFile }?.reader(Charsets.UTF_8)?.use { load(it) }
}

fun configuredHost(name: String): String {
    val value = providers.environmentVariable(name).orNull?.takeIf { it.isNotBlank() }
        ?: localSettings.getProperty(name)?.takeIf { it.isNotBlank() }
        ?: error("Missing $name. Set it in APP/local.properties or the build environment.")
    val uri = runCatching { URI("https://$value") }.getOrNull()
    require(uri?.host != null && uri.rawAuthority == value && uri.userInfo == null &&
        uri.rawPath.isNullOrEmpty() && uri.rawQuery == null && uri.rawFragment == null) {
        "$name must be a host with an optional port, without a scheme or path."
    }
    return value
}

val devApiHost = configuredHost("APP_DEV_API_HOST")
val devWebHost = configuredHost("APP_DEV_WEB_HOST")
val prodApiHost = configuredHost("APP_PROD_API_HOST")
val prodWebHost = configuredHost("APP_PROD_WEB_HOST")

fun kakaoAppKey(environment: String): String {
    val name = "APP_${environment}_KAKAO_NATIVE_APP_KEY"
    val value = providers.environmentVariable(name).orNull ?: localSettings.getProperty(name).orEmpty()
    require(value.isEmpty() || value.matches(Regex("[A-Za-z0-9_-]+"))) { "Invalid Kakao app key setting: $name" }
    return value
}

val releaseSigning = listOf(
    "ANDROID_KEYSTORE_PATH", "ANDROID_STORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD",
).associateWith { providers.environmentVariable(it).orNull }
val hasReleaseSigning = releaseSigning.values.all { !it.isNullOrBlank() }

android {
    namespace = "com.bobbidi.bibbidi"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.bobbidi.bibbidi"
        minSdk = 24
        targetSdk = 36
        versionCode = 4
        versionName = "1.0.1"
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            val kakaoKey = kakaoAppKey("DEV")
            buildConfigField("String", "KAKAO_NATIVE_APP_KEY", "\"$kakaoKey\"")
            manifestPlaceholders["kakaoScheme"] = "kakao${kakaoKey.ifEmpty { "unconfigured" }}"
            applicationIdSuffix = ".dev"
            resValue("string", "app_name", "비비디 개발")
            buildConfigField("String", "ENVIRONMENT", "\"dev\"")
            buildConfigField("String", "API_BASE_URL", "\"https://$devApiHost\"")
            buildConfigField("String", "WEB_BASE_URL", "\"https://$devWebHost\"")
            buildConfigField("boolean", "DEVELOPER_TOOLS_ENABLED", "true")
            signingConfig = signingConfigs.getByName("debug")
        }
        create("prod") {
            dimension = "environment"
            val kakaoKey = kakaoAppKey("PROD")
            buildConfigField("String", "KAKAO_NATIVE_APP_KEY", "\"$kakaoKey\"")
            manifestPlaceholders["kakaoScheme"] = "kakao${kakaoKey.ifEmpty { "unconfigured" }}"
            resValue("string", "app_name", "비비디")
            buildConfigField("String", "ENVIRONMENT", "\"prod\"")
            buildConfigField("String", "API_BASE_URL", "\"https://$prodApiHost\"")
            buildConfigField("String", "WEB_BASE_URL", "\"https://$prodWebHost\"")
            buildConfigField("boolean", "DEVELOPER_TOOLS_ENABLED", "false")
        }
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("upload") {
                storeFile = file(releaseSigning.getValue("ANDROID_KEYSTORE_PATH")!!)
                storePassword = releaseSigning.getValue("ANDROID_STORE_PASSWORD")
                keyAlias = releaseSigning.getValue("ANDROID_KEY_ALIAS")
                keyPassword = releaseSigning.getValue("ANDROID_KEY_PASSWORD")
            }
        }
    }
    if (hasReleaseSigning) {
        productFlavors.named("prod") { signingConfig = signingConfigs.getByName("upload") }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// A production app must never contain a debuggable build or src/dev code.
androidComponents {
    beforeVariants(selector().withFlavor("environment" to "prod").withBuildType("debug")) {
        it.enable = false
    }
}

val requireUploadSigning by tasks.registering {
    doLast {
        check(listOf(prodApiHost, prodWebHost).none { it.substringBefore(':').endsWith(".invalid") }) {
            "Production bundles require real endpoint settings; example hosts cannot be released."
        }
        check(hasReleaseSigning) {
            "Signed production bundles require ANDROID_KEYSTORE_PATH, ANDROID_STORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD."
        }
    }
}
tasks.matching { it.name == "bundleProdRelease" }.configureEach {
    dependsOn(requireUploadSigning)
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.kakao.user)
    testImplementation(libs.kotlin.test.junit)
    implementation(project(":shared"))
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
}
