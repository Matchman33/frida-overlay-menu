package com.matchman.fridauitest;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private TextView statusView;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 48, 48, 48);
        root.setBackgroundColor(Color.WHITE);

        TextView title = new TextView(this);
        title.setText("Frida UI Runtime Test Host");
        title.setTextColor(Color.BLACK);
        title.setTextSize(22);
        root.addView(title, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        statusView = new TextView(this);
        statusView.setTextColor(Color.DKGRAY);
        statusView.setTextSize(16);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        statusParams.topMargin = 32;
        root.addView(statusView, statusParams);

        Button permissionButton = new Button(this);
        permissionButton.setText("Open overlay permission");
        permissionButton.setOnClickListener(view -> openOverlaySettings());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        buttonParams.topMargin = 32;
        root.addView(permissionButton, buttonParams);

        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        statusView.setText(Settings.canDrawOverlays(this)
            ? "Overlay permission: granted"
            : "Overlay permission: missing");
    }

    private void openOverlaySettings() {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getPackageName())
        );
        startActivity(intent);
    }
}
