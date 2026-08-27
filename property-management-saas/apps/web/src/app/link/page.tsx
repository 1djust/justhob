"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

/**
 * Action-to-route mapping for deep link resolution.
 * Maps email CTA action names to their web and mobile app equivalents.
 */
const ACTION_ROUTES: Record<
  string,
  { web: (params: URLSearchParams) => string; mobile: (params: URLSearchParams) => string }
> = {
  register: {
    web: (p) => {
      const email = p.get("email");
      return email ? `/register?email=${encodeURIComponent(email)}` : "/register";
    },
    mobile: (p) => {
      const email = p.get("email");
      return email ? `/register?email=${encodeURIComponent(email)}` : "/register";
    },
  },
  login: {
    web: () => "/login",
    mobile: () => "/login",
  },
  dashboard: {
    web: () => "/dashboard",
    mobile: () => "/landlord",
  },
  onboarding: {
    web: () => "/dashboard",
    mobile: () => "/onboarding",
  },
  payments: {
    web: () => "/dashboard",
    mobile: () => "/payments",
  },
};

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.propertystack.mobile";

function detectPlatform(): "android" | "ios" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

function SmartRedirectContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"redirecting" | "fallback">("redirecting");
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");

  useEffect(() => {
    const action = searchParams.get("action") || "login";
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);

    const route = ACTION_ROUTES[action] || ACTION_ROUTES.login;

    if (detectedPlatform === "desktop") {
      // Desktop: immediate redirect to web route
      const webPath = route.web(searchParams);
      window.location.replace(webPath);
      return;
    }

    if (detectedPlatform === "android") {
      // Android: attempt App Link, fallback after timeout
      const origin = typeof window !== "undefined" ? window.location.origin : "https://propertystack.vercel.app";
      const appUrl = `${origin}/link?action=${action}&${searchParams.toString()}`;

      // The App Link intent-filter on Android will intercept this URL if the app is installed.
      // If the app is NOT installed, the browser stays on this page and we show the fallback UI.
      const fallbackTimer = setTimeout(() => {
        setStatus("fallback");
      }, 1500);

      // Try to detect if the app opened (page becomes hidden)
      const handleVisibility = () => {
        if (document.hidden) {
          clearTimeout(fallbackTimer);
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);

      // If we're still here after the app link attempt, redirect to web
      const webFallbackTimer = setTimeout(() => {
        const webPath = route.web(searchParams);
        window.location.replace(webPath);
      }, 3000);

      return () => {
        clearTimeout(fallbackTimer);
        clearTimeout(webFallbackTimer);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }

    // iOS: no Universal Links configured yet, go straight to web
    const webPath = route.web(searchParams);
    window.location.replace(webPath);
  }, [searchParams]);

  if (status === "fallback" && platform !== "desktop") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#EEF2F6",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: "20px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            padding: "40px 28px",
            textAlign: "center",
            boxShadow: "0 4px 24px rgba(10, 25, 47, 0.08)",
            border: "1px solid #E2E8F0",
          }}
        >
          <img
            src="https://raw.githubusercontent.com/1djust/justhob/main/property-management-saas/apps/web/public/images/assets/logo.png"
            alt="PropertyStack"
            style={{ height: 48, marginBottom: 24 }}
          />
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#0A192F",
              margin: "0 0 8px 0",
            }}
          >
            Open in PropertyStack
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "#64748B",
              margin: "0 0 28px 0",
              lineHeight: 1.5,
            }}
          >
            Get the best experience with our mobile app.
          </p>

          {platform === "android" && (
            <a
              href={PLAY_STORE_URL}
              style={{
                display: "block",
                backgroundColor: "#0066FF",
                color: "#FFFFFF",
                padding: "14px 24px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              📲 Get it on Google Play
            </a>
          )}

          {platform === "ios" && (
            <div
              style={{
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 10,
                padding: "14px 20px",
                marginBottom: 16,
                fontSize: 14,
                color: "#1E40AF",
              }}
            >
              📱 App Store version coming soon
            </div>
          )}

          <a
            href={(() => {
              const action = searchParams.get("action") || "login";
              const route = ACTION_ROUTES[action] || ACTION_ROUTES.login;
              return route.web(searchParams);
            })()}
            style={{
              display: "block",
              backgroundColor: "transparent",
              color: "#0066FF",
              padding: "12px 24px",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 15,
              border: "2px solid #0066FF",
            }}
          >
            Continue in Browser →
          </a>
        </div>
      </div>
    );
  }

  // Loading / redirect state
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#EEF2F6",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ textAlign: "center" }}>
        <img
          src="https://raw.githubusercontent.com/1djust/justhob/main/property-management-saas/apps/web/public/images/assets/logo.png"
          alt="PropertyStack"
          style={{ height: 40, marginBottom: 20 }}
        />
        <p style={{ fontSize: 15, color: "#64748B" }}>Redirecting you...</p>
        <div
          style={{
            width: 32,
            height: 32,
            border: "3px solid #E2E8F0",
            borderTopColor: "#0066FF",
            borderRadius: "50%",
            margin: "16px auto 0",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function SmartLinkPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#EEF2F6",
          }}
        >
          <p style={{ color: "#64748B" }}>Loading...</p>
        </div>
      }
    >
      <SmartRedirectContent />
    </Suspense>
  );
}
