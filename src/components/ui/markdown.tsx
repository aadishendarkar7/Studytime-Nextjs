'use client';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';

/**
 * Normalize \( \) and \[ \] delimiters to $ forms that remark-math understands,
 * and escape currency amounts like "$5" or "$1,200.50" so they aren't read as math.
 */
export const normalizeMath = (text: string) =>
  text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m}$`)
    .replace(/(^|[^\\$])\$(?=\d[\d,]*(?:\.\d+)?(?:[kKmMbB]\b)?(?:\s|[.,;:!?)]|$))/gm, '$1\\$');

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
