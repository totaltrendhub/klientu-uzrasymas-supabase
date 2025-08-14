// src/components/Modal.jsx
import React, { useEffect, useRef } from "react";

export default function Modal({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Uždaryti su ESC
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    // Užrakinti fono scroll'ą
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // paspaudus ant „už“ modal – uždarom
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Centravimas + tarpai */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-3 sm:p-6">
        {/* Panelė su max aukščiu ir vidiniu scroll'u */}
        <div
          ref={panelRef}
          className="w-full max-w-xl bg-white rounded-2xl shadow-xl flex max-h-[90vh] flex-col"
          onMouseDown={(e) => e.stopPropagation()} // neleisti overlay handler'iui
        >
          {/* Sticky header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b bg-white rounded-t-2xl">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="px-2 py-1 rounded hover:bg-gray-100"
              aria-label="Uždaryti"
            >
              ✕
            </button>
          </div>

          {/* Scrollinamas turinys */}
          <div className="px-4 py-3 overflow-y-auto">
            {children}
          </div>

          {/* Sticky footer */}
          {footer && (
            <div className="sticky bottom-0 z-10 px-4 py-3 border-t bg-white rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
