import React from "react";
import { LINE, SURFACE } from "../lib/constants";

export function EmptyState({ text, action }) {
  return (
    <div style={{ border: `1px dashed ${LINE}`, background: SURFACE, padding: 28, textAlign: "center", fontSize: 14, color: "#8E939E" }}>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Modal({ children, onClose, wide, disableBackdropClose = false }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.8)",
        padding: 16,
        overflowY: "auto",
      }}
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: wide ? 480 : 400,
          border: `1px solid ${LINE}`,
          background: SURFACE,
          color: "#F4F4F6",
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
