package com.toonstudio.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
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
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    // The app's own files are served from this fake https address, so absolute paths such as
    // /studio-tools.js and /models/modest-base.glb work (file:// would break them).
    private static final String HOST = "appassets.local";
    private WebView wv;
    private ValueCallback<Uri[]> fileCb;
    private OutputStream out;
    private static final int REQ = 7;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    private void js(String code) {
        runOnUiThread(() -> { if (wv != null) wv.evaluateJavascript(code, null); });
    }
    private static String q(String s) { return s.replace("\\", "\\\\").replace("'", "\\'"); }

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
            @Override public boolean onJsAlert(WebView v, String url, String msg, JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(msg)
                    .setPositiveButton("OK", (d, w) -> r.confirm()).setOnCancelListener(d -> r.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String msg, JsResult r) {
                new AlertDialog.Builder(MainActivity.this).setMessage(msg)
                    .setPositiveButton("OK", (d, w) -> r.confirm())
                    .setNegativeButton("Cancel", (d, w) -> r.cancel())
                    .setOnCancelListener(d -> r.cancel()).show();
                return true;
            }
            @Override public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try { startActivityForResult(p.createIntent(), REQ); }
                catch (Exception e) { fileCb = null; return false; }
                return true;
            }
        });
        tts = new TextToSpeech(this, status -> {
            ttsReady = (status == TextToSpeech.SUCCESS);
            if (ttsReady) {
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) {}
                    @Override public void onDone(String id) { js("window.__ttsEnd&&window.__ttsEnd('" + q(id) + "')"); }
                    @Override public void onError(String id) { js("window.__ttsEnd&&window.__ttsEnd('" + q(id) + "')"); }
                    @Override public void onStop(String id, boolean interrupted) { js("window.__ttsEnd&&window.__ttsEnd('" + q(id) + "')"); }
                });
            }
            js("window.__ttsReady&&window.__ttsReady()");
        });
        wv.loadUrl("https://" + HOST + "/index.html");
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
        }
    }

    @Override protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }

    class Bridge {
        @JavascriptInterface public String ttsVoices() {
            try {
                JSONArray a = new JSONArray();
                if (ttsReady) {
                    Set<Voice> vs = tts.getVoices();
                    if (vs != null) for (Voice v : vs) {
                        JSONObject o = new JSONObject();
                        o.put("name", v.getName());
                        o.put("lang", v.getLocale().toLanguageTag());
                        o.put("local", !v.isNetworkConnectionRequired());
                        a.put(o);
                    }
                }
                return a.toString();
            } catch (Exception e) { return "[]"; }
        }
        @JavascriptInterface public void ttsSpeak(String id, String text, String voiceName, String lang, float pitch, float rate) {
            runOnUiThread(() -> {
                try {
                    if (!ttsReady) { js("window.__ttsEnd&&window.__ttsEnd('" + q(id) + "')"); return; }
                    Voice chosen = null;
                    if (voiceName != null && !voiceName.isEmpty() && tts.getVoices() != null)
                        for (Voice v : tts.getVoices()) if (v.getName().equals(voiceName)) chosen = v;
                    if (chosen != null) tts.setVoice(chosen);
                    else if (lang != null && !lang.isEmpty()) tts.setLanguage(Locale.forLanguageTag(lang));
                    tts.setPitch(pitch);
                    tts.setSpeechRate(rate);
                    int r = tts.speak(text, TextToSpeech.QUEUE_ADD, null, id);
                    if (r != TextToSpeech.SUCCESS) js("window.__ttsEnd&&window.__ttsEnd('" + q(id) + "')");
                } catch (Exception e) { js("window.__ttsEnd&&window.__ttsEnd('" + q(id) + "')"); }
            });
        }
        @JavascriptInterface public void ttsStop() {
            runOnUiThread(() -> { if (ttsReady) tts.stop(); });
        }
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
