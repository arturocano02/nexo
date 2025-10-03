"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function TermsPage() {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)

  const handleAccept = () => {
    if (accepted) {
      // Store acceptance in localStorage
      localStorage.setItem("nexo_terms_accepted", "true")
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
          <h1 className="text-3xl font-bold text-black mb-2">Terms and Conditions</h1>
          <p className="text-neutral-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-neutral max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">
              By accessing and using Nexo ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="mb-4">
              Nexo is a political engagement platform that allows users to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Complete political surveys to assess their views</li>
              <li>Engage in political discussions with an AI assistant</li>
              <li>View their political profile and how it evolves over time</li>
              <li>See aggregated political data from other users (anonymized)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts and Registration</h2>
            <p className="mb-4">
              To use certain features of the Service, you must register for an account. You agree to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Privacy and Data Protection</h2>
            <p className="mb-4">
              We are committed to protecting your privacy. Our data practices include:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>We collect only necessary information to provide the service</li>
              <li>Your political views and survey responses are stored securely</li>
              <li>We use aggregated, anonymized data for research and insights</li>
              <li>We do not sell your personal data to third parties</li>
              <li>You can request deletion of your data at any time</li>
            </ul>
            <p className="mb-4">
              For detailed information about our data practices, please refer to our Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. User Content and Conduct</h2>
            <p className="mb-4">
              You are responsible for all content you submit to the Service. You agree not to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Submit content that is illegal, harmful, or violates others' rights</li>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with the proper functioning of the Service</li>
              <li>Submit content that contains viruses or malicious code</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. AI Assistant and Content</h2>
            <p className="mb-4">
              The Service includes an AI assistant for political discussions. Please note:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>The AI assistant is designed to challenge and engage with political views</li>
              <li>AI responses are generated automatically and may not reflect our views</li>
              <li>We do not endorse or guarantee the accuracy of AI-generated content</li>
              <li>Use the AI assistant responsibly and critically evaluate its responses</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="mb-4">
              The Service and its original content, features, and functionality are owned by Nexo and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Disclaimers and Limitations</h2>
            <p className="mb-4">
              The Service is provided "as is" without warranties of any kind. We disclaim all warranties, express or implied, including but not limited to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Warranties of merchantability and fitness for a particular purpose</li>
              <li>Warranties regarding the accuracy or reliability of the Service</li>
              <li>Warranties that the Service will be uninterrupted or error-free</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="mb-4">
              In no event shall Nexo be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
            <p className="mb-4">
              We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including if you breach these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
            <p className="mb-4">
              We reserve the right to modify these Terms at any time. We will notify users of any material changes via email or through the Service. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p className="mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the United Kingdom, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p className="mb-4">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="mb-4">
              Email: legal@nexo.app<br />
              Address: [Your Business Address]
            </p>
          </section>
        </div>

        <div className="mt-12 p-6 bg-neutral-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="accept-terms"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="accept-terms" className="text-sm text-neutral-700">
              I have read and agree to the Terms and Conditions above
            </label>
          </div>
          <button
            onClick={handleAccept}
            disabled={!accepted}
            className="mt-4 w-full bg-black text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Accept Terms and Continue
          </button>
        </div>
      </div>
    </div>
  )
}
