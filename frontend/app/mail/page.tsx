'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Inbox, Send, Paperclip, Calendar, Loader2, FolderOpen, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useSelectionStore } from '@/lib/store';
import { getDateGroup } from '@/lib/utils';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { MessageList } from '@/components/MessageList';
import { SearchBar } from '@/components/SearchBar';
import { SelectionBar } from '@/components/SelectionBar';
import { Toast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';

function MailPageContent() {
  const searchParams = useSearchParams();
  const pstId = searchParams.get('pst_id');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const setPstId = useSelectionStore((state) => state.setPstId);

  useEffect(() => {
    if (pstId) {
      setPstId(pstId);
    }
  }, [pstId, setPstId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: ['folders', pstId],
    queryFn: () => apiClient.getFolders(pstId!),
    enabled: !!pstId,
  });

  const { data: messages, isLoading: messagesLoading, isFetching } = useQuery({
    queryKey: ['messages', pstId, debouncedQuery, selectedFolder, page],
    queryFn: () => {
      if (debouncedQuery) {
        return apiClient.searchMessages(pstId!, debouncedQuery, undefined, page, 50).then(r => r.results);
      }
      return apiClient.getMessages(pstId!, selectedFolder || undefined, page, 50);
    },
    enabled: !!pstId,
  });

  const groupedMessages = useMemo(() => {
    if (!messages) return {};

    const groups: Record<string, typeof messages> = {};
    messages.forEach((msg) => {
      const group = getDateGroup(msg.date_utc);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(msg);
    });

    return groups;
  }, [messages]);

  const handleQuickFilter = (filter: string) => {
    setSearchQuery(filter);
    setSelectedFolder(null);
  };

  if (!pstId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-slate-950">
        <div className="text-center">
          <Mail className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">No hay archivo PST seleccionado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-slate-950 dark:to-gray-900">
      <Header showBackButton={true} onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div className="flex h-[calc(100vh-64px)]">
        <Sidebar
          folders={folders || []}
          isLoading={foldersLoading}
          selectedFolder={selectedFolder}
          onSelectFolder={(id) => {
            setSelectedFolder(id);
            setSearchQuery('');
            setPage(1);
            setIsSidebarOpen(false);
          }}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Search Header */}
          <div className="bg-white/80 dark:bg-gray-900/80 glass-strong border-b border-gray-200/50 dark:border-gray-800/50 p-4 space-y-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar correos... (ej: from:juan subject:factura)"
            />

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              <QuickFilterChip
                icon={<Inbox className="w-4 h-4" />}
                label="Bandeja de entrada"
                onClick={() => handleQuickFilter('folder:Inbox')}
                active={searchQuery === 'folder:Inbox'}
              />
              <QuickFilterChip
                icon={<Send className="w-4 h-4" />}
                label="Enviados"
                onClick={() => handleQuickFilter('folder:Sent')}
                active={searchQuery === 'folder:Sent'}
              />
              <QuickFilterChip
                icon={<Paperclip className="w-4 h-4" />}
                label="Con adjuntos"
                onClick={() => handleQuickFilter('has:attachment')}
                active={searchQuery === 'has:attachment'}
              />
              <QuickFilterChip
                icon={<Calendar className="w-4 h-4" />}
                label="Esta semana"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() - 7);
                  handleQuickFilter(`after:${date.toISOString().split('T')[0]}`);
                }}
                active={searchQuery.startsWith('after:')}
              />
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto">
            {messagesLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="p-4 space-y-6">
                <AnimatePresence mode="wait">
                  {Object.entries(groupedMessages).map(([group, msgs]) => (
                    <motion.div
                      key={group}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                        {group}
                      </h3>
                      <MessageList messages={msgs} pstId={pstId} />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {messages.length >= 50 && (
                  <motion.div
                    className="flex justify-center py-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={isFetching}
                      className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 font-medium"
                    >
                      {isFetching ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cargando...
                        </span>
                      ) : (
                        'Cargar más correos'
                      )}
                    </button>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4">
                  <Search className="w-10 h-10 opacity-40" />
                </div>
                <p className="text-xl font-medium mb-2">No se encontraron correos</p>
                <p className="text-sm text-gray-400">Intenta con otros términos de búsqueda</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <SelectionBar pstId={pstId} onExportComplete={() => setToast({ message: '¡Exportación completada!', type: 'success' })} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

function QuickFilterChip({
  icon,
  label,
  onClick,
  active = false
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 whitespace-nowrap text-sm font-medium
        ${active
          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
          : 'bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

function MailPageLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-slate-950">
      <Header showBackButton={true} />
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-500">Cargando correos...</p>
        </div>
      </div>
    </div>
  );
}

export default function MailPage() {
  return (
    <Suspense fallback={<MailPageLoading />}>
      <MailPageContent />
    </Suspense>
  );
}
