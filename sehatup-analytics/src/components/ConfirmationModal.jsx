import React from 'react';

export default function ConfirmationModal({ title, message, onConfirm, onCancel, confirmText = "Confirm Delete" }) {
  return (
    <div className="modal-overlay animate-fadeIn" onClick={onCancel}>
      <div className="modal-content animate-slideUp" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
        <div className="modal-title text-red-500">{title}</div>
        
        <p className="text-gray-300 mb-6">{message}</p>

        <div className="flex justify-end space-x-3">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}