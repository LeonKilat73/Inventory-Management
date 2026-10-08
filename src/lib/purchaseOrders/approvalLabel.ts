export type ApprovalStatus = "pending" | "approved" | "rejected" | null;

// "Not approved" is purely a label -- it never blocks receiving or anything
// else. Orders created before approval existed have no approver and no label.
export function approvalLabel(status: ApprovalStatus): { text: string; tone: "primary" | "error" | "tertiary" | "neutral" } {
  switch (status) {
    case "approved":
      return { text: "Approved", tone: "primary" };
    case "rejected":
      return { text: "Rejected", tone: "error" };
    case "pending":
      return { text: "Not approved yet", tone: "tertiary" };
    default:
      return { text: "No approval", tone: "neutral" };
  }
}
