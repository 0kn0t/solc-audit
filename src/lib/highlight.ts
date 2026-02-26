/// Simple regex-based Solidity syntax highlighting. Returns HTML string.

const KEYWORDS = new Set([
  'pragma', 'solidity', 'import', 'contract', 'library', 'interface', 'abstract',
  'function', 'modifier', 'event', 'error', 'struct', 'enum', 'mapping',
  'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'return', 'revert',
  'require', 'assert', 'emit', 'try', 'catch', 'new', 'delete', 'throw',
  'using', 'is', 'as', 'this', 'super', 'constructor', 'fallback', 'receive',
  'public', 'private', 'internal', 'external', 'pure', 'view', 'payable',
  'constant', 'immutable', 'virtual', 'override', 'indexed', 'anonymous',
  'memory', 'storage', 'calldata', 'returns', 'unchecked', 'assembly',
  'true', 'false',
]);

const TYPES = new Set([
  'address', 'bool', 'string', 'bytes', 'int', 'uint',
  ...Array.from({ length: 32 }, (_, i) => `bytes${i + 1}`),
  ...Array.from({ length: 32 }, (_, i) => `uint${(i + 1) * 8}`),
  ...Array.from({ length: 32 }, (_, i) => `int${(i + 1) * 8}`),
]);

// Tokenize into spans with CSS classes
export function highlightSolidity(code: string): string {
  return code.replace(
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)/g,
    (match, comment, str, num, ident) => {
      if (comment) return `<span class="hl-comment">${escapeHtml(comment)}</span>`;
      if (str) return `<span class="hl-string">${escapeHtml(str)}</span>`;
      if (num) return `<span class="hl-number">${escapeHtml(num)}</span>`;
      if (ident) {
        if (KEYWORDS.has(ident)) return `<span class="hl-keyword">${ident}</span>`;
        if (TYPES.has(ident)) return `<span class="hl-type">${ident}</span>`;
        return ident;
      }
      return escapeHtml(match);
    }
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
