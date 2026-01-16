'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Loader2, Mail, Shield, Search, Zap, Check, X, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useSelectionStore } from '@/lib/store';
import { Header } from '@/components/Header';
import { Toast } from '@/components/Toast';

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.pst', '.pst.vem', '.pst.temp', '.pst.bak', '.ost'];

interface FileUploadState {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  message?: string;
  pstId?: string;
  messageCount?: number;
}

function isValidPSTFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

export default function HomePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<FileUploadState[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const setPstId = useSelectionStore((state) => state.setPstId);
  const clearSelection = useSelectionStore((state) => state.clearSelection);

  const processFiles = useCallback(async (files: File[]) => {
    // Filter valid files
    const validFiles = files.filter(f => isValidPSTFile(f.name));
    const invalidFiles = files.filter(f => !isValidPSTFile(f.name));

    if (invalidFiles.length > 0) {
      setToast({
        message: `${invalidFiles.length} archivo(s) no soportado(s). Formatos válidos: ${SUPPORTED_EXTENSIONS.join(', ')}`,
        type: 'error'
      });
    }

    if (validFiles.length === 0) return;

    clearSelection();

    // Initialize queue
    const initialQueue: FileUploadState[] = validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));
    setUploadQueue(initialQueue);

    // Process each file sequentially
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];

      // Update status to uploading
      setUploadQueue(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'uploading', progress: 0 } : item
      ));

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadQueue(prev => prev.map((item, idx) =>
            idx === i && item.status === 'uploading'
              ? { ...item, progress: Math.min(item.progress + Math.random() * 15, 90) }
              : item
          ));
        }, 300);

        const response = await apiClient.uploadPST(file);
        clearInterval(progressInterval);

        // Update to success
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? {
            ...item,
            status: 'success',
            progress: 100,
            pstId: response.pst_id,
            messageCount: response.message_count,
            message: response.already_indexed
              ? `Ya indexado: ${response.message_count.toLocaleString()} correos`
              : `${response.message_count.toLocaleString()} correos indexados`
          } : item
        ));

        // Set the last successful PST as current
        setPstId(response.pst_id);

      } catch (error: any) {
        // Update to error
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? {
            ...item,
            status: 'error',
            progress: 0,
            message: error.message || 'Error al procesar'
          } : item
        ));
      }
    }
  }, [clearSelection, setPstId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleGoToMail = (pstId: string) => {
    router.push(`/mail?pst_id=${pstId}`);
  };

  const handleClearQueue = () => {
    setUploadQueue([]);
  };

  const successCount = uploadQueue.filter(f => f.status === 'success').length;
  const isUploading = uploadQueue.some(f => f.status === 'uploading');

  const features = [
    {
      icon: Search,
      title: 'Búsqueda Avanzada',
      description: 'Encuentra cualquier correo con búsqueda estilo Gmail'
    },
    {
      icon: Shield,
      title: '100% Privado',
      description: 'Tus datos nunca salen de tu dispositivo'
    },
    {
      icon: Zap,
      title: 'Subida Masiva',
      description: 'Sube múltiples archivos PST a la vez'
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <Header showBackButton={false} />

      <main className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm font-medium mb-6 border border-amber-200 dark:border-amber-800/50">
            <Mail className="w-4 h-4" />
            Visor de Archivos PST
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-stone-800 dark:text-stone-100">
            PST Vault
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-xl mx-auto leading-relaxed">
            Lee tus archivos de Outlook <span className="font-semibold text-stone-800 dark:text-stone-200">sin necesitar Outlook</span>.
            Soporta múltiples archivos simultáneamente.
          </p>
        </motion.div>

        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`
              relative rounded-2xl border-2 border-dashed p-8 md:p-12 transition-all duration-300
              ${isDragging
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10'
                : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-amber-400 dark:hover:border-amber-600'
              }
              ${isUploading ? 'pointer-events-none' : 'cursor-pointer'}
              shadow-elegant
            `}
          >
            <input
              type="file"
              accept=".pst,.ost,.vem,.temp,.bak"
              multiple
              onChange={handleFileInput}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Upload className="w-7 h-7 text-amber-700 dark:text-amber-400" />
              </div>

              <div className="text-center">
                <p className="text-xl font-semibold text-stone-800 dark:text-stone-200 mb-2">
                  Arrastra tus archivos aquí
                </p>
                <p className="text-stone-500 dark:text-stone-400 mb-3">
                  o haz clic para seleccionar múltiples archivos
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  {SUPPORTED_EXTENSIONS.map(ext => (
                    <span key={ext} className="px-2 py-1 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded">
                      {ext}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
                  Hasta 15GB por archivo
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Upload Queue */}
        <AnimatePresence>
          {uploadQueue.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-elegant overflow-hidden">
                <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <h3 className="font-semibold text-stone-800 dark:text-stone-200">
                    Archivos ({successCount}/{uploadQueue.length} completados)
                  </h3>
                  {!isUploading && (
                    <button
                      onClick={handleClearQueue}
                      className="text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {uploadQueue.map((item, index) => (
                    <div key={index} className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Status icon */}
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                          ${item.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
                            item.status === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
                              item.status === 'uploading' ? 'bg-amber-100 dark:bg-amber-900/30' :
                                'bg-stone-100 dark:bg-stone-800'}
                        `}>
                          {item.status === 'success' ? (
                            <Check className="w-5 h-5 text-green-600" />
                          ) : item.status === 'error' ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : item.status === 'uploading' ? (
                            <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                          ) : (
                            <FileText className="w-5 h-5 text-stone-400" />
                          )}
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-stone-800 dark:text-stone-200 truncate text-sm">
                            {item.file.name}
                          </p>
                          <p className={`text-xs ${item.status === 'success' ? 'text-green-600' :
                              item.status === 'error' ? 'text-red-600' :
                                'text-stone-500'
                            }`}>
                            {item.message || (item.status === 'uploading'
                              ? 'Procesando...'
                              : item.status === 'pending'
                                ? 'En espera...'
                                : '')}
                          </p>

                          {item.status === 'uploading' && (
                            <div className="mt-2 w-full bg-stone-200 dark:bg-stone-700 rounded-full h-1">
                              <div
                                className="h-full bg-amber-600 rounded-full transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Action */}
                        {item.status === 'success' && item.pstId && (
                          <button
                            onClick={() => handleGoToMail(item.pstId!)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Ver correos
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
              className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-elegant card-hover"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-3">
                <feature.icon className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold text-stone-800 dark:text-stone-200 mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-stone-400 dark:text-stone-500 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />
            Tus archivos se procesan localmente y nunca salen de tu dispositivo
          </p>
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
