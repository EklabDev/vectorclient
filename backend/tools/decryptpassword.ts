import { config } from 'dotenv';
import { EncryptionService } from "../src/utils/encryption";

// Load environment variables
config();

// Get encrypted password from command line arguments
const encryptedPassword = process.argv[2];

if (!encryptedPassword) {
  console.error('Error: Encrypted password is required');
  console.error('Usage: npm run decrypt -- <encrypted-password>');
  process.exit(1);
}

try {
  const decryptedPassword = EncryptionService.decrypt(encryptedPassword);
  console.log(decryptedPassword);
} catch (error) {
  console.error('Decryption failed:', (error as Error).message);
  process.exit(1);
}