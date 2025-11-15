import AuthLayout from '@/app/auth/layout';
import LoginForm from '@/components/forms/LoginForm';

export default function LoginPage() {
  return (
    <AuthLayout title="Sign in to your account" subtitle="Welcome back!">
      <LoginForm />
    </AuthLayout>
  );
}
