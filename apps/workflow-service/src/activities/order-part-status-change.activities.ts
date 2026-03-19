import { SocialLinks, Tables } from "../constants/index.js";
import { config } from "../config.js";
import { sendEmail, type SendEmailDetails } from "../lib/email.js";
import { logger } from "../lib/logger.js";
import { renderEmail } from "../lib/render-email.js";
import { supabase } from "../lib/supabase.js";
import type { AddressContact } from "../types/index.js";

const OrderStatusChangeEmailTemplate = (
  orderId: string,
  partName: string,
  partImageUrl: string | null,
  userName: string,
  prevStatus: string,
  currentStatus: string,
  orderShippingDetails: {
    shipping_method: string;
    address_snapshot: AddressContact;
    tracking_number: string;
  },
  notes: string,
) => {
  const portalUrl = `${config.frontendUrl}/portal/orders/${orderId}`;

  return `
<mjml>
  <mj-head>
    <mj-title>Update: Your part has moved to a new phase</mj-title>
    <mj-preview>Good news! Your part ${partName} has moved to the ${currentStatus} phase.</mj-preview>

    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" />
      <mj-text color="#0f172a" font-size="14px" line-height="24px" padding="0" />
      <mj-button background-color="#2563eb" color="#ffffff" border-radius="8px" font-size="14px" font-weight="600" padding="20px 0" />
      <mj-divider border-width="1px" border-color="#e2e8f0" />
      <mj-class name="footer-small" font-size="12px" color="#94a3b8" line-height="18px" />
      <mj-class name="muted" color="#64748b" />
      <mj-class name="status-badge" font-weight="bold" font-size="12px" text-transform="uppercase" />
    </mj-attributes>

    <mj-style inline="inline">
      .status-container {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }
      .phase-arrow {
        color: #94a3b8;
        font-size: 24px;
      }
      .footer-link a { color: #94a3b8; text-decoration: underline; }
      .brand-text { color: #2563eb; font-weight: 700; }
      .part-image {
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        object-fit: contain;
        background-color: #ffffff;
      }
    </mj-style>
  </mj-head>

  <mj-body background-color="#f6f9ff">
    <mj-section padding="32px 0 24px 0">
      <mj-column>
        <mj-image width="160px" src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png" alt="Frigate Fast Parts" />
      </mj-column>
    </mj-section>

    <mj-section padding="0 24px">
      <mj-column background-color="#ffffff" padding="40px" border-radius="16px">
        <mj-text font-size="24px" font-weight="800" color="#1e293b" padding-bottom="24px">
          Production Update
        </mj-text>

        <mj-text padding-bottom="16px" font-size="16px">Hello <b>${userName}</b>,</mj-text>

        <mj-text padding-bottom="32px">
          We’re writing to let you know that your part <span class="brand-text">${partName}</span> (Order #${orderId}) has successfully progressed to the next stage of production.
        </mj-text>

        ${
          partImageUrl
            ? `
        <mj-section padding="0 0 32px 0">
          <mj-column width="100%">
            <mj-image src="${partImageUrl}" alt="${partName}" width="200px" css-class="part-image" />
            <mj-text align="center" font-size="12px" mj-class="muted" padding-top="8px">${partName}</mj-text>
          </mj-column>
        </mj-section>
        `
            : ""
        }

        <mj-table css-class="status-container">
          <tr>
            <td style="padding: 24px; text-align: center; width: 45%;">
              <div style="color: #64748b; font-size: 11px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Previous</div>
              <div style="font-weight: 700; color: #94a3b8; font-size: 16px;">${prevStatus}</div>
            </td>
            <td style="padding: 24px 0; text-align: center; width: 10%;">
              <span class="phase-arrow">→</span>
            </td>
            <td style="padding: 24px; text-align: center; width: 45%;">
              <div style="color: #2563eb; font-size: 11px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Current</div>
              <div style="font-weight: 700; color: #2563eb; font-size: 16px;">${currentStatus}</div>
            </td>
          </tr>
        </mj-table>

        <mj-spacer height="32px" />

        <mj-text font-weight="700" font-size="18px" color="#1e293b" padding-bottom="12px">
          Next Steps
        </mj-text>

        <mj-text padding-bottom="24px">
          Our team is now focusing on the <b style="color: #2563eb;">${currentStatus}</b> phase to ensure the highest quality standards are met for your order.
        </mj-text>

        ${
          notes
            ? `
        <mj-text padding="16px" background-color="#fdf2f8" color="#9d174d" border-radius="8px" font-style="italic" padding-bottom="24px">
          <b>Note:</b> ${notes}
        </mj-text>
        `
            : ""
        }

        <mj-button href="${portalUrl}" align="left">
          Track in Dashboard
        </mj-button>

        <mj-spacer height="32px" />
        <mj-divider />
        <mj-spacer height="24px" />

        <mj-text mj-class="muted" font-size="13px">
          Have technical questions about this phase? 
          <a href="mailto:support@frigate.ai" style="color:#2563eb; text-decoration:none; font-weight: 600;">Contact your account manager</a>.
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section padding="24px 24px 48px 24px">
      <mj-column>
        <mj-social font-size="12px" icon-size="24px" mode="horizontal" padding-bottom="20px">
          <mj-social-element name="linkedin" href="https://www.linkedin.com/company/frigates/" background-color="#94a3b8"></mj-social-element>
          <mj-social-element name="web" href="https://frigate.ai" background-color="#94a3b8"></mj-social-element>
        </mj-social>

        <mj-text align="center" mj-class="footer-small">
          © ${new Date().getFullYear()} <b>Frigate Engineering Services Pvt Ltd</b>
        </mj-text>
        <mj-text align="center" mj-class="footer-small" padding-top="8px">
          You’re receiving this because you have an active order with Frigate.
        </mj-text>
        <mj-text align="center" mj-class="footer-small" css-class="footer-link" padding-top="12px">
          <a href="https://frigate.ai/policy/privacy-policy/">Privacy Policy</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;
};

const OrderCompletionEmailTemplate = (
  orderId: string,
  parts: any[],
  userName: string,
  orderShippingDetails: {
    shipping_method: string;
    address_snapshot: AddressContact;
    tracking_number: string;
  },
) => {
  const portalUrl = `${config.frontendUrl}/portal/orders/${orderId}`;

  const partsListHtml = parts
    .map((part) => {
      const imageUrl = part.rfq_parts?.snapshot_2d_url;
      return `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #f1f5f9; width: 60px;">
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${part.part_name}" width="50" style="border-radius: 4px; border: 1px solid #e2e8f0; display: block;" />`
            : `<div style="width: 50px; height: 50px; background-color: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0;"></div>`
        }
      </td>
      <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9;">
        <div style="font-weight: 600; color: #1e293b; font-size: 14px;">${part.part_name}</div>
        <div style="font-size: 12px; color: #64748b;">${part.part_code}</div>
      </td>
      <td style="padding: 16px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">
        <span style="background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Completed</span>
      </td>
    </tr>
  `;
    })
    .join("");

  return `
<mjml>
  <mj-head>
    <mj-title>Order Shipped: Your parts are on the way</mj-title>
    <mj-preview>Your order #${orderId} has been fully shipped. All parts are on their way.</mj-preview>

    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" />
      <mj-text color="#0f172a" font-size="14px" line-height="24px" padding="0" />
      <mj-button background-color="#2563eb" color="#ffffff" border-radius="8px" font-size="14px" font-weight="600" padding="20px 0" />
      <mj-divider border-width="1px" border-color="#e2e8f0" />
      <mj-class name="footer-small" font-size="12px" color="#94a3b8" line-height="18px" />
      <mj-class name="muted" color="#64748b" />
    </mj-attributes>

    <mj-style inline="inline">
      .shipping-card {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
      }
      .tracking-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background-color: #f1f5f9;
        padding: 6px 10px;
        border-radius: 6px;
        font-weight: 700;
        color: #0f172a;
        border: 1px solid #cbd5e1;
      }
      .footer-link a { color: #94a3b8; text-decoration: underline; }
      .address-box {
        background-color: #ffffff;
        border: 1px dashed #cbd5e1;
        padding: 16px;
        border-radius: 8px;
        margin-top: 12px;
      }
      .parts-list-container {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 0 20px;
      }
    </mj-style>
  </mj-head>

  <mj-body background-color="#f6f9ff">
    <mj-section padding="40px 0 24px 0">
      <mj-column>
        <mj-image width="160px" src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png" alt="Frigate Fast Parts" />
      </mj-column>
    </mj-section>

    <mj-section padding="0 24px">
      <mj-column background-color="#ffffff" padding="40px" border-radius="16px">
        <mj-text font-size="24px" font-weight="800" color="#059669" padding-bottom="24px">
          Your order has shipped! 🚚
        </mj-text>

        <mj-text padding-bottom="16px" font-size="16px">Hello <b>${userName}</b>,</mj-text>

        <mj-text padding-bottom="32px">
          Great news! Your complete order <b style="color: #059669;">#${orderId}</b> has been picked up by the carrier and is now on its way to you.
        </mj-text>

        <mj-text font-weight="700" font-size="16px" color="#1e293b" padding-bottom="12px">
          Parts in this Shipment
        </mj-text>
        <mj-table css-class="parts-list-container" padding-bottom="32px">
          ${partsListHtml}
        </mj-table>

        <mj-table css-class="shipping-card" padding="24px">
          <tr>
            <td style="padding-bottom: 12px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Carrier</td>
            <td style="padding-bottom: 12px; text-align: right; font-weight: 700; color: #1e293b;">${
              orderShippingDetails.shipping_method || "Express Shipping"
            }</td>
          </tr>
          <tr>
            <td style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Tracking Number</td>
            <td style="text-align: right;">
              <span class="tracking-code">${
                orderShippingDetails.tracking_number || "Awaiting tracking"
              }</span>
            </td>
          </tr>
        </mj-table>

        <mj-spacer height="32px" />

        <mj-table>
          <tr>
            <td style="width: 100%; border-bottom: none;">
               <mj-text font-weight="700" font-size="14px" color="#1e293b" padding-bottom="8px">
                Shipping Address
              </mj-text>
              <mj-text css-class="muted" font-size="13px">
                <div class="address-box">
                  ${orderShippingDetails.address_snapshot.street1}<br/>
                  ${
                    orderShippingDetails.address_snapshot.street2
                      ? `${orderShippingDetails.address_snapshot.street2}<br/>`
                      : ""
                  }
                  ${orderShippingDetails.address_snapshot.city}, ${orderShippingDetails.address_snapshot.country} ${orderShippingDetails.address_snapshot.zip}
                </div>
              </mj-text>
            </td>
          </tr>
        </mj-table>

        <mj-spacer height="32px" />
        <mj-button href="${portalUrl}" align="left">
          Track Package Detailed
        </mj-button>

        <mj-spacer height="32px" />
        <mj-divider />
        <mj-spacer height="24px" />

        <mj-text mj-class="muted" font-size="13px">
          Your final invoice and quality inspection reports are available in your dashboard.
          Need assistance? <a href="mailto:support@frigate.ai" style="color:#2563eb; text-decoration:none; font-weight: 600;">Contact Support</a>
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section padding="24px 24px 48px 24px">
      <mj-column>
        <mj-social font-size="12px" icon-size="24px" mode="horizontal" padding-bottom="20px">
          <mj-social-element name="linkedin" href="${SocialLinks.LinkedinEmail}" background-color="#94a3b8"></mj-social-element>
          <mj-social-element name="web" href="${SocialLinks.FrigateOfficialSiteEmail}" background-color="#94a3b8"></mj-social-element>
        </mj-social>

        <mj-text align="center" mj-class="footer-small">
          © ${new Date().getFullYear()} <b>Frigate Engineering Services Pvt Ltd</b>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;
};

export async function checkOrderCompletion(
  orderId: string,
  orderPartId: string,
) {
  try {
    const { data, error } = await supabase
      .from(Tables.OrderPartsTable)
      .select("status, part_code, part_name, id, rfq_parts(snapshot_2d_url)")
      .eq("order_id", orderId);

    if (error) {
      throw error;
    }

    const allPartsCompleted = data.every((part) => part.status === "completed");

    return {
      allPartsCompleted,
      parts: data,
      currentPart: data.find((part) => part.id === orderPartId),
    };
  } catch (error) {
    logger.error(
      { error, orderId, orderPartId },
      "Error while checking order completion",
    );
    throw error;
  }
}

export async function fetchEssentials(
  orderId: string,
  query: string = "address_snapshot, shipping_method, tracking_number",
) {
  try {
    const { data, error } = await supabase
      .from(Tables.OrderShippingTable)
      .select(query)
      .eq("order_id", orderId)
      .single();

    if (error) {
      throw error;
    }

    const { data: order, error: orderError } = await supabase
      .from(Tables.OrdersTable)
      .select("order_code")
      .eq("id", orderId)
      .single();

    if (orderError) {
      throw error;
    }

    return { shippingData: data, order_code: order?.order_code };
  } catch (error) {
    logger.error({ error, orderId }, "Error fetching shipping information");
    throw error;
  }
}

export async function sendOrderStatusChangeEmail(
  orderId: string,
  partName: string,
  partImageUrl: string | null,
  prevStatus: string,
  currentStatus: string,
  orderShippingDetails: {
    shipping_method: string;
    address_snapshot: AddressContact;
    tracking_number: string;
  },
  notes: string,
  documents?: string[],
) {
  try {
    const userName = orderShippingDetails.address_snapshot.name || "Customer";
    const mjmlContent = OrderStatusChangeEmailTemplate(
      orderId,
      partName,
      partImageUrl,
      userName,
      prevStatus,
      currentStatus,
      orderShippingDetails,
      notes,
    );

    const htmlContent = renderEmail(mjmlContent);

    const emailDetails: SendEmailDetails = {
      to: orderShippingDetails.address_snapshot.email,
      subject: `Production Update: ${partName} (Order #${orderId})`,
      html: htmlContent,
      attachments: (documents || []).map((url) => ({
        filename: url.split("/").pop() || "attachment",
        path: url,
      })),
    };

    return await sendEmail(emailDetails);
  } catch (error) {
    logger.error(
      { error, orderId, partName },
      "Error sending order status change email",
    );
    throw error;
  }
}

export async function sendOrderCompletionEmail(
  orderId: string,
  parts: any[],
  orderShippingDetails: {
    shipping_method: string;
    address_snapshot: AddressContact;
    tracking_number: string;
  },
  documents?: string[],
) {
  try {
    const userName = orderShippingDetails.address_snapshot.name || "Customer";
    const mjmlContent = OrderCompletionEmailTemplate(
      orderId,
      parts,
      userName,
      orderShippingDetails,
    );

    const htmlContent = renderEmail(mjmlContent);

    const emailDetails: SendEmailDetails = {
      to: orderShippingDetails.address_snapshot.email,
      subject: `Order Shipped: All parts are on the way! (Order #${orderId})`,
      html: htmlContent,
      attachments: (documents || []).map((url) => ({
        filename: url.split("/").pop() || "attachment",
        path: url,
      })),
    };

    return await sendEmail(emailDetails);
  } catch (error) {
    logger.error({ error, orderId }, "Error sending order completion email");
    throw error;
  }
}
