import Shared
import SwiftUI
import WebKit

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
            BibbidiWebView(homeAddress: configuration.webBaseUrl)
        }
    }
}

private struct BibbidiWebView: UIViewRepresentable {
    let homeAddress: String

    func makeUIView(context: Context) -> WKWebView {
        guard let homeURL = URL(string: homeAddress), let host = homeURL.host, !host.isEmpty else {
            preconditionFailure("Invalid Bibbidi web address")
        }

        let webView = WKWebView()
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: homeURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
