import React from 'react';
import './app-alert-modal.css';

const AppAlertModal = ({ isOpen, message, mode = 'alert', confirmText = '확인', cancelText = '취소', choices = [], onClose, onConfirm, onCancel, onChoice }) => {
    if (!isOpen) return null;

    const isConfirm = mode === 'confirm';
    const isChoice = mode === 'choice';

    return (
        <div className="app-alert-overlay" role="dialog" aria-modal="true" aria-live="assertive">
            <div className="app-alert-modal">
                <div className="app-alert-title">알림</div>
                <div className="app-alert-message">{message}</div>
                {isChoice ? (
                    <div className="app-alert-actions app-alert-choice-actions">
                        {(choices || []).map((choice, index) => (
                            <button
                                key={`${choice?.label || 'choice'}-${index}`}
                                type="button"
                                className="app-alert-confirm"
                                onClick={() => onChoice?.(choice?.value)}
                            >
                                {choice?.label || `선택 ${index + 1}`}
                            </button>
                        ))}
                        <button type="button" className="app-alert-confirm" onClick={onCancel}>{cancelText}</button>
                    </div>
                ) : isConfirm ? (
                    <div className="app-alert-actions">
                        <button type="button" className="app-alert-confirm" onClick={onCancel}>{cancelText}</button>
                        <button type="button" className="app-alert-confirm" onClick={onConfirm}>{confirmText}</button>
                    </div>
                ) : (
                    <button type="button" className="app-alert-confirm" onClick={onClose}>확인</button>
                )}
            </div>
        </div>
    );
};

export default AppAlertModal;
