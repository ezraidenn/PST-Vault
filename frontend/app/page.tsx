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
      // Simulate progress for large files
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-gray-950 dark:via-slate-950 dark:to-gray-900">
      <Header showBackButton={false} />

      <main className="container mx-auto px-4 py-8 md:py-16 max-w-5xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-6">
            <Mail className="w-4 h-4" />
            Visor de Archivos PST
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            <span className="gradient-text-premium">PST Vault</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Lee tus archivos de Outlook <span className="font-semibold text-gray-900 dark:text-gray-200">sin necesitar Outlook</span>.
            Búsqueda instantánea, totalmente privado.
          </p>
        </motion.div>

        {/* Upload Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
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
              relative rounded-3xl border-2 border-dashed p-8 md:p-16 transition-all duration-500
              ${isDragging
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.02] shadow-glow'
                : 'border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-white dark:hover:bg-gray-900'
              }
              ${isUploading ? 'pointer-events-none' : 'cursor-pointer'}
              glass-strong shadow-premium-lg
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
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-30 animate-pulse" />
                    <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full p-6">
                      <Loader2 className="w-12 h-12 text-white animate-spin" />
                    </div>
                  </div>

                  <div className="text-center space-y-4 w-full max-w-md">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {uploadStatus}
                    </p>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Por favor espera mientras procesamos tu archivo...
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative animate-float">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-2xl opacity-20" />
                    <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 shadow-lg">
                      <Upload className="w-12 h-12 text-white" />
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Arrastra tu archivo PST aquí
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      o haz clic para seleccionar
                    </p>
                    <div className="inline-flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800/50 px-4 py-2 rounded-full">
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className="group p-6 rounded-2xl bg-white/60 dark:bg-gray-900/60 glass border border-gray-200/50 dark:border-gray-800/50 card-hover"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
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
