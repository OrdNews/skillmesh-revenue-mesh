const fs = require("fs");
const path = require("path");

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");
const XLAYER_DEPLOYMENT_FILE = path.join(DEPLOYMENTS_DIR, "xlayer-proof.json");

function ensureDeploymentsDir() {
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
}

function readProofDeployment() {
  if (!fs.existsSync(XLAYER_DEPLOYMENT_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(XLAYER_DEPLOYMENT_FILE, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeProofDeployment(payload) {
  ensureDeploymentsDir();
  fs.writeFileSync(XLAYER_DEPLOYMENT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
}

module.exports = {
  XLAYER_DEPLOYMENT_FILE,
  readProofDeployment,
  writeProofDeployment
};
