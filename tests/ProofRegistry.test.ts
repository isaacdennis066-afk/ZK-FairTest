import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_CERT_ID = 101;
const ERR_INVALID_TEST_ID = 102;
const ERR_INVALID_PROOF_HASH = 103;
const ERR_PROOF_ALREADY_EXISTS = 104;
const ERR_PROOF_NOT_FOUND = 105;
const ERR_PROOF_REVOKED = 106;
const ERR_INVALID_STAKE = 107;
const ERR_INVALID_TIMESTAMP = 108;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_INVALID_MAX_PROOFS = 110;
const ERR_MAX_PROOFS_EXCEEDED = 111;
const ERR_INVALID_UPDATE_PARAM = 112;
const ERR_UPDATE_NOT_ALLOWED = 113;
const ERR_INVALID_SCORE_RANGE = 114;
const ERR_INVALID_PROOF_LENGTH = 115;
const ERR_INVALID_EXPIRY = 116;
const ERR_PROOF_EXPIRED = 117;
const ERR_INVALID_VERIFIER = 118;
const ERR_INVALID_METADATA = 119;
const ERR_INVALID_STATUS = 120;

interface Proof {
  proofHash: string;
  timestamp: number;
  staked: number;
  revoked: boolean;
  score: number;
  expiry: number;
  verifier: string;
  metadata: string;
  status: boolean;
}

interface ProofUpdate {
  updateHash: string;
  updateTimestamp: number;
  updater: string;
  updateScore: number;
  updateMetadata: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ProofRegistryMock {
  state: {
    nextProofId: number;
    maxProofs: number;
    registrationFee: number;
    authorityContract: string | null;
    minStake: number;
    maxStake: number;
    proofExpiry: number;
    proofs: Map<string, Proof>;
    proofsByHash: Map<string, { certId: number; testId: number }>;
    proofUpdates: Map<string, ProofUpdate>;
  } = {
    nextProofId: 0,
    maxProofs: 10000,
    registrationFee: 500,
    authorityContract: null,
    minStake: 100,
    maxStake: 10000,
    proofExpiry: 525600,
    proofs: new Map(),
    proofsByHash: new Map(),
    proofUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProofId: 0,
      maxProofs: 10000,
      registrationFee: 500,
      authorityContract: null,
      minStake: 100,
      maxStake: 10000,
      proofExpiry: 525600,
      proofs: new Map(),
      proofsByHash: new Map(),
      proofUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  setMinStake(newMin: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.minStake = newMin;
    return { ok: true, value: true };
  }

  setMaxStake(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.maxStake = newMax;
    return { ok: true, value: true };
  }

  setProofExpiry(newExpiry: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.proofExpiry = newExpiry;
    return { ok: true, value: true };
  }

  setMaxProofs(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.maxProofs = newMax;
    return { ok: true, value: true };
  }

  submitProof(
    certId: number,
    testId: number,
    proofHash: string,
    stake: number,
    score: number,
    metadata: string
  ): Result<number> {
    if (this.state.nextProofId >= this.state.maxProofs) return { ok: false, value: ERR_MAX_PROOFS_EXCEEDED };
    if (certId <= 0) return { ok: false, value: ERR_INVALID_CERT_ID };
    if (testId <= 0) return { ok: false, value: ERR_INVALID_TEST_ID };
    if (!proofHash || proofHash.length > 64) return { ok: false, value: ERR_INVALID_PROOF_HASH };
    if (stake < this.state.minStake || stake > this.state.maxStake) return { ok: false, value: ERR_INVALID_STAKE };
    if (score > 100) return { ok: false, value: ERR_INVALID_SCORE_RANGE };
    if (metadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (this.state.proofsByHash.has(proofHash)) return { ok: false, value: ERR_PROOF_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const key = `${certId}-${testId}`;
    const expiry = this.blockHeight + this.state.proofExpiry;
    const proof: Proof = {
      proofHash,
      timestamp: this.blockHeight,
      staked: stake,
      revoked: false,
      score,
      expiry,
      verifier: this.caller,
      metadata,
      status: true,
    };
    this.state.proofs.set(key, proof);
    this.state.proofsByHash.set(proofHash, { certId, testId });
    this.state.nextProofId++;
    return { ok: true, value: certId };
  }

  getProof(certId: number, testId: number): Proof | null {
    return this.state.proofs.get(`${certId}-${testId}`) || null;
  }

  updateProof(
    certId: number,
    testId: number,
    updateHash: string,
    updateScore: number,
    updateMetadata: string
  ): Result<boolean> {
    const key = `${certId}-${testId}`;
    const proof = this.state.proofs.get(key);
    if (!proof) return { ok: false, value: false };
    if (proof.verifier !== this.caller) return { ok: false, value: false };
    if (!updateHash || updateHash.length > 64) return { ok: false, value: false };
    if (updateScore > 100) return { ok: false, value: false };
    if (updateMetadata.length > 256) return { ok: false, value: false };
    if (this.state.proofsByHash.has(updateHash) && this.state.proofsByHash.get(updateHash)?.certId !== certId) {
      return { ok: false, value: false };
    }

    const updated: Proof = {
      ...proof,
      proofHash: updateHash,
      timestamp: this.blockHeight,
      score: updateScore,
      metadata: updateMetadata,
    };
    this.state.proofs.set(key, updated);
    this.state.proofsByHash.delete(proof.proofHash);
    this.state.proofsByHash.set(updateHash, { certId, testId });
    this.state.proofUpdates.set(key, {
      updateHash,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateScore,
      updateMetadata,
    });
    return { ok: true, value: true };
  }

  revokeProof(certId: number, testId: number): Result<boolean> {
    const key = `${certId}-${testId}`;
    const proof = this.state.proofs.get(key);
    if (!proof) return { ok: false, value: false };
    if (proof.verifier !== this.caller) return { ok: false, value: false };
    if (proof.revoked) return { ok: false, value: false };
    const updated: Proof = { ...proof, revoked: true, status: false };
    this.state.proofs.set(key, updated);
    return { ok: true, value: true };
  }

  validateProof(certId: number, testId: number, expectedHash: string): Result<number> {
    const key = `${certId}-${testId}`;
    const proof = this.state.proofs.get(key);
    if (!proof) return { ok: false, value: ERR_PROOF_NOT_FOUND };
    if (proof.revoked) return { ok: false, value: ERR_PROOF_REVOKED };
    if (proof.proofHash !== expectedHash) return { ok: false, value: ERR_INVALID_PROOF_HASH };
    if (this.blockHeight >= proof.expiry) return { ok: false, value: ERR_PROOF_EXPIRED };
    return { ok: true, value: proof.score };
  }

  getProofCount(): Result<number> {
    return { ok: true, value: this.state.nextProofId };
  }

  checkProofExistence(proofHash: string): Result<boolean> {
    return { ok: true, value: this.state.proofsByHash.has(proofHash) };
  }
}

describe("ProofRegistry", () => {
  let contract: ProofRegistryMock;

  beforeEach(() => {
    contract = new ProofRegistryMock();
    contract.reset();
  });

  it("submits a proof successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);

    const proof = contract.getProof(1, 1);
    expect(proof?.proofHash).toBe("hash123");
    expect(proof?.staked).toBe(100);
    expect(proof?.score).toBe(85);
    expect(proof?.metadata).toBe("meta data");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate proof hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    const result = contract.submitProof(2, 2, "hash123", 200, 90, "new meta");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROOF_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller for admin functions", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    expect(result.ok).toBe(true);
  });

  it("rejects proof submission without authority contract", () => {
    const result = contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid cert id", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitProof(0, 1, "hash123", 100, 85, "meta data");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CERT_ID);
  });

  it("rejects invalid stake", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitProof(1, 1, "hash123", 50, 85, "meta data");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STAKE);
  });

  it("rejects invalid score", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitProof(1, 1, "hash123", 100, 101, "meta data");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SCORE_RANGE);
  });

  it("updates a proof successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "oldhash", 100, 85, "old meta");
    const result = contract.updateProof(1, 1, "newhash", 90, "new meta");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proof = contract.getProof(1, 1);
    expect(proof?.proofHash).toBe("newhash");
    expect(proof?.score).toBe(90);
    expect(proof?.metadata).toBe("new meta");
    const update = contract.state.proofUpdates.get("1-1");
    expect(update?.updateHash).toBe("newhash");
    expect(update?.updateScore).toBe(90);
    expect(update?.updateMetadata).toBe("new meta");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent proof", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateProof(99, 99, "newhash", 90, "new meta");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-verifier", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    contract.caller = "ST3FAKE";
    const result = contract.updateProof(1, 1, "newhash", 90, "new meta");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("revokes a proof successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    const result = contract.revokeProof(1, 1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proof = contract.getProof(1, 1);
    expect(proof?.revoked).toBe(true);
    expect(proof?.status).toBe(false);
  });

  it("rejects revocation of non-existent proof", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.revokeProof(99, 99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("validates a proof successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    const result = contract.validateProof(1, 1, "hash123");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(85);
  });

  it("rejects validation of revoked proof", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    contract.revokeProof(1, 1);
    const result = contract.validateProof(1, 1, "hash123");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROOF_REVOKED);
  });

  it("rejects validation of expired proof", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    contract.blockHeight = 525601;
    const result = contract.validateProof(1, 1, "hash123");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROOF_EXPIRED);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
    contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("returns correct proof count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "hash1", 100, 85, "meta1");
    contract.submitProof(2, 2, "hash2", 200, 90, "meta2");
    const result = contract.getProofCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks proof existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitProof(1, 1, "hash123", 100, 85, "meta data");
    const result = contract.checkProofExistence("hash123");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkProofExistence("nonexistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects proof submission with empty hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitProof(1, 1, "", 100, 85, "meta data");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROOF_HASH);
  });

  it("rejects proof submission with max proofs exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxProofs = 1;
    contract.submitProof(1, 1, "hash1", 100, 85, "meta1");
    const result = contract.submitProof(2, 2, "hash2", 200, 90, "meta2");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PROOFS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});