package PACKAGE_NAME;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
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
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                openPicker();
                            }
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

    private void openPicker() {
        String appUrl = getBridge().getAppUrl();
        if (appUrl == null) {
            return;
        }
        String base = appUrl.endsWith("/") ? appUrl.substring(0, appUrl.length() - 1) : appUrl;
        getBridge().getWebView().loadUrl(base + "/?picker=1");
    }
}
