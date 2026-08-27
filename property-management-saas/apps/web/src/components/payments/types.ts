export interface Lease {
  id: string;
  tenant?: { name: string };
  property?: { name: string };
  unit?: { unitNumber: string };
  yearlyRent?: number;
}

export type PaymentTransactionStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface PaymentTransaction {
  id: string;
  amount: number;
  status: PaymentTransactionStatus;
  note?: string;
  paidDate: string;
  receiptId?: string;
}

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "UNDER_REVIEW"
  | "PARTIALLY_PAID"
  | "REJECTED";

export interface Payment {
  id: string;
  amount: number;
  amountPaid?: number;
  status: PaymentStatus;
  dueDate: string;
  paidDate?: string;
  proofUrl?: string;
  rejectionReason?: string;
  balancePromise?: string;
  receiptId?: string;
  note?: string;
  paymentMethod?: string;
  lease?: {
    tenant?: { id: string; name: string };
    property?: { id: string; name: string };
  };
  transactions?: PaymentTransaction[];
}
