import { BaseEmailTemplate } from "./base.template.js";
import { config } from "../../config.js";

export const ApproveOrderStatusChangeTemplate = (
  orderId: string,
  partImage: string,
) => {
  const url = `${config.frontendUrl}/supplier/orders/${orderId}?tab=workflow`;
  const content = `
    <mj-section padding="20px">
      <mj-column>
        <mj-text font-size="22px" font-weight="700" align="center">
          Part Status Change Approved
        </mj-text>

        <mj-text font-size="15px" align="center" color="#555">
          Your request to update the status of a manufacturing part was approved.
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section padding="10px 0">
      <mj-column background-color="#ffffff" border-radius="8px" padding="20px">
        <mj-text font-size="16px" font-weight="600">
          Request Approved
        </mj-text>

        <mj-text font-size="14px" color="#555" padding-bottom="20px">
          The requested status change has been approved and updated in the system.
        </mj-text>

        <mj-image
          src="${partImage}"
          alt="Part Preview"
          border-radius="6px"
          width="250px"
          padding-bottom="20px"
        />

        <mj-button
          background-color="#2563eb"
          color="#ffffff"
          href="${url}"
          border-radius="6px"
          font-weight="600"
        >
          Review Part
        </mj-button>
      </mj-column>
    </mj-section>
  `;

  return BaseEmailTemplate(content, "Part Status Change Approved");
};
