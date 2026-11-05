import KakaoSDKAuth
import KakaoSDKCommon
import KakaoSDKUser
import Shared
import SwiftUI

@MainActor
final class KakaoLoginModel: ObservableObject {
    enum State { case idle, busy, verified, failed, unconfigured }
    @Published private(set) var state: State = .idle

    static var appKey: String? {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "KakaoNativeAppKey") as? String,
              !key.isEmpty, !key.contains("$(") else { return nil }
        return key
    }

    static func configure() {
        if let key = appKey { KakaoSDK.initSDK(appKey: key, loggingEnable: false) }
    }

    func login() {
        guard state != .busy else { return }
        guard Self.appKey != nil else { state = .unconfigured; return }
        state = .busy
        let finish: (OAuthToken?, Error?) -> Void = { [weak self] token, error in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if let error {
                    state = Self.cancelled(error) ? .idle : .failed
                } else { state = token == nil ? .failed : .verified }
            }
        }
        if UserApi.isKakaoTalkLoginAvailable() {
            UserApi.shared.loginWithKakaoTalk { token, error in
                if let error, !Self.cancelled(error) {
                    UserApi.shared.loginWithKakaoAccount(completion: finish)
                } else { finish(token, error) }
            }
        } else { UserApi.shared.loginWithKakaoAccount(completion: finish) }
    }

    func logout() {
        state = .busy
        UserApi.shared.logout { [weak self] _ in
            Task { @MainActor [weak self] in self?.state = .idle }
        }
    }

    private static func cancelled(_ error: Error) -> Bool {
        if case SdkError.ClientFailed(let reason, _) = error { return reason == .Cancelled }
        return false
    }
}

struct KakaoLoginView: View {
    @StateObject private var model = KakaoLoginModel()

    var body: some View {
        VStack(spacing: 20) {
            Text(AppInfo.shared.name).font(.largeTitle).bold()
            if model.state == .verified {
                Text("카카오 계정 인증을 완료했어요")
                Button("카카오 로그아웃") { model.logout() }.buttonStyle(.bordered)
            } else {
                Button("카카오 로그인") { model.login() }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 254 / 255, green: 229 / 255, blue: 0))
                    .foregroundStyle(Color(red: 25 / 255, green: 25 / 255, blue: 25 / 255))
            }
            if model.state == .failed {
                Text("카카오 인증을 완료하지 못했어요. 다시 시도해 주세요.").foregroundStyle(.red)
            } else if model.state == .unconfigured {
                Text("카카오 로그인을 준비하지 못했어요.").foregroundStyle(.red)
            }
            if model.state == .busy { ProgressView() }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .disabled(model.state == .busy)
    }
}
