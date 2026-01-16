'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Paperclip, Check } from 'lucide-react';
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.02 }}
          className={`
            group relative bg-white dark:bg-stone-900 rounded-xl border transition-all duration-200 cursor-pointer
            ${isSelected(message.id)
              ? 'border-amber-400 dark:border-amber-600 shadow-md'
              : 'border-stone-200 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-elegant'
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
                className="mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              >
                <div className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                  ${isSelected(message.id)
                    ? 'bg-amber-600 border-amber-600'
                    : 'border-stone-300 dark:border-stone-600 hover:border-amber-500'
                  }
                `}>
                  {isSelected(message.id) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
              </button>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-semibold text-sm flex-shrink-0">
                {(message.sender_name || message.sender_email || 'D')[0].toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-stone-800 dark:text-stone-200 truncate flex-1">
                    {message.subject || 'Sin asunto'}
                  </h3>
                  <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                    {formatDate(message.date_utc)}
                  </span>
                </div>

                <p className="text-sm text-stone-600 dark:text-stone-400 mb-1">
                  {message.sender_name || message.sender_email || 'Desconocido'}
                </p>

                <p className="text-sm text-stone-500 dark:text-stone-500 line-clamp-2">
                  {message.snippet || 'Sin vista previa'}
                </p>

                {/* Tags */}
                {message.has_attachments === 1 && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                      <Paperclip className="w-3 h-3" />
                      Adjunto
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Selection indicator */}
          {isSelected(message.id) && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-600 rounded-l-xl" />
          )}
        </motion.div>
      ))}
    </div>
  );
}
