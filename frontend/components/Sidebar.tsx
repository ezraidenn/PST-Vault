'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Folder, X, ChevronRight, Inbox } from 'lucide-react';
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
    <div className="h-full flex flex-col bg-white/90 dark:bg-gray-900/90 glass-strong border-r border-gray-200/50 dark:border-gray-800/50">
      <div className="p-4 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
            <Folder className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Carpetas</h2>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <button
              onClick={() => onSelectFolder(null)}
              className={`
                w-full text-left px-4 py-3 rounded-xl transition-all duration-300 group
                ${selectedFolder === null
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <Inbox className={`w-5 h-5 ${selectedFolder === null ? 'text-white' : 'text-indigo-500'}`} />
                <span className="font-medium">Todos los correos</span>
              </div>
            </button>

            <div className="pt-2">
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  selectedFolder={selectedFolder}
                  onSelectFolder={onSelectFolder}
                  level={0}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-72 h-full flex-shrink-0">
        {content}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed left-0 top-16 bottom-0 w-72 z-50 md:hidden shadow-2xl"
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
          w-full text-left px-4 py-2.5 rounded-xl transition-all duration-300 group
          ${isSelected
            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
          }
        `}
        style={{ paddingLeft: `${16 + level * 16}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren && (
            <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`} />
          )}
          <Folder className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-400'}`} />
          <span className="text-sm truncate">{folder.name}</span>
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
