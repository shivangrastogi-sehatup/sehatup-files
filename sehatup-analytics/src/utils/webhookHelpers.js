const QUICKREPLY_WEBHOOK_URL = 'https://api.quickreply.ai/webhook/company/GgbHGAprcvQx26qKL_c/key/YfQSwCRH4oBic4ecL';

/**
 * Triggers the 'order_placed' event on QuickReply.
 */
export const triggerOrderPlacedWebhook = async (name, phone) => {
    try {
        const response = await fetch(QUICKREPLY_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event: 'order_placed',
                phone: phone,
                name: name
            }),
        });
        if (!response.ok) {
            console.error('Failed to trigger order_placed webhook:', response.statusText);
        }
    } catch (error) {
        console.error('Error triggering order_placed webhook:', error);
    }
};

/**
 * Triggers the 'health_kit_ready' event on QuickReply.
 */
export const triggerHealthKitReadyWebhook = async (name, phone, cartLink, prescriptionUrl) => {
    try {
        const response = await fetch(QUICKREPLY_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event: 'health_kit_ready',
                phone: phone,
                name: name,
                cartlink: cartLink,
                prescription_url: prescriptionUrl
            }),
        });
        if (!response.ok) {
            console.error('Failed to trigger health_kit_ready webhook:', response.statusText);
        }
    } catch (error) {
        console.error('Error triggering health_kit_ready webhook:', error);
    }
};
