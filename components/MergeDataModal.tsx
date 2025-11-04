import React from 'react';

interface MergeDataModalProps {
  isOpen: boolean;
  onMerge: () => void;
  onDiscardLocal: () => void;
}

const MergeDataModal: React.FC<MergeDataModalProps> = ({ isOpen, onMerge, onDiscardLocal }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="merge-modal-title">
      <div className="bg-bg-secondary rounded-lg shadow-2xl p-6 w-full max-w-sm text-center animate-fade-in-up">
        <h2 id="merge-modal-title" className="text-xl font-bold text-text-primary mb-3">סנכרון הגדרות</h2>
        <p className="text-text-secondary mb-6">
          מצאנו הגדרות שמורות על המכשיר הזה. מה תרצה לעשות איתן?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onMerge}
            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            מיזוג ושמירה בענן
          </button>
          <button
            onClick={onDiscardLocal}
            className="w-full bg-bg-primary hover:bg-accent/20 text-text-primary font-bold py-3 px-4 rounded-lg transition-colors"
          >
            טעינה מהענן (מחיקת מקומי)
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeDataModal;
