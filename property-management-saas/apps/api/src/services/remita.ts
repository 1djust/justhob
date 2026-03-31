import crypto from 'crypto';

const REMITA_BASE_URL = process.env.REMITA_BASE_URL || 'https://remitademo.net';
const MERCHANT_ID = process.env.REMITA_MERCHANT_ID || '2547916'; // Demo Merchant
const SERVICE_TYPE_ID = process.env.REMITA_SERVICE_TYPE_ID || '4430731'; // Demo Service
const API_KEY = process.env.REMITA_API_KEY || '1946'; // Demo API Key

export class RemitaService {
  /**
   * Generates a split payment RRR for rent collection.
   * Splits money between the SaaS platform (you) and the Landlord.
   */
  static async generateSplitRRR({
    orderId,
    amount,
    payerName,
    payerEmail,
    payerPhone,
    description,
    landlordBankCode,
    landlordAccountNumber,
    platformFeePercentage = 2.0 // 2% platform fee
  }: {
    orderId: string;
    amount: number;
    payerName: string;
    payerEmail: string;
    payerPhone: string;
    description: string;
    landlordBankCode: string;
    landlordAccountNumber: string;
    platformFeePercentage?: number;
  }) {
    // Commented out
    throw new Error('Remita Service is currently disabled.');
  }

  /**
   * Verifies the status of an RRR to confirm payment success.
   */
  static async verifyTransaction(rrr: string) {
    // Commented out
    return false;
  }
}
