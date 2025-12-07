import React from 'react';

const ConfirmRemoveModal = ({ isOpen, stationName, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    React.createElement("div", { 
        className: "fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in-up", 
        role: "dialog", 
        "aria-modal": "true",
        onClick: onCancel 
    },
      React.createElement("div", { 
        className: "bg-bg-secondary rounded-lg shadow-2xl p-6 w-full max-w-sm text-center border border-gray-700",
        onClick: (e) => e.stopPropagation()
      },
        React.createElement("h2", { className: "text-xl font-bold text-text-primary mb-3" }, "הסרה ממועדפים"),
        React.createElement("p", { className: "text-text-secondary mb-6" },
          "האם ברצונך להסיר את ",
          React.createElement("strong", null, stationName),
          " מרשימת המועדפים?"
        ),
        React.createElement("div", { className: "flex flex-col gap-3 sm:flex-row" },
          React.createElement("button", {
            onClick: onCancel,
            className: "flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors order-2 sm:order-1"
          },
            "ביטול"
          ),
          React.createElement("button", {
            onClick: onConfirm,
            className: "flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors order-1 sm:order-2"
          },
            "כן, הסר"
          )
        )
      )
    )
  );
};

export default ConfirmRemoveModal;