'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Upload, FileText, Loader2, Mail, Shield, Search, Zap } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useSelectionStore } from '@/lib/store';
import { Header } from '@/components/Header';
import { Toast } from '@/components/Toast';

export default function HomePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const setPstId = useSelectionStore((state) => state.setPstId);
  const clearSelection = useSelectionStore((state) => state.clearSelection);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pst')) {
      setToast({ message: 'Por favor selecciona un archivo .pst', type: 'error' });
      return;
    }

    setIsUploading(true);
    setUploadStatus('Subiendo archivo...');
    setUploadProgress(0);
    clearSelection();

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      const response = await apiClient.uploadPST(file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.already_indexed) {
        setUploadStatus('¡Archivo ya indexado!');
        setToast({ message: `PST listo: ${response.message_count.toLocaleString()} correos encontrados`, type: 'success' });
      } else {
        setUploadStatus('¡Indexación completada!');
        setToast({ message: `Indexados ${response.message_count.toLocaleString()} correos de ${response.folder_count} carpetas`, type: 'success' });
      }

      setPstId(response.pst_id);

      setTimeout(() => {
        router.push(`/mail?pst_id=${response.pst_id}`);
      }, 1500);
    } catch (error: any) {
      setToast({ message: error.message || 'Error al subir archivo', type: 'error' });
      setIsUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
    }
  }, [router, setPstId, clearSelection]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

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
      title: 'Ultra Rápido',
      description: 'Indexación y búsqueda instantánea con SQLite'
    }
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'hsl(var(--background))' }}>
      <Header showBackButton={false} />

      <main className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
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
            Búsqueda instantánea, totalmente privado.
          </p>
        </motion.div>

        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-16"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`
              relative rounded-2xl border-2 border-dashed p-10 md:p-16 transition-all duration-300
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
              accept=".pst"
              onChange={handleFileInput}
              disabled={isUploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="flex flex-col items-center gap-6">
              {isUploading ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-amber-700 dark:text-amber-400 animate-spin" />
                  </div>

                  <div className="text-center space-y-4 w-full max-w-sm">
                    <p className="text-lg font-semibold text-stone-800 dark:text-stone-200">
                      {uploadStatus}
                    </p>

                    <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className="h-full bg-amber-600 dark:bg-amber-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      Procesando archivo...
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-amber-700 dark:text-amber-400" />
                  </div>

                  <div className="text-center">
                    <p className="text-xl font-semibold text-stone-800 dark:text-stone-200 mb-2">
                      Arrastra tu archivo PST aquí
                    </p>
                    <p className="text-stone-500 dark:text-stone-400 mb-4">
                      o haz clic para seleccionar
                    </p>
                    <div className="inline-flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-full">
                      <FileText className="w-4 h-4" />
                      <span>Archivos .pst hasta 15GB</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

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
          className="mt-16 text-center"
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
