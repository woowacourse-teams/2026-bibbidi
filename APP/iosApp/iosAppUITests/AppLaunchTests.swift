import XCTest

final class AppLaunchTests: XCTestCase {
    func testLaunchDisplaysSharedAppName() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["비비디"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["카카오 로그인"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Google로 계속하기"].exists)
        XCTAssertFalse(app.buttons["Apple로 계속하기"].exists)
    }
}
