package com.aegistac.radar;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.ParcelUuid;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.SparseArray;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 100% Native Android / Wear OS Circular Tactical Radar View.
 * Includes:
 * - Display Filter Mode: TOP_5 (closest 5 first), ALL, NONE (scanner off)
 * - Zoom In (+) and Zoom Out (-) buttons (5m, 10m, 20m, 35m, 50m, 75m, 120m) + Rotary Bezel Scroll
 * - Anti-overlap label de-cluttering for swarmed environments
 * - Dedicated QUIT button to cleanly exit the app on the smartwatch
 */
public class WatchRadarView extends View implements SensorEventListener {

    public interface PermissionRequester {
        boolean hasAllBlePermissions();
        void requestBlePermissions();
        void quitWatchApp();
    }

    public enum FilterMode {
        TOP_5,
        ALL,
        NONE
    }

    private static final int[] ZOOM_SCALES = {5, 10, 20, 35, 50, 75, 120};

    private static class BleContact {
        String id;
        String name;
        boolean explicitName;
        double smoothedRssi;
        int rawRssi;
        double txPower = -69.0;
        double distanceMeters;
        float bearingDeg;
        float arcSpreadDeg = 65f;
        int peakRssi = -100;
        int trend = 0; // 1 = closing, -1 = receding, 0 = stable
        long lastSeen;
        boolean isFriendly;
        boolean simulated;
        float lastScreenX;
        float lastScreenY;
    }

    private static class TacticalPing {
        float bearingDeg;
        double distanceMeters;
        String label;
        float lastScreenX;
        float lastScreenY;
    }

    private final Map<String, BleContact> contacts = new HashMap<>();
    private final Set<String> friendlyWhitelist = new HashSet<>();
    private final List<TacticalPing> pings = new ArrayList<>();

    private final PermissionRequester permissionRequester;
    private final BluetoothManager btManager;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bleScanner;
    private boolean isScanning = false;
    private boolean receiverRegistered = false;
    private boolean simEnabled = false;
    private boolean headUpMode = true;
    private boolean enemyPingArmed = false;

    public static final String APP_VERSION = "v1.2.0";
    public static final int APP_BUILD = 2;

    // Default to TOP_5 so swarmed environments stay clean and readable
    private FilterMode filterMode = FilterMode.TOP_5;
    private int zoomIndex = 2; // 20m default on watch (ZOOM_SCALES[2] = 20m)
    private int maxRangeMeters = ZOOM_SCALES[zoomIndex];

    private float headingDeg = 0f;
    private float sweepAngleRad = 0f;
    private String statusBanner = "AEGISTAC " + APP_VERSION + " • READY";

    // Sensors
    private final SensorManager sensorManager;
    private final Sensor rotationSensor;
    private final Sensor accelSensor;
    private final Sensor magSensor;
    private final float[] accelReading = new float[3];
    private final float[] magReading = new float[3];
    private boolean hasAccel = false;
    private boolean hasMag = false;
    private final Vibrator vibrator;

    // Touch Hit Regions
    private final RectF zoomOutBtnRect = new RectF();
    private final RectF topPillRect = new RectF();
    private final RectF zoomInBtnRect = new RectF();
    private final RectF statusBannerRect = new RectF();
    private final RectF filterBtnRect = new RectF();
    private final RectF simBtnRect = new RectF();
    private final RectF pingBtnRect = new RectF();
    private final RectF allyBtnRect = new RectF();
    private final RectF bottomModeRect = new RectF();
    private final RectF bottomClrRect = new RectF();
    private final RectF quitBtnRect = new RectF();
    private final RectF versionRect = new RectF();

    // Paints
    private final Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint gridPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint labelBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint arcGlowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint arcCorePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pillBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pillStrokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    private long lastSimTick = 0;
    private long lastCleanupTick = 0;
    private long lastCloseAlertTick = 0;
    private long lastClassicDiscoveryTick = 0;

    private final BroadcastReceiver classicBtReceiver = new BroadcastReceiver() {
        @Override
        @SuppressLint("MissingPermission")
        public void onReceive(Context context, Intent intent) {
            if (intent == null || filterMode == FilterMode.NONE) return;
            String action = intent.getAction();
            if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                short rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, (short) -74);
                if (device != null) {
                    String addr = device.getAddress() != null ? device.getAddress() : "bt-dev";
                    String name = null;
                    try {
                        name = device.getName();
                    } catch (SecurityException ignored) {
                    }
                    boolean hasName = name != null && !name.trim().isEmpty();
                    String shortId = addr.length() >= 5 ? addr.substring(addr.length() - 5).replace(":", "") : addr;
                    String label = hasName ? name.trim() : "BT-" + shortId;
                    ingestBleReading(addr, label, hasName, rssi, false);
                }
            }
        }
    };

    public WatchRadarView(Context context, PermissionRequester requester) {
        super(context);
        this.permissionRequester = requester;
        setKeepScreenOn(true);
        setFocusable(true);
        setFocusableInTouchMode(true);
        requestFocus();

        btManager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        if (btManager != null) {
            bluetoothAdapter = btManager.getAdapter();
        }

        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        rotationSensor = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) : null;
        accelSensor = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) : null;
        magSensor = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) : null;
        vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);

        gridPaint.setStyle(Paint.Style.STROKE);
        textPaint.setTypeface(Typeface.MONOSPACE);
        labelBgPaint.setStyle(Paint.Style.FILL);
        labelBgPaint.setColor(Color.argb(195, 3, 9, 6));
        arcGlowPaint.setStyle(Paint.Style.STROKE);
        arcGlowPaint.setStrokeCap(Paint.Cap.ROUND);
        arcCorePaint.setStyle(Paint.Style.STROKE);
        arcCorePaint.setStrokeCap(Paint.Cap.ROUND);
        pillStrokePaint.setStyle(Paint.Style.STROKE);
    }

    public void setStatusBanner(String msg) {
        this.statusBanner = msg;
        postInvalidate();
    }

    private void updateStatusSummary() {
        if (filterMode == FilterMode.NONE) {
            statusBanner = "SCANNER OFF (NONE)";
            return;
        }
        int total = contacts.size();
        if (filterMode == FilterMode.TOP_5) {
            int shown = Math.min(5, total);
            statusBanner = "TOP " + shown + "/" + total + " SHOWN";
        } else {
            statusBanner = "ALL " + total + " SHOWN";
        }
    }

    private void zoomIn() {
        if (zoomIndex > 0) {
            zoomIndex--;
            maxRangeMeters = ZOOM_SCALES[zoomIndex];
            statusBanner = "ZOOM IN: " + maxRangeMeters + "m";
            vibrateWatch(40);
        }
    }

    private void zoomOut() {
        if (zoomIndex < ZOOM_SCALES.length - 1) {
            zoomIndex++;
            maxRangeMeters = ZOOM_SCALES[zoomIndex];
            statusBanner = "ZOOM OUT: " + maxRangeMeters + "m";
            vibrateWatch(40);
        }
    }

    private void cycleFilterMode() {
        if (filterMode == FilterMode.TOP_5) {
            filterMode = FilterMode.ALL;
            if (!isScanning) startBleScan();
        } else if (filterMode == FilterMode.ALL) {
            filterMode = FilterMode.NONE;
            stopBleScan();
        } else {
            filterMode = FilterMode.TOP_5;
            startBleScan();
        }
        updateStatusSummary();
        vibrateWatch(55);
    }

    private boolean isLocationServiceEnabled() {
        try {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return lm.isLocationEnabled();
            }
            return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                   lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) {
            return true;
        }
    }

    public void onResumeView() {
        if (sensorManager != null) {
            if (rotationSensor != null) {
                sensorManager.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_GAME);
            } else {
                if (accelSensor != null) {
                    sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_UI);
                }
                if (magSensor != null) {
                    sensorManager.registerListener(this, magSensor, SensorManager.SENSOR_DELAY_UI);
                }
            }
        }
        if (!receiverRegistered) {
            try {
                IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
                getContext().registerReceiver(classicBtReceiver, filter);
                receiverRegistered = true;
            } catch (Exception ignored) {
            }
        }
        postInvalidateOnAnimation();
    }

    public void onPauseView() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        if (receiverRegistered) {
            try {
                getContext().unregisterReceiver(classicBtReceiver);
            } catch (Exception ignored) {
            }
            receiverRegistered = false;
        }
        stopBleScan();
    }

    private void vibrateWatch(int ms) {
        if (vibrator == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(ms);
            }
        } catch (Exception ignored) {
        }
    }

    @SuppressLint("MissingPermission")
    public void startBleScan() {
        if (filterMode == FilterMode.NONE) {
            filterMode = FilterMode.TOP_5;
        }

        if (permissionRequester != null && !permissionRequester.hasAllBlePermissions()) {
            statusBanner = "TAP TO ALLOW BT & LOC";
            permissionRequester.requestBlePermissions();
            return;
        }

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            statusBanner = "TURN ON WATCH BT";
            vibrateWatch(120);
            return;
        }

        if (!isLocationServiceEnabled()) {
            statusBanner = "TURN ON WATCH LOCATION!";
            vibrateWatch(120);
        }

        try {
            if (btManager != null) {
                List<BluetoothDevice> connected = btManager.getConnectedDevices(BluetoothProfile.GATT);
                if (connected != null) {
                    for (BluetoothDevice d : connected) {
                        if (d != null && d.getAddress() != null) {
                            String nm = d.getName();
                            boolean hasNm = nm != null && !nm.trim().isEmpty();
                            ingestBleReading(
                                    d.getAddress(),
                                    hasNm ? nm.trim() : "Connected Phone/BT",
                                    hasNm,
                                    -64,
                                    false
                            );
                        }
                    }
                }
            }

            bleScanner = bluetoothAdapter.getBluetoothLeScanner();
            if (bleScanner != null) {
                try {
                    bleScanner.stopScan(scanCallback);
                } catch (Exception ignored) {
                }
                ScanSettings settings = new ScanSettings.Builder()
                        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                        .setReportDelay(0)
                        .build();
                bleScanner.startScan(null, settings, scanCallback);
            }

            try {
                if (!bluetoothAdapter.isDiscovering()) {
                    bluetoothAdapter.startDiscovery();
                    lastClassicDiscoveryTick = System.currentTimeMillis();
                }
            } catch (Exception ignored) {
            }

            isScanning = true;
            if (isLocationServiceEnabled()) {
                updateStatusSummary();
            }
            vibrateWatch(60);
        } catch (SecurityException se) {
            statusBanner = "ALLOW LOCATION & BT";
            if (permissionRequester != null) {
                permissionRequester.requestBlePermissions();
            }
        } catch (Exception e) {
            statusBanner = "SCAN ERR: " + e.getClass().getSimpleName();
        }
    }

    @SuppressLint("MissingPermission")
    public void stopBleScan() {
        if (bleScanner != null && isScanning) {
            try {
                bleScanner.stopScan(scanCallback);
            } catch (Exception ignored) {
            }
        }
        try {
            if (bluetoothAdapter != null && bluetoothAdapter.isDiscovering()) {
                bluetoothAdapter.cancelDiscovery();
            }
        } catch (Exception ignored) {
        }
        isScanning = false;
        statusBanner = "SCANNER OFF (NONE)";
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            if (filterMode != FilterMode.NONE) {
                processScanResult(result);
            }
        }

        @Override
        public void onBatchScanResults(List<ScanResult> results) {
            if (results == null || filterMode == FilterMode.NONE) return;
            for (ScanResult r : results) {
                processScanResult(r);
            }
        }

        @Override
        public void onScanFailed(int errorCode) {
            statusBanner = "BLE SCAN ERR #" + errorCode;
        }
    };

    @SuppressLint("MissingPermission")
    private void processScanResult(ScanResult result) {
        if (result == null || result.getDevice() == null) return;
        BluetoothDevice dev = result.getDevice();
        String id = dev.getAddress() != null ? dev.getAddress() : "ble-unk";
        int rssi = result.getRssi();

        String rawName = null;
        try {
            rawName = dev.getName();
        } catch (SecurityException ignored) {
        }
        ScanRecord record = result.getScanRecord();
        if ((rawName == null || rawName.trim().isEmpty()) && record != null) {
            rawName = record.getDeviceName();
        }

        boolean explicit = rawName != null && !rawName.trim().isEmpty();
        String label = explicit ? rawName.trim() : identifyFromScanRecord(record, id);
        ingestBleReading(id, label, explicit, rssi, false);
    }

    private String identifyFromScanRecord(ScanRecord record, String address) {
        String shortId = address.length() >= 5 ? address.substring(address.length() - 5).replace(":", "") : address;
        if (record == null) return "SIG-" + shortId;

        List<ParcelUuid> uuids = record.getServiceUuids();
        if (uuids != null) {
            for (ParcelUuid u : uuids) {
                String s = u.toString().toLowerCase(Locale.US);
                if (s.contains("fd5a") || s.contains("fd59")) return "SmartTag [" + shortId + "]";
                if (s.contains("fd69") || s.contains("fee7")) return "Samsung [" + shortId + "]";
                if (s.contains("fe2c")) return "WearOS [" + shortId + "]";
                if (s.contains("180d")) return "Watch HR [" + shortId + "]";
                if (s.contains("feed") || s.contains("feec")) return "Tile [" + shortId + "]";
            }
        }

        SparseArray<byte[]> mfg = record.getManufacturerSpecificData();
        if (mfg != null && mfg.size() > 0) {
            int companyId = mfg.keyAt(0);
            switch (companyId) {
                case 0x0075:
                    return "Samsung [" + shortId + "]";
                case 0x004C:
                    return "Apple [" + shortId + "]";
                case 0x00E0:
                    return "Google [" + shortId + "]";
                case 0x0087:
                    return "Garmin [" + shortId + "]";
                case 0x038F:
                    return "Xiaomi [" + shortId + "]";
                case 0x0157:
                    return "Amazfit [" + shortId + "]";
                case 0x027D:
                    return "Huawei [" + shortId + "]";
                case 0x012D:
                    return "Sony [" + shortId + "]";
                case 0x009E:
                    return "Bose [" + shortId + "]";
                default:
                    return String.format(Locale.US, "BLE:0x%04X", companyId);
            }
        }
        return "SIG-" + shortId;
    }

    private double rssiToDistance(double rssi, double txPower) {
        double n = 2.6;
        double ratio = (txPower - rssi) / (10.0 * n);
        double dist = Math.pow(10.0, ratio);
        return Math.max(0.5, Math.min(150.0, Math.round(dist * 10.0) / 10.0));
    }

    private float angleDiff(float target, float current) {
        return ((target - current + 540f) % 360f) - 180f;
    }

    private synchronized void ingestBleReading(String id, String name, boolean explicitName, int rssi, boolean simulated) {
        long now = System.currentTimeMillis();
        BleContact c = contacts.get(id);
        boolean isFriendly = friendlyWhitelist.contains(id);

        if (c == null) {
            c = new BleContact();
            c.id = id;
            c.name = name;
            c.explicitName = explicitName;
            c.rawRssi = rssi;
            c.smoothedRssi = rssi;
            c.distanceMeters = rssiToDistance(rssi, c.txPower);
            // Spread initial unknown bearings around a 120° forward sector so swarmed nodes don't stack on 1 pixel
            c.bearingDeg = (headingDeg + (Math.abs(id.hashCode()) % 120) - 60 + 360f) % 360f;
            c.arcSpreadDeg = 55f;
            c.peakRssi = rssi;
            c.lastSeen = now;
            c.isFriendly = isFriendly;
            c.simulated = simulated;
            contacts.put(id, c);
            if (isScanning) {
                updateStatusSummary();
            }
            return;
        }

        double prev = c.smoothedRssi;
        c.smoothedRssi = Math.round((0.35 * rssi + 0.65 * prev) * 10.0) / 10.0;
        double delta = c.smoothedRssi - prev;
        if (delta >= 1.0) c.trend = 1;
        else if (delta <= -1.0) c.trend = -1;

        if (!simulated) {
            if (rssi >= c.peakRssi - 1) {
                float diff = angleDiff(headingDeg, c.bearingDeg);
                c.bearingDeg = (c.bearingDeg + diff * 0.35f + 360f) % 360f;
                c.arcSpreadDeg = Math.max(32f, c.arcSpreadDeg - 4f);
                c.peakRssi = Math.max(c.peakRssi, rssi);
            } else {
                c.arcSpreadDeg = Math.min(75f, c.arcSpreadDeg + 1f);
            }
        }

        if (explicitName && !c.explicitName) {
            c.name = name;
            c.explicitName = true;
        }
        c.rawRssi = rssi;
        c.distanceMeters = rssiToDistance(c.smoothedRssi, c.txPower);
        c.lastSeen = now;
        c.isFriendly = isFriendly;

        if (!c.isFriendly && c.distanceMeters <= 8.0 && now - lastCloseAlertTick > 6000) {
            lastCloseAlertTick = now;
            vibrateWatch(90);
        }
    }

    @SuppressLint("MissingPermission")
    private synchronized void tickSimulationAndCleanup(long now) {
        if (isScanning && filterMode != FilterMode.NONE && bluetoothAdapter != null && now - lastClassicDiscoveryTick > 18000) {
            lastClassicDiscoveryTick = now;
            try {
                if (!bluetoothAdapter.isDiscovering()) {
                    bluetoothAdapter.startDiscovery();
                }
            } catch (Exception ignored) {
            }
        }

        if (simEnabled && now - lastSimTick > 1300) {
            lastSimTick = now;
            String[] ids = {"sim-1", "sim-2", "sim-3"};
            String[] names = {"BOGEY-WATCH", "SIG-ALPHA", "GARMIN-TAC"};
            float[] baseBearings = {35f, 145f, 285f};
            int[] baseRssi = {-76, -84, -91};

            for (int i = 0; i < ids.length; i++) {
                int jitter = (int) Math.round(Math.sin(now / 1800.0 + i * 2) * 5);
                ingestBleReading(ids[i], names[i], true, baseRssi[i] + jitter, true);
                BleContact sc = contacts.get(ids[i]);
                if (sc != null && !sc.isFriendly) {
                    sc.bearingDeg = (baseBearings[i] + (float) Math.sin(now / 4000.0 + i) * 12f + 360f) % 360f;
                    sc.arcSpreadDeg = 45f;
                }
            }
        }

        if (now - lastCleanupTick > 4000) {
            lastCleanupTick = now;
            Iterator<Map.Entry<String, BleContact>> it = contacts.entrySet().iterator();
            while (it.hasNext()) {
                BleContact c = it.next().getValue();
                if (c.simulated && !simEnabled) {
                    it.remove();
                } else if (!c.simulated && !c.isFriendly && now - c.lastSeen > 45000) {
                    it.remove();
                }
            }
        }
    }

    private float bearingToRad(float targetBearingDeg) {
        float rel = headUpMode ? (targetBearingDeg - headingDeg + 360f) % 360f : targetBearingDeg;
        return (float) Math.toRadians(rel - 90f);
    }

    private float canvasXYToBearing(float x, float y, float cx, float cy) {
        float angleDeg = (float) Math.toDegrees(Math.atan2(y - cy, x - cx)) + 90f;
        float norm = (angleDeg + 360f) % 360f;
        return headUpMode ? (norm + headingDeg) % 360f : norm;
    }

    /**
     * Retrieves the filtered list of BLE contacts according to FilterMode (TOP_5, ALL, or NONE)
     */
    private List<BleContact> getVisibleContacts() {
        if (filterMode == FilterMode.NONE && !simEnabled) {
            return Collections.emptyList();
        }
        List<BleContact> sorted;
        synchronized (this) {
            sorted = new ArrayList<>(contacts.values());
        }
        Collections.sort(sorted, new Comparator<BleContact>() {
            @Override
            public int compare(BleContact a, BleContact b) {
                return Double.compare(a.distanceMeters, b.distanceMeters);
            }
        });

        if (filterMode == FilterMode.TOP_5 && sorted.size() > 5) {
            return new ArrayList<>(sorted.subList(0, 5));
        }
        return sorted;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        long now = System.currentTimeMillis();
        tickSimulationAndCleanup(now);

        int w = getWidth();
        int h = getHeight();
        float cx = w / 2f;
        float cy = h / 2f;
        float minDim = Math.min(w, h);
        float outerRadius = minDim * 0.40f;

        // 1. Deep Tactical Dark Background
        canvas.drawColor(Color.parseColor("#040a06"));

        RadialGradient bgGrad = new RadialGradient(
                cx, cy, outerRadius,
                Color.parseColor("#0b2215"),
                Color.parseColor("#030805"),
                Shader.TileMode.CLAMP
        );
        bgPaint.setShader(bgGrad);
        canvas.drawCircle(cx, cy, outerRadius, bgPaint);

        // 2. Range Rings (25%, 50%, 75%, 100%)
        textPaint.setTextSize(minDim * 0.026f);
        textPaint.setTextAlign(Paint.Align.LEFT);
        for (int i = 1; i <= 4; i++) {
            float r = outerRadius * (i * 0.25f);
            gridPaint.setColor(i == 4 ? Color.argb(170, 16, 185, 129) : Color.argb(65, 16, 185, 129));
            gridPaint.setStrokeWidth(i == 4 ? 2.5f : 1.2f);
            canvas.drawCircle(cx, cy, r, gridPaint);

            float ringMeters = maxRangeMeters * (i * 0.25f);
            String ringLbl = ringMeters < 10f && (ringMeters % 1f != 0f)
                    ? String.format(Locale.US, "%.1fm", ringMeters)
                    : Math.round(ringMeters) + "m";
            textPaint.setColor(Color.argb(150, 110, 231, 183));
            canvas.drawText(ringLbl, cx + 4f, cy - r + minDim * 0.028f, textPaint);
        }

        // Crosshairs
        gridPaint.setColor(Color.argb(45, 16, 185, 129));
        gridPaint.setStrokeWidth(1f);
        canvas.drawLine(cx - outerRadius, cy, cx + outerRadius, cy, gridPaint);
        canvas.drawLine(cx, cy - outerRadius, cx, cy + outerRadius, gridPaint);

        // 3. Compass Bezel Ticks & N/E/S/W
        textPaint.setTextAlign(Paint.Align.CENTER);
        textPaint.setTextSize(minDim * 0.032f);
        textPaint.setFakeBoldText(true);
        for (int deg = 0; deg < 360; deg += 15) {
            float rad = bearingToRad(deg);
            boolean cardinal = (deg % 90 == 0);
            float rIn = outerRadius + (cardinal ? 2f : 4f);
            float rOut = outerRadius + (cardinal ? 8f : 6f);
            gridPaint.setColor(deg == 0 ? Color.parseColor("#f87171") : Color.argb(cardinal ? 200 : 90, 167, 243, 208));
            gridPaint.setStrokeWidth(cardinal ? 2.2f : 1f);
            canvas.drawLine(
                    cx + (float) Math.cos(rad) * rIn,
                    cy + (float) Math.sin(rad) * rIn,
                    cx + (float) Math.cos(rad) * rOut,
                    cy + (float) Math.sin(rad) * rOut,
                    gridPaint
            );
            if (cardinal) {
                String lbl = deg == 0 ? "N" : deg == 90 ? "E" : deg == 180 ? "S" : "W";
                textPaint.setColor(deg == 0 ? Color.parseColor("#f87171") : Color.parseColor("#a7f3d0"));
                float lr = outerRadius + minDim * 0.044f;
                canvas.drawText(lbl, cx + (float) Math.cos(rad) * lr, cy + (float) Math.sin(rad) * lr + minDim * 0.011f, textPaint);
            }
        }

        // 4. Rotating Radar Sweep Line (only sweeps when not NONE)
        if (filterMode != FilterMode.NONE || simEnabled) {
            sweepAngleRad = (float) ((sweepAngleRad + 0.032) % (Math.PI * 2));
            gridPaint.setColor(Color.argb(190, 52, 211, 153));
            gridPaint.setStrokeWidth(2f);
            canvas.drawLine(
                    cx, cy,
                    cx + (float) Math.cos(sweepAngleRad) * outerRadius,
                    cy + (float) Math.sin(sweepAngleRad) * outerRadius,
                    gridPaint
            );
        }

        // 5. Render Filtered BLE Contacts with Anti-Overlap Label De-Cluttering
        List<BleContact> visible = getVisibleContacts();
        List<RectF> occupiedLabels = new ArrayList<>();
        BleContact closestBogey = null;

        for (int idx = 0; idx < visible.size(); idx++) {
            BleContact c = visible.get(idx);
            if (!c.isFriendly && closestBogey == null) {
                closestBogey = c;
            }
            float clamped = (float) Math.min(maxRangeMeters, c.distanceMeters);
            float rPx = Math.max(minDim * 0.048f, (clamped / maxRangeMeters) * outerRadius);
            float cRad = bearingToRad(c.bearingDeg);
            float bx = cx + (float) Math.cos(cRad) * rPx;
            float by = cy + (float) Math.sin(cRad) * rPx;
            c.lastScreenX = bx;
            c.lastScreenY = by;

            // Keep arcs compact when many contacts are visible
            float effectiveSpread = visible.size() > 5 ? Math.min(36f, c.arcSpreadDeg) : Math.min(52f, c.arcSpreadDeg);

            if (!c.isFriendly) {
                boolean danger = c.distanceMeters <= 10.0;
                int color = danger ? Color.parseColor("#ef4444") : Color.parseColor("#f59e0b");
                arcGlowPaint.setColor(Color.argb(55, Color.red(color), Color.green(color), Color.blue(color)));
                arcGlowPaint.setStrokeWidth(minDim * 0.024f);
                arcCorePaint.setColor(color);
                arcCorePaint.setStrokeWidth(minDim * 0.009f);

                RectF arcRect = new RectF(cx - rPx, cy - rPx, cx + rPx, cy + rPx);
                float startDeg = (float) Math.toDegrees(cRad) - effectiveSpread / 2f;
                canvas.drawArc(arcRect, startDeg, effectiveSpread, false, arcGlowPaint);
                canvas.drawArc(arcRect, startDeg, effectiveSpread, false, arcCorePaint);

                fillPaint.setColor(color);
                canvas.drawCircle(bx, by, minDim * 0.015f, fillPaint);

                // In swarmed mode (>6 visible), only draw text labels on the 6 closest nodes to avoid screen clutter
                if (idx < 6) {
                    String arrow = c.trend > 0 ? "▲" : c.trend < 0 ? "▼" : "";
                    String shortNm = c.name.length() > 8 ? c.name.substring(0, 8) : c.name;
                    String caption = arrow + c.distanceMeters + "m " + shortNm;
                    drawDeoverlappedLabel(canvas, caption, bx, by - minDim * 0.025f, color, minDim * 0.026f, occupiedLabels);
                }
            } else {
                fillPaint.setColor(Color.parseColor("#06b6d4"));
                canvas.drawCircle(bx, by, minDim * 0.018f, fillPaint);
                String shortNm = c.name.length() > 7 ? c.name.substring(0, 7) : c.name;
                String caption = "◆" + shortNm + " " + c.distanceMeters + "m";
                drawDeoverlappedLabel(canvas, caption, bx, by - minDim * 0.025f, Color.parseColor("#67e8f9"), minDim * 0.026f, occupiedLabels);
            }
        }

        // 6. Render Tactical Pings (! ENEMY)
        for (TacticalPing p : pings) {
            float clamped = (float) Math.min(maxRangeMeters, p.distanceMeters);
            float rPx = (clamped / maxRangeMeters) * outerRadius;
            float rad = bearingToRad(p.bearingDeg);
            float px = cx + (float) Math.cos(rad) * rPx;
            float py = cy + (float) Math.sin(rad) * rPx;
            p.lastScreenX = px;
            p.lastScreenY = py;

            fillPaint.setColor(Color.parseColor("#ef4444"));
            float sz = minDim * 0.024f;
            Path tri = new Path();
            tri.moveTo(px, py - sz);
            tri.lineTo(px + sz, py + sz);
            tri.lineTo(px - sz, py + sz);
            tri.close();
            canvas.drawPath(tri, fillPaint);

            textPaint.setColor(Color.WHITE);
            textPaint.setTextSize(minDim * 0.025f);
            canvas.drawText("!ENM " + Math.round(p.distanceMeters) + "m", px, py + sz + minDim * 0.03f, textPaint);
        }

        // 7. Center Self Operator Dot
        fillPaint.setColor(Color.parseColor("#10b981"));
        canvas.drawCircle(cx, cy, minDim * 0.018f, fillPaint);

        // ===================================================================
        // 8. Circular Bezel Touch Controls (Zoom -/+, Filter TOP 5/ALL/NONE, Quit)
        // ===================================================================
        float btnH = minDim * 0.092f;
        float topY = minDim * 0.022f;
        float topPillH = btnH * 0.86f;

        // TOP 12 O'CLOCK ROW: [-] [ RANGE / BOGEY ] [+]
        float topCenterW = minDim * 0.38f;
        float zoomBtnW = minDim * 0.11f;

        topPillRect.set(cx - topCenterW / 2f, topY, cx + topCenterW / 2f, topY + topPillH);
        zoomOutBtnRect.set(topPillRect.left - zoomBtnW - 4f, topY, topPillRect.left - 4f, topY + topPillH);
        zoomInBtnRect.set(topPillRect.right + 4f, topY, topPillRect.right + zoomBtnW + 4f, topY + topPillH);

        drawBezelPill(
                canvas,
                zoomOutBtnRect,
                Color.argb(225, 10, 32, 20),
                Color.parseColor("#6ee7b7"),
                "-",
                minDim * 0.042f
        );

        boolean alert = closestBogey != null && closestBogey.distanceMeters <= 12.0;
        drawBezelPill(
                canvas,
                topPillRect,
                alert ? Color.argb(235, 127, 29, 29) : Color.argb(220, 7, 24, 15),
                alert ? Color.parseColor("#f87171") : Color.parseColor("#34d399"),
                closestBogey != null
                        ? String.format(Locale.US, "⚠ %.1fm • %dm", closestBogey.distanceMeters, maxRangeMeters)
                        : String.format(Locale.US, "%dm • %d°", maxRangeMeters, Math.round(headingDeg)),
                minDim * 0.028f
        );

        drawBezelPill(
                canvas,
                zoomInBtnRect,
                Color.argb(225, 10, 32, 20),
                Color.parseColor("#6ee7b7"),
                "+",
                minDim * 0.040f
        );

        // Diagnostics / Filter Status Sub-banner
        statusBannerRect.set(cx - minDim * 0.34f, topPillRect.bottom + 2f, cx + minDim * 0.34f, topPillRect.bottom + minDim * 0.052f);
        textPaint.setTextSize(minDim * 0.024f);
        textPaint.setTextAlign(Paint.Align.CENTER);
        boolean isWarn = statusBanner.contains("ALLOW") || statusBanner.contains("TURN ON") || statusBanner.contains("ERR");
        textPaint.setColor(isWarn ? Color.parseColor("#fbbf24") : Color.argb(210, 167, 243, 208));
        canvas.drawText(statusBanner, cx, statusBannerRect.centerY() + minDim * 0.008f, textPaint);

        // LEFT 9 O'CLOCK: FILTER CYCLER (TOP 5 / ALL / NONE) & SIM
        float sideW = minDim * 0.21f;
        filterBtnRect.set(minDim * 0.018f, cy - btnH - 4f, minDim * 0.018f + sideW, cy - 4f);
        String filterLabel = filterMode == FilterMode.TOP_5 ? "TOP 5" : filterMode == FilterMode.ALL ? "ALL" : "NONE";
        int filterBg = filterMode == FilterMode.TOP_5
                ? Color.argb(230, 8, 145, 178)
                : filterMode == FilterMode.ALL
                ? Color.argb(230, 16, 185, 129)
                : Color.argb(220, 63, 63, 70);
        drawBezelPill(
                canvas,
                filterBtnRect,
                filterBg,
                Color.WHITE,
                filterLabel,
                minDim * 0.029f
        );

        simBtnRect.set(minDim * 0.018f, cy + 4f, minDim * 0.018f + sideW, cy + btnH + 4f);
        drawBezelPill(
                canvas,
                simBtnRect,
                simEnabled ? Color.argb(230, 245, 158, 11) : Color.argb(200, 10, 25, 18),
                simEnabled ? Color.WHITE : Color.parseColor("#6ee7b7"),
                simEnabled ? "SIM ON" : "SIM",
                minDim * 0.028f
        );

        // RIGHT 3 O'CLOCK: ! ENM PING & +ALLY WHITELIST
        pingBtnRect.set(w - minDim * 0.018f - sideW, cy - btnH - 4f, w - minDim * 0.018f, cy - 4f);
        drawBezelPill(
                canvas,
                pingBtnRect,
                enemyPingArmed ? Color.parseColor("#ef4444") : Color.argb(220, 127, 29, 29),
                Color.parseColor("#fecaca"),
                enemyPingArmed ? "TAP!" : "!ENM",
                minDim * 0.029f
        );

        allyBtnRect.set(w - minDim * 0.018f - sideW, cy + 4f, w - minDim * 0.018f, cy + btnH + 4f);
        drawBezelPill(
                canvas,
                allyBtnRect,
                Color.argb(215, 8, 51, 68),
                Color.parseColor("#67e8f9"),
                "+ALLY",
                minDim * 0.028f
        );

        // BOTTOM 6 O'CLOCK ROW: [HD-UP] [CLR] [QUIT]
        float botBtnW = minDim * 0.18f;
        float botY = h - minDim * 0.024f - topPillH;

        // Dedicated Version Badge right above bottom buttons
        float versionY = botY - minDim * 0.016f;
        versionRect.set(cx - minDim * 0.25f, versionY - minDim * 0.024f, cx + minDim * 0.25f, versionY + minDim * 0.008f);
        textPaint.setTextSize(minDim * 0.022f);
        textPaint.setTextAlign(Paint.Align.CENTER);
        textPaint.setColor(Color.argb(165, 52, 211, 153));
        canvas.drawText("AEGISTAC " + APP_VERSION, cx, versionY, textPaint);
        bottomModeRect.set(cx - botBtnW * 1.5f - 6f, botY, cx - botBtnW * 0.5f - 6f, botY + topPillH);
        bottomClrRect.set(cx - botBtnW * 0.5f, botY, cx + botBtnW * 0.5f, botY + topPillH);
        quitBtnRect.set(cx + botBtnW * 0.5f + 6f, botY, cx + botBtnW * 1.5f + 6f, botY + topPillH);

        drawBezelPill(
                canvas,
                bottomModeRect,
                Color.argb(215, 7, 24, 15),
                Color.parseColor("#6ee7b7"),
                headUpMode ? "HD-UP" : "N-UP",
                minDim * 0.026f
        );

        drawBezelPill(
                canvas,
                bottomClrRect,
                Color.argb(215, 39, 39, 42),
                Color.parseColor("#e4e4e7"),
                "CLR",
                minDim * 0.026f
        );

        drawBezelPill(
                canvas,
                quitBtnRect,
                Color.argb(235, 153, 27, 27),
                Color.parseColor("#fecaca"),
                "QUIT",
                minDim * 0.026f
        );

        postInvalidateOnAnimation();
    }

    private void drawDeoverlappedLabel(
            Canvas canvas,
            String text,
            float x,
            float baseY,
            int textColor,
            float textSize,
            List<RectF> occupied
    ) {
        textPaint.setTextSize(textSize);
        textPaint.setTextAlign(Paint.Align.CENTER);
        float tw = textPaint.measureText(text);
        float th = textSize * 1.25f;

        float candidateY = baseY;
        float[] offsets = {0f, -th * 1.1f, th * 1.8f, -th * 2.2f, th * 2.9f};
        RectF box = new RectF();

        for (float dy : offsets) {
            float cy = baseY + dy;
            box.set(x - tw / 2f - 4f, cy - th, x + tw / 2f + 4f, cy + 4f);
            boolean collision = false;
            for (RectF prev : occupied) {
                if (RectF.intersects(box, prev)) {
                    collision = true;
                    break;
                }
            }
            if (!collision) {
                candidateY = cy;
                break;
            }
        }

        box.set(x - tw / 2f - 4f, candidateY - th + 2f, x + tw / 2f + 4f, candidateY + 4f);
        occupied.add(new RectF(box));

        canvas.drawRoundRect(box, 6f, 6f, labelBgPaint);
        textPaint.setColor(textColor);
        canvas.drawText(text, x, candidateY, textPaint);
    }

    private void drawBezelPill(Canvas canvas, RectF rect, int bgColor, int strokeAndTextColor, String label, float textSize) {
        float r = rect.height() / 2f;
        pillBgPaint.setColor(bgColor);
        canvas.drawRoundRect(rect, r, r, pillBgPaint);
        pillStrokePaint.setColor(strokeAndTextColor);
        pillStrokePaint.setStrokeWidth(2f);
        canvas.drawRoundRect(rect, r, r, pillStrokePaint);

        textPaint.setColor(strokeAndTextColor);
        textPaint.setTextSize(textSize);
        textPaint.setTextAlign(Paint.Align.CENTER);
        Paint.FontMetrics fm = textPaint.getFontMetrics();
        float textY = rect.centerY() - (fm.ascent + fm.descent) / 2f;
        canvas.drawText(label, rect.centerX(), textY, textPaint);
    }

    @Override
    public boolean onGenericMotionEvent(MotionEvent event) {
        // Support Galaxy Watch 5 Touch Bezel / Rotary Scroll to Zoom In & Out
        if (event.getAction() == MotionEvent.ACTION_SCROLL) {
            float vScroll = event.getAxisValue(MotionEvent.AXIS_SCROLL);
            if (vScroll == 0f) {
                vScroll = event.getAxisValue(MotionEvent.AXIS_VSCROLL);
            }
            if (vScroll > 0f) {
                zoomIn();
                return true;
            } else if (vScroll < 0f) {
                zoomOut();
                return true;
            }
        }
        return super.onGenericMotionEvent(event);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (event.getAction() != MotionEvent.ACTION_DOWN) {
            return super.onTouchEvent(event);
        }
        float x = event.getX();
        float y = event.getY();

        if (quitBtnRect.contains(x, y)) {
            vibrateWatch(70);
            if (permissionRequester != null) {
                permissionRequester.quitWatchApp();
            }
            return true;
        }

        if (versionRect.contains(x, y)) {
            statusBanner = "AEGISTAC " + APP_VERSION + " (BUILD " + APP_BUILD + ")";
            vibrateWatch(45);
            return true;
        }

        if (zoomInBtnRect.contains(x, y)) {
            zoomIn();
            return true;
        }

        if (zoomOutBtnRect.contains(x, y)) {
            zoomOut();
            return true;
        }

        if (topPillRect.contains(x, y)) {
            zoomIndex = (zoomIndex + 1) % ZOOM_SCALES.length;
            maxRangeMeters = ZOOM_SCALES[zoomIndex];
            statusBanner = "RANGE: " + maxRangeMeters + "m";
            vibrateWatch(45);
            return true;
        }

        if (statusBannerRect.contains(x, y)) {
            if (!isLocationServiceEnabled()) {
                try {
                    Intent locIntent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                    locIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(locIntent);
                } catch (Exception ignored) {
                }
            } else if (permissionRequester != null) {
                permissionRequester.requestBlePermissions();
            }
            vibrateWatch(50);
            return true;
        }

        if (filterBtnRect.contains(x, y)) {
            cycleFilterMode();
            return true;
        }

        if (simBtnRect.contains(x, y)) {
            simEnabled = !simEnabled;
            if (!simEnabled) {
                synchronized (this) {
                    Iterator<Map.Entry<String, BleContact>> it = contacts.entrySet().iterator();
                    while (it.hasNext()) {
                        if (it.next().getValue().simulated) it.remove();
                    }
                }
            }
            updateStatusSummary();
            vibrateWatch(50);
            return true;
        }

        if (pingBtnRect.contains(x, y)) {
            if (enemyPingArmed) {
                TacticalPing p = new TacticalPing();
                p.bearingDeg = headingDeg;
                p.distanceMeters = Math.min(20, maxRangeMeters * 0.6);
                p.label = "ENEMY";
                pings.add(p);
                enemyPingArmed = false;
            } else {
                enemyPingArmed = true;
            }
            vibrateWatch(60);
            return true;
        }

        if (allyBtnRect.contains(x, y)) {
            synchronized (this) {
                BleContact closest = null;
                for (BleContact c : contacts.values()) {
                    if (!c.isFriendly && (closest == null || c.distanceMeters < closest.distanceMeters)) {
                        closest = c;
                    }
                }
                if (closest != null) {
                    closest.isFriendly = true;
                    closest.bearingDeg = headingDeg;
                    friendlyWhitelist.add(closest.id);
                    vibrateWatch(70);
                }
            }
            return true;
        }

        if (bottomModeRect.contains(x, y)) {
            headUpMode = !headUpMode;
            vibrateWatch(45);
            return true;
        }

        if (bottomClrRect.contains(x, y)) {
            pings.clear();
            friendlyWhitelist.clear();
            synchronized (this) {
                for (BleContact c : contacts.values()) {
                    c.isFriendly = false;
                }
            }
            enemyPingArmed = false;
            vibrateWatch(65);
            return true;
        }

        // Check if user tapped an existing ping to remove it
        for (int i = pings.size() - 1; i >= 0; i--) {
            TacticalPing p = pings.get(i);
            if (Math.hypot(x - p.lastScreenX, y - p.lastScreenY) <= 32f) {
                pings.remove(i);
                vibrateWatch(45);
                return true;
            }
        }

        // Check if user tapped a visible BLE contact on the radar to toggle Ally / Bogey
        List<BleContact> visible = getVisibleContacts();
        synchronized (this) {
            for (BleContact c : visible) {
                if (Math.hypot(x - c.lastScreenX, y - c.lastScreenY) <= 34f) {
                    c.isFriendly = !c.isFriendly;
                    if (c.isFriendly) {
                        friendlyWhitelist.add(c.id);
                        c.bearingDeg = headingDeg;
                    } else {
                        friendlyWhitelist.remove(c.id);
                    }
                    vibrateWatch(55);
                    return true;
                }
            }
        }

        // If !ENM is armed, tapping anywhere on the radar drops an Enemy ping there
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        float outerRadius = Math.min(getWidth(), getHeight()) * 0.40f;
        float distPx = (float) Math.hypot(x - cx, y - cy);
        if (enemyPingArmed && distPx <= outerRadius * 1.05f) {
            TacticalPing p = new TacticalPing();
            p.bearingDeg = canvasXYToBearing(x, y, cx, cy);
            p.distanceMeters = Math.max(1.0, Math.round((distPx / outerRadius) * maxRangeMeters));
            p.label = "ENEMY";
            pings.add(p);
            enemyPingArmed = false;
            vibrateWatch(75);
            return true;
        }

        return true;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null) return;
        if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR) {
            float[] rotMatrix = new float[9];
            float[] orientation = new float[3];
            SensorManager.getRotationMatrixFromVector(rotMatrix, event.values);
            SensorManager.getOrientation(rotMatrix, orientation);
            float azimuthDeg = (float) Math.toDegrees(orientation[0]);
            headingDeg = (azimuthDeg + 360f) % 360f;
        } else if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            System.arraycopy(event.values, 0, accelReading, 0, accelReading.length);
            hasAccel = true;
            updateMagAccelOrientation();
        } else if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            System.arraycopy(event.values, 0, magReading, 0, magReading.length);
            hasMag = true;
            updateMagAccelOrientation();
        }
    }

    private void updateMagAccelOrientation() {
        if (!hasAccel || !hasMag) return;
        float[] rotMatrix = new float[9];
        float[] orientation = new float[3];
        if (SensorManager.getRotationMatrix(rotMatrix, null, accelReading, magReading)) {
            SensorManager.getOrientation(rotMatrix, orientation);
            float azimuthDeg = (float) Math.toDegrees(orientation[0]);
            headingDeg = (azimuthDeg + 360f) % 360f;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }
}
