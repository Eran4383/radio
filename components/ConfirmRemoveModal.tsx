import React from 'react';

interface ConfirmRemoveModalProps {
  isOpen: boolean;
  stationName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmRemoveModal: React.FC<ConfirmRemoveModalProps> = ({ isOpen, stationName, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in-up" 
        role="dialog" 
        aria-modal="true"
        onClick={onCancel} // Close on backdrop click
    >
      <div 
        className="bg-bg-secondary rounded-lg shadow-2xl p-6 w-full max-w-sm text-center border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-text-primary mb-3">הסרה ממועדפים</h2>
        <p className="text-text-secondary mb-6">
          האם ברצונך להסיר את <strong>{stationName}</strong> מרשימת המועדפים?
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors order-2 sm:order-1"
          >
            ביטול
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors order-1 sm:order-2"
          >
            כן, הסר
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmRemoveModal;