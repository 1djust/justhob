'use client';

import * as React from 'react';
import { 
  CreditCard, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  Wallet,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  ThumbsDown,
  X,
  FileCheck,
  FileText,
  Image as ImageIcon,
  QrCode,
  Eye,
  ThumbsUp,
  MoreVertical
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';

interface Lease {
  id: string;
  tenant?: { name: string };
  property?: { name: string };
  unit?: { unitNumber: string };
  yearlyRent?: number;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  dueDate: string;
  paidDate?: string;
  proofUrl?: string;
  rejectionReason?: string;
  receiptId?: string;
  note?: string;
  lease?: {
    tenant?: { id: string; name: string };
    property?: { id: string; name: string };
  };
}

interface PaymentsListProps {
  workspaceId: string;
  leases: Lease[];
  isPropertyManager?: boolean;
}

export function PaymentsList({ workspaceId, leases, isPropertyManager = true }: PaymentsListProps) {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [filter, setFilter] = React.useState<string>('');
  const [reviewingPayment, setReviewingPayment] = React.useState<Payment | null>(null);
  const [proofViewPayment, setProofViewPayment] = React.useState<Payment | null>(null);
  const [receiptViewPayment, setReceiptViewPayment] = React.useState<Payment | null>(null);

  const fetchPayments = async () => {
    try {
      const url = `${API_BASE_URL}/api/workspaces/${workspaceId}/payments${filter ? `?status=${filter}` : ''}`;
      const data = await apiFetch(url, { credentials: 'include' });
      setPayments(data.payments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (workspaceId) fetchPayments();
  }, [workspaceId, filter]);

  const handleMarkPaid = async (paymentId: string) => {
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/payments/${paymentId}/pay`, {
        method: 'PUT',
        credentials: 'include'
      });
      fetchPayments();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-zinc-500">Loading ledger...</p>
      </div>
    );
  }

  const underReviewPayments = payments.filter(p => p.status === 'UNDER_REVIEW');
  const regularPayments = payments.filter(p => p.status !== 'UNDER_REVIEW');
  const totalPending = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE').reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const underReviewCount = underReviewPayments.length;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PAID':
        return {
          className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50',
          icon: <CheckCircle2 className="w-3 h-3" />,
          label: 'PAID',
        };
      case 'UNDER_REVIEW':
        return {
          className: 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50',
          icon: <FileCheck className="w-3 h-3" />,
          label: 'UNDER REVIEW',
        };
      case 'REJECTED':
        return {
          className: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50',
          icon: <AlertCircle className="w-3 h-3" />,
          label: 'REJECTED',
        };
      case 'OVERDUE':
        return {
          className: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50',
          icon: <Clock className="w-3 h-3" />,
          label: 'OVERDUE',
        };
      default:
        return {
          className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50',
          icon: <Clock className="w-3 h-3" />,
          label: 'PENDING',
        };
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent">Payments</h3>
          <p className="text-sm text-zinc-500 mt-1">Track rental income and payment history</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold appearance-none hover:border-zinc-400 transition-all focus:ring-2 focus:ring-zinc-900/5 outline-none"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
          {isPropertyManager && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="group relative flex items-center gap-2 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-all active:scale-95"
            >
              {showForm ? 'Cancel' : <><CreditCard className="w-4 h-4" /> Record Offline Payment</>}

            </button>
          )}
        </div>
      </div>

      {/* Smart Approval Inbox */}
      {underReviewCount > 0 && isPropertyManager && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Pending Verification</h4>
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-black px-2 py-0.5 rounded-md ml-2">{underReviewCount}</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {underReviewPayments.map(p => (
              <div key={p.id} className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                
                <div className="flex justify-between items-start mb-4 relative">
                  <div>
                    <h5 className="font-bold text-zinc-900 dark:text-zinc-100">{p.lease?.tenant?.name}</h5>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5"><Building className="w-3 h-3" /> {p.lease?.property?.name}</p>
                  </div>
                  <span className="font-black text-blue-700 dark:text-blue-300">₦{p.amount.toLocaleString()}</span>
                </div>
                
                <div className="flex gap-2 relative mt-4">
                  {p.proofUrl && (
                    <button onClick={() => setProofViewPayment(p)} className="flex-1 py-2 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> View Proof
                    </button>
                  )}
                  <button onClick={() => setReviewingPayment(p)} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5" /> Review Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Summary Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-10">
        <div className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5 font-bold" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-300" />
          </div>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Receivables</p>
          <p className="text-3xl font-black mt-1 tracking-tight text-zinc-900 dark:text-zinc-100">
            ₦{totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-600/80 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-full w-fit">
            <AlertCircle className="w-3 h-3" /> Unpaid Balance
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm hover:shadow-xl transition-all duration-300">
           <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
           <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 font-bold" />
            </div>
            <ArrowDownRight className="w-4 h-4 text-zinc-300" />
          </div>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Total Collected</p>
          <p className="text-3xl font-black mt-1 tracking-tight text-zinc-900 dark:text-zinc-100">
            ₦{totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full w-fit">
             <CheckCircle2 className="w-3 h-3" /> Settled Payments
          </div>
        </div>
      </div>

      {showForm && isPropertyManager && (
        <div className="animate-in zoom-in-95 fade-in duration-300">
          <PaymentForm workspaceId={workspaceId} leases={leases} onComplete={() => { setShowForm(false); fetchPayments(); }} />
        </div>
      )}

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30">
          <Wallet className="w-12 h-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500 font-medium text-center px-4">
            No payment history found. <br />
            {isPropertyManager && 'Record an offline payment to update your ledger.'}

          </p>
        </div>
      ) : (
        <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden border-separate">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Tenant / Property</th>
                  <th className="text-left py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Status</th>
                  <th className="text-left py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Due Date</th>
                  <th className="text-left py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Amount</th>
                  <th className="text-right py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-zinc-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {regularPayments.map(p => {

                  const statusConfig = getStatusConfig(p.status);
                  return (
                    <tr key={p.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">

                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">{p.lease?.tenant?.name}</span>
                          <span className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" /> {p.lease?.property?.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusConfig.className}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2 text-zinc-500 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(p.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className="font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                          ₦{p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* UNDER_REVIEW actions removed from standard list as they have their own inbox */}
                          {/* PENDING: Mark as settled */}
                          {p.status === 'PENDING' && isPropertyManager && (
                            <button
                              onClick={() => handleMarkPaid(p.id)}
                              className="text-[10px] uppercase font-black px-4 py-2 rounded-full border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500/20 transition-all active:scale-95"
                            >
                              Mark Settled
                            </button>
                          )}
                          {/* PAID: Show paid date + View Receipt */}
                          {p.status === 'PAID' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setReceiptViewPayment(p)}
                                className="text-[10px] uppercase font-black px-3 py-2 rounded-full border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 transition-all active:scale-95 flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" /> Receipt
                              </button>
                              {p.paidDate && (
                                <span className="text-[10px] font-bold text-emerald-500 uppercase bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md">
                                  Paid {new Date(p.paidDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}
                          {/* REJECTED: Show reason */}
                          {p.status === 'REJECTED' && p.rejectionReason && (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-md max-w-[200px] truncate" title={p.rejectionReason}>
                              {p.rejectionReason}
                            </span>
                          )}
                          <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Proof Viewer Modal */}
      {proofViewPayment && (
        <ProofViewerModal
          payment={proofViewPayment}
          onClose={() => setProofViewPayment(null)}
        />
      )}

      {/* Review Modal */}
      {reviewingPayment && (
        <ReviewPaymentModal
          payment={reviewingPayment}
          workspaceId={workspaceId}
          onClose={() => setReviewingPayment(null)}
          onComplete={() => {
            setReviewingPayment(null);
            fetchPayments();
          }}
        />
      )}
      {/* Receipt Modal */}
      {receiptViewPayment && (
        <ReceiptModal
          payment={receiptViewPayment}
          onClose={() => setReceiptViewPayment(null)}
        />
      )}
    </div>
  );
}

/* ─── Proof Viewer Modal ─── */
function ProofViewerModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="relative bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Proof of Payment</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Submitted by {payment.lease?.tenant?.name} • ₦{payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
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
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Tenant Note</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{payment.note}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Review Payment Modal (Approve / Reject) ─── */
function ReviewPaymentModal({ payment, workspaceId, onClose, onComplete }: { 
  payment: Payment; 
  workspaceId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [action, setAction] = React.useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleReview = async (status: 'PAID' | 'REJECTED') => {
    if (status === 'REJECTED' && !rejectionReason.trim()) return;

    setLoading(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/payments/${payment.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...(status === 'REJECTED' ? { rejectionReason: rejectionReason.trim() } : {}),
        }),
        credentials: 'include',
      });

      onComplete();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to review payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Review Payment</h3>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Payment Info */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-zinc-900 dark:text-white">{payment.lease?.tenant?.name}</p>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Building className="w-3 h-3" /> {payment.lease?.property?.name}
              </p>
            </div>
            <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
              ₦{payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Proof preview */}
          {payment.proofUrl && (
            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <img
                src={payment.proofUrl}
                alt="Proof"
                className="w-full max-h-[200px] object-contain bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
          )}

          {payment.note && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Note</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{payment.note}</p>
            </div>
          )}

          {/* Action selection */}
          {action === null && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAction('approve')}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold border-2 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-all active:scale-[0.98]"
              >
                <ThumbsUp className="w-5 h-5" />
                Approve
              </button>
              <button
                onClick={() => setAction('reject')}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-bold border-2 border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-all active:scale-[0.98]"
              >
                <ThumbsDown className="w-5 h-5" />
                Reject
              </button>
            </div>
          )}

          {/* Approve confirmation */}
          {action === 'approve' && (
            <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Approve this payment of ₦{payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}?
                </p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-1">
                  The tenant will be notified and a receipt will be generated.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAction(null)}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => handleReview('PAID')}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Confirm Approval
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Reject with reason */}
          {action === 'reject' && (
            <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Rejection Reason *</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Amount does not match, receipt is unclear..."
                  className="w-full mt-1.5 px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 font-medium text-sm resize-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAction(null); setRejectionReason(''); }}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => handleReview('REJECTED')}
                  disabled={loading || !rejectionReason.trim()}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ThumbsDown className="w-4 h-4" /> Reject Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Receipt Modal ─── */
function ReceiptModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 print:shadow-none print:rounded-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative Top Bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-400 via-zinc-900 to-emerald-400 dark:from-emerald-500 dark:via-zinc-100 dark:to-emerald-500" />
        
        <div className="p-10 pt-8">
          {/* Close Button (Hidden on Print) */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-zinc-400 hover:text-emerald-600 transition-all print:hidden"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Receipt Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4 shadow-xl">
              <Building className="w-8 h-8 text-white dark:text-zinc-900" />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Just Hub Settlement</h3>
            <p className="text-[10px] font-black text-emerald-500 tracking-[0.2em] uppercase mt-1">Certified Digital Receipt</p>
          </div>

          {/* Amount Display */}
          <div className="text-center mb-10 pb-10 border-b-2 border-dashed border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Total Amount Paid</p>
            <div className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
              ₦{payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="inline-flex items-center gap-1.5 mt-4 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/50 uppercase">
              <CheckCircle2 className="w-3 h-3" /> Transaction Success
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-5 mb-10">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tenant</span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">{payment.lease?.tenant?.name}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Property</span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">{payment.lease?.property?.name}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Payment Date</span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">
                {payment.paidDate ? new Date(payment.paidDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Method</span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">Manual Verification</span>
            </div>
          </div>

          <div className="flex flex-col items-center">
             <div className="w-full flex items-center justify-center gap-4 mb-4">
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                <QrCode className="w-8 h-8 text-zinc-200 dark:text-zinc-800" />
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
             </div>
             <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Receipt Number</p>
             <p className="text-xs font-mono font-black text-zinc-900 dark:text-zinc-100 tracking-wider">
               {payment.receiptId || `RCPT-${payment.id.split('-')[0].toUpperCase()}`}
             </p>
          </div>
        </div>

        {/* Footer Actions (Hidden on Print) */}
        <div className="flex gap-4 p-8 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 transition-all active:scale-[0.98]"
          >
            Close
          </button>
          <button
            onClick={printReceipt}
            className="flex-1 py-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-black hover:scale-[1.02] transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> Print PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Invoice Modal ─── */
function InvoiceModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const printInvoice = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="relative bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 print:shadow-none print:rounded-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative Top Bar */}
        <div className="h-2 bg-gradient-to-r from-amber-400 via-amber-600 to-amber-400 dark:from-amber-600 dark:via-amber-400 dark:to-amber-600" />
        
        <div className="p-10 pt-8">
          {/* Close Button (Hidden on Print) */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-900/30 text-zinc-400 hover:text-amber-600 transition-all print:hidden"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Invoice Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center mb-4 shadow-xl">
              <Building className="w-8 h-8 text-white dark:text-zinc-900" />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Just Hub Invoice</h3>
            <p className="text-[10px] font-black text-amber-500 tracking-[0.2em] uppercase mt-1">Payment Request</p>
          </div>

          {/* Amount Display */}
          <div className="text-center mb-10 pb-10 border-b-2 border-dashed border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Amount Due</p>
            <div className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
              ₦{payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="inline-flex items-center gap-1.5 mt-4 text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-900/50 uppercase">
              <Clock className="w-3 h-3" /> Due: {new Date(payment.dueDate).toLocaleDateString()}
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-5 mb-10">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Billed To</span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">{payment.lease?.tenant?.name}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Property</span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">{payment.lease?.property?.name}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</span>
              <span className="text-sm font-black text-zinc-900 dark:text-white">{payment.status.replace('_', ' ')}</span>
            </div>
            {payment.note && (
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Note</span>
                <span className="text-sm font-black text-zinc-900 dark:text-white max-w-[60%] text-right truncate" title={payment.note}>{payment.note}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
             <div className="w-full flex items-center justify-center gap-4 mb-4">
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                <FileText className="w-8 h-8 text-zinc-200 dark:text-zinc-800" />
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
             </div>
             <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Invoice ID</p>
             <p className="text-xs font-mono font-black text-zinc-900 dark:text-zinc-100 tracking-wider">
               INV-{payment.id.split('-')[0].toUpperCase()}
             </p>
          </div>
        </div>

        {/* Footer Actions (Hidden on Print) */}
        <div className="flex gap-4 p-8 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 transition-all active:scale-[0.98]"
          >
            Close
          </button>
          <button
            onClick={printInvoice}
            className="flex-1 py-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-black hover:scale-[1.02] transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> Print PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ workspaceId, leases, onComplete }: { workspaceId: string; leases: Lease[]; onComplete: () => void }) {
  const [formData, setFormData] = React.useState({ leaseId: '', amount: '', dueDate: '', status: 'PENDING', note: '' });
  const [loading, setLoading] = React.useState(false);

  const handleLeaseChange = (leaseId: string) => {
    const lease = leases.find(l => l.id === leaseId);
    setFormData({
      ...formData,
      leaseId,
      amount: lease?.yearlyRent ? String(lease.yearlyRent) : formData.amount
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-12 p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-zinc-50/50 dark:bg-zinc-900/30 space-y-8 relative overflow-hidden">
      <div>
        <h4 className="text-xl font-bold mb-1">Record Offline Payment</h4>
        <p className="text-sm text-zinc-500">Capture a manual rent payment or cash deposit. <br className="hidden md:block"/><span className="text-blue-600 dark:text-blue-400 font-medium">Digital payments submitted by tenants will automatically appear in your Pending Verification inbox.</span></p>
      </div>


      <div className="grid gap-6 md:grid-cols-2 relative">
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Occupancy / Lease Agreement</label>
          <select 
            required 
            value={formData.leaseId} 
            onChange={e => handleLeaseChange(e.target.value)} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-medium appearance-none"
          >
            <option value="">{leases.length === 0 ? 'Loading leases...' : 'Select active tenant lease...'}</option>
            {leases.map(l => (
              <option key={l.id} value={l.id}>
                {l.tenant?.name} — {l.property?.name} {l.unit?.unitNumber ? `(Unit ${l.unit.unitNumber})` : ''} — ₦{l.yearlyRent?.toLocaleString()}
              </option>
            ))}
          </select>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Payment Amount (₦)</label>
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            required 
            readOnly
            value={formData.amount} 
            onChange={e => setFormData({ ...formData, amount: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 focus:outline-none cursor-not-allowed font-bold tracking-tight text-zinc-500" 
            placeholder="0.00" 
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Due Date</label>
          <input 
            type="date" 
            required 
            value={formData.dueDate} 
            onChange={e => setFormData({ ...formData, dueDate: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium" 
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Status</label>
          <select 
            value={formData.status} 
            onChange={e => setFormData({ ...formData, status: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-bold appearance-none"
          >
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
          </select>
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Reference / Note</label>
          <input 
            value={formData.note} 
            onChange={e => setFormData({ ...formData, note: e.target.value })} 
            className="w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 font-medium" 
            placeholder="e.g. Annual Rent Payment 2024" 
          />
        </div>
      </div>

      <div className="flex justify-end pt-6 border-at border-zinc-100 dark:border-zinc-800">
        <button 
          disabled={loading} 
          type="submit" 
          className="bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 px-8 py-3 rounded-full text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Recording...' : 'Record Payment'}
        </button>
      </div>
    </form>
  );
}
