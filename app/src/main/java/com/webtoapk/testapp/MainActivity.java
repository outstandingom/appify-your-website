package com.webtoapk.testapp;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;


public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ValueCallback<Uri[]> fileUploadCallback;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private PermissionRequest pendingWebPermissionRequest;
    private Uri cameraImageUri;

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int CAMERA_PERMISSION_FOR_UPLOAD = 2001;
    private static final int LOCATION_PERMISSION_CODE = 2002;
    private static final int WEB_CAMERA_PERMISSION_CODE = 2003;
    private static final int NOTIFICATION_PERMISSION_CODE = 3001;
    private static final int ALL_PERMISSIONS_CODE = 4001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        swipeRefresh = findViewById(R.id.swipe_refresh);

        setupCookies();
        requestAllPermissions();
        setupWebViewSettings();
        setupWebChromeClient();
        setupWebViewClient();

        swipeRefresh.setColorSchemeColors(0xFF10B981);
        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        setupAdMob();

        if (isOnline()) {
            webView.loadUrl("https://example.com");
        } else {
            loadOfflinePage();
        }
    }

    // ═══════════════════════════════
    // PERMISSIONS MODULE
    // ═══════════════════════════════
    private void requestAllPermissions() {
        java.util.List<String> permsNeeded = new java.util.ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION);
            permsNeeded.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permsNeeded.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permsNeeded.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            permsNeeded.add(Manifest.permission.CALL_PHONE);
        }

        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, "android.permission.READ_MEDIA_IMAGES") != PackageManager.PERMISSION_GRANTED) {
                permsNeeded.add("android.permission.READ_MEDIA_IMAGES");
                permsNeeded.add("android.permission.READ_MEDIA_VIDEO");
                permsNeeded.add("android.permission.READ_MEDIA_AUDIO");
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permsNeeded.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        if (!permsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this, permsNeeded.toArray(new String[0]), ALL_PERMISSIONS_CODE);
        }
    }

    // ═══════════════════════════════
    // COOKIE MODULE
    // ═══════════════════════════════
    private void setupCookies() {
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
        cookieManager.flush();
    }

    // ═══════════════════════════════
    // WEBVIEW SETTINGS MODULE
    // ═══════════════════════════════
    private void setupWebViewSettings() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setGeolocationEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " Test AppApp/1.0");
    }

    // ═══════════════════════════════
    // WEBCHROME CLIENT MODULE
    // ═══════════════════════════════
    private void setupWebChromeClient() {
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = callback;

                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_FOR_UPLOAD);
                    return true;
                }
                launchFileChooser();
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    String[] resources = request.getResources();
                    boolean needsCamera = false;
                    boolean needsMic = false;
                    for (String r : resources) {
                        if (r.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) needsCamera = true;
                        if (r.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) needsMic = true;
                    }

                    java.util.List<String> nativePerms = new java.util.ArrayList<>();
                    if (needsCamera && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                        nativePerms.add(Manifest.permission.CAMERA);
                    }
                    if (needsMic && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        nativePerms.add(Manifest.permission.RECORD_AUDIO);
                    }

                    if (!nativePerms.isEmpty()) {
                        pendingWebPermissionRequest = request;
                        ActivityCompat.requestPermissions(MainActivity.this, nativePerms.toArray(new String[0]), WEB_CAMERA_PERMISSION_CODE);
                    } else {
                        request.grant(resources);
                    }
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    geoOrigin = origin;
                    geoCallback = callback;
                    ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                        LOCATION_PERMISSION_CODE);
                }
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress >= 100) {
                    swipeRefresh.setRefreshing(false);
                }
            }
        });
    }

    // ═══════════════════════════════
    // FILE CHOOSER MODULE
    // ═══════════════════════════════
    private void launchFileChooser() {
        Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
            try {
                java.io.File photoFile = new java.io.File(getExternalCacheDir(), "camera_" + System.currentTimeMillis() + ".jpg");
                cameraImageUri = androidx.core.content.FileProvider.getUriForFile(this, "com.webtoapk.testapp.fileprovider", photoFile);
                takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
                takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Exception e) {
                takePictureIntent = null;
            }
        } else {
            takePictureIntent = null;
        }

        Intent pickIntent = new Intent(Intent.ACTION_GET_CONTENT);
        pickIntent.setType("*/*");
        pickIntent.addCategory(Intent.CATEGORY_OPENABLE);
        pickIntent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*", "audio/*", "application/pdf", "*/*"});

        Intent chooserIntent = Intent.createChooser(pickIntent, "Select File");
        if (takePictureIntent != null) {
            chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{takePictureIntent});
        }
        try {
            startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST);
        } catch (Exception e) {
            if (fileUploadCallback != null) {
                fileUploadCallback.onReceiveValue(null);
                fileUploadCallback = null;
            }
            Toast.makeText(this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
        }
    }

    // ═══════════════════════════════
    // WEBVIEW CLIENT / OFFLINE MODULE
    // ═══════════════════════════════
    private void setupWebViewClient() {
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefresh.setRefreshing(false);
                CookieManager.getInstance().flush();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                if (url.startsWith("tel:")) {
                    try {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) {
                            startActivity(new Intent(Intent.ACTION_CALL, Uri.parse(url)));
                        } else {
                            startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse(url)));
                        }
                    } catch (Exception e) { /* ignore */ }
                    return true;
                }

                if (url.startsWith("mailto:") || url.startsWith("sms:") || url.startsWith("whatsapp:") || url.startsWith("intent:") || url.startsWith("geo:")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e) { /* ignore */ }
                    return true;
                }

                if (url.startsWith("market:") || url.contains("play.google.com/store")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e) { /* ignore */ }
                    return true;
                }

                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    loadOfflinePage();
                }
            }
        });
    }

    private void loadOfflinePage() {
        boolean offlineEnabled = true;
        if (offlineEnabled) {
            webView.loadUrl("file:///android_asset/offline.html");
        } else {
            webView.loadData(
                "<html><body style='display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;'>" +
                "<div style='text-align:center'><h2>No Internet</h2><p>Please check your connection</p>" +
                "<button onclick='location.reload()' style='padding:12px 24px;background:#10B981;color:white;border:none;border-radius:8px;font-size:16px;margin-top:16px;'>Retry</button></div></body></html>",
                "text/html", "UTF-8"
            );
        }
    }

    // ═══════════════════════════════
    // ADMOB MODULE
    // ═══════════════════════════════
    private void setupAdMob() {

    }

    // ═══════════════════════════════
    // NAVIGATION MODULE
    // ═══════════════════════════════
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // ═══════════════════════════════
    // CONNECTIVITY CHECK
    // ═══════════════════════════════
    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo netInfo = cm != null ? cm.getActiveNetworkInfo() : null;
        return netInfo != null && netInfo.isConnected();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileUploadCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK) {
                    if (data != null && data.getDataString() != null) {
                        results = new Uri[]{Uri.parse(data.getDataString())};
                    } else if (cameraImageUri != null) {
                        results = new Uri[]{cameraImageUri};
                    }
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        switch (requestCode) {
            case CAMERA_PERMISSION_FOR_UPLOAD:
                launchFileChooser();
                break;
            case LOCATION_PERMISSION_CODE:
                if (geoCallback != null) {
                    geoCallback.invoke(geoOrigin, granted, false);
                    geoCallback = null;
                    geoOrigin = null;
                }
                break;
            case WEB_CAMERA_PERMISSION_CODE:
                if (pendingWebPermissionRequest != null) {
                    if (granted) {
                        pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
                    } else {
                        pendingWebPermissionRequest.deny();
                    }
                    pendingWebPermissionRequest = null;
                }
                break;
            case NOTIFICATION_PERMISSION_CODE:
            case ALL_PERMISSIONS_CODE:
                break;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
