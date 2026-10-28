import type { Metadata } from 'next';
import { SignInPage } from '@/features/auth/signin-page';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return <SignInPage />;
}
