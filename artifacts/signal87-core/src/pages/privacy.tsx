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

export default function Privacy() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-12">Last updated: June 2026</p>

        <div className="space-y-10">
          <Section title="Overview">
            <p>
              Signal87 AI is a document intelligence platform. This policy explains what information we handle when you use the service, how it is used, and your rights regarding that data.
            </p>
          </Section>

          <Section title="Information you provide">
            <p>
              <strong className="text-foreground">Documents you upload.</strong> When you upload a file, we store the original file bytes and extract its text content. Both are retained in our database and object storage so the service can answer your questions and allow you to re-download or re-index the file later.
            </p>
            <p>
              <strong className="text-foreground">Questions and chat history.</strong> The questions you type are processed together with relevant excerpts from your document to generate a response. We store your chat history so you can review past conversations within the application.
            </p>
          </Section>

          <Section title="How we use your data">
            <p>
              We use the data you provide solely to operate the service — to answer your questions about your documents and display results to you. We do not sell your data, share it with third parties for advertising, or use it to train AI models.
            </p>
          </Section>

          <Section title="AI and third-party providers">
            <p>
              Signal87 AI uses <strong className="text-foreground">OpenAI</strong> to generate responses and compute document embeddings. When you submit a question, relevant passages from your document and your question text are sent to the OpenAI API. OpenAI's own{" "}
              <a
                href="https://openai.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                privacy policy
              </a>{" "}
              governs how they handle that data.
            </p>
            <p>
              We use the OpenAI API under terms that prohibit OpenAI from training on API inputs by default. Your document content is not used to train OpenAI's models.
            </p>
          </Section>

          <Section title="Data storage and retention">
            <p>
              Uploaded documents, extracted text, source chunks, and chat history are stored until you delete them. You can delete any document — and all associated history — from within the application at any time. Deletion is permanent and cannot be undone.
            </p>
            <p>
              We retain server logs (request metadata, error information) for operational and debugging purposes. These logs do not contain the full content of your documents or questions.
            </p>
          </Section>

          <Section title="Cookies and analytics">
            <p>
              Signal87 AI does not use tracking cookies or third-party analytics services. The application may use browser session state to maintain your place while the app is open. No persistent tracking identifiers are set.
            </p>
          </Section>

          <Section title="Security">
            <p>
              Documents are stored in private object storage with access controls. All connections to the service use HTTPS. We take reasonable technical steps to protect your data. That said, no system is perfectly secure — please do not upload documents you would not be comfortable sending to a third-party AI provider.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy? Reach us at the{" "}
              <Link href="/contact" className="text-primary hover:underline">Contact page</Link>{" "}
              or by email at{" "}
              <a href="mailto:hello@signal87.ai" className="text-primary hover:underline">
                hello@signal87.ai
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </PublicLayout>
  );
}
