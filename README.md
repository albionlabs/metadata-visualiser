# @albionlabs/metadata-visualiser

A Svelte 5 component library for visualising on-chain asset metadata. Includes components for displaying decoded metadata, token rights, production charts, audit trails, and raw data inspection.

## Installation

```bash
npm install @albionlabs/metadata-visualiser
```

## Usage

```svelte
<script>
  import { MetadataVisualiser } from '@albionlabs/metadata-visualiser';
</script>

<MetadataVisualiser {...props} />
```

### Components

- `MetadataVisualiser` - Main visualiser component
- `TokenRightsBox` - Display token rights information
- `AssetDescription` - Asset description display
- `StatsGrid` - Statistics grid layout
- `ProductionChart` - Production data chart
- `RawDataModal` - Raw metadata inspection modal
- `AuditTrailModal` - Audit trail modal

### Utilities

Decode and utility functions are available as separate exports:

```js
import { decodeMetadataEntry, registerSchema } from '@albionlabs/metadata-visualiser/decode';
import { formatNumber, toDate } from '@albionlabs/metadata-visualiser/utils';
```

## License

MIT
