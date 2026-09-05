import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const androidRoot = path.join(root, "android");
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
const javaDir = path.join(androidRoot, "app", "src", "main", "java", "com", "luminor", "genesisdefense");
const mainActivityPath = path.join(javaDir, "MainActivity.java");

if (!fs.existsSync(manifestPath)) {
  throw new Error("Projeto Android não encontrado. Execute `npx cap add android` antes deste script.");
}

let manifest = fs.readFileSync(manifestPath, "utf8");

if (!manifest.includes("android.permission.VIBRATE")) {
  manifest = manifest.replace(
    /<application\b/,
    '<uses-permission android:name="android.permission.VIBRATE" />\n\n    <application',
  );
}

if (!manifest.includes('android:screenOrientation="landscape"')) {
  manifest = manifest.replace(
    'android:name=".MainActivity"',
    'android:name=".MainActivity"\n            android:screenOrientation="landscape"',
  );
}

fs.writeFileSync(manifestPath, manifest);
fs.mkdirSync(javaDir, { recursive: true });

const mainActivity = `package com.luminor.genesisdefense;

import android.app.AlertDialog;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PAUSE_BATTLE_JS =
        "(function(){" +
        "var battle=document.querySelector('.battle-shell');" +
        "var paused=document.querySelector('.battle-pause-backdrop');" +
        "if(battle&&!paused){" +
        "var b=document.querySelector('[aria-label=\\\"Pausar batalha\\\"]');" +
        "if(b)b.click();" +
        "}" +
        "})()";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    protected void onPause() {
        pauseBattleInWebView();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().postDelayed(this::hideSystemBars, 120);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (bridge == null || bridge.getWebView() == null) {
            confirmExit();
            return;
        }

        String script =
            "(function(){" +
            "var battle=document.querySelector('.battle-shell');" +
            "if(battle){" +
            "var paused=!!document.querySelector('.battle-pause-backdrop');" +
            "var label=paused?'Continuar batalha':'Pausar batalha';" +
            "var buttons=document.querySelectorAll('[aria-label]');" +
            "for(var i=0;i<buttons.length;i++){if(buttons[i].getAttribute('aria-label')===label){buttons[i].click();return 'handled';}}" +
            "return 'handled';" +
            "}" +
            "if(window.history.length>1){window.history.back();return 'handled';}" +
            "return 'exit';" +
            "})()";

        bridge.getWebView().evaluateJavascript(script, value -> {
            if ("\\\"exit\\\"".equals(value)) {
                runOnUiThread(this::confirmExit);
            }
        });
    }

    private void pauseBattleInWebView() {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().evaluateJavascript(PAUSE_BATTLE_JS, null);
    }

    private void confirmExit() {
        new AlertDialog.Builder(this)
            .setTitle("Genesis Defense")
            .setMessage("Deseja sair do jogo?")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Sair", (dialog, which) -> finish())
            .show();
    }

    private void hideSystemBars() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }
}
`;

fs.writeFileSync(mainActivityPath, mainActivity);

console.log("Android project prepared:");
console.log(`- Landscape locked: ${manifestPath}`);
console.log(`- Vibration permission: ${manifestPath}`);
console.log(`- Immersive lifecycle/back handling: ${mainActivityPath}`);
