#!/usr/bin/env python3
"""
Modular Android App Builder Orchestrator
Generates a complete Android project from a JSON config.
"""

import json
import os
import sys
import subprocess
import urllib.request
import shutil

# ═══════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════

config = json.loads(os.environ.get("APP_CONFIG", "{}"))

APP_NAME = config.get("app_name", "MyApp")
WEBSITE_URL = config.get("website_url", "https://example.com")
ICON_URL = config.get("icon_url", "")
SPLASH_COLOR = config.get("splash_color", "#10B981")
STATUS_BAR_COLOR = config.get("status_bar_color", "#000000")
ENABLE_PUSH = config.get("enable_push", False)
ENABLE_OFFLINE = config.get("enable_offline", False)
OFFLINE_MSG = config.get("offline_message", "You are offline. Please check your connection.")
ENABLE_ANALYTICS = config.get("enable_analytics", False)
ENABLE_COOKIES = config.get("enable_cookies", True)
ENABLE_ADMOB = config.get("enable_admob", False)
ADMOB_BANNER = config.get("admob_banner_id", "")
ADMOB_INTERSTITIAL = config.get("admob_interstitial_id", "")
BUILD_AAB = config.get("build_aab", False)

# Proxy / custom IP (Pro)
PROXY_ENABLED = bool(config.get("proxy_enabled", False))
PROXY_TYPE = (config.get("proxy_type") or "http").lower()
PROXY_HOST = (config.get("proxy_host") or "").strip()
PROXY_PORT = config.get("proxy_port")
PROXY_USER = config.get("proxy_username") or ""
PROXY_PASS = config.get("proxy_password") or ""
PROXY_ACTIVE = PROXY_ENABLED and PROXY_HOST and PROXY_PORT
def _java_str(s):
    return (s or "").replace("\\", "\\\\").replace("\"", "\\\"")

# Package name
custom_pkg = config.get("package_name", "")
if custom_pkg:
    PACKAGE_NAME = custom_pkg
else:
    slug = "".join(c for c in APP_NAME.lower() if c.isalnum())[:30]
    PACKAGE_NAME = f"com.webtoapk.{slug}"

PACKAGE_PATH = PACKAGE_NAME.replace(".", "/")

print(f"=== Orchestrator: Building '{APP_NAME}' ({PACKAGE_NAME}) ===")
print(f"  URL: {WEBSITE_URL}")
print(f"  Features: push={ENABLE_PUSH}, offline={ENABLE_OFFLINE}, admob={ENABLE_ADMOB}, cookies={ENABLE_COOKIES}")


def write_file(path, content):
    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    print(f"  ✓ {path}")


# ═══════════════════════════════════════════════════════════════
# MODULE A: Project Structure & Gradle
# ═══════════════════════════════════════════════════════════════

def module_a_project_setup():
    print("\n── Module A: Project Structure ──")

    cleanup_paths = [
        "app/src/main/java",
    ]
    for path in cleanup_paths:
        if os.path.isdir(path):
            shutil.rmtree(path)
            print(f"  ✓ cleaned {path}")

    if not BUILD_AAB and os.path.exists(".build_aab"):
        os.remove(".build_aab")
        print("  ✓ removed stale .build_aab flag")

    dirs = [
        f"app/src/main/java/{PACKAGE_PATH}",
        "app/src/main/res/values",
        "app/src/main/res/layout",
        "app/src/main/res/drawable",
        "app/src/main/res/xml",
        "app/src/main/res/mipmap-mdpi",
        "app/src/main/res/mipmap-hdpi",
        "app/src/main/res/mipmap-xhdpi",
        "app/src/main/res/mipmap-xxhdpi",
        "app/src/main/res/mipmap-xxxhdpi",
        "app/src/main/assets",
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    # settings.gradle
    write_file("settings.gradle", """pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "WebToAPK"
include ':app'
""")

    # root build.gradle
    write_file("build.gradle", """plugins {
    id 'com.android.application' version '8.2.0' apply false
}
""")

    # gradle.properties
    write_file("gradle.properties", """android.useAndroidX=true
org.gradle.jvmargs=-Xmx2048m
""")


# ═══════════════════════════════════════════════════════════════
# MODULE B: App build.gradle (The Gradle Fix)
# ═══════════════════════════════════════════════════════════════

def module_b_gradle():
    print("\n── Module B: App build.gradle ──")

    admob_dep = ""
    if ENABLE_ADMOB:
        admob_dep = "    implementation 'com.google.android.gms:play-services-ads:23.1.0'"

    write_file("app/build.gradle", f"""plugins {{
    id 'com.android.application'
}}

android {{
    namespace '{PACKAGE_NAME}'
    compileSdk 34

    defaultConfig {{
        applicationId "{PACKAGE_NAME}"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }}

    buildTypes {{
        release {{
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }}
        debug {{
            minifyEnabled false
        }}
    }}

    compileOptions {{
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }}

    // Fix: Prevent duplicate class errors between kotlin-stdlib variants
    configurations.all {{
        resolutionStrategy {{
            force 'org.jetbrains.kotlin:kotlin-stdlib:1.8.22'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22'
            force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22'
        }}
    }}
}}

dependencies {{
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.webkit:webkit:1.8.0'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
    implementation 'androidx.core:core:1.12.0'
{admob_dep}
}}
""")


# ═══════════════════════════════════════════════════════════════
# MODULE C: Manifest & Resources
# ═══════════════════════════════════════════════════════════════

def module_c_manifest():
    print("\n── Module C: Manifest & Resources ──")

    permissions = [
        '<uses-permission android:name="android.permission.INTERNET" />',
        '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
        # Camera
        '<uses-permission android:name="android.permission.CAMERA" />',
        '<uses-feature android:name="android.hardware.camera" android:required="false" />',
        # Location
        '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
        '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
        # Storage
        '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />',
        '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
        '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
        '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
        '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />',
        '<uses-permission android:name="android.permission.MANAGE_DOCUMENTS" />',
        # Microphone
        '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
        '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
        # Phone
        '<uses-permission android:name="android.permission.CALL_PHONE" />',
        '<uses-feature android:name="android.hardware.telephony" android:required="false" />',
        # Vibrate
        '<uses-permission android:name="android.permission.VIBRATE" />',
    ]

    if ENABLE_PUSH:
        permissions.append('<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />')
        permissions.append('<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />')

    perm_xml = "\n    ".join(permissions)

    admob_meta = ""
    if ENABLE_ADMOB:
        admob_meta = """
            <meta-data
                android:name="com.google.android.gms.ads.APPLICATION_ID"
                android:value="ca-app-pub-3940256099942544~3347511713" />"""

    write_file("app/src/main/AndroidManifest.xml", f"""<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    {perm_xml}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="{APP_NAME}"
        android:usesCleartextTraffic="true"
        android:theme="@style/AppTheme"
        android:networkSecurityConfig="@xml/network_security_config">
{admob_meta}

        <activity
            android:name=".SplashActivity"
            android:exported="true"
            android:theme="@style/SplashTheme">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity
            android:name=".MainActivity"
            android:exported="false"
            android:configChanges="orientation|screenSize|keyboard|keyboardHidden" />

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="{PACKAGE_NAME}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
""")

    # Network security config
    write_file("app/src/main/res/xml/network_security_config.xml", """<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
""")

    # File provider paths
    write_file("app/src/main/res/xml/file_paths.xml", """<?xml version="1.0" encoding="utf-8"?>
<paths>
    <cache-path name="cache" path="." />
    <files-path name="files" path="." />
    <external-cache-path name="external_cache" path="." />
    <external-files-path name="external_files" path="." />
    <external-path name="external" path="." />
</paths>
""")

    # colors.xml
    write_file("app/src/main/res/values/colors.xml", f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splash_color">{SPLASH_COLOR}</color>
    <color name="status_bar_color">{STATUS_BAR_COLOR}</color>
</resources>
""")

    # styles.xml
    write_file("app/src/main/res/values/styles.xml", f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowFullscreen">false</item>
        <item name="android:statusBarColor">{STATUS_BAR_COLOR}</item>
        <item name="android:navigationBarColor">{STATUS_BAR_COLOR}</item>
    </style>
    <style name="SplashTheme" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowBackground">@drawable/splash_background</item>
        <item name="android:statusBarColor">{SPLASH_COLOR}</item>
    </style>
</resources>
""")


# ═══════════════════════════════════════════════════════════════
# MODULE D: Icon & Splash Screen
# ═══════════════════════════════════════════════════════════════

def module_d_icon_splash():
    print("\n── Module D: Icon & Splash Screen ──")

    has_icon = False
    if ICON_URL and ICON_URL != "null":
        try:
            urllib.request.urlretrieve(ICON_URL, "/tmp/icon_original.png")
            if os.path.getsize("/tmp/icon_original.png") > 100:
                has_icon = True
                print("  ✓ Downloaded icon from URL")
        except Exception as e:
            print(f"  ⚠ Icon download failed: {e}")

    sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }

    if has_icon:
        for folder, size in sizes.items():
            out = f"app/src/main/res/{folder}/ic_launcher.png"
            subprocess.run([
                "convert", "/tmp/icon_original.png",
                "-resize", f"{size}x{size}!",
                "-background", "none", "-gravity", "center",
                "-extent", f"{size}x{size}", out
            ], check=True)
        # Splash logo
        subprocess.run([
            "convert", "/tmp/icon_original.png",
            "-resize", "288x288", "-background", "none",
            "-gravity", "center", "-extent", "288x288",
            "app/src/main/res/drawable/splash_logo.png"
        ], check=True)
        print("  ✓ Processed icon into all mipmap densities + splash logo")
    else:
        first_letter = APP_NAME[0].upper() if APP_NAME else "A"
        for folder, size in sizes.items():
            out = f"app/src/main/res/{folder}/ic_launcher.png"
            subprocess.run([
                "convert", "-size", f"{size}x{size}", f"xc:{SPLASH_COLOR}",
                "-fill", "white", "-gravity", "center",
                "-pointsize", str(size // 3), "-annotate", "0", first_letter,
                out
            ], check=True)
        print("  ✓ Generated default letter icon")

    # Splash drawable
    if has_icon:
        write_file("app/src/main/res/drawable/splash_background.xml", f"""<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="{SPLASH_COLOR}" />
        </shape>
    </item>
    <item android:gravity="center">
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_logo" />
    </item>
</layer-list>
""")
    else:
        write_file("app/src/main/res/drawable/splash_background.xml", f"""<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="{SPLASH_COLOR}" />
        </shape>
    </item>
</layer-list>
""")


# ═══════════════════════════════════════════════════════════════
# MODULE E: Layouts
# ═══════════════════════════════════════════════════════════════

def module_e_layouts():
    print("\n── Module E: Layouts ──")

    if ENABLE_ADMOB and ADMOB_BANNER:
        write_file("app/src/main/res/layout/activity_main.xml", f"""<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:ads="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">
    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipe_refresh"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1">
        <WebView
            android:id="@+id/webview"
            android:layout_width="match_parent"
            android:layout_height="match_parent" />
    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
    <com.google.android.gms.ads.AdView
        android:id="@+id/adView"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        ads:adSize="BANNER"
        ads:adUnitId="{ADMOB_BANNER}" />
</LinearLayout>
""")
    else:
        write_file("app/src/main/res/layout/activity_main.xml", """<?xml version="1.0" encoding="utf-8"?>
<androidx.swiperefreshlayout.widget.SwipeRefreshLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/swipe_refresh"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
""")


# ═══════════════════════════════════════════════════════════════
# MODULE F: Offline Page
# ═══════════════════════════════════════════════════════════════

def module_f_offline():
    print("\n── Module F: Offline Page ──")
    if not ENABLE_OFFLINE:
        print("  (skipped — offline not enabled)")
        return

    write_file("app/src/main/assets/offline.html", f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #f8f9fa; color: #1a1a2e;
      text-align: center; padding: 24px;
    }}
    .icon {{ font-size: 64px; margin-bottom: 24px; }}
    h1 {{ font-size: 22px; margin-bottom: 8px; font-weight: 700; }}
    p {{ color: #6c757d; font-size: 15px; line-height: 1.5; max-width: 300px; margin: 0 auto 24px; }}
    button {{
      padding: 14px 32px; background: {SPLASH_COLOR}; color: white;
      border: none; border-radius: 12px; font-size: 16px; font-weight: 600;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }}
    button:active {{ transform: scale(0.97); }}
  </style>
</head>
<body>
  <div>
    <div class="icon">📡</div>
    <h1>No Internet Connection</h1>
    <p>{OFFLINE_MSG}</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
</body>
</html>
""")


# ═══════════════════════════════════════════════════════════════
# MODULE G: SplashActivity
# ═══════════════════════════════════════════════════════════════

def module_g_splash_activity():
    print("\n── Module G: SplashActivity ──")

    write_file(f"app/src/main/java/{PACKAGE_PATH}/SplashActivity.java", f"""package {PACKAGE_NAME};

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {{
    @Override
    protected void onCreate(Bundle savedInstanceState) {{
        super.onCreate(savedInstanceState);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {{
            startActivity(new Intent(SplashActivity.this, MainActivity.class));
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
            finish();
        }}, 2000);
    }}
}}
""")


# ═══════════════════════════════════════════════════════════════
# MODULE H: MainActivity (full-featured)
# ═══════════════════════════════════════════════════════════════

def module_h_main_activity():
    print("\n── Module H: MainActivity ──")

    admob_imports = ""
    if ENABLE_ADMOB and ADMOB_BANNER:
        admob_imports = """import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdView;"""

    admob_init = ""
    if ENABLE_ADMOB and ADMOB_BANNER:
        admob_init = """        MobileAds.initialize(this, initializationStatus -> {});
        AdView adView = findViewById(R.id.adView);
        if (adView != null) {
            AdRequest adRequest = new AdRequest.Builder().build();
            adView.loadAd(adRequest);
                }"""

    enable_offline_java = "true" if ENABLE_OFFLINE else "false"

    # ── Proxy (custom IP) injection ──
    proxy_imports = ""
    proxy_setup_call = ""
    proxy_method = "    private void setupProxy() { /* disabled */ }"
    proxy_auth_handler = ""
    if PROXY_ACTIVE:
        proxy_imports = """import androidx.webkit.ProxyConfig;
import androidx.webkit.ProxyController;
import androidx.webkit.WebViewFeature;
import java.util.concurrent.Executors;
import android.webkit.HttpAuthHandler;"""
        proxy_setup_call = "        setupProxy();"
        proxy_host_j = _java_str(PROXY_HOST)
        proxy_user_j = _java_str(PROXY_USER)
        proxy_pass_j = _java_str(PROXY_PASS)
        proxy_scheme = "https" if PROXY_TYPE == "https" else "http"
        # Android WebView ProxyController only supports HTTP/HTTPS proxies.
        # For SOCKS5 we still register the host as HTTP so user is alerted via build
        # log; recommend HTTP/HTTPS proxy on the UI.
        proxy_method = f"""    private void setupProxy() {{
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) {{
            android.util.Log.w("Proxy", "WebView proxy override unsupported on this device");
            return;
        }}
        try {{
            ProxyConfig proxyConfig = new ProxyConfig.Builder()
                .addProxyRule("{proxy_scheme}://{proxy_host_j}:{PROXY_PORT}")
                .addDirect()
                .build();
            ProxyController.getInstance().setProxyOverride(
                proxyConfig,
                Executors.newSingleThreadExecutor(),
                () -> android.util.Log.i("Proxy", "Proxy active: {proxy_host_j}:{PROXY_PORT}")
            );
        }} catch (Exception e) {{
            android.util.Log.e("Proxy", "Failed to set proxy", e);
        }}
    }}"""
        if PROXY_USER or PROXY_PASS:
            proxy_auth_handler = f"""
            @Override
            public void onReceivedHttpAuthRequest(WebView view, HttpAuthHandler handler, String host, String realm) {{
                handler.proceed("{proxy_user_j}", "{proxy_pass_j}");
            }}
"""

    write_file(f"app/src/main/java/{PACKAGE_PATH}/MainActivity.java", f"""package {PACKAGE_NAME};

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
{admob_imports}
{proxy_imports}

public class MainActivity extends AppCompatActivity {{
    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ValueCallback<Uri[]> fileUploadCallback;
    private WebChromeClient.FileChooserParams pendingFileChooserParams;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private PermissionRequest pendingWebPermissionRequest;
    private Uri cameraImageUri;

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int CAMERA_PERMISSION_FOR_UPLOAD = 2001;
    private static final int LOCATION_PERMISSION_CODE = 2002;
    private static final int WEB_CAMERA_PERMISSION_CODE = 2003;
    private static final int NOTIFICATION_PERMISSION_CODE = 3001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {{
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        swipeRefresh = findViewById(R.id.swipe_refresh);

        setupCookies();
        setupWebViewSettings();
        setupWebChromeClient();
        setupWebViewClient();

        swipeRefresh.setColorSchemeColors(0xFF10B981);
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        setupAdMob();
{proxy_setup_call}

        if (isOnline()) {{
            webView.loadUrl("{WEBSITE_URL}");
        }} else {{
            loadOfflinePage();
        }}
    }}

    private boolean isPermissionGranted(String permission) {{
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }}

    private boolean hasLocationPermission() {{
        return isPermissionGranted(Manifest.permission.ACCESS_FINE_LOCATION)
            || isPermissionGranted(Manifest.permission.ACCESS_COARSE_LOCATION);
    }}

    private boolean areAllPermissionsGranted(int[] grantResults) {{
        if (grantResults.length == 0) {{
            return false;
        }}
        for (int result : grantResults) {{
            if (result != PackageManager.PERMISSION_GRANTED) {{
                return false;
            }}
        }}
        return true;
    }}

    private boolean canGrantWebPermissionRequest(PermissionRequest request) {{
        for (String resource : request.getResources()) {{
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && !isPermissionGranted(Manifest.permission.CAMERA)) {{
                return false;
            }}
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && !isPermissionGranted(Manifest.permission.RECORD_AUDIO)) {{
                return false;
            }}
        }}
        return true;
    }}

    private void clearFileUploadCallback() {{
        if (fileUploadCallback != null) {{
            fileUploadCallback.onReceiveValue(null);
            fileUploadCallback = null;
        }}
        pendingFileChooserParams = null;
        cameraImageUri = null;
    }}

    // ═══════════════════════════════
    // COOKIE MODULE
    // ═══════════════════════════════
    private void setupCookies() {{
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
        cookieManager.flush();
    }}

    // ═══════════════════════════════
    // WEBVIEW SETTINGS MODULE
    // ═══════════════════════════════
    private void setupWebViewSettings() {{
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setGeolocationEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " {APP_NAME}App/1.0");
    }}

    // ═══════════════════════════════
    // WEBCHROME CLIENT MODULE
    // ═══════════════════════════════
    private void setupWebChromeClient() {{
        webView.setWebChromeClient(new WebChromeClient() {{
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {{
                clearFileUploadCallback();
                fileUploadCallback = callback;
                pendingFileChooserParams = params;

                if (params != null && params.isCaptureEnabled() && !isPermissionGranted(Manifest.permission.CAMERA)) {{
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{{Manifest.permission.CAMERA}}, CAMERA_PERMISSION_FOR_UPLOAD);
                    return true;
                }}

                launchFileChooser();
                return true;
            }}

            @Override
            public void onPermissionRequest(final PermissionRequest request) {{
                runOnUiThread(() -> {{
                    String[] resources = request.getResources();
                    List<String> nativePerms = new ArrayList<>();

                    for (String resource : resources) {{
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && !isPermissionGranted(Manifest.permission.CAMERA)) {{
                            nativePerms.add(Manifest.permission.CAMERA);
                        }}
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && !isPermissionGranted(Manifest.permission.RECORD_AUDIO)) {{
                            nativePerms.add(Manifest.permission.RECORD_AUDIO);
                        }}
                    }}

                    if (!nativePerms.isEmpty()) {{
                        pendingWebPermissionRequest = request;
                        ActivityCompat.requestPermissions(MainActivity.this, nativePerms.toArray(new String[0]), WEB_CAMERA_PERMISSION_CODE);
                    }} else if (canGrantWebPermissionRequest(request)) {{
                        request.grant(resources);
                    }} else {{
                        request.deny();
                    }}
                }});
            }}

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {{
                if (pendingWebPermissionRequest == request) {{
                    pendingWebPermissionRequest = null;
                }}
            }}

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {{
                if (hasLocationPermission()) {{
                    callback.invoke(origin, true, false);
                }} else {{
                    geoOrigin = origin;
                    geoCallback = callback;
                    ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}},
                        LOCATION_PERMISSION_CODE);
                }}
            }}

            @Override
            public void onProgressChanged(WebView view, int newProgress) {{
                if (newProgress >= 100) {{
                    swipeRefresh.setRefreshing(false);
                }}
            }}
        }});
    }}

    // ═══════════════════════════════
    // FILE CHOOSER MODULE
    // ═══════════════════════════════
    private String[] getAcceptedMimeTypes() {{
        if (pendingFileChooserParams == null || pendingFileChooserParams.getAcceptTypes() == null) {{
            return new String[]{{"*/*"}};
        }}

        List<String> mimeTypes = new ArrayList<>();
        for (String type : pendingFileChooserParams.getAcceptTypes()) {{
            if (type == null) {{
                continue;
            }}
            String trimmed = type.trim();
            if (!trimmed.isEmpty()) {{
                mimeTypes.add(trimmed);
            }}
        }}

        if (mimeTypes.isEmpty()) {{
            mimeTypes.add("*/*");
        }}

        return mimeTypes.toArray(new String[0]);
    }}

    private Intent buildCameraIntent() {{
        if (!isPermissionGranted(Manifest.permission.CAMERA)) {{
            return null;
        }}

        Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (takePictureIntent.resolveActivity(getPackageManager()) == null) {{
            return null;
        }}

        try {{
            File captureDir = new File(getExternalFilesDir(null), "capture");
            if (!captureDir.exists() && !captureDir.mkdirs()) {{
                return null;
            }}

            File photoFile = File.createTempFile("camera_", ".jpg", captureDir);
            cameraImageUri = FileProvider.getUriForFile(this, "{PACKAGE_NAME}.fileprovider", photoFile);
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
            takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return takePictureIntent;
        }} catch (IOException e) {{
            cameraImageUri = null;
            return null;
        }}
    }}

    private void launchFileChooser() {{
        Intent pickIntent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        pickIntent.setType("*/*");
        pickIntent.addCategory(Intent.CATEGORY_OPENABLE);
        pickIntent.putExtra(Intent.EXTRA_MIME_TYPES, getAcceptedMimeTypes());
        pickIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
            pendingFileChooserParams != null && pendingFileChooserParams.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
        pickIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        List<Intent> extraIntents = new ArrayList<>();
        Intent takePictureIntent = buildCameraIntent();
        if (takePictureIntent != null) {{
            extraIntents.add(takePictureIntent);
        }}

        Intent chooserIntent = Intent.createChooser(pickIntent, "Select File");
        chooserIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        chooserIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if (!extraIntents.isEmpty()) {{
            chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toArray(new Intent[0]));
        }}

        try {{
            startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST);
        }} catch (Exception e) {{
            clearFileUploadCallback();
            Toast.makeText(this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
        }}
    }}

    private Uri[] extractSelectedFiles(Intent data) {{
        if (data == null) {{
            return cameraImageUri != null ? new Uri[]{{cameraImageUri}} : null;
        }}

        ClipData clipData = data.getClipData();
        if (clipData != null && clipData.getItemCount() > 0) {{
            Uri[] results = new Uri[clipData.getItemCount()];
            for (int i = 0; i < clipData.getItemCount(); i++) {{
                results[i] = clipData.getItemAt(i).getUri();
            }}
            return results;
        }}

        Uri singleUri = data.getData();
        if (singleUri != null) {{
            return new Uri[]{{singleUri}};
        }}

        return cameraImageUri != null ? new Uri[]{{cameraImageUri}} : null;
    }}

    // ═══════════════════════════════
    // WEBVIEW CLIENT / OFFLINE MODULE
    // ═══════════════════════════════
    private void setupWebViewClient() {{
        webView.setWebViewClient(new WebViewClient() {{
            @Override
            public void onPageFinished(WebView view, String url) {{
                super.onPageFinished(view, url);
                swipeRefresh.setRefreshing(false);
                CookieManager.getInstance().flush();
            }}

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {{
                String url = request.getUrl().toString();

                if (url.startsWith("tel:")) {{
                    try {{
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {{
                            startActivity(new Intent(Intent.ACTION_CALL, Uri.parse(url)));
                        }} else {{
                            startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse(url)));
                        }}
                    }} catch (Exception e) {{ /* ignore */ }}
                    return true;
                }}

                if (url.startsWith("mailto:") || url.startsWith("sms:") || url.startsWith("whatsapp:") || url.startsWith("intent:") || url.startsWith("geo:")) {{
                    try {{
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    }} catch (Exception e) {{ /* ignore */ }}
                    return true;
                }}

                if (url.startsWith("market:") || url.contains("play.google.com/store")) {{
                    try {{
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    }} catch (Exception e) {{ /* ignore */ }}
                    return true;
                }}

                return false;
            }}

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {{
                if (request.isForMainFrame()) {{
                    loadOfflinePage();
                }}
            }}
        }});
    }}

    private void loadOfflinePage() {{
        boolean offlineEnabled = {enable_offline_java};
        if (offlineEnabled) {{
            webView.loadUrl("file:///android_asset/offline.html");
        }} else {{
            webView.loadData(
                "<html><body style='display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;'>" +
                "<div style='text-align:center'><h2>No Internet</h2><p>Please check your connection</p>" +
                "<button onclick='location.reload()' style='padding:12px 24px;background:{SPLASH_COLOR};color:white;border:none;border-radius:8px;font-size:16px;margin-top:16px;'>Retry</button></div></body></html>",
                "text/html", "UTF-8"
            );
        }}
    }}

    // ═══════════════════════════════
    // ADMOB MODULE
    // ═══════════════════════════════
    private void setupAdMob() {{
{admob_init}
    }}

    // ═══════════════════════════════
    // NAVIGATION MODULE
    // ═══════════════════════════════
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {{
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {{
            webView.goBack();
            return true;
        }}
        return super.onKeyDown(keyCode, event);
    }}

    // ═══════════════════════════════
    // CONNECTIVITY CHECK
    // ═══════════════════════════════
    private boolean isOnline() {{
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo netInfo = cm != null ? cm.getActiveNetworkInfo() : null;
        return netInfo != null && netInfo.isConnected();
    }}

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {{
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileUploadCallback != null) {{
            Uri[] results = resultCode == Activity.RESULT_OK ? extractSelectedFiles(data) : null;
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
            pendingFileChooserParams = null;
            cameraImageUri = null;
        }}
    }}

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {{
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        switch (requestCode) {{
            case CAMERA_PERMISSION_FOR_UPLOAD:
                if (areAllPermissionsGranted(grantResults)) {{
                    launchFileChooser();
                }} else {{
                    clearFileUploadCallback();
                    Toast.makeText(this, "Camera permission is required to capture photos", Toast.LENGTH_SHORT).show();
                }}
                break;
            case LOCATION_PERMISSION_CODE:
                if (geoCallback != null) {{
                    geoCallback.invoke(geoOrigin, hasLocationPermission(), false);
                    geoCallback = null;
                    geoOrigin = null;
                }}
                break;
            case WEB_CAMERA_PERMISSION_CODE:
                if (pendingWebPermissionRequest != null) {{
                    if (canGrantWebPermissionRequest(pendingWebPermissionRequest)) {{
                        pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
                    }} else {{
                        pendingWebPermissionRequest.deny();
                    }}
                    pendingWebPermissionRequest = null;
                }}
                break;
            case NOTIFICATION_PERMISSION_CODE:
                break;
        }}
    }}

    @Override
    protected void onResume() {{
        super.onResume();
        CookieManager.getInstance().flush();
    }}

    @Override
    protected void onPause() {{
        super.onPause();
        CookieManager.getInstance().flush();
    }}
}}
""")


# ═══════════════════════════════════════════════════════════════
# MAIN: Run all modules
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  Android App Builder — Python Orchestrator")
    print("=" * 60)

    module_a_project_setup()
    module_b_gradle()
    module_c_manifest()
    module_d_icon_splash()
    module_e_layouts()
    module_f_offline()
    module_g_splash_activity()
    module_h_main_activity()

    # Write flag file for the workflow to detect build type
    if BUILD_AAB:
        with open(".build_aab", "w") as f:
            f.write("true")
        print("  ✓ .build_aab flag written (AAB build)")

    print("\n" + "=" * 60)
    print("  ✅ All modules complete. Ready for Gradle build.")
    print("=" * 60)
