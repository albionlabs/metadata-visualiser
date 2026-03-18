/** CBOR magic numbers used for Rain Protocol metadata documents */
export const MAGIC_NUMBERS = {
	RAIN_META_DOCUMENT: BigInt('0xff0a89c674ee7874'),
	OA_SCHEMA: BigInt('0xffa8e8a9b9cf4a31'),
	OA_HASH_LIST: BigInt('0xff9fae3cc645f463'),
	OA_STRUCTURE: BigInt('0xffc47a6299e8a911'),
	OA_TOKEN_IMAGE: BigInt('0xff8cd2927c8c86cb'),
	OA_TOKEN_CREDENTIAL_LINKS: BigInt('0xffbc38eb14ad2209')
};

/** Default IPFS gateway for resolving CIDs */
export const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

/** Default 3D render CID (Wressle-1 facility) — used as fallback when no render is available */
export const DEFAULT_RENDER_3D_CID = 'bafybeihypte4iy4oxmeqwn2sfwqhhihs3myetbswf6syn4yhr5kmugr6pi';
