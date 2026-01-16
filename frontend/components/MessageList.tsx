'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Paperclip, CheckCircle2, Circle, User } from 'lucide-react';
import { MessageListItem } from '@/lib/api';
import { useSelectionStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';

interface MessageListProps {
  messages: MessageListItem[];
  pstId: string;
}

export function MessageList({ messages, pstId }: MessageListProps) {
  const router = useRouter();
  const isSelected = useSelectionStore((state) => state.isSelected);
  const toggleSelection = useSelectionStore((state) => state.toggleSelection);

  return (
    <div className="space-y-2">
      {messages.map((message, index) => (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: index * 0.03, ease: "easeOut" }}
          className={`
            group relative bg-white/80 dark:bg-gray-900/80 rounded-2xl border glass
            transition-all duration-300 cursor-pointer overflow-hidden
            ${isSelected(message.id)
              ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900 shadow-lg'
              : 'border-gray-200/50 dark:border-gray-800/50 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-premium'
            }
          `}
        >
          <div
            onClick={() => router.push(`/mail/${message.id}`)}
            className="p-4"
          >
            <div className="flex items-start gap-3">
              {/* Selection checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(message.id);
                }}
                className="mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
              >
                {isSelected(message.id) ? (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-400 transition-colors" />
                )}
              </button>

              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
                {(message.sender_name || message.sender_email || 'D')[0].toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate flex-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {message.subject || 'Sin asunto'}
                  </h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 font-medium">
                    {formatDate(message.date_utc)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1.5 font-medium">
                  {message.sender_name || message.sender_email || 'Desconocido'}
                </p>

                <p className="text-sm text-gray-500 dark:text-gray-500 line-clamp-2 leading-relaxed">
                  {message.snippet || 'Sin vista previa disponible'}
                </p>

                {/* Tags */}
                <div className="flex items-center gap-2 mt-3">
                  {message.has_attachments === 1 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full font-medium">
                      <Paperclip className="w-3 h-3" />
                      Adjunto
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {message.folder_path_display}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Selection indicator bar */}
          {isSelected(message.id) && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 origin-left"
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}
