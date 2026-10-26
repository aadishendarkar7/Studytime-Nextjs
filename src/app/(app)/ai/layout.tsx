import { AiHeader } from '@/features/ai/ai-header';

export default function AiLayout({ children }: LayoutProps<'/ai'>) {
  return (
    <>
      <AiHeader />
      {children}
    </>
  );
}
