// src/components/chat/components/CodeBlock.tsx
import React, { useState } from 'react';
import { Check, Clipboard, Code } from 'lucide-react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs, vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTheme } from '@/components/ThemeProvider';

// Import languages you want to support
import jsx from 'react-syntax-highlighter/dist/cjs/languages/prism/jsx';
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import css from 'react-syntax-highlighter/dist/cjs/languages/prism/css';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/cjs/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/cjs/languages/prism/sql';
import java from 'react-syntax-highlighter/dist/cjs/languages/prism/java';
import html from 'react-syntax-highlighter/dist/cjs/languages/prism/markup';

// Register language support
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('html', html);

interface CodeBlockProps {
  language: string;
  value: string;
  className?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value, className }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);
  
  // Normalize language name
  const normalizedLanguage = language.toLowerCase().replace(/^\s*|\s*$/g, '');
  
  // Map language aliases
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'jsx',
    'tsx': 'typescript',
    'py': 'python',
    'sh': 'bash',
    'shell': 'bash',
    'markup': 'html',
    'xml': 'html',
  };

  // Use mapped language or the original
  const langToUse = languageMap[normalizedLanguage] || normalizedLanguage || 'javascript';

  // Use appropriate syntax highlighting theme based on the current theme
  const codeStyle = isDark ? vscDarkPlus : vs;
  
  // Handle copy code
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`max-w-full overflow-hidden rounded-md code-block-container my-2 ${className}`}>
      <div className="flex items-center justify-between px-3 py-1 text-xs font-mono text-right bg-opacity-75 border-b border-opacity-30 select-none" 
           style={{ 
             backgroundColor: isDark ? 'rgba(40, 44, 52, 0.75)' : 'rgba(240, 240, 240, 0.75)',
             borderColor: isDark ? 'rgba(70, 70, 90, 0.3)' : 'rgba(220, 220, 220, 0.3)'
           }}>
        <div className="flex items-center">
          <Code size={14} className={isDark ? 'text-gray-400 mr-2' : 'text-gray-700 mr-2'} />
          <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
            {langToUse || 'code'}
          </span>
        </div>
        <button 
          onClick={handleCopy}
          className={`p-1 rounded hover:bg-opacity-20 transition-colors ${
            isDark 
              ? 'hover:bg-gray-600' 
              : 'hover:bg-gray-300'
          }`}
          title="Copy code"
        >
          {copied ? (
            <Check size={14} className={isDark ? 'text-green-400' : 'text-green-600'} />
          ) : (
            <Clipboard size={14} className={isDark ? 'text-gray-400' : 'text-gray-700'} />
          )}
        </button>
      </div>
      
      <SyntaxHighlighter
        language={langToUse || 'javascript'}
        style={codeStyle}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.9rem',
          backgroundColor: isDark ? 'rgb(30, 30, 45)' : 'rgb(245, 245, 250)',
        }}
        showLineNumbers
        wrapLines
        wrapLongLines={false}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;