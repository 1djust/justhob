import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register - PropertyStack",
};

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create an account"
      subtitle="Enter your information to get started"
    >
      <RegisterForm />
    </AuthLayout>
  );
}
