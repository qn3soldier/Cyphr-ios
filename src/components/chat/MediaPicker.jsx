import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Video, Camera, X, Upload, FileText, Shield } from 'lucide-react';
import { Button } from '@/ui/button';
import { supabase } from '@/api/supabaseClient';
import { secureChaCha20 } from '@/api/crypto/secureChaCha20.ts';
import { secureRNG } from '@/api/crypto/secureRNG.ts';
import { toast } from 'sonner';

export default function MediaPicker({ onSelectMedia, onClose }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };

  const processFiles = (files) => {
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    
    // Filter out files that are too large
    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" is too large. Maximum size is 100MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const processedFiles = validFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      type: file.type.startsWith('image/') ? 'image' : 
            file.type.startsWith('video/') ? 'video' : 'document',
      name: file.name,
      size: file.size,
      preview: null
    }));

    // Generate previews for images and videos
    processedFiles.forEach(fileObj => {
      if (fileObj.type === 'image' || fileObj.type === 'video') {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedFiles(prev => prev.map(f => 
            f.id === fileObj.id ? { ...f, preview: e.target.result } : f
          ));
        };
        reader.readAsDataURL(fileObj.file);
      }
    });

    setSelectedFiles(prev => [...prev, ...processedFiles]);
  };

  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCapturing(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob(blob => {
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      processFiles([file]);
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  // Encrypt file before upload
  const encryptFile = async (file) => {
    try {
      // Generate random encryption key for this file
      const encryptionKey = await secureRNG.generateBytes(32);
      
      // Convert file to ArrayBuffer
      const fileBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(fileBuffer);
      
      // Encrypt file data with ChaCha20
      const encryptedData = await secureChaCha20.encrypt(fileData, encryptionKey);
      
      // Create encrypted blob
      const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });
      
      return {
        encryptedBlob,
        encryptionKey: Array.from(encryptionKey), // Convert to array for JSON storage
        originalName: file.name,
        originalType: file.type,
        originalSize: file.size
      };
    } catch (error) {
      console.error('File encryption error:', error);
      throw new Error(`Failed to encrypt ${file.name}`);
    }
  };

  const handleSend = async () => {
    if (selectedFiles.length === 0) return;

    // Show uploading state
    toast.loading('Encrypting and uploading files...', { id: 'file-upload' });

    try {
      const uploadedFiles = [];
      
      for (const fileObj of selectedFiles) {
        try {
          // Encrypt file before upload
          const { encryptedBlob, encryptionKey, originalName, originalType, originalSize } = 
            await encryptFile(fileObj.file);
          
          // Upload encrypted file to Supabase Storage
          const fileName = `encrypted_${Date.now()}_${crypto.randomUUID()}.enc`;
          const filePath = `chat_media/${fileName}`;
          
          const { data, error } = await supabase.storage
            .from('chat-files')
            .upload(filePath, encryptedBlob, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'application/octet-stream'
            });

          if (error) {
            console.error('Upload error:', error);
            toast.error(`Failed to upload ${originalName}`);
            continue;
          }

          // Get public URL for encrypted file
          const { data: { publicUrl } } = supabase.storage
            .from('chat-files')
            .getPublicUrl(data.path);

          uploadedFiles.push({
            ...fileObj,
            url: publicUrl,
            path: data.path,
            encryptionKey,
            originalName,
            originalType,
            originalSize,
            encrypted: true
          });
        } catch (fileError) {
          console.error(`Error processing ${fileObj.name}:`, fileError);
          toast.error(`Failed to process ${fileObj.name}`);
        }
      }

      if (uploadedFiles.length > 0) {
        toast.success(`Successfully uploaded ${uploadedFiles.length} encrypted files`, { id: 'file-upload' });
        onSelectMedia(uploadedFiles);
      } else {
        toast.error('No files were uploaded successfully', { id: 'file-upload' });
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files', { id: 'file-upload' });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <motion.div
      initial={{ y: 300, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 300, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-background-secondary/95 backdrop-blur-xl border-t border-border z-50"
      style={{ maxHeight: '70vh' }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Send Media</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-red-500 hover:bg-red-500/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Media Options */}
        {!isCapturing && selectedFiles.length === 0 && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Button
              variant="secondary"
              onClick={() => {
                fileInputRef.current.accept = 'image/*';
                fileInputRef.current.click();
              }}
              className="flex flex-col items-center gap-2 h-24"
            >
              <Image className="w-8 h-8" />
              <span className="text-sm">Gallery</span>
            </Button>

            <Button
              variant="secondary"
              onClick={startCamera}
              className="flex flex-col items-center gap-2 h-24"
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm">Camera</span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                fileInputRef.current.accept = '*/*';
                fileInputRef.current.click();
              }}
              className="flex flex-col items-center gap-2 h-24"
            >
              <FileText className="w-8 h-8" />
              <span className="text-sm">Document</span>
            </Button>
          </div>
        )}

        {/* Camera View */}
        {isCapturing && (
          <div className="relative mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
              style={{ maxHeight: '300px' }}
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button
                size="icon"
                onClick={stopCamera}
                className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600"
              >
                <X className="w-6 h-6" />
              </Button>
              <Button
                size="icon"
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white hover:bg-gray-100"
              >
                <div className="w-14 h-14 rounded-full bg-white border-4 border-black" />
              </Button>
            </div>
          </div>
        )}

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <AnimatePresence>
                {selectedFiles.map(fileObj => (
                  <motion.div
                    key={fileObj.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="relative group"
                  >
                    {fileObj.type === 'image' && fileObj.preview && (
                      <img
                        src={fileObj.preview}
                        alt={fileObj.name}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    )}
                    {fileObj.type === 'video' && fileObj.preview && (
                      <div className="relative">
                        <video
                          src={fileObj.preview}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Video className="absolute top-2 left-2 w-6 h-6 text-white drop-shadow" />
                      </div>
                    )}
                    {fileObj.type === 'document' && (
                      <div className="w-full h-32 bg-background-primary/50 rounded-lg flex flex-col items-center justify-center p-2">
                        <FileText className="w-8 h-8 mb-2 text-accent-primary" />
                        <p className="text-xs text-center truncate w-full">{fileObj.name}</p>
                      </div>
                    )}
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFile(fileObj.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </Button>

                    <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded">
                      {formatFileSize(fileObj.size)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Security Notice */}
            <div className="flex items-center justify-center gap-2 text-sm text-green-400 mb-3">
              <Shield className="w-4 h-4" />
              <span>Files will be encrypted with post-quantum ChaCha20</span>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              className="w-full bg-accent-primary hover:bg-accent-primary/80"
              size="lg"
            >
              <Upload className="w-5 h-5 mr-2" />
              Send {selectedFiles.length} encrypted {selectedFiles.length === 1 ? 'file' : 'files'}
            </Button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </motion.div>
  );
} 