import { Hex, stringToHex } from "viem";

// --- FDC Mainnet Configuration ---
export const MAINNET_FDC_VERIFIER_URL = "https://fdc-verifiers-mainnet.flare.network";
export const MAINNET_FDC_DA_LAYER_URL = "https://attestation.flare.network";
export const MAINNET_FDC_HUB_ADDRESS: Hex = "0xc25c749DC27Efb1864Cb3DADa8845B7687eB2d44";

export const ATTESTATION_TYPE_NAME = "Web2Json";
export const SOURCE_ID_NAME_WEB2JSON = "PublicWeb2";

export const ATTESTATION_TYPE_HEX_WEB2JSON = stringToHex(ATTESTATION_TYPE_NAME, { size: 32 });
export const SOURCE_ID_HEX_PUBLICWEB2 = stringToHex(SOURCE_ID_NAME_WEB2JSON, { size: 32 });

// --- Gist Configuration ---
export const GIST_RAW_URL = "https://gist.githubusercontent.com/deca12x/cf2ee6f50ce263010dbcf51e048b1bb2/raw/gasEmissions.json";
export const JQ_FILTER_GIST = ".[0]";
export const ABI_SIGNATURE_FOR_FDC = '{"components":[{"internalType":"address","name":"recipientAddress","type":"address"},{"internalType":"uint256","name":"recipientGas","type":"uint256"},{"internalType":"uint256","name":"rate","type":"uint256"}],"name":"carbonData","type":"tuple"}';

// --- Mainnet Addresses (REPLACE WITH YOUR ACTUAL ADDRESSES) ---
export const FLARE_USDT_ADDRESS: Hex = "0x0B38e83B86d491735fEaa0a791F65c2B99535396";
export const FLARE_USDT_OFT_ADDRESS: Hex = "0x1C10CC06DC6D35970d1D53B2A23c76ef370d4135";
export const POLYGON_COMPOSER_CONTRACT_ADDRESS: Hex = "0x7eFEED1898E127AEe75abbC29Da082ACF136ff81";

// Deployed CarbonOffsetFlare Contract
export const CARBON_OFFSET_FLARE_CONTRACT_ADDRESS: Hex = "0xceca34b92dbbaf1715de564172c61a4782248ccd";

// 📋 PRE-DEPLOYMENT CHECKLIST:
// ✅ 1. Verify FLARE_USDT_ADDRESS is correct for mainnet
// ✅ 2. Verify FLARE_USDT_OFT_ADDRESS is correct for mainnet  
// ✅ 3. Verify POLYGON_COMPOSER_CONTRACT_ADDRESS is deployed on Polygon
// ❌ 4. Deploy CarbonOffsetFlare.sol and update CARBON_OFFSET_FLARE_CONTRACT_ADDRESS
// ❌ 5. Test with small amounts first
// ❌ 6. Verify FDC integration works end-to-end

// --- Carbon Offset Configuration ---
export const CHAR_ACTUAL_RATE = 5; // 5 USDT per tonne CO2
export const USDT_DECIMALS = 6;
export const CHAR_RATE_SCALED = 2000000n; // Adjust this based on your actual CHAR-USDT rate

// --- FDC Configuration ---
export const FDC_FEE_CFLR = "0.1"; // Placeholder fee in CFLR
export const FDC_ROUND_DURATION = 90; // seconds
export const DA_LAYER_MAX_ATTEMPTS = 20;
export const DA_LAYER_POLL_INTERVAL = 15000; // 15 seconds 