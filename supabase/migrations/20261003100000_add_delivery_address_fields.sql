-- Add delivery address fields to patient table
ALTER TABLE public.patient
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_recipient_name TEXT,
ADD COLUMN IF NOT EXISTS delivery_recipient_phone TEXT,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

COMMENT ON COLUMN public.patient.delivery_address IS 'Địa chỉ giao thuốc (nếu khác địa chỉ thường trú)';
COMMENT ON COLUMN public.patient.delivery_recipient_name IS 'Tên người nhận thuốc';
COMMENT ON COLUMN public.patient.delivery_recipient_phone IS 'SĐT người nhận thuốc';
COMMENT ON COLUMN public.patient.delivery_notes IS 'Ghi chú cho shipper';
