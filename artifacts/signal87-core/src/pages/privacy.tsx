import { type ReactNode } from "react";
import { PublicLayout } from "@/components/public-layout";
import { Link } from "wouter";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3 text-sm">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function Privacy() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-12">Last updated: June 29, 2026</p>

        <div className="space-y-10">
          <Section title="Overview">
            <p>
              Signal87 AI (&quot;Signal87,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates a private document
              intelligence workspace at{" "}
              <a href="https://www.signal87.ai" className="text-primary hover:underline">
                signal87.ai
              </a>
              . This Privacy Policy explains what personal information and document content we process when you
              use the service, how we use it, which providers help us run the platform, and the choices available
              to you.
            </p>
            <p>
              If you do not agree with this policy, please do not use Signal87. For questions or data requests,
              contact us at{" "}
              <a href="mailto:contact@signal87.ai" className="text-primary hover:underline">
                contact@signal87.ai
              </a>
              .
            </p>
          </Section>

          <Section title="Summary of key points">
            <BulletList
              items={[
                <>
                  <strong className="text-foreground">What we collect:</strong> account information from our
                  authentication provider, documents and notes you upload or create, AI questions and outputs,
                  and limited technical logs.
                </>,
                <>
                  <strong className="text-foreground">Why we process it:</strong> to authenticate you, store and
                  analyze your documents, generate cited answers, operate billing, and keep the service secure.
                </>,
                <>
                  <strong className="text-foreground">AI processing:</strong> relevant document excerpts and your
                  prompts may be sent to third-party AI APIs (xAI Grok and Google Gemini) to generate responses.
                  OpenAI is disabled in our default production configuration.
                </>,
                <>
                  <strong className="text-foreground">We do not sell your data</strong> or use it for
                  third-party advertising.
                </>,
                <>
                  <strong className="text-foreground">Your controls:</strong> delete documents and notes in the
                  app; contact us to request account-related deletion or access.
                </>,
              ]}
            />
          </Section>

          <Section title="Information we collect">
            <p>
              <strong className="text-foreground">Account and identity data.</strong> When you sign in, our
              authentication provider (Clerk) collects and shares with us information needed to operate your
              account, such as your email address, name (if provided), authentication identifiers, and sign-in
              method. We associate your documents, notes, and activity with your account identifier.
            </p>
            <p>
              <strong className="text-foreground">Documents you upload.</strong> When you upload a file, we store
              the original file and extract machine-readable text. We split extracted text into searchable chunks
              and index those chunks on our infrastructure so the service can retrieve relevant passages when you
              ask questions. File metadata (name, type, size, upload time, processing status) is also stored.
            </p>
            <p>
              <strong className="text-foreground">Notes and workspace content.</strong> Text you create in Notes,
              document selections, chat questions, analyze/brief requests, and AI-generated responses may be stored
              so you can review past work inside the application.
            </p>
            <p>
              <strong className="text-foreground">Billing information.</strong> If you subscribe to a paid plan,
              payment processing is handled by Stripe. We receive subscription status and limited billing metadata
              from Stripe; we do not store full payment card numbers on our servers.
            </p>
            <p>
              <strong className="text-foreground">Technical and security data.</strong> We collect standard server
              logs (for example, request timestamps, routes, response status, and error diagnostics). These logs
              are used for operations, abuse prevention, and debugging. We design logging to avoid storing
              document body content or chat text in routine access logs.
            </p>
            <p>
              <strong className="text-foreground">What we do not intentionally collect.</strong> We do not run
              third-party advertising trackers. We do not ask you to provide sensitive categories of personal
              information (such as government ID numbers or health records) as part of signup; however,{" "}
              <strong className="text-foreground">you control what you upload</strong> — do not upload documents
              containing personal data you are not authorized to share.
            </p>
          </Section>

          <Section title="How we use your information">
            <BulletList
              items={[
                "Provide, maintain, and improve the Signal87 workspace (upload, preview, search, chat, analyze, skills, and citations).",
                "Authenticate users and enforce per-account access controls so your documents remain private to your account.",
                "Send relevant document excerpts and your prompts to configured AI providers to generate responses.",
                "Process subscriptions and billing through Stripe.",
                "Monitor reliability, prevent fraud and abuse, and comply with applicable law.",
                "Respond to support requests and legal or security inquiries.",
              ]}
            />
            <p>
              We use your content to deliver the service to you. We do not use your uploaded documents or
              questions to train our own models, and we do not sell personal information.
            </p>
          </Section>

          <Section title="AI processing and third-party providers">
            <p>
              Signal87 is a document-grounded AI product. When you ask a question or run an analysis, the system
              retrieves relevant passages from your indexed documents and sends those excerpts together with your
              prompt to one or more AI providers configured for our environment.
            </p>
            <p>
              <strong className="text-foreground">Current production AI routing.</strong> Our default configuration
              uses <strong className="text-foreground">xAI (Grok)</strong> as the primary reasoning provider and{" "}
              <strong className="text-foreground">Google (Gemini via Google Cloud / Vertex AI)</strong> as a
              fallback. Document retrieval and ranking use our own infrastructure (including local lexical
              retrieval); we do not send your full document library to AI providers on every request.
            </p>
            <p>
              <strong className="text-foreground">OpenAI.</strong> OpenAI is <strong className="text-foreground">disabled by default</strong> in
              our runtime policy unless explicitly re-enabled by an operator. The live service is not intended to
              rely on OpenAI for reasoning or embeddings.
            </p>
            <p>
              Data sent to AI providers is limited to what is needed to fulfill your request (for example, retrieved
              excerpts, your question, and task instructions). Those providers process data under their own terms
              and privacy policies:
            </p>
            <BulletList
              items={[
                <>
                  xAI —{" "}
                  <a
                    href="https://x.ai/legal/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    x.ai/legal/privacy-policy
                  </a>
                </>,
                <>
                  Google Cloud / Gemini —{" "}
                  <a
                    href="https://cloud.google.com/terms/cloud-privacy-notice"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Cloud Privacy Notice
                  </a>
                </>,
              ]}
            />
            <p>
              AI-generated answers may be incomplete or incorrect even when citations are shown. Do not upload
              material you would not be comfortable sharing with a contracted AI subprocessors under your own
              compliance requirements.
            </p>
          </Section>

          <Section title="Infrastructure and subprocessors">
            <p>
              We use the following categories of service providers to operate Signal87. Each processes data only as
              needed to provide its service to us:
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Provider</th>
                    <th className="px-3 py-2 font-semibold">Role</th>
                    <th className="px-3 py-2 font-semibold">Typical data involved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-3 py-2 align-top">Clerk</td>
                    <td className="px-3 py-2 align-top">Authentication &amp; session management</td>
                    <td className="px-3 py-2 align-top">Email, name, auth tokens/identifiers</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top">Render</td>
                    <td className="px-3 py-2 align-top">Application hosting</td>
                    <td className="px-3 py-2 align-top">Application traffic, operational logs</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top">PostgreSQL (managed database)</td>
                    <td className="px-3 py-2 align-top">Structured application data</td>
                    <td className="px-3 py-2 align-top">Account-linked metadata, chunks, chat/brief records</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top">Render persistent disk / local file store</td>
                    <td className="px-3 py-2 align-top">Original uploaded files</td>
                    <td className="px-3 py-2 align-top">Document binaries you upload</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top">Stripe</td>
                    <td className="px-3 py-2 align-top">Payments &amp; subscriptions</td>
                    <td className="px-3 py-2 align-top">Billing identifiers, subscription status</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top">xAI</td>
                    <td className="px-3 py-2 align-top">Primary AI reasoning</td>
                    <td className="px-3 py-2 align-top">Prompts and retrieved document excerpts</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 align-top">Google Cloud (Gemini)</td>
                    <td className="px-3 py-2 align-top">Fallback AI reasoning</td>
                    <td className="px-3 py-2 align-top">Prompts and retrieved document excerpts</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              We may update subprocessors as the platform evolves. Material changes to how we share data will be
              reflected in this policy.
            </p>
          </Section>

          <Section title="How we share information">
            <p>We do not sell your personal information. We share information only in these situations:</p>
            <BulletList
              items={[
                "With subprocessors listed above, under contracts or terms that limit their use of the data to providing services to us.",
                "When you direct the service to process a document or question (which requires sending excerpts to AI providers as described above).",
                "To comply with law, regulation, legal process, or governmental request, or to protect the rights, safety, and security of users and the service.",
                "In connection with a merger, acquisition, financing, or sale of assets, subject to continued protection of your information.",
              ]}
            />
          </Section>

          <Section title="Data storage, retention, and deletion">
            <p>
              Your documents, extracted text, chunks, notes, and AI interaction history are stored in our database
              and file storage and are scoped to your account. Original uploads are kept on durable storage so you
              can download, re-index, and analyze files over time.
            </p>
            <p>
              You may delete documents from within the application. Deleted items may be held in Trash for a period
              before permanent removal, depending on product behavior at the time of deletion. Permanent deletion
              removes associated chunks and stored originals from active service storage, subject to routine backup
              and log retention windows.
            </p>
            <p>
              To request deletion of account-level data or to ask what we hold about your account, email{" "}
              <a href="mailto:contact@signal87.ai" className="text-primary hover:underline">
                contact@signal87.ai
              </a>{" "}
              from the address associated with your account. We may need to verify your identity before fulfilling
              the request.
            </p>
            <p>
              We retain server and security logs for a limited operational period, then delete or aggregate them
              according to our internal retention practices.
            </p>
          </Section>

          <Section title="Cookies and similar technologies">
            <p>
              Signal87 does not use third-party advertising cookies or consumer analytics trackers (such as ad
              pixels or social tracking widgets).
            </p>
            <p>
              We do use cookies and similar technologies where required for core functionality:
            </p>
            <BulletList
              items={[
                "Clerk authentication cookies and session tokens to keep you signed in securely.",
                "Limited UI preference cookies (for example, sidebar state) to remember layout choices in the logged-in app.",
              ]}
            />
            <p>
              You can control cookies through your browser settings. Disabling authentication cookies will prevent
              you from staying signed in.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We use technical and organizational measures designed to protect your information, including HTTPS
              for data in transit, account-scoped access controls, and private storage for uploaded files. No
              method of transmission or storage is completely secure; we cannot guarantee absolute security.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for uploading
              only content you are authorized to process on the platform.
            </p>
          </Section>

          <Section title="Your privacy rights">
            <p>
              Depending on where you live, you may have rights to access, correct, delete, or obtain a copy of
              certain personal information we hold about you, and to object to or restrict particular processing.
              US state privacy laws may also give you the right to opt out of certain data uses; Signal87 does not
              sell personal information or use it for cross-context behavioral advertising.
            </p>
            <p>
              To exercise your rights, contact{" "}
              <a href="mailto:contact@signal87.ai" className="text-primary hover:underline">
                contact@signal87.ai
              </a>
              . We will respond as required by applicable law. You may also have the right to appeal or complain to
              your local data protection authority.
            </p>
          </Section>

          <Section title="International users">
            <p>
              Signal87 is operated from the United States. If you access the service from other regions, your
              information may be processed in the United States and other countries where our subprocessors operate.
              Those countries may have data protection laws that differ from those in your jurisdiction.
            </p>
          </Section>

          <Section title="Children">
            <p>
              Signal87 is not directed to children under 13 (or the minimum age required in your jurisdiction), and
              we do not knowingly collect personal information from children. If you believe a child has provided us
              personal information, contact us and we will take appropriate steps to delete it.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the top of
              this page will change when we do. If we make material changes, we may provide additional notice in
              the product or by email where appropriate.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy or our data practices? Reach us on the{" "}
              <Link href="/contact" className="text-primary hover:underline">
                Contact page
              </Link>{" "}
              or by email at{" "}
              <a href="mailto:contact@signal87.ai" className="text-primary hover:underline">
                contact@signal87.ai
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </PublicLayout>
  );
}