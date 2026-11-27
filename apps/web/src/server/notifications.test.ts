import { describe, expect, it } from "vitest";
import { buildEscalationEmail, escapeHtml } from "./notifications";

describe("escapeHtml", () => {
  it("escapes markup", () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;");
  });
});

describe("buildEscalationEmail", () => {
  const payload = {
    contactName: '<img src=x onerror="alert(1)">\r\nBcc: evil@example.com',
    contactWaId: "201000000000",
    conversationId: "c1",
    tenantName: "Clinic",
    notificationEmail: "owner@example.com",
    reason: "Wants a refund",
  };

  it("escapes customer-controlled fields", () => {
    const { html } = buildEscalationEmail(payload, "https://app.example.com/");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("https://app.example.com/dashboard/conversations/c1");
    expect(html).toContain("Wants a refund");
  });

  it("keeps the subject on one line", () => {
    expect(buildEscalationEmail(payload, "https://x").subject).not.toMatch(/[\r\n]/);
  });
});
