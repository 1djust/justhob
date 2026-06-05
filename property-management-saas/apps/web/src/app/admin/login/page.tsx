import { AdminLoginForm } from '@/components/auth/AdminLoginForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Access - PropertyStack',
};

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
      <AdminLoginForm />
    </div>
  );
}
