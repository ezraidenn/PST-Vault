'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Folder, X, Inbox } from 'lucide-react';
import { FolderNode } from '@/lib/api';
import { Skeleton } from './Skeleton';

interface SidebarProps {
  folders: FolderNode[];
  isLoading: boolean;
  selectedFolder: number | null;
  onSelectFolder: (id: number | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ folders, isLoading, selectedFolder, onSelectFolder, isOpen, onClose }: SidebarProps) {
  const content = (
    <div className="h-full flex flex-col bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800">
      <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
        <h2 className="font-semibold text-stone-800 dark:text-stone-200">Carpetas</h2>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-stone-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <button
              onClick={() => onSelectFolder(null)}
              className={`
                w-full text-left px-3 py-2.5 rounded-lg transition-colors
                ${selectedFolder === null
                  ? 'bg-amber-600 text-white'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                <span className="font-medium text-sm">Todos los correos</span>
              </div>
            </button>

            {folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                selectedFolder={selectedFolder}
                onSelectFolder={onSelectFolder}
                level={0}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:block w-64 h-full flex-shrink-0">
        {content}
      </aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed left-0 top-16 bottom-0 w-64 z-50 md:hidden shadow-xl"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function FolderItem({
  folder,
  selectedFolder,
  onSelectFolder,
  level,
}: {
  folder: FolderNode;
  selectedFolder: number | null;
  onSelectFolder: (id: number) => void;
  level: number;
}) {
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolder === folder.id;

  return (
    <div>
      <button
        onClick={() => onSelectFolder(folder.id)}
        className={`
          w-full text-left px-3 py-2 rounded-lg transition-colors text-sm
          ${isSelected
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-medium'
            : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400'
          }
        `}
        style={{ paddingLeft: `${12 + level * 12}px` }}
      >
        <div className="flex items-center gap-2">
          <Folder className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-amber-600' : 'text-stone-400'}`} />
          <span className="truncate">{folder.name}</span>
        </div>
      </button>

      {hasChildren && (
        <div className="mt-0.5">
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
