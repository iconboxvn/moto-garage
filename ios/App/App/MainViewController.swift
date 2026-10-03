import UIKit
import Capacitor

// 앱 타깃 안의 로컬 플러그인(Riding)은 npm 패키지가 아니라 자동 등록이 안 되므로 여기서 직접 등록한다.
// Android의 MainActivity.registerPlugin()에 해당.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RidingPlugin())
    }
}
