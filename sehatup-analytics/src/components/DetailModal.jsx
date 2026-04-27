import React from 'react';
import { formatDate } from '../utils/dataHelpers';

export default function DetailModal({ submission, onClose }) {
    if (!submission) return null;

    // Function to recursively render object/array data
    const renderDetail = (key, value) => {
        if (value === null || value === undefined) {
            value = "N/A";
        } else if (value.toDate && typeof value.toDate === 'function') {
            // Handle Firebase Timestamp
            value = formatDate(value.toDate());
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            // Handle nested object (Map in Firestore)

            const subEntries = Object.entries(value);
            if (subEntries.length === 0) return <div key={key} className="modal-detail-row"><span>{key.replace(/([A-Z])/g, ' $1').trim()}</span><span>Empty Map</span></div>;

            return (
                <div key={key} className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                    <div className="text-sm font-bold text-pink-400 uppercase mb-2">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                    <div className="space-y-1">
                        {subEntries.map(([subKey, subValue]) => renderDetail(subKey, subValue))}
                    </div>
                </div>
            );
        } else if (Array.isArray(value)) {
            // Handle array
            value = value.map(item => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(' | ');
        } else if (key.toLowerCase().includes('password')) {
            // Censor sensitive fields
            value = "********";
        }

        return (
            <div key={key} className="modal-detail-row">
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span>{String(value)}</span>
            </div>
        );
    };

    return (
        <div className="modal-overlay animate-fadeIn" onClick={onClose}>
            <div className="modal-content animate-slideUp" onClick={(e) => e.stopPropagation()}>
                <div className="modal-title">Submission Details: {submission.userName || submission.name || submission.id}</div>

                <div className="space-y-2">
                    {Object.entries(submission).map(([key, value]) => renderDetail(key, value))}
                </div>

                <div className="flex justify-end mt-6">
                    <button className="btn ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}