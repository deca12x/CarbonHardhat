import {
    PublicClient,
    WalletClient,
    Account,
    Chain,
    Transport,
    Hex,
    parseUnits,
    formatUnits,
    Abi
} from "viem";
import {
    MAINNET_FDC_VERIFIER_URL,
    MAINNET_FDC_DA_LAYER_URL,
    ATTESTATION_TYPE_NAME,
    ATTESTATION_TYPE_HEX_WEB2JSON,
    SOURCE_ID_HEX_PUBLICWEB2,
    FDC_FEE_CFLR,
    FDC_ROUND_DURATION,
    DA_LAYER_MAX_ATTEMPTS,
    DA_LAYER_POLL_INTERVAL
} from "../config/constants";
import {
    IWeb2Json_RequestBody_Struct,
    IWeb2JsonProof_Contract,
    IWeb2JsonResponseData_Contract
} from "../types/fdcTypes";

export async function prepareFdcWeb2JsonRequest(
    gistUrl: string,
    jqFilter: string,
    abiSignature: string,
    attestationTypeHex: Hex,
    sourceIdHex: Hex
): Promise<{ abiEncodedRequest: Hex; messageIntegrityCode: Hex }> {
    const verifierUrl = `${MAINNET_FDC_VERIFIER_URL}/${ATTESTATION_TYPE_NAME}/prepareRequest`;
    const requestPayload = {
        attestationType: attestationTypeHex,
        sourceId: sourceIdHex,
        requestBody: {
            url: gistUrl,
            httpMethod: "GET",
            headers: {},
            queryParams: {},
            body: {},
            postProcessJq: jqFilter,
            abiSignature: abiSignature,
        },
    };

    console.log("Sending request to Verifier Server:", verifierUrl, "Payload:", JSON.stringify(requestPayload, null, 2));
    
    try {
        const response = await fetch(verifierUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });
        
        const responseBodyText = await response.text();
        if (!response.ok) {
            console.error("Verifier server request failed. Status:", response.status, "Body:", responseBodyText);
            throw new Error(`Verifier server request failed: ${response.status} ${responseBodyText}`);
        }
        
        const verifierResponse = JSON.parse(responseBodyText);
        console.log("Verifier Server Raw Response:", verifierResponse);
        
        if (typeof verifierResponse.abiEncodedRequest !== 'string' || 
            typeof verifierResponse.messageIntegrityCode !== 'string' ||
            !verifierResponse.abiEncodedRequest.startsWith('0x') || 
            !verifierResponse.messageIntegrityCode.startsWith('0x')) {
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

export async function submitFdcRequestToHub(
    publicClient: PublicClient<Transport, Chain>,
    walletClient: WalletClient<Transport, Chain, Account>,
    deployerAccount: Account,
    abiEncodedRequest: Hex,
    fdcHubAddr: Hex,
    fdcHubAbiJson: Abi
): Promise<{ roundId: number; transactionHash: Hex }> {
    const fdcFee = parseUnits(FDC_FEE_CFLR, 18);
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
        const roundId = Math.floor(submissionTimestamp / FDC_ROUND_DURATION);

        console.log(`FDC Request included in block ${receipt.blockNumber} at timestamp ${submissionTimestamp}. Estimated FDC Round ID: ${roundId}`);
        return { roundId, transactionHash: fdcSubmitTxHash };

    } catch (error: any) {
        console.error("Error in submitFdcRequestToHub:", error.message || error);
        if (error.cause) console.error("Cause:", error.cause);
        if (error.shortMessage) console.error("Short Message:", error.shortMessage);
        throw error;
    }
}

export async function waitForAndRetrieveFdcProof(
    requestBytesOrMic: Hex,
    roundId: number,
    daLayerApiKey: string,
    originalRequestBodyForProof: IWeb2Json_RequestBody_Struct
): Promise<IWeb2JsonProof_Contract> {
    const proofUrl = `${MAINNET_FDC_DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`;
    const bodyPayload = { votingRoundId: roundId.toString(), requestBytes: requestBytesOrMic };
    
    console.log(`Polling DA Layer for proof. URL: ${proofUrl}, Round: ${roundId}, RequestBytes: ${requestBytesOrMic}`);

    let attempts = 0;

    while (attempts < DA_LAYER_MAX_ATTEMPTS) {
        try {
            console.log(`DA Layer poll attempt ${attempts + 1}/${DA_LAYER_MAX_ATTEMPTS}...`);
            const response = await fetch(proofUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': daLayerApiKey },
                body: JSON.stringify(bodyPayload)
            });

            if (response.ok) {
                const jsonResponse = await response.json();
                console.log("DA Layer Raw Response:", JSON.stringify(jsonResponse, null, 2));
                
                if (jsonResponse.proofs && jsonResponse.responseHex) {
                    const merkleProof = jsonResponse.proofs as readonly Hex[];
                    console.warn("CRITICAL TODO: Implement actual ABI decoding of jsonResponse.responseHex and map it to IWeb2JsonResponseData_Contract.");
                    
                    // Placeholder data - REPLACE WITH ACTUAL PARSING
                    const fakeHexPrefix = "0x" as const;
                    const placeholderResponseBodyHash: Hex = `${fakeHexPrefix}${Buffer.from(`fakeHashForRound${roundId}`).toString('hex').padStart(62, '0')}`;
                    const placeholderAbiEncodedData: Hex = `${fakeHexPrefix}${Buffer.from(`GistDataForRound${roundId}${Date.now()}`).toString('hex')}`;
                    const placeholderSig: Hex = `${fakeHexPrefix}${Buffer.from(`fakeSigForRound${roundId}${Date.now()}`).toString('hex').padStart(62,'0')}`;

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
                    return { merkleProof: merkleProof, data: proofData };
                } else {
                    console.log(`DA Layer response not yet ready or in unexpected format. Attempt ${attempts + 1}. Resp:`, jsonResponse);
                }
            } else if (response.status === 404) {
                 console.log(`DA Layer: Proof not found yet for round ${roundId} (404). Attempt ${attempts + 1}.`);
            } else {
                const errorBody = await response.text();
                console.log(`DA Layer poll failed status: ${response.status}. Body: ${errorBody}. Attempt ${attempts + 1}.`);
            }
        } catch (error: any) {
            console.error(`Error polling DA Layer (attempt ${attempts + 1}):`, error.message || error);
        }
        
        attempts++;
        if (attempts < DA_LAYER_MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, DA_LAYER_POLL_INTERVAL));
        }
    }
    
    throw new Error(`Failed to retrieve FDC proof for round ${roundId} after ${DA_LAYER_MAX_ATTEMPTS} attempts.`);
} 