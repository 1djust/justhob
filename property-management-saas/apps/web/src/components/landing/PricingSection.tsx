'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, CreditCard, Building, Copy, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Free',
    price: '₦0',
    description: 'Perfect for getting started with a small property',
    features: [
      { name: '1 Property', included: true },
      { name: 'Up to 3 Units', included: true },
      { name: 'Up to 3 Tenants', included: true },
      { name: 'Basic Rent Payment Tracking', included: true },
      { name: '3 active Maintenance Tickets', included: true },
      { name: '5 Invoices / month', included: true },
      { name: 'Digital Receipts', included: true },
      { name: 'Tenant Mobile App', included: true },
      { name: 'Revenue Charts & Analytics', included: false },
      { name: 'Priority Support', included: false },
    ],
    buttonText: 'Get Started',
    buttonHref: '/register',
    popular: false,
  },
  {
    name: 'Pro',
    price: '₦3,000',
    period: '/mo',
    description: 'For growing landlords managing multiple properties',
    features: [
      { name: 'Up to 10 Properties', included: true },
      { name: 'Up to 50 Units', included: true },
      { name: 'Up to 50 Tenants', included: true },
      { name: 'Advanced Rent Payment Tracking', included: true },
      { name: 'Unlimited Maintenance Tickets', included: true },
      { name: 'Unlimited Invoices', included: true },
      { name: 'Digital Receipts', included: true },
      { name: 'Tenant Mobile App', included: true },
      { name: 'Revenue Charts & Analytics', included: true },
      { name: 'Email Notifications', included: true },
    ],
    buttonText: 'Upgrade Now',
    buttonAction: 'open-modal',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '₦10,000',
    period: '/mo',
    description: 'For property companies and estate managers',
    features: [
      { name: 'Unlimited Properties', included: true },
      { name: 'Unlimited Units', included: true },
      { name: 'Unlimited Tenants', included: true },
      { name: 'Advanced Rent Payment Tracking', included: true },
      { name: 'Unlimited Maintenance Tickets', included: true },
      { name: 'Unlimited Invoices', included: true },
      { name: 'Digital Receipts', included: true },
      { name: 'Tenant Mobile App', included: true },
      { name: 'Data Export (CSV/PDF)', included: true },
      { name: 'Priority Support (WhatsApp)', included: true },
    ],
    buttonText: 'Contact Us',
    buttonAction: 'open-modal',
    popular: false,
  },
];

export function PricingSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const bankDetails = {
    bank: 'Opay',
    accountNumber: '08782188',
    accountName: 'Babatunde Justus',
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(bankDetails.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Choose the plan that fits your property portfolio. No hidden fees. Start for free and upgrade when you need more power.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2, duration: 0.5 }}
              className={`relative flex flex-col p-8 rounded-3xl border ${
                plan.popular 
                  ? 'border-indigo-600 shadow-xl shadow-indigo-600/10 dark:shadow-indigo-600/20 bg-white dark:bg-slate-900 border-2' 
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-semibold inline-flex items-center space-x-1 shadow-lg">
                  <span>Most Popular</span>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm h-10">{plan.description}</p>
              </div>
              
              <div className="mb-8">
                <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                {plan.period && <span className="text-slate-500 dark:text-slate-400 font-medium">{plan.period}</span>}
              </div>

              <ul className="space-y-4 mb-8 flex-grow">
                {plan.features.map((feature) => (
                  <li key={feature.name} className="flex items-start space-x-3 text-sm">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-slate-300 dark:text-slate-700 flex-shrink-0" />
                    )}
                    <span className={feature.included ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600 line-through'}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.buttonAction === 'open-modal' ? (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className={`w-full py-4 rounded-full font-semibold transition-all flex items-center justify-center space-x-2 ${
                    plan.popular
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{plan.buttonText}</span>
                  {plan.popular && <ArrowRight className="h-4 w-4" />}
                </button>
              ) : (
                <Link
                  href={plan.buttonHref || '#'}
                  className={`w-full py-4 rounded-full font-semibold transition-all flex items-center justify-center space-x-2 ${
                    plan.popular
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{plan.buttonText}</span>
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 md:p-10 max-w-lg w-full border border-slate-200 dark:border-slate-800"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
                <CreditCard className="h-8 w-8" />
              </div>

              <h3 className="text-2xl font-bold mb-2">Upgrade Your Plan</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                To activate the Pro or Enterprise plan, please make a bank transfer to the account below. Your account will automatically be upgraded once payment is confirmed.
              </p>

              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 flex items-center space-x-2">
                      <Building className="h-4 w-4" />
                      <span>Bank Name</span>
                    </p>
                    <p className="font-semibold text-lg">{bankDetails.bank}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Account Number</p>
                    <div className="flex items-center justify-between">
                      <p className="font-mono font-bold text-2xl tracking-wider text-indigo-600 dark:text-indigo-400">
                        {bankDetails.accountNumber}
                      </p>
                      <button
                        onClick={handleCopy}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300 flex items-center justify-center"
                        title="Copy account number"
                      >
                        {copied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Account Name</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                      {bankDetails.accountName}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-full font-semibold transition-colors shadow-lg shadow-indigo-600/20"
              >
                I've made the transfer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
