import { createCipher, toString } from './fpe/cipher';

const counterLength = 2 ** 16;

const counter = {
  next: Math.floor(Math.random() * counterLength),
};

function getNextSequential() {
  const next = (counter.next + 1) % counterLength;
  return (counter.next = next);
}

const cipher = createCipher('b9f61a9d4ffd4bd3bfab-e4a0e39bb87cfba2ff5e');

export async function createId() {
  const timestamp = Math.floor(Date.now() / 1000);
  const value = timestamp * counterLength + getNextSequential();
  return toString(cipher.encrypt(value));
}
