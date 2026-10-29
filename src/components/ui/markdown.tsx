'use client';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { normalizeMath } from '@/lib/math-text';
import { cn } from '@/lib/utils';

export { normalizeMath };

export const Markdown = memo(function Markdown({ children, streaming, className }: { children: string; streaming?: boolean; className?: string }) {
  return (
    <div className={cn('md', streaming && 'streaming', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
        components={{ a: ({ node, ...props }) => (void node, <a {...props} target="_blank" rel="noopener noreferrer" />) }}
      >
        {normalizeMath(children)}
      </ReactMarkdown>
    </div>
  );
});
