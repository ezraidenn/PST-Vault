'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Paperclip, Download, Check, Clock, User, Mail, Folder, FileText, Loader2 } from 'lucide-react';
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
  const pstId = useSelectionStore((state) => state.pstId);

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
      const filename = `mensaje_${messageId}.${format}`;
      downloadBlob(blob, filename);
      setToast({ message: `Mensaje descargado como ${format.toUpperCase()}`, type: 'success' });
    } catch (error) {
      setToast({ message: 'Error al descargar mensaje', type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-slate-950">
        <Header showBackButton={true} />
        <div className="container mx-auto max-w-4xl p-4 space-y-4">
          <Skeleton className="h-12 w-3/4 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-slate-950">
        <Header showBackButton={true} />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <Mail className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">Mensaje no encontrado</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-slate-950 dark:to-gray-900">
      <Header showBackButton={true} />

      <main className="container mx-auto max-w-4xl p-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Subject Header */}
          <div className="bg-white/80 dark:bg-gray-900/80 glass-strong rounded-2xl p-6 shadow-premium border border-gray-200/50 dark:border-gray-800/50">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {message.subject || 'Sin asunto'}
              </h1>
              <button
                onClick={() => toggleSelection(messageId)}
                className={`
                  flex-shrink-0 p-3 rounded-xl transition-all duration-300
                  ${isSelected(messageId)
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600'
                  }
                `}
              >
                <Check className="w-5 h-5" />
              </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {(message.sender_name || message.sender_email || 'D')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {message.sender_name || 'Desconocido'}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 truncate text-xs">
                    {message.sender_email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatDate(message.date_utc)}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    Fecha de recepción
                  </p>
                </div>
              </div>

              {message.to_emails && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Para</p>
                    <p className="text-gray-900 dark:text-gray-100 text-sm break-all">{message.to_emails}</p>
                  </div>
                </div>
              )}

              {message.folder_path_display && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <Folder className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider mb-1">Carpeta</p>
                    <p className="text-gray-900 dark:text-gray-100 text-sm">{message.folder_path_display}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => handleDownloadMessage('eml')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Descargar EML
              </button>
              <button
                onClick={() => handleDownloadMessage('json')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                Descargar JSON
              </button>
            </div>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-white/80 dark:bg-gray-900/80 glass-strong rounded-2xl p-5 shadow-premium border border-gray-200/50 dark:border-gray-800/50"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
                  <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  Archivos adjuntos ({message.attachments.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {message.attachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => handleDownloadAttachment(att.id, att.filename)}
                    disabled={downloadingId === att.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 text-left group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      {downloadingId === att.id ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <FileText className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {att.filename}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(att.size_bytes)}
                      </p>
                    </div>
                    <Download className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message Body */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-premium border border-gray-200/50 dark:border-gray-800/50"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-4 border-b border-gray-200 dark:border-gray-800">
              Contenido del mensaje
            </h2>
            {message.body_html ? (
              <div
                className="prose prose-gray dark:prose-invert max-w-none prose-img:rounded-xl prose-a:text-indigo-600 dark:prose-a:text-indigo-400"
                dangerouslySetInnerHTML={{ __html: message.body_html }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300 leading-relaxed">
                {message.body_text || 'Sin contenido'}
              </pre>
            )}
          </motion.div>
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
