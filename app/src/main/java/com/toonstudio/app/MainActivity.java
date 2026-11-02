package com.toonstudio.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    // The app's own files are served from this fake https address, so absolute paths such as
    // /studio-tools.js and /models/modest-base.glb work (file:// would break them).
    private static final String HOST = "appassets.local";
    private WebView wv;
    private ValueCallback<Uri[]> fileCb;
    private OutputStream out;
    private static final int REQ = 7;

    private static String mimeFor(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".glb")) return "model/gltf-binary";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".webmanifest")) return "application/manifest+json";
        return "application/octet-stream";
    }

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        wv = new WebView(this);
        setContentView(wv);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        wv.addJavascriptInterface(new Bridge(), "Android");
        wv.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!"https".equals(u.getScheme()) || !HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    return new WebResourceResponse(mimeFor(path), "utf-8", in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null,
                        new ByteArrayInputStream(new byte[0]));
                }
            }
        });
        wv.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { startActivityForResult(p.createIntent(), REQ); }
                catch (Exception e) { fileCb = null; return false; }
                return true;
            }
        });
        wv.loadUrl("https://" + HOST + "/index.html");
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
        }
    }

    class Bridge {
        @JavascriptInterface public void begin(String name, String mime) throws Exception {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, name);
            v.put(MediaStore.Downloads.MIME_TYPE, mime);
            v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ToonStudio");
            Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            out = getContentResolver().openOutputStream(u);
        }
        @JavascriptInterface public void chunk(String b64) throws Exception {
            out.write(Base64.decode(b64, Base64.DEFAULT));
        }
        @JavascriptInterface public void end() throws Exception {
            out.close(); out = null;
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads/ToonStudio", Toast.LENGTH_LONG).show());
        }
    }
}
