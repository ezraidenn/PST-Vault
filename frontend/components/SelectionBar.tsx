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

  const handleExport = async () => {
    if (selectedIds.length === 0) return;

    setIsExporting(true);
    try {
      const blob = await apiClient.exportMessages({
        pst_id: pstId,
        message_ids: selectedIds,
        format: 'eml',
        include_attachments: true,
      });

      downloadBlob(blob, `correos_exportados_${new Date().toISOString().split('T')[0]}.zip`);
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
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-lg"
        >
          <div className="bg-gray-900 dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">
                    {selectedIds.length} {selectedIds.length === 1 ? 'correo' : 'correos'}
                  </p>
                  <p className="text-gray-400 text-sm">seleccionados</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium shadow-lg transition-all duration-300 disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Descargar ZIP
                    </>
                  )}
                </motion.button>

                <button
                  onClick={clearSelection}
                  className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
