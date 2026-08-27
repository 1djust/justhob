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
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const action = searchParams.get("action") || "login";
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);

    const route = ACTION_ROUTES[action] || ACTION_ROUTES.login;

    // Desktop users: Instant seamless redirect directly to the web app
    if (detectedPlatform === "desktop") {
      const webPath = route.web(searchParams);
      window.location.replace(webPath);
      return;
    }

    // Mobile users (Android / iOS):
    // Stay on this clean mobile options card so the user can freely choose
    // whether to open in the native app / Google Play or continue in the browser.
  }, [searchParams]);

  if (!isClient) {
    return null;
  }

  // Mobile Experience (Android & iOS)
  if (platform !== "desktop") {
    const action = searchParams.get("action") || "login";
    const route = ACTION_ROUTES[action] || ACTION_ROUTES.login;
    const webTargetUrl = route.web(searchParams);

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
          padding: "24px 16px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: "36px 24px",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(10, 25, 47, 0.08)",
            border: "1px solid #E2E8F0",
          }}
        >
          {/* Official PropertyStack Logo */}
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
            <img
              src="/images/assets/logo.png"
              alt="PropertyStack Logo"
              style={{
                height: 48,
                width: "auto",
                objectFit: "contain",
              }}
              onError={(e) => {
                // Fallback to github asset if local path differs
                (e.target as HTMLImageElement).src =
                  "https://raw.githubusercontent.com/1djust/justhob/main/property-management-saas/apps/web/public/images/assets/logo.png";
              }}
            />
          </div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#0A192F",
              margin: "0 0 8px 0",
              letterSpacing: "-0.3px",
            }}
          >
            Open in PropertyStack
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#64748B",
              margin: "0 0 28px 0",
              lineHeight: 1.5,
            }}
          >
            Get the best experience with the official PropertyStack mobile app.
          </p>

          {/* Primary Mobile CTA: Google Play */}
          {platform === "android" && (
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                backgroundColor: "#0066FF",
                color: "#FFFFFF",
                padding: "14px 20px",
                borderRadius: 12,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 15,
                marginBottom: 14,
                boxShadow: "0 4px 14px rgba(0, 102, 255, 0.25)",
              }}
            >
              <span>📲</span> Get it on Google Play
            </a>
          )}

          {platform === "ios" && (
            <div
              style={{
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 14,
                fontSize: 13,
                color: "#1E40AF",
                fontWeight: 500,
              }}
            >
              📱 iOS App Store version coming soon
            </div>
          )}

          {/* Secondary CTA: Continue in Browser */}
          <a
            href={webTargetUrl}
            style={{
              display: "block",
              backgroundColor: "#F8FAFC",
              color: "#0066FF",
              padding: "13px 20px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              border: "1.5px solid #0066FF",
              transition: "all 0.2s ease",
            }}
          >
            Continue in Browser →
          </a>
        </div>
      </div>
    );
  }

  // Desktop Loading Spinner while immediate redirect executes
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
          src="/images/assets/logo.png"
          alt="PropertyStack"
          style={{ height: 44, marginBottom: 16, objectFit: "contain" }}
        />
        <p style={{ fontSize: 14, color: "#64748B" }}>Opening PropertyStack...</p>
        <div
          style={{
            width: 28,
            height: 28,
            border: "3px solid #E2E8F0",
            borderTopColor: "#0066FF",
            borderRadius: "50%",
            margin: "12px auto 0",
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
