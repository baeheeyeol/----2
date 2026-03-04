const listeners = new Set();

export const showAppAlert = (message) => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return;
    listeners.forEach((listener) => listener({ kind: 'alert', message: normalizedMessage }));
};

export const showAppConfirm = (message, options = {}) => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return Promise.resolve(false);

    if (listeners.size === 0) {
        return Promise.resolve(window.confirm(normalizedMessage));
    }

    const confirmText = typeof options.confirmText === 'string' && options.confirmText.trim() ? options.confirmText.trim() : '확인';
    const cancelText = typeof options.cancelText === 'string' && options.cancelText.trim() ? options.cancelText.trim() : '취소';

    return new Promise((resolve) => {
        const payload = {
            kind: 'confirm',
            message: normalizedMessage,
            confirmText,
            cancelText,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
        };
        listeners.forEach((listener) => listener(payload));
    });
};

export const showAppChoice = (message, options = {}) => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return Promise.resolve(null);

    const normalizedChoices = Array.isArray(options.choices)
        ? options.choices
            .map((item) => {
                if (!item) return null;
                const label = String(item.label || '').trim();
                if (!label) return null;
                return { label, value: item.value };
            })
            .filter(Boolean)
        : [];

    if (normalizedChoices.length === 0) return Promise.resolve(null);

    if (listeners.size === 0) {
        const labels = normalizedChoices.map((item, index) => `${index + 1}. ${item.label}`).join('\n');
        const raw = window.prompt(`${normalizedMessage}\n${labels}`, '1');
        if (raw === null) return Promise.resolve(null);
        const index = Number(raw) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= normalizedChoices.length) return Promise.resolve(null);
        return Promise.resolve(normalizedChoices[index].value ?? null);
    }

    return new Promise((resolve) => {
        const payload = {
            kind: 'choice',
            message: normalizedMessage,
            choices: normalizedChoices,
            cancelText: typeof options.cancelText === 'string' && options.cancelText.trim() ? options.cancelText.trim() : '취소',
            onChoice: (value) => resolve(value ?? null),
            onCancel: () => resolve(null),
        };
        listeners.forEach((listener) => listener(payload));
    });
};

export const subscribeAppAlert = (listener) => {
    if (typeof listener !== 'function') {
        return () => {};
    }

    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
