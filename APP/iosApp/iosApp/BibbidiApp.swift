import Shared
import SwiftUI

@main
struct BibbidiApp: App {
    var body: some Scene {
        WindowGroup {
            Text(AppInfo.shared.name)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
