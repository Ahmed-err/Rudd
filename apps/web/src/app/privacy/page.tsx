export const metadata = {
  title: "Privacy Policy — Rudd",
};

export default function PrivacyPage() {
  const updated = "April 28, 2026";
  const contact = "privacy@sarmadax.com"; // update to your real email
  const appUrl = "https://ruuudd-web.vercel.app";

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 prose prose-neutral">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: {updated}</p>

      <section className="space-y-4 mb-8">
        <p>
          Rudd ("we", "our", or "us"), operated by Sarmadax, provides a WhatsApp AI appointment
          booking platform. This Privacy Policy explains how we collect, use, and protect information
          when you use our service at <a href={appUrl} className="text-primary">{appUrl}</a>.
        </p>
      </section>

      <Section title="1. Information We Collect">
        <ul>
          <li><strong>WhatsApp messages</strong> — message content, sender phone number, and display name sent to your business WhatsApp number.</li>
          <li><strong>Appointment data</strong> — service type, date, time, and notes entered during the booking flow.</li>
          <li><strong>Account information</strong> — organisation name and email address provided when creating a workspace (via Clerk authentication).</li>
          <li><strong>Google Calendar data</strong> — when you connect Google Calendar, we access your calendar to read availability (free/busy) and create or delete appointment events on your behalf.</li>
          <li><strong>Usage data</strong> — error logs and basic telemetry to operate and improve the service.</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul>
          <li>To operate the AI booking assistant and respond to customer WhatsApp messages.</li>
          <li>To create, update, and cancel appointments in your Google Calendar.</li>
          <li>To display conversation history and appointment data in the dashboard.</li>
          <li>To send escalation notification emails when a conversation requires human attention.</li>
          <li>To improve the reliability and performance of the service.</li>
        </ul>
      </Section>

      <Section title="3. Google API Services">
        <p>
          Rudd's use of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-primary" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>Specifically:</p>
        <ul>
          <li>We only request access to Google Calendar (<code>calendar.events</code> scope) when you explicitly connect your calendar in Settings.</li>
          <li>Google Calendar data is used solely to check availability and create/delete appointment events. It is never used for advertising or shared with third parties.</li>
          <li>We store only the OAuth refresh token (encrypted with AES-256-GCM) necessary to maintain your connection. We do not store or read your full calendar data beyond what is needed to book appointments.</li>
          <li>You can disconnect your Google Calendar at any time from Settings → Integrations, which deletes the stored token.</li>
        </ul>
      </Section>

      <Section title="4. Data Storage and Security">
        <ul>
          <li>All data is stored in a Neon PostgreSQL database hosted in the EU (Frankfurt).</li>
          <li>OAuth tokens (Google and WhatsApp) are encrypted at rest using AES-256-GCM before storage.</li>
          <li>All data transmissions use HTTPS/TLS.</li>
          <li>Access to production data is restricted to authorised personnel only.</li>
        </ul>
      </Section>

      <Section title="5. Data Sharing">
        <p>We do not sell your data. We share data only with the following sub-processors necessary to operate the service:</p>
        <ul>
          <li><strong>Vercel</strong> — hosting and serverless compute</li>
          <li><strong>Neon</strong> — database</li>
          <li><strong>Clerk</strong> — authentication and organisation management</li>
          <li><strong>Groq / OpenAI</strong> — AI language model (message content is sent to generate replies)</li>
          <li><strong>Inngest</strong> — background job processing</li>
          <li><strong>Resend</strong> — transactional email (escalation notifications)</li>
          <li><strong>Meta (WhatsApp)</strong> — message delivery</li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        <p>
          Conversation messages and appointment records are retained for as long as your workspace
          exists. You may request deletion of your data by contacting us at the email below.
          Deleting your organisation account removes all associated data within 30 days.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data.</li>
          <li>Disconnect any third-party integration (Google Calendar, WhatsApp) at any time.</li>
        </ul>
        <p>To exercise these rights, contact us at <a href={`mailto:${contact}`} className="text-primary">{contact}</a>.</p>
      </Section>

      <Section title="8. Contact">
        <p>
          If you have questions about this Privacy Policy, please contact us at{" "}
          <a href={`mailto:${contact}`} className="text-primary">{contact}</a>.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}
