import AuthLayout from '@/app/auth/layout';
import RegisterForm from '@/components/forms/RegisterForm';

export default function RegisterPage() {
  return (
    <AuthLayout title="Create your account" subtitle="Get started with Chat RAG">
      <RegisterForm />
    </AuthLayout>
  );
}
