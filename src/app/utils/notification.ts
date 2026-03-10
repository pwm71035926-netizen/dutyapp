/**
 * Browser Notification Utility for Gong-Dang (공당)
 */

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.error("이 브라우저는 알림 기능을 지원하지 않습니다.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/favicon.ico", // Ensure you have an icon
      badge: "/favicon.ico",
      ...options,
    });
  }
};

/**
 * PWA 설치 유도 (BeforeInstallPromptEvent)
 */
let deferredPrompt: any;

/** Dashboard의 beforeinstallprompt 핸들러에서 호출하여 이벤트를 저장 */
export const setDeferredPrompt = (e: any) => {
  deferredPrompt = e;
};

export const presentPwaInstall = async () => {
  if (!deferredPrompt) {
    return false;
  }
  // 설치 프롬프트 표시
  deferredPrompt.prompt();
  // 사용자의 선택 대기
  const { outcome } = await deferredPrompt.userChoice;
  // 결과 확인 후 prompt 초기화
  deferredPrompt = null;
  return outcome === 'accepted';
};