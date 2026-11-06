import express from 'express';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const webpush = require('web-push');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const VAPID_FILE = path.join(__dirname, '.vapid-keys.json');
const SUBS_FILE = path.join(__dirname, '.push-subscriptions.json');

// --- 1. VAPID KEYS SETUP ---
interface VapidKeys {
    publicKey: string;
    privateKey: string;
}

let vapidKeys: VapidKeys;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
    };
} else if (fs.existsSync(VAPID_FILE)) {
    try {
        vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
    } catch {
        vapidKeys = webpush.generateVAPIDKeys();
        fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
    }
} else {
    vapidKeys = webpush.generateVAPIDKeys();
    try {
        fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
    } catch (e) {
        console.warn('Could not persist VAPID keys to file, using in-memory keys:', e);
    }
}

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:notifications@leapdino.app';
webpush.setVapidDetails(VAPID_SUBJECT, vapidKeys.publicKey, vapidKeys.privateKey);

// --- 2. SUBSCRIPTIONS PERSISTENCE ---
interface StoredSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    reminderTime: string; // "07:00"
    timezone: string; // e.g. "America/New_York"
    enabled: boolean;
    lastSentDate?: string; // "YYYY-MM-DD"
    createdAt: string;
}

function loadSubscriptions(): Record<string, StoredSubscription> {
    if (fs.existsSync(SUBS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
        } catch {
            return {};
        }
    }
    return {};
}

function saveSubscriptions(subs: Record<string, StoredSubscription>) {
    try {
        fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
    } catch (e) {
        console.warn('Failed to save subscriptions:', e);
    }
}

let subscriptions = loadSubscriptions();

// --- 3. EXPRESS APP & API ROUTES ---
const app = express();
app.use(express.json());

// Public VAPID Key Endpoint
app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// Save or Update Push Subscription
app.post('/api/push/subscribe', (req, res) => {
    const { subscription, reminderTime, timezone, enabled } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const endpoint = subscription.endpoint;
    subscriptions[endpoint] = {
        endpoint,
        keys: subscription.keys,
        reminderTime: reminderTime || '07:00',
        timezone: timezone || 'UTC',
        enabled: enabled !== false,
        createdAt: new Date().toISOString(),
    };

    saveSubscriptions(subscriptions);
    res.json({ success: true, message: 'Subscription saved successfully' });
});

// Unsubscribe Endpoint
app.post('/api/push/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    if (endpoint && subscriptions[endpoint]) {
        delete subscriptions[endpoint];
        saveSubscriptions(subscriptions);
    }
    res.json({ success: true });
});

// Instant Test Notification Endpoint
// Instant Test Notification Endpoint
app.post('/api/push/test', async (req, res) => {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Subscription is required' });
    }

    const payload = JSON.stringify({
        title: 'HitFit – Daily Workout Reminder',
        body: 'Hit the target to be fit! Time for a quick exercise session. Jump, squat, and reach your goals!',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'hitfit-reminder-test',
        data: { url: 'https://hitfit.zainaxes.com/' }
    });

    try {
        await webpush.sendNotification(subscription, payload);
        res.json({ success: true, message: 'Test notification sent successfully' });
    } catch (err: any) {
        console.error('Failed to send test push notification:', err);
        res.status(500).json({
            error: 'Failed to deliver push notification',
            details: err?.message || String(err)
        });
    }
});

// Explicit SEO file endpoints
app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml').sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

app.get('/llms.txt', (_req, res) => {
    res.type('text/plain').sendFile(path.join(__dirname, 'public', 'llms.txt'));
});

app.get('/llms-full.txt', (_req, res) => {
    res.type('text/plain').sendFile(path.join(__dirname, 'public', 'llms-full.txt'));
});

// Health Endpoint
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        app: 'HitFit',
        activeSubscriptions: Object.keys(subscriptions).length,
        serverTime: new Date().toISOString(),
    });
});

// --- 4. SCHEDULED CRON JOB (Every minute) ---
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const subsArray = Object.values(subscriptions);
    let mutated = false;

    for (const sub of subsArray) {
        if (!sub.enabled) continue;

        try {
            const timeFormatter = new Intl.DateTimeFormat('en-GB', {
                timeZone: sub.timezone || 'UTC',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
            const dateFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: sub.timezone || 'UTC',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });

            const localTime = timeFormatter.format(now);
            const localDate = dateFormatter.format(now);

            if (localTime === sub.reminderTime && sub.lastSentDate !== localDate) {
                const payload = JSON.stringify({
                    title: 'HitFit Workout Reminder',
                    body: 'Hit the target to be fit! Time for your daily exercise session.',
                    icon: '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                    tag: 'daily-exercise-reminder',
                    data: { url: 'https://hitfit.zainaxes.com/' }
                });

                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: sub.keys,
                    },
                    payload
                );

                sub.lastSentDate = localDate;
                mutated = true;
                console.log(`Sent daily exercise reminder to ${sub.endpoint.slice(-12)} for ${localDate} ${localTime}`);
            }
        } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
                console.log(`Pruning expired push subscription: ${sub.endpoint.slice(-12)}`);
                delete subscriptions[sub.endpoint];
                mutated = true;
            } else {
                console.error('Error sending scheduled push notification:', err.message);
            }
        }
    }

    if (mutated) {
        saveSubscriptions(subscriptions);
    }
});

// --- 5. DEV & PROD SERVING ---
async function startServer() {
    if (process.env.NODE_ENV !== 'production') {
        const { createServer } = await import('vite');
        const vite = await createServer({
            server: {
                middlewareMode: true,
                hmr: false,
            },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.resolve(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`HitFit server running on http://0.0.0.0:${PORT}`);
    });
}

startServer();
