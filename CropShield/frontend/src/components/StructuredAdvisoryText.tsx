import { Fragment } from 'react';

type Block =
  | { type: 'paragraph'; content: string }
  | { type: 'heading'; content: string }
  | { type: 'ordered'; items: string[] }
  | { type: 'unordered'; items: string[] };

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\s+(\d+[.)]\s+\*\*)/g, '\n$1')
    .replace(/\s+(\d+[.)]\s+)/g, '\n$1')
    .trim();
}

function parseBlocks(value: string): Block[] {
  const text = normalizeText(value);
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: Block[] = [];
  let orderedItems: string[] = [];
  let unorderedItems: string[] = [];

  const flushOrdered = () => {
    if (orderedItems.length === 0) return;
    blocks.push({ type: 'ordered', items: orderedItems });
    orderedItems = [];
  };

  const flushUnordered = () => {
    if (unorderedItems.length === 0) return;
    blocks.push({ type: 'unordered', items: unorderedItems });
    unorderedItems = [];
  };

  for (const line of lines) {
    const orderedMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushUnordered();
      orderedItems.push(orderedMatch[2].trim());
      continue;
    }

    const unorderedMatch = line.match(/^[-*•]\s+(.+)$/);
    if (unorderedMatch) {
      flushOrdered();
      unorderedItems.push(unorderedMatch[1].trim());
      continue;
    }

    flushOrdered();
    flushUnordered();

    if (line.endsWith(':') && line.length <= 90) {
      blocks.push({ type: 'heading', content: line.slice(0, -1).trim() });
      continue;
    }

    blocks.push({ type: 'paragraph', content: line });
  }

  flushOrdered();
  flushUnordered();
  return blocks;
}

function renderInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`b-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`t-${index}`}>{part}</Fragment>;
  });
}

export default function StructuredAdvisoryText({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  if (blocks.length === 0) {
    return <p className="text-sm text-foreground-muted">No advisory response available.</p>;
  }

  return (
    <div className="space-y-2 text-sm text-foreground-muted leading-6">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p key={`h-${index}`} className="font-semibold text-foreground-main mt-3 first:mt-0">
              {renderInlineBold(block.content)}
            </p>
          );
        }

        if (block.type === 'ordered') {
          return (
            <ol key={`o-${index}`} className="list-decimal pl-5 space-y-1 marker:font-semibold marker:text-foreground-main">
              {block.items.map((item, itemIndex) => (
                <li key={`oi-${index}-${itemIndex}`}>{renderInlineBold(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'unordered') {
          return (
            <ul key={`u-${index}`} className="list-disc pl-5 space-y-1 marker:text-foreground-main">
              {block.items.map((item, itemIndex) => (
                <li key={`ui-${index}-${itemIndex}`}>{renderInlineBold(item)}</li>
              ))}
            </ul>
          );
        }

        return <p key={`p-${index}`}>{renderInlineBold(block.content)}</p>;
      })}
    </div>
  );
}
