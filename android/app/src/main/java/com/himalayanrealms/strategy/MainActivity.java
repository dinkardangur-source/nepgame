package com.himalayanrealms.strategy;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String AUTH_SCHEME = "com.himalayanrealms.strategy";
    private volatile String pendingAuthCallbackUrl = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebViewBridge();
        captureAuthIntent(getIntent(), false);
        enableImmersiveFullscreen();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureAuthIntent(intent, true);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveFullscreen();
        }
    }

    private void configureWebViewBridge() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        webView.addJavascriptInterface(new AndroidAuthBridge(), "AndroidAuthBridge");
    }

    private void captureAuthIntent(Intent intent, boolean dispatchImmediately) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null || !AUTH_SCHEME.equals(data.getScheme())) return;
        final String callbackUrl = data.toString();
        pendingAuthCallbackUrl = callbackUrl;
        if (dispatchImmediately && getBridge() != null && getBridge().getWebView() != null) {
            final WebView webView = getBridge().getWebView();
            webView.post(() -> {
                String js = "window.dispatchEvent(new CustomEvent('erot-native-auth-callback',{detail:{url:"
                    + JSONObject.quote(callbackUrl) + "}}));";
                webView.evaluateJavascript(js, null);
            });
        }
    }

    private class AndroidAuthBridge {
        @JavascriptInterface
        public void openExternalBrowser(String url) {
            if (url == null || url.trim().isEmpty()) return;
            runOnUiThread(() -> {
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                    startActivity(browserIntent);
                } catch (Exception ignored) {
                    // Ignore if no browser activity handles the URL
                }
            });
        }

        @JavascriptInterface
        public String consumePendingAuthUrl() {
            String current = pendingAuthCallbackUrl;
            pendingAuthCallbackUrl = null;
            return current != null ? current : "";
        }
    }

    private void enableImmersiveFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }
    }
}
