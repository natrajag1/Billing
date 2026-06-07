const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigit(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}

function threeDigit(n: number): string {
  let s = "";
  if (n >= 100) {
    s += ones[Math.floor(n / 100)] + " Hundred";
    n %= 100;
    if (n) s += " ";
  }
  if (n) s += twoDigit(n);
  return s;
}

export function numberToWordsINR(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let n = rupees;
  let result = "";
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;
  if (crore) result += threeDigit(crore) + " Crore ";
  if (lakh) result += threeDigit(lakh) + " Lakh ";
  if (thousand) result += threeDigit(thousand) + " Thousand ";
  if (hundred) result += threeDigit(hundred);
  result = result.trim() + " Rupees";
  if (paise) result += " and " + twoDigit(paise) + " Paise";
  return result + " Only";
}
