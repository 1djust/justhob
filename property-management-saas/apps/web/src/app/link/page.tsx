"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

/**
 * Action-to-route mapping for deep link resolution.
 * Maps email CTA action names to their web and mobile app equivalents.
 */
const ACTION_ROUTES: Record<
  string,
  {
    web: (params: URLSearchParams) => string;
    mobile: (params: URLSearchParams) => string;
  }
> = {
  register: {
    web: (p) => {
      const email = p.get("email");
      const step = p.get("step");
      const query = new URLSearchParams();
      if (email) query.set("email", email);
      if (step) query.set("step", step);
      const qs = query.toString();
      return qs ? `/register?${qs}` : "/register";
    },
    mobile: (p) => {
      const email = p.get("email");
      const step = p.get("step");
      const query = new URLSearchParams();
      if (email) query.set("email", email);
      if (step) query.set("step", step);
      const qs = query.toString();
      return qs ? `register?${qs}` : "register";
    },
  },
  login: {
    web: () => "/login",
    mobile: () => "login",
  },
  dashboard: {
    web: () => "/dashboard",
    mobile: () => "landlord",
  },
  onboarding: {
    web: () => "/dashboard",
    mobile: () => "onboarding",
  },
  payments: {
    web: () => "/dashboard",
    mobile: () => "payments",
  },
};

const DIRECT_APK_URL = "/downloads/propertystack-tenant.apk";

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
  const [isAttemptingApp, setIsAttemptingApp] = useState(false);

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
  }, [searchParams]);

  if (!isClient) {
    return null;
  }

  // Mobile Experience (Android & iOS)
  if (platform !== "desktop") {
    const action = searchParams.get("action") || "login";
    const route = ACTION_ROUTES[action] || ACTION_ROUTES.login;
    const webTargetUrl = route.web(searchParams);

    const customSchemeUrl = `propertystack://link?action=${action}&${searchParams.toString()}`;

    const handleOpenApp = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsAttemptingApp(true);

      const start = Date.now();
      window.location.href = customSchemeUrl;

      // If the app is not installed or scheme not handled, fallback to the web page after a short timeout
      setTimeout(() => {
        setIsAttemptingApp(false);
        // Only redirect to web if document is still visible (meaning app didn't take over)
        if (!document.hidden && Date.now() - start < 2500) {
          window.location.href = webTargetUrl;
        }
      }, 1500);
    };

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
            Continue your property management on your mobile device.
          </p>

          {/* Primary Action Button: Open in Mobile App */}
          <button
            onClick={handleOpenApp}
            disabled={isAttemptingApp}
            style={{
              display: "block",
              width: "100%",
              backgroundColor: isAttemptingApp ? "#93C5FD" : "#0066FF",
              color: "#FFFFFF",
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              cursor: isAttemptingApp ? "wait" : "pointer",
              fontWeight: 600,
              fontSize: 15,
              marginBottom: 12,
              boxShadow: "0 4px 14px rgba(0, 102, 255, 0.25)",
              transition: "all 0.2s ease",
            }}
          >
            {isAttemptingApp ? "Opening App..." : "Open in Mobile App"}
          </button>

          {/* Secondary Action: Continue in Browser */}
          <a
            href={webTargetUrl}
            style={{
              display: "block",
              backgroundColor: "#F8FAFC",
              color: "#0A192F",
              padding: "13px 20px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              border: "1.5px solid #CBD5E1",
              marginBottom: 20,
              transition: "all 0.2s ease",
            }}
          >
            Continue in Browser →
          </a>

          {/* Direct APK Download helper */}
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 16 }}>
            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 6px 0" }}>
              Need to install or update the app?
            </p>
            <a
              href={DIRECT_APK_URL}
              download
              style={{
                fontSize: 13,
                color: "#0066FF",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Download PropertyStack App (APK) 📥
            </a>
          </div>
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
