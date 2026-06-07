import { numberToWordsINR } from "@/lib/numberToWords";
import upiQr from "@/assets/upi-qr.jpeg";

export interface LineItem {
  id: string;
  description: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number; // inclusive of tax
  taxMode?: "inclusive" | "final";
  hideMeta?: boolean;
}

export interface PrevRef {
  refNo: string;
  amount: number;
  type: "Dr" | "Cr";
}

export interface InvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  transportMode: string;
  vehicleNo: string;
  billedTo: { name: string; address: string; gstin: string; stateName: string; stateCode: string };
  shippedTo: { name: string; address: string; gstin: string; stateName: string; stateCode: string };
  items: LineItem[];
  gstRate: number;
  sameState: boolean;
  prevRefs?: PrevRef[];
  status?: string;
  cancellationReason?: string;
  paymentMode?: string;
}

export interface ShopSettings {
  name: string;
  gstin: string;
  mobile: string;
  address: string[];
  email: string;
  bank: { name: string; accNo: string; branch: string; ifsc: string };
  logoBase64?: string;
  upiQrBase64?: string;
  showLogo?: boolean;
  showQr?: boolean;
}

export const DEFAULT_SHOP: ShopSettings = {
  name: "AG TRADERS",
  gstin: "33DULPN7536Q1ZQ",
  mobile: "+91 9489575108",
  address: [
    "6/1C1, Ring Road,",
    "Kallupalayam, Sirumolasi (po),",
    "Tiruchengode, Namakkal,",
    "Tamilnadu - 637 209.",
  ],
  email: "agtraderstgode@gmail.com",
  bank: { name: "Canara Bank", accNo: "120038827121", branch: "Tiruchengode", ifsc: "CNRB0001272" },
  showLogo: false,
  showQr: true,
};

export function getShopSettings(): ShopSettings {
  if (typeof window === "undefined") return DEFAULT_SHOP;
  const stored = localStorage.getItem("ag_traders_shop_settings");
  if (!stored) return DEFAULT_SHOP;
  try {
    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SHOP,
      ...parsed,
      address: Array.isArray(parsed.address)
        ? parsed.address
        : (parsed.address || "").split("\n").filter(Boolean),
      bank: {
        ...DEFAULT_SHOP.bank,
        ...(parsed.bank || {}),
      },
    };
  } catch (e) {
    return DEFAULT_SHOP;
  }
}

function splitInclusive(amountIncl: number, gstRate: number) {
  const base = amountIncl / (1 + gstRate / 100);
  const tax = amountIncl - base;
  return { base, tax };
}

const MIN_ROWS = 18;

export function InvoicePreview({ data }: { data: InvoiceData }) {
  const shop = getShopSettings();

  const rows = data.items.map((it) => {
    const amountIncl = it.qty * it.rate;
    const { base, tax } =
      it.taxMode === "final"
        ? { base: amountIncl, tax: 0 }
        : splitInclusive(amountIncl, data.gstRate);
    return { ...it, amountIncl, base, tax };
  });

  const subtotalBase = rows.reduce((s, r) => s + r.base, 0);
  const totalTax = rows.reduce((s, r) => s + r.tax, 0);
  const totalIncl = rows.reduce((s, r) => s + r.amountIncl, 0);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const totalQty = rows.filter((r) => r.taxMode !== "final").reduce((s, r) => s + r.qty, 0);
  const unitLabel = rows.find((r) => r.taxMode !== "final")?.unit || "";
  const grandRounded = Math.round(subtotalBase + totalTax);

  const tdB = "border border-black";
  const tdV = "border-l border-r border-black"; // vertical only

  return (
    <div
      id="invoice-print"
      className="bg-white text-black mx-auto relative"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "6mm",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        position: "relative",
      }}
    >
      {/* Cancellation banner */}
      {data.status === "cancelled" && (
        <div className="bg-red-600 text-white text-center font-bold text-[10px] py-1 px-3 mb-2 uppercase tracking-wider rounded no-print">
          CANCELLED INVOICE · REASON: {data.cancellationReason || "N/A"}
        </div>
      )}

      {/* Cancellation watermark */}
      {data.status === "cancelled" && (
        <div
          className="absolute pointer-events-none select-none flex items-center justify-center text-red-500/10 font-black text-6xl tracking-widest uppercase border-[10px] border-red-500/10 p-6 rounded-2xl"
          style={{
            position: "absolute",
            left: "50%",
            top: "40%",
            transform: "translate(-50%, -50%) rotate(-25deg)",
            zIndex: 10,
            width: "80%",
            textAlign: "center",
          }}
        >
          CANCELLED
        </div>
      )}

      {/* Top label */}
      <div className="text-center text-[13px] mb-1">Tax Invoice</div>

      <div className="border border-black">
        {/* Header: 3 columns */}
        <div className="grid grid-cols-[1.2fr_2fr_1.2fr] border-b border-black">
          {/* Left: GSTIN + Logo */}
          <div className="border-r border-black p-1.5 flex flex-col justify-between">
            <div className="font-bold text-[11px]">GSTIN: {shop.gstin}</div>
            {shop.showLogo && shop.logoBase64 ? (
              <img
                src={shop.logoBase64}
                alt="Shop Logo"
                className="mt-1 max-h-[80px] object-contain mx-auto"
              />
            ) : shop.showLogo ? (
              <div className="mt-1 flex items-center justify-center h-[80px] border border-dashed border-gray-400 text-[10px] text-gray-500">
                {shop.name} LOGO
              </div>
            ) : (
              <div className="h-[80px]"></div>
            )}
          </div>
          {/* Center */}
          <div className="border-r border-black p-1.5 text-center">
            <h1 className="text-[22px] font-extrabold tracking-wide text-blue-700 leading-tight">
              {shop.name}
            </h1>
            {shop.address.map((l, i) => (
              <div key={i} className="text-[11px] font-semibold">
                {l}
              </div>
            ))}
            {shop.email && (
              <div className="text-[11px] mt-0.5">
                <b>E-mail:</b> {shop.email}
              </div>
            )}
          </div>
          {/* Right */}
          <div className="p-1.5">
            <div className="font-bold text-[11px]">Mobile: {shop.mobile}</div>
          </div>
        </div>

        {/* Invoice + Transport meta */}
        <div className="grid grid-cols-2 border-b border-black">
          <div className="border-r border-black p-1.5">
            <div className="grid grid-cols-[90px_10px_1fr] gap-y-0.5">
              <span>Invoice No</span>
              <span>:</span>
              <b>{data.invoiceNo}</b>
              <span>Date</span>
              <span>:</span>
              <b>{data.invoiceDate}</b>
            </div>
          </div>
          <div className="p-1.5">
            <div className="grid grid-cols-[110px_10px_1fr] gap-y-0.5">
              <span>Transport Mode</span>
              <span>:</span>
              <b>{data.transportMode || "-"}</b>
              <span>Vehicle No</span>
              <span>:</span>
              <b>{data.vehicleNo || "-"}</b>
            </div>
          </div>
        </div>

        {/* Billed / Shipped */}
        <div className="grid grid-cols-2 border-b border-black">
          {[
            { title: "Details Of Receiver (Billed to)", v: data.billedTo },
            { title: "Details Of Consignee (Shipped to)", v: data.shippedTo },
          ].map((b, i) => (
            <div key={i} className={i === 0 ? "border-r border-black p-1.5" : "p-1.5"}>
              <div>{b.title}</div>
              <div className="grid grid-cols-[80px_10px_1fr] gap-y-0.5 mt-0.5">
                <span>Name</span>
                <span>:</span>
                <b>{b.v.name}</b>
                <span>Address</span>
                <span>:</span>
                <span>{b.v.address}</span>
                <span>GSTIN</span>
                <span>:</span>
                <span>{b.v.gstin}</span>
                <span>State Name</span>
                <span>:</span>
                <span>
                  {b.v.stateName} &nbsp;&nbsp;Code: {b.v.stateCode}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className={`${tdB} w-8 p-1`}>
                Sl
                <br />
                No
              </th>
              <th className={`${tdB} p-1`}>Description of Goods</th>
              <th className={`${tdB} w-[70px] p-1`}>
                HSN/
                <br />
                SAC
              </th>
              <th className={`${tdB} w-[70px] p-1`}>Quantity</th>
              <th className={`${tdB} w-[70px] p-1`}>
                Rate
                <br />
                <span className="font-normal text-[9px]">(Incl. of Tax)</span>
              </th>
              <th className={`${tdB} w-[80px] p-1`}>Amount</th>
              <th className={`${tdB} w-[80px] p-1`}>
                Amount
                <br />
                <span className="font-normal text-[9px]">(Incl. of Tax)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, idx) => (
              <tr key={it.id} className="align-top">
                <td className={`${tdV} text-center p-1`}>{idx + 1}</td>
                <td className={`${tdV} p-1 font-bold`}>{it.description}</td>
                <td className={`${tdV} text-center p-1`}>{it.hideMeta ? "-" : it.hsn}</td>
                <td className={`${tdV} text-center p-1`}>
                  {it.hideMeta ? "-" : `${it.qty} ${it.unit}`.trim()}
                </td>
                <td className={`${tdV} text-right p-1`}>{it.rate.toFixed(2)}</td>
                <td className={`${tdV} text-right p-1`}>{it.base.toFixed(2)}</td>
                <td className={`${tdV} text-right p-1`}>{it.amountIncl.toFixed(2)}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, MIN_ROWS - rows.length) }).map((_, i) => (
              <tr key={`e${i}`}>
                <td className={`${tdV} p-1`}>&nbsp;</td>
                <td className={tdV}></td>
                <td className={tdV}></td>
                <td className={tdV}></td>
                <td className={tdV}></td>
                <td className={tdV}></td>
                <td className={tdV}></td>
              </tr>
            ))}

            {/* Total row */}
            <tr className="font-bold border-t border-black">
              <td className={tdB}></td>
              <td className={`${tdB} p-1 text-[11px] font-bold`}>
                Payment Mode: {data.paymentMode || "Cash"}
              </td>
              <td className={`${tdB} text-center p-1`}>Total</td>
              <td className={`${tdB} text-center p-1`}>
                {totalQty > 0 ? `${totalQty} ${unitLabel}`.trim() : "-"}
              </td>
              <td className={tdB}></td>
              <td className={`${tdB} text-right p-1`}>{subtotalBase.toFixed(2)}</td>
              <td className={`${tdB} text-right p-1`}>
                ₹{grandRounded.toLocaleString("en-IN")}.00
              </td>
            </tr>
          </tbody>
        </table>

        {/* Terms + Tax summary */}
        <div className="grid grid-cols-[1.6fr_1fr] border-t border-black">
          <div className="border-r border-black p-1.5 text-[10.5px]">
            <div className="font-semibold">Terms &amp; Conditions</div>
            <ol className="list-decimal pl-4 space-y-0.5 mt-0.5">
              <li>Once Goods Sold Will not be taken back or exchanged.</li>
              <li>We are not responsible for damage in transit, Breakage or Shortage.</li>
              <li>Interest @ 24% per annum Will be Charged for Delayed Payment.</li>
              <li>No Complaints Shall Be Entertained once Tiles Were Laid or Cut in Water.</li>
            </ol>
          </div>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {data.sameState ? (
                <>
                  <tr>
                    <td className={`${tdB} text-center italic font-bold p-1`}>CGST 9%</td>
                    <td className={`${tdB} text-right p-1`}>{cgst.toFixed(2)}</td>
                    <td className={tdB}></td>
                  </tr>
                  <tr>
                    <td className={`${tdB} text-center italic font-bold p-1`}>SGST 9%</td>
                    <td className={`${tdB} text-right p-1`}>{sgst.toFixed(2)}</td>
                    <td className={tdB}></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td className={`${tdB} text-center italic font-bold p-1`}>IGST 18%</td>
                  <td className={`${tdB} text-right p-1`}>{totalTax.toFixed(2)}</td>
                  <td className={tdB}></td>
                </tr>
              )}
              <tr className="font-bold">
                <td className={`${tdB} text-center p-1`}>Grand Total</td>
                <td className={`${tdB} text-right p-1`}>
                  ₹{grandRounded.toLocaleString("en-IN")}.00
                </td>
                <td className={`${tdB} text-right p-1`}>
                  ₹{grandRounded.toLocaleString("en-IN")}.00
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount in words */}
        <div className="border-t border-black p-1.5">
          <b>Amount Chargeable (in words):</b>{" "}
          <b className="ml-1">{numberToWordsINR(grandRounded)}</b>
        </div>

        {/* Footer: Bank | UPI QR | Customer sig | Authorised */}
        <div className="grid grid-cols-4 border-t border-black">
          <div className="border-r border-black p-1.5 text-[11.5px]">
            <div className="font-semibold">Bank Details</div>
            <div className="grid grid-cols-[70px_10px_1fr] gap-y-0.5 mt-0.5">
              <span>Bank Name</span>
              <span>:</span>
              <span>{shop.bank.name}</span>
              <span>A/C No.</span>
              <span>:</span>
              <span>{shop.bank.accNo}</span>
              <span>Branch</span>
              <span>:</span>
              <span>{shop.bank.branch}</span>
              <span>IFSC</span>
              <span>:</span>
              <span>{shop.bank.ifsc}</span>
            </div>
          </div>
          <div className="border-r border-black p-1.5 text-center">
            <div className="font-semibold">UPI Pay</div>
            {shop.showQr ? (
              <img
                src={shop.upiQrBase64 || upiQr}
                alt="UPI QR"
                className="mx-auto my-1 w-[95px] h-[95px] object-contain"
                style={{ imageRendering: "crisp-edges" }}
              />
            ) : (
              <div className="w-[95px] h-[95px] mx-auto flex items-center justify-center border border-dashed text-[10px] text-gray-400">
                QR Hidden
              </div>
            )}
            <div className="font-semibold text-[10px] uppercase">{shop.name}</div>
          </div>
          <div className="border-r border-black p-1.5 flex flex-col justify-end">
            <div className="text-center text-[11px]">Customer's Signature</div>
          </div>
          <div className="p-1.5 flex flex-col justify-between text-center">
            <div className="font-semibold">For {shop.name}</div>
            <div className="font-semibold mt-10">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
