import Capacitor

@objc(RefreshControlPlugin)
public class RefreshControlPlugin: CAPPlugin {
    
    @objc func setRefresh(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let bridgeViewController = self.bridge?.viewController as? MainViewController,
                  let webView = bridgeViewController.webView else {
                call.reject("Could not access webView")
                return
            }
            
            let enabled = call.getBool("enabled") ?? true
            webView.scrollView.bounces = enabled
            call.resolve()
        }
    }
}