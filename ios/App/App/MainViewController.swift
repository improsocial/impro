import UIKit
import WebKit
import Capacitor 

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {

  private let refresh = UIRefreshControl()
  private var scrollView = UIScrollView()
  // #1a1a1a
  private let appBg = UIColor(red: 0x1a/255.0, green: 0x1a/255.0, blue: 0x1a/255.0, alpha: 1.0)

  override func capacitorDidLoad() {
    super.capacitorDidLoad()

    guard let webView = self.webView else { return }
    
    // Add message handler for "appHandler"
    webView.configuration.userContentController.add(self, name: "appHandler")
    
    webView.allowsBackForwardNavigationGestures = true

    let scrollView = webView.scrollView
    self.scrollView = scrollView
    scrollView.bounces = true
    scrollView.alwaysBounceVertical = true

    refresh.tintColor = .white
    refresh.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
    scrollView.refreshControl = refresh

    scrollView.backgroundColor = appBg
    scrollView.subviews.first?.backgroundColor = appBg
  }
  
  // MARK: - WKScriptMessageHandler
  
  func userContentController(_ userContentController: WKUserContentController, 
                            didReceive message: WKScriptMessage) {
    if message.name == "appHandler" {
      if let data = message.body as? [String: Any] {
        print("Received from JS: \(data)")

        let type = data["type"] as? String
        
        // Handle refresh type messages
        if type == "refresh" {
          if let enabled = data["enabled"] as? Bool {
            // Set bounces based on enabled value
            webView?.scrollView.bounces = enabled
            webView?.scrollView.alwaysBounceVertical = enabled
          }
        } else if type == "refresh-ended" {
            // do this again because it's needed for some reason
          // refresh.endRefreshing()

           // Add a small delay to ensure refresh animation completes
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
              guard let self = self else { return }
              let topOffset = CGPoint(x: 0, y: -self.scrollView.adjustedContentInset.top)
              self.scrollView.setContentOffset(topOffset, animated: true)
          }
        }
      }
    }
  }

  @objc private func handleRefresh() {
    refresh.endRefreshing()
    webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('native-reload'))", completionHandler: nil)
  }
  
  deinit {
    webView?.configuration.userContentController.removeScriptMessageHandler(forName: "appHandler")
  }
}
