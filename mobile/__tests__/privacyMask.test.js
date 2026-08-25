import { maskAmounts } from '../src/components/AmountText';

// The mask is the fallback for devices that cannot blur (Android below 12, or
// the old architecture). If it leaves a single digit behind, privacy mode is
// worse than useless — it looks like it worked while the number is readable.
describe('maskAmounts', () => {
  it('hides a plain number', () => {
    expect(maskAmounts('1234')).toBe('•••••');
  });

  it('hides a single digit', () => {
    expect(maskAmounts('7')).toBe('•••••');
  });

  it('hides a number with thousands separators and decimals', () => {
    expect(maskAmounts('1.234.567,89')).toBe('•••••');
  });

  it('keeps the currency around the number', () => {
    expect(maskAmounts('1.500,00 RSD')).toBe('••••• RSD');
    expect(maskAmounts('$1,500.00')).toBe('$•••••');
  });

  it('hides a negative amount but leaves the sign', () => {
    expect(maskAmounts('-250,00 RSD')).toBe('-••••• RSD');
  });

  it('leaves no digit anywhere in the output', () => {
    const samples = ['0', '0,00 RSD', '999.999.999,99 EUR', 'Ukupno: 12 450 RSD', '1a2b3'];
    for (const sample of samples) {
      expect(maskAmounts(sample)).not.toMatch(/\d/);
    }
  });

  it('leaves text without numbers untouched', () => {
    expect(maskAmounts('Nema troškova')).toBe('Nema troškova');
  });

  it('accepts a non-string without throwing', () => {
    expect(maskAmounts(1234)).toBe('•••••');
    expect(maskAmounts(null)).toBe('null');
  });
});
