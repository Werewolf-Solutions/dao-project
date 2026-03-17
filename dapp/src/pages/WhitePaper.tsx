import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import './WhitePaper.css';

export default function WhitePaper() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    fetch('/whitepaper.md')
      .then(r => r.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      });
  }, []);

  // Auto-open print dialog when navigated here with state { print: true }
  useEffect(() => {
    if (!loading && (location.state as { print?: boolean })?.print) {
      window.print();
    }
  }, [loading, location.state]);

  // Extract the first h1 from the markdown so we can render it manually
  // alongside the download button, then pass the rest to ReactMarkdown.
  const titleMatch = content.match(/^#[ \t]+(.+)$/m);
  const title = titleMatch?.[1] ?? '';
  const body = titleMatch
    ? content.slice(content.indexOf(titleMatch[0]) + titleMatch[0].length).trimStart()
    : content;

  return (
    <div className="max-w-4xl mx-auto px-6 pt-20 pb-10">
      {loading ? (
        <div className="text-gray-400 py-20 text-center">Loading…</div>
      ) : (
        <article className="vscode-md">
          {/* Title row: h1 from .md on the left, download button on the right */}
          <div className="flex items-center justify-between print:block" style={{ marginBottom: '16px', borderBottom: '1px solid #404040', paddingBottom: '0.3em' }}>
            <h1 style={{ margin: 0, border: 'none', paddingBottom: 0 }}>{title}</h1>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium print:hidden"
              style={{ background: '#8e2421', color: '#fff', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#a12c29')}
              onMouseLeave={e => (e.currentTarget.style.background = '#8e2421')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Download PDF
            </button>
          </div>

          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>{body}</ReactMarkdown>
        </article>
      )}
    </div>
  );
}
