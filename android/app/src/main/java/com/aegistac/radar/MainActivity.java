package com.aegistac.radar;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/**
 * Universal Launcher Activity:
 * - On Wear OS Smartwatches (Galaxy Watch 4/5/6/7) or devices without System WebView:
 *   Launches the 100% Native Hardware Canvas + BLE + Compass Radar (WatchRadarView) with ZERO WebView needed.
 * - On Android Smartphones (with System WebView):
 *   Launches PhoneBridgeActivity (full Capacitor React WebRTC + Satellite Map + BLE Suite).
 */
public class MainActivity extends Activity implements WatchRadarView.PermissionRequester {

    private static final int REQ_BLE_PERMS = 1001;
    private WatchRadarView watchRadarView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (!shouldUseNativeWatchMode()) {
            Intent phoneIntent = new Intent(this, PhoneBridgeActivity.class);
            startActivity(phoneIntent);
            finish();
            return;
        }

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        watchRadarView = new WatchRadarView(this, this);
        setContentView(watchRadarView);
        Toast.makeText(this, "AegisTac " + WatchRadarView.APP_VERSION, Toast.LENGTH_SHORT).show();
        requestBlePermissions();
    }

    private boolean shouldUseNativeWatchMode() {
        try {
            if (getPackageManager().hasSystemFeature(PackageManager.FEATURE_WATCH)) {
                return true;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PackageInfo wv = WebView.getCurrentWebViewPackage();
                if (wv == null) {
                    return true;
                }
            }
        } catch (Throwable t) {
            return true;
        }
        return false;
    }

    @Override
    public boolean hasAllBlePermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }
        boolean locGranted =
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            boolean btScan = checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
            boolean btConn = checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
            return locGranted && btScan && btConn;
        }
        return locGranted;
    }

    @Override
    public void requestBlePermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            if (watchRadarView != null) {
                watchRadarView.startBleScan();
            }
            return;
        }

        List<String> needed = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.BLUETOOTH_SCAN);
            }
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }

        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), REQ_BLE_PERMS);
        } else if (watchRadarView != null) {
            watchRadarView.startBleScan();
        }
    }

    @Override
    public void quitWatchApp() {
        if (watchRadarView != null) {
            watchRadarView.onPauseView();
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask();
        } else {
            finish();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_BLE_PERMS && watchRadarView != null) {
            if (hasAllBlePermissions()) {
                watchRadarView.startBleScan();
            } else {
                watchRadarView.setStatusBanner("PERM DENIED: ALLOW LOCATION & BT");
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (watchRadarView != null) {
            watchRadarView.onResumeView();
        }
    }

    @Override
    protected void onPause() {
        if (watchRadarView != null) {
            watchRadarView.onPauseView();
        }
        super.onPause();
    }
}
