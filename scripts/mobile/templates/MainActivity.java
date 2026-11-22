package PACKAGE_NAME;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/** COMFORCE_SERVER_CHIP: a persistent control that returns to the saved-server picker. */
public class MainActivity extends BridgeActivity {

    private boolean chromeReady = false;

    @Override
    public void onStart() {
        super.onStart();
        if (chromeReady || getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        chromeReady = true;

        WebView webView = getBridge().getWebView();
        FrameLayout content = findViewById(android.R.id.content);
        Button chip = buildServerChip();
        content.addView(chip);

        webView.setWebViewClient(
            new BridgeWebViewClient(getBridge()) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    // Let the web view open the saved server itself. The packaged proxy
                    // would claim every host and turn a live Tailscale dashboard into a load error.
                    if (isRemote(request.getUrl())) {
                        return null;
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public void onReceivedHttpError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceResponse errorResponse
                ) {
                    // A dashboard response is not a dead server. Stay on the page.
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    if (
                        request.isForMainFrame()
                        && isRemote(request.getUrl())
                        && isConnectionFailure(error.getErrorCode())
                    ) {
                        openPicker();
                        return;
                    }
                    super.onReceivedError(view, request, error);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    chip.setVisibility(isLocal(url) ? View.GONE : View.VISIBLE);
                }
            }
        );

        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        if (!isLocal(webView.getUrl())) {
                            openPicker();
                            return;
                        }
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                }
            );
    }

    private Button buildServerChip() {
        Button chip = new Button(this);
        chip.setText("Server");
        chip.setAllCaps(false);
        chip.setTextColor(Color.WHITE);
        chip.setTextSize(15);
        chip.setContentDescription("Change server");
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor("#0F6B3A"));
        float density = getResources().getDisplayMetrics().density;
        background.setCornerRadius(22f * density);
        chip.setBackground(background);
        int padH = (int) (14 * density);
        int padV = (int) (8 * density);
        chip.setPadding(padH, padV, padH, padV);
        chip.setMinHeight((int) (44 * density));
        chip.setMinimumHeight((int) (44 * density));
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.TOP | Gravity.END
        );
        int side = (int) (10 * density);
        params.rightMargin = side;
        params.topMargin = side;
        chip.setLayoutParams(params);
        chip.setVisibility(View.GONE);
        chip.setOnClickListener(v -> openPicker());
        ViewCompat.setOnApplyWindowInsetsListener(chip, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.statusBars());
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) view.getLayoutParams();
            lp.topMargin = bars.top + side;
            view.setLayoutParams(lp);
            return insets;
        });
        return chip;
    }

    private boolean isLocal(String url) {
        String appUrl = getBridge().getAppUrl();
        return url != null && appUrl != null && url.startsWith(appUrl);
    }

    private boolean isRemote(Uri uri) {
        if (uri == null) {
            return false;
        }
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
            return false;
        }
        String host = uri.getHost();
        String appUrl = getBridge().getAppUrl();
        if (host == null || appUrl == null) {
            return false;
        }
        String appHost = Uri.parse(appUrl).getHost();
        return appHost != null && !host.equalsIgnoreCase(appHost);
    }

    private boolean isConnectionFailure(int code) {
        return code == WebViewClient.ERROR_HOST_LOOKUP
            || code == WebViewClient.ERROR_CONNECT
            || code == WebViewClient.ERROR_TIMEOUT
            || code == WebViewClient.ERROR_IO;
    }

    private void openPicker() {
        String appUrl = getBridge().getAppUrl();
        if (appUrl == null) {
            return;
        }
        String base = appUrl.endsWith("/") ? appUrl.substring(0, appUrl.length() - 1) : appUrl;
        getBridge().getWebView().loadUrl(base + "/?picker=1");
    }
}
