export function isInt(i) {
  return i !== '' && Number.isInteger(Number(i));
}

export function validateNumber(number) {
  return typeof number === 'number' && !Number.isNaN(number);
}

export function validateDate(date) {
  return isNaN(date) && !isNaN(Date.parse(date));
}
