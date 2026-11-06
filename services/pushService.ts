/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export interface PushStatus {
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
    error?: string;
}

export async function checkPushSupport(): Promise<PushStatus> {
    if (typeof window === 'undefined') {
        return { supported: false, permission: 'denied', subscribed: false };
    }

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
        return {
            supported: false,
            permission: 'denied',
            subscribed: false,
            error: 'Push notifications are not supported in this browser.',
        };
    }

    const permission = Notification.permission;
    let subscribed = false;

    try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        subscribed = !!existingSub;
    } catch {
        subscribed = false;
    }

    return { supported, permission, subscribed };
}

export async function subscribeToPush(reminderTime: string = '07:00'): Promise<{ success: boolean; error?: string }> {
    try {
        const status = await checkPushSupport();
        if (!status.supported) {
            return { success: false, error: 'Push notifications are not supported on this device/browser.' };
        }

        // 1. Request Notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return { success: false, error: 'Notification permission was not granted.' };
        }

        // 2. Fetch server VAPID public key
        const keyResponse = await fetch('/api/push/vapid-public-key');
        if (!keyResponse.ok) {
            throw new Error('Failed to retrieve push server public key');
        }
        const { publicKey } = await keyResponse.json();

        // 3. Register push subscription with Service Worker
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
        }

        // 4. Send subscription and user timezone to server
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const subResponse = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                reminderTime,
                timezone,
                enabled: true,
            }),
        });

        if (!subResponse.ok) {
            throw new Error('Failed to register subscription on server');
        }

        return { success: true };
    } catch (err: any) {
        console.error('Failed to subscribe to push notifications:', err);
        return { success: false, error: err?.message || 'Could not complete push subscription' };
    }
}

export async function sendTestPush(): Promise<{ success: boolean; error?: string }> {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Fallback: If no push subscription yet, show a local browser notification if permitted
            if (Notification.permission === 'granted') {
                registration.showNotification('HitFit – Test Reminder', {
                    body: 'Hit the target to be fit! Time for a quick exercise session. Jump, squat, and hit your goal!',
                    icon: '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                });
                return { success: true };
            }
            return { success: false, error: 'Please enable notifications first.' };
        }

        const res = await fetch('/api/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Server failed to send test notification');
        }

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to trigger test notification' };
    }
}
