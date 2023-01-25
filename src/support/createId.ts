const base = 36;
const length = 9;

const max = base ** length;
const min = base ** (length - 1) * 10;

export function createId() {
  const num = Math.floor(Math.random() * (max - min)) + min;
  return num.toString(base);
}
