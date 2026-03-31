/**
 * Shared metadata types for the visualiser library.
 */

/** Raw subgraph metadata record */
export type MetaV1S = {
	id: string;
	meta: string;
	sender: string;
	subject: string;
	metaHash: string;
};

/** Schema property definition */
export type SchemaProperty = {
	type: string;
	description?: string;
	enum?: string[];
	minimum?: number;
	maximum?: number;
	properties?: Record<string, SchemaProperty>;
	required?: string[];
};

/** Asset metadata schema */
export type AssetSchema = {
	displayName: string;
	schema: {
		type: string;
		properties: Record<string, SchemaProperty>;
		required?: string[];
		description?: string;
	};
	timestamp: string;
	id: string;
	hash: string;
};

/** Decoded metadata entry — the primary type consumed by visualiser components */
export interface VisualiserMetadata {
	id: string;
	metaHash: string;
	sender: string;
	subject: string;
	schemaHash: string | null;
	decodedData: Record<string, unknown> | null;
	schema: AssetSchema | null;
	raw: MetaV1S;
	error?: boolean;
	timestamp?: number;
	tokenTermsLink?: string;
}
