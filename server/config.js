import 'dotenv/config';

export const config = {
    port: process.env.PORT || 3000,

    mpesa: {
        env: process.env.MPESA_ENV || 'sandbox',
        consumerKey: process.env.MPESA_CONSUMER_KEY || '',
        consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
        shortcode: process.env.MPESA_SHORTCODE || '174379',
        passkey: process.env.MPESA_PASSKEY || '',
        callbackUrl: process.env.MPESA_CALLBACK_URL || '',
    },

    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },

    admin: {
        username: process.env.ADMIN_USERNAME || '',
        password: process.env.ADMIN_PASSWORD || '',
        jwtSecret: process.env.ADMIN_JWT_SECRET || '',
    },
};

export const mpesaConfigured = () =>
    Boolean(config.mpesa.consumerKey && config.mpesa.consumerSecret && config.mpesa.passkey);

export const stripeConfigured = () => Boolean(config.stripe.secretKey);

export const adminConfigured = () =>
    Boolean(config.admin.username && config.admin.password && config.admin.jwtSecret);
