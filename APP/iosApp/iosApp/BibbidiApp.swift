import Shared
import SwiftUI
import KakaoSDKAuth

@main
struct BibbidiApp: App {
    let configuration: AppConfiguration = {
        func setting(_ key: String) -> String {
            guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
                  !value.isEmpty else { fatalError("Missing app configuration: \(key)") }
            return value
        }
        #if BIBBIDI_DEV
        let developerToolsEnabled = true
        #else
        let developerToolsEnabled = false
        #endif
        return AppConfiguration(
            environment: setting("BibbidiEnvironment"),
            apiBaseUrl: setting("BibbidiApiBaseUrl"),
            webBaseUrl: setting("BibbidiWebBaseUrl"),
            developerToolsEnabled: developerToolsEnabled
        )
    }()

    init() { KakaoLoginModel.configure() }

    var body: some Scene {
        WindowGroup {
            KakaoLoginView()
                .onOpenURL { url in
                    if AuthApi.isKakaoTalkLoginUrl(url) { _ = AuthController.handleOpenUrl(url: url) }
                }
        }
    }
}
