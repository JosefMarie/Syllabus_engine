"use client";

import React, { useState } from "react";
import { ImageRef } from "@/types/syllabus";
import { Maximize2, X, ZoomIn, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  image: ImageRef;
}

export default function ImageLightbox({ image }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="my-6">
      <div 
        onClick={() => setIsOpen(true)}
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#2E2E34] bg-[#1C1C1F] p-2 transition-all hover:border-[#EAEAE6]"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#141416]">
          <img 
            src={image.url} 
            alt={image.alt || image.caption} 
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-slate-900/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
            <span className="inline-flex items-center space-x-2 rounded-full bg-[#EAEAE6] px-4 py-2 text-xs font-bold text-[#141416] shadow-lg">
              <ZoomIn className="w-4 h-4" />
              <span>Click to Zoom Diagram</span>
            </span>
          </div>
        </div>
        {image.caption && (
          <p className="mt-2 text-center text-xs font-mono text-[#A1A1AA] flex items-center justify-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#EAEAE6]" />
            {image.caption}
          </p>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-[#2E2E34] bg-[#141416] p-4 shadow-2xl"
            >
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 z-10 rounded-full bg-[#1C1C1F] p-2 text-white hover:bg-[#2E2E34] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img 
                src={image.url} 
                alt={image.alt || image.caption} 
                className="max-h-[75vh] w-full object-contain rounded-lg"
              />
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-white">{image.caption}</p>
                <p className="text-xs font-mono text-[#A1A1AA] mt-1">High-Resolution Architectural View</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
