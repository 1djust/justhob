"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, CreditCard, Building, Copy, ArrowRight } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    prices: {
      monthly: { price: "₦0", period: "/mo", total: "₦0", sublabel: "" },
      yearly: { price: "₦0", period: "/yr", total: "₦0", sublabel: "" },
    },
    description: "Perfect for getting started with a small property",
    features: [
      { name: "1 Property", included: true },
      { name: "Up to 3 Units", included: true },
      { name: "Up to 3 Tenants", included: true },
      { name: "1 Owner", included: true },
      { name: "Basic Rent Payment Tracking", included: true },
      { name: "3 active Maintenance Tickets", included: true },
      { name: "5 Invoices / month", included: true },
      { name: "Digital Receipts", included: true },
      { name: "Tenant Mobile App", included: true },
      { name: "Two-Factor Auth (MFA)", included: true },
      { name: "Biometric Login", included: true },
      { name: "Real-Time Sync", included: true },
      { name: "Revenue Charts & Analytics", included: false },
      { name: "Data Export (CSV/PDF)", included: false },
    ],
    buttonText: "Get Started",
    buttonHref: "/register",
    popular: false,
  },
  {
    name: "Pro",
    prices: {
      monthly: { price: "₦5,000", period: "/mo", total: "₦5,000", sublabel: "" },
      yearly: {
        price: "₦54,000",
        period: "/yr",
        total: "₦54,000",
        sublabel: "₦4,500/mo — Save ₦6,000/yr",
      },
    },
    description: "For growing landlords managing multiple properties",
    features: [
      { name: "Up to 10 Properties", included: true },
      { name: "Up to 50 Units", included: true },
      { name: "Up to 50 Tenants", included: true },
      { name: "Up to 3 Owners", included: true },
      { name: "Advanced Rent Payment Tracking", included: true },
      { name: "Unlimited Maintenance Tickets", included: true },
      { name: "Unlimited Invoices", included: true },
      { name: "Digital Receipts", included: true },
      { name: "Tenant Mobile App", included: true },
      { name: "Two-Factor Auth (MFA)", included: true },
      { name: "Biometric Login", included: true },
      { name: "Real-Time Sync", included: true },
      { name: "Email Notifications", included: true },
      { name: "Revenue Charts & Analytics", included: true },
      { name: "Data Export (CSV/PDF)", included: false },
    ],
    buttonText: "Upgrade Now",
    buttonAction: "open-modal",
    popular: true,
  },
  {
    name: "Enterprise",
    prices: {
      monthly: { price: "₦10,000", period: "/mo", total: "₦10,000", sublabel: "" },
      yearly: {
        price: "₦108,000",
        period: "/yr",
        total: "₦108,000",
        sublabel: "₦9,000/mo — Save ₦12,000/yr",
      },
    },
    description: "For property companies and estate managers",
    features: [
      { name: "Unlimited Properties", included: true },
      { name: "Unlimited Units", included: true },
      { name: "Unlimited Tenants", included: true },
      { name: "Unlimited Owners", included: true },
      { name: "Advanced Rent Payment Tracking", included: true },
      { name: "Unlimited Maintenance Tickets", included: true },
      { name: "Unlimited Invoices", included: true },
      { name: "Digital Receipts", included: true },
      { name: "Tenant Mobile App", included: true },
      { name: "Two-Factor Auth (MFA)", included: true },
      { name: "Biometric Login", included: true },
      { name: "Real-Time Sync", included: true },
      { name: "Data Export (CSV/PDF)", included: true },
      { name: "Revenue Charts & Analytics", included: true },
      { name: "Priority Support", included: true },
    ],
    buttonText: "Contact Us",
    buttonAction: "open-modal",
    popular: false,
  },
];

export function PricingSection() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<{
    name: string;
    price: string;
    totalAmount: string;
    interval: "monthly" | "yearly";
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const bankDetails = {
    bank: "Opay",
    accountNumber: "08782188",
    accountName: "Babatunde Justus",
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(bankDetails.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpgradeClick = (plan: typeof plans[0]) => {
    const currentPrices = plan.prices[billingInterval];
    setSelectedPlan({
      name: plan.name,
      price: currentPrices.price,
      totalAmount: currentPrices.total,
      interval: billingInterval,
    });
  };

  return (
    <section
      id="pricing"
      className="py-24 relative overflow-hidden"
      aria-label="Pricing Section"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Choose the plan that fits your property portfolio. No hidden fees.
            Start for free and upgrade when you need more power.
          </p>
        </div>

        {/* Dynamic Billing Toggle Switch */}
        <div className="flex justify-center mb-12">
          <div className="relative flex p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={`relative px-5 py-2.5 text-xs font-bold transition-all rounded-xl cursor-pointer ${
                billingInterval === "monthly"
                  ? "text-indigo-600 dark:text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {billingInterval === "monthly" && (
                <motion.div
                  layoutId="billing-pill"
                  className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200/40 dark:border-slate-700/40"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">Monthly Billing</span>
            </button>

            <button
              onClick={() => setBillingInterval("yearly")}
              className={`relative px-5 py-2.5 text-xs font-bold transition-all rounded-xl cursor-pointer flex items-center gap-2 ${
                billingInterval === "yearly"
                  ? "text-indigo-600 dark:text-white"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {billingInterval === "yearly" && (
                <motion.div
                  layoutId="billing-pill"
                  className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200/40 dark:border-slate-700/40"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                Yearly Billing
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Save 10%
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const pricing = plan.prices[billingInterval];
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className={`relative flex flex-col p-8 rounded-3xl border ${
                  plan.popular
                    ? "border-indigo-600 shadow-xl shadow-indigo-600/10 dark:shadow-indigo-600/20 bg-white dark:bg-slate-900 border-2"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-semibold inline-flex items-center space-x-1 shadow-lg">
                    <span>Most Popular</span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm h-10">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-8 flex flex-col justify-end min-h-[64px]">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-extrabold tracking-tight">
                      {pricing.price}
                    </span>
                    {pricing.period && (
                      <span className="text-slate-500 dark:text-slate-400 font-medium ml-1">
                        {pricing.period}
                      </span>
                    )}
                  </div>
                  {pricing.sublabel ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5 animate-in fade-in duration-300">
                      {pricing.sublabel}
                    </p>
                  ) : (
                    <div className="h-4 mt-1.5" />
                  )}
                </div>

                <ul className="space-y-4 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.name}
                      className="flex items-start space-x-3 text-sm"
                    >
                      {feature.included ? (
                        <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-slate-300 dark:text-slate-700 flex-shrink-0" />
                      )}
                      <span
                        className={
                          feature.included
                            ? "text-slate-700 dark:text-slate-300"
                            : "text-slate-400 dark:text-slate-600 line-through"
                        }
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.buttonAction === "open-modal" ? (
                  <button
                    onClick={() => handleUpgradeClick(plan)}
                    className={`w-full py-4 rounded-full font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                      plan.popular
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{plan.buttonText}</span>
                    {plan.popular && <ArrowRight className="h-4 w-4" />}
                  </button>
                ) : (
                  <Link
                    href={plan.buttonHref || "#"}
                    className={`w-full py-4 rounded-full font-semibold transition-all flex items-center justify-center space-x-2 ${
                      plan.popular
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{plan.buttonText}</span>
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlan(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 md:p-10 max-w-lg w-full border border-slate-200 dark:border-slate-800"
            >
              <button
                onClick={() => setSelectedPlan(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
                <CreditCard className="h-8 w-8" />
              </div>

              <h3 className="text-2xl font-bold mb-2">Upgrade to {selectedPlan.name}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm leading-relaxed">
                To activate the <strong>{selectedPlan.name} ({selectedPlan.interval === "monthly" ? "Monthly" : "Yearly"})</strong> plan, please make a bank transfer to the account details below.
              </p>

              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 mb-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 flex items-center space-x-1">
                        <Building className="h-3.5 w-3.5" />
                        <span>Bank Name</span>
                      </p>
                      <p className="font-bold text-sm text-foreground">{bankDetails.bank}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                        Billing Period
                      </p>
                      <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                        {selectedPlan.interval === "monthly" ? "Monthly" : "Yearly"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Account Number
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="font-mono font-bold text-xl tracking-wider text-slate-800 dark:text-slate-200">
                        {bankDetails.accountNumber}
                      </p>
                      <button
                        onClick={handleCopy}
                        className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                        title="Copy account number"
                      >
                        {copied ? (
                          <Check className="h-4.5 w-4.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-4.5 w-4.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                      Account Name
                    </p>
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                      {bankDetails.accountName}
                    </p>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                        Transfer Amount
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedPlan.interval === "yearly" ? "Billed annually" : "Billed monthly"}
                      </p>
                    </div>
                    <p className="font-black text-2xl text-indigo-600 dark:text-indigo-400 font-mono">
                      {selectedPlan.totalAmount}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlan(null)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-full font-semibold transition-colors shadow-lg shadow-indigo-600/20 cursor-pointer text-sm"
              >
                I&apos;ve made the transfer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
