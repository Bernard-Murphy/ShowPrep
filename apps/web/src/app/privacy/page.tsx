import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Showprep",
  description: "Privacy Policy for Showprep",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl prose prose-invert">
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: March 16, 2025</p>

      <h2>1. Information We Collect</h2>
      <p>
        When you sign in with YouTube/Google, we receive and store the following
        information from Google:
      </p>
      <ul>
        <li>Your Google account identifier and YouTube channel information</li>
        <li>Your YouTube channel ID, channel title, and profile thumbnail</li>
        <li>Email address and basic profile information (if provided by Google)</li>
        <li>Your YouTube subscription list (channels you are subscribed to) when you use our sync feature</li>
      </ul>
      <p>
        We also collect usage data necessary to operate the service, such as content
        you create (articles, gencasts), votes, and comments.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Create and manage your account</li>
        <li>Provide the Showprep service (summaries, gencasts, feed)</li>
        <li>Sync your YouTube subscriptions to personalize your feed</li>
        <li>Improve and operate our service</li>
        <li>Comply with applicable law</li>
      </ul>

      <h2>3. Data Storage and Security</h2>
      <p>
        Your data is stored on secure servers. We use industry-standard measures to
        protect your information. We do not sell your personal information to third
        parties.
      </p>

      <h2>4. Third-Party Services</h2>
      <p>
        We use Google APIs (including YouTube Data API v3) for authentication and
        to access your YouTube data in accordance with Google&apos;s API Services User
        Data Policy. Your use of Showprep is also subject to Google&apos;s Privacy
        Policy.
      </p>

      <h2>5. Your Rights</h2>
      <p>You may:</p>
      <ul>
        <li>Request access to the personal data we hold about you</li>
        <li>Request correction or deletion of your data</li>
        <li>Disconnect your YouTube account at any time from Dashboard</li>
        <li>Delete your account by contacting us</li>
      </ul>

      <h2>6. Contact</h2>
      <p>
        For privacy-related questions or requests, please contact us at the email
        address provided in the Showprep application or on our website.
      </p>

      <p className="mt-8">
        <Link href="/" className="text-primary hover:underline">
          Back to Showprep
        </Link>
      </p>
    </div>
  );
}
