"use client";

import * as React from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/shared/Button";
import type { Payment } from "./types";

interface ProofViewerModalProps {
  payment: Payment;
  onClose: () => void;
}

export function ProofViewerModal({ payment, onClose }: ProofViewerModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Proof of Payment
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-zinc-500">
                Submitted by {payment.lease?.tenant?.name} • ₦
                {payment.amount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </p>
              {payment.amountPaid &&
                payment.amountPaid > 0 &&
                payment.amountPaid < payment.amount && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                    Partial Paid: ₦
                    {payment.amountPaid.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                )}
            </div>
          </div>
          <Button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Proof Image */}
        <div className="p-6 flex items-center justify-center overflow-auto max-h-[60vh]">
          {payment.proofUrl ? (
            <img
              src={payment.proofUrl}
              alt="Proof of payment"
              className="max-w-full max-h-full rounded-xl object-contain border border-zinc-200 dark:border-zinc-800"
            />
          ) : (
            <div className="flex flex-col items-center text-zinc-400 py-12">
              <ImageIcon className="w-16 h-16 mb-4" />
              <p className="font-medium">No proof image available</p>
            </div>
          )}
        </div>

        {/* Note if present */}
        {payment.note && (
          <div className="px-6 pb-6">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                Tenant Note
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {payment.note}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
