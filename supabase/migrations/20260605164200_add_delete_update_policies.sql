-- Add DELETE and UPDATE policies to allow deleting and updating saved bills
CREATE POLICY "Anyone can delete bills" ON public.bills FOR DELETE USING (true);
CREATE POLICY "Anyone can update bills" ON public.bills FOR UPDATE USING (true) WITH CHECK (true);
