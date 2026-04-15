'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Building2, 
  Users, 
  Wrench, 
  Receipt, 
  ArrowRight,
  ShieldCheck,
  Smartphone,
  PieChart,
  Download,
  Sparkles,
  Zap,
  Camera,
  LogOut
} from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { DashboardCarousel } from './DashboardCarousel';
import { PricingSection } from './PricingSection';

export function LandingPage() {
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 top-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">EstateOS</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary/20 text-primary text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wider">
                New Release
              </span>
              <span className="text-sm font-medium text-muted-foreground">Version 0.1.4</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
              <Link href="/login" className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-medium transition-colors shadow-md shadow-indigo-600/20">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-white to-white dark:from-indigo-900/20 dark:via-slate-950 dark:to-slate-950 -z-10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-3xl mx-auto"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-indigo-100 dark:border-indigo-800/50">
              <ShieldCheck className="h-4 w-4" />
              <span>The #1 Choice for Modern Property Managers</span>
            </motion.div>
            
            <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
              Property Management, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Simplified.</span>
            </motion.h1>
            
            <motion.p variants={fadeInUp} className="text-xl text-slate-600 dark:text-slate-300 md:leading-relaxed mb-10">
              Connect landlords and tenants seamlessly. Automate rent tracking, manage maintenance requests, and generate digital invoices all in one elegant platform.
            </motion.p>
            
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link href="/register" className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50">
                <span>Start for Free</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="/downloads/estateos-tenant.apk" download className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 rounded-full font-semibold text-lg text-slate-700 dark:text-slate-200 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 transition-all shadow-sm">
                <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>Download App (v0.1.4)</span>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to run your properties</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              We've built all the essential tools into one cohesive platform so you can stop switching between spreadsheets and emails.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <PieChart className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
                title: "Financial Dashboard",
                desc: "Get a clear view of your cash flow, pending payments, and overall property performance."
              },
              {
                icon: <Receipt className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
                title: "Digital Invoices",
                desc: "Automatically generate receipts for online and offline offline rent payments."
              },
              {
                icon: <Wrench className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
                title: "Maintenance Tracking",
                desc: "Tenants can report issues easily; managers can track resolutions seamlessly."
              },
              {
                icon: <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
                title: "Tenant Portal",
                desc: "Give your renters a modern dedicated mobile app for payments and communication."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }
                }}
                className="bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow group"
              >
                <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What's New Section */}
      <section className="py-24 relative overflow-hidden bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="flex flex-col md:flex-row md:items-center justify-between mb-12 border-b border-indigo-100 dark:border-indigo-900/50 pb-6 gap-4"
          >
            <div>
               <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-4 py-1.5 rounded-full text-sm font-bold mb-4">
                 <Sparkles className="h-4 w-4" />
                 <span>Version 0.1.4 Released</span>
               </div>
               <h2 className="text-3xl md:text-4xl font-bold">What's New in EstateOS</h2>
            </div>
            <div className="hidden md:block">
              <Link href="/register" className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center space-x-1 hover:text-indigo-700 dark:hover:text-indigo-300">
                <span>Explore all updates</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.5 } } }}
              className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-6 items-start hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
               <div className="p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                 <Smartphone className="h-8 w-8" />
               </div>
               <div>
                 <h3 className="text-xl font-bold mb-2">Dedicated Tenant App</h3>
                 <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">Our massively updated Android app is now available. Tenants can securely login, review open balances, and coordinate with management seamlessly from their phones.</p>
                 <a href="/downloads/estateos-tenant.apk" download className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm hover:underline flex items-center space-x-1">
                   <span>Download v0.1.4 directly</span>
                   <Download className="h-4 w-4" />
                 </a>
               </div>
            </motion.div>
            
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.5, delay: 0.1 } } }}
              className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-6 items-start hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
               <div className="p-4 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                 <Receipt className="h-8 w-8" />
               </div>
               <div>
                 <h3 className="text-xl font-bold mb-2">Instant Digital Receipts</h3>
                 <p className="text-slate-600 dark:text-slate-400 leading-relaxed">No more manual invoicing. Automatically generate formal, printable PDF receipts the second a rental payment is approved online or offline.</p>
               </div>
            </motion.div>

            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.5, delay: 0.2 } } }}
              className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-6 items-start hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
               <div className="p-4 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                 <Camera className="h-8 w-8" />
               </div>
               <div>
                 <h3 className="text-xl font-bold mb-2">Visual Maintenance Reporting</h3>
                 <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Tenants can now skip the lengthy descriptions and snap direct photos of maintenance issues from the updated Android app to accelerate resolution times.</p>
               </div>
            </motion.div>

            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.5, delay: 0.3 } } }}
              className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-6 items-start hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
               <div className="p-4 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                 <ShieldCheck className="h-8 w-8" />
               </div>
               <div>
                 <h3 className="text-xl font-bold mb-2">Advanced Security Controls</h3>
                 <p className="text-slate-600 dark:text-slate-400 leading-relaxed">Manager dashboards now include strict database isolation and animated safety prompts for destructive actions, preventing accidental property scale changes.</p>
               </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Two Types of Users */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Manager Perspective */}
          <div className="flex flex-col lg:flex-row items-center gap-16 mb-32">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: -50 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.6 } }
              }}
              className="lg:w-1/2"
            >
              <div className="inline-flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Building2 className="h-4 w-4" />
                <span>For Property Managers</span>
              </div>
              <h2 className="text-4xl font-bold mb-6">Complete control at your fingertips</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                The manager's web dashboard provides an eagle-eye view of your entire portfolio. Monitor rent collection trends, assign units to tenants, generate official payment invoices, and handle maintenance tickets efficiently.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "Visual rent tracking charts",
                  "One-click invoice generation for offline payments",
                  "Centralized tenant management table",
                ].map((item, i) => (
                  <li key={i} className="flex items-center space-x-3 text-slate-700 dark:text-slate-300">
                    <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: 50 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.6, delay: 0.2 } }
              }}
              className="lg:w-1/2 relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-[2rem] opacity-20 blur-2xl" />
              <div className="relative">
                <DashboardCarousel />
              </div>
            </motion.div>
          </div>

          {/* Tenant Perspective */}
          <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: 50 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.6 } }
              }}
              className="lg:w-1/2"
            >
              <div className="inline-flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Smartphone className="h-4 w-4" />
                <span>For Tenants</span>
              </div>
              <h2 className="text-4xl font-bold mb-6">A mobile app they'll actually love</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                Give your tenants a modern mobile experience. They can log in from their phones, view upcoming rent dues, upload payment proofs, access digital receipts, and submit maintenance photos seamlessly.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "Digital rent receipts generation",
                  "Direct maintenance request submission",
                  "Secure mandatory password reset flows",
                ].map((item, i) => (
                  <li key={i} className="flex items-center space-x-3 text-slate-700 dark:text-slate-300">
                    <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="/downloads/estateos-tenant.apk" download className="inline-flex items-center justify-center w-full sm:w-auto space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50">
                <Download className="h-5 w-5" />
                <span>Download Android App (v0.1.0)</span>
              </a>
            </motion.div>
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0, x: -50 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.6, delay: 0.2 } }
              }}
              className="lg:w-1/2 relative flex justify-center"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2rem] opacity-20 blur-2xl" />
              <img 
                src="/tenant-app.png" 
                alt="Tenant Mobile App Mockup" 
                className="relative rounded-[2.5rem] shadow-2xl border-8 border-slate-900 dark:border-slate-800 object-cover w-64 md:w-80 h-auto"
              />
            </motion.div>
          </div>

        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it Works</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">Get up and running in three simple steps.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-indigo-200 via-indigo-600 to-indigo-200 dark:from-indigo-900 dark:via-indigo-500 dark:to-indigo-900 opacity-50" />
            
            {[
              {
                step: "01",
                title: "Register Properties",
                desc: "Sign up and add your units. Define rent amounts and lease periods securely via the web dashboard."
              },
              {
                step: "02",
                title: "Onboard Tenants",
                desc: "Assign units to tenants. They'll gain access to the integrated mobile app instantly."
              },
              {
                step: "03",
                title: "Automate & Relax",
                desc: "Watch rent payments roll in on the visual tracker. Generate invoices with a single click."
              }
            ].map((step, i) => (
              <motion.div 
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { delay: i * 0.2, duration: 0.5 } }
                }}
                className="relative text-center z-10"
              >
                <div className="w-24 h-24 mx-auto bg-white dark:bg-slate-950 rounded-full border-4 border-indigo-100 dark:border-indigo-900/50 shadow-xl flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{step.step}</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 px-4">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-600 dark:bg-indigo-900 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to scale your portfolio?</h2>
          <p className="text-xl text-indigo-100 mb-10">Join thousands of property managers modernizing their operations with EstateOS.</p>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link href="/register" className="bg-white text-indigo-600 hover:bg-slate-100 px-8 py-4 rounded-full font-bold text-lg transition-colors w-full sm:w-auto shadow-xl">
              Create Free Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Building2 className="h-6 w-6 text-indigo-600" />
            <span className="font-bold text-xl">EstateOS</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} EstateOS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
