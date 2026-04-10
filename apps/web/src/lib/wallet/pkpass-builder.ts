import { PKPass } from "passkit-generator";
import path from "path";
import fs from "fs";

/**
 * Apple Wallet .pkpass Builder
 *
 * Uses passkit-generator v3 to create a signed .pkpass file.
 *
 * SETUP (one-time):
 * 1. Create Pass Type ID in Apple Developer Portal (pass.com.clubos.membership)
 * 2. Generate signing certificate, download .cer, install in Keychain
 * 3. Export as .p12 from Keychain Access
 * 4. Extract PEM files:
 *    openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem -passin pass:YOUR_PASSWORD
 *    openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem -passin pass:YOUR_PASSWORD -passout pass:YOUR_KEY_PASSWORD
 * 5. Download Apple WWDR G4 certificate:
 *    curl -o wwdr.pem https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
 *    openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
 *
 * Environment variables (for Vercel/production):
 * - APPLE_PASS_SIGNER_CERT_BASE64: Base64 of signerCert.pem
 * - APPLE_PASS_SIGNER_KEY_BASE64: Base64 of signerKey.pem
 * - APPLE_PASS_SIGNER_KEY_PASSPHRASE: Password for the private key
 * - APPLE_PASS_WWDR_BASE64: Base64 of wwdr.pem
 * - APPLE_TEAM_ID: Your Apple Developer Team ID
 * - APPLE_PASS_TYPE_ID: e.g. pass.com.clubos.membership
 *
 * For local dev, place files in apps/web/certs/:
 *   signerCert.pem, signerKey.pem, wwdr.pem
 */

interface PassInput {
  serialNumber: string;
  teamIdentifier: string;
  passTypeIdentifier: string;
  organizationName: string;
  description: string;
  memberName: string;
  memberNumber: string;
  tierName: string;
  clubName: string;
  barcodePayload: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
}

function loadFileOrEnv(envKey: string, filePath: string): string | Buffer {
  if (process.env[envKey]) {
    return Buffer.from(process.env[envKey]!, "base64");
  }
  const resolved = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(resolved)) {
    return fs.readFileSync(resolved);
  }
  throw new Error(
    `Certificate not found. Set ${envKey} env var or place file at ${filePath}`
  );
}

/**
 * Generate a minimal 1x1 green PNG icon.
 * Apple requires icon.png for a pass to be valid.
 * This is the smallest valid PNG possible (solid green pixel).
 * In production, replace with a proper club logo.
 */
function generateGreenIcon(): Buffer {
  // Valid 1x1 green (#0d5c2e) PNG. Replace with club logo in production.
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgjdEDAAERAJijgxMOAAAAAElFTkSuQmCC",
    "base64"
  );
}

/**
 * Build a signed .pkpass file and return it as a Buffer.
 */
export async function buildPkpass(input: PassInput): Promise<Buffer> {
  const signerCert = loadFileOrEnv(
    "APPLE_PASS_SIGNER_CERT_BASE64",
    "certs/signerCert.pem"
  );
  const signerKey = loadFileOrEnv(
    "APPLE_PASS_SIGNER_KEY_BASE64",
    "certs/signerKey.pem"
  );
  const wwdr = loadFileOrEnv(
    "APPLE_PASS_WWDR_BASE64",
    "certs/wwdr.pem"
  );
  const signerKeyPassphrase =
    process.env.APPLE_PASS_SIGNER_KEY_PASSPHRASE || "";

  // Generate a minimal icon (required by Apple)
  const iconBuffer = generateGreenIcon();

  // Create the pass with buffer model (no folder template needed)
  const pass = new PKPass(
    {
      // Required: at least icon.png
      "icon.png": iconBuffer,
      "icon@2x.png": iconBuffer, // reuse for 2x — Apple is lenient here
    },
    {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase,
    },
    {
      // pass.json overrides
      formatVersion: 1,
      serialNumber: input.serialNumber,
      teamIdentifier: input.teamIdentifier,
      passTypeIdentifier: input.passTypeIdentifier,
      organizationName: input.organizationName,
      description: input.description,
      backgroundColor: input.backgroundColor,
      foregroundColor: input.foregroundColor,
      labelColor: input.labelColor,
      logoText: input.clubName,
    }
  );

  // Set pass type
  pass.type = "generic";

  // Primary fields
  pass.primaryFields.push({
    key: "member_name",
    label: "MEMBER",
    value: input.memberName,
  });

  // Secondary fields
  pass.secondaryFields.push(
    {
      key: "tier",
      label: "TIER",
      value: input.tierName,
    },
    {
      key: "member_number",
      label: "MEMBER #",
      value: input.memberNumber,
    }
  );

  // Auxiliary fields
  pass.auxiliaryFields.push({
    key: "club",
    label: "CLUB",
    value: input.clubName,
  });

  // Back fields
  pass.backFields.push(
    {
      key: "info",
      label: "About This Pass",
      value: `Digital membership card for ${input.clubName}. Present at check-in, POS terminals, or facility access points.`,
    },
    {
      key: "member_id",
      label: "Member Number",
      value: input.memberNumber,
    }
  );

  // QR code barcode
  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: input.barcodePayload,
    messageEncoding: "iso-8859-1",
    altText: input.memberNumber,
  });

  // NFC tap
  pass.setNFC({
    message: input.barcodePayload,
    encryptionPublicKey: "",
  });

  // Return the signed .pkpass as a Buffer
  return pass.getAsBuffer();
}
