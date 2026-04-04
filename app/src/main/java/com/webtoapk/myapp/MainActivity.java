package com.webtoapk.myapp;

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


public class MainActivity extends AppCompatActivity {
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
    protected void onCreate(Bundle savedInstanceState) {
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

        if (isOnline()) {
            webView.loadUrl("https://example.com");
        } else {
            loadOfflinePage();
        }
    }

    private boolean isPermissionGranted(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {
        return isPermissionGranted(Manifest.permission.ACCESS_FINE_LOCATION)
            || isPermissionGranted(Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    private boolean areAllPermissionsGranted(int[] grantResults) {
        if (grantResults.length == 0) {
            return false;
        }
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    private boolean canGrantWebPermissionRequest(PermissionRequest request) {
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && !isPermissionGranted(Manifest.permission.CAMERA)) {
                return false;
            }
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && !isPermissionGranted(Manifest.permission.RECORD_AUDIO)) {
                return false;
            }
        }
        return true;
    }

    private void clearFileUploadCallback() {
        if (fileUploadCallback != null) {
            fileUploadCallback.onReceiveValue(null);
            fileUploadCallback = null;
        }
        pendingFileChooserParams = null;
        cameraImageUri = null;
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
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDatabaseEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setGeolocationEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " MyAppApp/1.0");
    }

    // ═══════════════════════════════
    // WEBCHROME CLIENT MODULE
    // ═══════════════════════════════
    private void setupWebChromeClient() {
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                clearFileUploadCallback();
                fileUploadCallback = callback;
                pendingFileChooserParams = params;

                if (params != null && params.isCaptureEnabled() && !isPermissionGranted(Manifest.permission.CAMERA)) {
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
                    List<String> nativePerms = new ArrayList<>();

                    for (String resource : resources) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) && !isPermissionGranted(Manifest.permission.CAMERA)) {
                            nativePerms.add(Manifest.permission.CAMERA);
                        }
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) && !isPermissionGranted(Manifest.permission.RECORD_AUDIO)) {
                            nativePerms.add(Manifest.permission.RECORD_AUDIO);
                        }
                    }

                    if (!nativePerms.isEmpty()) {
                        pendingWebPermissionRequest = request;
                        ActivityCompat.requestPermissions(MainActivity.this, nativePerms.toArray(new String[0]), WEB_CAMERA_PERMISSION_CODE);
                    } else if (canGrantWebPermissionRequest(request)) {
                        request.grant(resources);
                    } else {
                        request.deny();
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingWebPermissionRequest == request) {
                    pendingWebPermissionRequest = null;
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
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
    private String[] getAcceptedMimeTypes() {
        if (pendingFileChooserParams == null || pendingFileChooserParams.getAcceptTypes() == null) {
            return new String[]{"*/*"};
        }

        List<String> mimeTypes = new ArrayList<>();
        for (String type : pendingFileChooserParams.getAcceptTypes()) {
            if (type == null) {
                continue;
            }
            String trimmed = type.trim();
            if (!trimmed.isEmpty()) {
                mimeTypes.add(trimmed);
            }
        }

        if (mimeTypes.isEmpty()) {
            mimeTypes.add("*/*");
        }

        return mimeTypes.toArray(new String[0]);
    }

    private Intent buildCameraIntent() {
        if (!isPermissionGranted(Manifest.permission.CAMERA)) {
            return null;
        }

        Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (takePictureIntent.resolveActivity(getPackageManager()) == null) {
            return null;
        }

        try {
            File captureDir = new File(getExternalFilesDir(null), "capture");
            if (!captureDir.exists() && !captureDir.mkdirs()) {
                return null;
            }

            File photoFile = File.createTempFile("camera_", ".jpg", captureDir);
            cameraImageUri = FileProvider.getUriForFile(this, "com.webtoapk.myapp.fileprovider", photoFile);
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
            takePictureIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return takePictureIntent;
        } catch (IOException e) {
            cameraImageUri = null;
            return null;
        }
    }

    private void launchFileChooser() {
        Intent pickIntent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        pickIntent.setType("*/*");
        pickIntent.addCategory(Intent.CATEGORY_OPENABLE);
        pickIntent.putExtra(Intent.EXTRA_MIME_TYPES, getAcceptedMimeTypes());
        pickIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
            pendingFileChooserParams != null && pendingFileChooserParams.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
        pickIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        List<Intent> extraIntents = new ArrayList<>();
        Intent takePictureIntent = buildCameraIntent();
        if (takePictureIntent != null) {
            extraIntents.add(takePictureIntent);
        }

        Intent chooserIntent = Intent.createChooser(pickIntent, "Select File");
        chooserIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        chooserIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if (!extraIntents.isEmpty()) {
            chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toArray(new Intent[0]));
        }

        try {
            startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST);
        } catch (Exception e) {
            clearFileUploadCallback();
            Toast.makeText(this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
        }
    }

    private Uri[] extractSelectedFiles(Intent data) {
        if (data == null) {
            return cameraImageUri != null ? new Uri[]{cameraImageUri} : null;
        }

        ClipData clipData = data.getClipData();
        if (clipData != null && clipData.getItemCount() > 0) {
            Uri[] results = new Uri[clipData.getItemCount()];
            for (int i = 0; i < clipData.getItemCount(); i++) {
                results[i] = clipData.getItemAt(i).getUri();
            }
            return results;
        }

        Uri singleUri = data.getData();
        if (singleUri != null) {
            return new Uri[]{singleUri};
        }

        return cameraImageUri != null ? new Uri[]{cameraImageUri} : null;
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
        boolean offlineEnabled = false;
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
        if (requestCode == FILE_CHOOSER_REQUEST && fileUploadCallback != null) {
            Uri[] results = resultCode == Activity.RESULT_OK ? extractSelectedFiles(data) : null;
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
            pendingFileChooserParams = null;
            cameraImageUri = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        switch (requestCode) {
            case CAMERA_PERMISSION_FOR_UPLOAD:
                if (areAllPermissionsGranted(grantResults)) {
                    launchFileChooser();
                } else {
                    clearFileUploadCallback();
                    Toast.makeText(this, "Camera permission is required to capture photos", Toast.LENGTH_SHORT).show();
                }
                break;
            case LOCATION_PERMISSION_CODE:
                if (geoCallback != null) {
                    geoCallback.invoke(geoOrigin, hasLocationPermission(), false);
                    geoCallback = null;
                    geoOrigin = null;
                }
                break;
            case WEB_CAMERA_PERMISSION_CODE:
                if (pendingWebPermissionRequest != null) {
                    if (canGrantWebPermissionRequest(pendingWebPermissionRequest)) {
                        pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
                    } else {
                        pendingWebPermissionRequest.deny();
                    }
                    pendingWebPermissionRequest = null;
                }
                break;
            case NOTIFICATION_PERMISSION_CODE:
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
