import { Hex } from "viem";

// TypeScript Interfaces for FDC Proof Structure
export interface IWeb2Json_RequestBody_Struct {
    url: string;
    httpMethod: string;
    headers: string;
    queryParams: string;
    body: string;
    postProcessJq: string;
    abiSignature: string;
}

export interface IWeb2Json_ResponseBody_Struct {
    abiEncodedData: Hex;
    usedDataAvailabilityProviderCount: number;
    usedDataAvailabilityProviderSigs: readonly Hex[];
}

export interface IWeb2JsonResponseData_Contract {
    attestationType: Hex;
    sourceId: Hex;
    votingRound: bigint;
    lowestUsedTimestamp: bigint;
    requestBody: IWeb2Json_RequestBody_Struct;
    responseBodyObservationTimestamp: bigint;
    responseBodyHash: Hex;
    responseBody: IWeb2Json_ResponseBody_Struct;
}

export interface IWeb2JsonProof_Contract {
    merkleProof: readonly Hex[];
    data: IWeb2JsonResponseData_Contract;
} 