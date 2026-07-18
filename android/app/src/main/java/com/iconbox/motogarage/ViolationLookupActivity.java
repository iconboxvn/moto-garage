package com.iconbox.motogarage;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class ViolationLookupActivity extends AppCompatActivity {

    private static final String URL = "https://csgt.bocongan.gov.vn/tra-cuu-phat-nguoi";

    private WebView webView;
    private ProgressBar progressBar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String plate = getIntent().getStringExtra("plate");
        if (plate == null) plate = "";
        final String plateJs = plate.replace("\\", "\\\\").replace("'", "\\'");

        String lang = getIntent().getStringExtra("lang");
        if (lang == null) lang = "ko";
        String titleText;
        String disclaimerText;
        switch (lang) {
            case "en":
                titleText = "Traffic Violation Check";
                disclaimerText = "⚠ You may need to log in with your own VNeTraffic account to see results";
                break;
            case "vn":
                titleText = "Tra cứu vi phạm giao thông";
                disclaimerText = "⚠ Bạn có thể cần đăng nhập bằng tài khoản VNeTraffic của chính mình để xem kết quả";
                break;
            default:
                titleText = "교통위반 조회";
                disclaimerText = "⚠ 결과 확인에는 본인 명의 VNeTraffic 계정 로그인이 필요할 수 있어요";
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0c0c0d"));
        root.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setBackgroundColor(Color.parseColor("#141517"));
        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        toolbar.setPadding(pad, pad, pad, pad);
        toolbar.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button closeBtn = new Button(this);
        closeBtn.setText("✕");
        closeBtn.setTextColor(Color.parseColor("#e8ecf0"));
        closeBtn.setBackgroundColor(Color.TRANSPARENT);
        closeBtn.setOnClickListener(v -> finish());
        toolbar.addView(closeBtn);

        TextView title = new TextView(this);
        title.setText(titleText);
        title.setTextColor(Color.parseColor("#e8ecf0"));
        title.setTextSize(16);
        title.setPadding(pad, 0, 0, 0);
        toolbar.addView(title);

        root.addView(toolbar);

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.statusBars());
            toolbar.setPadding(pad, pad + bars.top, pad, pad);
            return insets;
        });

        TextView disclaimer = new TextView(this);
        disclaimer.setText(disclaimerText);
        disclaimer.setTextColor(Color.parseColor("#e8a020"));
        disclaimer.setTextSize(11);
        disclaimer.setBackgroundColor(Color.parseColor("#1b1d20"));
        disclaimer.setPadding(pad, pad / 2, pad, pad / 2);
        root.addView(disclaimer);

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (int) (3 * getResources().getDisplayMetrics().density)));
        root.addView(progressBar);

        webView = new WebView(this);
        webView.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                if (scheme == null || (!scheme.equals("http") && !scheme.equals("https"))) {
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url != null && url.contains("tra-cuu-phat-nguoi") && !plateJs.isEmpty()) {
                    String js = "(function(){"
                        + "var tries=0;"
                        + "var timer=setInterval(function(){"
                        + "tries++;"
                        + "var p=document.getElementById('plate_number');"
                        + "var s=document.getElementById('vehicle_type');"
                        + "if(p && s){"
                        + "clearInterval(timer);"
                        + "p.value='" + plateJs + "';"
                        + "p.dispatchEvent(new Event('input',{bubbles:true}));"
                        + "p.dispatchEvent(new Event('change',{bubbles:true}));"
                        + "s.value='motorbike';"
                        + "s.dispatchEvent(new Event('change',{bubbles:true}));"
                        + "}"
                        + "if(tries>20)clearInterval(timer);"
                        + "},300);"
                        + "})();";
                    view.evaluateJavascript(js, null);
                }
            }
        });
        webView.loadUrl(URL);

        root.addView(webView);
        setContentView(root);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }
}
