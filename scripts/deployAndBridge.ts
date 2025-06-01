import hre from "hardhat";
import {
    parseUnits,
    PublicClient,
    WalletClient,
    Account,
    Chain,
    Transport,
    Hex,
    createWalletClient,
    http,
    formatUnits,
    erc20Abi, // Assuming you have this for USDT interaction
    stringToHex, // Type for FDC proof data if needed
    Abi
} from "viem";
import { privateKeyToAccount } from 'viem/accounts';
import { flare } from 'viem/chains'; // Assuming your LayerZero is on Flare mainnet

// Custom ABI for FdcHub if not readily available via Hardhat artifacts
const fdcHubAbi = [{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"},{"internalType":"address","name":"_addressUpdater","type":"address"},{"internalType":"uint8","name":"_requestsOffsetSeconds","type":"uint8"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"uint256","name":"fee","type":"uint256"}],"name":"AttestationRequest","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"authorizedAmountWei","type":"uint256"}],"name":"DailyAuthorizedInflationSet","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"encodedCall","type":"bytes"}],"name":"GovernanceCallTimelocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"initialGovernance","type":"address"}],"name":"GovernanceInitialised","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"governanceSettings","type":"address"}],"name":"GovernedProductionModeEntered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amountReceivedWei","type":"uint256"}],"name":"InflationReceived","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"components":[{"internalType":"bytes32","name":"attestationType","type":"bytes32"},{"internalType":"bytes32","name":"source","type":"bytes32"},{"internalType":"uint24","name":"inflationShare","type":"uint24"},{"internalType":"uint8","name":"minRequestsThreshold","type":"uint8"},{"internalType":"uint224","name":"mode","type":"uint224"}],"indexed":false,"internalType":"struct IFdcInflationConfigurations.FdcConfiguration[]","name":"fdcConfigurations","type":"tuple[]"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"InflationRewardsOffered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"requestsOffsetSeconds","type":"uint8"}],"name":"RequestsOffsetSet","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallExecuted","type":"event"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"cancelGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"dailyAuthorizedInflation","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"executeGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"fdcInflationConfigurations","outputs":[{"internalType":"contract IFdcInflationConfigurations","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fdcRequestFeeConfigurations","outputs":[{"internalType":"contract IFdcRequestFeeConfigurations","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"flareSystemsManager","outputs":[{"internalType":"contract IIFlareSystemsManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAddressUpdater","outputs":[{"internalType":"address","name":"_addressUpdater","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getContractName","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getExpectedBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getInflationAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTokenPoolSupplyData","outputs":[{"internalType":"uint256","name":"_lockedFundsWei","type":"uint256"},{"internalType":"uint256","name":"_totalInflationAuthorizedWei","type":"uint256"},{"internalType":"uint256","name":"_totalClaimedWei","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governance","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governanceSettings","outputs":[{"internalType":"contract IGovernanceSettings","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"}],"name":"initialise","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isExecutor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastInflationAuthorizationReceivedTs","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastInflationReceivedTs","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"productionMode","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"receiveInflation","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"requestAttestation","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"requestsOffsetSeconds","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardManager","outputs":[{"internalType":"contract IIRewardManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_toAuthorizeWei","type":"uint256"}],"name":"setDailyAuthorizedInflation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint8","name":"_requestsOffsetSeconds","type":"uint8"}],"name":"setRequestsOffset","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"switchToProductionMode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"selector","type":"bytes4"}],"name":"timelockedCalls","outputs":[{"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"internalType":"bytes","name":"encodedCall","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalInflationAuthorizedWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalInflationReceivedWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalInflationRewardsOfferedWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_currentRewardEpochId","type":"uint24"},{"internalType":"uint64","name":"_currentRewardEpochExpectedEndTs","type":"uint64"},{"internalType":"uint64","name":"_rewardEpochDurationSeconds","type":"uint64"}],"name":"triggerRewardEpochSwitchover","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"_contractNameHashes","type":"bytes32[]"},{"internalType":"address[]","name":"_contractAddresses","type":"address[]"}],"name":"updateContractAddresses","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const;

// REVISED INTERFACES after deeper analysis of linter error

interface IWeb2Json_RequestBody_Struct { // Matches the linter's expectation for proof.data.requestBody
    url: string;
    httpMethod: string;
    headers: string;
    queryParams: string;
    body: string;
    postProcessJq: string;
    abiSignature: string;
}

interface IWeb2Json_ResponseBody_Struct { // Matches contract's ResponseBody
    abiEncodedData: Hex;
    usedDataAvailabilityProviderCount: number; // Solidity uint8 becomes number
    usedDataAvailabilityProviderSigs: readonly Hex[];
}

// This interface represents the 'Response data' (IWeb2Json.Response in Solidity)
interface IWeb2JsonResponseData_Contract {
    attestationType: Hex;
    sourceId: Hex;
    votingRound: bigint; // uint64 in Solidity
    lowestUsedTimestamp: bigint; // uint64 in Solidity
    requestBody: IWeb2Json_RequestBody_Struct; // THIS IS THE KEY CHANGE based on linter
    responseBodyObservationTimestamp: bigint; // uint64 in Solidity
    responseBodyHash: Hex; // bytes32 in Solidity
    responseBody: IWeb2Json_ResponseBody_Struct;
}

// This is the top-level proof structure (IWeb2Json.Proof in Solidity)
interface IWeb2JsonProof_Contract {
    merkleProof: readonly Hex[];
    data: IWeb2JsonResponseData_Contract;
}

// --- FDC Mainnet Configuration ---
const MAINNET_FDC_VERIFIER_URL = "https://fdc-verifiers-mainnet.flare.network";
const MAINNET_FDC_DA_LAYER_URL = "https://attestation.flare.network";
const MAINNET_FDC_HUB_ADDRESS: Hex = "0xc25c749DC27Efb1864Cb3DADa8845B7687eB2d44";

const ATTESTATION_TYPE_NAME = "Web2Json";
const SOURCE_ID_NAME_WEB2JSON = "PublicWeb2"; // Based on Flare's testnet examples

const ATTESTATION_TYPE_HEX_WEB2JSON = stringToHex(ATTESTATION_TYPE_NAME, { size: 32 });
const SOURCE_ID_HEX_PUBLICWEB2 = stringToHex(SOURCE_ID_NAME_WEB2JSON, { size: 32 });

// Your Gist and contract details
const GIST_RAW_URL = "https://gist.githubusercontent.com/deca12x/cf2ee6f50ce263010dbcf51e048b1bb2/raw/gasEmissions.json";
const JQ_FILTER_GIST = ".[0]"; // Gist returns an array, take the first object
const ABI_SIGNATURE_FOR_FDC = '{"components":[{"internalType":"address","name":"recipientAddress","type":"address"},{"internalType":"uint256","name":"recipientGas","type":"uint256"},{"internalType":"uint256","name":"rate","type":"uint256"}],"name":"carbonData","type":"tuple"}';

// LayerZero and Token Details (Mainnet)
// const flareUsdtAddress: Hex = "0x..."; // Your Flare Mainnet USDT token address
// const carbonOffsetFlareContractAddress: Hex = "0x..."; // Your deployed contract address on Flare Mainnet
// const polygonComposerContractAddress: Hex = "0x..."; // Your Polygon Mainnet composer contract
// const flareUsdtOFTAddress: Hex = "0x..."; // Your Flare Mainnet USDT OFT address

// --- Helper Function: Prepare FDC Web2Json Request ---
async function prepareFdcWeb2JsonRequest(
    gistUrl: string,
    jqFilter: string,
    abiSignature: string,
    attestationTypeHex: Hex,
    sourceIdHex: Hex
): Promise<{ abiEncodedRequest: Hex; messageIntegrityCode: Hex }> {
    const verifierUrl = `${MAINNET_FDC_VERIFIER_URL}/${ATTESTATION_TYPE_NAME}/prepareRequest`; // Path from Forge script

    const requestPayload = {
        attestationType: attestationTypeHex,
        sourceId: sourceIdHex,
        requestBody: { // Structure based on Flare's Verifier API expectation
            url: gistUrl,
            httpMethod: "GET",
            headers: {}, // Defaults to application/json, can be {}
            queryParams: {},
            body: {},    // For GET request, body is empty
            postProcessJq: jqFilter,
            abiSignature: abiSignature,
        },
    };

    console.log("Sending request to Verifier Server:", verifierUrl, "with payload:", JSON.stringify(requestPayload));

    try {
        const response = await fetch(verifierUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });
        const responseBodyText = await response.text();
        if (!response.ok) {
            console.error("Verifier server request failed. Status:", response.status, "Body:", responseBodyText);
            throw new Error(`Verifier server request failed: ${response.status} ${responseBodyText}`);
        }
        const verifierResponse = JSON.parse(responseBodyText);
        console.log("Verifier Server Raw Response:", verifierResponse);
        if (typeof verifierResponse.abiEncodedRequest !== 'string' || typeof verifierResponse.messageIntegrityCode !== 'string' ||
            !verifierResponse.abiEncodedRequest.startsWith('0x') || !verifierResponse.messageIntegrityCode.startsWith('0x')) {
            console.error("Invalid response from verifier. Missing/malformed fields:", verifierResponse);
            throw new Error("Invalid response from verifier server.");
        }
        console.log("Successfully prepared FDC request. MIC:", verifierResponse.messageIntegrityCode);
        return {
            abiEncodedRequest: verifierResponse.abiEncodedRequest as Hex,
            messageIntegrityCode: verifierResponse.messageIntegrityCode as Hex
        };
    } catch (error) {
        if (!(error instanceof Error && error.message.startsWith("Verifier server request failed"))) {
            console.error("Error in prepareFdcWeb2JsonRequest fetch/parsing:", error);
        }
        throw error;
    }
}

// --- Helper Function: Submit FDC Request to Hub ---
async function submitFdcRequestToHub(
    publicClient: PublicClient<Transport, Chain>,
    walletClient: WalletClient<Transport, Chain, Account>,
    deployerAccount: Account,
    abiEncodedRequest: Hex,
    fdcHubAddr: Hex, // Renamed for clarity from fdcHubAddress
    fdcHubAbiJson: Abi // Expecting the full ABI here
): Promise<{ roundId: number; transactionHash: Hex }> {
    // Using placeholder FDC fee of 0.1 CFLR
    const fdcFee = parseUnits("0.1", 18); 
    console.log(`Submitting FDC request to FdcHub at ${fdcHubAddr} with fee ${formatUnits(fdcFee, 18)} CFLR...`);
    console.log(`ABI Encoded Request: ${abiEncodedRequest}`);

    try {
        const { request: fdcSubmitSimReq } = await publicClient.simulateContract({
            address: fdcHubAddr,
            abi: fdcHubAbiJson,
            functionName: 'requestAttestation',
            args: [abiEncodedRequest],
            account: deployerAccount,
            value: fdcFee,
        });

        console.log("FDC Hub requestAttestation simulation successful. Submitting transaction...");
        const fdcSubmitTxHash = await walletClient.writeContract(fdcSubmitSimReq);
        console.log("FDC Request transaction sent to Hub. Waiting for receipt... Hash:", fdcSubmitTxHash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: fdcSubmitTxHash });

        if (receipt.status !== 'success') {
            console.error("FDC request submission transaction failed. Receipt:", receipt);
            throw new Error(`FDC request submission transaction failed. Hash: ${fdcSubmitTxHash}`);
        }
        console.log("FDC request submission transaction confirmed. Hash:", fdcSubmitTxHash);

        const block = await publicClient.getBlock({ blockHash: receipt.blockHash });
        const submissionTimestamp = Number(block.timestamp);
        const roundDuration = 90; // seconds
        const roundId = Math.floor(submissionTimestamp / roundDuration);

        console.log(`FDC Request included in block ${receipt.blockNumber} at timestamp ${submissionTimestamp}. Estimated FDC Round ID: ${roundId}`);
        return { roundId, transactionHash: fdcSubmitTxHash };

    } catch (error: any) {
        console.error("Error in submitFdcRequestToHub:", error.message || error);
        // More detailed logging for transaction errors
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
        if (error.shortMessage) {
            console.error("Short Message:", error.shortMessage);
        }
        throw error;
    }
}

// --- Helper Function: Wait for and Retrieve FDC Proof ---
async function waitForAndRetrieveFdcProof(
    requestBytesOrMic: Hex,
    roundId: number,
    daLayerApiKey: string,
    originalRequestBodyForProof: IWeb2Json_RequestBody_Struct
): Promise<IWeb2JsonProof_Contract> {
    const proofUrl = `${MAINNET_FDC_DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`;
    
    const bodyPayload = {
        votingRoundId: roundId.toString(),
        requestBytes: requestBytesOrMic, 
    };

    console.log(`Polling DA Layer for proof. URL: ${proofUrl}, Round: ${roundId}, RequestBytes: ${requestBytesOrMic}`);

    let attempts = 0;
    const maxAttempts = 20;
    const pollInterval = 15000;

    while (attempts < maxAttempts) {
        try {
            console.log(`DA Layer poll attempt ${attempts + 1}/${maxAttempts}...`);
            const response = await fetch(proofUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': daLayerApiKey,
                },
                body: JSON.stringify(bodyPayload)
            });

            if (response.ok) {
                const jsonResponse = await response.json();
                console.log("DA Layer Raw Response:", JSON.stringify(jsonResponse, null, 2));

                if (jsonResponse.proofs && jsonResponse.responseHex) {
                    const merkleProof = jsonResponse.proofs as readonly Hex[];
                    
                    // CRITICAL TODO: Implement actual ABI decoding of jsonResponse.responseHex
                    // and map it to IWeb2JsonResponseData_Contract.
                    // The following is still a placeholder for the data part.
                    
                    console.warn("CRITICAL: DA Layer response parsing and IWeb2JsonProof_Contract construction needs to be implemented accurately based on actual DA layer output and ethers.js/Viem decoding capabilities.");
                    
                    // Corrected Placeholders for Hex types:
                    const fakeHexPrefix = "0x" as const; // Helper for type safety

                    const placeholderResponseBodyHash: Hex = `${fakeHexPrefix}${Buffer.from(`fakeHashForRound${roundId}`).toString('hex').padStart(62, '0')}`;
                    const placeholderAbiEncodedData: Hex = `${fakeHexPrefix}${Buffer.from(`GistDataForRound${roundId}`).toString('hex')}`;
                    const placeholderSig: Hex = `${fakeHexPrefix}${Buffer.from(`fakeSigForRound${roundId}`).toString('hex').padStart(62,'0')}`;

                    const proofData: IWeb2JsonResponseData_Contract = {
                        attestationType: ATTESTATION_TYPE_HEX_WEB2JSON,
                        sourceId: SOURCE_ID_HEX_PUBLICWEB2,
                        votingRound: BigInt(roundId),
                        lowestUsedTimestamp: BigInt(Date.now() - 120000),
                        requestBody: originalRequestBodyForProof,
                        responseBodyObservationTimestamp: BigInt(Date.now() - 60000),
                        responseBodyHash: placeholderResponseBodyHash,
                        responseBody: {
                            abiEncodedData: placeholderAbiEncodedData,
                            usedDataAvailabilityProviderCount: 1,
                            usedDataAvailabilityProviderSigs: [placeholderSig] as readonly Hex[],
                        }
                    };
                    // END Corrected Placeholders

                    return {
                        merkleProof: merkleProof,
                        data: proofData
                    };
                } else {
                    console.log(`DA Layer response not yet ready or in unexpected format. Attempt ${attempts + 1}. Response:`, jsonResponse);
                }

            } else if (response.status === 404) {
                 console.log(`DA Layer: Proof not found yet for round ${roundId} (404). Attempt ${attempts + 1}.`);
            }
            else {
                const errorBody = await response.text();
                console.log(`DA Layer poll failed with status: ${response.status}. Body: ${errorBody}. Attempt ${attempts + 1}.`);
            }
        } catch (error) {
            console.error(`Error polling DA Layer: ${error}, attempt ${attempts + 1}`);
        }

        attempts++;
        if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    throw new Error(`Failed to retrieve FDC proof from DA Layer for round ${roundId} after ${maxAttempts} attempts.`);
}

async function main() {
    const networkName = hre.network.name;
    console.log("Operating on network:", networkName);

    let walletClient: WalletClient<Transport, Chain, Account>;
    let deployerAccount: Account;
    const publicClient: PublicClient<Transport, Chain> = await hre.viem.getPublicClient();
    
    // === YOUR MAINNET CONTRACT & TOKEN ADDRESSES ===
    // You MUST fill these with your actual deployed mainnet addresses
    const carbonOffsetFlareContractAddress: Hex = "0xYOUR_CARBON_OFFSET_FLARE_CONTRACT_ADDRESS"; 
    const flareUsdtAddress: Hex = "0x0B38e83B86d491735fEaa0a791F65c2B99535396" as Hex; // From your snippet
    // const polygonComposerContractAddress: Hex = "0x..."; // YOUR Polygon Mainnet composer contract (used in LZ composeMsg)
    // const flareUsdtOFTAddress: Hex = "0x..."; // YOUR Flare Mainnet USDT OFT address
                                             // This is the address of the Stargate USDT OFT contract on Flare.
                                             // Your CarbonOffsetFlare contract interacts with this.
                                             // It's passed to your CarbonOffsetFlare constructor.

    // === API KEYS & ENV VARIABLES ===
    const daLayerApiKey = process.env.FLARESCAN_API_KEY || "YOUR_DA_LAYER_API_KEY_IF_NEEDED"; // For DA Layer X-API-KEY header
    const flareMainnetRpcUrl = process.env.FLARE_MAINNET_RPC_URL || flare.rpcUrls.default.http[0];

    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not found in .env file for mainnet operations.");
    }
    deployerAccount = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
    
    walletClient = createWalletClient({
        account: deployerAccount,
        chain: flare, 
        transport: http(flareMainnetRpcUrl)
    });
    console.log("Using deployer account:", deployerAccount.address);

    // === REINTEGRATED LAYERZERO CONFIGURATION (from your snippet) ===
    const flareUsdtOFTUserAddress = "0x1C10CC06DC6D35970d1D53B2A23c76ef370d4135" as Hex; // This seems to be what you named flareUsdtOFTAddress
    const polygonComposerUserContractAddress = "0x7eFEED1898E127AEe75abbC29Da082ACF136ff81" as Hex; // This is your polygonComposerContractAddress

    // Note: The amountUSDTToBridge will now be determined by the FDC flow (estimatedUsdtAmountForLZFee)
    // const amountUSDTToBridge_static = parseUnits("0.001", 6); // Static amount, we'll use dynamic one
    const finalEoaRecipientOnPolygon: Hex = deployerAccount.address; 
    const minSwapOutputOnPolygon = 1n; 
    const composeGasLimit = 350000n;
    // === END REINTEGRATED LAYERZERO CONFIGURATION ===


    const carbonOffsetFlareContract = await hre.viem.getContractAt(
        "CarbonOffsetFlare", 
        carbonOffsetFlareContractAddress, // Make sure this is your DEPLOYED CarbonOffsetFlare contract address
        { client: { wallet: walletClient, public: publicClient } }
    );

    // 1. Prepare FDC Request
    console.log("Preparing FDC Web2Json request for Gist data...");
    const { abiEncodedRequest, messageIntegrityCode } = await prepareFdcWeb2JsonRequest(
        GIST_RAW_URL,
        JQ_FILTER_GIST,
        ABI_SIGNATURE_FOR_FDC,
        ATTESTATION_TYPE_HEX_WEB2JSON,
        SOURCE_ID_HEX_PUBLICWEB2
    );

    // 2. Submit FDC Request to FdcHub
    const { roundId, transactionHash: fdcSubmitTxHash } = await submitFdcRequestToHub(
        publicClient, walletClient, deployerAccount, abiEncodedRequest, MAINNET_FDC_HUB_ADDRESS, fdcHubAbi
    );

    // 3. Wait for FDC Round Finalization and Retrieve Proof
    // Using abiEncodedRequest as the query param for DA Layer as per Forge example's use of requestBytes
    const originalRequestPayloadObject = { // This is the object sent to the verifier
        url: GIST_RAW_URL,
        httpMethod: "GET",
        headers: "{}", // Assuming stringified empty JSON for headers
        queryParams: "{}",
        body: "{}",
        postProcessJq: JQ_FILTER_GIST,
        abiSignature: ABI_SIGNATURE_FOR_FDC,
    };
    const fdcProof = await waitForAndRetrieveFdcProof(
        abiEncodedRequest, // Or messageIntegrityCode, depending on what DA layer expects for requestBytes
        roundId,
        daLayerApiKey,
        originalRequestPayloadObject // Pass the original request components
    );
    console.log("FDC Proof Retrieved. ABI Encoded Data from proof:", fdcProof.data.responseBody.abiEncodedData);

    // 4. Define charRateScaled (USDT atomic units per tonne CO2)
    const charActualRate = 5; // Example: 5 USDT per tonne
    const usdtDecimals = 6; // Matching CarbonOffsetFlare.sol's USDT_DECIMALS
    const charRateScaled = BigInt(charActualRate * (10 ** usdtDecimals));

    // 5. Estimate USDT amount needed for bridging (using live Gist data for simplicity for LZ fee calc)
    //    This is a shortcut. A more robust way would be to decode fdcProof.data.responseBody.abiEncodedData here.
    let estimatedUsdtAmountForLZFee: bigint;
    try {
        console.log("Fetching live Gist data to estimate USDT amount for LZ fee calculation...");
        const gistResponse = await fetch(GIST_RAW_URL);
        if (!gistResponse.ok) throw new Error(`Failed to fetch Gist: ${gistResponse.status}`);
        const gistDataArray = await gistResponse.json();
        const liveGistData = gistDataArray[0]; // { recipientAddress, recipientGas, rate (scaled by 10^6) }

        if (typeof liveGistData.recipientGas !== 'number' || typeof liveGistData.rate !== 'number') {
            throw new Error(`Gist data for gas or rate is not a number: ${JSON.stringify(liveGistData)}`);
        }

        estimatedUsdtAmountForLZFee = await carbonOffsetFlareContract.read.getUsdtAmountForOffset([
            BigInt(liveGistData.recipientGas),
            BigInt(liveGistData.rate),
            charRateScaled
        ]);
        console.log(`Estimated USDT for LZ fee calc from Gist: ${formatUnits(estimatedUsdtAmountForLZFee, usdtDecimals)} USDT`);
        if (estimatedUsdtAmountForLZFee <= 0n) {
            throw new Error("Calculated USDT amount for bridging is zero or less. Check Gist data and rates.");
        }
    } catch (e) {
        console.error("Error estimating USDT amount from Gist:", e);
        throw new Error("Could not estimate USDT amount. Halting.");
    }


    // 6. Transfer USDT to CarbonOffsetFlare contract
    console.log(`Transferring ${formatUnits(estimatedUsdtAmountForLZFee, usdtDecimals)} USDT to ${carbonOffsetFlareContract.address}...`);
    const deployerUsdtBalance = await publicClient.readContract({
        address: flareUsdtAddress, abi: erc20Abi, functionName: 'balanceOf', args: [deployerAccount.address]
    });
    if (deployerUsdtBalance < estimatedUsdtAmountForLZFee) {
        throw new Error(`Deployer has insufficient USDT. Needs ${formatUnits(estimatedUsdtAmountForLZFee, usdtDecimals)}, has ${formatUnits(deployerUsdtBalance, usdtDecimals)}`);
    }
    const transferApprovalTx = await walletClient.writeContract({
        address: flareUsdtAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [carbonOffsetFlareContract.address, estimatedUsdtAmountForLZFee],
        account: deployerAccount,
    });
    await publicClient.waitForTransactionReceipt({ hash: transferApprovalTx });
    console.log("USDT approval for contract successful.");

    // The bridgeAndExecuteOnPolygon was used as a reference for direct USDT transfer to contract.
    // Now the contract will pull approved USDT when offsetAndBridge is called.
    // For the FDC flow, the USDT needs to be *in* the CarbonOffsetFlare contract first.
    // So, the deployer (script) transfers USDT *to* the CarbonOffsetFlare contract.
    const transferToContractTx = await walletClient.writeContract({
        address: flareUsdtAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [carbonOffsetFlareContract.address, estimatedUsdtAmountForLZFee],
        account: deployerAccount,
    });
    await publicClient.waitForTransactionReceipt({ hash: transferToContractTx });
    console.log("USDT successfully transferred to CarbonOffsetFlare contract.");


    // 7. Get LayerZero fee for `offsetAndBridge`
    console.log("Estimating LayerZero fee for offsetAndBridge using amount:", formatUnits(estimatedUsdtAmountForLZFee, usdtDecimals));
    const [nativeFee,] = await carbonOffsetFlareContract.read.getFeeForBridgeAndExecute([
        estimatedUsdtAmountForLZFee,
        deployerAccount.address,
        finalEoaRecipientOnPolygon,
        minSwapOutputOnPolygon,
        composeGasLimit
    ]);
    console.log(`Estimated LZ Native Fee for offsetAndBridge: ${formatUnits(nativeFee, 18)} CFLR`);

    const deployerCflrBalance = await publicClient.getBalance({ address: deployerAccount.address });
    if (deployerCflrBalance < nativeFee) {
        throw new Error(`Deployer has insufficient CFLR for LZ fee. Needs ${formatUnits(nativeFee, 18)}, has ${formatUnits(deployerCflrBalance, 18)}`);
    }

    // 8. Call `offsetAndBridge` on your contract
    console.log("Calling offsetAndBridge on CarbonOffsetFlare contract...");
    const { request: offsetBridgeSimReq } = await publicClient.simulateContract({
        address: carbonOffsetFlareContract.address,
        abi: carbonOffsetFlareContract.abi, // Assuming hardhat-viem populates this
        functionName: "offsetAndBridge",
        args: [
            fdcProof,
            charRateScaled,
            finalEoaRecipientOnPolygon,
            minSwapOutputOnPolygon,
            composeGasLimit
        ],
        account: deployerAccount,
        value: nativeFee,
    });
    const offsetTxHash = await walletClient.writeContract(offsetBridgeSimReq);
    console.log("offsetAndBridge transaction sent! Hash:", offsetTxHash);
    await publicClient.waitForTransactionReceipt({ hash: offsetTxHash });
    console.log("offsetAndBridge transaction confirmed!");
    console.log(`   LZ Scan for mainnet: https://layerzeroscan.com/tx/${offsetTxHash} (check correct LayerZero mainnet explorer)`);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error("Script failed:", error.message || error);
    if (error.cause) console.error("Cause:", error.cause);
    process.exit(1);
});
