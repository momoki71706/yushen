import { api } from './api/client';

// PushManager.subscribe() needs the VAPID public key as a Uint8Array, not
// the base64url string the backend hands out.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('这台设备/浏览器不支持推送通知');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('没有获得通知权限');

  const registration = await navigator.serviceWorker.ready;
  const { publicKey, configured } = await api.getVapidPublicKey();
  if (!configured) throw new Error('服务端还没配置推送密钥');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api.subscribePush(subscription.toJSON());
  return subscription;
}

// Lets the app react the moment a proactive/scheduled push actually lands
// (the service worker posts this after showing the notification), instead
// of only picking up the new message on the next full reload — otherwise
// it's saved server-side with full context but never shows up on screen
// until something else happens to refetch it.
export function listenForProactiveMessages(callback) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'proactive-message') callback();
  });
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await api.unsubscribePush(subscription.endpoint);
    await subscription.unsubscribe();
  }
}
