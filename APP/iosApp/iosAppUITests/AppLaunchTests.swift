import XCTest

final class AppLaunchTests: XCTestCase {
    func testLaunchDisplaysSharedAppName() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["비비디"].waitForExistence(timeout: 10))
    }
}
