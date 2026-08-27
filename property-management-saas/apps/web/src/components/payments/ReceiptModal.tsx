"use client";

import * as React from "react";
import {
  CheckCircle2,
  Building,
  X,
  FileText,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/shared/Button";
import type { Payment } from "./types";

interface ReceiptModalProps {
  payment: Payment;
  onClose: () => void;
}

export function ReceiptModal({ payment, onClose }: ReceiptModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const printReceipt = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 print:shadow-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-400 via-zinc-900 to-emerald-400 dark:from-emerald-500 dark:via-zinc-100 dark:to-emerald-500" />

        <div className="p-10 pt-8">
          {/* Close Button (Hidden on Print) */}
          <Button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-zinc-400 hover:text-emerald-600 transition-all print:hidden"
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Receipt Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4 shadow-xl">
              <Building className="w-8 h-8 text-white dark:text-zinc-900" />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
              PropertyStack Settlement
            </h3>
            <p className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase mt-1">
              Certified Digital Receipt
            </p>
          </div>

          {/* Amount Display */}
          <div className="text-center mb-10 pb-10 border-b-2 border-dashed border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
              Total Amount Paid
            </p>
            <div className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
              ₦
              {(payment.amountPaid ?? payment.amount).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="inline-flex items-center gap-1.5 mt-4 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/50 uppercase">
              <CheckCircle2 className="w-3 h-3" /> Transaction Success
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-5 mb-10">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Tenant
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.lease?.tenant?.name}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Property
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.lease?.property?.name}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Payment Date
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.paidDate
                  ? new Date(payment.paidDate).toLocaleDateString(undefined, {
                      dateStyle: "long",
                    })
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Method
              </span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.paymentMethod || "Manual Verification"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full flex items-center justify-center gap-4 mb-4">
              <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
              <QrCode className="w-8 h-8 text-zinc-200 dark:text-zinc-800" />
              <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Receipt Number
            </p>
            <p className="text-xs font-mono font-black text-zinc-900 dark:text-zinc-100 tracking-wider">
              {payment.receiptId ||
                `RCPT-${payment.id.split("-")[0].toUpperCase()}`}
            </p>
          </div>

          {payment.transactions && payment.transactions.length > 0 && (
            <div className="mt-8 border-t-2 border-dashed border-zinc-100 dark:border-zinc-800 pt-8">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">
                Transaction History
              </p>
              <div className="space-y-3">
                {payment.transactions.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="font-bold text-zinc-900 dark:text-white">
                      ₦{t.amount.toLocaleString()}
                    </span>
                    <span className="text-zinc-500">
                      {new Date(t.paidDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Hidden on Print) */}
        <div className="flex gap-4 p-8 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
          <Button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 transition-all active:scale-[0.98]"
          >
            Close
          </Button>
          <Button
            onClick={printReceipt}
            className="flex-1 py-3.5 rounded-2xl bg-primary text-white hover:bg-primary/90 text-sm font-black hover:scale-[1.02] transition-all active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> Print PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
