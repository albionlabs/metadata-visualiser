/**
 * Shared utility functions for metadata visualisation.
 */

import type { VisualiserMetadata } from './types.js';

/** Parse a value to a number, stripping commas from strings */
export function parseNumber(value: unknown): number {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	if (typeof value === 'string') {
		const cleaned = value.replace(/,/g, '');
		const parsed = Number.parseFloat(cleaned);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

/** Format a number for display with Intl.NumberFormat */
export function formatNumber(value: number, maximumFractionDigits = 1): string {
	return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

/** Parse a YYYY-MM string to a Date (first of month, UTC) */
export function toDate(value: string): Date | null {
	if (!value) return null;
	const date = new Date(`${value}-01T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Normalise various month formats to YYYY-MM */
export function normaliseMonth(value: unknown): string | null {
	if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return value;
	if (typeof value === 'string' && value.length >= 7) {
		const match = value.match(/(\d{4})[-/](\d{1,2})/);
		if (match) return `${match[1]}-${match[2].padStart(2, '0')}`;
	}
	return null;
}

/** Navigate a nested object by path segments */
export function getAssetNode(path: string[], source: VisualiserMetadata | null): unknown {
	let current: unknown = source?.decodedData;
	for (const segment of path) {
		if (current && typeof current === 'object' && segment in current) {
			current = (current as Record<string, unknown>)[segment];
		} else {
			return undefined;
		}
	}
	return current;
}

/**
 * Parse coordinate strings in various formats (decimal, DMS, directional).
 * Returns a numeric latitude/longitude or null.
 */
export function parseCoordinate(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const trimmed = value.trim();

		// Simple numeric with optional directional suffix (e.g. "32.5N")
		const directionalMatch = trimmed.match(/^[+-]?\d+(?:\.\d+)?\s*[NSEW]?$/i);
		if (directionalMatch) {
			const cleaned = trimmed.replace(/[NSEW]$/i, '');
			const parsed = Number.parseFloat(cleaned);
			if (Number.isFinite(parsed)) {
				const direction = trimmed.slice(-1).toUpperCase();
				if (direction === 'S' || direction === 'W') {
					return -Math.abs(parsed);
				}
				return parsed;
			}
		}

		// DMS format (e.g. "32°30'15"N")
		const dmsMatch = trimmed.match(
			/(-?\d+(?:\.\d+)?)°?\s*(\d+(?:\.\d+)?)?'?\s*(\d+(?:\.\d+)?)?"?\s*([NSEW])?/i
		);
		if (dmsMatch) {
			const degrees = Number.parseFloat(dmsMatch[1] ?? '0');
			const minutes = Number.parseFloat(dmsMatch[2] ?? '0');
			const seconds = Number.parseFloat(dmsMatch[3] ?? '0');
			if ([degrees, minutes, seconds].every((part) => Number.isFinite(part))) {
				let decimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
				const hemisphere = (dmsMatch[4] ?? '').toUpperCase();
				if (hemisphere === 'S' || hemisphere === 'W' || degrees < 0) {
					decimal = -decimal;
				}
				return decimal;
			}
		}

		// Fallback: strip non-numeric chars
		const fallback = Number.parseFloat(trimmed.replace(/[^0-9+\-.]/g, ''));
		if (Number.isFinite(fallback)) {
			return fallback;
		}
	}
	return null;
}

/** Format a UNIX timestamp (seconds) to a readable date string */
export function formatTimestamp(timestamp: number | undefined): string {
	if (!timestamp) return 'Unknown';
	const date = new Date(timestamp * 1000);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/** Format a YYYY-MM value to a readable "Month Year" string */
export function formatYearMonth(value: string | null | undefined): string | null {
	if (!value || typeof value !== 'string') return null;
	const parts = value.match(/(\d{4})[-/](\d{1,2})/);
	if (!parts) return null;
	const month = Number.parseInt(parts[2], 10);
	const year = Number.parseInt(parts[1], 10);
	if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
	const date = new Date(Date.UTC(year, month - 1, 1));
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
