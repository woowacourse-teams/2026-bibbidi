import XCTest

final class AppLaunchTests: XCTestCase {
    func testLaunchOpensWebView() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 10))
    }
}
