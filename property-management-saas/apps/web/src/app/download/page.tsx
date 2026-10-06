import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Download PropertyStack Mobile App for Android",
  description: "Get the official PropertyStack mobile application for tenants and landlords.",
};

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center p-2 group-hover:scale-105 transition-transform">
            <Image
              src="/icon.png"
              alt="PropertyStack Logo"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-white block">PropertyStack</span>
            <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold block">Mobile Download Center</span>
          </div>
        </Link>
        <Link
          href="/login"
          className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          Web Sign In &rarr;
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 flex flex-col items-center justify-center text-center">
        {/* Release Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Official Android Release &bull; Version 0.3.5
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Property Management in Your Pocket
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-lg mb-8 leading-relaxed">
          Access your tenancy, review digital lease agreements, submit maintenance requests, and track rent receipts anytime from your Android smartphone.
        </p>

        {/* Primary Download Card */}
        <div className="w-full bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-xl shadow-slate-950/50 mb-8 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">PropertyStack for Android</h2>
              <p className="text-xs text-slate-400">Package: propertystack-tenant.apk &bull; Size: ~25 MB &bull; Android 8.0+</p>
            </div>
            <a
              href="/downloads/propertystack-tenant.apk"
              download="propertystack-tenant.apk"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-95 text-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download APK Now
            </a>
          </div>

          {/* Quick Installation Steps */}
          <div className="pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Quick Setup Guide</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center mb-2">1</div>
                <p className="font-semibold text-white mb-1">Download APK</p>
                <p className="text-slate-400 text-[11px]">Tap the download button above on your Android phone.</p>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center mb-2">2</div>
                <p className="font-semibold text-white mb-1">Install App</p>
                <p className="text-slate-400 text-[11px]">Open the downloaded file in your browser downloads and tap Install.</p>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center mb-2">3</div>
                <p className="font-semibold text-white mb-1">Sign In</p>
                <p className="text-slate-400 text-[11px]">Enter your email and temporary password sent to your inbox.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Portal Access */}
        <p className="text-xs text-slate-500">
          Using a computer or tablet?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 underline font-medium">
            Sign in on the Web Portal instead
          </Link>
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 px-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} PropertyStack Inc. All rights reserved. &bull; <Link href="/" className="hover:text-slate-400">Home</Link> &bull; <Link href="/login" className="hover:text-slate-400">Web Login</Link>
      </footer>
    </div>
  );
}
