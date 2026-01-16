'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Inbox, Send, Paperclip, Calendar, Loader2, Mail } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--background))' }}>
        <div className="text-center">
          <Mail className="w-16 h-16 text-stone-300 dark:text-stone-700 mx-auto mb-4" />
          <p className="text-stone-500 dark:text-stone-400 text-lg">No hay archivo PST seleccionado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
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
          <div className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 p-4 space-y-3">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar correos... (ej: from:juan subject:factura)"
            />

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              <QuickFilterChip
                icon={<Inbox className="w-4 h-4" />}
                label="Bandeja"
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
                label="Adjuntos"
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
          <div className="flex-1 overflow-y-auto bg-stone-50 dark:bg-stone-950">
            {messagesLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="p-4 space-y-6">
                {Object.entries(groupedMessages).map(([group, msgs]) => (
                  <div key={group}>
                    <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-3 px-1">
                      {group}
                    </h3>
                    <MessageList messages={msgs} pstId={pstId} />
                  </div>
                ))}

                {messages.length >= 50 && (
                  <div className="flex justify-center py-4">
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={isFetching}
                      className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {isFetching ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cargando...
                        </span>
                      ) : (
                        'Cargar más'
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-stone-500 dark:text-stone-400 p-8">
                <Search className="w-12 h-12 opacity-30 mb-4" />
                <p className="text-lg font-medium mb-1">No se encontraron correos</p>
                <p className="text-sm text-stone-400">Intenta con otros términos de búsqueda</p>
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
        flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap text-sm font-medium
        ${active
          ? 'bg-amber-600 text-white'
          : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-amber-400 dark:hover:border-amber-600'
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
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <Header showBackButton={true} />
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-stone-500">Cargando correos...</p>
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
