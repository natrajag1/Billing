import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Printer,
  MessageCircle,
  Mail,
  FileDown,
  Save,
  History,
  Package,
  Settings,
  Search,
  Upload,
  Check,
  X,
  Edit3,
  Sliders,
  FileText,
  TrendingUp,
  ShoppingBag,
  Briefcase,
  Download,
  PackageOpen,
} from "lucide-react";
import {
  InvoicePreview,
  type InvoiceData,
  type LineItem,
  type PrevRef,
  getShopSettings,
} from "@/components/InvoicePreview";
import { PRODUCTS, type Product } from "@/data/products";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: BillingPage,
});

function todayStr() {
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const timeStr = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
  return `${dateStr} ${timeStr}`;
}

function isFinalAmountItem(item: Pick<LineItem, "taxMode">) {
  return item.taxMode === "final";
}

async function waitForInvoiceAssets(root: HTMLElement) {
  if ("fonts" in document) {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  }

  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

function incrementInvoiceNo(currentNo: string): string {
  const match = currentNo.match(/\d+$/);
  if (!match) {
    return currentNo + "1";
  }
  const numStr = match[0];
  const numVal = parseInt(numStr, 10) + 1;
  const paddedNum = String(numVal).padStart(numStr.length, "0");
  return currentNo.substring(0, currentNo.length - numStr.length) + paddedNum;
}

function BillingPage() {
  // Navigation
  const [activeTab, setActiveTab] = useState("billing");

  // Load initial settings
  const initialShop = getShopSettings();

  // Settings state
  const [shopName, setShopName] = useState(initialShop.name);
  const [shopGstin, setShopGstin] = useState(initialShop.gstin);
  const [shopMobile, setShopMobile] = useState(initialShop.mobile);
  const [shopAddress, setShopAddress] = useState(initialShop.address.join("\n"));
  const [shopEmail, setShopEmail] = useState(initialShop.email);
  const [shopBankName, setShopBankName] = useState(initialShop.bank.name);
  const [shopBankAcc, setShopBankAcc] = useState(initialShop.bank.accNo);
  const [shopBankBranch, setShopBankBranch] = useState(initialShop.bank.branch);
  const [shopBankIfsc, setShopBankIfsc] = useState(initialShop.bank.ifsc);
  const [shopShowLogo, setShopShowLogo] = useState(initialShop.showLogo ?? false);
  const [shopShowQr, setShopShowQr] = useState(initialShop.showQr ?? true);
  const [shopLogoBase64, setShopLogoBase64] = useState(initialShop.logoBase64 || "");
  const [shopUpiQrBase64, setShopUpiQrBase64] = useState(initialShop.upiQrBase64 || "");

  // Settings Version for preview cache-busting
  const [settingsVer, setSettingsVer] = useState(0);

  // Billing Page states
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [transportMode, setTransportMode] = useState("By Road");
  const [vehicleNo, setVehicleNo] = useState("");
  const [paymentMode, setPaymentMode] = useState("Credit");

  const [billedName, setBilledName] = useState("");
  const [billedAddress, setBilledAddress] = useState("");
  const [billedGstin, setBilledGstin] = useState("");
  const [billedStateName, setBilledStateName] = useState("Tamil Nadu");
  const [billedState, setBilledState] = useState("33");

  const [shipSame, setShipSame] = useState(true);
  const [shippedName, setShippedName] = useState("");
  const [shippedAddress, setShippedAddress] = useState("");
  const [shippedGstin, setShippedGstin] = useState("");
  const [shippedStateName, setShippedStateName] = useState("");
  const [shippedState, setShippedState] = useState("");

  const [gstRate, setGstRate] = useState(18);
  const [sameState, setSameState] = useState(true);

  const [items, setItems] = useState<LineItem[]>([]);
  const [prevRefs, setPrevRefs] = useState<PrevRef[]>([]);

  // Purchase Entry States
  const [billingMode, setBillingMode] = useState<"sale" | "purchase">("sale");
  const [historyMode, setHistoryMode] = useState<"sale" | "purchase">("sale");
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayStr());
  const [purchaseSupplierName, setPurchaseSupplierName] = useState("");
  const [purchaseSupplierGstin, setPurchaseSupplierGstin] = useState("");
  const [purchaseSupplierStateName, setPurchaseSupplierStateName] = useState("Tamil Nadu");
  const [purchaseSupplierState, setPurchaseSupplierState] = useState("33");
  const [purchaseSupplierAddress, setPurchaseSupplierAddress] = useState("");
  const [purchaseSubtotal, setPurchaseSubtotal] = useState<number | "">("");
  const [purchaseGstRate, setPurchaseGstRate] = useState<number>(18);
  const [purchaseCgst, setPurchaseCgst] = useState<number>(0);
  const [purchaseSgst, setPurchaseSgst] = useState<number>(0);
  const [purchaseIgst, setPurchaseIgst] = useState<number>(0);
  const [purchaseRounding, setPurchaseRounding] = useState<number>(0);
  const [purchasePaymentMode, setPurchasePaymentMode] = useState("Credit");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<any | null>(null);

  // Auto-calculate GST on purchase subtotal / state changes
  useEffect(() => {
    const sub = Number(purchaseSubtotal) || 0;
    const rate = purchaseGstRate;
    const totalGst = (sub * rate) / 100;
    if (purchaseSupplierState === "33") {
      setPurchaseCgst(Math.round((totalGst / 2) * 100) / 100);
      setPurchaseSgst(Math.round((totalGst / 2) * 100) / 100);
      setPurchaseIgst(0);
    } else {
      setPurchaseCgst(0);
      setPurchaseSgst(0);
      setPurchaseIgst(Math.round(totalGst * 100) / 100);
    }
  }, [purchaseSubtotal, purchaseGstRate, purchaseSupplierState]);

  // Customer Autocomplete states
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);

  // Custom Products Catalog states
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const [newProdName, setNewProdName] = useState("");
  const [newProdHsn, setNewProdHsn] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("Boxes");
  const [newProdRate, setNewProdRate] = useState(0);
  const [newProdTaxMode, setNewProdTaxMode] = useState<"inclusive" | "final">("inclusive");
  const [newProdHideMeta, setNewProdHideMeta] = useState(false);
  const [prodSearch, setProdSearch] = useState("");

  // History Tab states
  const [savedBills, setSavedBills] = useState<any[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Responsive preview scaling
  const [previewScale, setPreviewScale] = useState(0.7);
  const [previewContainerRef, setPreviewContainerRef] = useState<HTMLDivElement | null>(null);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [settingsPasskeyInput, setSettingsPasskeyInput] = useState("");
  const [isDateEditable, setIsDateEditable] = useState(false);

  // Staff states
  interface StaffMember {
    name: string;
    pin: string;
  }
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(null);
  const [selectedStaffLogin, setSelectedStaffLogin] = useState<string>("");
  const [staffPinInput, setStaffPinInput] = useState<string>("");
  const [newStaffName, setNewStaffName] = useState<string>("");
  const [newStaffPin, setNewStaffPin] = useState<string>("");
  const [isStaffLoginModalOpen, setIsStaffLoginModalOpen] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<((staff: StaffMember) => void) | null>(
    null,
  );

  useEffect(() => {
    if (!previewContainerRef) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      const baseWidth = 810; // A4 width + padding
      const newScale = Math.min(1, width / baseWidth);
      setPreviewScale(newScale);
    });
    observer.observe(previewContainerRef);
    return () => observer.disconnect();
  }, [previewContainerRef]);

  // Load Customers
  const loadCustomers = () => {
    const stored = localStorage.getItem("ag_traders_customers");
    if (stored) {
      try {
        setCustomers(JSON.parse(stored));
      } catch (e) {}
    }
  };

  // Load Suppliers
  const loadSuppliers = () => {
    const stored = localStorage.getItem("ag_traders_suppliers");
    if (stored) {
      try {
        setSuppliers(JSON.parse(stored));
      } catch (e) {}
    }
  };

  // Load Custom Products
  const loadCustomProducts = () => {
    const stored = localStorage.getItem("ag_traders_custom_products");
    if (stored) {
      try {
        setCustomProducts(JSON.parse(stored));
      } catch (e) {}
    }
  };

  useEffect(() => {
    loadCustomers();
    loadSuppliers();
    loadCustomProducts();
    loadStaffList();

    // Load last invoice number from localStorage instantly
    const storedLast = localStorage.getItem("ag_traders_last_invoice_no");
    if (storedLast) {
      setInvoiceNo(incrementInvoiceNo(storedLast));
    } else {
      setInvoiceNo("007"); // Default fallback
    }

    // Fetch the absolute latest invoice number from Supabase to check cloud state
    const fetchLatestInvoiceNo = async () => {
      try {
        const { data: latestBills, error } = await supabase
          .from("bills")
          .select("invoice_no")
          .order("created_at", { ascending: false })
          .limit(1);
        if (latestBills && latestBills.length > 0) {
          const lastNo = latestBills[0].invoice_no;
          setInvoiceNo(incrementInvoiceNo(lastNo));
          localStorage.setItem("ag_traders_last_invoice_no", lastNo);
        }
      } catch (e) {
        console.error("Failed to fetch latest invoice number from DB:", e);
      }
    };
    fetchLatestInvoiceNo();
  }, []);

  // Combine products list
  const combinedProducts = useMemo(() => {
    const map = new Map<string, Product>();
    // Insert static catalog
    PRODUCTS.forEach((p) => map.set(p.name.toLowerCase(), p));
    // Insert custom user products (can override static ones if name matches)
    customProducts.forEach((p) => map.set(p.name.toLowerCase(), p));
    return Array.from(map.values());
  }, [customProducts]);

  // Load staff list from localStorage
  const loadStaffList = () => {
    const stored = localStorage.getItem("ag_traders_staff_list");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setStaffList(parsed);
        if (parsed.length > 0) {
          setSelectedStaffLogin(parsed[0].name);
        }
      } catch (e) {}
    } else {
      const defaults = [{ name: "Admin", pin: "0000" }];
      setStaffList(defaults);
      setSelectedStaffLogin("Admin");
      localStorage.setItem("ag_traders_staff_list", JSON.stringify(defaults));
    }
  };

  // Add a new staff member (from Shop Settings)
  const handleAddStaff = () => {
    if (!newStaffName.trim()) {
      toast.error("Staff Name is required!");
      return;
    }
    if (newStaffPin.length !== 4 || isNaN(Number(newStaffPin))) {
      toast.error("PIN must be exactly 4 digits!");
      return;
    }
    if (staffList.some((s) => s.name.toLowerCase() === newStaffName.trim().toLowerCase())) {
      toast.error("Staff member with this name already exists!");
      return;
    }

    const updated = [...staffList, { name: newStaffName.trim(), pin: newStaffPin }];
    setStaffList(updated);
    localStorage.setItem("ag_traders_staff_list", JSON.stringify(updated));
    setNewStaffName("");
    setNewStaffPin("");
    toast.success("Staff member added successfully!");
  };

  // Delete a staff member (from Shop Settings)
  const handleDeleteStaff = (name: string) => {
    if (name === "Admin" && staffList.length === 1) {
      toast.error("Cannot delete the only staff account!");
      return;
    }

    const updated = staffList.filter((s) => s.name !== name);
    setStaffList(updated);
    localStorage.setItem("ag_traders_staff_list", JSON.stringify(updated));

    if (currentStaff?.name === name) {
      setCurrentStaff(null);
      setStaffPinInput("");
    }

    toast.success("Staff member deleted!");
  };

  // Staff Login
  const handleStaffLogin = () => {
    const staff = staffList.find((s) => s.name === selectedStaffLogin);
    if (!staff) {
      toast.error("Select a staff member!");
      return;
    }
    if (staffPinInput === staff.pin) {
      setCurrentStaff(staff);
      setStaffPinInput("");
      setIsStaffLoginModalOpen(false);
      toast.success(`Logged in as ${staff.name}`);
      if (pendingAuthAction) {
        pendingAuthAction(staff);
        setPendingAuthAction(null);
      }
    } else {
      toast.error("Invalid PIN! Access Denied.");
      setStaffPinInput("");
    }
  };

  const runWithAuth = (action: (staff: StaffMember) => void) => {
    if (currentStaff) {
      action(currentStaff);
    } else {
      setPendingAuthAction(() => action);
      setIsStaffLoginModalOpen(true);
    }
  };

  // Save bill payload locally to localStorage when offline
  const saveOfflineBill = (billPayload: any) => {
    try {
      const offlineData = localStorage.getItem("ag_traders_offline_bills");
      const offlineBills = offlineData ? JSON.parse(offlineData) : [];

      const newOfflineBill = {
        ...billPayload,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        data: {
          ...billPayload.data,
          isOffline: true,
        },
      };

      offlineBills.push(newOfflineBill);
      localStorage.setItem("ag_traders_offline_bills", JSON.stringify(offlineBills));

      // Update local state instantly so it shows in the table and stats
      setSavedBills((prev) => [newOfflineBill, ...prev]);
    } catch (e) {
      console.error("Failed to save bill offline:", e);
    }
  };

  // Sync locally saved offline bills to Supabase
  const syncOfflineBills = async () => {
    if (!navigator.onLine) return;
    const offlineData = localStorage.getItem("ag_traders_offline_bills");
    if (!offlineData) return;

    try {
      const offlineBills = JSON.parse(offlineData);
      if (offlineBills.length === 0) return;

      toast.loading(`Syncing ${offlineBills.length} offline bills to database...`, { id: "sync" });

      const remainingBills = [];
      let successCount = 0;

      for (const bill of offlineBills) {
        const cleanBill = {
          invoice_no: bill.invoice_no,
          invoice_date: bill.invoice_date,
          billed_name: bill.billed_name,
          billed_gstin: bill.billed_gstin,
          grand_total: bill.grand_total,
          total_qty: bill.total_qty,
          gst_rate: bill.gst_rate,
          same_state: bill.same_state,
          data: { ...bill.data },
        };

        if (cleanBill.data) {
          delete (cleanBill.data as any).isOffline;
        }

        const { error } = await supabase.from("bills").insert(cleanBill);
        if (error) {
          console.error(`Failed to sync bill ${bill.invoice_no}:`, error.message);
          remainingBills.push(bill);
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        localStorage.setItem("ag_traders_offline_bills", JSON.stringify(remainingBills));
        fetchHistory();
        toast.success(`Synced ${successCount} offline bills to database!`, { id: "sync" });
      } else {
        toast.dismiss("sync");
      }
    } catch (e) {
      console.error("Error running offline sync:", e);
      toast.dismiss("sync");
    }
  };

  // Handle Fetch Invoices
  const fetchHistory = async () => {
    setLoadingBills(true);
    try {
      // 1. Fetch online bills
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .order("created_at", { ascending: false });

      // 2. Load offline bills
      const offlineData = localStorage.getItem("ag_traders_offline_bills");
      let offlineBills: any[] = [];
      if (offlineData) {
        try {
          offlineBills = JSON.parse(offlineData);
        } catch (e) {}
      }

      if (error) {
        console.warn("DB fetch failed, loading offline-only history:", error.message);
        setSavedBills(offlineBills);
      } else {
        setSavedBills([...offlineBills, ...(data || [])]);
      }
    } catch (e: any) {
      console.error("Database connection issue:", e);
      const offlineData = localStorage.getItem("ag_traders_offline_bills");
      if (offlineData) {
        try {
          setSavedBills(JSON.parse(offlineData));
        } catch (err) {}
      }
    } finally {
      setLoadingBills(false);
    }
  };

  // Run sync on load and set up network listeners
  useEffect(() => {
    syncOfflineBills();
    const handleOnline = () => {
      syncOfflineBills();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      syncOfflineBills();
      fetchHistory();
    }
  }, [activeTab]);

  // Invoice calculations
  const data: InvoiceData = useMemo(
    () => ({
      invoiceNo,
      invoiceDate,
      transportMode,
      vehicleNo,
      billedTo: {
        name: billedName,
        address: billedAddress,
        gstin: billedGstin,
        stateName: billedStateName,
        stateCode: billedState,
      },
      shippedTo: shipSame
        ? {
            name: billedName,
            address: billedAddress,
            gstin: billedGstin,
            stateName: billedStateName,
            stateCode: billedState,
          }
        : {
            name: shippedName,
            address: shippedAddress,
            gstin: shippedGstin,
            stateName: shippedStateName,
            stateCode: shippedState,
          },
      items,
      gstRate,
      sameState,
      prevRefs,
      paymentMode,
    }),
    [
      invoiceNo,
      invoiceDate,
      transportMode,
      vehicleNo,
      billedName,
      billedAddress,
      billedGstin,
      billedStateName,
      billedState,
      shipSame,
      shippedName,
      shippedAddress,
      shippedGstin,
      shippedStateName,
      shippedState,
      items,
      gstRate,
      sameState,
      prevRefs,
      paymentMode,
    ],
  );

  const summary = items.reduce(
    (acc, item) => {
      const amount = item.qty * item.rate;
      if (isFinalAmountItem(item)) {
        acc.base += amount;
      } else {
        const taxableBase = amount / (1 + gstRate / 100);
        acc.base += taxableBase;
        acc.tax += amount - taxableBase;
      }
      acc.total += amount;
      return acc;
    },
    { base: 0, tax: 0, total: 0 },
  );
  const base = summary.base;
  const tax = summary.tax;
  const grand = Math.round(base + tax);

  // Extract unique months (MM/YYYY) dynamically from saved bills
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    savedBills.forEach((bill) => {
      if (bill.invoice_date) {
        const dateOnly = bill.invoice_date.split(" ")[0];
        const parts = dateOnly.split("/");
        if (parts.length === 3) {
          const monthYear = `${parts[1]}/${parts[2]}`; // MM/YYYY
          monthsSet.add(monthYear);
        }
      }
    });

    // Sort months in descending order (newest first)
    return Array.from(monthsSet).sort((a, b) => {
      const [m1, y1] = a.split("/").map(Number);
      const [m2, y2] = b.split("/").map(Number);
      if (y1 !== y2) return y2 - y1;
      return m2 - m1;
    });
  }, [savedBills]);

  const formatMonthYear = (myStr: string) => {
    const [m, y] = myStr.split("/");
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthIdx = parseInt(m, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${monthNames[monthIdx]} ${y}`;
    }
    return myStr;
  };

  // Business stats for History tab
  const historyStats = useMemo(() => {
    let billsToUse = savedBills.filter((b) => {
      const isPurchase = b.data && (b.data as any).type === "purchase";
      return historyMode === "purchase" ? isPurchase : !isPurchase;
    });

    if (selectedMonth !== "all") {
      billsToUse = billsToUse.filter((b) => {
        if (b.invoice_date) {
          const dateOnly = b.invoice_date.split(" ")[0];
          const parts = dateOnly.split("/");
          return parts.length === 3 && `${parts[1]}/${parts[2]}` === selectedMonth;
        }
        return false;
      });
    }

    const activeBills = billsToUse.filter(
      (b) => !(b.data && (b.data as any).status === "cancelled"),
    );
    const totalCount = activeBills.length;
    const totalRevenue = activeBills.reduce((s, b) => s + (b.grand_total || 0), 0);

    const totalGstPaid = activeBills.reduce((s, b) => {
      const d = b.data as any;
      if (d) {
        const cgst = d.cgst || 0;
        const sgst = d.sgst || 0;
        const igst = d.igst || 0;
        return s + cgst + sgst + igst;
      }
      return s;
    }, 0);

    const totalGstCollected = activeBills.reduce((s, b) => {
      const itemsList = (b.data as any)?.items || [];
      const gRate = b.gst_rate || 0;
      let billGst = 0;
      itemsList.forEach((item: any) => {
        const amount = (item.qty || 0) * (item.rate || 0);
        if (item.taxMode !== "final") {
          const base = amount / (1 + gRate / 100);
          billGst += amount - base;
        }
      });
      return s + Math.round(billGst * 100) / 100;
    }, 0);

    const totalQtySold = activeBills.reduce((s, b) => s + (b.total_qty || 0), 0);
    return {
      totalCount,
      totalRevenue,
      totalQtySold,
      totalGstPaid,
      totalGstCollected: Math.round(totalGstCollected),
    };
  }, [savedBills, selectedMonth, historyMode]);

  // Handlers for Items
  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "",
        hsn: "",
        qty: 1,
        unit: "Boxes",
        rate: 0,
        taxMode: "inclusive",
        hideMeta: false,
      },
    ]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  // Handlers for References
  const updateRef = (idx: number, patch: Partial<PrevRef>) =>
    setPrevRefs((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRef = () => setPrevRefs((p) => [...p, { refNo: "", amount: 0, type: "Dr" }]);
  const removeRef = (idx: number) => setPrevRefs((p) => p.filter((_, i) => i !== idx));

  // Image Upload helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "qr") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === "logo") {
        setShopLogoBase64(base64String);
      } else {
        setShopUpiQrBase64(base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Settings handler
  const handleSaveSettings = () => {
    const newSettings = {
      name: shopName.trim(),
      gstin: shopGstin.trim(),
      mobile: shopMobile.trim(),
      address: shopAddress.split("\n").filter(Boolean),
      email: shopEmail.trim(),
      bank: {
        name: shopBankName.trim(),
        accNo: shopBankAcc.trim(),
        branch: shopBankBranch.trim(),
        ifsc: shopBankIfsc.trim(),
      },
      showLogo: shopShowLogo,
      showQr: shopShowQr,
      logoBase64: shopLogoBase64,
      upiQrBase64: shopUpiQrBase64,
    };
    localStorage.setItem("ag_traders_shop_settings", JSON.stringify(newSettings));
    setSettingsVer((v) => v + 1);
    toast.success("Shop settings saved successfully!");
  };

  const handleUnlockSettings = () => {
    if (settingsPasskeyInput === "WALKking&10NATRAJ") {
      setIsSettingsUnlocked(true);
      toast.success("Settings unlocked successfully!");
    } else {
      toast.error("Invalid Passkey! Access Denied.");
    }
  };

  useEffect(() => {
    if (activeTab !== "settings") {
      setIsSettingsUnlocked(false);
      setSettingsPasskeyInput("");
    }
  }, [activeTab]);

  // Add Custom Product catalog handler
  const handleAddProduct = () => {
    if (!newProdName.trim()) {
      toast.error("Product Name is required");
      return;
    }
    const product: Product = {
      name: newProdName.trim(),
      hsn: newProdHsn.trim(),
      unit: newProdUnit.trim(),
      rate: +newProdRate,
      taxMode: newProdTaxMode,
      hideMeta: newProdHideMeta,
    };
    const updated = [
      ...customProducts.filter((p) => p.name.toLowerCase() !== product.name.toLowerCase()),
      product,
    ];
    localStorage.setItem("ag_traders_custom_products", JSON.stringify(updated));
    loadCustomProducts();
    setNewProdName("");
    setNewProdHsn("");
    setNewProdRate(0);
    toast.success(`Catalog updated with "${product.name}"`);
  };

  const handleDeleteCustomProduct = (name: string) => {
    const updated = customProducts.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
    localStorage.setItem("ag_traders_custom_products", JSON.stringify(updated));
    loadCustomProducts();
    toast.success(`Removed product "${name}"`);
  };

  // Save Customer helper
  const saveCustomer = (cust: {
    name: string;
    address: string;
    gstin: string;
    stateName: string;
    stateCode: string;
  }) => {
    if (!cust.name) return;
    const stored = localStorage.getItem("ag_traders_customers");
    let current: any[] = [];
    if (stored) {
      try {
        current = JSON.parse(stored);
      } catch (e) {}
    }
    current = current.filter((c) => c.name.toLowerCase() !== cust.name.toLowerCase());
    current.unshift(cust);
    localStorage.setItem("ag_traders_customers", JSON.stringify(current.slice(0, 50)));
    loadCustomers();
  };

  // Save Supplier helper
  const saveSupplier = (supp: {
    name: string;
    gstin: string;
    stateName: string;
    stateCode: string;
    address?: string;
  }) => {
    if (!supp.name) return;
    const stored = localStorage.getItem("ag_traders_suppliers");
    let current: any[] = [];
    if (stored) {
      try {
        current = JSON.parse(stored);
      } catch (e) {}
    }
    current = current.filter((s) => s.name.toLowerCase() !== supp.name.toLowerCase());
    current.unshift(supp);
    localStorage.setItem("ag_traders_suppliers", JSON.stringify(current.slice(0, 50)));
    loadSuppliers();
  };

  // Save Purchase Entry summary
  const handleSavePurchase = async (activeStaff: StaffMember) => {
    if (!purchaseSupplierName.trim()) {
      toast.error("Supplier Name is required!");
      return;
    }
    if (!purchaseInvoiceNo.trim()) {
      toast.error("Supplier Invoice Number is required!");
      return;
    }
    if (Number(purchaseSubtotal) <= 0) {
      toast.error("Subtotal/Taxable value must be greater than zero!");
      return;
    }

    const calculatedGst =
      purchaseSupplierState === "33" ? purchaseCgst + purchaseSgst : purchaseIgst;
    const finalGrand = (Number(purchaseSubtotal) || 0) + calculatedGst + Number(purchaseRounding);

    const billPayload = {
      invoice_no: purchaseInvoiceNo.trim(),
      invoice_date: purchaseDate,
      billed_name: purchaseSupplierName.trim(),
      billed_gstin: purchaseSupplierGstin.trim() || null,
      grand_total: finalGrand,
      total_qty: 0,
      gst_rate: purchaseGstRate,
      same_state: purchaseSupplierState === "33",
      data: {
        type: "purchase",
        taxableValue: Number(purchaseSubtotal) || 0,
        cgst: purchaseCgst,
        sgst: purchaseSgst,
        igst: purchaseIgst,
        rounding: purchaseRounding,
        paymentMode: purchasePaymentMode,
        billedBy: activeStaff.name,
        supplierState: purchaseSupplierState,
        supplierStateName: purchaseSupplierStateName,
        supplierAddress: purchaseSupplierAddress.trim(),
        createdAt: new Date().toISOString(),
      },
    };

    toast.loading("Saving purchase entry...", { id: "save-purchase" });

    let savedOffline = false;
    if (!navigator.onLine) {
      saveOfflineBill(billPayload);
      savedOffline = true;
    } else {
      try {
        const { error } = await supabase.from("bills").insert(billPayload);
        if (error) {
          if (error.message?.includes("fetch") || error.message?.includes("network")) {
            saveOfflineBill(billPayload);
            savedOffline = true;
          } else {
            toast.error(`Save failed: ${error.message}`, { id: "save-purchase" });
            return;
          }
        }
      } catch (e: any) {
        saveOfflineBill(billPayload);
        savedOffline = true;
      }
    }

    // Save supplier to local directory
    saveSupplier({
      name: purchaseSupplierName.trim(),
      gstin: purchaseSupplierGstin.trim(),
      stateName: purchaseSupplierStateName,
      stateCode: purchaseSupplierState,
      address: purchaseSupplierAddress.trim(),
    });

    // Reset Form
    setPurchaseInvoiceNo("");
    setPurchaseSupplierName("");
    setPurchaseSupplierGstin("");
    setPurchaseSupplierAddress("");
    setPurchaseSubtotal("");
    setPurchaseRounding(0);
    setPurchasePaymentMode("Credit");
    setPurchaseDate(todayStr());

    if (savedOffline) {
      toast.success("Offline! Purchase saved locally. Will sync when internet is back.", {
        id: "save-purchase",
      });
    } else {
      toast.success("Purchase entry saved successfully!", { id: "save-purchase" });
      syncOfflineBills();
    }
  };

  // Reprint helper
  const handleReprint = (bill: any) => {
    const d = bill.data;
    if (!d) {
      toast.error("Bill details are missing or corrupted");
      return;
    }
    setInvoiceNo(d.invoiceNo || bill.invoice_no);
    setInvoiceDate(d.invoiceDate || bill.invoice_date);
    setTransportMode(d.transportMode || "");
    setVehicleNo(d.vehicleNo || "");
    setPaymentMode(d.paymentMode || "Cash");
    setBilledName(d.billedTo?.name || bill.billed_name);
    setBilledAddress(d.billedTo?.address || "");
    setBilledGstin(d.billedTo?.gstin || bill.billed_gstin || "");
    setBilledStateName(d.billedTo?.stateName || "");
    setBilledState(d.billedTo?.stateCode || "");

    const shipSameVal = JSON.stringify(d.billedTo) === JSON.stringify(d.shippedTo);
    setShipSame(shipSameVal);
    if (!shipSameVal && d.shippedTo) {
      setShippedName(d.shippedTo.name || "");
      setShippedAddress(d.shippedTo.address || "");
      setShippedGstin(d.shippedTo.gstin || "");
      setShippedStateName(d.shippedTo.stateName || "");
      setShippedState(d.shippedTo.stateCode || "");
    }

    setItems(d.items || []);
    setPrevRefs(d.prevRefs || []);
    setGstRate(d.gstRate ?? bill.gst_rate ?? 18);
    setSameState(d.sameState ?? bill.same_state ?? true);

    setActiveTab("billing");
    toast.success(`Invoice #${bill.invoice_no} loaded for editing/reprinting`);
  };

  // Cancel Bill helper
  const handleCancelBill = async (bill: any) => {
    const reason = prompt(`Enter reason for cancelling Invoice #${bill.invoice_no}:`);
    if (reason === null) return; // User clicked Cancel
    if (!reason.trim()) {
      toast.error("Cancellation reason is required!");
      return;
    }

    toast.loading("Cancelling invoice...", { id: "cancel-bill" });
    try {
      const updatedData = {
        ...bill.data,
        status: "cancelled",
        cancellationReason: reason.trim(),
        cancelledAt: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("bills")
        .update({
          data: JSON.parse(JSON.stringify(updatedData)),
        })
        .eq("id", bill.id)
        .select();

      if (error) {
        toast.error(`Cancellation failed: ${error.message}`, { id: "cancel-bill" });
      } else if (!data || data.length === 0) {
        toast.error(
          "Database Policy Error: Update permission denied. Please run the SQL migration on Supabase dashboard to allow updating bills!",
          { id: "cancel-bill", duration: 8000 },
        );
      } else {
        toast.success(`Invoice #${bill.invoice_no} cancelled successfully`, { id: "cancel-bill" });
        fetchHistory();
      }
    } catch (e: any) {
      toast.error(`Cancellation failed: ${e.message}`, { id: "cancel-bill" });
    }
  };

  // PDF Generation logic
  const generatePdfBlob = async () => {
    const el = document.getElementById("invoice-print-container");
    if (!el) throw new Error("Invoice print container not found");

    let exportHost: HTMLDivElement | null = null;
    try {
      exportHost = document.createElement("div");
      exportHost.style.position = "fixed";
      exportHost.style.left = "-10000px";
      exportHost.style.top = "0";
      exportHost.style.width = "210mm";
      exportHost.style.background = "#ffffff";
      exportHost.style.pointerEvents = "none";
      exportHost.style.opacity = "1";

      const clonedEl = el.cloneNode(true) as HTMLElement;
      clonedEl.id = "invoice-print-export";
      clonedEl.style.width = "210mm";
      clonedEl.style.position = "static"; // override print-only positioning
      clonedEl.style.left = "auto";
      clonedEl.style.top = "auto";
      clonedEl.style.lineHeight = "1.35";

      exportHost.appendChild(clonedEl);
      document.body.appendChild(exportHost);

      await waitForInvoiceAssets(clonedEl);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const width = clonedEl.offsetWidth || 794;
      const height = clonedEl.offsetHeight || 1123;

      const canvas = await html2canvas(clonedEl, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: width,
        width: width,
        height: height,
      });
      const img = canvas.toDataURL("image/jpeg", 0.9);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(img, "JPEG", 0, 0, pdfW, pdfH);
      const customerName = billedName.trim() || "customer";
      const fileName = `Invoice_${invoiceNo}_${customerName.replace(/\s+/g, "_")}.pdf`;
      return { blob: pdf.output("blob") as Blob, fileName, pdf };
    } finally {
      exportHost?.remove();
    }
  };

  const handleExportCSV = () => {
    let billsToExport = savedBills.filter((b) => !(b.data && (b.data as any).type === "purchase"));
    if (selectedMonth !== "all") {
      billsToExport = billsToExport.filter((b) => {
        if (b.invoice_date) {
          const dateOnly = b.invoice_date.split(" ")[0];
          const parts = dateOnly.split("/");
          return parts.length === 3 && `${parts[1]}/${parts[2]}` === selectedMonth;
        }
        return false;
      });
    }

    // Sort by invoice number (oldest first)
    billsToExport = [...billsToExport].sort((a, b) => {
      const numA = parseInt(a.invoice_no.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.invoice_no.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });

    const headers = [
      "Invoice No",
      "Invoice Date",
      "Status",
      "Cancellation Reason",
      "Billed By (Staff)",
      "Payment Mode",
      "Customer Name",
      "Customer GSTIN",
      "GST Rate (%)",
      "Taxable Value (Before Tax)",
      "CGST Amount",
      "SGST Amount",
      "IGST Amount",
      "Total GST Amount",
      "Grand Total (Gross Sales)",
    ];

    const rows = billsToExport.map((bill) => {
      const itemsList = (bill.data as any)?.items || [];
      const gRate = bill.gst_rate || 0;
      const isSame = bill.same_state;
      const isCancelled = (bill.data as any)?.status === "cancelled";
      const cancelReason = isCancelled ? (bill.data as any)?.cancellationReason || "Cancelled" : "";
      const billedBy = (bill.data as any)?.billedBy || "Admin";
      const paymentModeVal = (bill.data as any)?.paymentMode || "Cash";

      let taxableValue = 0;
      let totalGstAmount = 0;

      itemsList.forEach((item: any) => {
        const amount = item.qty * item.rate;
        if (item.taxMode === "final") {
          taxableValue += amount;
        } else {
          const base = amount / (1 + gRate / 100);
          taxableValue += base;
          totalGstAmount += amount - base;
        }
      });

      // Rounding to 2 decimal places for accurate values
      taxableValue = Math.round(taxableValue * 100) / 100;
      totalGstAmount = Math.round(totalGstAmount * 100) / 100;

      const cgst = isSame ? Math.round((totalGstAmount / 2) * 100) / 100 : 0;
      const sgst = isSame ? Math.round((totalGstAmount / 2) * 100) / 100 : 0;
      const igst = !isSame ? Math.round(totalGstAmount * 100) / 100 : 0;

      return [
        bill.invoice_no,
        bill.invoice_date,
        isCancelled ? "CANCELLED" : "ACTIVE",
        cancelReason,
        billedBy,
        paymentModeVal,
        bill.billed_name,
        bill.billed_gstin || "",
        gRate,
        taxableValue,
        cgst,
        sgst,
        igst,
        totalGstAmount,
        bill.grand_total,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val);
            if (str.includes(",") || str.includes("\n") || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const monthLabel =
      selectedMonth === "all" ? "All_Months" : formatMonthYear(selectedMonth).replace(" ", "_");
    link.href = url;
    link.setAttribute("download", `AG_Traders_Sales_Report_${monthLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sales report downloaded successfully!");
  };

  const handleExportPurchaseCSV = () => {
    let billsToExport = savedBills.filter((b) => b.data && (b.data as any).type === "purchase");
    if (selectedMonth !== "all") {
      billsToExport = billsToExport.filter((b) => {
        if (b.invoice_date) {
          const dateOnly = b.invoice_date.split(" ")[0];
          const parts = dateOnly.split("/");
          return parts.length === 3 && `${parts[1]}/${parts[2]}` === selectedMonth;
        }
        return false;
      });
    }

    // Sort by invoice date/number
    billsToExport = [...billsToExport].sort((a, b) => {
      const numA = parseInt(a.invoice_no.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.invoice_no.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });

    const headers = [
      "Supplier Invoice No",
      "Invoice Date",
      "Status",
      "Cancellation Reason",
      "Billed By (Staff)",
      "Payment Mode",
      "Supplier Name",
      "Supplier GSTIN",
      "State Code",
      "GST Rate (%)",
      "Taxable Value (Before Tax)",
      "CGST Amount",
      "SGST Amount",
      "IGST Amount",
      "Total GST Amount",
      "Grand Total (Gross Purchases)",
    ];

    const rows = billsToExport.map((bill) => {
      const d = bill.data as any;
      const isCancelled = d?.status === "cancelled";
      const cancelReason = isCancelled ? d?.cancellationReason || "Cancelled" : "";
      const billedBy = d?.billedBy || "Admin";
      const paymentModeVal = d?.paymentMode || "Cash";
      const supplierState = d?.supplierState || "33";
      const taxableValue = d?.taxableValue || 0;
      const cgst = d?.cgst || 0;
      const sgst = d?.sgst || 0;
      const igst = d?.igst || 0;
      const totalGst = cgst + sgst + igst;

      return [
        bill.invoice_no,
        bill.invoice_date,
        isCancelled ? "CANCELLED" : "ACTIVE",
        cancelReason,
        billedBy,
        paymentModeVal,
        bill.billed_name,
        bill.billed_gstin || "",
        supplierState,
        bill.gst_rate || 0,
        taxableValue,
        cgst,
        sgst,
        igst,
        totalGst,
        bill.grand_total,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val);
            if (str.includes(",") || str.includes("\n") || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const monthLabel =
      selectedMonth === "all" ? "All_Months" : formatMonthYear(selectedMonth).replace(" ", "_");
    link.href = url;
    link.setAttribute("download", `AG_Traders_Purchases_Report_${monthLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Purchases report downloaded successfully!");
  };

  const filteredCustomProducts = customProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
      p.hsn.toLowerCase().includes(prodSearch.toLowerCase()),
  );

  const filteredHistory = savedBills.filter((b) => {
    const isPurchase = b.data && (b.data as any).type === "purchase";
    const matchesMode = historyMode === "purchase" ? isPurchase : !isPurchase;

    const matchesSearch =
      b.invoice_no.toLowerCase().includes(historySearch.toLowerCase()) ||
      b.billed_name.toLowerCase().includes(historySearch.toLowerCase());
    let matchesMonth = true;
    if (selectedMonth !== "all") {
      if (b.invoice_date) {
        const dateOnly = b.invoice_date.split(" ")[0];
        const parts = dateOnly.split("/");
        matchesMonth = parts.length === 3 && `${parts[1]}/${parts[2]}` === selectedMonth;
      } else {
        matchesMonth = false;
      }
    }
    return matchesMode && matchesSearch && matchesMonth;
  });

  return (
    <>
      {/* Dedicated Print-only Container (positioned off-screen in screen mode, normal in print mode) */}
      <div id="invoice-print-container" className="print-only-container">
        <InvoicePreview key={`print-${settingsVer}`} data={data} />
      </div>

      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-foreground pb-12 screen-only">
        {/* Sticky Header with Controls */}
        <header className="no-print border-b bg-card shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Column 1: Shop details */}
            <div className="flex-1 flex justify-start min-w-[280px]">
              <div>
                <h1 className="text-xl font-black tracking-tight text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <Sliders className="h-6 w-6 text-brand" /> {shopName || "AG Traders"}
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Tuned Edition
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Namakkal · GST-Compliant Billing · Offline Catalog
                </p>
              </div>
            </div>

            {/* Column 2: Tab Buttons */}
            <div className="flex bg-muted/80 backdrop-blur-sm p-1 rounded-xl border shrink-0">
              <button
                onClick={() => setActiveTab("billing")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "billing"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> Billing
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "history"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="h-3.5 w-3.5" /> History
              </button>
              <button
                onClick={() => setActiveTab("products")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "products"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Package className="h-3.5 w-3.5" /> Product Manager
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Settings className="h-3.5 w-3.5" /> Shop Settings
              </button>
            </div>

            {/* Column 3: Staff and Actions */}
            <div className="flex-1 flex flex-wrap items-center justify-end gap-3 min-w-[200px]">
              {/* Staff Info and Logout */}
              {currentStaff ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] md:text-xs font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    👤 {currentStaff.name}
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-xs font-bold hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl h-8 px-2.5 transition-colors border"
                    onClick={() => {
                      setCurrentStaff(null);
                      setStaffPinInput("");
                      toast.success("Logged out successfully");
                    }}
                  >
                    Logout
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-xs font-bold hover:bg-blue-50 hover:text-blue-600 text-slate-600 hover:border-blue-300 rounded-xl h-8 px-2.5 transition-all border"
                    onClick={() => {
                      setPendingAuthAction(null);
                      setIsStaffLoginModalOpen(true);
                    }}
                  >
                    👤 Login Staff
                  </Button>
                </div>
              )}

              {/* Actions Panel */}
              {activeTab === "billing" && billingMode === "sale" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      runWithAuth(async () => {
                        toast.loading("Preparing PDF for WhatsApp...", { id: "wa" });
                        try {
                          const { blob, fileName } = await generatePdfBlob();
                          const msg = `AG TRADERS - Tax Invoice ${invoiceNo}\nDate: ${invoiceDate}\nBilled To: ${billedName}\nGrand Total: ₹${grand.toLocaleString("en-IN")}.00`;
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = fileName;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 2000);
                          window.open(
                            `https://wa.me/?text=${encodeURIComponent(msg + "\n\n(PDF downloaded — attach it in your chat)")}`,
                            "_blank",
                          );
                          toast.success("PDF downloaded. WhatsApp opened — attach the PDF.", {
                            id: "wa",
                          });
                        } catch (e: any) {
                          toast.error(`Share failed: ${e?.message ?? e}`, { id: "wa" });
                        }
                      })
                    }
                    size="sm"
                    variant="outline"
                    className="gap-1.5 bg-green-600 text-white hover:bg-green-700 hover:text-white border-green-700 font-bold"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                  <Button
                    onClick={() =>
                      runWithAuth(() => {
                        const subject = `Tax Invoice ${invoiceNo} - ${shopName.toUpperCase()}`;
                        const body = `Dear ${billedName},\n\nPlease find your invoice details below:\n\nInvoice No: ${invoiceNo}\nDate: ${invoiceDate}\nGrand Total: ₹${grand.toLocaleString("en-IN")}.00\n\nThank you,\n${shopName.toUpperCase()}`;
                        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      })
                    }
                    size="sm"
                    variant="outline"
                    className="gap-1.5 font-bold"
                  >
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Button>
                  <Button
                    onClick={() =>
                      runWithAuth(async () => {
                        toast.loading("Generating PDF...", { id: "pdf" });
                        try {
                          const { pdf, fileName } = await generatePdfBlob();
                          pdf.save(fileName);
                          toast.success("PDF downloaded", { id: "pdf" });
                        } catch (e: any) {
                          toast.error(`PDF failed: ${e?.message ?? e}`, { id: "pdf" });
                        }
                      })
                    }
                    size="sm"
                    variant="outline"
                    className="gap-1.5 font-bold"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Download PDF
                  </Button>
                  <Button
                    onClick={() =>
                      runWithAuth(async (activeStaff) => {
                        if (!billedName.trim()) {
                          toast.error("Billed Name is required to save!");
                          return;
                        }

                        const billPayload = {
                          invoice_no: invoiceNo,
                          invoice_date: invoiceDate,
                          billed_name: billedName,
                          billed_gstin: billedGstin || null,
                          grand_total: grand,
                          total_qty: items
                            .filter((i) => !isFinalAmountItem(i))
                            .reduce((s, i) => s + i.qty, 0),
                          gst_rate: gstRate,
                          same_state: sameState,
                          data: {
                            ...JSON.parse(JSON.stringify(data)),
                            billedBy: activeStaff.name,
                          },
                        };

                        toast.loading("Saving bill...", { id: "save" });

                        let savedOffline = false;
                        if (!navigator.onLine) {
                          saveOfflineBill(billPayload);
                          savedOffline = true;
                        } else {
                          try {
                            const { error } = await supabase.from("bills").insert(billPayload);
                            if (error) {
                              if (
                                error.message?.includes("fetch") ||
                                error.message?.includes("network")
                              ) {
                                saveOfflineBill(billPayload);
                                savedOffline = true;
                              } else {
                                toast.error(`Save failed: ${error.message}`, { id: "save" });
                                return;
                              }
                            }
                          } catch (e: any) {
                            saveOfflineBill(billPayload);
                            savedOffline = true;
                          }
                        }

                        // Common code for successful save (both online and offline)
                        saveCustomer({
                          name: billedName,
                          address: billedAddress,
                          gstin: billedGstin,
                          stateName: billedStateName,
                          stateCode: billedState,
                        });

                        const nextNo = incrementInvoiceNo(invoiceNo);
                        localStorage.setItem("ag_traders_last_invoice_no", invoiceNo); // Save current as last saved
                        setInvoiceNo(nextNo);
                        setBilledName("");
                        setBilledAddress("");
                        setBilledGstin("");
                        setShipSame(true);
                        setShippedName("");
                        setShippedAddress("");
                        setShippedGstin("");
                        setShippedStateName("");
                        setShippedState("");
                        setItems([]);
                        setPrevRefs([]);
                        setInvoiceDate(todayStr());
                        setIsDateEditable(false);
                        setPaymentMode("Credit");

                        if (savedOffline) {
                          toast.success(
                            `Offline! Saved locally. Will sync when internet is back.`,
                            { id: "save" },
                          );
                        } else {
                          toast.success(`Bill saved & Invoice #${nextNo} generated!`, {
                            id: "save",
                          });
                          syncOfflineBills(); // Run background sync to clear queue
                        }
                      })
                    }
                    size="sm"
                    variant="outline"
                    className="gap-1.5 font-bold bg-blue-600 text-white hover:bg-blue-700 hover:text-white border-blue-700"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Bill
                  </Button>
                  <Button
                    onClick={() => runWithAuth(() => window.print())}
                    size="sm"
                    className="gap-1.5 font-bold"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print Invoice
                  </Button>
                </div>
              )}

              {activeTab === "billing" && billingMode === "purchase" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => runWithAuth(handleSavePurchase)}
                    size="sm"
                    className="gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 rounded-xl shadow-sm"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Purchase Entry
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 mt-6">
          {/* Tab 1: Billing Dashboard */}
          {activeTab === "billing" && (
            <div className="space-y-6 print:block print:p-0">
              {/* Segmented Control Switcher */}
              <div className="no-print flex bg-muted/80 backdrop-blur-sm p-1 rounded-xl border max-w-md mx-auto shadow-sm">
                <button
                  onClick={() => setBillingMode("sale")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    billingMode === "sale"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Sales Invoice
                  (Outward)
                </button>
                <button
                  onClick={() => setBillingMode("purchase")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    billingMode === "purchase"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PackageOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />{" "}
                  Purchase Entry (Inward)
                </button>
              </div>

              {billingMode === "sale" ? (
                <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 print:block print:p-0 print:max-w-none print:gap-0">
                  {/* Editor Panel */}
                  <Card className="no-print p-6 space-y-6 shadow-md border-slate-100 bg-card rounded-2xl">
                    <section className="space-y-3">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                        <h2 className="font-bold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Invoice Information
                        </h2>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="font-semibold text-xs">Invoice No</Label>
                          <Input
                            className="mt-1"
                            value={invoiceNo}
                            onChange={(e) => setInvoiceNo(e.target.value)}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center">
                            <Label className="font-semibold text-xs">Date & Time</Label>
                            <button
                              type="button"
                              onClick={() => {
                                if (isDateEditable) {
                                  setIsDateEditable(false);
                                } else {
                                  const pw = prompt("Enter Admin Passkey:");
                                  if (pw === "WALKking&10NATRAJ") {
                                    setIsDateEditable(true);
                                    toast.success("Date & Time edit unlocked!");
                                  } else if (pw !== null) {
                                    toast.error("Invalid Passkey! Access Denied.");
                                  }
                                }
                              }}
                              className={`text-xs p-0.5 rounded transition-colors ${
                                isDateEditable
                                  ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-300"
                                  : "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"
                              }`}
                            >
                              {isDateEditable ? "🔒" : "🔓"}
                            </button>
                          </div>
                          <Input
                            className="mt-1 font-mono text-xs"
                            value={invoiceDate}
                            disabled={!isDateEditable}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="font-semibold text-xs">Transport Mode</Label>
                          <Input
                            className="mt-1"
                            value={transportMode}
                            onChange={(e) => setTransportMode(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="font-semibold text-xs">Vehicle No</Label>
                          <Input
                            className="mt-1"
                            value={vehicleNo}
                            placeholder="e.g. TN-33-AX-1234"
                            onChange={(e) => setVehicleNo(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="font-semibold text-xs">Payment Mode</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 mt-1 dark:bg-zinc-900"
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                          >
                            <option value="Credit">Credit</option>
                            <option value="Cash">Cash</option>
                            <option value="Account Transfer">Account Transfer</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                        <h2 className="font-bold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Details of Customer (Billed To)
                        </h2>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Customer Auto-complete Input */}
                        <div className="col-span-2 relative">
                          <Label className="font-semibold text-xs">Customer Name</Label>
                          <Input
                            className="mt-1"
                            placeholder="Start typing customer name to search..."
                            value={billedName}
                            onChange={(e) => {
                              setBilledName(e.target.value);
                              setShowCustSuggestions(true);
                            }}
                            onFocus={() => setShowCustSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowCustSuggestions(false), 200)}
                          />
                          {showCustSuggestions && billedName && (
                            <div className="absolute z-50 w-full bg-card border rounded-xl mt-1 shadow-xl max-h-52 overflow-y-auto divide-y">
                              {customers
                                .filter((c) =>
                                  c.name.toLowerCase().includes(billedName.toLowerCase()),
                                )
                                .map((c, idx) => (
                                  <div
                                    key={idx}
                                    className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer text-xs transition-colors"
                                    onMouseDown={() => {
                                      setBilledName(c.name);
                                      setBilledAddress(c.address);
                                      setBilledGstin(c.gstin);
                                      setBilledStateName(c.stateName);
                                      setBilledState(c.stateCode);
                                      setShowCustSuggestions(false);
                                      toast.info(`Auto-filled details for ${c.name}`);
                                    }}
                                  >
                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                      {c.name}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {c.address}
                                    </div>
                                    {c.gstin && (
                                      <div className="text-[9px] font-mono text-blue-600 mt-0.5">
                                        GSTIN: {c.gstin}
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        <div className="col-span-2">
                          <Label className="font-semibold text-xs">Address</Label>
                          <Textarea
                            className="mt-1"
                            rows={2}
                            value={billedAddress}
                            onChange={(e) => setBilledAddress(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="font-semibold text-xs">GSTIN</Label>
                          <Input
                            className="mt-1 font-mono uppercase"
                            placeholder="33XXXXX..."
                            value={billedGstin}
                            onChange={(e) => setBilledGstin(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="font-semibold text-xs">State</Label>
                            <Input
                              className="mt-1"
                              value={billedStateName}
                              onChange={(e) => setBilledStateName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="font-semibold text-xs">State Code</Label>
                            <Input
                              className="mt-1 font-mono"
                              value={billedState}
                              onChange={(e) => setBilledState(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="shipSame"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={shipSame}
                          onChange={(e) => setShipSame(e.target.checked)}
                        />
                        <Label
                          htmlFor="shipSame"
                          className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          Shipping address is same as billing address
                        </Label>
                      </div>

                      {!shipSame && (
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dashed">
                          <div className="col-span-2">
                            <Label className="font-semibold text-xs">
                              Consignee Name (Shipped To)
                            </Label>
                            <Input
                              className="mt-1"
                              value={shippedName}
                              onChange={(e) => setShippedName(e.target.value)}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="font-semibold text-xs">Shipping Address</Label>
                            <Textarea
                              className="mt-1"
                              rows={2}
                              value={shippedAddress}
                              onChange={(e) => setShippedAddress(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="font-semibold text-xs">Consignee GSTIN</Label>
                            <Input
                              className="mt-1 font-mono uppercase"
                              value={shippedGstin}
                              onChange={(e) => setShippedGstin(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="font-semibold text-xs">Shipping State</Label>
                              <Input
                                className="mt-1"
                                value={shippedStateName}
                                onChange={(e) => setShippedStateName(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="font-semibold text-xs">State Code</Label>
                              <Input
                                className="mt-1 font-mono"
                                value={shippedState}
                                onChange={(e) => setShippedState(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Line Items (Tax-Inclusive)
                          </h2>
                        </div>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={addItem}
                          className="gap-1 text-xs font-bold border-blue-600 text-blue-600 hover:bg-blue-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Item
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {items.length === 0 && (
                          <div className="text-center py-6 border border-dashed rounded-xl bg-slate-50 dark:bg-zinc-900">
                            <p className="text-xs text-muted-foreground font-semibold">
                              No items added yet. Click "Add Item" to start billing.
                            </p>
                          </div>
                        )}
                        {items.map((it) => (
                          <div
                            key={it.id}
                            className="grid grid-cols-12 gap-2 items-end border-b pb-3 border-dashed"
                          >
                            <div className="col-span-3">
                              <Label className="text-[10px] font-bold">Item Description</Label>
                              <Input
                                className="mt-1 h-8 text-xs font-medium"
                                list="product-list"
                                placeholder="Select tile or type..."
                                value={it.description}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const match = combinedProducts.find(
                                    (p) => p.name.toLowerCase() === val.toLowerCase(),
                                  );
                                  if (match) {
                                    updateItem(it.id, {
                                      description: match.name,
                                      hsn: match.hsn,
                                      unit: match.unit,
                                      rate: match.rate,
                                      qty: match.hideMeta ? 1 : it.qty || 1,
                                      taxMode: match.taxMode ?? "inclusive",
                                      hideMeta: match.hideMeta ?? false,
                                    });
                                  } else {
                                    updateItem(it.id, {
                                      description: val,
                                      taxMode: "inclusive",
                                      hideMeta: false,
                                    });
                                  }
                                }}
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px] font-bold">HSN</Label>
                              <Input
                                className="mt-1 h-8 text-xs text-center font-mono"
                                value={it.hsn}
                                placeholder={it.hideMeta ? "-" : "HSN"}
                                disabled={it.hideMeta}
                                onChange={(e) => updateItem(it.id, { hsn: e.target.value })}
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px] font-bold">Quantity</Label>
                              <Input
                                className="mt-1 h-8 text-xs text-center font-medium"
                                type="number"
                                value={it.qty}
                                placeholder={it.hideMeta ? "-" : "Qty"}
                                disabled={it.hideMeta}
                                onChange={(e) => updateItem(it.id, { qty: +e.target.value })}
                              />
                            </div>
                            <div className="col-span-1">
                              <Label className="text-[10px] font-bold">Unit</Label>
                              <Input
                                className="mt-1 h-8 text-xs text-center"
                                value={it.unit}
                                placeholder={it.hideMeta ? "-" : "Boxes"}
                                disabled={it.hideMeta}
                                onChange={(e) => updateItem(it.id, { unit: e.target.value })}
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px] font-bold">
                                {it.taxMode === "final" ? "Final Amt" : "Rate(incl)"}
                              </Label>
                              <Input
                                className="mt-1 h-8 text-xs text-right font-medium"
                                type="number"
                                value={it.rate}
                                onChange={(e) => updateItem(it.id, { rate: +e.target.value })}
                              />
                            </div>
                            <div className="col-span-1 text-right text-xs font-bold pb-2 pr-1 text-slate-800 dark:text-slate-200">
                              {(it.qty * it.rate).toFixed(0)}
                            </div>
                            <div className="col-span-1 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-50 text-red-500"
                                onClick={() => removeItem(it.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <datalist id="product-list">
                          {combinedProducts.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.rate > 0 ? `₹${p.rate} / ${p.unit}` : ""}
                            </option>
                          ))}
                        </datalist>
                      </div>
                    </section>

                    <section className="space-y-3 border-t pt-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Previous Bills Adjusted (DR/CR)
                          </h2>
                        </div>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={addRef}
                          className="gap-1 text-xs font-bold border-blue-600 text-blue-600 hover:bg-blue-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Ref
                        </Button>
                      </div>
                      {prevRefs.map((r, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-4">
                            <Label className="text-[10px] font-bold">Previous Bill Ref No</Label>
                            <Input
                              className="mt-1 h-8 text-xs"
                              value={r.refNo}
                              placeholder="e.g. Inv 002"
                              onChange={(e) => updateRef(idx, { refNo: e.target.value })}
                            />
                          </div>
                          <div className="col-span-4">
                            <Label className="text-[10px] font-bold">Adjustment Amount</Label>
                            <Input
                              className="mt-1 h-8 text-xs"
                              type="number"
                              value={r.amount}
                              onChange={(e) => updateRef(idx, { amount: +e.target.value })}
                            />
                          </div>
                          <div className="col-span-3">
                            <Label className="text-[10px] font-bold">Adjustment Type</Label>
                            <select
                              className="h-8 w-full rounded-md border bg-transparent px-2 text-xs mt-1 font-semibold"
                              value={r.type}
                              onChange={(e) =>
                                updateRef(idx, { type: e.target.value as "Dr" | "Cr" })
                              }
                            >
                              <option value="Dr">Debit (Add to Bill)</option>
                              <option value="Cr">Credit (Subtract)</option>
                            </select>
                          </div>
                          <div className="col-span-1 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-red-50 text-red-500"
                              onClick={() => removeRef(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {prevRefs.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          No adjustments adjusted on this invoice.
                        </p>
                      )}
                    </section>

                    <section className="space-y-4 border-t pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="font-semibold text-xs">Standard GST Rate (%)</Label>
                          <Input
                            className="mt-1 font-bold"
                            type="number"
                            value={gstRate}
                            onChange={(e) => setGstRate(+e.target.value)}
                          />
                        </div>
                        <div className="flex items-end pb-1.5">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              checked={sameState}
                              onChange={(e) => setSameState(e.target.checked)}
                            />
                            Intra-state Billing (CGST + SGST)
                          </label>
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-100 dark:bg-zinc-900 p-4 space-y-2 text-xs shadow-inner">
                        <div className="flex justify-between font-medium text-muted-foreground">
                          <span>Taxable Base Value</span>
                          <span>
                            ₹{" "}
                            {base.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between font-medium text-muted-foreground">
                          <span>GST Tax ({gstRate}%)</span>
                          <span>
                            ₹{" "}
                            {tax.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200 dark:border-zinc-800 text-blue-700 dark:text-blue-400">
                          <span>Grand Total Invoice Amount</span>
                          <span>₹ {grand.toLocaleString("en-IN")}.00</span>
                        </div>
                      </div>
                    </section>
                  </Card>

                  {/* Live Invoice Preview Panel */}
                  <div className="no-print flex flex-col items-center w-full">
                    <div className="bg-slate-200 dark:bg-zinc-800 px-4 py-2 w-full flex justify-between items-center rounded-t-xl border border-b-0 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
                      <span>INVOICE PDF PRINT PREVIEW</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px]">
                        A4 Format
                      </span>
                    </div>
                    <div
                      ref={setPreviewContainerRef}
                      className="w-full relative overflow-hidden bg-slate-100 dark:bg-zinc-900 border rounded-b-xl flex justify-center"
                      style={{ height: `${1123 * previewScale}px` }}
                    >
                      <div
                        className="absolute origin-top"
                        style={{
                          transform: `scale(${previewScale})`,
                          width: "210mm",
                          transformOrigin: "top center",
                          left: "50%",
                          marginLeft: "-397px", // half of 794px (210mm)
                        }}
                      >
                        <InvoicePreview key={`screen-${settingsVer}`} data={data} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Purchase Summary entry card */
                <div className="max-w-2xl mx-auto no-print space-y-6">
                  <Card className="p-6 space-y-6 shadow-md border-slate-100 bg-card rounded-2xl">
                    <div className="flex items-center gap-3 border-b pb-4">
                      <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <PackageOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                          New Purchase Invoice Entry
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                          Record incoming raw inventory summaries for GST ledger
                        </p>
                      </div>
                    </div>

                    {/* Supplier Info Section */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-600"></div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Supplier Information
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 relative">
                          <Label className="font-semibold text-xs">Supplier / Vendor Name</Label>
                          <Input
                            className="mt-1"
                            placeholder="Type supplier name..."
                            value={purchaseSupplierName}
                            onChange={(e) => {
                              setPurchaseSupplierName(e.target.value);
                              setShowSupplierSuggestions(true);
                            }}
                            onFocus={() => setShowSupplierSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                          />
                          {showSupplierSuggestions && purchaseSupplierName && (
                            <div className="absolute z-50 w-full bg-card border rounded-xl mt-1 shadow-xl max-h-52 overflow-y-auto divide-y">
                              {suppliers
                                .filter((s) =>
                                  s.name.toLowerCase().includes(purchaseSupplierName.toLowerCase()),
                                )
                                .map((s, idx) => (
                                  <div
                                    key={idx}
                                    className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer text-xs transition-colors"
                                    onMouseDown={() => {
                                      setPurchaseSupplierName(s.name);
                                      setPurchaseSupplierGstin(s.gstin || "");
                                      setPurchaseSupplierStateName(s.stateName || "Tamil Nadu");
                                      setPurchaseSupplierState(s.stateCode || "33");
                                      setPurchaseSupplierAddress(s.address || "");
                                      setShowSupplierSuggestions(false);
                                      toast.info(`Auto-filled details for ${s.name}`);
                                    }}
                                  >
                                    <div className="font-bold text-slate-800 dark:text-slate-200">
                                      {s.name}
                                    </div>
                                    {s.gstin && (
                                      <div className="text-[9px] font-mono text-blue-600 mt-0.5">
                                        GSTIN: {s.gstin}
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label className="font-semibold text-xs">Supplier GSTIN</Label>
                          <Input
                            className="mt-1 font-mono uppercase"
                            placeholder="e.g. 33AADCK5381Q1Z1"
                            value={purchaseSupplierGstin}
                            onChange={(e) => setPurchaseSupplierGstin(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="font-semibold text-xs">State</Label>
                            <Input
                              className="mt-1"
                              value={purchaseSupplierStateName}
                              onChange={(e) => setPurchaseSupplierStateName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="font-semibold text-xs">State Code</Label>
                            <Input
                              className="mt-1 font-mono"
                              value={purchaseSupplierState}
                              onChange={(e) => setPurchaseSupplierState(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="col-span-2">
                          <Label className="font-semibold text-xs">Supplier Address</Label>
                          <Textarea
                            className="mt-1 resize-none"
                            placeholder="e.g. 123 Street, Industrial Area, Chennai"
                            rows={2}
                            value={purchaseSupplierAddress}
                            onChange={(e) => setPurchaseSupplierAddress(e.target.value)}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Invoice Details Section */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-600"></div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Invoice Details
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="font-semibold text-xs">Supplier Invoice No</Label>
                          <Input
                            className="mt-1"
                            placeholder="e.g. SM-SI 5325"
                            value={purchaseInvoiceNo}
                            onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                          />
                        </div>

                        <div>
                          <Label className="font-semibold text-xs">Date & Time</Label>
                          <Input
                            className="mt-1 font-mono text-xs"
                            value={purchaseDate}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Financial Breakdown Section */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-600"></div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Financial Breakdown
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="font-semibold text-xs">
                            Taxable Subtotal (Before GST)
                          </Label>
                          <Input
                            type="number"
                            className="mt-1 font-bold text-slate-800 dark:text-slate-100"
                            placeholder="e.g. 10000"
                            value={purchaseSubtotal}
                            onChange={(e) =>
                              setPurchaseSubtotal(
                                e.target.value === "" ? "" : Number(e.target.value),
                              )
                            }
                          />
                        </div>

                        <div>
                          <Label className="font-semibold text-xs">Standard GST Rate (%)</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors mt-1 dark:bg-zinc-900 font-bold"
                            value={purchaseGstRate}
                            onChange={(e) => setPurchaseGstRate(Number(e.target.value))}
                          >
                            <option value={18}>18% (Standard)</option>
                            <option value={12}>12%</option>
                            <option value={28}>28%</option>
                            <option value={5}>5%</option>
                            <option value={0}>0% / Exempt</option>
                          </select>
                        </div>

                        {purchaseSupplierState === "33" ? (
                          <>
                            <div>
                              <Label className="font-semibold text-xs text-slate-500">
                                CGST Amount
                              </Label>
                              <Input
                                type="number"
                                className="mt-1 font-mono"
                                value={purchaseCgst}
                                onChange={(e) => setPurchaseCgst(Number(e.target.value) || 0)}
                              />
                            </div>
                            <div>
                              <Label className="font-semibold text-xs text-slate-500">
                                SGST Amount
                              </Label>
                              <Input
                                type="number"
                                className="mt-1 font-mono"
                                value={purchaseSgst}
                                onChange={(e) => setPurchaseSgst(Number(e.target.value) || 0)}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2">
                            <Label className="font-semibold text-xs text-slate-500">
                              IGST Amount
                            </Label>
                            <Input
                              type="number"
                              className="mt-1 font-mono"
                              value={purchaseIgst}
                              onChange={(e) => setPurchaseIgst(Number(e.target.value) || 0)}
                            />
                          </div>
                        )}

                        <div>
                          <Label className="font-semibold text-xs">Rounding (+/-)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="mt-1 font-mono text-slate-700 dark:text-slate-300"
                            placeholder="e.g. 0.04 or -0.45"
                            value={purchaseRounding}
                            onChange={(e) => setPurchaseRounding(Number(e.target.value) || 0)}
                          />
                        </div>

                        <div>
                          <Label className="font-semibold text-xs">Payment Mode</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors mt-1 dark:bg-zinc-900 font-semibold"
                            value={purchasePaymentMode}
                            onChange={(e) => setPurchasePaymentMode(e.target.value)}
                          >
                            <option value="Credit">Credit</option>
                            <option value="Cash">Cash</option>
                            <option value="Account Transfer">Account Transfer</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>
                      </div>

                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-2 text-xs border border-emerald-100 dark:border-emerald-900/30 shadow-inner">
                        <div className="flex justify-between font-bold text-base text-emerald-800 dark:text-emerald-400">
                          <span>Grand Total Invoice Amount</span>
                          <span>
                            ₹{" "}
                            {Math.round(
                              (Number(purchaseSubtotal) || 0) +
                                (purchaseSupplierState === "33"
                                  ? Number(purchaseCgst) + Number(purchaseSgst)
                                  : Number(purchaseIgst)) +
                                Number(purchaseRounding),
                            ).toLocaleString("en-IN")}
                            .00
                          </span>
                        </div>
                      </div>
                    </section>

                    <Button
                      onClick={() => runWithAuth(handleSavePurchase)}
                      className="w-full gap-1.5 font-bold h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/10 transition-all mt-4"
                    >
                      <Save className="h-5 w-5" /> Save Purchase Entry
                    </Button>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Invoice History Tab */}
          {activeTab === "history" && (
            <div className="space-y-6">
              {/* Sub-tab switcher inside History tab */}
              <div className="no-print flex border-b dark:border-zinc-800 gap-6 pb-2">
                <button
                  onClick={() => setHistoryMode("sale")}
                  className={`text-sm font-bold pb-2 border-b-2 transition-all cursor-pointer ${
                    historyMode === "sale"
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 font-extrabold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sales Registers (Outward)
                </button>
                <button
                  onClick={() => setHistoryMode("purchase")}
                  className={`text-sm font-bold pb-2 border-b-2 transition-all cursor-pointer ${
                    historyMode === "purchase"
                      ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-extrabold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Purchase Registers (Inward)
                </button>
              </div>

              {/* Business Analytics Dashboard Overview */}
              {historyMode === "sale" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-5 flex items-center justify-between shadow-sm bg-card border-slate-100 rounded-2xl">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        Total Bills Created
                      </p>
                      <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">
                        {historyStats.totalCount}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Stored securely in cloud database
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Briefcase className="h-6 w-6" />
                    </div>
                  </Card>

                  <Card className="p-5 flex items-center justify-between shadow-sm bg-card border-slate-100 rounded-2xl">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        Total Sales Turnover
                      </p>
                      <h3 className="text-3xl font-black text-green-600 dark:text-green-400 mt-1">
                        ₹{historyStats.totalRevenue.toLocaleString("en-IN")}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        GST tax inclusive gross sales
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </Card>

                  <Card className="p-5 flex items-center justify-between shadow-sm bg-card border-slate-100 rounded-2xl">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        Total Tile Qty Billed
                      </p>
                      <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">
                        {historyStats.totalQtySold}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Total product boxes / items sold
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                  </Card>

                  <Card className="p-5 flex items-center justify-between shadow-sm bg-card border-slate-100 rounded-2xl">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        Total GST Collected
                      </p>
                      <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                        ₹{historyStats.totalGstCollected.toLocaleString("en-IN")}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Total sales CGST + SGST + IGST collected
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-5 flex items-center justify-between shadow-sm bg-card border-slate-100 rounded-2xl">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        Total Purchase Entries
                      </p>
                      <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">
                        {historyStats.totalCount}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Stored securely in cloud database
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Briefcase className="h-6 w-6" />
                    </div>
                  </Card>

                  <Card className="p-5 flex items-center justify-between shadow-sm bg-card border-slate-100 rounded-2xl">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        Total Purchase Value
                      </p>
                      <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        ₹{historyStats.totalRevenue.toLocaleString("en-IN")}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        GST tax inclusive gross purchases
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                  </Card>

                  <Card className="p-5 flex items-center justify-between shadow-sm bg-card border-slate-100 rounded-2xl">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        Total GST Input Tax Paid
                      </p>
                      <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                        ₹{historyStats.totalGstPaid.toLocaleString("en-IN")}
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Total CGST + SGST + IGST paid
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                  </Card>
                </div>
              )}

              {/* List Table Card */}
              <Card className="p-6 shadow-md border-slate-100 rounded-2xl bg-card">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                      {historyMode === "sale" ? "Saved Invoices" : "Saved Purchases"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {historyMode === "sale"
                        ? "Search, filter by month, or download sales registers for auditor"
                        : "Search, filter by month, or download purchase registers for auditor"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={
                          historyMode === "sale"
                            ? "Search by invoice no or name..."
                            : "Search by supplier invoice or name..."
                        }
                        className="pl-9 h-9 text-xs"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                      />
                    </div>
                    <select
                      className="h-9 rounded-md border bg-background px-3 py-1 text-xs font-semibold shadow-sm w-full sm:w-44 focus:outline-none"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                      <option value="all">All Months</option>
                      {availableMonths.map((my) => (
                        <option key={my} value={my}>
                          {formatMonthYear(my)}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={
                        historyMode === "purchase" ? handleExportPurchaseCSV : handleExportCSV
                      }
                      size="sm"
                      className="gap-1.5 font-bold h-9 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Download className="h-3.5 w-3.5" /> Export to Excel
                    </Button>
                  </div>
                </div>

                {loadingBills ? (
                  <div className="text-center py-12">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full mb-2"></div>
                    <p className="text-xs text-muted-foreground font-semibold">
                      Connecting to database...
                    </p>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-12 border border-dashed rounded-2xl bg-slate-50 dark:bg-zinc-900">
                    <History className="mx-auto h-12 w-12 text-slate-400 mb-2" />
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">
                      {historyMode === "sale" ? "No invoices found" : "No purchases found"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {historyMode === "sale"
                        ? "Try searching with a different name or create a new bill."
                        : "Try searching with a different name or save a new purchase entry."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full divide-y text-left">
                      <thead className="bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                        {historyMode === "sale" ? (
                          <tr>
                            <th className="px-6 py-3">Invoice No</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Customer Name</th>
                            <th className="px-6 py-3 text-center">Billed By</th>
                            <th className="px-6 py-3 text-center">GST Rate</th>
                            <th className="px-6 py-3 text-center">Total Qty</th>
                            <th className="px-6 py-3 text-right">Grand Total</th>
                            <th className="px-6 py-3 text-center">Actions</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="px-6 py-3">Supplier Invoice No</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Supplier Name</th>
                            <th className="px-6 py-3 text-center">Billed By</th>
                            <th className="px-6 py-3 text-center">Taxable Value</th>
                            <th className="px-6 py-3 text-center">GST Paid</th>
                            <th className="px-6 py-3 text-right">Grand Total</th>
                            <th className="px-6 py-3 text-center">Actions</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y text-xs font-medium text-slate-800 dark:text-slate-200">
                        {filteredHistory.map((bill) => {
                          const isCancelled =
                            bill.data && (bill.data as any).status === "cancelled";
                          const cancelReason = isCancelled
                            ? (bill.data as any).cancellationReason
                            : "";
                          const paymentModeVal = (bill.data as any)?.paymentMode || "Cash";

                          if (historyMode === "sale") {
                            return (
                              <tr
                                key={bill.id}
                                className={`hover:bg-slate-50/85 dark:hover:bg-zinc-800/80 transition-colors ${isCancelled ? "opacity-60 bg-red-50/10" : ""}`}
                              >
                                <td className="px-6 py-4 font-bold text-blue-700 dark:text-blue-400">
                                  #{bill.invoice_no}
                                  {isCancelled && (
                                    <span className="ml-2 text-[9px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded font-black">
                                      CANCELLED
                                    </span>
                                  )}
                                  {bill.data && (bill.data as any).isOffline && (
                                    <span className="ml-2 text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded font-black animate-pulse">
                                      PENDING SYNC
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 font-mono">{bill.invoice_date}</td>
                                <td className="px-6 py-4">
                                  <div className="font-bold">{bill.billed_name}</div>
                                  <div className="flex gap-1.5 mt-1">
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-black border uppercase tracking-wide ${
                                        paymentModeVal === "Credit"
                                          ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30"
                                          : paymentModeVal === "Account Transfer"
                                            ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30"
                                            : paymentModeVal === "Cheque"
                                              ? "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/30"
                                              : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30"
                                      }`}
                                    >
                                      {paymentModeVal}
                                    </span>
                                  </div>
                                  {isCancelled && (
                                    <div className="text-[10px] text-red-500 font-medium italic mt-1.5">
                                      Reason: {cancelReason}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-400">
                                  {(bill.data as any)?.billedBy || "Admin"}
                                </td>
                                <td className="px-6 py-4 text-center font-mono">
                                  {bill.gst_rate}%
                                </td>
                                <td className="px-6 py-4 text-center font-mono">
                                  {bill.total_qty}
                                </td>
                                <td className="px-6 py-4 text-right font-bold">
                                  ₹{bill.grand_total.toLocaleString("en-IN")}.00
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex justify-center gap-2">
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      className="gap-1 font-bold"
                                      onClick={() => handleReprint(bill)}
                                    >
                                      <Edit3 className="h-3 w-3" />{" "}
                                      {isCancelled ? "View Details" : "Edit / Reprint"}
                                    </Button>
                                    {!isCancelled ? (
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        className="hover:bg-red-50 text-red-600 border-red-200"
                                        onClick={() => handleCancelBill(bill)}
                                      >
                                        <X className="h-3 w-3" /> Cancel Bill
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic font-semibold px-2">
                                        Cancelled
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          } else {
                            // Purchase Row Details
                            const d = bill.data as any;
                            const taxableValue = d?.taxableValue || 0;
                            const cgst = d?.cgst || 0;
                            const sgst = d?.sgst || 0;
                            const igst = d?.igst || 0;
                            const gstPaid = cgst + sgst + igst;

                            return (
                              <tr
                                key={bill.id}
                                className={`hover:bg-slate-50/85 dark:hover:bg-zinc-800/80 transition-colors ${isCancelled ? "opacity-60 bg-red-50/10" : ""}`}
                              >
                                <td className="px-6 py-4 font-bold text-emerald-700 dark:text-emerald-400">
                                  #{bill.invoice_no}
                                  {isCancelled && (
                                    <span className="ml-2 text-[9px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded font-black">
                                      CANCELLED
                                    </span>
                                  )}
                                  {bill.data && (bill.data as any).isOffline && (
                                    <span className="ml-2 text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded font-black animate-pulse">
                                      PENDING SYNC
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 font-mono">{bill.invoice_date}</td>
                                <td className="px-6 py-4">
                                  <div className="font-bold">{bill.billed_name}</div>
                                  <div className="flex gap-1.5 mt-1">
                                    <span
                                      className={`text-[9px] px-1.5 py-0.5 rounded font-black border uppercase tracking-wide ${
                                        paymentModeVal === "Credit"
                                          ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30"
                                          : paymentModeVal === "Account Transfer"
                                            ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30"
                                            : paymentModeVal === "Cheque"
                                              ? "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/30"
                                              : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30"
                                      }`}
                                    >
                                      {paymentModeVal}
                                    </span>
                                  </div>
                                  {isCancelled && (
                                    <div className="text-[10px] text-red-500 font-medium italic mt-1.5">
                                      Reason: {cancelReason}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-400">
                                  {d?.billedBy || "Admin"}
                                </td>
                                <td className="px-6 py-4 text-center font-mono">
                                  ₹{taxableValue.toLocaleString("en-IN")}
                                </td>
                                <td className="px-6 py-4 text-center font-mono">
                                  ₹{gstPaid.toLocaleString("en-IN")}
                                  <span className="text-[9px] text-muted-foreground block">
                                    {igst > 0
                                      ? `IGST ${bill.gst_rate}%`
                                      : `CGST+SGST ${bill.gst_rate}%`}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right font-bold">
                                  ₹{bill.grand_total.toLocaleString("en-IN")}.00
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex justify-center gap-2">
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      className="gap-1 font-bold"
                                      onClick={() => setSelectedPurchaseDetails(bill)}
                                    >
                                      <FileText className="h-3 w-3" /> View Details
                                    </Button>
                                    {!isCancelled ? (
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        className="hover:bg-red-50 text-red-600 border-red-200"
                                        onClick={() => handleCancelBill(bill)}
                                      >
                                        <X className="h-3 w-3" /> Cancel Entry
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic font-semibold px-2">
                                        Cancelled
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Tab 3: Product Manager Tab */}
          {activeTab === "products" && (
            <div className="grid md:grid-cols-[0.8fr_1.2fr] gap-6">
              {/* Add product card */}
              <Card className="p-6 shadow-md border-slate-100 rounded-2xl bg-card space-y-4 h-fit">
                <div>
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                    Add Product to Catalog
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saved items will autocomplete in the Invoice Editor
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="font-semibold text-xs">Product Name / Description</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. HG IMPALA BLACK 48X24"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="font-semibold text-xs">HSN Code</Label>
                    <Input
                      className="mt-1 font-mono"
                      placeholder="e.g. 69072100"
                      value={newProdHsn}
                      onChange={(e) => setNewProdHsn(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="font-semibold text-xs">Billing Unit</Label>
                      <Input
                        className="mt-1"
                        placeholder="e.g. Boxes, PCS, Sq.Ft"
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="font-semibold text-xs">Unit Rate (GST Incl.)</Label>
                      <Input
                        className="mt-1"
                        type="number"
                        placeholder="0.00"
                        value={newProdRate || ""}
                        onChange={(e) => setNewProdRate(+e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-dashed">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="newProdTaxMode"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={newProdTaxMode === "final"}
                        onChange={(e) =>
                          newProdTaxMode === "final"
                            ? setNewProdTaxMode("inclusive")
                            : setNewProdTaxMode("final")
                        }
                      />
                      <Label
                        htmlFor="newProdTaxMode"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Tax-Exempt (Final Amount mode like Loading/Unloading)
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="newProdHideMeta"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={newProdHideMeta}
                        onChange={(e) => setNewProdHideMeta(e.target.checked)}
                      />
                      <Label
                        htmlFor="newProdHideMeta"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Hide HSN and Quantity in printed invoice rows
                      </Label>
                    </div>
                  </div>

                  <Button
                    className="w-full gap-1.5 font-bold mt-2 bg-blue-600 hover:bg-blue-700"
                    onClick={handleAddProduct}
                  >
                    <Plus className="h-4 w-4" /> Save Product to Catalog
                  </Button>
                </div>
              </Card>

              {/* Products catalog list card */}
              <Card className="p-6 shadow-md border-slate-100 rounded-2xl bg-card space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b pb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                      Catalog Database ({combinedProducts.length} Items)
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Includes default library and your custom entries
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search product catalog..."
                      className="pl-9 h-9 text-xs"
                      value={prodSearch}
                      onChange={(e) => setProdSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[500px] rounded-xl border">
                  <table className="min-w-full divide-y text-left">
                    <thead className="bg-slate-50 dark:bg-zinc-800 text-xs font-bold text-slate-600 dark:text-slate-300 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2.5">Product Name</th>
                        <th className="px-4 py-2.5 text-center">HSN</th>
                        <th className="px-4 py-2.5 text-center">Unit</th>
                        <th className="px-4 py-2.5 text-right">Rate (Incl)</th>
                        <th className="px-4 py-2.5 text-center">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {filteredCustomProducts.map((p) => (
                        <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                          <td className="px-4 py-3 font-bold text-blue-700 dark:text-blue-400">
                            {p.name}
                          </td>
                          <td className="px-4 py-3 text-center font-mono">{p.hsn || "-"}</td>
                          <td className="px-4 py-3 text-center">{p.unit}</td>
                          <td className="px-4 py-3 text-right font-bold">₹ {p.rate.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded font-bold">
                                Custom
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:bg-red-50"
                                onClick={() => handleDeleteCustomProduct(p.name)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {PRODUCTS.filter(
                        (p) =>
                          (p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
                            p.hsn.toLowerCase().includes(prodSearch.toLowerCase())) &&
                          !customProducts.some(
                            (cp) => cp.name.toLowerCase() === p.name.toLowerCase(),
                          ),
                      ).map((p) => (
                        <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{p.name}</td>
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {p.hsn || "-"}
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {p.unit || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            ₹ {p.rate.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400 text-[10px] px-2 py-0.5 rounded font-medium">
                              Standard
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* Tab 4: Shop Settings Tab */}
          {activeTab === "settings" &&
            (!isSettingsUnlocked ? (
              <div className="max-w-md mx-auto mt-12 px-4 w-full">
                <Card className="p-6 shadow-xl border-slate-100 dark:border-zinc-800 rounded-2xl bg-card text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Sliders className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                      Shop Settings Locked
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please enter the admin passkey to view and modify firm details, bank
                      information, and print settings.
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    <Input
                      type="password"
                      placeholder="Enter admin passkey..."
                      className="text-center font-mono text-sm h-10"
                      value={settingsPasskeyInput}
                      onChange={(e) => setSettingsPasskeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUnlockSettings();
                        }
                      }}
                    />
                    <Button
                      onClick={handleUnlockSettings}
                      className="w-full font-bold bg-blue-600 hover:bg-blue-700 h-10"
                    >
                      Unlock Settings
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5">
                    <Sliders className="h-4 w-4" /> Admin Access Granted. You can edit settings now.
                  </p>
                  <Button
                    size="xs"
                    variant="outline"
                    className="font-bold border-blue-200 text-blue-700 hover:bg-blue-100/50 dark:border-blue-800 dark:text-blue-400"
                    onClick={() => {
                      setIsSettingsUnlocked(false);
                      setSettingsPasskeyInput("");
                    }}
                  >
                    Lock Settings
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* General Info Card */}
                  <Card className="p-6 shadow-md border-slate-100 rounded-2xl bg-card space-y-4">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                        Business Details Settings
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Customize invoice header, contact, and bank parameters
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="font-semibold text-xs">Firm / Shop Name</Label>
                        <Input
                          className="mt-1 font-bold"
                          value={shopName}
                          onChange={(e) => setShopName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="font-semibold text-xs">GSTIN</Label>
                        <Input
                          className="mt-1 font-mono uppercase"
                          value={shopGstin}
                          onChange={(e) => setShopGstin(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="font-semibold text-xs">Mobile Number</Label>
                          <Input
                            className="mt-1"
                            value={shopMobile}
                            onChange={(e) => setShopMobile(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="font-semibold text-xs">Email ID</Label>
                          <Input
                            className="mt-1"
                            type="email"
                            value={shopEmail}
                            onChange={(e) => setShopEmail(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="font-semibold text-xs">
                          Business Address (One line per row)
                        </Label>
                        <Textarea
                          className="mt-1 text-xs"
                          rows={4}
                          value={shopAddress}
                          onChange={(e) => setShopAddress(e.target.value)}
                        />
                      </div>

                      <div className="border-t border-dashed pt-3 space-y-3">
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Bank Details for Payments
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="font-semibold text-xs">Bank Name</Label>
                            <Input
                              className="mt-1 text-xs"
                              value={shopBankName}
                              onChange={(e) => setShopBankName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="font-semibold text-xs">Account Number</Label>
                            <Input
                              className="mt-1 font-mono text-xs"
                              value={shopBankAcc}
                              onChange={(e) => setShopBankAcc(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="font-semibold text-xs">Branch Name</Label>
                            <Input
                              className="mt-1 text-xs"
                              value={shopBankBranch}
                              onChange={(e) => setShopBankBranch(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="font-semibold text-xs">IFSC Code</Label>
                            <Input
                              className="mt-1 font-mono text-xs"
                              value={shopBankIfsc}
                              onChange={(e) => setShopBankIfsc(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Logo and QR Uploads Card */}
                  <div className="space-y-6">
                    <Card className="p-6 shadow-md border-slate-100 rounded-2xl bg-card space-y-6">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                          Logo & QR Graphics
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Upload visual components to print directly on bills
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="font-bold text-xs">Firm Logo Graphic</Label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              id="shopShowLogo"
                              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              checked={shopShowLogo}
                              onChange={(e) => setShopShowLogo(e.target.checked)}
                            />
                            <Label
                              htmlFor="shopShowLogo"
                              className="text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                            >
                              Show on Invoice
                            </Label>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-16 w-20 border rounded-xl flex items-center justify-center bg-slate-50 dark:bg-zinc-900 overflow-hidden relative group">
                            {shopLogoBase64 ? (
                              <img
                                src={shopLogoBase64}
                                alt="Shop Logo"
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <Upload className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              id="logo-upload"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, "logo")}
                            />
                            <label htmlFor="logo-upload">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 cursor-pointer font-bold text-xs"
                                asChild
                              >
                                <span>
                                  <Upload className="h-3.5 w-3.5" /> Select Logo Image
                                </span>
                              </Button>
                            </label>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Accepts PNG or JPG format
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 border-t pt-4 border-dashed">
                        <div className="flex justify-between items-center">
                          <Label className="font-bold text-xs">UPI QR Payment Graphic</Label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              id="shopShowQr"
                              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              checked={shopShowQr}
                              onChange={(e) => setShopShowQr(e.target.checked)}
                            />
                            <Label
                              htmlFor="shopShowQr"
                              className="text-[10px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                            >
                              Show on Invoice
                            </Label>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-16 w-20 border rounded-xl flex items-center justify-center bg-slate-50 dark:bg-zinc-900 overflow-hidden relative">
                            {shopUpiQrBase64 ? (
                              <img
                                src={shopUpiQrBase64}
                                alt="UPI QR"
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-[8px] font-bold text-muted-foreground text-center px-1">
                                Default QR
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              id="qr-upload"
                              className="hidden"
                              onChange={(e) => handleFileChange(e, "qr")}
                            />
                            <label htmlFor="qr-upload">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 cursor-pointer font-bold text-xs"
                                asChild
                              >
                                <span>
                                  <Upload className="h-3.5 w-3.5" /> Select QR Image
                                </span>
                              </Button>
                            </label>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Upload your GPay/PhonePe UPI code
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {/* Staff Accounts Management Card */}
                    <Card className="p-6 shadow-md border-slate-100 dark:border-zinc-800 rounded-2xl bg-card space-y-4">
                      <div>
                        <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                          Staff Accounts Settings
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Add, modify, or delete staff members and their 4-digit PINs
                        </p>
                      </div>
                      <div className="space-y-3 p-4 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-dashed">
                        <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                          Add New Staff Account
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] font-semibold">Staff Name</Label>
                            <Input
                              className="mt-1 h-8 text-xs"
                              placeholder="e.g. Ramesh"
                              value={newStaffName}
                              onChange={(e) => setNewStaffName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-semibold">4-Digit PIN</Label>
                            <Input
                              className="mt-1 h-8 text-xs font-mono text-center"
                              placeholder="e.g. 1234"
                              maxLength={4}
                              value={newStaffPin}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (/^\d*$/.test(v) && v.length <= 4) setNewStaffPin(v);
                              }}
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleAddStaff}
                          size="sm"
                          className="w-full gap-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 h-8 mt-1"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Staff Account
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                          Existing Staff Accounts
                        </h3>
                        <div className="divide-y max-h-56 overflow-y-auto border rounded-xl bg-card">
                          {staffList.map((s) => (
                            <div
                              key={s.name}
                              className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  👤 {s.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  PIN: •••• ({s.pin})
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:bg-red-50"
                                onClick={() => handleDeleteStaff(s.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {staffList.length === 0 && (
                            <p className="text-xs text-muted-foreground italic p-4 text-center">
                              No staff accounts configured.
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
                <Button
                  className="w-full gap-1.5 font-bold bg-blue-600 hover:bg-blue-700 mt-6"
                  size="lg"
                  onClick={handleSaveSettings}
                >
                  <Check className="h-5 w-5" /> Save Shop Settings & Apply
                </Button>
              </div>
            ))}
        </main>

        {/* Staff Login Modal (triggered on-demand when saving/downloading/sharing without active staff) */}
        {isStaffLoginModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <Card className="max-w-md w-full p-6 shadow-2xl border-slate-100 dark:border-zinc-800 bg-card space-y-6 rounded-2xl relative">
              <button
                onClick={() => {
                  setIsStaffLoginModalOpen(false);
                  setPendingAuthAction(null);
                  setStaffPinInput("");
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Sliders className="h-6 w-6" />
                </div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Staff Passcode Verification
                </h2>
                <p className="text-xs text-muted-foreground">
                  Select your account and enter your 4-digit PIN to perform this action.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Select Account
                  </label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 py-1 text-sm font-semibold shadow-sm focus:outline-none mt-1"
                    value={selectedStaffLogin}
                    onChange={(e) => setSelectedStaffLogin(e.target.value)}
                  >
                    {staffList.map((s) => (
                      <option key={s.name} value={s.name}>
                        👤 {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    4-Digit Passcode PIN
                  </label>
                  <Input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    className="text-center font-mono text-lg h-10 tracking-widest mt-1"
                    value={staffPinInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val) && val.length <= 4) {
                        setStaffPinInput(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleStaffLogin();
                      }
                    }}
                  />
                </div>

                <Button
                  onClick={handleStaffLogin}
                  className="w-full font-bold bg-blue-600 hover:bg-blue-700 h-10 mt-2 rounded-xl"
                >
                  Confirm & Execute
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* View Purchase Details Modal */}
        {selectedPurchaseDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <Card className="max-w-xl w-full p-6 shadow-2xl border-slate-100 dark:border-zinc-800 bg-card space-y-6 rounded-2xl relative">
              <button
                onClick={() => setSelectedPurchaseDetails(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
              <div className="flex items-center gap-3 border-b pb-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                    Purchase Entry Details
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Invoice #{selectedPurchaseDetails.invoice_no}
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 border-b pb-3 border-dashed">
                  <div>
                    <span className="text-muted-foreground font-semibold block uppercase tracking-wider text-[10px]">
                      Supplier Name
                    </span>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {selectedPurchaseDetails.billed_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block uppercase tracking-wider text-[10px]">
                      Supplier GSTIN
                    </span>
                    <span className="font-mono font-bold text-sm uppercase text-slate-800 dark:text-slate-200">
                      {selectedPurchaseDetails.billed_gstin || "N/A"}
                    </span>
                  </div>
                </div>

                {(selectedPurchaseDetails.data as any)?.supplierAddress && (
                  <div className="border-b pb-3 border-dashed">
                    <span className="text-muted-foreground font-semibold block uppercase tracking-wider text-[10px]">
                      Supplier Address
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {(selectedPurchaseDetails.data as any).supplierAddress}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 border-b pb-3 border-dashed">
                  <div>
                    <span className="text-muted-foreground font-semibold block uppercase tracking-wider text-[10px]">
                      Invoice Date
                    </span>
                    <span className="font-medium">{selectedPurchaseDetails.invoice_date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block uppercase tracking-wider text-[10px]">
                      Billed By (Staff)
                    </span>
                    <span className="font-bold">
                      {(selectedPurchaseDetails.data as any)?.billedBy || "Admin"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold block uppercase tracking-wider text-[10px]">
                      Payment Mode
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {(selectedPurchaseDetails.data as any)?.paymentMode || "Cash"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-dashed">
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">Taxable Subtotal (Before GST)</span>
                    <span className="font-mono">
                      ₹
                      {((selectedPurchaseDetails.data as any)?.taxableValue || 0).toLocaleString(
                        "en-IN",
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                  </div>

                  {(selectedPurchaseDetails.data as any)?.supplierState === "33" ? (
                    <>
                      <div className="flex justify-between font-medium text-slate-600 dark:text-slate-400">
                        <span>CGST ({selectedPurchaseDetails.gst_rate / 2}%)</span>
                        <span className="font-mono">
                          ₹
                          {((selectedPurchaseDetails.data as any)?.cgst || 0).toLocaleString(
                            "en-IN",
                            { minimumFractionDigits: 2 },
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium text-slate-600 dark:text-slate-400">
                        <span>SGST ({selectedPurchaseDetails.gst_rate / 2}%)</span>
                        <span className="font-mono">
                          ₹
                          {((selectedPurchaseDetails.data as any)?.sgst || 0).toLocaleString(
                            "en-IN",
                            { minimumFractionDigits: 2 },
                          )}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between font-medium text-slate-600 dark:text-slate-400">
                      <span>IGST ({selectedPurchaseDetails.gst_rate}%)</span>
                      <span className="font-mono">
                        ₹
                        {((selectedPurchaseDetails.data as any)?.igst || 0).toLocaleString(
                          "en-IN",
                          { minimumFractionDigits: 2 },
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-400 border-b border-dashed pb-2">
                    <span>Rounding Difference</span>
                    <span className="font-mono">
                      ₹{((selectedPurchaseDetails.data as any)?.rounding || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between font-black text-sm text-emerald-700 dark:text-emerald-400 pt-1">
                    <span>Grand Total (Net Amount Paid)</span>
                    <span className="font-mono">
                      ₹{selectedPurchaseDetails.grand_total.toLocaleString("en-IN")}.00
                    </span>
                  </div>
                </div>

                {(selectedPurchaseDetails.data as any)?.status === "cancelled" && (
                  <div className="p-3 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl text-red-700 dark:text-red-400 space-y-1">
                    <span className="font-bold text-[10px] uppercase block tracking-wide">
                      Cancellation Information
                    </span>
                    <p className="font-medium text-xs">
                      Reason: {(selectedPurchaseDetails.data as any)?.cancellationReason}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Cancelled on:{" "}
                      {new Date(
                        (selectedPurchaseDetails.data as any)?.cancelledAt,
                      ).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => setSelectedPurchaseDetails(null)}
                className="w-full font-bold bg-blue-600 hover:bg-blue-700 h-10 rounded-xl"
              >
                Close Details
              </Button>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
