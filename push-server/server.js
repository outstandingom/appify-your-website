// server.js — Multi-tenant push notification backend
//
// Serves BOTH:
//   • Browser visitors  → Web Push protocol (via the `web-push` library + your VAPID keys)
//   • Android APK users → Firebase Cloud Messaging (via `firebase-admin`,
//                          one credential per converted website)
//
// Every website you convert with Appify's orchestrator.py should
// call POST /api/admin/register-app ONCE, at conversion time, with
// that website's Firebase service account JSON. From then on, this
// one running server can correctly deliver push to any number of
// converted apps — it picks the right Firebase credential per token
// automatically using the appId tag the APK sends on every request.

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const webpush = require('web-push');
const admin   = require('firebase-admin');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ══════════════════════════════════════════════
// SIMPLE FILE-BASED PERSISTENCE
// Good enough to survive restarts without standing up a database.
// Swap for Postgres/Mongo/etc. later without changing the API shape.
// ══════════════════════════════════════════════
const DATA_DIR        = path.join(__dirname, 'data');
const TENANTS_FILE     = path.join(DATA_DIR, 'tenants.json');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// appId -> serviceAccountJson (object)
let tenantCredentials = loadJson(TENANTS_FILE, {});
// id -> { type: 'webpush' | 'android-fcm', ...data }
let subscribers = loadJson(SUBSCRIBERS_FILE, {});

const firebaseApps = new Map(); // appId -> cached admin.app.App instance (not persisted, rebuilt on boot)

// ══════════════════════════════════════════════
// WEB PUSH SETUP
// ══════════════════════════════════════════════
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT_EMAIL || 'mailto:you@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✅ Web Push configured');
} else {
  console.warn('⚠️  VAPID keys missing — browser Web Push will fail. Run: npx web-push generate-vapid-keys');
}

// ══════════════════════════════════════════════
// ADMIN AUTH (lightweight — protects app registration)
// ══════════════════════════════════════════════
function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return next(); // no key configured = open (fine for local dev only)
  const provided = req.headers['x-admin-key'];
  if (provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing x-admin-key header' });
  }
  next();
}

// ══════════════════════════════════════════════
// TENANT REGISTRATION
// Call this ONCE per website you convert, at the moment you collect
// the Firebase service account JSON during the "enable push" step.
// ══════════════════════════════════════════════
app.post('/api/admin/register-app', requireAdminKey, (req, res) => {
  const { appId, serviceAccountJson } = req.body;

  if (!appId || !serviceAccountJson) {
    return res.status(400).json({ error: 'appId and serviceAccountJson are required' });
  }

  tenantCredentials[appId] = serviceAccountJson;
  saveJson(TENANTS_FILE, tenantCredentials);
  firebaseApps.delete(appId); // force re-init if a credential is rotated

  console.log(`✅ Registered Firebase credential for app: ${appId}`);
  res.json({ success: true, appId });
});

app.get('/api/admin/apps', requireAdminKey, (req, res) => {
  res.json({ apps: Object.keys(tenantCredentials) });
});

function getFirebaseAppFor(appId) {
  if (firebaseApps.has(appId)) return firebaseApps.get(appId);

  const credentialJson = tenantCredentials[appId];
  if (!credentialJson) {
    throw new Error(`No Firebase credential registered for app "${appId}". Call /api/admin/register-app first.`);
  }

  const instance = admin.initializeApp(
    { credential: admin.credential.cert(credentialJson) },
    appId // named instance — keeps every converted website's project isolated
  );

  firebaseApps.set(appId, instance);
  return instance;
}

// ══════════════════════════════════════════════
// SUBSCRIBE — called by both browsers (Web Push) and the
// APK's native MyFirebaseMessagingService (FCM)
// ══════════════════════════════════════════════
app.post('/api/push/subscribe', (req, res) => {
  const { subscription, token, type, appId, userId } = req.body;

  if (type === 'android-fcm' && token) {
    if (!appId) {
      return res.status(400).json({ error: 'appId is required for android-fcm subscriptions' });
    }
    const id = userId || token;
    subscribers[id] = { type: 'android-fcm', token, appId };
    saveJson(SUBSCRIBERS_FILE, subscribers);
    console.log(`✅ Android device registered for "${appId}": ${id.slice(0, 16)}...`);
    return res.json({ success: true, registeredAs: 'android-fcm' });
  }

  if (subscription && subscription.endpoint) {
    const id = userId || subscription.endpoint;
    subscribers[id] = { type: 'webpush', subscription };
    saveJson(SUBSCRIBERS_FILE, subscribers);
    console.log(`✅ Browser subscribed: ${id.slice(0, 40)}...`);
    return res.json({ success: true, registeredAs: 'webpush' });
  }

  res.status(400).json({ error: 'Unrecognized subscription payload' });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { userId, subscription, token } = req.body;
  const id = userId || subscription?.endpoint || token;
  if (id && subscribers[id]) {
    delete subscribers[id];
    saveJson(SUBSCRIBERS_FILE, subscribers);
  }
  res.json({ success: true });
});

async function sendToSubscriber(entry, { title, body, url }) {
  if (entry.type === 'android-fcm') {
    const firebaseApp = getFirebaseAppFor(entry.appId);
    await admin.messaging(firebaseApp).send({
      token: entry.token,
      notification: { title, body },
      data: { url: url || '' }
    });
  } else if (entry.type === 'webpush') {
    await webpush.sendNotification(entry.subscription, JSON.stringify({ title, body, url }));
  } else {
    throw new Error(`Unknown subscriber type: ${entry.type}`);
  }
}

function pruneDeadSubscriber(id, entry, error) {
  const isDeadWebPush = entry.type === 'webpush' && error.statusCode === 410;
  const isDeadFcm = entry.type === 'android-fcm' && (
    error.code === 'messaging/registration-token-not-registered' ||
    error.code === 'messaging/invalid-registration-token'
  );
  if (isDeadWebPush || isDeadFcm) {
    delete subscribers[id];
    saveJson(SUBSCRIBERS_FILE, subscribers);
    console.log(`🗑️  Removed dead subscriber: ${id}`);
  }
}

// Send to one specific user
app.post('/api/push/send', async (req, res) => {
  const { userId, title, body, url } = req.body;
  const entry = subscribers[userId];
  if (!entry) return res.status(404).json({ error: 'User not subscribed' });

  try {
    await sendToSubscriber(entry, { title, body, url });
    res.json({ success: true, via: entry.type });
  } catch (error) {
    console.error(`Send failed for ${userId} (${entry.type}):`, error.message);
    pruneDeadSubscriber(userId, entry, error);
    res.status(500).json({ error: error.message });
  }
});

// Broadcast — pass appId to target only one converted website's
// Android users; browser Web Push subscribers always receive it
// (since one backend deployment typically fronts one site's browser
// visitors — adjust if you're running one shared backend for many
// sites' browser traffic too).
app.post('/api/push/broadcast', async (req, res) => {
  const { appId, title, body, url } = req.body;
  const results = [];

  for (const [id, entry] of Object.entries(subscribers)) {
    if (entry.type === 'android-fcm' && appId && entry.appId !== appId) continue;

    try {
      await sendToSubscriber(entry, { title, body, url });
      results.push({ id, type: entry.type, status: 'sent' });
    } catch (error) {
      results.push({ id, type: entry.type, status: 'failed', error: error.message });
      pruneDeadSubscriber(id, entry, error);
    }
  }

  const sent = results.filter(r => r.status === 'sent').length;
  console.log(`Broadcast: ${sent}/${results.length} delivered`);
  res.json({ results, summary: { total: results.length, sent } });
});

// Debug/inspection
app.get('/api/push/subscribers', requireAdminKey, (req, res) => {
  const list = Object.entries(subscribers).map(([id, entry]) => ({
    id: id.length > 24 ? id.slice(0, 24) + '...' : id,
    type: entry.type,
    appId: entry.appId || null
  }));
  res.json({ count: list.length, subscribers: list });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`🚀 Push server running on port ${PORT}`));
