"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function PrivacyPage() {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)

  const handleAccept = () => {
    if (accepted) {
      // Store acceptance in localStorage
      localStorage.setItem("nexo_privacy_accepted", "true")
      router.back()
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-black mb-2">Privacy Policy</h1>
          <p className="text-neutral-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-neutral max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              We collect information you provide directly to us, such as when you create an account, complete surveys, or use our services:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Account Information:</strong> Email address, password (encrypted)</li>
              <li><strong>Survey Responses:</strong> Your answers to political survey questions</li>
              <li><strong>Political Views:</strong> Your expressed political opinions and preferences</li>
              <li><strong>Chat Messages:</strong> Conversations with our AI assistant</li>
              <li><strong>Usage Data:</strong> How you interact with our platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Provide and maintain our political engagement platform</li>
              <li>Generate your personalized political profile</li>
              <li>Enable AI-powered political discussions</li>
              <li>Create anonymized, aggregated insights about political trends</li>
              <li>Improve our services and user experience</li>
              <li>Communicate with you about your account and our services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
            <p className="mb-4">
              We do not sell, trade, or rent your personal information to third parties. We may share information in the following limited circumstances:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Aggregated Data:</strong> We may share anonymized, aggregated political insights that cannot identify you</li>
              <li><strong>Service Providers:</strong> We may share information with trusted third parties who assist us in operating our platform</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect our rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <p className="mb-4">
              We implement appropriate security measures to protect your personal information:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>All data is encrypted in transit and at rest</li>
              <li>We use industry-standard security practices</li>
              <li>Access to your data is restricted to authorized personnel only</li>
              <li>We regularly review and update our security measures</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
            <p className="mb-4">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct your information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to certain processing of your data</li>
            </ul>
            <p className="mb-4">
              To exercise these rights, please contact us at privacy@nexo.app
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="mb-4">
              We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy. When you delete your account, we will delete your personal data within 30 days, except where we are required to retain it for legal or regulatory purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Remember your preferences and settings</li>
              <li>Analyze how you use our platform</li>
              <li>Improve our services and user experience</li>
            </ul>
            <p className="mb-4">
              You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Children's Privacy</h2>
            <p className="mb-4">
              Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. International Transfers</h2>
            <p className="mb-4">
              Your information may be transferred to and processed in countries other than your own. We ensure that such transfers comply with applicable data protection laws and implement appropriate safeguards.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p className="mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of our service after such changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mb-4">
              Email: privacy@nexo.app<br />
              Address: [Your Business Address]
            </p>
          </section>
        </div>

        <div className="mt-12 p-6 bg-neutral-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="accept-privacy"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="accept-privacy" className="text-sm text-neutral-700">
              I have read and agree to the Privacy Policy above
            </label>
          </div>
          <button
            onClick={handleAccept}
            disabled={!accepted}
            className="mt-4 w-full bg-black text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Accept Privacy Policy and Continue
          </button>
        </div>
      </div>
    </div>
  )
}
