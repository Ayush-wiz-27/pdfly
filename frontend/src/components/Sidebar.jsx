import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Trash2, 
  History, 
  Layers, 
  Clock, 
  FileCheck, 
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import logoUrl from '../assets/pdf-analyser-logo.svg';

// Helper function to group individual logs into threads by target document context
function groupQueriesByContext(historyLogs, availableDocs) {
  const groups = {};

  // Sort logs chronologically (oldest to newest) to preserve the query/response order inside each thread
  const sortedLogs = [...historyLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  sortedLogs.forEach(log => {
    // Standardize doc_ids key (sort them to ensure same set matches)
    const docIds = Array.isArray(log.document_ids) ? [...log.document_ids].sort((x, y) => x - y) : [];
    const groupKey = docIds.length > 0 ? docIds.join(',') : 'global';

    if (!groups[groupKey]) {
      let title = 'General Chat';
      if (docIds.length === 1) {
        const doc = availableDocs.find(d => d.id === docIds[0]);
        title = doc ? `Chat on ${doc.filename}` : 'Chat on Deleted PDF';
      } else if (docIds.length > 1) {
        const matchedNames = docIds
          .map(id => availableDocs.find(d => d.id === id)?.filename)
          .filter(Boolean);
        title = matchedNames.length > 0 ? `Chat on ${matchedNames.join(', ')}` : `Chat on ${docIds.length} PDFs`;
      }

      groups[groupKey] = {
        key: groupKey,
        docIds: docIds,
        title: title,
        messages: [],
        lastQueryTime: log.created_at
      };
    }

    // Append dialog turns to the group thread
    groups[groupKey].messages.push({ role: 'user', content: log.query });
    groups[groupKey].messages.push({ role: 'assistant', content: log.response });
    groups[groupKey].lastQueryTime = log.created_at;
  });

  // Sort groups by last query time (newest active thread first)
  return Object.values(groups).sort((a, b) => new Date(b.lastQueryTime) - new Date(a.lastQueryTime));
}

export default function Sidebar() {
  const {
    api,
    documents,
    setDocuments,
    selectedDocIds,
    setSelectedDocIds,
    chatHistory,
    setChatHistory,
    activeLogId,
    setActiveLogId,
    setCurrentChat,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    uploading,
    uploadFile
  } = useAppContext();

  // Accordion Menu States
  const [isDocsOpen, setIsDocsOpen] = useState(true);
  const [isQueriesOpen, setIsQueriesOpen] = useState(true);
  const sidebarFileInputRef = useRef(null);

  // Group the queries dynamically
  const queryGroups = groupQueriesByContext(chatHistory, documents);

  const handleSidebarFileChange = (e) => {
    e.preventDefault();
    if (!e.target.files || !e.target.files[0]) return;
    uploadFile(e.target.files[0]);
    if (sidebarFileInputRef.current) sidebarFileInputRef.current.value = '';
  };

  const toggleDocSelection = (id) => {
    if (selectedDocIds.includes(id)) {
      setSelectedDocIds(selectedDocIds.filter(docId => docId !== id));
    } else {
      setSelectedDocIds([...selectedDocIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map(d => d.id));
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document? This will remove all text chunks and vectors.')) {
      return;
    }
    try {
      // Execute deletion request directly with Axios
      await api.delete(`/documents/${id}`);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      setSelectedDocIds(prev => prev.filter(docId => docId !== id));
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all chat logs?')) {
      return;
    }
    try {
      // Execute history clear directly with Axios
      await api.delete('/chat-history');
      setChatHistory([]);
      setActiveLogId(null);
      setCurrentChat({ messages: [], retrievedChunks: [] });
    } catch (err) {
      console.error('Error clearing chat history:', err);
    }
  };

  const handleSelectHistoryGroup = (group) => {
    setActiveLogId(group.key);
    // Align context selection filters to matching document list of this thread
    setSelectedDocIds(group.docIds);
    setCurrentChat({
      messages: group.messages,
      retrievedChunks: []
    });
  };

  const formatSize = (chars) => {
    if (chars < 1000) return `${chars} ch`;
    return `${(chars / 1000).toFixed(1)}k ch`;
  };

  return (
    <aside className={`border-r border-white/5 flex flex-col h-full bg-slate-950/40 backdrop-blur-xl transition-all duration-700 ease-in-out shrink-0 overflow-hidden ${
      isSidebarCollapsed ? 'w-16' : 'w-80'
    }`}>
      {/* Sidebar Header */}
      {isSidebarCollapsed ? (
        <div className="p-3.5 border-b border-white/5 flex items-center justify-center">
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="PDFly Logo" className="w-7 h-7 object-contain" />
            <div>
              <h1 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 text-sm tracking-wide">
                PDFly
              </h1>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
      {isSidebarCollapsed ? (
        /* Collapsed State: Category Icons Stack */
        <div className="flex-1 flex flex-col justify-center items-center gap-6 pb-19">
          <button
              onClick={() => sidebarFileInputRef.current.click()}
              disabled={uploading}
              className="w-10 h-10 pill-button-primary flex items-center justify-center cursor-pointer shadow-md rounded-full"
              title="Add Document"
          >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
              ) : (
                <Plus className="w-4 h-4 text-slate-900" />
              )}
          </button>
            {/* Document Category Icon */}
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer flex items-center justify-center relative group"
            title={`Documents (${documents.length})`}
          >
            <FileText className="w-6 h-6" />
            {documents.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-purple-600 text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full border border-slate-950">
                {documents.length}
              </span>
            )}
          </button>

          {/* History Category Icon */}
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all cursor-pointer flex items-center justify-center relative group"
            title={`Queries (${queryGroups.length} threads)`}
          >
            <History className="w-6 h-6" />
            {queryGroups.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full border border-slate-950">
                {queryGroups.length}
              </span>
            )}
          </button>
        </div>
      ) : (
        /* Expanded State: Normal Documents and Query Logs explorer list */
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Add Document button */}
          <div className="mb-2 pl-1 pr-1">
            <button
              onClick={() => sidebarFileInputRef.current.click()}
              disabled={uploading}
              className="w-full pill-button-primary py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900" />
              ) : (
                <Plus className="w-3.5 h-3.5 text-slate-900 font-bold" />
              )}
              Add Document
            </button>
          </div>

          {/* Document list */}
          <div>
            <div 
              onClick={() => setIsDocsOpen(!isDocsOpen)}
              className="flex items-center justify-between mb-3 px-1 cursor-pointer select-none group"
            >
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 group-hover:text-slate-200 transition-colors">
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isDocsOpen ? '' : '-rotate-90'}`} />
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                  Documents ({documents.length})
              </h3>
              {documents.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectAll();
                  }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                >
                  {selectedDocIds.length === documents.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${isDocsOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
              <div className="overflow-hidden space-y-2 pr-0.5">
                {documents.length === 0 ? (
                  <div className="glass-card rounded-xl p-4 text-center border border-white/5">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No PDFs indexed yet. Upload one to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {documents.map((doc) => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          className={`group relative flex items-center justify-between p-2.5 rounded-lg border transition-all duration-300 cursor-pointer ${
                            isSelected 
                              ? 'bg-purple-950/20 border-purple-500/30' 
                              : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                          }`}
                          onClick={() => toggleDocSelection(doc.id)}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 pr-6">
                            <div className={`p-1.5 rounded-md mt-0.5 ${
                              isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isSelected ? <FileCheck className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-200 truncate" title={doc.filename}>
                                {doc.filename}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {doc.chunk_count} chunks • {formatSize(doc.char_count)}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDocument(doc.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-slate-500 p-1 rounded transition-all absolute right-2 cursor-pointer"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* History list */}
          <div className="pt-4 border-t border-white/5">
            <div 
              onClick={() => setIsQueriesOpen(!isQueriesOpen)}
              className="flex items-center justify-between mb-3 px-1 cursor-pointer select-none group"
            >
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 group-hover:text-slate-200 transition-colors">
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isQueriesOpen ? '' : '-rotate-90'}`} />
                <History className="w-3.5 h-3.5 text-indigo-400" />
                Previous Queries
              </h3>
              {chatHistory.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearHistory();
                  }}
                  className="text-[10px] text-red-400 hover:text-red-300 font-medium transition-colors flex items-center gap-0.5 cursor-pointer"
                >
                  <XCircle className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${isQueriesOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
              <div className="overflow-hidden space-y-2 pr-0.5">
                {queryGroups.length === 0 ? (
                  <div className="glass-card rounded-xl p-4 text-center border border-white/5">
                    <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Your chat query history will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {queryGroups.map((group) => {
                      const isActive = activeLogId === group.key;
                      return (
                        <div
                          key={group.key}
                          onClick={() => handleSelectHistoryGroup(group)}
                          className={`p-2.5 rounded-lg border cursor-pointer text-left transition-all duration-300 group ${
                            isActive 
                              ? 'bg-indigo-950/20 border-indigo-500/40 shadow-sm' 
                              : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                          }`}
                        >
                          <p className="text-xs text-slate-200 font-medium truncate mb-1" title={group.title}>
                            {group.title}
                          </p>
                          <div className="flex justify-between items-center text-[9px] text-slate-500">
                            <span className="truncate max-w-[150px] text-indigo-400 font-medium font-mono">
                              {group.messages.length / 2} interaction{group.messages.length / 2 > 1 ? 's' : ''}
                            </span>
                            <span>{new Date(group.lastQueryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar Footer - Stats Card */}
      {!isSidebarCollapsed && (
        <div className="p-4 border-t border-white/5 bg-slate-950/20 shrink-0">
          <div className="glass-card p-3.5 border border-white/5 rounded-2xl space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documents Selected</p>
                <p className="text-lg font-extrabold text-slate-100 mt-0.5">{selectedDocIds.length}</p>
              </div>
            </div>

            <div className="pt-1 text-left">
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full transition-all duration-500" 
                  style={{ width: `${documents.length > 0 ? (selectedDocIds.length / documents.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
      <input
        ref={sidebarFileInputRef}
        type="file"
        className="hidden"
        accept=".pdf"
        onChange={handleSidebarFileChange}
        disabled={uploading}
      />
    </aside>
  );
}
