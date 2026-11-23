/** Lead types shown in /admin/leads and the table each one lives in. */
export const LEAD_TABLES = {
  sell_car: "sell_car_requests",
  part: "part_requests",
  return: "return_requests",
  contact: "contact_messages",
} as const;

export type LeadType = keyof typeof LEAD_TABLES;

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  sell_car: "Sell your car",
  part: "Part requests & offers",
  return: "Returns",
  contact: "Contact",
};

/** DB enum value -> label. "in_progress" is presented to staff as "Contacted". */
export const LEAD_STATUS_LABELS = {
  new: "New",
  in_progress: "Contacted",
  closed: "Closed",
  spam: "Spam",
} as const;

export type LeadStatusValue = keyof typeof LEAD_STATUS_LABELS;
