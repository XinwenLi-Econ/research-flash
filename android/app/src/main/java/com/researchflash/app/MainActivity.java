package com.researchflash.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 在 super.onCreate 之前配置全局 Cookie 设置
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);

        // 允许第三方 Cookie（Android 5.0+）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.flush();
        }

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        configureWebView();
    }

    private void configureWebView() {
        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        // 配置 Cookie
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // 配置 WebView 设置
        WebSettings settings = webView.getSettings();

        // 网络相关设置
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setBlockNetworkLoads(false);
        settings.setBlockNetworkImage(false);
        settings.setLoadsImagesAutomatically(true);

        // 存储相关设置
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        // JavaScript 和缓存
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // 允许文件访问
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // User Agent（使用 Chrome 的 UA，避免被服务器拦截）
        String userAgent = settings.getUserAgentString();
        if (!userAgent.contains("Chrome")) {
            settings.setUserAgentString(userAgent + " Chrome/120.0.0.0 Mobile");
        }
    }
}
