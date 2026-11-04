# Bibbidi App

Kotlin Multiplatform 기반의 Android·iOS 최소 앱입니다. 공통 로직은 Kotlin으로,
Android UI는 Jetpack Compose로, iOS UI는 SwiftUI로 구성합니다.
현재는 두 앱 모두 공통 모듈의 앱 이름을 표시하는 진입점만 제공합니다.

## 구조

```text
APP/
├── shared/        # 단일 KMP 로직 모듈 (Android, iOS device / Simulator)
├── androidApp/    # Jetpack Compose 앱
├── iosApp/        # SwiftUI 앱, 공유 Xcode scheme, config/의 iOS 환경 값
├── assets/brand/  # 후속 네이티브 이관에 사용할 기존 브랜드 원본
└── gradle/        # Gradle Wrapper와 Version Catalog
```

## 요구 환경

- 빌드용 JDK 25
- Android SDK Platform 36와 Build Tools 36.0.0, Android Emulator 또는 기기
- iOS 빌드는 macOS Tahoe 26.6 이상과 Xcode 27이 필요합니다. Simulator 실행에는 iOS 27 런타임이 필요합니다.
- FE·공통 JavaScript 도구는 기존 Node.js 24, pnpm 11 환경을 사용합니다. APP은 pnpm workspace에 포함하지 않습니다.

Kotlin 2.3.21, AGP 9.0.0, Gradle 9.3.0을 사용합니다. 버전은 `gradle/libs.versions.toml`과 Wrapper에 고정합니다.
Xcode 27에서 shared device·Simulator framework, SwiftUI Simulator·서명 없는 device Release 빌드를 검증했습니다.
iOS 27의 iPhone 18 Pro Simulator에서 앱 설치·실행과 공통 앱 이름 표시를 확인했습니다.
Kotlin 공식 호환표의 2.3.21 기준 Xcode 버전은 26.0이므로, 현재 조합의 빌드 검증과 공식 지원 범위는 구분해야 합니다.
Gradle Daemon JVM은 `gradle/gradle-daemon-jvm.properties`로 JDK 25에 고정합니다.
Wrapper의 Launcher JVM이 17·21이어도 실제 빌드를 실행하는 Daemon은 25를 선택합니다.
Gradle 실행용 JDK와 Android 산출물의 JVM 타깃은 별개이며, `androidApp`과 `shared` Android 타깃은 17을 유지합니다.
Android Studio의 Gradle JDK와 후속 CI(#247)의 Java 설정도 25로 맞춥니다.
JDK를 설치한 뒤 `JAVA_HOME`을 JDK 25 경로로 설정하세요. macOS에서는
`export JAVA_HOME=$(/usr/libexec/java_home -v 25)`를 사용할 수 있습니다.
Homebrew JDK가 검색되지 않으면 Homebrew 설치 안내에 따라 JVM bundle을 등록하거나 `JAVA_HOME`을 직접 지정하세요.
JDK 자동 다운로드는 구성하지 않았으므로 개발 환경과 CI에 JDK 25 설치가 필요합니다.

Android API 24+, iOS 15+를 대상으로 합니다. Xcode 27의 deployment target 요구사항에 맞춰
기존 설계의 iOS 14+에서 iOS 15+로 올렸습니다. 업그레이드할 때는 Kotlin/Native 런타임의 최소 OS 버전도 함께 확인해야 합니다.

- [KMP 버전 호환성](https://kotlinlang.org/docs/multiplatform/multiplatform-compatibility-guide.html)
- [Kotlin/Native 2.3.21 최소 OS 설정](https://github.com/JetBrains/kotlin/blob/v2.3.21/kotlin-native/konan/konan.properties)
- [Xcode SDK·지원 OS 요구사항](https://developer.apple.com/xcode/system-requirements)

## dev / prod 설정

Android 환경 값은 `androidApp/build.gradle.kts`의 `productFlavors`에서 관리합니다.
실제 서버 host는 환경 변수를 우선 읽고, 없으면 Git에서 제외한 `APP/local.properties`에서 읽습니다.
iOS 환경 값은 `iosApp/config/Dev.xcconfig`, `iosApp/config/Prod.xcconfig`에서 관리하고,
실제 host는 Git에서 제외한 `iosApp/config/Endpoints.local.xcconfig`를 include해 읽습니다.
Xcode의 base configuration으로 연결하며, iOS URL은 xcconfig의 host에
`Info.plist`에서 HTTPS scheme을 붙여 구성합니다.
실제 주소를 공개 코드·문서·테스트에 적지 않습니다. 서버 주소를 변경할 때는 각 플랫폼의
로컬 설정과 배포용 GitHub Secrets를 함께 수정합니다. 빌드된 앱에는 주소가 포함됩니다.

| 설정 | dev | prod |
| --- | --- | --- |
| 앱 ID | `com.bobbidi.bibbidi.dev` | `com.bobbidi.bibbidi` |
| 표시 이름 | 비비디 개발 | 비비디 |
| 네이티브 API host 설정 키 | `APP_DEV_API_HOST` | `APP_PROD_API_HOST` |
| WebView host 설정 키 | `APP_DEV_WEB_HOST` | `APP_PROD_WEB_HOST` |
| 개발 도구 | 허용 | 비활성화 |
| Android variant | `devDebug`, `devRelease` | `prodRelease` |
| Xcode scheme | `Bibbidi Dev` | `Bibbidi` |
| Xcode configuration | `Debug`, `DevRelease` | `Release` |

두 앱은 같은 기기에 함께 설치할 수 있습니다. staging과 prod Debug 조합은 제공하지 않습니다.
Android의 `src/dev`는 prod에 포함되지 않으며, iOS 개발 전용 코드는 `#if BIBBIDI_DEV`로 감쌉니다.
개발 도구 허용 여부는 빌드에서 정하며 앱 설정으로 환경을 전환하지 않습니다.
Android `BibbidiApplication.configuration`과 iOS `BibbidiApp.configuration`이
공통 `AppConfiguration`에 환경·API·웹 주소를 전달합니다.
실제 네트워크·WebView·OAuth 설정과 딥 링크 연결은 #213·#244·#245의 범위입니다.
개발용 앱 ID에 맞는 provider 등록도 실제 인증 작업에서 진행합니다.

로컬 설정은 `local.properties.example`과 `iosApp/config/Endpoints.local.xcconfig.example`을 참고합니다.
예제의 `.invalid` host를 실제 값으로 바꿔 로컬 파일에만 저장합니다.
기존 `local.properties`가 있으면 SDK 경로 등 기존 값을 유지하고 네 가지 host 키를 추가합니다.
host에는 `https://`나 경로를 넣지 않습니다. 두 플랫폼이 HTTPS URL을 구성합니다.

```bash
# local.properties가 없는 경우에만 예제를 복사합니다.
cp -n APP/local.properties.example APP/local.properties
cp -n APP/iosApp/config/Endpoints.local.xcconfig.example APP/iosApp/config/Endpoints.local.xcconfig
```

## Android

Android Studio에서 `APP`을 Gradle 프로젝트로 엽니다. SDK 경로가 자동 설정되지 않으면
`APP/local.properties`에 로컬 경로를 적거나 `ANDROID_HOME`을 설정합니다.
`local.properties`는 Git에 올리지 않습니다.

네트워크 보안 정책은 `androidApp/src/main/res/xml/network_security_config.xml`에서 관리합니다.
dev/prod 모두 `base-config`로 HTTP를 기본 차단하며, 개발용 HTTP·인증서 예외는 추가하지 않았습니다.
Manifest의 `android:networkSecurityConfig`로 연결하고, 기존 `usesCleartextTraffic` 속성은 제거했습니다.

저장소 루트에서:

```bash
./APP/gradlew -p APP :androidApp:assembleDevDebug
```

Windows에서는 `APP\gradlew.bat -p APP :androidApp:assembleDevDebug`를 사용합니다.
산출물은 `APP/androidApp/build/outputs/apk/dev/debug/androidApp-dev-debug.apk`입니다.
Android Studio에서 `androidApp`을 실행하거나, 켜진 에뮬레이터·기기에 다음과 같이 설치합니다.

```bash
adb install -r APP/androidApp/build/outputs/apk/dev/debug/androidApp-dev-debug.apk
adb shell am start -n com.bobbidi.bibbidi.dev/com.bobbidi.bibbidi.MainActivity
```

## iOS

`APP/iosApp/iosApp.xcodeproj`를 Xcode에서 열고 `Bibbidi Dev` scheme과 Simulator를 선택해 실행합니다.
Compile Sources 앞의 Build shared framework 단계에서
`:shared:embedAndSignAppleFrameworkForXcode`를 실행해 Kotlin framework를 연결합니다.
`JAVA_HOME`이 없으면 스크립트가 설치된 JDK 25를 찾습니다.
실기기 실행 시 Signing & Capabilities에서 개인 개발 팀 설정이 필요합니다.

iOS Simulator 런타임은 Xcode Settings의 Components에서 설치하거나 다음 명령으로 설치합니다.

```bash
xcodebuild -downloadPlatform iOS -buildVersion 27.0 -architectureVariant arm64
```

위 명령은 Apple Silicon용입니다. Intel Mac에서는 `-architectureVariant universal`을 사용합니다.

저장소 루트에서 서명 없이 Simulator SDK용 앱을 빌드할 수 있습니다.
아래 빌드는 Simulator 런타임 없이도 SDK만으로 실행할 수 있습니다.

```bash
xcodebuild -project APP/iosApp/iosApp.xcodeproj \
  -scheme "Bibbidi Dev" -configuration Debug -sdk iphonesimulator \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO \
  SYMROOT="$PWD/APP/iosApp/build" build
```

## 공통 모듈 검증

```bash
./APP/gradlew -p APP projects :shared:compileCommonMainKotlinMetadata
./APP/gradlew -p APP :shared:linkDebugFrameworkIosArm64 :shared:linkDebugFrameworkIosSimulatorArm64
```

공통 모듈의 앱 이름 계약, Android에서 공통 모듈 접근, iOS 앱 실행 후 공통 앱 이름 표시를 테스트합니다.
인증 상태와 실제 인증 연결은 #213에서 확장합니다. 별도의 fake 인증 앱은 만들지 않습니다.
iOS 타깃은 `iosArm64`, `iosSimulatorArm64`, `iosX64`입니다.
Apple Silicon에서 Intel Simulator 테스트 실행은 지원하지 않습니다.

## 보존한 값과 후속 작업

- production Android applicationId·iOS bundle identifier: `com.bobbidi.bibbidi`
- 기존 표시 버전: `1.0.1`, Android versionCode: `4`
- iOS 프로젝트의 시작 build 번호도 `4`로 설정했습니다. 기존 iOS 스토어 게시 이력을 확인한 값은 아닙니다.
- 기존 딥 링크 scheme은 `bibbidi`였습니다. 최소 앱에는 intent filter·URL scheme을 연결하지 않았으며 실제 인증 연동 #213에서 설정합니다.
- 기존 아이콘·스플래시·iOS 아이콘 원본은 `assets/brand`에 보존합니다. #246에서 플랫폼별 자산으로 이관합니다.
- Android upload signing은 기존 `android-release` Environment의 네 가지 Secret을 사용합니다.
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_STORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
- 실제 서버 host는 같은 `android-release` Environment의 다음 Secrets에서 빌드 환경 변수로 주입합니다.
  - `APP_DEV_API_HOST`
  - `APP_DEV_WEB_HOST`
  - `APP_PROD_API_HOST`
  - `APP_PROD_WEB_HOST`
- `.github/workflows/android-release.yml`은 `release-app` push 또는 해당 브랜치에서 수동 실행할 때
  서명한 `androidApp-prod-release.aab`를 생성·검증하고 Actions Artifact로 7일 보관합니다.
  Play Store 업로드는 하지 않습니다. 키 파일은 runner 임시 디렉터리에만 복원하고 종료 시 지웁니다.
- 로컬 서명 빌드는 `ANDROID_KEYSTORE_PATH`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`를 환경 변수로 주입한 뒤 `:androidApp:bundleProdRelease`를 실행합니다.
  키 파일과 비밀번호는 저장소에 넣지 않습니다. 서명 정보가 없으면 production bundle 빌드가 실패합니다.
  예제의 `.invalid` host를 사용한 production bundle 생성도 차단합니다.
- secret 없는 PR CI와 로컬 검증에서는 `:androidApp:assembleProdRelease`로 서명 없는 APK를 빌드합니다.
  이 APK는 설치·스토어 배포용이 아닙니다. devRelease는 개발용 debug key로 서명합니다.
- 실제 기존 키로 서명되는지는 `release-app`의 원격 workflow에서 별도로 확인해야 합니다.
- shared·Android·iOS PR CI는 `.github/workflows/app-ci.yml`에서 실행합니다.
- 인증(#213·#242·#243), WebView(#244·#245), 브랜드 자산(#246)은 후속 작업입니다.

추적: [#239](https://github.com/woowacourse-teams/2026-bibbidi/issues/239),
[#211](https://github.com/woowacourse-teams/2026-bibbidi/issues/211).

## APP CI

`dev-app`·`release-app` 대상 PR에서 `APP/**` 또는 APP CI workflow가 바뀌면 다음 check를 실행합니다.
`dev-app` push에서도 실행해 기본 캐시를 생성하며, Actions에서 수동 재실행도 가능합니다.
공개 CI는 실제 주소나 Secrets 없이 `.invalid` 테스트 host를 환경 변수로 주입합니다.
iOS 테스트용 로컬 xcconfig도 해당 환경 변수에서 생성합니다. 실제 서버 통신을 검증하는 CI가 아닙니다.

| Check | 검사 |
| --- | --- |
| Shared tests | `:shared:testAndroidHostTest`로 commonTest 실행 |
| Android tests | `:androidApp:testDevDebugUnitTest`, `:androidApp:testProdReleaseUnitTest` |
| Android build | `devDebug`·`devRelease`·서명 없는 `prodRelease` APK |
| iOS tests | `:shared:iosSimulatorArm64Test`, 실행 시점에 따라 Xcode 앱 실행 UI 테스트 추가 |
| iOS build | 서명 없는 Simulator `Debug`·`DevRelease`·`Release` 빌드 |

`dev-app` 대상 PR에서는 iOS shared 테스트와 앱 빌드를 실행하고 앱 실행 UI 테스트는 생략합니다.
`dev-app` push, `release-app` 대상 PR, 수동 실행에서는 앱 실행 UI 테스트까지 검증합니다.
개발 PR에서는 빠르게 피드백을 받고, 개발 브랜치 통합 후와 릴리스 전에는 앱 실행을 확인합니다.
UI 테스트를 생략해도 `iOS tests` check는 shared 테스트 결과를 보고합니다.

UI 테스트 직전에는 전용 iPhone 18 Pro / iOS 27.0 Simulator를 생성하고
`simctl bootstatus -b`로 부팅 완료를 기다린 뒤, 해당 Simulator ID로 테스트합니다.
준비 단계는 5분, UI 테스트는 15분으로 제한하고 성공·실패 후 Simulator를 정리합니다.
이는 Simulator 준비 상태를 보강하는 조치이며 XCTest Accessibility 초기화의 간헐적인 실패가
완전히 해결됐음을 보장하지는 않습니다. UI 테스트 실패는 그대로 CI 실패로 표시합니다.

GitHub 브랜치 보호의 필수 검사에는 위 다섯 check를 등록합니다. 경로 필터로 건너뛴 workflow는
필수 검사가 pending으로 남을 수 있으므로, APP 브랜치에서 APP과 무관한 PR을 병합할 때 이 점을 고려하세요.
Workflow 파일만으로 브랜치 보호 설정이 바뀌지는 않습니다.

JDK 25와 Android SDK 36을 사용하며, iOS는 ARM64 `xcode-27` runner에서 Xcode 27.0과
iPhone 18 Pro / iOS 27.0 Simulator를 사용합니다. 이 runner는 GitHub의 public preview입니다.
Gradle·Kotlin/Native 캐시는 PR에서 읽기만 하며, push·수동 실행에서 갱신합니다.
Kotlin/Native 캐시는 OS·CPU·Xcode·Kotlin/Gradle 설정으로 구분하고 다운로드한 도구·의존성만 보관합니다.
서명·OAuth secret 없이 fork PR에서도 실행하며, 같은 PR의 새 실행은 이전 실행을 취소합니다.
실패한 테스트 보고서와 Xcode 결과는 Actions Artifacts에 7일 보관합니다.

Release 단위 테스트도 환경 경계 검증을 위해 명시적으로 활성화했습니다.
`DevRelease`는 `KOTLIN_FRAMEWORK_BUILD_TYPE=Release`로 Kotlin framework를 연결합니다.

로컬에서 CI와 같은 검사를 실행하려면:

```bash
./APP/gradlew -p APP :shared:testAndroidHostTest :androidApp:testDevDebugUnitTest :androidApp:testProdReleaseUnitTest :androidApp:assembleDevDebug :androidApp:assembleDevRelease :androidApp:assembleProdRelease
./APP/gradlew -p APP :shared:iosSimulatorArm64Test
xcodebuild -project APP/iosApp/iosApp.xcodeproj -scheme "Bibbidi Dev" -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro,OS=27.0' \
  -derivedDataPath APP/iosApp/build/DerivedData -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test
```

운영 Simulator 빌드를 확인하려면:

```bash
xcodebuild -project APP/iosApp/iosApp.xcodeproj -scheme Bibbidi -configuration Release \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath APP/iosApp/build/Release CODE_SIGNING_ALLOWED=NO build
```

iOS device Archive에는 Apple 개발 팀·인증서·프로비저닝 설정이 추가로 필요합니다.
이번 환경 구성은 해당 인증 정보를 저장하거나 TestFlight 업로드를 자동화하지 않습니다.
