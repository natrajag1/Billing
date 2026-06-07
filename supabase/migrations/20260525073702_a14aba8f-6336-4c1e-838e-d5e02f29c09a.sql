CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_no TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  billed_name TEXT NOT NULL,
  billed_gstin TEXT,
  grand_total NUMERIC NOT NULL,
  total_qty NUMERIC NOT NULL,
  gst_rate NUMERIC NOT NULL,
  same_state BOOLEAN NOT NULL DEFAULT true,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Anyone can insert bills" ON public.bills FOR INSERT WITH CHECK (true);

CREATE INDEX bills_created_at_idx ON public.bills (created_at DESC);
CREATE INDEX bills_invoice_no_idx ON public.bills (invoice_no);