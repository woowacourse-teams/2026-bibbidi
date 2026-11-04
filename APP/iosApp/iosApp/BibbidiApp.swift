import Shared
import SwiftUI

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

    var body: some Scene {
        WindowGroup {
            Text(AppInfo.shared.name)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
