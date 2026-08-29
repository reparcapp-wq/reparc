"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

export type PwaLifecycle = {
  installed: boolean;
  installAvailable: boolean;
  iosInstallHelp: boolean;
  updateAvailable: boolean;
  installing: boolean;
  install: () => Promise<void>;
  applyUpdate: () => void;
};

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches
  || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_CHECK_THROTTLE_MS = 60 * 1000;

export function usePwa(): PwaLifecycle {
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && isStandalone());
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installing, setInstalling] = useState(false);
  const applyingUpdate = useRef(false);

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let lastUpdateCheck = 0;

    const checkForUpdate = (force = false) => {
      if (!registration || !navigator.onLine) return;
      const now = Date.now();
      if (!force && now - lastUpdateCheck < UPDATE_CHECK_THROTTLE_MS) return;
      lastUpdateCheck = now;
      void registration.update().catch(() => undefined);
    };

    const observe = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(worker);
        });
      });
    };
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((nextRegistration) => {
        if (disposed) return;
        registration = nextRegistration;
        observe(nextRegistration);
        checkForUpdate(true);
      })
      .catch(() => undefined);

    const checkWhenActive = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    const checkWhenOnline = () => checkForUpdate(true);
    const updateInterval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    const controllerChanged = () => {
      if (applyingUpdate.current) window.location.reload();
    };
    window.addEventListener("focus", checkWhenActive);
    window.addEventListener("online", checkWhenOnline);
    document.addEventListener("visibilitychange", checkWhenActive);
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    return () => {
      disposed = true;
      window.clearInterval(updateInterval);
      window.removeEventListener("focus", checkWhenActive);
      window.removeEventListener("online", checkWhenOnline);
      document.removeEventListener("visibilitychange", checkWhenActive);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    setInstalling(true);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
    } finally {
      setInstalling(false);
    }
  }, [promptEvent]);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    applyingUpdate.current = true;
    waitingWorker.postMessage("SKIP_WAITING");
  }, [waitingWorker]);

  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    installed,
    installAvailable: Boolean(promptEvent),
    iosInstallHelp: ios && !installed && !promptEvent,
    updateAvailable: Boolean(waitingWorker),
    installing,
    install,
    applyUpdate,
  };
}
