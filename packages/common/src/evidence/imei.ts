/** Validates a device IMEI: 15 digits with a correct Luhn check digit. */
export function validateImeiChecksum(imei: string): { valid: boolean; status: 'empty' | 'incomplete' | 'invalid' | 'valid'; message: string } {
  const clean = imei.trim().replace(/[\s-]/g, '');
  if (!clean) {
    return { valid: false, status: 'empty', message: 'Enter your 15-digit device IMEI' };
  }
  if (!/^\d+$/.test(clean)) {
    return { valid: false, status: 'invalid', message: 'IMEI must contain numbers only' };
  }
  if (clean.length < 15) {
    return { valid: false, status: 'incomplete', message: `${clean.length}/15 digits entered` };
  }
  if (clean.length > 15) {
    return { valid: false, status: 'invalid', message: 'IMEI must be exactly 15 digits' };
  }

  // Luhn algorithm verification
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(clean.charAt(i), 10);
    // Double every second digit from right-to-left (or odd indices 1, 3, 5... for 15-digit string)
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  if (sum % 10 === 0) {
    return { valid: true, status: 'valid', message: 'Valid 15-digit IMEI & checksum' };
  } else {
    return { valid: false, status: 'invalid', message: 'That IMEI isn’t valid. Check the digits and try again.' };
  }
}
