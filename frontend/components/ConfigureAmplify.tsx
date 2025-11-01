'use client';

import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

Amplify.configure(outputs, {
  ssr: true, // Next.js App Routerでのサーバーサイドレンダリング対応
});

export default function ConfigureAmplify({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
