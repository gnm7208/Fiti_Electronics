import express from 'express';
import { createProductsStore } from './productsStore.js';
import { productPhotoUpload, toImagesPath } from './uploadMiddleware.js';

function parseSpecs(raw) {
    if (!raw) return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return undefined;
        return parsed
            .filter(s => s && s.label && s.value)
            .map(s => ({ label: String(s.label).trim(), value: String(s.value).trim() }));
    } catch {
        return undefined;
    }
}

function parseUrlList(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
        return [];
    }
}

// Resolves the primary image + gallery from an admin submission: an uploaded
// file takes priority over a pasted URL for the primary photo; the gallery is
// whatever mix of uploaded files and pasted URLs were submitted, in order.
function resolveImages(req) {
    const uploadedPrimary = req.files?.photo?.[0];
    const uploadedGallery = (req.files?.galleryPhotos || []).map(f => toImagesPath(f.filename));
    const galleryUrls = parseUrlList(req.body.galleryUrls);

    const image = uploadedPrimary ? toImagesPath(uploadedPrimary.filename) : (req.body.imageUrl || undefined);
    const images = image ? [image, ...uploadedGallery, ...galleryUrls] : undefined;
    return { image, images };
}

function parseNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

export function createAdminProductsRouter(db) {
    const store = createProductsStore(db);
    const router = express.Router();

    router.post('/', productPhotoUpload, (req, res) => {
        const { name, category, description } = req.body || {};
        const price = parseNumber(req.body.price);
        const costPrice = parseNumber(req.body.costPrice);
        const stock = parseNumber(req.body.stock);
        const { image, images } = resolveImages(req);

        if (!name || !category || !description || price === undefined || costPrice === undefined || stock === undefined || !image) {
            res.status(400).json({ error: 'name, category, description, price, costPrice, stock, and a photo (file or URL) are required' });
            return;
        }

        const product = { name, category, description, price, costPrice, stock: Math.max(0, Math.round(stock)), image, images };
        const originalPrice = parseNumber(req.body.originalPrice);
        if (originalPrice !== undefined) product.originalPrice = originalPrice;
        const specs = parseSpecs(req.body.specs);
        if (specs) product.specs = specs;

        res.status(201).json(store.create(product));
    });

    router.put('/:id', productPhotoUpload, (req, res) => {
        const existing = store.getById(req.params.id);
        if (!existing) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }

        const changes = {};
        if (req.body.name) changes.name = req.body.name;
        if (req.body.category) changes.category = req.body.category;
        if (req.body.description) changes.description = req.body.description;
        const price = parseNumber(req.body.price);
        if (price !== undefined) changes.price = price;
        const costPrice = parseNumber(req.body.costPrice);
        if (costPrice !== undefined) changes.costPrice = costPrice;
        const stock = parseNumber(req.body.stock);
        if (stock !== undefined) changes.stock = Math.max(0, Math.round(stock));
        const originalPrice = parseNumber(req.body.originalPrice);
        if (originalPrice !== undefined) changes.originalPrice = originalPrice;
        const specs = parseSpecs(req.body.specs);
        if (specs) changes.specs = specs;

        const { image, images } = resolveImages(req);
        if (image) {
            changes.image = image;
            changes.images = images;
        }

        res.json(store.update(req.params.id, changes));
    });

    router.delete('/:id', (req, res) => {
        const existing = store.getById(req.params.id);
        if (!existing) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        store.remove(req.params.id);
        res.status(204).end();
    });

    return router;
}
