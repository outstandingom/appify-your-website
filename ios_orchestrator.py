#!/usr/bin/env python3
"""
iOS Xcode project generator for WebView wrapper apps.
Produces a minimal native iOS app that loads a website in WKWebView.
Builds an unsigned .ipa via xcodebuild on a macOS GitHub runner.
"""

import json
import os
import sys
import uuid
import shutil
import urllib.request

config = json.loads(os.environ.get("APP_CONFIG", "{}"))

APP_NAME = config.get("app_name", "WebApp")
WEBSITE_URL = config.get("website_url", "https://example.com")
ICON_URL = config.get("icon_url", "")
SPLASH_COLOR = config.get("splash_color", "#10B981")
STATUS_BAR_COLOR = config.get("status_bar_color", "#000000")
OFFLINE_MSG = config.get("offline_message", "You are offline. Please check your connection.")

custom_pkg = config.get("package_name", "")
if custom_pkg:
    BUNDLE_ID = custom_pkg
else:
    slug = "".join(c for c in APP_NAME.lower() if c.isalnum())[:30] or "myapp"
    BUNDLE_ID = f"com.webtoapk.{slug}"

DISPLAY_NAME = APP_NAME
PROJECT_DIR = "ios-app"
APP_DIR = os.path.join(PROJECT_DIR, "WebApp")

print(f"=== iOS Orchestrator: '{APP_NAME}' ({BUNDLE_ID}) ===")
print(f"  URL: {WEBSITE_URL}")

if os.path.isdir(PROJECT_DIR):
    shutil.rmtree(PROJECT_DIR)
os.makedirs(APP_DIR, exist_ok=True)


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    print(f"  ✓ {path}")


# ─── Source files ─────────────────────────────────────────────

APP_DELEGATE = """import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = ViewController()
        window?.makeKeyAndVisible()
        return true
    }
}
"""

VIEW_CONTROLLER = f"""import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {{
    var webView: WKWebView!
    var offlineLabel: UILabel!

    override func loadView() {{
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let prefs = WKPreferences()
        prefs.javaScriptCanOpenWindowsAutomatically = true
        config.preferences = prefs

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = true
        view = webView
    }}

    override func viewDidLoad() {{
        super.viewDidLoad()
        view.backgroundColor = UIColor(hex: "{SPLASH_COLOR}")

        if let url = URL(string: "{WEBSITE_URL}") {{
            webView.load(URLRequest(url: url))
        }}

        offlineLabel = UILabel()
        offlineLabel.text = "{OFFLINE_MSG}"
        offlineLabel.textAlignment = .center
        offlineLabel.numberOfLines = 0
        offlineLabel.textColor = .white
        offlineLabel.backgroundColor = UIColor.black.withAlphaComponent(0.85)
        offlineLabel.isHidden = true
        offlineLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(offlineLabel)
        NSLayoutConstraint.activate([
            offlineLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            offlineLabel.topAnchor.constraint(equalTo: view.topAnchor),
            offlineLabel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }}

    override var preferredStatusBarStyle: UIStatusBarStyle {{ .lightContent }}

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {{
        offlineLabel.isHidden = false
    }}
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {{
        offlineLabel.isHidden = false
    }}
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {{
        offlineLabel.isHidden = true
    }}

    // Open target=_blank in same webview
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {{
        if navigationAction.targetFrame == nil {{
            webView.load(navigationAction.request)
        }}
        return nil
    }}
}}

extension UIColor {{
    convenience init(hex: String) {{
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") {{ s.removeFirst() }}
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        let r = CGFloat((v >> 16) & 0xFF) / 255
        let g = CGFloat((v >> 8) & 0xFF) / 255
        let b = CGFloat(v & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }}
}}
"""

INFO_PLIST = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key><string>en</string>
    <key>CFBundleDisplayName</key><string>{DISPLAY_NAME}</string>
    <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>1.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSRequiresIPhoneOS</key><true/>
    <key>UILaunchStoryboardName</key><string>LaunchScreen</string>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UIViewControllerBasedStatusBarAppearance</key><true/>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key><true/>
    </dict>
    <key>NSCameraUsageDescription</key><string>This app needs access to camera to upload photos.</string>
    <key>NSMicrophoneUsageDescription</key><string>This app needs access to microphone for media features.</string>
    <key>NSPhotoLibraryUsageDescription</key><string>This app needs access to photos for uploads.</string>
    <key>NSLocationWhenInUseUsageDescription</key><string>This app uses your location for relevant features.</string>
</dict>
</plist>
"""

LAUNCH_STORYBOARD = f"""<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="22155" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina6_1" orientation="portrait" appearance="light"/>
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="22131"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="414" height="896"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <viewLayoutGuide key="safeArea" id="6Tk-OE-BBY"/>
                        <color key="backgroundColor" red="{int(SPLASH_COLOR[1:3],16)/255:.4f}" green="{int(SPLASH_COLOR[3:5],16)/255:.4f}" blue="{int(SPLASH_COLOR[5:7],16)/255:.4f}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
        </scene>
    </scenes>
</document>
"""

write(os.path.join(APP_DIR, "AppDelegate.swift"), APP_DELEGATE)
write(os.path.join(APP_DIR, "ViewController.swift"), VIEW_CONTROLLER)
write(os.path.join(APP_DIR, "Info.plist"), INFO_PLIST)
write(os.path.join(APP_DIR, "Base.lproj", "LaunchScreen.storyboard"), LAUNCH_STORYBOARD)


# ─── Generate Xcode .pbxproj ─────────────────────────────────
# Minimal hand-rolled project.pbxproj. Uses fixed UUIDs for clarity.

def u():
    return uuid.uuid4().hex[:24].upper()

UUIDS = {k: u() for k in [
    "main_group", "products_group", "app_group", "base_lproj_group",
    "app_target", "build_phase_sources", "build_phase_resources", "build_phase_frameworks",
    "app_product_ref", "app_delegate_ref", "view_controller_ref", "info_plist_ref",
    "launch_storyboard_ref", "launch_var_group",
    "app_delegate_build", "view_controller_build", "launch_storyboard_build",
    "project", "project_config_list", "target_config_list",
    "project_debug_cfg", "project_release_cfg",
    "target_debug_cfg", "target_release_cfg",
]}

PBXPROJ = f"""// !$*UTF8*$!
{{
    archiveVersion = 1;
    classes = {{}};
    objectVersion = 56;
    objects = {{

/* Begin PBXBuildFile section */
        {UUIDS['app_delegate_build']} /* AppDelegate.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {UUIDS['app_delegate_ref']} /* AppDelegate.swift */; }};
        {UUIDS['view_controller_build']} /* ViewController.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {UUIDS['view_controller_ref']} /* ViewController.swift */; }};
        {UUIDS['launch_storyboard_build']} /* LaunchScreen.storyboard in Resources */ = {{isa = PBXBuildFile; fileRef = {UUIDS['launch_var_group']} /* LaunchScreen.storyboard */; }};
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
        {UUIDS['app_product_ref']} /* WebApp.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = WebApp.app; sourceTree = BUILT_PRODUCTS_DIR; }};
        {UUIDS['app_delegate_ref']} /* AppDelegate.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; }};
        {UUIDS['view_controller_ref']} /* ViewController.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ViewController.swift; sourceTree = "<group>"; }};
        {UUIDS['info_plist_ref']} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }};
        {UUIDS['launch_storyboard_ref']} /* Base */ = {{isa = PBXFileReference; lastKnownFileType = file.storyboard; name = Base; path = Base.lproj/LaunchScreen.storyboard; sourceTree = "<group>"; }};
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
        {UUIDS['build_phase_frameworks']} /* Frameworks */ = {{
            isa = PBXFrameworksBuildPhase;
            buildActionMask = 2147483647;
            files = ();
            runOnlyForDeploymentPostprocessing = 0;
        }};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
        {UUIDS['main_group']} = {{
            isa = PBXGroup;
            children = (
                {UUIDS['app_group']} /* WebApp */,
                {UUIDS['products_group']} /* Products */,
            );
            sourceTree = "<group>";
        }};
        {UUIDS['products_group']} /* Products */ = {{
            isa = PBXGroup;
            children = (
                {UUIDS['app_product_ref']} /* WebApp.app */,
            );
            name = Products;
            sourceTree = "<group>";
        }};
        {UUIDS['app_group']} /* WebApp */ = {{
            isa = PBXGroup;
            children = (
                {UUIDS['app_delegate_ref']} /* AppDelegate.swift */,
                {UUIDS['view_controller_ref']} /* ViewController.swift */,
                {UUIDS['launch_var_group']} /* LaunchScreen.storyboard */,
                {UUIDS['info_plist_ref']} /* Info.plist */,
            );
            path = WebApp;
            sourceTree = "<group>";
        }};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
        {UUIDS['app_target']} /* WebApp */ = {{
            isa = PBXNativeTarget;
            buildConfigurationList = {UUIDS['target_config_list']} /* Build configuration list for PBXNativeTarget "WebApp" */;
            buildPhases = (
                {UUIDS['build_phase_sources']} /* Sources */,
                {UUIDS['build_phase_frameworks']} /* Frameworks */,
                {UUIDS['build_phase_resources']} /* Resources */,
            );
            buildRules = ();
            dependencies = ();
            name = WebApp;
            productName = WebApp;
            productReference = {UUIDS['app_product_ref']} /* WebApp.app */;
            productType = "com.apple.product-type.application";
        }};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
        {UUIDS['project']} /* Project object */ = {{
            isa = PBXProject;
            attributes = {{
                LastSwiftUpdateCheck = 1500;
                LastUpgradeCheck = 1500;
                TargetAttributes = {{
                    {UUIDS['app_target']} = {{ CreatedOnToolsVersion = 15.0; }};
                }};
            }};
            buildConfigurationList = {UUIDS['project_config_list']} /* Build configuration list for PBXProject "WebApp" */;
            compatibilityVersion = "Xcode 14.0";
            developmentRegion = en;
            hasScannedForEncodings = 0;
            knownRegions = ( en, Base, );
            mainGroup = {UUIDS['main_group']};
            productRefGroup = {UUIDS['products_group']} /* Products */;
            projectDirPath = "";
            projectRoot = "";
            targets = ( {UUIDS['app_target']} /* WebApp */, );
        }};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
        {UUIDS['build_phase_resources']} /* Resources */ = {{
            isa = PBXResourcesBuildPhase;
            buildActionMask = 2147483647;
            files = (
                {UUIDS['launch_storyboard_build']} /* LaunchScreen.storyboard in Resources */,
            );
            runOnlyForDeploymentPostprocessing = 0;
        }};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
        {UUIDS['build_phase_sources']} /* Sources */ = {{
            isa = PBXSourcesBuildPhase;
            buildActionMask = 2147483647;
            files = (
                {UUIDS['app_delegate_build']} /* AppDelegate.swift in Sources */,
                {UUIDS['view_controller_build']} /* ViewController.swift in Sources */,
            );
            runOnlyForDeploymentPostprocessing = 0;
        }};
/* End PBXSourcesBuildPhase section */

/* Begin PBXVariantGroup section */
        {UUIDS['launch_var_group']} /* LaunchScreen.storyboard */ = {{
            isa = PBXVariantGroup;
            children = (
                {UUIDS['launch_storyboard_ref']} /* Base */,
            );
            name = LaunchScreen.storyboard;
            sourceTree = "<group>";
        }};
/* End PBXVariantGroup section */

/* Begin XCBuildConfiguration section */
        {UUIDS['project_debug_cfg']} /* Debug */ = {{
            isa = XCBuildConfiguration;
            buildSettings = {{
                ALWAYS_SEARCH_USER_PATHS = NO;
                CLANG_ENABLE_MODULES = YES;
                CLANG_ENABLE_OBJC_ARC = YES;
                IPHONEOS_DEPLOYMENT_TARGET = 13.0;
                ONLY_ACTIVE_ARCH = YES;
                SDKROOT = iphoneos;
                SWIFT_VERSION = 5.0;
                TARGETED_DEVICE_FAMILY = "1,2";
                ENABLE_BITCODE = NO;
            }};
            name = Debug;
        }};
        {UUIDS['project_release_cfg']} /* Release */ = {{
            isa = XCBuildConfiguration;
            buildSettings = {{
                ALWAYS_SEARCH_USER_PATHS = NO;
                CLANG_ENABLE_MODULES = YES;
                CLANG_ENABLE_OBJC_ARC = YES;
                IPHONEOS_DEPLOYMENT_TARGET = 13.0;
                SDKROOT = iphoneos;
                SWIFT_VERSION = 5.0;
                TARGETED_DEVICE_FAMILY = "1,2";
                ENABLE_BITCODE = NO;
                VALIDATE_PRODUCT = YES;
            }};
            name = Release;
        }};
        {UUIDS['target_debug_cfg']} /* Debug */ = {{
            isa = XCBuildConfiguration;
            buildSettings = {{
                ASSETCATALOG_COMPILER_APPICON_NAME = "";
                CODE_SIGN_STYLE = Manual;
                CODE_SIGN_IDENTITY = "";
                CODE_SIGNING_REQUIRED = NO;
                CODE_SIGNING_ALLOWED = NO;
                INFOPLIST_FILE = WebApp/Info.plist;
                LD_RUNPATH_SEARCH_PATHS = ( "$(inherited)", "@executable_path/Frameworks", );
                PRODUCT_BUNDLE_IDENTIFIER = "{BUNDLE_ID}";
                PRODUCT_NAME = "$(TARGET_NAME)";
                SWIFT_VERSION = 5.0;
                TARGETED_DEVICE_FAMILY = "1,2";
            }};
            name = Debug;
        }};
        {UUIDS['target_release_cfg']} /* Release */ = {{
            isa = XCBuildConfiguration;
            buildSettings = {{
                ASSETCATALOG_COMPILER_APPICON_NAME = "";
                CODE_SIGN_STYLE = Manual;
                CODE_SIGN_IDENTITY = "";
                CODE_SIGNING_REQUIRED = NO;
                CODE_SIGNING_ALLOWED = NO;
                INFOPLIST_FILE = WebApp/Info.plist;
                LD_RUNPATH_SEARCH_PATHS = ( "$(inherited)", "@executable_path/Frameworks", );
                PRODUCT_BUNDLE_IDENTIFIER = "{BUNDLE_ID}";
                PRODUCT_NAME = "$(TARGET_NAME)";
                SWIFT_VERSION = 5.0;
                TARGETED_DEVICE_FAMILY = "1,2";
            }};
            name = Release;
        }};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
        {UUIDS['project_config_list']} /* Build configuration list for PBXProject "WebApp" */ = {{
            isa = XCConfigurationList;
            buildConfigurations = (
                {UUIDS['project_debug_cfg']} /* Debug */,
                {UUIDS['project_release_cfg']} /* Release */,
            );
            defaultConfigurationIsVisible = 0;
            defaultConfigurationName = Release;
        }};
        {UUIDS['target_config_list']} /* Build configuration list for PBXNativeTarget "WebApp" */ = {{
            isa = XCConfigurationList;
            buildConfigurations = (
                {UUIDS['target_debug_cfg']} /* Debug */,
                {UUIDS['target_release_cfg']} /* Release */,
            );
            defaultConfigurationIsVisible = 0;
            defaultConfigurationName = Release;
        }};
/* End XCConfigurationList section */

    }};
    rootObject = {UUIDS['project']} /* Project object */;
}}
"""

xcodeproj_dir = os.path.join(PROJECT_DIR, "WebApp.xcodeproj")
os.makedirs(xcodeproj_dir, exist_ok=True)
write(os.path.join(xcodeproj_dir, "project.pbxproj"), PBXPROJ)

# Workspace + scheme so xcodebuild can find the "WebApp" scheme
SCHEME = f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1500" version="1.7">
   <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
      <BuildActionEntries>
         <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">
            <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{UUIDS['app_target']}" BuildableName="WebApp.app" BlueprintName="WebApp" ReferencedContainer="container:WebApp.xcodeproj"/>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <LaunchAction buildConfiguration="Release" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"/>
   <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
"""
write(os.path.join(xcodeproj_dir, "xcshareddata", "xcschemes", "WebApp.xcscheme"), SCHEME)

print("\n✅ iOS project generated at ios-app/")
