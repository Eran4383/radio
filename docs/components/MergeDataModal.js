import React from 'react';

const MergeDataModal = ({ isOpen, onMerge, onDiscardLocal }) => {
  if (!isOpen) return null;

  return (
    React.createElement("div", { className: "fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4", role: "dialog", "aria-modal": "true", "aria-labelledby": "merge-modal-title" },
      React.createElement("div", { className: "bg-bg-secondary rounded-lg shadow-2xl p-6 w-full max-w-sm text-center animate-fade-in-up" },
        React.createElement("h2", { id: "merge-modal-title", className: "text-xl font-bold text-text-primary mb-3" }, "סנכרון הגדרות"),
        React.createElement("p", { className: "text-text-secondary mb-6" },
          "מצאנו הגדרות שמורות על המכשיר הזה. מה תרצה לעשות איתן?"
        ),
        React.createElement("div", { className: "flex flex-col gap-3" },
          React.createElement("button", {
            onClick: onMerge,
            className: "w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 px-4 rounded-lg transition-colors"
          },
            "שמור הגדרות ממכשיר זה"
          ),
          React.createElement("button", {
            onClick: onDiscardLocal,
            className: "w-full bg-bg-primary hover:bg-accent/20 text-text-primary font-bold py-3 px-4 rounded-lg transition-colors"
          },
            "טען הגדרות מהחשבון שלך"
          )
        )
      )
    )
  );
};

export default MergeDataModal;