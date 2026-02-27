/**
 * CBOR decoding utilities for Rain Protocol metadata.
 *
 * Replaces ethers dependency with raw Uint8Array handling.
 */

import { decodeAllSync } from 'cbor-web';
import pako from 'pako';
import { MAGIC_NUMBERS } from './constants.js';
import type { MetaV1S, AssetSchema, VisualiserMetadata } from './types.js';

/** Convert a hex string (with or without 0x prefix) to Uint8Array */
export function hexToBytes(hex: string): Uint8Array {
	const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
	const bytes = new Uint8Array(clean.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

/** Decode CBOR-encoded data (wrapper around cbor-web's decodeAllSync) */
export function cborDecode(dataEncoded: Uint8Array | string): unknown {
	return decodeAllSync(dataEncoded);
}

/**
 * Decode metadata bytes: inflate (pako) and parse JSON, or decode as text.
 * Replaces the ethers-dependent bytesToMeta.
 */
export function bytesToMeta(bytes: unknown, type: 'json' | 'text'): unknown {
	let bytesArr: Uint8Array;

	if (bytes instanceof Uint8Array) {
		bytesArr = bytes;
	} else if (bytes instanceof ArrayBuffer) {
		bytesArr = new Uint8Array(bytes);
	} else if (typeof bytes === 'string') {
		bytesArr = hexToBytes(bytes);
	} else if (ArrayBuffer.isView(bytes)) {
		bytesArr = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	} else {
		throw new Error('invalid meta: input must be bytes-like');
	}

	let decoded: string;
	if (type === 'json') {
		decoded = pako.inflate(bytesArr, { to: 'string' });
	} else {
		decoded = new TextDecoder().decode(bytesArr).slice(3);
	}

	try {
		return JSON.parse(decoded);
	} catch {
		return decoded;
	}
}

/**
 * Convert flat dot-notation keys into a nested object.
 * e.g. { "asset.location.country": "US" } → { asset: { location: { country: "US" } } }
 */
export function convertDotNotationToObject(
	input: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const key of Object.keys(input)) {
		const value = input[key];
		const keyParts = key.split('.');

		let currentPart: Record<string, unknown> = result;
		for (let i = 0; i < keyParts.length; i++) {
			const part = keyParts[i];

			if (i === keyParts.length - 1) {
				currentPart[part] = value;
				break;
			}

			if (!currentPart[part] || typeof currentPart[part] !== 'object') {
				currentPart[part] = {};
			}

			currentPart = currentPart[part] as Record<string, unknown>;
		}
	}

	return result;
}

/** Schema cache shared across decode calls */
const schemaCache = new Map<string, AssetSchema | null>();

/** Register a known schema in the decode cache */
export function registerSchema(schema: AssetSchema): void {
	if (schema.hash) {
		schemaCache.set(schema.hash, schema);
	}
}

/** Clear the schema cache */
export function clearSchemaCache(): void {
	schemaCache.clear();
}

/**
 * Decode a single raw metadata entry into a VisualiserMetadata object.
 * This is the full pipeline: strip prefix → CBOR decode → extract schema → decode payload.
 */
export function decodeMetadataEntry(
	meta: MetaV1S & { transaction?: { timestamp: string } },
	timestamp?: number
): VisualiserMetadata {
	let decodedData: Record<string, unknown> | null = null;
	let schema: AssetSchema | null = null;
	let schemaHash: string | null = null;
	const ts = timestamp ?? (meta.transaction?.timestamp ? parseInt(meta.transaction.timestamp) : undefined);

	if (meta.meta) {
		try {
			// Strip 18-character prefix (0x + 8 bytes magic number) and decode CBOR
			const decoded = cborDecode(meta.meta.slice(18));
			const information = Array.isArray(decoded) ? decoded : [];

			// Extract schema hash from CBOR container
			const schemaContainer = Array.isArray(information) ? information[0] : null;
			if (schemaContainer instanceof Map) {
				const hash = schemaContainer.get(MAGIC_NUMBERS.OA_SCHEMA);
				if (typeof hash === 'string') {
					schemaHash = hash;
					schema = schemaCache.get(hash) ?? null;
				}
			}

			// Decode the actual payload (first container, key 0)
			if (schemaContainer instanceof Map) {
				const payload = schemaContainer.get(0);
				if (payload) {
					try {
						const decoded = bytesToMeta(payload, 'json');
						if (typeof decoded === 'object' && decoded !== null) {
							// Auto-convert dot-notation keys to nested objects
							const raw = decoded as Record<string, unknown>;
							const hasDotKeys = Object.keys(raw).some((k) => k.includes('.'));
							decodedData = hasDotKeys ? convertDotNotationToObject(raw) : raw;
						}
					} catch (e) {
						console.warn('[metadata-visualiser] Failed to decode payload:', e);
					}
				}
			}
		} catch (error) {
			console.warn('[metadata-visualiser] Failed to decode metadata entry', meta.id, error);
			return {
				id: meta.id,
				metaHash: meta.metaHash,
				sender: meta.sender,
				subject: meta.subject,
				schemaHash: null,
				decodedData: null,
				schema: null,
				raw: meta,
				error: true,
				timestamp: ts
			};
		}
	}

	return {
		id: meta.id,
		metaHash: meta.metaHash,
		sender: meta.sender,
		subject: meta.subject,
		schemaHash,
		decodedData,
		schema,
		raw: meta,
		timestamp: ts
	};
}
