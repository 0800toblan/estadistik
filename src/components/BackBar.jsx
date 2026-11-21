import React from "react";
import { ChevronLeft } from "lucide-react";
import { LINE, SURFACE, MUTED } from "../lib/constants";

export default function BackBar({ onBack, title, right }) {
  return (
    <div
      style={{
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: `1px solid ${LINE}`,
        paddingBottom: 12,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="font-mono-tech"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          color: MUTED,
          background: SURFACE,
          border: `1px solid ${LINE}`,
          cursor: "pointer",
        }}
      >
        <ChevronLeft size={16} /> VOLVER
      </button>
      {title && (
        <h1
          className="font-display"
          style={{
            flex: 1,
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </h1>
      )}
      {right}
    </div>
  );
}
