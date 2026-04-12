const { Interface, keccak256, toUtf8Bytes } = require("ethers");

const REGISTRY_ABI = [
  "function registerAgent(string role,string skill,string metadataURI)",
  "function recordTaskCompletion(bytes32 taskHash,address orchestrator,address[] participants,uint256[] payouts)"
];

const RECEIPT_ABI = [
  "function mintReceipt(address to,string tokenURI_) returns (uint256 tokenId)"
];

const registryInterface = new Interface(REGISTRY_ABI);
const receiptInterface = new Interface(RECEIPT_ABI);

function getPublicBaseUrl() {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.SKILLMESH_PUBLIC_BASE_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

function buildTaskProofHash(task) {
  const payload = JSON.stringify({
    id: task.id,
    input: task.input,
    createdAt: task.createdAt
  });
  return keccak256(toUtf8Bytes(payload));
}

function buildAgentMetadataUrl(agentId) {
  return `${getPublicBaseUrl()}/agent-cards/${agentId}.json`;
}

function buildReceiptArtifactUrl(taskId) {
  return `${getPublicBaseUrl()}/artifacts/receipts/${taskId}.json`;
}

function encodeRegisterAgentCall(agentId, agent) {
  return registryInterface.encodeFunctionData("registerAgent", [
    agent.role,
    agent.skill,
    buildAgentMetadataUrl(agentId)
  ]);
}

function encodeRecordTaskCompletionCall(taskReceipt) {
  const participants = (taskReceipt.livePurchases || []).map((purchase) => purchase.payTo);
  const payouts = (taskReceipt.livePurchases || []).map((purchase) =>
    BigInt(purchase.paymentRequirements?.maxAmountRequired || "0")
  );

  return registryInterface.encodeFunctionData("recordTaskCompletion", [
    taskReceipt.proofTaskHash,
    taskReceipt.orchestrator?.wallet || taskReceipt.orchestrator?.address,
    participants,
    payouts
  ]);
}

function encodeMintReceiptCall(taskReceipt) {
  return receiptInterface.encodeFunctionData("mintReceipt", [
    taskReceipt.orchestrator?.wallet || taskReceipt.orchestrator?.address,
    buildReceiptArtifactUrl(taskReceipt.taskId)
  ]);
}

module.exports = {
  REGISTRY_ABI,
  RECEIPT_ABI,
  buildAgentMetadataUrl,
  buildReceiptArtifactUrl,
  buildTaskProofHash,
  encodeMintReceiptCall,
  encodeRecordTaskCompletionCall,
  encodeRegisterAgentCall
};
