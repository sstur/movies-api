import { Skip32 } from './skip32';

const bitLength = 48;
const maxInt = 2 ** bitLength - 1;

const base = 30;
const offset = (() => {
  const outputLength = maxInt.toString(base).length;
  const char = (base - 1).toString(base);
  const maxRepresentable = parseInt(char.repeat(outputLength), base);
  return maxRepresentable - maxInt;
})();

export function createCipher(secret: string) {
  const [key1 = '', key2 = ''] = secret.split('-');

  const cipherOne = new Skip32(key1);
  const cipherTwo = new Skip32(key2);

  // Encrypt a 48-bit number using two passes of a 32-bit block cipher.
  let encrypt = (num: number) => {
    num = Math.max(num, 0);
    // Split into 16 bits and 32 bits, then encrypt the 32-bit part.
    let [upper16, lower32] = splitByBitLength(num, 16, 32);
    let encryptedOne = cipherOne.encrypt(lower32);
    // Combine the original upper 16 bits with the encrypted result.
    let firstPassResult = combine(upper16, encryptedOne, 32);
    // Split into 32 bits and 16 bits, then encrypt the 32-bit part.
    let [upper32, lower16] = splitByBitLength(firstPassResult, 32, 16);
    let encryptedTwo = cipherTwo.encrypt(upper32);
    // Combine and return the full 48-bit number.
    return combine(encryptedTwo, lower16, 16);
  };

  // Decrypt a 48-bit number that was encrypted using the function above.
  let decrypt = (num: number) => {
    num = Math.max(num, 0);
    // Split into 32 bits and 16 bits, then decrypt the 32-bit part.
    let [upper32, lower16] = splitByBitLength(num, 32, 16);
    let decryptedOne = cipherTwo.decrypt(upper32);
    // Combine the decrypted result with the original lower 16 bits.
    let firstPassResult = combine(decryptedOne, lower16, 16);
    // Split into 16 bits and 32 bits, then decrypt the 32-bit part.
    let [upper16, lower32] = splitByBitLength(firstPassResult, 16, 32);
    let decryptedTwo = cipherOne.decrypt(lower32);
    // Combine and return the full 48-bit number.
    return combine(upper16, decryptedTwo, 32);
  };

  return { encrypt, decrypt };
}

function getLowerBits(value: number, bitLength: number) {
  return value % 2 ** bitLength;
}

function getUpperBits(value: number, bitLengthToRemove: number) {
  return Math.floor(value / 2 ** bitLengthToRemove);
}

function splitByBitLength(
  value: number,
  upperBits: number,
  lowerBits: number,
): [number, number] {
  let lowerPart = getLowerBits(value, lowerBits);
  let upperPart = getLowerBits(getUpperBits(value, lowerBits), upperBits);
  return [upperPart, lowerPart];
}

function combine(upper: number, lower: number, bitsToShift: number) {
  return upper * 2 ** bitsToShift + lower;
}

// Convert a N-bit unsigned integer to a base-M string
export function toString(value: number): string {
  let boundedValue = Math.min(value, maxInt);
  return (boundedValue + offset).toString(base);
}

// Convert a base-M string string to a N-bit unsigned integer
export function fromString(str: string): number {
  let value = parseInt(str, base) - offset || 0;
  return Math.min(value, maxInt);
}
