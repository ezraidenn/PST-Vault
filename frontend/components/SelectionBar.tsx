'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Loader2, Package } from 'lucide-react';
import { useSelectionStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { downloadBlob } from '@/lib/utils';

interface SelectionBarProps {
  pstId: string;
  onExportComplete?: () => void;
}

export function SelectionBar({ pstId, onExportComplete }: SelectionBarProps) {
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const [isExporting, setIsExporting] = useState(false);

  const selectedIdsArray = Array.from(selectedIds);

  const handleExport = async () => {
    if (selectedIdsArray.length === 0) return;

    setIsExporting(true);
    try {
      const blob = await apiClient.exportMessages({
        pst_id: pstId,
        message_ids: selectedIdsArray,
        format: 'eml',
        include_attachments: true,
      });

      downloadBlob(blob, `correos_${new Date().toISOString().split('T')[0]}.zip`);
      onExportComplete?.();
      clearSelection();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {selectedIdsArray.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md"
        >
          <div className="bg-stone-900 dark:bg-stone-800 rounded-xl shadow-xl border border-stone-700 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {selectedIdsArray.length} {selectedIdsArray.length === 1 ? 'correo' : 'correos'}
                  </p>
                  <p className="text-stone-400 text-xs">seleccionados</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exportando
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Descargar
                    </>
                  )}
                </button>

                <button
                  onClick={clearSelection}
                  className="p-2 text-stone-400 hover:text-white hover:bg-stone-700 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
