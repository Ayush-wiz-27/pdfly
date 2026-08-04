import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  BookOpen, 
  Search, 
  Loader2, 
  Info,
  Plus,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

// Lightweight inline markdown formatter component to render structured content
function renderInlineMarkdown(text) {
  if (!text) return '';
  // Split on bold (**text**) and inline code (`code`) patterns
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="bg-slate-950/60 border border-white/5 px-1.5 py-0.5 rounded text-xs text-purple-300 font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function FormattedMarkdown({ content }) {
  if (!content) return null;

  // Split by double line breaks to segment into paragraphs/blocks
  const blocks = content.split('\n\n');

  return (
    <div className="space-y-3.5">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 1. Heading Elements (e.g. ### Header)
        if (trimmed.startsWith('### ')) {
          return <h4 key={bIdx} className="text-sm font-bold text-slate-100 tracking-wide mt-3">{trimmed.slice(4)}</h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={bIdx} className="text-base font-bold text-slate-100 tracking-wide mt-4">{trimmed.slice(3)}</h3>;
        }
        if (trimmed.startsWith('# ')) {
          return <h2 key={bIdx} className="text-lg font-bold text-slate-100 tracking-wide mt-5">{trimmed.slice(2)}</h2>;
        }

        // 2. List Elements (e.g. - Item or * Item or 1. Item)
        const lines = trimmed.split('\n');
        const isList = lines.every(line => {
          const t = line.trim();
          return t.startsWith('- ') || t.startsWith('* ') || /^\d+\.\s/.test(t);
        });

        if (isList) {
          return (
            <ul key={bIdx} className="list-disc pl-5 space-y-1.5 text-slate-200">
              {lines.map((line, lIdx) => {
                // Remove list bullets/markers
                const cleanLine = line.trim().replace(/^(-\s|\*\s|\d+\.\s)/, '');
                return <li key={lIdx} className="leading-relaxed">{renderInlineMarkdown(cleanLine)}</li>;
              })}
            </ul>
          );
        }

        // 3. Regular Paragraphs
        return (
          <p key={bIdx} className="text-slate-200 leading-relaxed whitespace-pre-wrap">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatInterface() {
  const {
    api,
    models,
    selectedModel,
    setSelectedModel,
    selectedDocIds,
    fetchChatHistory,
    fetchDocuments,
    currentChat,
    setCurrentChat,
    uploading,
    uploadStatus,
    setUploadStatus,
    uploadStatusMsg,
    uploadFile
  } = useAppContext();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const chatEndRef = useRef(null);

  // File Input and Dynamic Textarea refs
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat]);

  // Adjust textarea height dynamically based on multi-line text input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const nextHeight = Math.min(scrollHeight, 120);
      textareaRef.current.style.height = `${nextHeight}px`;
      setIsInputExpanded(scrollHeight > 36);
    }
  }, [query]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    
    // Add user query message instantly to local chat
    const userMessage = { role: 'user', content: query };
    setCurrentChat(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage]
    }));

    const originalQuery = query;
    setQuery('');

    try {
      const response = await api.post('/query', {
        query: originalQuery,
        model: selectedModel,
        documentIds: selectedDocIds
      });

      const { response: responseText, retrievedChunks } = response.data;

      // Add assistant response to the message feed along with context citations
      setCurrentChat(prev => ({
        messages: [...prev.messages, { role: 'assistant', content: responseText }],
        retrievedChunks: retrievedChunks || []
      }));

      // Refresh side navigation logs to include this Q&A query
      fetchChatHistory();
    } catch (error) {
      console.error('Query error:', error);
      setCurrentChat(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          { 
            role: 'assistant', 
            content: `⚠️ Failed to get a response from the vector assistant: ${error.response?.data?.error || error.message}` 
          }
        ]
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // PDF File Upload Handler utilizing shared helper
  const handleFileChange = (e) => {
    e.preventDefault();
    if (!e.target.files || !e.target.files[0]) return;
    uploadFile(e.target.files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Messages Console */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentChat.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-400 shadow-inner">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-semibold text-slate-200">Upload and select documents from sidebar to get started</h3>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {currentChat.messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div 
                    key={index}
                    className={`flex gap-3 max-w-4xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    {/* User / Agent Avatar */}
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold font-mono shadow-md border ${
                      isUser 
                        ? 'bg-purple-600/20 border-purple-500/30 text-purple-300' 
                        : 'bg-slate-800/80 border-white/5 text-purple-400'
                    }`}>
                      {isUser ? 'U' : 'AI'}
                    </div>

                    {/* Chat Bubble */}
                    <div className={`rounded-2xl p-3 text-sm leading-relaxed max-w-[85%] ${
                      isUser 
                        ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/10' 
                        : 'glass-card text-slate-200 border border-white/5'
                    }`}>
                      {isUser ? (
                        <p className="whitespace-pre-line">{msg.content}</p>
                      ) : (
                        <FormattedMarkdown content={msg.content} />
                      )}
                    </div>
                  </div>
                );
              })}
              
              {loading && (
                <div className="flex gap-3 max-w-3xl">
                  <div className="w-8 h-8 rounded-full bg-slate-800/80 border border-white/5 text-purple-400 flex items-center justify-center text-xs font-bold font-mono">
                    AI
                  </div>
                  <div className="glass-card rounded-2xl p-4 text-sm text-slate-400 border border-white/5 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    Generating response...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Uploading Status Banner */}
      {uploading && (
        <div className="mx-4 mb-2 p-2 bg-purple-950/20 border border-purple-500/20 rounded-xl flex items-center gap-2 text-xs text-purple-300 z-10 shadow-sm animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
          <span>Processing...</span>
        </div>
      )}

      {/* Ingestion Completion/Error status notification banners */}
      {uploadStatus && (
        <div className={`mx-4 mb-2 p-2.5 rounded-xl border text-xs flex items-center justify-between z-10 shadow-md ${
          uploadStatus === 'success'
            ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
            : 'bg-rose-950/20 border-rose-500/20 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {uploadStatus === 'success' ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="font-medium">{uploadStatusMsg}</span>
          </div>
          <button 
            onClick={() => setUploadStatus(null)}
            className="text-[10px] text-slate-400 hover:text-slate-200 ml-4 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Query Search Bar */}
      <div className="p-4 bg-gradient-to-t from-slate-950/60 to-transparent border-t border-white/5 z-10">
        <form 
          onSubmit={handleSubmit} 
          className="max-w-3xl mx-auto flex items-center gap-3 glass-input rounded-xl p-1.5 pl-4 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500/50 transition-all"
        >
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything from your documents"
            disabled={loading}
            rows={1}
            className="flex-1 bg-transparent border-none text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-none min-h-[32px] max-h-[120px] py-1.5 overflow-y-auto"
          />
          
          {/* Controls inline on the right side of the textarea */}
          <div className="flex items-center gap-2 pr-1 shrink-0">
            {/* Model Dropdown */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-white/10 rounded-full px-2.5 py-1 text-[10px] focus:outline-none max-w-[125px] transition-colors font-sans truncate cursor-pointer"
              title="Select AI Model"
            >
              {models.map(model => (
                <option key={model.id} value={model.id} className="bg-slate-950 text-slate-200 text-xs">
                  {model.name.replace(' (Free)', '')}
                </option>
              ))}
            </select>

            {/* Plus Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              disabled={uploading}
              className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors flex items-center justify-center cursor-pointer"
              title="Upload PDF Document"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 hover:text-black p-1.5 rounded-full transition-all shadow-md flex items-center justify-center cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </form>
        <p className="text-[10px] text-slate-500 text-center mt-2">
          Hold Shift + Enter to add a new line.
        </p>
      </div>
    </div>
  );
}
