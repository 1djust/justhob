"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Building2,
  Users,
  Wrench,
  Receipt,
  ArrowRight,
  Smartphone,
  PieChart,
  Download,
  Sparkles,
  Mail,
  CheckCircle2,
  MessageSquare
} from "lucide-react";
import { ThemeToggle } from "../ThemeToggle";
import { DashboardCarousel } from "./DashboardCarousel";
import { PricingSection } from "./PricingSection";

export function LandingPage() {
  const [version, setVersion] = useState("0.1.7");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/downloads/version.json")
      .then((res) => res.json())
      .then((data) => {
        if (data.latestVersion) {
          setVersion(data.latestVersion);
        }
      })
      .catch(() => { /* version fetch failed silently */ });
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiUrl}/api/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.exists) {
        router.push(`/login?email=${encodeURIComponent(email)}`);
      } else {
        router.push(`/register?email=${encodeURIComponent(email)}`);
      }
    } catch (_err: unknown) {
      router.push(`/register?email=${encodeURIComponent(email)}`);
    } finally {
      setLoading(false);
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  return (
    <div
      className="min-h-screen bg-white dark:bg-[#060B19] text-slate-900 dark:text-slate-100 selection:bg-primary/30 selection:text-primary relative overflow-x-hidden"
      aria-label="Landing Page"
    >
      {/* 
        Massive SVG Background Shape mimicking Innago style
        Adapts dynamically between light/dark mode by using bg-primary with opacity changes.
      */}
      <div className="absolute top-0 right-0 w-[150%] h-[900px] md:w-[120%] lg:w-[65%] lg:h-[950px] z-0 pointer-events-none origin-top-right">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-primary dark:fill-primary/20">
          <path d="M0,0 L100,0 L100,100 C70,100 40,70 20,40 C10,25 5,10 0,0 Z" />
        </svg>
        <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[120px] mix-blend-screen hidden dark:block"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 pt-6 pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <img src="/images/assets/logo.png" alt="PropertyStack Logo" className="h-10 w-auto" />
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
                PropertyStack
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-white">
              <Link href="#features" className="hover:opacity-80 transition-opacity">Features</Link>
              <Link href="#how-it-works" className="hover:opacity-80 transition-opacity">How it Works</Link>
              <Link href="#pricing" className="hover:opacity-80 transition-opacity">Pricing</Link>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-white">
                <ThemeToggle />
              </div>
              <Link
                href="/login"
                className="font-medium text-white hover:opacity-80 transition-opacity"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white px-5 py-2 rounded-full font-bold transition-all shadow-md"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-24 md:pb-32 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center">
            
            {/* Left Column: Text & CTA */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="max-w-xl"
            >
              <motion.h1
                variants={fadeInUp}
                className="text-5xl md:text-6xl lg:text-[4rem] font-medium tracking-tight mb-6 text-slate-800 dark:text-slate-100 leading-[1.1]"
              >
                Scale Your Portfolio <br className="hidden sm:block" />
                with <span className="font-extrabold text-primary dark:text-blue-400">Intelligent Automation</span>
              </motion.h1>

              <motion.div variants={fadeInUp} className="bg-slate-100/80 dark:bg-slate-900/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-sm mb-8 mt-10">
                <h2 className="text-2xl font-bold mb-2">Turn operational chaos into cash flow.</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">Manage units, collect rent automatically, and delight tenants with our unified platform.</p>
                
                <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0A192F] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-bold transition-all whitespace-nowrap shadow-lg shadow-primary/25 flex items-center justify-center disabled:opacity-70"
                  >
                    {loading ? "Checking..." : "Get Started Free"} <ArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </form>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-4 font-medium">No credit card required</p>
              </motion.div>
            </motion.div>

            {/* Right Column: Floating UI Elements / Abstract Composition */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative h-[500px] lg:h-[600px] w-full flex items-center justify-center"
            >
              {/* Abstract Floating Composition */}
              <div className="relative w-full h-full max-w-lg mx-auto">
                
                {/* Center Main Dashboard Card */}
                <motion.div 
                  animate={{ y: [0, -10, 0] }} 
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 bg-white dark:bg-[#0A192F] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 z-20"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center text-primary dark:text-primary">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Payment Success</div>
                      <div className="text-xs text-slate-500">Rent paid by Sarah J.</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full w-full"></div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full w-4/5"></div>
                  </div>
                </motion.div>

                {/* Top Right Chart Card */}
                <motion.div 
                  animate={{ y: [0, 10, 0] }} 
                  transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                  className="absolute top-16 right-4 w-48 bg-white dark:bg-[#0A192F] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-5 z-10"
                >
                  <div className="flex justify-between items-center mb-4">
                    <PieChart className="w-8 h-8 text-primary" />
                    <span className="text-primary font-bold text-sm">+14%</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mb-1">$42,500</div>
                  <div className="text-xs text-slate-500">Total Revenue</div>
                </motion.div>

                {/* Bottom Left Tenant Card */}
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 0.5 }}
                  className="absolute bottom-20 left-0 w-64 bg-white dark:bg-[#0A192F] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-5 z-30"
                >
                  <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <Users className="w-5 h-5 text-blue-500" />
                    <span className="font-bold text-sm text-slate-900 dark:text-white">New Tenants</span>
                  </div>
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-24"></div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full w-16"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Bottom Right Message Card */}
                <motion.div 
                  animate={{ y: [0, 12, 0] }} 
                  transition={{ repeat: Infinity, duration: 6.5, ease: "easeInOut", delay: 2 }}
                  className="absolute bottom-12 right-12 w-16 h-16 bg-white dark:bg-[#0A192F] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center z-10"
                >
                  <MessageSquare className="w-8 h-8 text-amber-500" />
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-[#0A192F]"></div>
                </motion.div>

              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Trusted By Section (Social Proof) */}
      <section className="border-y border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-6">
            Trusted by innovative property teams
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 hover:opacity-100 transition-opacity duration-500 grayscale hover:grayscale-0">
            <span className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-200 tracking-tight">
              Horizon Estates
            </span>
            <span className="text-xl font-extrabold tracking-tighter text-slate-800 dark:text-slate-200">
              URBAN<span className="font-light">LIVING</span>
            </span>
            <span className="text-xl font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
              <Building2 className="w-6 h-6" /> Peak Properties
            </span>
            <span className="text-2xl font-black italic tracking-widest text-slate-800 dark:text-slate-200">
              NOVACORP
            </span>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section id="features" className="py-24 bg-white dark:bg-[#060B19] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to run your properties
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              We&apos;ve built all the essential tools into one cohesive platform so
              you can stop switching between spreadsheets and emails.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <PieChart className="h-6 w-6 text-primary" />,
                title: "Financial Dashboard",
                desc: "Get a clear view of your cash flow, pending payments, and overall property performance.",
              },
              {
                icon: <Receipt className="h-6 w-6 text-primary" />,
                title: "Digital Invoices",
                desc: "Automatically generate receipts for online and offline rent payments.",
              },
              {
                icon: <Wrench className="h-6 w-6 text-primary" />,
                title: "Maintenance Tracking",
                desc: "Tenants can report issues easily; managers can track resolutions seamlessly.",
              },
              {
                icon: <Users className="h-6 w-6 text-primary" />,
                title: "Tenant Portal",
                desc: "Give your renters a modern dedicated mobile app for payments and communication.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { delay: i * 0.1, duration: 0.5 },
                  },
                }}
                className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all group"
              >
                <div className="h-14 w-14 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What's New Section */}
      <section className="py-24 relative overflow-hidden bg-slate-50 dark:bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="flex flex-col md:flex-row md:items-center justify-between mb-12 border-b border-primary/10 dark:border-primary/20 pb-6 gap-4"
          >
            <div>
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary to-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-bold mb-4 shadow-sm shadow-primary/20">
                <Sparkles className="h-4 w-4" />
                <span>Version {version} Released</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">
                What&apos;s New in PropertyStack
              </h2>
            </div>
            <div className="hidden md:block">
              <span
                onClick={() => (window.location.href = "/register")}
                className="text-primary hover:text-primary/80 font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <span>Explore all updates</span>
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: -20 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.5 } },
              }}
              className="bg-white dark:bg-[#0A192F] rounded-3xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-6 items-start hover:border-primary/30 transition-colors shadow-sm"
            >
              <div className="p-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary">
                <Smartphone className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">Dedicated Tenant App</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  Our massively updated Android app is now available. Tenants
                  can securely login, review open balances, and coordinate with
                  management seamlessly from their phones.
                </p>
                <a
                  href="/downloads/propertystack-tenant.apk"
                  download
                  className="text-primary font-semibold text-sm hover:underline flex items-center space-x-1"
                >
                  <span>Download v{version} directly</span>
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: 20 },
                visible: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: 0.5, delay: 0.1 },
                },
              }}
              className="bg-white dark:bg-[#0A192F] rounded-3xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-6 items-start hover:border-primary/30 transition-colors shadow-sm"
            >
              <div className="p-4 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary">
                <Receipt className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">
                  Instant Digital Receipts
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  No more manual invoicing. Automatically generate formal,
                  printable PDF receipts the second a rental payment is approved
                  online or offline.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Two Types of Users */}
      <section className="py-32 overflow-hidden bg-white dark:bg-[#060B19]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Manager Perspective */}
          <div className="flex flex-col lg:flex-row items-center gap-16 mb-32">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: -50 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.6 } },
              }}
              className="lg:w-1/2"
            >
              <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary dark:text-primary/90 px-4 py-2 rounded-full text-sm font-bold mb-6">
                <Building2 className="h-4 w-4" />
                <span>For Property Managers</span>
              </div>
              <h2 className="text-4xl font-extrabold mb-6 tracking-tight">
                Complete control at your fingertips
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                The manager&apos;s web dashboard provides an eagle-eye view of your
                entire portfolio. Monitor rent collection trends, assign units
                to tenants, generate official payment invoices, and handle
                maintenance tickets efficiently.
              </p>
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: 50 },
                visible: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: 0.6, delay: 0.2 },
                },
              }}
              className="lg:w-1/2 relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-primary to-blue-400 rounded-[2rem] opacity-20 blur-2xl" />
              <div className="relative">
                <DashboardCarousel />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section
        id="how-it-works"
        className="py-24 bg-slate-50 dark:bg-slate-900/30"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              How it Works
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
              Get up and running in three simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20 opacity-50" />

            {[
              {
                step: "01",
                title: "Register Properties",
                desc: "Sign up and add your units. Define rent amounts and lease periods securely via the web dashboard.",
              },
              {
                step: "02",
                title: "Onboard Tenants",
                desc: "Assign units to tenants. They'll gain access to the integrated mobile app instantly.",
              },
              {
                step: "03",
                title: "Automate & Relax",
                desc: "Watch rent payments roll in on the visual tracker. Generate invoices with a single click.",
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { delay: i * 0.2, duration: 0.5 },
                  },
                }}
                className="relative text-center z-10"
              >
                <div className="w-24 h-24 mx-auto bg-white dark:bg-slate-950 rounded-full border-4 border-primary/20 shadow-xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-primary">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 px-4 leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary dark:bg-primary/90 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Ready to scale your portfolio?
          </h2>
          <p className="text-xl text-white/80 mb-10 font-medium">
            Join thousands of property managers modernizing their operations
            with PropertyStack.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link
              href="/register"
              className="bg-white text-primary hover:bg-slate-50 px-8 py-4 rounded-full font-bold text-lg transition-all w-full sm:w-auto shadow-xl hover:-translate-y-0.5"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#060B19] border-t border-slate-200 dark:border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <img src="/images/assets/logo.png" alt="PropertyStack Logo" className="h-8 w-auto" />
            <span className="font-bold text-xl tracking-tight">
              PropertyStack
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            &copy; {new Date().getFullYear()} PropertyStack. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
