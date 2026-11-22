import UIKit
import Capacitor

// COMFORCE_SERVER_CHIP: a persistent control that returns to the saved-server picker.
@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var serverButton: UIButton?
    private var urlObservation: NSKeyValueObservation?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        installServerButton(attempt: 0)
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    private func installServerButton(attempt: Int) {
        guard serverButton == nil else { return }
        guard let controller = rootController(), let webView = controller.webView, let host = keyWindow() else {
            if attempt < 8 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    self.installServerButton(attempt: attempt + 1)
                }
            }
            return
        }

        let button = UIButton(type: .system)
        button.setTitle("Server", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
        button.backgroundColor = UIColor(red: 15.0 / 255.0, green: 107.0 / 255.0, blue: 58.0 / 255.0, alpha: 0.94)
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = 18
        button.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.accessibilityLabel = "Change server"
        host.addSubview(button)
        NSLayoutConstraint.activate([
            button.topAnchor.constraint(equalTo: host.safeAreaLayoutGuide.topAnchor, constant: 8),
            button.trailingAnchor.constraint(equalTo: host.safeAreaLayoutGuide.trailingAnchor, constant: -10),
            button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
        button.addTarget(self, action: #selector(serverTapped), for: .touchUpInside)

        let localPrefix = controller.bridge?.config.localURL.absoluteString ?? "capacitor://localhost"
        urlObservation = webView.observe(\.url, options: [.initial, .new]) { [weak button] view, _ in
            let current = view.url?.absoluteString ?? ""
            button?.isHidden = current.isEmpty || current.hasPrefix(localPrefix)
        }
        serverButton = button
    }

    @objc private func serverTapped() {
        openPicker()
    }

    private func openPicker() {
        guard let controller = rootController(), let webView = controller.webView else { return }
        let base = controller.bridge?.config.localURL ?? URL(string: "capacitor://localhost")!
        var parts = URLComponents(url: base, resolvingAgainstBaseURL: false)
        parts?.path = "/"
        parts?.queryItems = [URLQueryItem(name: "picker", value: "1")]
        if let url = parts?.url {
            webView.load(URLRequest(url: url))
        }
    }

    private func rootController() -> CAPBridgeViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap { $0.windows }
        let host = windows.first { $0.isKeyWindow } ?? windows.first
        return host?.rootViewController as? CAPBridgeViewController
    }

    private func keyWindow() -> UIWindow? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap { $0.windows }
        return windows.first { $0.isKeyWindow } ?? windows.first
    }
}
