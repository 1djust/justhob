import { AuthLayout } from '@/components/auth/AuthLayout';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password - Just Hub',
  description: 'Set a new password for your account',
};

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Please enter and confirm your new password below"
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
