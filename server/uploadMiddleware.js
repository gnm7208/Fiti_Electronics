import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const IMAGES_DIR = path.join(__dirname, '..', 'images');

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'product';
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.png';
        const base = slugify(req.body?.name || 'product');
        const suffix = randomBytes(4).toString('hex');
        cb(null, `${base}-${suffix}${ext}`);
    },
});

function fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(new Error('Only PNG, JPEG, or WEBP images are allowed'));
        return;
    }
    cb(null, true);
}

// Accepts one primary photo ("photo") and up to 6 additional gallery photos
// ("galleryPhotos") in the same multipart/form-data submission as the product's
// text fields (name, price, imageUrl, galleryUrls, specs, etc.).
export const productPhotoUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).fields([
    { name: 'photo', maxCount: 1 },
    { name: 'galleryPhotos', maxCount: 6 },
]);

/** Relative "images/<file>" path (matching the existing product.image convention). */
export function toImagesPath(filename) {
    return `images/${filename}`;
}
