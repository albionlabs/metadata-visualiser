// Components
export { default as MetadataVisualiser } from './components/MetadataVisualiser.svelte';
export { default as TokenRightsBox } from './components/TokenRightsBox.svelte';
export { default as AssetDescription } from './components/AssetDescription.svelte';
export { default as StatsGrid } from './components/StatsGrid.svelte';
export { default as ProductionChart } from './components/ProductionChart.svelte';
export { default as RawDataModal } from './components/RawDataModal.svelte';
export { default as AuditTrailModal } from './components/AuditTrailModal.svelte';
export { default as ImageViewer } from './components/ImageViewer.svelte';
export { default as DocumentsHub } from './components/DocumentsHub.svelte';
export { default as AssetMediaTabs } from './components/AssetMediaTabs.svelte';

// Types
export type {
	MetaV1S,
	SchemaProperty,
	AssetSchema,
	VisualiserMetadata
} from './types.js';

// Decode
export {
	hexToBytes,
	cborDecode,
	bytesToMeta,
	convertDotNotationToObject,
	decodeMetadataEntry,
	registerSchema,
	clearSchemaCache
} from './decode.js';

// Constants
export { MAGIC_NUMBERS, DEFAULT_IPFS_GATEWAY, DEFAULT_RENDER_3D_CID } from './constants.js';

// Utils
export {
	parseNumber,
	formatNumber,
	toDate,
	normaliseMonth,
	getAssetNode,
	parseCoordinate,
	formatTimestamp,
	formatYearMonth,
	resolveIpfsUrl
} from './utils.js';

// Chart
export {
	loadScript,
	ensureChartLib,
	buildChartDatasets,
	getPlannedProjections
} from './chart.js';
export type { ChartInstance, ChartConstructor, ChartDataset } from './chart.js';
