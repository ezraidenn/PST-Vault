'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Paperclip, Download, Check, Clock, User, Mail, Folder, FileText, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useSelectionStore } from '@/lib/store';
import { formatDate, formatFileSize, downloadBlob } from '@/lib/utils';
import { Header } from '@/components/Header';
import { Toast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';
import { useState } from 'react';

export default function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const messageId = parseInt(resolvedParams.id);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const isSelected = useSelectionStore((state) => state.isSelected);
  const toggleSelection = useSelectionStore((state) => state.toggleSelection);

  const { data: message, isLoading } = useQuery({
    queryKey: ['message', messageId],
    queryFn: () => apiClient.getMessageDetail(messageId),
    enabled: !isNaN(messageId),
  });

  const handleDownloadAttachment = async (attachmentId: number, filename: string) => {
    try {
      setDownloadingId(attachmentId);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attachments/${attachmentId}/download`);
      if (!response.ok) throw new Error('Error al descargar');
      const blob = await response.blob();
      downloadBlob(blob, filename);
      setToast({ message: 'Archivo descargado', type: 'success' });
    } catch (error) {
      setToast({ message: 'Error al descargar archivo', type: 'error' });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadMessage = async (format: 'eml' | 'json') => {
    try {
      const blob = await apiClient.downloadMessage(messageId, format);
      downloadBlob(blob, `mensaje_${messageId}.${format}`);
      setToast({ message: `Mensaje descargado como ${format.toUpperCase()}`, type: 'success' });
    } catch (error) {
      setToast({ message: 'Error al descargar mensaje', type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
        <Header showBackButton={true} />
        <div className="container mx-auto max-w-3xl p-4 space-y-4">
          <Skeleton className="h-10 w-2/3 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
        <Header showBackButton={true} />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <Mail className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto mb-4" />
            <p className="text-stone-500">Mensaje no encontrado</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <Header showBackButton={true} />

      <main className="container mx-auto max-w-3xl p-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Subject Header */}
          <div className="bg-white dark:bg-stone-900 rounded-xl p-5 shadow-elegant border border-stone-200 dark:border-stone-800">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-xl md:text-2xl font-bold text-stone-800 dark:text-stone-100 leading-tight">
                {message.subject || 'Sin asunto'}
              </h1>
              <button
                onClick={() => toggleSelection(messageId)}
                className={`
                  flex-shrink-0 p-2.5 rounded-lg transition-all duration-200
                  ${isSelected(messageId)
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700'
                  }
                `}
              >
                <Check className="w-4 h-4" />
              </button>
            </div>

            {/* Metadata */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold">
                  {(message.sender_name || message.sender_email || 'D')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                    {message.sender_name || 'Desconocido'}
                  </p>
                  <p className="text-stone-500 dark:text-stone-400 truncate text-xs">
                    {message.sender_email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-stone-600 dark:text-stone-300 font-medium">
                    {formatDate(message.date_utc)}
                  </p>
                </div>
              </div>

              {message.to_emails && (
                <div className="flex items-start gap-2 px-1">
                  <span className="text-stone-400 text-xs font-medium uppercase">Para:</span>
                  <span className="text-stone-600 dark:text-stone-300 text-sm">{message.to_emails}</span>
                </div>
              )}

              {message.folder_path_display && (
                <div className="flex items-center gap-2 px-1">
                  <Folder className="w-4 h-4 text-stone-400" />
                  <span className="text-stone-500 dark:text-stone-400 text-sm">{message.folder_path_display}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-stone-200 dark:border-stone-700">
              <button
                onClick={() => handleDownloadMessage('eml')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                EML
              </button>
              <button
                onClick={() => handleDownloadMessage('json')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-stone-600 dark:text-stone-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="bg-white dark:bg-stone-900 rounded-xl p-5 shadow-elegant border border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2 mb-4">
                <Paperclip className="w-4 h-4 text-amber-600" />
                <h2 className="font-semibold text-stone-800 dark:text-stone-200">
                  Adjuntos ({message.attachments.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.attachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => handleDownloadAttachment(att.id, att.filename)}
                    disabled={downloadingId === att.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-stone-200 dark:border-stone-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      {downloadingId === att.id ? (
                        <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                      ) : (
                        <FileText className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-700 dark:text-stone-200 truncate text-sm">
                        {att.filename}
                      </p>
                      <p className="text-xs text-stone-400">
                        {formatFileSize(att.size_bytes)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Body */}
          <div className="bg-white dark:bg-stone-900 rounded-xl p-5 md:p-6 shadow-elegant border border-stone-200 dark:border-stone-800">
            {message.body_html ? (
              <div
                className="prose prose-stone dark:prose-invert max-w-none prose-sm"
                dangerouslySetInnerHTML={{ __html: message.body_html }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-stone-700 dark:text-stone-300 text-sm leading-relaxed">
                {message.body_text || 'Sin contenido'}
              </pre>
            )}
          </div>
        </motion.div>
      </main>

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
